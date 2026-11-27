import { cellToChildren, cellToLatLng, cellToParent, getResolution, latLngToCell } from 'h3-js';
import type { FlatPoint, MapProjection } from '@/lib/mapProjections';
import { projectToGlobe, type GlobeView } from './globeProjection';
import { PATCH_RES, loadDetailLookup, patchResFor, type DetailRes, type HexDetailLookup } from './hexDetail';
import type { HexGlDraw, HexGlRenderer } from './hexGlRenderer';
import { degToUnit, hexSpacingRad, tierPatchData, type HexTierData, type UnitVector } from './hexMapData';
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

export type ShownRes = 3 | 4 | 5 | 6;

/** A hex size held whatever the zoom, or null to follow the zoom. */
export type HexSizeLock = ShownRes | null;

/** About how far apart each level's cell centres are, for the size control. */
export const HEX_KM: Record<ShownRes, number> = { 3: 120, 4: 45, 5: 17, 6: 6 };

/**
 * Held at 45 km, 17 km or 6 km, the finer levels still wait until their cells
 * are this many pixels across: over the whole world level 4 is ~82,000 cells,
 * level 5 is ~570,000 and level 6 is ~3.9 million, so the coarser level stands
 * in when zoomed out.
 */
export const LOCKED_LEVEL4_MIN_PX = 4.5;
const LOCKED_LEVEL4_HIDE_PX = 3.8;
export const LOCKED_LEVEL5_MIN_PX = 5;
const LOCKED_LEVEL5_HIDE_PX = 4;
export const LOCKED_LEVEL6_MIN_PX = 4.5;
const LOCKED_LEVEL6_HIDE_PX = 3.6;

/** A finer level comes in once its cells are this many pixels across... */
const SHOW_PX = 8;
/** ...and goes once they are under this. */
const HIDE_PX = 6.5;
/** Its file is fetched once its cells reach this, a little before it is needed. */
const PREFETCH_PX = 4;
/** Duration of the synchronized fluid resolution transition, in milliseconds. */
const TRANSITION_MS = 220;
/** At most this many built patches of a level are kept, GPU and all; the longest off screen go first. */
const CAP: Record<DetailRes, number> = { 4: 480, 5: 120, 6: 140 };

interface PatchAnchor {
    key: string;
    unit: UnitVector;
    flat: FlatPoint;
}

export interface LevelStyles {
    /** Changes whenever any style input does. */
    version: number;
    /** The base level's style bytes, by `HexCell.index`. */
    base: Uint8Array;
    /** A detail cell's style byte. */
    detail(res: DetailRes, h3: string): number;
}

/** A built patch. Its geometry lives on the GPU only; this keeps what restyling needs. */
interface StoredPatch {
    res: DetailRes;
    h3: string[];
    lastSeen: number;
}

interface PatchState {
    shown: ShownRes;
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
    private anchors1 = new Map<string, PatchAnchor>();
    private anchors2 = new Map<string, PatchAnchor>();
    private visible: string[] = [];
    private visiblePatchRes = PATCH_RES;
    private visibleView = '';
    private wantSent = '';
    private current: ShownRes = 3;
    private displayed: ShownRes = 3;
    private prevDisplayed: ShownRes | null = null;
    private transition = 1;
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
        this.anchors1.clear();
        this.anchors2.clear();
        this.displayed = 3;
        this.prevDisplayed = null;
        this.transition = 1;
        this.visibleView = '';
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

    /** The level the last frame showed. */
    get shownRes(): ShownRes {
        return this.displayed;
    }

    level(res: DetailRes): HexDetailLookup | undefined {
        return this.detail[res];
    }

