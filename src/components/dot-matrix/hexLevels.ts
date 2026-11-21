import { cellToParent, gridDisk, latLngToCell } from 'h3-js';
import type { MapProjection } from '@/lib/mapProjections';
import { mapPointAt, type GlobeView } from './globeProjection';
import { PATCH_RES, loadDetailLookup, type DetailRes, type HexDetailLookup } from './hexDetail';
import type { HexGlDraw, HexGlRenderer } from './hexGlRenderer';
import { hexSpacingRad, tierPatchData, type HexTierData } from './hexMapData';
import type { LevelPrepare, LevelReady, PatchBuilt, PatchFailed, PatchForget, PatchWant } from './hexPatchWorker';

/**
 * Which hex level each part of the map shows as it zooms, and the patches
 * behind it.
 *
 * The map is cut into patches, one per resolution-1 cell (~700 km). A finer
 * level comes in when its cells would be at least `SHOW_PX` across, and goes
 * when they shrink under `HIDE_PX`, so a zoom that stops on the line does not
 * flicker between the two. Each patch on screen shows the finest level it has
 * built, up to the one asked for, and cross-fades when a finer one arrives --
 * so nothing goes blank while the worker catches up, and a patch never shows
 * two levels on top of each other for longer than the fade.
 *
 * At the whole-world view, with every patch on the base level, the base level
 * is drawn as one piece, as it always was: two draw calls, not hundreds.
 */

export type ShownRes = 3 | 4 | 5;

/** A hex size held whatever the zoom, or null to follow the zoom. */
export type HexSizeLock = ShownRes | null;

/** About how far apart each level's cell centres are, for the size control. */
export const HEX_KM: Record<ShownRes, number> = { 3: 120, 4: 45, 5: 17 };

/**
 * Held at 17 km, level 5 still waits until its cells are this many pixels
 * across: over the whole world it is ~570,000 cells, each under a pixel, and
 * the 45 km level stands in until then. It goes again under `LOCKED_LEVEL5_HIDE_PX`,
 * so a zoom resting on the line does not flicker.
 */
export const LOCKED_LEVEL5_MIN_PX = 5;
const LOCKED_LEVEL5_HIDE_PX = 4;

/** A finer level comes in once its cells are this many pixels across... */
const SHOW_PX = 8;
/** ...and goes once they are under this. */
const HIDE_PX = 6.5;
/** Its file is fetched once its cells reach this, a little before it is needed. */
const PREFETCH_PX = 4;
/** The share of a fade done per 60 Hz frame. */
const FADE_PER_FRAME = 0.16;
/** At most this many built patches of a level are kept, GPU and all; the longest off screen go first. */
const CAP: Record<DetailRes, number> = { 4: 480, 5: 90 };
/** How often the set of patches on screen is worked out again while the view moves. */
const VISIBLE_EVERY_MS = 120;

const PATCH_SPACING = hexSpacingRad(PATCH_RES);

export interface LevelStyles {
    /** Changes whenever any style input does. */
    version: number;
    /** The base level's style bytes, by `HexCell.index`. */
    base: Uint8Array;
    /** A detail cell's style byte. */
    detail(res: DetailRes, h3: string, code: string): number;
}

/** A built patch. Its geometry lives on the GPU only; this keeps what restyling needs. */
interface StoredPatch {
    res: DetailRes;
    h3: string[];
    codes: string[];
    lastSeen: number;
}

interface PatchState {
    shown: ShownRes;
    alpha: number;
    prev: ShownRes | null;
    prevAlpha: number;
}

function easeOver(perFrame: number, dt: number): number {
    return 1 - Math.pow(1 - perFrame, dt / (1000 / 60));
}

export class HexLevels {
    private onChange: () => void = () => {};
    private gl: HexGlRenderer | null = null;
    private tier: HexTierData | null = null;
    private projection: MapProjection | null = null;
    /** The base level's cells and border segments per patch, by index. */
    private baseCells = new Map<string, number[]>();
    private baseBorders = new Map<string, number[]>();
    private detail: Partial<Record<DetailRes, HexDetailLookup>> = {};
    /** The patches each level has land in, from the worker. */
    private patchKeys: Partial<Record<DetailRes, Set<string>>> = {};
    private loading = new Set<DetailRes>();
    /** Levels the current worker has been asked to prepare. */
    private prepared = new Set<DetailRes>();
    private failed = new Set<DetailRes>();
    private worker: Worker | null | undefined;
    private store = new Map<string, StoredPatch>();
    private states = new Map<string, PatchState>();
    private styled = new Map<string, number>();
    private visible: string[] = [];
    private visibleAt = -Infinity;
    private visibleView = '';
    private wantSent = '';
    private current: ShownRes = 3;
    private lock: HexSizeLock = null;

    setOnChange(onChange: () => void) {
        this.onChange = onChange;
    }

    /**
     * A new renderer, tier or projection: the GPU holds nothing yet, and
     * patches built in another projection are thrown away.
     */
    reset(gl: HexGlRenderer | null, tier: HexTierData, projection: MapProjection) {
        // The GPU is new, so every built patch has to be built again.
        this.store.clear();
        this.wantSent = '';
        this.worker?.postMessage({ type: 'forget' } satisfies PatchForget);
        this.gl = gl;
        this.tier = tier;
        this.projection = projection;
        this.states.clear();
        this.styled.clear();
        this.visibleAt = -Infinity;
        const grouped = groupBase(tier);
        this.baseCells = grouped.cells;
        this.baseBorders = grouped.borders;
        if (gl) gl.addPatch('base', tierPatchData(tier));
    }

    /** Stops the worker. A later frame that needs one starts it again (a remount, or StrictMode's double mount). */
    dispose() {
        this.worker?.terminate();
        this.worker = undefined;
        this.wantSent = '';
        // A new worker has to be asked to prepare its levels again.
        this.prepared.clear();
        this.patchKeys = {};
    }

    /** Holds one hex size whatever the zoom (see `LOCKED_LEVEL5_MIN_PX`), or follows the zoom again with null. */
    setLock(lock: HexSizeLock) {
        this.lock = lock;
    }

    /** The level the last frame asked for. */
    get shownRes(): ShownRes {
        return this.current;
    }

    level(res: DetailRes): HexDetailLookup | undefined {
        return this.detail[res];
    }

    /** The level shown at a place, in radians: where a pointer there picks from. */
    shownAt(lat: number, lon: number): ShownRes {
        if (this.states.size === 0) return 3;
        const key = latLngToCell((lat * 180) / Math.PI, (lon * 180) / Math.PI, PATCH_RES);
        const state = this.states.get(key);
        if (!state) return 3;
        return state.alpha >= 0.5 || state.prev === null ? state.shown : state.prev;
    }

    private ensureLevel(res: DetailRes) {
        if (this.failed.has(res)) return;
        const worker = this.ensureWorker();
        if (!worker) return;
        // The worker cuts the level into patches; the page keeps only the lookup.
        if (!this.prepared.has(res)) {
            this.prepared.add(res);
            worker.postMessage({ type: 'prepare', res } satisfies LevelPrepare);
        }
        if (this.detail[res] || this.loading.has(res)) return;
        this.loading.add(res);
        loadDetailLookup(res)
            .then((level) => {
                this.detail[res] = level;
                // A patch styled before the lookup came had no cities or selection to light.
                this.styled.clear();
                this.onChange();
            })
            .catch(() => this.failed.add(res))
            .finally(() => this.loading.delete(res));
    }

    private ensureWorker(): Worker | null {
        if (this.worker !== undefined) return this.worker;
        try {
            const worker = new Worker(new URL('./hexPatchWorker.ts', import.meta.url), { type: 'module' });
            worker.onmessage = (event: MessageEvent<PatchBuilt | PatchFailed | LevelReady>) => {
                const message = event.data;
                if (message.type === 'failed') {
                    this.failed.add(message.res);
                    return;
                }
                if (message.type === 'level') {
                    this.patchKeys[message.res] = new Set(message.keys);
                    this.onChange();
                    return;
                }
                if (message.projection !== this.projection?.id) return;
                const key = `${message.res}:${message.key}`;
                if (!this.gl) return;
                this.gl.addPatch(key, message.data);
                this.store.set(key, {
                    res: message.res,
                    h3: message.h3,
                    codes: message.codes,
                    lastSeen: performance.now(),
                });
                this.styled.delete(key);
                this.evict(performance.now());
                this.onChange();
            };
            worker.onerror = () => {
                this.worker?.terminate();
                this.worker = null;
            };
            this.worker = worker;
        } catch {
            this.worker = null;
        }
        return this.worker;
    }