    /** The level shown at a place, in radians: where a pointer there picks from. */
    shownAt(lat: number, lon: number): ShownRes {
        if (this.displayed === 3 || this.states.size === 0) return 3;
        const pRes = patchResFor(this.displayed as DetailRes);
        const key = latLngToCell((lat * 180) / Math.PI, (lon * 180) / Math.PI, pRes);
        return this.states.get(key)?.shown ?? this.displayed;
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
            .catch(() => {
                this.failed.add(res);
                this.onChange();
            })
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
                    this.onChange();
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
                this.gl.addPatch(key, message.data, message.res);
                this.store.set(key, {
                    res: message.res,
                    h3: message.h3,
                    lastSeen: performance.now(),
                });
                this.styled.delete(key);
                this.evict(performance.now());
                this.onChange();
            };
            worker.onerror = () => {
                this.worker?.terminate();
                this.worker = null;
                this.wantSent = '';
                this.prepared.clear();
                this.onChange();
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
            const showFour = px(4) >= (this.current >= 4 ? LOCKED_LEVEL4_HIDE_PX : LOCKED_LEVEL4_MIN_PX);
            const showFive = px(5) >= (this.current >= 5 ? LOCKED_LEVEL5_HIDE_PX : LOCKED_LEVEL5_MIN_PX);
            const showSix = px(6) >= (this.current >= 6 ? LOCKED_LEVEL6_HIDE_PX : LOCKED_LEVEL6_MIN_PX);
            if (this.lock === 6) res = showSix ? 6 : showFive ? 5 : showFour ? 4 : 3;
            else if (this.lock === 5) res = showFive ? 5 : showFour ? 4 : 3;
            else if (this.lock === 4) res = showFour ? 4 : 3;
            else res = 3;
        } else {
            if (px(4) >= (this.current >= 4 ? HIDE_PX : SHOW_PX)) res = 4;
            if (px(5) >= (this.current >= 5 ? HIDE_PX : SHOW_PX)) res = 5;
            if (px(6) >= (this.current >= 6 ? HIDE_PX : SHOW_PX)) res = 6;
        }
        // Never fetched past a held size: holding 45 km never loads level 5 or 6.
        const ceiling = this.lock ?? 6;
        if (ceiling >= 4 && (res >= 4 || px(4) >= PREFETCH_PX)) this.ensureLevel(4);
        if (ceiling >= 5 && (res >= 5 || px(5) >= PREFETCH_PX)) this.ensureLevel(5);
        if (ceiling >= 6 && (res >= 6 || px(6) >= PREFETCH_PX)) this.ensureLevel(6);
        // Without a worker, or with a level that would not load, stay coarser.
        while (res > 3 && (this.failed.has(res as DetailRes) || this.ensureWorker() === null)) res = (res - 1) as ShownRes;
        this.current = res;
        return res;
    }

    private hasLand(key: string, patchRes: number): boolean {
        if (patchRes === 2) {
            return this.patchKeys[6] ? this.patchKeys[6].has(key) : this.baseCells.has(cellToParent(key, PATCH_RES));
        }
        return this.baseCells.has(key) || !!this.patchKeys[4]?.has(key) || !!this.patchKeys[5]?.has(key);
    }

    private getAnchor(key: string, patchRes: number): PatchAnchor {
        const cache = patchRes === 2 ? this.anchors2 : this.anchors1;
        let anchor = cache.get(key);
        if (!anchor) {
            const [lat, lon] = cellToLatLng(key);
            const c = degToUnit(lat, lon);
            anchor = { key, unit: c.unit, flat: this.projection!.project(c.lon, c.lat) };
            cache.set(key, anchor);
        }
        return anchor;
    }

    /**
     * All land patches visible in `view`, nearest the middle first, tested by
     * projecting each patch's 3D/2D centre with a full patch-radius horizon
     * and viewport margin so spinning the globe never clips patches at the limb.
     */
    private patchesOnScreen(view: GlobeView, _pxPerRad: number, patchRes: number): string[] | null {
        if (view.progress > 0 && view.progress < 1) return null;
        const res1Set = new Set<string>(this.baseCells.keys());
        for (const k of this.patchKeys[4] ?? []) res1Set.add(k);
        for (const k of this.patchKeys[5] ?? []) res1Set.add(k);

        const cx = view.width / 2;
        const cy = view.height / 2;
        const isGlobe = view.progress >= 0.5;
        const pad1X = isGlobe ? Math.max(140, view.radius * 0.42) : Math.max(140, view.flatW * 0.1);
        const pad1Y = isGlobe ? Math.max(140, view.radius * 0.42) : Math.max(140, view.flatH * 0.14);

        const visible1: [string, number][] = [];
        for (const key of res1Set) {
            const a = this.getAnchor(key, 1);
            let x: number;
            let y: number;
            if (isGlobe) {
                const g = projectToGlobe(view, a.unit);
                if (g.z < -0.38) continue;
                x = g.x;
                y = g.y;
            } else {
                x = view.flatX + a.flat.nx * view.flatW;
                y = view.flatY + a.flat.ny * view.flatH;
            }
            if (x < -pad1X || x > view.width + pad1X || y < -pad1Y || y > view.height + pad1Y) continue;
            visible1.push([key, (x - cx) ** 2 + (y - cy) ** 2]);
        }
        visible1.sort((a, b) => a[1] - b[1]);
        if (patchRes === 1) return visible1.map(([k]) => k);

        const pad2X = isGlobe ? Math.max(90, view.radius * 0.18) : Math.max(90, view.flatW * 0.045);
        const pad2Y = isGlobe ? Math.max(90, view.radius * 0.18) : Math.max(90, view.flatH * 0.065);
        const visible2: [string, number][] = [];
        for (const [parentKey] of visible1) {
            for (const childKey of cellToChildren(parentKey, 2)) {
                if (!this.hasLand(childKey, 2)) continue;
                const a = this.getAnchor(childKey, 2);
                let x: number;
                let y: number;
                if (isGlobe) {
                    const g = projectToGlobe(view, a.unit);
                    if (g.z < -0.22) continue;
                    x = g.x;
                    y = g.y;
                } else {
                    x = view.flatX + a.flat.nx * view.flatW;
                    y = view.flatY + a.flat.ny * view.flatH;
                }
                if (x < -pad2X || x > view.width + pad2X || y < -pad2Y || y > view.height + pad2Y) continue;
                visible2.push([childKey, (x - cx) ** 2 + (y - cy) ** 2]);
            }
        }
        visible2.sort((a, b) => a[1] - b[1]);
        return visible2.map(([k]) => k);
    }

    private evict(now: number) {
        const active = new Set([...this.visible, ...this.states.keys()]);
        for (const res of [4, 5, 6] as DetailRes[]) {
            const mine = [...this.store.entries()].filter(([, p]) => p.res === res);
            let excess = mine.length - CAP[res];
            if (excess <= 0) continue;
            mine.sort((a, b) => a[1].lastSeen - b[1].lastSeen);
            const dropped: string[] = [];
            for (const [key, patch] of mine) {
                const patchKey = key.slice(key.indexOf(':') + 1);
                // Never evict an on-screen patch or one seen in the last second.
                if (excess <= 0) break;
                if (active.has(patchKey) || now - patch.lastSeen < 1000) continue;
                this.drop(key);
                dropped.push(patchKey);
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
     * This frame's draws. Zooming in waits until the visible patches of the
     * finer resolution are built on the GPU, then runs one synchronized
     * viewport-wide fluid transition (`transition`: 0 -> 1 over 220 ms) where
     * only the active resolution's borders and `u_base` land footprint are
     * drawn while the hex cells smoothly cross-fade and bloom into place.
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

        const startTransition = (next: ShownRes) => {
            if (next === this.displayed) return;
            if (reducedMotion) {
                this.displayed = next;
                this.prevDisplayed = null;
                this.transition = 1;
            } else {
                this.prevDisplayed = this.displayed;
                this.displayed = next;
                this.transition = 0;
            }
        };

        // Mid-morph no point on screen stands for a place, so the patches on
        // screen cannot be worked out: the base in one piece until it lands.
        const morphing = view.progress > 0 && view.progress < 1;
        if (morphing) {
            this.states.clear();
            this.displayed = 3;
            this.prevDisplayed = null;
            this.transition = 1;
            this.restyle('base', styles);
            return { draws: [{ key: 'base', alpha: 1 }], fading: false };
        }

        if (want === 3) {
            startTransition(3);
            if (this.transition < 1) {
                this.transition = Math.min(1, this.transition + dt / TRANSITION_MS);
            }
            if (this.transition >= 1 || this.prevDisplayed === null || this.prevDisplayed === 3) {
                this.states.clear();
                this.prevDisplayed = null;
                this.transition = 1;
                this.restyle('base', styles);
                return { draws: [{ key: 'base', alpha: 1 }], fading: false };
            }
        }

        const activeDetailRes = (want > 3 ? want : (this.prevDisplayed && this.prevDisplayed > 3 ? this.prevDisplayed : this.displayed)) as DetailRes;
        const targetPatchRes = activeDetailRes >= 6 ? 2 : 1;
        const viewKey = `${targetPatchRes}|${!!this.patchKeys[4]}${!!this.patchKeys[5]}${!!this.patchKeys[6]}|${view.width}|${view.height}|${view.radius.toFixed(1)}|${view.cosRot.toFixed(4)}|${view.sinRot.toFixed(4)}|${view.sinLat.toFixed(4)}|${view.flatX.toFixed(0)}|${view.flatY.toFixed(0)}|${view.flatW.toFixed(0)}|${view.progress}`;
        if (viewKey !== this.visibleView) {
            const onScreen = this.patchesOnScreen(view, pxPerRad, targetPatchRes);
            if (onScreen) {
                this.visible = onScreen;
                this.visiblePatchRes = targetPatchRes;
                this.visibleView = viewKey;
            }
        }

        const missing: string[] = [];
        if (want > 3) {
            const wantKeys = targetPatchRes === 2 && want < 6
                ? [...new Set(this.visible.map((k) => cellToParent(k, 1)))]
                : this.visible;
            for (const key of wantKeys) {
                const gpuKey = `${want}:${key}`;
                const stored = this.store.get(gpuKey);
                if (stored && !gl.hasPatch(gpuKey)) {
                    this.drop(gpuKey);
                    this.forget(want as DetailRes, [key]);
                }
                if (this.patchKeys[want as DetailRes]?.has(key) && !this.store.has(gpuKey)) {
                    missing.push(key);
                }
            }
        }

        if (missing.length > 0) {
            const worker = this.ensureWorker();
            const sent = `${want}|${this.projection!.id}|${missing.join(',')}`;
            if (worker && sent !== this.wantSent) {
                this.wantSent = sent;
                worker.postMessage({ type: 'want', res: want as DetailRes, projection: this.projection!.id, keys: missing } satisfies PatchWant);
            }
        }

        const wantReady = want === 3 || (!!this.patchKeys[want as DetailRes] && missing.length === 0);
        if (want < this.displayed || wantReady) {
            startTransition(want);
        }

        if (this.transition < 1) {
            this.transition = Math.min(1, this.transition + dt / TRANSITION_MS);
            if (this.transition >= 1) this.prevDisplayed = null;
        }

        const ceiling = this.displayed;
        const eased = 1 - Math.pow(1 - this.transition, 3);
        const transitioning = this.transition < 1 && this.prevDisplayed !== null && this.prevDisplayed !== ceiling;

        if (ceiling === 3 && !transitioning) {
            this.states.clear();
            this.restyle('base', styles);
            return { draws: [{ key: 'base', alpha: 1 }], fading: viewKey !== this.visibleView };
        }

        const draws: HexGlDraw[] = [];
        const onScreen = new Set(this.visible);
        for (const key of this.states.keys()) {
            if (!onScreen.has(key)) this.states.delete(key);
        }

        const appendLevelDraws = (res: ShownRes, cellAlpha: number, backdropAlpha: number, morph: number, recordState: boolean) => {
            if (res === 3) {
                this.restyle('base', styles);
                draws.push({ key: 'base', alpha: cellAlpha, backdropAlpha, morph });
                return;
            }
            const resPatchRes = patchResFor(res as DetailRes);
            const keysForRes = this.visiblePatchRes > resPatchRes
                ? [...new Set(this.visible.map((k) => cellToParent(k, resPatchRes)))]
                : this.visiblePatchRes < resPatchRes
                    ? this.visible.flatMap((k) => cellToChildren(k, resPatchRes))
                    : this.visible;
            for (const key of keysForRes) {
                let avail: ShownRes = 3;
                for (let r = res; r > 3; r--) {
                    const pRes = patchResFor(r as DetailRes);
                    const checkKey = getResolution(key) > pRes ? cellToParent(key, pRes) : key;
                    // If level `r`'s patch index is loaded and `checkKey` has no land at `r`,
                    // this sub-patch is pure sea at `r` — never fall back to a coarser parent
                    // patch whose borders and cells overlap sibling sub-patches of `r`.
                    if (this.patchKeys[r as DetailRes] && !this.patchKeys[r as DetailRes]!.has(checkKey)) {
                        avail = r as ShownRes;
                        break;
                    }
                    const stored = this.store.get(`${r}:${checkKey}`);
                    if (!stored) continue;
                    if (!gl.hasPatch(`${r}:${checkKey}`)) {
                        this.drop(`${r}:${checkKey}`);
                        this.forget(r as DetailRes, [checkKey]);
                        continue;
                    }
                    stored.lastSeen = now;
                    avail = r as ShownRes;
                    break;
                }
                const availPatchRes = avail === 3 ? PATCH_RES : patchResFor(avail as DetailRes);
                const drawKey = getResolution(key) > availPatchRes ? cellToParent(key, availPatchRes) : key;
                if (avail > 3 && this.patchKeys[avail as DetailRes] && !this.patchKeys[avail as DetailRes]!.has(drawKey)) {
                    continue;
                }
                if (recordState) this.states.set(key, { shown: avail });
                const effectiveBackdrop = avail === res ? backdropAlpha : 0;
                this.drawPatch(draws, drawKey, avail, cellAlpha, styles, effectiveBackdrop, morph);
            }
        };

        const dedupedDraws: HexGlDraw[] = [];
        const pushDeduped = () => {
            const seen = new Set<string>();
            for (const d of draws) {
                const id = `${d.key}|${d.backdropAlpha ?? d.alpha}`;
                if (seen.has(id)) continue;
                seen.add(id);
                dedupedDraws.push(d);
            }
            draws.length = 0;
        };

        if (transitioning && this.prevDisplayed !== null) {
            const finer = ceiling > this.prevDisplayed;
            const prevMorph = finer ? 1 + 0.04 * eased : 1 - 0.06 * eased;
            const nextMorph = finer ? 0.86 + 0.14 * eased : 1.06 - 0.06 * eased;
            // Incoming resolution owns the border and u_base land footprint (backdropAlpha = 1)
            // so coastlines never double up, while outgoing and incoming hex cells cross-fade and morph.
            appendLevelDraws(this.prevDisplayed, 1 - eased, 0, prevMorph, false);
            pushDeduped();
            appendLevelDraws(ceiling, eased, 1, nextMorph, true);
            pushDeduped();
        } else {
            appendLevelDraws(ceiling, 1, 1, 1, true);
            pushDeduped();
        }

        return { draws: dedupedDraws, fading: transitioning || viewKey !== this.visibleView };
    }

    private drawPatch(draws: HexGlDraw[], key: string, res: ShownRes, alpha: number, styles: LevelStyles, backdropAlpha = alpha, morph = 1) {
        if (alpha <= 0 && backdropAlpha <= 0) return;
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
        draws.push({ key: gpuKey, alpha, backdropAlpha, morph });
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
            for (let i = 0; i < bytes.length; i++) bytes[i] = styles.detail(stored.res, stored.h3[i]);
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