    /** The level to show at this scale, given pixels per radian on the map. */
    private chooseRes(pxPerRad: number): ShownRes {
        const px = (res: ShownRes) => hexSpacingRad(res) * pxPerRad;
        let res: ShownRes = 3;
        if (this.lock !== null) {
            const showFive = px(5) >= (this.current >= 5 ? LOCKED_LEVEL5_HIDE_PX : LOCKED_LEVEL5_MIN_PX);
            res = this.lock === 5 && !showFive ? 4 : this.lock;
        } else {
            if (px(4) >= (this.current >= 4 ? HIDE_PX : SHOW_PX)) res = 4;
            if (px(5) >= (this.current >= 5 ? HIDE_PX : SHOW_PX)) res = 5;
        }
        // Never fetched past a held size: holding 45 km never loads level 5.
        const ceiling = this.lock ?? 5;
        if (ceiling >= 4 && (res >= 4 || px(4) >= PREFETCH_PX)) this.ensureLevel(4);
        if (ceiling >= 5 && (res >= 5 || px(5) >= PREFETCH_PX)) this.ensureLevel(5);
        // Without a worker, or with a level that would not load, stay coarser.
        while (res > 3 && (this.failed.has(res as DetailRes) || this.ensureWorker() === null)) res = (res - 1) as ShownRes;
        this.current = res;
        return res;
    }

    private hasLand(key: string): boolean {
        return this.baseCells.has(key) || !!this.patchKeys[4]?.has(key) || !!this.patchKeys[5]?.has(key);
    }

    /** The patches on screen, nearest the middle first; null mid-morph, when no point stands for a place. */
    private patchesOnScreen(view: GlobeView, pxPerRad: number): string[] | null {
        const projection = this.projection!;
        const step = Math.max(24, Math.min(160, PATCH_SPACING * pxPerRad * 0.5));
        const cx = view.width / 2;
        const cy = view.height / 2;
        const points: [number, number, number][] = [];
        for (let y = step / 2; y < view.height; y += step) {
            for (let x = step / 2; x < view.width; x += step) points.push([x, y, (x - cx) ** 2 + (y - cy) ** 2]);
        }
        points.push([0, 0, Infinity], [view.width, 0, Infinity], [0, view.height, Infinity], [view.width, view.height, Infinity]);
        points.sort((a, b) => a[2] - b[2]);
        const keys = new Set<string>();
        const homes = new Set<string>();
        let any = false;
        for (const [x, y] of points) {
            const place = mapPointAt(view, x, y, projection);
            if (!place) continue;
            any = true;
            const home = latLngToCell((place.lat * 180) / Math.PI, (place.lon * 180) / Math.PI, PATCH_RES);
            // Most points land in a patch another point already found.
            if (homes.has(home)) continue;
            homes.add(home);
            for (const key of gridDisk(home, 1)) {
                if (!keys.has(key) && this.hasLand(key)) keys.add(key);
            }
        }
        if (!any) return view.progress === 0 || view.progress === 1 ? [] : null;
        return [...keys];
    }

    private evict(now: number) {
        for (const res of [4, 5] as DetailRes[]) {
            const mine = [...this.store.entries()].filter(([, p]) => p.res === res);
            let excess = mine.length - CAP[res];
            if (excess <= 0) continue;
            mine.sort((a, b) => a[1].lastSeen - b[1].lastSeen);
            const dropped: string[] = [];
            for (const [key, patch] of mine) {
                // Never one on screen in the last second.
                if (excess <= 0 || now - patch.lastSeen < 1000) break;
                this.drop(key);
                dropped.push(key.slice(key.indexOf(':') + 1));
                excess--;
            }
            this.forget(res, dropped);
        }
    }

    private drop(key: string) {
        this.store.delete(key);
        this.styled.delete(key);
        this.gl?.removePatch(key);
    }

    /** Tells the worker these may be asked for again. */
    private forget(res: DetailRes, keys: string[]) {
        if (keys.length === 0 || !this.worker || !this.projection) return;
        this.worker.postMessage({ type: 'forget', res, projection: this.projection.id, keys } satisfies PatchForget);
        this.wantSent = '';
    }

    /** Clears the worker's queue once no finer level is wanted, so it stops building for nothing. */
    private stopWanting() {
        if (!this.wantSent || !this.worker || !this.projection) return;
        this.worker.postMessage({ type: 'want', res: 4, projection: this.projection.id, keys: [] } satisfies PatchWant);
        this.wantSent = '';
    }

    /**
     * This frame's draws. `fading` is true while any patch is still part-way
     * through a fade, so the caller keeps the loop running.
     */
    frame(
        view: GlobeView,
        dt: number,
        pxPerRad: number,
        styles: LevelStyles,
        reducedMotion = false,
    ): { draws: HexGlDraw[]; fading: boolean } {
        const gl = this.gl;
        if (!gl || !this.tier) return { draws: [], fading: false };
        const want = this.chooseRes(pxPerRad);
        const now = performance.now();
        if (want === 3) this.stopWanting();

        // Mid-morph no point on screen stands for a place, so the patches on
        // screen cannot be worked out: the base in one piece until it lands.
        const morphing = view.progress > 0 && view.progress < 1;
        // Everything on the base level and settled: the base in one piece.
        if (morphing || (want === 3 && [...this.states.values()].every((s) => s.shown === 3 && s.alpha === 1 && s.prevAlpha === 0))) {
            this.states.clear();
            this.restyle('base', styles);
            return { draws: [{ key: 'base', alpha: 1 }], fading: false };
        }

        const viewKey = `${!!this.patchKeys[4]}${!!this.patchKeys[5]}|${view.width}|${view.height}|${view.radius.toFixed(1)}|${view.cosRot.toFixed(4)}|${view.sinRot.toFixed(4)}|${view.sinLat.toFixed(4)}|${view.flatX.toFixed(0)}|${view.flatY.toFixed(0)}|${view.flatW.toFixed(0)}|${view.progress}`;
        if (viewKey !== this.visibleView && now - this.visibleAt >= VISIBLE_EVERY_MS) {
            const onScreen = this.patchesOnScreen(view, pxPerRad);
            if (onScreen) {
                this.visible = onScreen;
                this.visibleView = viewKey;
                this.visibleAt = now;
            }
        }

        const draws: HexGlDraw[] = [];
        const missing: string[] = [];
        // With reduced motion a level lands in one step, as every other ease does.
        const fade = reducedMotion ? 1 : easeOver(FADE_PER_FRAME, dt);
        // A view the patch list has not caught up with keeps the loop running until it does.
        let fading = viewKey !== this.visibleView;
        const onScreen = new Set(this.visible);
        for (const key of this.states.keys()) {
            if (!onScreen.has(key)) this.states.delete(key);
        }

        for (const key of this.visible) {
            let avail: ShownRes = 3;
            for (let res = want; res > 3; res--) {
                const stored = this.store.get(`${res}:${key}`);
                if (!stored) continue;
                if (!gl.hasPatch(`${res}:${key}`)) {
                    // Gone from the GPU: built again when next wanted.
                    this.drop(`${res}:${key}`);
                    this.forget(res as DetailRes, [key]);
                    continue;
                }
                stored.lastSeen = now;
                avail = res as ShownRes;
                break;
            }
            if (want > 3 && avail < want && this.patchKeys[want as DetailRes]?.has(key)) missing.push(key);

            let state = this.states.get(key);
            if (!state) {
                state = { shown: avail, alpha: 1, prev: null, prevAlpha: 0 };
                this.states.set(key, state);
            } else if (state.shown !== avail && state.prev === avail) {
                // Back to the level that was fading out: it fades back in from where it was.
                [state.shown, state.prev] = [avail, state.shown];
                [state.alpha, state.prevAlpha] = [state.prevAlpha, state.alpha];
            } else if (state.shown !== avail) {
                // The level that was most visible fades out; the new one fades in.
                if (state.alpha >= state.prevAlpha || state.prev === null) {
                    state.prev = state.shown;
                    state.prevAlpha = state.alpha;
                }
                state.shown = avail;
                state.alpha = 0;
            }
            state.alpha = Math.min(1, state.alpha + (1 - state.alpha) * fade);
            if (state.alpha > 0.995) state.alpha = 1;
            state.prevAlpha = Math.max(0, state.prevAlpha - state.prevAlpha * fade);
            if (state.prevAlpha < 0.005) {
                state.prevAlpha = 0;
                state.prev = null;
            }
            if (state.alpha < 1 || state.prevAlpha > 0) fading = true;

            if (state.prev !== null) this.drawPatch(draws, key, state.prev, state.prevAlpha, styles);
            this.drawPatch(draws, key, state.shown, state.alpha, styles);
        }

        if (want > 3) {
            const worker = this.ensureWorker();
            const sent = `${want}|${this.projection!.id}|${missing.join(',')}`;
            if (worker && sent !== this.wantSent) {
                this.wantSent = sent;
                worker.postMessage({ type: 'want', res: want as DetailRes, projection: this.projection!.id, keys: missing } satisfies PatchWant);
            }
        }
        return { draws, fading };
    }

    private drawPatch(draws: HexGlDraw[], key: string, res: ShownRes, alpha: number, styles: LevelStyles) {
        if (alpha <= 0) return;
        const gpuKey = `${res}:${key}`;
        if (res === 3) {
            const cells = this.baseCells.get(key);
            if (!cells) return;
            if (!this.gl!.hasPatch(gpuKey)) {
                this.gl!.addPatch(gpuKey, tierPatchData(this.tier!, cells, this.baseBorders.get(key)));
            }
        } else if (!this.gl!.hasPatch(gpuKey)) {
            return;
        }
        this.restyle(gpuKey, styles);
        draws.push({ key: gpuKey, alpha });
    }

    /** Rewrites a patch's style bytes if any style input changed since it last was. */
    private restyle(gpuKey: string, styles: LevelStyles) {
        if (this.styled.get(gpuKey) === styles.version) return;
        let bytes: Uint8Array;
        if (gpuKey === 'base') {
            bytes = styles.base;
        } else if (gpuKey.startsWith('3:')) {
            const cells = this.baseCells.get(gpuKey.slice(2)) ?? [];
            bytes = Uint8Array.from(cells, (i) => styles.base[i]);
        } else {
            const stored = this.store.get(gpuKey);
            if (!stored) return;
            bytes = new Uint8Array(stored.h3.length);
            for (let i = 0; i < bytes.length; i++) bytes[i] = styles.detail(stored.res, stored.h3[i], stored.codes[i]);
        }
        this.gl!.setPatchStyles(gpuKey, bytes);
        this.styled.set(gpuKey, styles.version);
    }
}

const groupedBase = new WeakMap<Map<string, number>, { cells: Map<string, number[]>; borders: Map<string, number[]> }>();

/**
 * The base level's cells and border segments by patch. Every projection of a
 * tier shares its index map, so this is worked out once per tier, not per switch.
 */
function groupBase(tier: HexTierData) {
    const cached = groupedBase.get(tier.cellIndexByH3);
    if (cached) return cached;
    const push = (map: Map<string, number[]>, key: string, i: number) => {
        const list = map.get(key);
        if (list) list.push(i);
        else map.set(key, [i]);
    };
    const cells = new Map<string, number[]>();
    const borders = new Map<string, number[]>();
    tier.cells.forEach((cell, i) => push(cells, cellToParent(cell.h3Index, PATCH_RES), i));
    tier.borderSegments.forEach((seg, i) => push(borders, cellToParent(seg.from, PATCH_RES), i));
    const grouped = { cells, borders };
    groupedBase.set(tier.cellIndexByH3, grouped);
    return grouped;
}
