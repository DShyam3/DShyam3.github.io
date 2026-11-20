import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { Globe, Map as MapIcon } from 'lucide-react';
import { useTheme } from 'next-themes';
import { latLngToCell } from 'h3-js';
import {
    EQUAL_EARTH_ASPECT,
    EQUAL_EARTH_LABEL,
    EQUAL_EARTH_NOTE,
    projectEqualEarth,
} from '@/lib/equalEarth';
import {
    BUCKET_COLS,
    BUCKET_ROWS,
    buildCityHexSet,
    getRegionHoverLabel,
    hexAtPoint,
    hexSpacingRad,
    loadHexTier,
    resolveCityHex,
    type HexCell,
    type HexTierData,
} from './hexMapData';
import { mapPointAt, projectToGlobe, type GlobeView } from './globeProjection';
import { createHexGlRenderer, type HexGlPalette, type HexGlRenderer } from './hexGlRenderer';

import './DotMatrixGlobe.css';

export interface CountryRegion {
    code: string;
}

interface DotMatrixGlobeProps {
    visitedCountryCodes: string[];
    visitedCityDots?: Set<string>;       // legacy set of "col,row" keys
    visitedCities?: { lat: number; lon: number; countryCode: string }[];
    viewMode?: 'countries' | 'cities';   // which highlighting layer to use
    size?: number;
    className?: string;
    onCountryHover?: (code: string | null, name: string | null, flagUrl: string | null, dotKey?: string | null) => void;
    onCountryClick?: (code: string, name: string) => void;
    focusedCountryCode?: string | null;
    focusTrigger?: number;
    /** A city to turn to and mark, in degrees. `dotKey` names its dot where the caller knows it. */
    focusedCity?: { lat: number; lon: number; countryCode: string; dotKey?: string } | null;
    /** Where to turn, in degrees, for a selected country too small to have dots of its own. */
    focusedCountryPoint?: { lat: number; lon: number } | null;
}

/** The selected cell, placed for this frame, for the glow drawn over the map. */
interface SelectedHex {
    x: number;
    y: number;
    radius: number;
    opacity: number;
    vertsX: number[];
    vertsY: number[];
}

/**
 * After this long untouched, with nothing selected, the globe turns on its own
 * again -- easing up to speed over the ramp rather than lurching off.
 */
const IDLE_SPIN_DELAY_MS = 12000;
const IDLE_SPIN_RAMP_MS = 4000;

/** How close each kind of selection is brought in. */
const FOCUS_ZOOM = { country: { '3d': 2.5, '2d': 4 }, city: { '3d': 3.5, '2d': 6 } } as const;

/**
 * A dot with no country of its own on the grid (open sea round a small
 * island), drawn for a selection there, is the size of a visited dot.
 */
const MARKER_EMPHASIS = 1.2;

/**
 * Border strength at the whole-world view, and the most it reaches zoomed in.
 * At 0.15 the borders all but vanished under the dots until you zoomed in.
 */
const BORDER_ALPHA = 0.3;
const BORDER_ALPHA_ZOOMED = 0.6;

/**
 * How near, in CSS pixels, the pointer has to come to a land cell to pick it
 * when it is over the sea. Res-3 cells are two or three pixels across on the
 * whole globe, so a small island would otherwise be all but impossible to hit.
 */
const HIT_SLOP_PX = 8;

/** The globe's per-cell depth shading, in this many steps, for the canvas 2D path. */
const OPACITY_STEPS = 7;

/**
 * Dot colours, one set per theme. Visited has to read at a glance against not
 * visited, so the two differ in hue, strength and size, never by alpha alone:
 * a faint gold over a faint grey was indistinguishable in either theme. Light
 * uses a deeper amber, because the dark theme's gold washes out on cream.
 */
const DOT_PALETTE = {
    dark: {
        unvisited: 'rgba(237, 227, 207, 0.2)',
        unvisitedHovered: 'rgba(237, 227, 207, 0.58)',
        visited: 'rgba(196, 155, 80, 1)',
        visitedHovered: 'rgba(222, 184, 108, 1)',
        // Cities view: the country is still marked, so its cities stand out of
        // a tinted patch rather than out of the same grey as everywhere else.
        visitedTint: 'rgba(196, 155, 80, 0.36)',
        city: 'rgba(216, 134, 48, 1)',
        // The selection is the one dot in a different hue, matte Indicolite,
        // so it never reads as one more antique brass dot.
        selected: 'rgba(46, 166, 178, 1)',
        selectedGlow: 'rgba(46, 166, 178, 0.5)',
    },
    light: {
        unvisited: 'rgba(31, 25, 36, 0.18)',
        unvisitedHovered: 'rgba(31, 25, 36, 0.58)',
        visited: 'rgba(150, 112, 45, 1)',
        visitedHovered: 'rgba(122, 88, 28, 1)',
        visitedTint: 'rgba(150, 112, 45, 0.34)',
        city: 'rgba(179, 98, 18, 1)',
        selected: 'rgba(15, 100, 109, 1)',
        selectedGlow: 'rgba(15, 100, 109, 0.38)',
    },
} as const;

type DotPalette = Record<keyof typeof DOT_PALETTE.dark, string>;

/**
 * Every look a cell can have, one byte per cell, in one table: its colour and
 * how far its hex reaches towards its corners. Both renderers read the same
 * bytes, so WebGL and canvas 2D cannot disagree about what a visited, hovered
 * or selected cell looks like.
 */
const CELL_STYLES = [
    { name: 'unvisited', scale: 0.84, color: 'unvisited' },
    { name: 'unvisitedHovered', scale: 0.9, color: 'unvisitedHovered' },
    { name: 'visited', scale: 0.9, color: 'visited' },
    { name: 'visitedHovered', scale: 0.94, color: 'visitedHovered' },
    // Cities view: a visited country is a tint, and hovering it lights the full colour.
    { name: 'tint', scale: 0.84, color: 'visitedTint' },
    { name: 'tintHovered', scale: 0.94, color: 'visited' },
    { name: 'city', scale: 0.92, color: 'city' },
    { name: 'cityHovered', scale: 0.96, color: 'visitedHovered' },
    { name: 'selected', scale: 0.92, color: 'selected' },
] as const satisfies readonly { name: string; scale: number; color: keyof DotPalette }[];

const CELL_STYLE = Object.fromEntries(CELL_STYLES.map((style, i) => [style.name, i])) as Record<(typeof CELL_STYLES)[number]['name'], number>;
const STYLE_SCALES = CELL_STYLES.map((style) => style.scale);
const styleColors = (p: DotPalette): string[] => CELL_STYLES.map((style) => p[style.color]);

const STYLE_CSS = { dark: styleColors(DOT_PALETTE.dark), light: styleColors(DOT_PALETTE.light) };

function parseRgba(css: string): number[] {
    const [r, g, b, a] = css.slice(css.indexOf('(') + 1, css.indexOf(')')).split(',').map((part) => Number(part.trim()));
    return [r / 255, g / 255, b / 255, a ?? 1];
}

const glPalette = (colors: string[]): HexGlPalette => ({
    colors: new Float32Array(colors.flatMap(parseRgba)),
    scales: new Float32Array(STYLE_SCALES),
});

const STYLE_GL = { dark: glPalette(STYLE_CSS.dark), light: glPalette(STYLE_CSS.light) };

interface StyleInputs {
    visited: Set<string>;
    cityHexes: Set<string>;
    cityDots?: Set<string>;
    cities: boolean;
    hovered: string | null;
    selected: string | null;
    focusedDot: string | null;
}

/** Writes each cell's `CELL_STYLE` into `out`, by `HexCell.index`. */
function fillCellStyles(out: Uint8Array, tier: HexTierData, s: StyleInputs) {
    for (const cell of tier.cells) {
        const hovered = cell.code === s.hovered;
        let style: number;
        if (cell.h3Index === s.selected) {
            style = CELL_STYLE.selected;
        } else if (s.cities && (s.cityHexes.has(cell.h3Index) || (s.cityDots?.has(cell.h3Index) ?? false) || cell.h3Index === s.focusedDot)) {
            style = hovered ? CELL_STYLE.cityHovered : CELL_STYLE.city;
        } else if (s.visited.has(cell.code)) {
            style = s.cities
                ? (hovered ? CELL_STYLE.tintHovered : CELL_STYLE.tint)
                : (hovered ? CELL_STYLE.visitedHovered : CELL_STYLE.visited);
        } else {
            style = hovered ? CELL_STYLE.unvisitedHovered : CELL_STYLE.unvisited;
        }
        out[cell.index] = style;
    }
}

/** Where the selected cell sits this frame, or null where it is hidden (the back of the globe). */
function placeSelectedHex(cell: HexCell, view: GlobeView, radius: number): SelectedHex | null {
    const { progress } = view;
    if (cell.crossesAntimeridian && progress < 0.5) return null;
    const centre = projectToGlobe(view, cell.center3d);
    if (centre.z < 0 && progress > 0.5) return null;

    const flatX = cell.center2d.nx * view.flatW + view.flatX;
    const flatY = cell.center2d.ny * view.flatH + view.flatY;
    const vertsX: number[] = [];
    const vertsY: number[] = [];
    for (let i = 0; i < cell.verts3d.length; i++) {
        const onGlobe = projectToGlobe(view, cell.verts3d[i]);
        const vx = cell.verts2d[i].nx * view.flatW + view.flatX;
        const vy = cell.verts2d[i].ny * view.flatH + view.flatY;
        vertsX.push(vx + (onGlobe.x - vx) * progress);
        vertsY.push(vy + (onGlobe.y - vy) * progress);
    }
    return {
        x: flatX + (centre.x - flatX) * progress,
        y: flatY + (centre.y - flatY) * progress,
        radius,
        opacity: (1 - progress) + Math.max(0.1, 0.45 + 0.55 * centre.z) * progress,
        vertsX,
        vertsY,
    };
}

interface CanvasBorders {
    color: string;
    alpha: number;
    width: number;
}

/**
 * The canvas 2D renderer, for a browser without WebGL2 or a GPU that dropped
 * the context. It builds its path point by point every frame -- the cost that
 * made the globe slow -- so it is the fallback, not the default.
 */
function drawCellsCanvas(
    ctx: CanvasRenderingContext2D,
    tier: HexTierData,
    styles: Uint8Array,
    colors: string[],
    view: GlobeView,
    borders: CanvasBorders,
) {
    const { width: W, height: H, progress, radius: R, cosRot, sinRot, cosLat, sinLat, flatW, flatH, flatX, flatY } = view;
    const W_half = W / 2;
    const H_half = H / 2;
    const margin = 80;

    // --- Flat map: spatial-bucket viewport culling, one path per style ---
    if (progress === 0) {
        const nxMin = (-margin - flatX) / flatW;
        const nxMax = (W + margin - flatX) / flatW;
        const nyMin = (-margin - flatY) / flatH;
        const nyMax = (H + margin - flatY) / flatH;
        const bxMin = Math.max(0, Math.min(BUCKET_COLS - 1, Math.floor(nxMin * BUCKET_COLS) - 1));
        const bxMax = Math.max(0, Math.min(BUCKET_COLS - 1, Math.floor(nxMax * BUCKET_COLS) + 1));
        const byMin = Math.max(0, Math.min(BUCKET_ROWS - 1, Math.floor(nyMin * BUCKET_ROWS) - 1));
        const byMax = Math.max(0, Math.min(BUCKET_ROWS - 1, Math.floor(nyMax * BUCKET_ROWS) + 1));

        if (borders.alpha > 0.015) {
            ctx.globalAlpha = borders.alpha;
            ctx.beginPath();
            for (let by = byMin; by <= byMax; by++) {
                for (let bx = bxMin; bx <= bxMax; bx++) {
                    for (const seg of tier.borderBuckets[by * BUCKET_COLS + bx]) {
                        const x1 = seg.fx1 * flatW + flatX;
                        const y1 = seg.fy1 * flatH + flatY;
                        const x2 = seg.fx2 * flatW + flatX;
                        const y2 = seg.fy2 * flatH + flatY;
                        if (
                            (x1 < -margin && x2 < -margin) ||
                            (x1 > W + margin && x2 > W + margin) ||
                            (y1 < -margin && y2 < -margin) ||
                            (y1 > H + margin && y2 > H + margin)
                        ) {
                            continue;
                        }
                        ctx.moveTo(x1, y1);
                        ctx.lineTo(x2, y2);
                    }
                }
            }
            ctx.strokeStyle = borders.color;
            ctx.lineWidth = borders.width;
            ctx.stroke();
        }

        const paths: (Path2D | null)[] = new Array(CELL_STYLES.length).fill(null);
        for (let by = byMin; by <= byMax; by++) {
            for (let bx = bxMin; bx <= bxMax; bx++) {
                for (const cell of tier.cellBuckets[by * BUCKET_COLS + bx]) {
                    const cx = cell.center2d.nx * flatW + flatX;
                    const cy = cell.center2d.ny * flatH + flatY;
                    if (cx < -margin || cx > W + margin || cy < -margin || cy > H + margin) continue;
                    const style = styles[cell.index];
                    const scale = STYLE_SCALES[style];
                    const path = (paths[style] ??= new Path2D());
                    const v2 = cell.verts2d;
                    for (let i = 0; i < v2.length; i++) {
                        const px = cx + (v2[i].nx * flatW + flatX - cx) * scale;
                        const py = cy + (v2[i].ny * flatH + flatY - cy) * scale;
                        if (i === 0) path.moveTo(px, py);
                        else path.lineTo(px, py);
                    }
                    path.closePath();
                }
            }
        }
        ctx.globalAlpha = 1;
        paths.forEach((path, style) => {
            if (!path) return;
            ctx.fillStyle = colors[style];
            ctx.fill(path);
        });
        return;
    }

    // --- Globe and morph: every cell turned, then mixed with its flat place ---
    if (borders.alpha > 0.015) {
        ctx.globalAlpha = borders.alpha;
        ctx.beginPath();
        for (const seg of tier.borderSegments) {
            if (progress < 0.5 && seg.crossesAntimeridian) continue;
            const a = projectToGlobe(view, seg.p1);
            const b = projectToGlobe(view, seg.p2);
            if (progress > 0.5 && a.z < 0 && b.z < 0) continue;
            let x1 = a.x;
            let y1 = a.y;
            let x2 = b.x;
            let y2 = b.y;
            if (progress < 1) {
                const fx1 = seg.fx1 * flatW + flatX;
                const fy1 = seg.fy1 * flatH + flatY;
                const fx2 = seg.fx2 * flatW + flatX;
                const fy2 = seg.fy2 * flatH + flatY;
                x1 = fx1 + (x1 - fx1) * progress;
                y1 = fy1 + (y1 - fy1) * progress;
                x2 = fx2 + (x2 - fx2) * progress;
                y2 = fy2 + (y2 - fy2) * progress;
            }
            if (
                (x1 < -margin && x2 < -margin) ||
                (x1 > W + margin && x2 > W + margin) ||
                (y1 < -margin && y2 < -margin) ||
                (y1 > H + margin && y2 > H + margin)
            ) {
                continue;
            }
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
        }
        ctx.strokeStyle = borders.color;
        ctx.lineWidth = borders.width;
        ctx.stroke();
        ctx.globalAlpha = 1;
    }

    const batches: (Path2D | null)[] = new Array(CELL_STYLES.length * OPACITY_STEPS).fill(null);
    for (const cell of tier.cells) {
        if (progress < 0.5 && cell.crossesAntimeridian) continue;
        const c3 = cell.center3d;
        const cx3 = R * c3.ux;
        const cy3 = R * c3.uy;
        const cz3 = R * c3.uz;
        const cxr = cx3 * cosRot - cz3 * sinRot;
        const czr = cx3 * sinRot + cz3 * cosRot;
        const cyt = cy3 * cosLat - czr * sinLat;
        const czt = cy3 * sinLat + czr * cosLat;
        if (czt < 0 && progress > 0.85) continue;

        let cx = W_half + cxr;
        let cy = H_half + cyt;
        if (progress < 1) {
            const cx2d = cell.center2d.nx * flatW + flatX;
            const cy2d = cell.center2d.ny * flatH + flatY;
            cx = cx2d + (cx - cx2d) * progress;
            cy = cy2d + (cy - cy2d) * progress;
        }
        if (cx < -margin || cx > W + margin || cy < -margin || cy > H + margin) continue;

        const opacity = (1 - progress) + Math.max(0.1, 0.45 + 0.55 * (czt / R)) * progress;
        const step = Math.max(0, Math.min(OPACITY_STEPS - 1, Math.round(opacity * (OPACITY_STEPS - 1))));
        const style = styles[cell.index];
        const scale = STYLE_SCALES[style];
        const path = (batches[style * OPACITY_STEPS + step] ??= new Path2D());

        const v3 = cell.verts3d;
        const v2 = cell.verts2d;
        for (let i = 0; i < v3.length; i++) {
            const u = v3[i];
            const vx3 = R * u.ux;
            const vy3 = R * u.uy;
            const vz3 = R * u.uz;
            const vxr = vx3 * cosRot - vz3 * sinRot;
            const vzr = vx3 * sinRot + vz3 * cosRot;
            const vyt = vy3 * cosLat - vzr * sinLat;
            let vx = W_half + vxr;
            let vy = H_half + vyt;
            if (progress < 1) {
                const vx2 = v2[i].nx * flatW + flatX;
                const vy2 = v2[i].ny * flatH + flatY;
                vx = vx2 + (vx - vx2) * progress;
                vy = vy2 + (vy - vy2) * progress;
            }
            const px = cx + (vx - cx) * scale;
            const py = cy + (vy - cy) * scale;
            if (i === 0) path.moveTo(px, py);
            else path.lineTo(px, py);
        }
        path.closePath();
    }

    batches.forEach((path, key) => {
        if (!path) return;
        const alpha = (key % OPACITY_STEPS) / (OPACITY_STEPS - 1);
        if (alpha <= 0.01) return;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = colors[Math.floor(key / OPACITY_STEPS)];
        ctx.fill(path);
    });
    ctx.globalAlpha = 1;
}

// Country name lookup - loaded from REST Countries API
let cachedCountryNames: Record<string, string> = {};
let countryNamesPromise: Promise<Record<string, string>> | null = null;

async function loadCountryNames(): Promise<Record<string, string>> {
    if (Object.keys(cachedCountryNames).length > 0) return cachedCountryNames;
    if (!countryNamesPromise) {
        countryNamesPromise = (async () => {
            try {
                const res = await fetch('/countries.json');
                const data = await res.json();
                const names: Record<string, string> = {};
                for (const c of data) {
                    names[c.cca2] = c.name.common;
                }
                cachedCountryNames = names;
            } catch {
                // fallback: empty, codes will be shown instead
            }
            return cachedCountryNames;
        })();
    }
    return countryNamesPromise;
}

/** Prefetches base H3 hex map + country names in the background so Travel paints on frame 1. */
export function warmGlobeData(): void {
    void Promise.all([loadHexTier(3), loadCountryNames()]).catch(() => {});
}

/**
 * How far past its own edge the flat map may be pulled, in CSS pixels. The
 * excess is never a resting place: `settlePan` gives it back on release.
 */
const PAN_OVERSCROLL = 90;

/** Past the edge a drag moves a third as far, so the pull reads as elastic. */
function rubberDelta(pan: number, delta: number, limit: number): number {
    const pullingFurtherOut = Math.abs(pan) > limit && Math.sign(pan) === Math.sign(delta);
    return pullingFurtherOut ? delta * 0.35 : delta;
}

interface FocusTargets {
    targetRotation: number | null;
    targetOffsetLat: number | null;
    targetPanXNorm: number | null;
    targetPanYNorm: number | null;
}

/** Let go of a selection's resting place: the user has taken the map. */
function releaseTargets(drag: FocusTargets) {
    drag.targetRotation = null;
    drag.targetOffsetLat = null;
    drag.targetPanXNorm = null;
    drag.targetPanYNorm = null;
}

/**
 * Past this many pixels from where it went down, a press is a drag. Below it,
 * a click or tap leaves the selection where it is (the same threshold the
 * click handler uses to tell the two apart).
 */
const DRAG_THRESHOLD = 5;

function movedPastThreshold(drag: { startX: number; startY: number }, x: number, y: number) {
    return Math.hypot(x - drag.startX, y - drag.startY) > DRAG_THRESHOLD;
}

/** One frame of spring-back towards the allowed range; a no-op inside it. */
function settlePan(pan: number, limit: number): number {
    const inRange = Math.max(-limit, Math.min(limit, pan));
    const excess = pan - inRange;
    return Math.abs(excess) < 0.5 ? inRange : inRange + excess * 0.82;
}

const NO_HIT = { code: null as string | null, dotKey: null as string | null };

export function DotMatrixGlobe({
    visitedCountryCodes,
    visitedCityDots,
    visitedCities,
    viewMode = 'countries',
    size = 800,
    className = '',
    onCountryHover,
    onCountryClick,
    focusedCountryCode,
    focusTrigger,
    focusedCity,
    focusedCountryPoint,
}: DotMatrixGlobeProps) {
    const focusLat = focusedCity?.lat;
    const focusLon = focusedCity?.lon;
    const focusCityCountry = focusedCity?.countryCode;
    const countryPointLat = focusedCountryPoint?.lat;
    const countryPointLon = focusedCountryPoint?.lon;
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const glCanvasRef = useRef<HTMLCanvasElement>(null);
    const glRef = useRef<HexGlRenderer | null>(null);
    const [baseTier, setBaseTier] = useState<HexTierData | null>(null);
    const activeTier = baseTier;
    const { resolvedTheme } = useTheme();
    const [mapError, setMapError] = useState(false);
    const [countryNames, setCountryNames] = useState<Record<string, string>>(() => cachedCountryNames);
    const visitedSet = useMemo(() => new Set(visitedCountryCodes), [visitedCountryCodes]);
    const [mode, setMode] = useState<'2d' | '3d'>('3d');
    // Read per frame rather than as state: it changes how far each easing step
    // goes, not what is drawn, so it never needs a render of its own.
    const reducedMotionRef = useRef(typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

    // Hover lives in refs, not state. As state it re-rendered this component
    // on every country the pointer crossed, which rebuilt `draw` and with it
    // every listener below; now a hover only rewrites the cell styles.
    const hoveredCountryRef = useRef<string | null>(null);
    const lastHoverRef = useRef('');
    // One byte per cell (see CELL_STYLE), rebuilt only when what it depends on changes.
    const stylesRef = useRef(new Uint8Array(0));
    const stylesDirtyRef = useRef(true);
    // The last frame's view, so a pointer can be worked back to a place.
    const viewRef = useRef<GlobeView | null>(null);
    // Off screen, the loop sleeps rather than drawing what nobody can see.
    const visibleRef = useRef(true);
    const spinTimerRef = useRef<number>();

    // Drag to rotate state
    const dragRef = useRef({
        isDragging: false,
        /**
         * What a one-finger touch turned out to be. At rest the canvas lets the
         * page scroll vertically (touch-action: pan-y), so a mostly vertical
         * swipe is the page's and a sideways one is the map's; which, is only
         * known once the finger has moved.
         */
        touchGesture: 'idle' as 'idle' | 'undecided' | 'drag' | 'scroll',
        startX: 0,
        startY: 0,
        lastX: 0,
        lastY: 0,
        velocityX: 0,
        offsetLat: 0, // up/down rotation offset for manual drag
        lastInteractionTime: 0,
        panX: 0,
        panY: 0,
        zoom: 1,
        targetZoom: 1,
        pinchDist: 0,
        // Cursor position for cursor-centered zooming (relative to canvas center)
        zoomCursorX: 0,
        zoomCursorY: 0,
        hoveredDotKey: null as string | null,
        targetRotation: null as number | null,
        targetOffsetLat: null as number | null,
        targetPanXNorm: null as number | null,
        targetPanYNorm: null as number | null,
        // True while a country or city is selected: the globe stays on it
        // rather than drifting off on the idle spin.
        holding: false,
        // The fitted map width last frame. Pan is held in pixels, so a resize
        // has to scale it or the view slides off what it was showing.
        lastMapW: 0,
        // Pan limits for the current zoom, written each frame by `draw` so the
        // pointer handlers can apply edge resistance without recomputing them.
        boundX: 0,
        boundY: 0,
    });
    const animRef = useRef({
        progress: 0,
        rotation: 0,
        // The last frame's time, or -1 while the loop sleeps: a frame after a
        // nap must not count the nap as one long step.
        lastTime: -1,
    });
    const requestRef = useRef<number>();

    // `draw` is declared further down the component, so it cannot go in the
    // dependency array of the effects above it without a TDZ error. This ref
    // hands them the current version without re-running them every time draw
    // is rebuilt.
    const drawRef = useRef<(time: number) => void>(() => {});

    /**
     * Asks for one frame. The loop runs only while something moves -- a drag,
     * momentum, an ease, the morph, the idle spin -- and each frame asks for
     * the next only if it still is. At rest the globe costs nothing.
     */
    const requestDraw = useCallback(() => {
        if (requestRef.current !== undefined) return;
        requestRef.current = requestAnimationFrame((t) => {
            requestRef.current = undefined;
            drawRef.current(t);
        });
    }, []);

    // Turning reduced motion off has to wake a resting globe, or its idle spin
    // waits for an interaction.
    useEffect(() => {
        const query = window.matchMedia('(prefers-reduced-motion: reduce)');
        const onChange = () => {
            reducedMotionRef.current = query.matches;
            requestDraw();
        };
        query.addEventListener('change', onChange);
        return () => query.removeEventListener('change', onChange);
    }, [requestDraw]);

    const stars = useMemo(() => {
        return Array.from({ length: 400 }).map(() => ({
            x: Math.random(),
            y: Math.random(),
            r: Math.random() * 1.5 + 0.3,
            opacity: Math.random() * 0.8 + 0.2,
        }));
    }, []);

    const shootingStarRef = useRef({ active: false, x: 0, y: 0, length: 0, speed: 0, angle: 0, progress: 0 });

    // Load base H3 tier (res 3) + country names
    useEffect(() => {
        let active = true;
        Promise.all([loadHexTier(3), loadCountryNames()]).then(([tier, names]) => {
            if (!active) return;
            setBaseTier(tier);
            setCountryNames(names);
        }).catch(() => {
            if (active) setMapError(true);
        });
        return () => { active = false; };
    }, []);

    // The WebGL renderer, where the browser has one; otherwise the canvas 2D path draws.
    useEffect(() => {
        const canvas = glCanvasRef.current;
        if (!baseTier || !canvas) return;
        let renderer: HexGlRenderer | null = null;
        try {
            renderer = createHexGlRenderer(canvas, baseTier, CELL_STYLES.length, () => {
                glRef.current = null;
                requestDraw();
            });
        } catch {
            // A shader the driver rejects is as good as no WebGL: fall back.
            renderer = null;
        }
        glRef.current = renderer;
        stylesDirtyRef.current = true;
        requestDraw();
        return () => {
            glRef.current = null;
            renderer?.dispose();
        };
    }, [baseTier, requestDraw]);

    const visitedCityHexes = useMemo(
        () => buildCityHexSet(visitedCities, activeTier),
        [visitedCities, activeTier],
    );

    const hexSpacing = useMemo(() => (baseTier ? hexSpacingRad(baseTier.res) : 0), [baseTier]);

    // The selected country's centre, in radians: the mean of its hexes or, for a
    // country too small for the active tier (e.g. Liechtenstein), the caller's point.
    const countryFocus = useMemo(() => {
        if (!focusedCountryCode || !activeTier) return null;
        const centroid = activeTier.countryCentroids.get(focusedCountryCode);
        if (centroid) return { lon: centroid.lon, lat: centroid.lat, dotless: false };
        if (countryPointLat === undefined || countryPointLon === undefined) return null;
        return { lon: (countryPointLon * Math.PI) / 180, lat: (countryPointLat * Math.PI) / 180, dotless: true };
    }, [focusedCountryCode, activeTier, countryPointLat, countryPointLon]);

    // The chosen city's hex in the active tier.
    const focusedDotKey = useMemo(() => {
        if (focusLat === undefined || focusLon === undefined || !activeTier) return null;
        return resolveCityHex(focusLat, focusLon, activeTier, focusCityCountry);
    }, [focusLat, focusLon, focusCityCountry, activeTier]);

    // With no hex of its own to light, the place itself, in radians.
    const markerPoint = useMemo(() => {
        if (focusLat !== undefined && focusLon !== undefined) {
            return focusedDotKey ? null : { lon: (focusLon * Math.PI) / 180, lat: (focusLat * Math.PI) / 180 };
        }
        return countryFocus?.dotless ? { lon: countryFocus.lon, lat: countryFocus.lat } : null;
    }, [focusLat, focusLon, focusedDotKey, countryFocus]);

    const markerCell = useMemo(() => {
        if (!markerPoint || !activeTier) return null;
        const latDeg = (markerPoint.lat * 180) / Math.PI;
        const lonDeg = (markerPoint.lon * 180) / Math.PI;
        const key = latLngToCell(latDeg, lonDeg, activeTier.res);
        return activeTier.cellCodes.has(key)
            ? { key, lon: 0, lat: 0, hasDot: true }
            : { key, lon: markerPoint.lon, lat: markerPoint.lat, hasDot: false };
    }, [markerPoint, activeTier]);
    const selectedKey = focusedDotKey ?? (markerCell?.hasDot ? markerCell.key : null);

    // Turn to the selected city, or else the selected country, and hold there.
    const countryLon = countryFocus?.lon;
    const countryLat = countryFocus?.lat;
    const wasFocusedRef = useRef(false);
    useEffect(() => {
        if (!activeTier) return;
        let lon: number | null = null;
        let lat: number | null = null;
        let zoom = 1;
        if (focusLat !== undefined && focusLon !== undefined) {
            lon = (focusLon * Math.PI) / 180;
            lat = (focusLat * Math.PI) / 180;
            zoom = FOCUS_ZOOM.city[mode];
        } else if (countryLon !== undefined && countryLat !== undefined) {
            lon = countryLon;
            lat = countryLat;
            zoom = FOCUS_ZOOM.country[mode];
        } else if (focusedCountryCode) {
            // Selected, but with nowhere to turn to: hold still. The frame
            // lets a running spin see the hold; deselecting, below, wakes it.
            dragRef.current.holding = true;
            requestDraw();
            return;
        }

        const drag = dragRef.current;
        const focusing = lon !== null && lat !== null;
        drag.holding = focusing;
        if (!focusing && !wasFocusedRef.current) {
            // Let go of a hold that never turned the globe: the spin may resume.
            requestDraw();
            return;
        }
        wasFocusedRef.current = focusing;

        drag.targetZoom = zoom;
        drag.lastInteractionTime = performance.now();
        drag.zoomCursorX = 0;
        drag.zoomCursorY = 0;
        if (lon !== null && lat !== null) {
            drag.targetRotation = lon;
            drag.targetOffsetLat = -lat;
            const flatCentre = projectEqualEarth(lon, lat);
            drag.targetPanXNorm = flatCentre.nx;
            drag.targetPanYNorm = flatCentre.ny;
        } else {
            drag.targetRotation = null;
            drag.targetOffsetLat = null;
            drag.targetPanXNorm = null;
            drag.targetPanYNorm = null;
        }
        requestDraw();
    }, [focusTrigger, focusLat, focusLon, countryLon, countryLat, focusedCountryCode, activeTier, mode, requestDraw]);

    // Draw the map
    const draw = useCallback((time: number) => {
        const canvas = canvasRef.current;
        if (!canvas || !baseTier) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const drag = dragRef.current;
        const anim = animRef.current;

        // Waking from sleep, the gap is not a step. A slow frame (the canvas 2D
        // path) still is, capped so a stall cannot jump the morph to its end.
        const dt = anim.lastTime < 0 ? 1000 / 60 : Math.min(Math.max(0, time - anim.lastTime), 100);
        anim.lastTime = time;

        const target = mode === '3d' ? 1 : 0;
        const speed = 0.002; // transition speed
        if (anim.progress < target) {
            anim.progress = Math.min(target, anim.progress + dt * speed);
        } else if (anim.progress > target) {
            anim.progress = Math.max(target, anim.progress - dt * speed);
        }

        // With reduced motion every easing lands in one step.
        const reduced = reducedMotionRef.current;
        const step = reduced ? 1 : 0.08;
        const gl = glRef.current;
        let spinning = false;

        // Apply momentum / velocity if not dragging
        if (anim.progress > 0 && !drag.isDragging) {
            if (drag.targetRotation !== null && drag.targetOffsetLat !== null) {
                let diff = drag.targetRotation - anim.rotation;
                while (diff > Math.PI) diff -= Math.PI * 2;
                while (diff < -Math.PI) diff += Math.PI * 2;

                anim.rotation += diff * step;
                drag.offsetLat += (drag.targetOffsetLat - drag.offsetLat) * step;

                if (Math.abs(diff) < 0.001 && Math.abs(drag.targetOffsetLat - drag.offsetLat) < 0.001) {
                    drag.targetRotation = null;
                    drag.targetOffsetLat = null;
                }
            } else if (Math.abs(drag.velocityX) > 0.0001) {
                anim.rotation += drag.velocityX;
                drag.velocityX *= 0.95; // friction
            } else if (gl && !reduced && !drag.holding && time - drag.lastInteractionTime > IDLE_SPIN_DELAY_MS) {
                // WebGL only: on the canvas 2D path every frame of a spin
                // that never ends is the 40ms path rebuild, for ever.
                spinning = true;
                // The slow spin comes up to speed over the ramp, so it
                // drifts off rather than lurching away at full speed.
                const ramp = Math.min(1, (time - drag.lastInteractionTime - IDLE_SPIN_DELAY_MS) / IDLE_SPIN_RAMP_MS);
                const ease = ramp * ramp * (3 - 2 * ramp);
                anim.rotation += dt * 0.00008 * anim.progress * ease;

                // Spring back latitude offset towards 0 gently, on the same ramp
                if (Math.abs(drag.offsetLat) > 0.001) {
                    drag.offsetLat -= drag.offsetLat * 0.015 * ease;
                } else {
                    drag.offsetLat = 0;
                }
            }
        }
        const dpr = window.devicePixelRatio || 1;
        // At rest a vertical swipe over the map scrolls the page, so the map
        // never traps a phone's scroll; zoomed in, every direction pans it.
        const touchAction = drag.targetZoom > 1.05 ? 'none' : 'pan-y';
        if (canvas.style.touchAction !== touchAction) canvas.style.touchAction = touchAction;
        const W = canvas.offsetWidth;
        const H = canvas.offsetHeight;
        // Setting a canvas's size reallocates it, so only when the box or the
        // screen actually changed -- not every frame, as it used to.
        const pixelW = Math.round(W * dpr);
        const pixelH = Math.round(H * dpr);
        if (canvas.width !== pixelW) canvas.width = pixelW;
        if (canvas.height !== pixelH) canvas.height = pixelH;
        // Cleared in device pixels: at a fractional ratio the rounded backing
        // store is wider than W * dpr, and its last column would keep old paint.
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        // The flat map is fitted inside the canvas rather than the canvas
        // being resized to it, so the box never moves underneath the drawing
        // and the 2D/3D morph has nothing to keep step with.
        // A phone's slot is far taller than the flat map, and fitting the whole
        // width there left a thin strip of sub-pixel dots in an empty box. A
        // narrow slot fits the height instead and pans sideways.
        const fitHeight = W < 600 && H * EQUAL_EARTH_ASPECT > W;
        const mapW = fitHeight ? H * EQUAL_EARTH_ASPECT : Math.min(W, H * EQUAL_EARTH_ASPECT);
        const mapH = mapW / EQUAL_EARTH_ASPECT;

        // Opening the inspector beside the map narrows the canvas. Pan is in
        // pixels, so it scales with the map or the view slides off its place.
        // A frame with no size (a hidden parent, mid-layout) is skipped, or
        // the pan would be multiplied by nothing and never come back.
        const lastMapW = drag.lastMapW;
        if (mapW > 0) {
            if (lastMapW > 0 && mapW !== lastMapW) {
                drag.panX *= mapW / lastMapW;
                drag.panY *= mapW / lastMapW;
            }
            drag.lastMapW = mapW;
        }

        const isDark = document.documentElement.classList.contains('dark');

        // Smooth zoom interpolation with cursor-centered pan correction
        const prevZoom = drag.zoom;
        drag.zoom += (drag.targetZoom - drag.zoom) * (reduced ? 1 : 0.1);
        // Land on the target rather than creep at it for ever, which would
        // keep the loop awake.
        if (Math.abs(drag.targetZoom - drag.zoom) < 0.0005) drag.zoom = drag.targetZoom;
        const curZoom = drag.zoom;

        // Apply cursor-centered pan correction for this frame's zoom delta (2D only)
        // This keeps the point under the cursor fixed as zoom smoothly changes.
        if (mode === '2d' && Math.abs(curZoom - prevZoom) > 0.0001) {
            const factor = 1 - curZoom / prevZoom;
            drag.panX += (drag.zoomCursorX - drag.panX) * factor;
            drag.panY += (drag.zoomCursorY - drag.panY) * factor;
        }

        // Whether the flat map has come to rest, so the loop can stop.
        let panSettled = true;
        // Clamp 2D pan to prevent wandering infinitely offscreen
        if (mode === '2d') {
            if (!drag.isDragging && drag.targetPanXNorm !== null && drag.targetPanYNorm !== null) {
                const targetPanX = mapW * curZoom * (0.5 - drag.targetPanXNorm);
                const targetPanY = mapH * curZoom * (0.5 - drag.targetPanYNorm);

                drag.panX += (targetPanX - drag.panX) * step;
                drag.panY += (targetPanY - drag.panY) * step;
                panSettled = Math.abs(targetPanX - drag.panX) < 0.5 && Math.abs(targetPanY - drag.panY) < 0.5;
                // The target is kept as the resting place, not dropped on
                // arrival: past the map's edge (France at this zoom is above
                // the limit) the spring-back would otherwise pull the
                // selection off centre. A drag, the wheel or deselecting
                // releases it.
            }

            // Rubber band rather than a hard stop: a drag may pull the map past
            // its edge, and the moment the finger lifts the excess springs
            // back. The one thing that rests past the edge is a held
            // selection, above, so that it can sit in the middle.
            const maxPanX = Math.max(0, (mapW * curZoom - W) / 2);
            const maxPanY = Math.max(0, (mapH * curZoom - H) / 2);
            drag.boundX = maxPanX;
            drag.boundY = maxPanY;

            if (drag.isDragging) {
                const hardX = maxPanX + PAN_OVERSCROLL;
                const hardY = maxPanY + PAN_OVERSCROLL;
                drag.panX = Math.max(-hardX, Math.min(hardX, drag.panX));
                drag.panY = Math.max(-hardY, Math.min(hardY, drag.panY));
            } else if (drag.targetPanXNorm === null && drag.targetPanYNorm === null) {
                drag.panX = settlePan(drag.panX, maxPanX);
                drag.panY = settlePan(drag.panY, maxPanY);
                panSettled = Math.abs(drag.panX) <= maxPanX && Math.abs(drag.panY) <= maxPanY;
            }
        }

        const { panX, panY } = drag;
        const { progress, rotation } = anim;
        const R = Math.min(W, H) * 0.45 * curZoom;

        // Draw background stars ONLY in 3D mode (scales with progress)
        const starVisibility = progress;

        if (starVisibility > 0) {
            ctx.save();
            // Inverse clip to prevent stars from bleeding through the 3D globe itself
            ctx.beginPath();
            ctx.rect(0, 0, W, H);
            ctx.arc(W / 2, H / 2, Math.max(0, R - 1), 0, Math.PI * 2, true);
            ctx.clip('evenodd');

            // Parallax effect using pan and rotation
            const px = panX * 0.05 + rotation * 50;
            const py = panY * 0.05 - drag.offsetLat * 50;

            ctx.fillStyle = isDark ? '#ffffff' : '#111827';
            for (const star of stars) {
                const sx = (star.x * W + px) % W;
                const sy = (star.y * H + py) % H;

                const drawX = sx < 0 ? sx + W : sx;
                const drawY = sy < 0 ? sy + H : sy;

                ctx.globalAlpha = star.opacity * starVisibility;
                ctx.beginPath();
                ctx.arc(drawX, drawY, star.r, 0, Math.PI * 2);
                ctx.fill();
            }

            // Handle shooting stars
            const ss = shootingStarRef.current;
            if (!ss.active && Math.random() < 0.005) {
                ss.active = true;
                ss.x = Math.random() * W;
                ss.y = Math.random() * (H / 3);
                ss.angle = Math.PI / 4 + (Math.random() - 0.5) * 0.5;
                ss.length = 80 + Math.random() * 120;
                ss.speed = 15 + Math.random() * 20;
                ss.progress = 0;
            }

            if (ss.active) {
                ss.progress += ss.speed;
                const ex = ss.x - Math.cos(ss.angle) * ss.progress;
                const ey = ss.y + Math.sin(ss.angle) * ss.progress;

                const tailX = ss.x - Math.cos(ss.angle) * Math.max(0, ss.progress - ss.length);
                const tailY = ss.y + Math.sin(ss.angle) * Math.max(0, ss.progress - ss.length);

                ctx.globalAlpha = Math.max(0, 1 - (ss.progress / (W * 1.5))) * starVisibility;
                const grad = ctx.createLinearGradient(ex, ey, tailX, tailY);
                const colorBase = isDark ? '255, 255, 255' : '17, 24, 39';
                grad.addColorStop(0, `rgba(${colorBase}, 1)`);
                grad.addColorStop(1, `rgba(${colorBase}, 0)`);

                ctx.beginPath();
                ctx.moveTo(ex, ey);
                ctx.lineTo(tailX, tailY);
                ctx.strokeStyle = grad;
                ctx.lineWidth = 1.5;
                ctx.stroke();

                if (ss.progress > W * 1.5 || ey > H + 100) {
                    ss.active = false;
                }
            }
            ctx.restore();
            ctx.globalAlpha = 1;
        } else {
            // No sky on the flat map. A star mid-flight when it flattened
            // would otherwise stay in flight, and keep the loop awake, for ever.
            shootingStarRef.current.active = false;
        }

        const W_zoom = mapW * curZoom;
        const H_zoom = mapH * curZoom;
        const isMobile = W < 600;

        const view: GlobeView = {
            width: W,
            height: H,
            dpr,
            radius: R,
            cosRot: Math.cos(rotation),
            sinRot: Math.sin(rotation),
            cosLat: Math.cos(drag.offsetLat),
            sinLat: Math.sin(drag.offsetLat),
            flatW: W_zoom,
            flatH: H_zoom,
            flatX: W / 2 - W_zoom / 2 + panX,
            flatY: H / 2 - H_zoom / 2 + panY,
            progress,
        };
        viewRef.current = view;

        const palette = isDark ? DOT_PALETTE.dark : DOT_PALETTE.light;

        const cellCount = baseTier.cells.length;
        if (stylesRef.current.length !== cellCount) {
            stylesRef.current = new Uint8Array(cellCount);
            stylesDirtyRef.current = true;
        }
        const styles = stylesRef.current;
        if (stylesDirtyRef.current) {
            fillCellStyles(styles, baseTier, {
                visited: visitedSet,
                cityHexes: visitedCityHexes,
                cityDots: visitedCityDots,
                cities: viewMode === 'cities',
                hovered: hoveredCountryRef.current,
                selected: selectedKey,
                focusedDot: focusedDotKey,
            });
            gl?.setCellStyles(styles);
            stylesDirtyRef.current = false;
        }

        // Border strength. On the flat map it firms up as you zoom in; through
        // the morph it fades out and back, so it never smears across the move.
        let borderAlpha: number;
        let drawHemisphere = false;
        if (progress === 0) {
            borderAlpha = Math.min(BORDER_ALPHA_ZOOMED, BORDER_ALPHA + Math.max(0, curZoom - 1.0) * 0.1);
        } else {
            borderAlpha = BORDER_ALPHA;
            const threshold = 0.15;
            if (progress === 1) {
                drawHemisphere = true;
            } else if (progress > 1 - threshold) {
                drawHemisphere = true;
                borderAlpha = BORDER_ALPHA * ((progress - (1 - threshold)) / threshold);
            } else if (progress < threshold) {
                borderAlpha = BORDER_ALPHA * (1 - (progress / threshold));
            } else {
                borderAlpha = 0;
            }
        }
        const borderWidth = Math.min(2.6, (isMobile ? 0.6 : 0.9) * Math.pow(curZoom, 0.45)) * dpr;

        if (drawHemisphere && borderAlpha > 0.015) {
            ctx.globalAlpha = (borderAlpha / BORDER_ALPHA) * 0.05;
            ctx.beginPath();
            ctx.arc(W / 2, H / 2, R, 0, Math.PI * 2);
            ctx.strokeStyle = isDark ? '#ffffff' : '#000000';
            ctx.lineWidth = 1 * dpr;
            ctx.stroke();
            ctx.globalAlpha = 1;
        }

        if (gl) {
            gl.render(view, isDark ? STYLE_GL.dark : STYLE_GL.light, {
                shade: isDark ? 1 : 0,
                alpha: borderAlpha,
                halfWidth: borderWidth / 2,
            });
        } else {
            drawCellsCanvas(ctx, baseTier, styles, isDark ? STYLE_CSS.dark : STYLE_CSS.light, view, {
                color: isDark ? '#ffffff' : '#000000',
                alpha: borderAlpha,
                width: borderWidth,
            });
        }

        const traceHexIntoPath = (cx: number, cy: number, vertsX: number[], vertsY: number[], scale: number) => {
            for (let i = 0; i < vertsX.length; i++) {
                const px = cx + (vertsX[i] - cx) * scale;
                const py = cy + (vertsY[i] - cy) * scale;
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
        };

        const drawSelectedHex = (p: SelectedHex) => {
            ctx.save();
            ctx.globalAlpha = p.opacity;
            ctx.shadowColor = palette.selectedGlow;
            ctx.shadowBlur = Math.max(4, p.radius * 1.5) * dpr;
            ctx.fillStyle = palette.selected;
            ctx.beginPath();
            traceHexIntoPath(p.x, p.y, p.vertsX, p.vertsY, 0.95);
            ctx.fill();
            ctx.restore();
        };

        const selectedIndex = selectedKey ? baseTier.cellIndexByH3.get(selectedKey) : undefined;
        if (selectedIndex !== undefined) {
            const hex = placeSelectedHex(baseTier.cells[selectedIndex], view, (mapW / 135) * curZoom);
            if (hex) drawSelectedHex(hex);
        } else if (markerCell && !markerCell.hasDot) {
            const flat = projectEqualEarth(markerCell.lon, markerCell.lat);
            let x = flat.nx * W_zoom + view.flatX;
            let y = flat.ny * H_zoom + view.flatY;
            let zNorm = 1;
            if (progress > 0) {
                const onGlobe = projectToGlobe(view, {
                    ux: Math.cos(markerCell.lat) * Math.sin(markerCell.lon),
                    uy: -Math.sin(markerCell.lat),
                    uz: Math.cos(markerCell.lat) * Math.cos(markerCell.lon),
                });
                x += (onGlobe.x - x) * progress;
                y += (onGlobe.y - y) * progress;
                zNorm = onGlobe.z;
            }
            const opacity = (1 - progress) + Math.max(0.1, 0.45 + 0.55 * zNorm) * progress;
            if (!(zNorm < 0 && progress > 0.5)) {
                const r = Math.max(2.5, (mapW / 180) * 0.45 * curZoom) * MARKER_EMPHASIS;
                ctx.save();
                ctx.globalAlpha = opacity;
                ctx.shadowColor = palette.selectedGlow;
                ctx.shadowBlur = Math.max(4, r * 1.5) * dpr;
                ctx.fillStyle = palette.selected;
                ctx.beginPath();
                for (let i = 0; i < 6; i++) {
                    const angle = (Math.PI / 3) * i;
                    const px = x + r * Math.cos(angle);
                    const py = y + r * Math.sin(angle);
                    if (i === 0) ctx.moveTo(px, py);
                    else ctx.lineTo(px, py);
                }
                ctx.closePath();
                ctx.fill();
                ctx.restore();
            }
        }

        // Ask for another frame only while something is still moving.
        const moving =
            anim.progress !== target ||
            (anim.progress > 0 && !drag.isDragging && (drag.targetRotation !== null || Math.abs(drag.velocityX) > 0.0001)) ||
            drag.zoom !== drag.targetZoom ||
            (mode === '2d' && !panSettled) ||
            spinning ||
            shootingStarRef.current.active;

        if (spinTimerRef.current !== undefined) {
            window.clearTimeout(spinTimerRef.current);
            spinTimerRef.current = undefined;
        }
        // Off screen, stop; coming back into view wakes the loop.
        if (!visibleRef.current) {
            anim.lastTime = -1;
            return;
        }
        if (moving) {
            requestDraw();
            return;
        }
        anim.lastTime = -1;
        if (gl && anim.progress > 0 && !reduced && !drag.holding) {
            // At rest on the globe: wake when the idle spin is due to start.
            const wait = IDLE_SPIN_DELAY_MS - (time - drag.lastInteractionTime);
            spinTimerRef.current = window.setTimeout(requestDraw, Math.max(0, wait) + 16);
        }
    }, [baseTier, visitedSet, visitedCityHexes, visitedCityDots, viewMode, mode, stars, focusedDotKey, selectedKey, markerCell, requestDraw]);

    drawRef.current = draw;

    // Anything `draw` depends on changed what is drawn: restyle and redraw.
    useEffect(() => {
        stylesDirtyRef.current = true;
        requestDraw();
    }, [draw, requestDraw]);

    // The palette is read from the page's theme class each frame, so a sleeping
    // loop has to be woken to repaint in the new one.
    useEffect(() => {
        requestDraw();
    }, [resolvedTheme, requestDraw]);

    // Stop the loop and the idle-spin wake-up with the component.
    useEffect(() => () => {
        if (requestRef.current !== undefined) cancelAnimationFrame(requestRef.current);
        requestRef.current = undefined;
        if (spinTimerRef.current !== undefined) window.clearTimeout(spinTimerRef.current);
    }, []);

    // Handle resize
    useEffect(() => {
        const observer = new ResizeObserver(() => requestDraw());
        if (canvasRef.current) observer.observe(canvasRef.current);
        return () => observer.disconnect();
    }, [requestDraw]);

    // A move to a screen of another pixel ratio changes no CSS size, so the
    // resize observer misses it; the backing stores would stay at the old one.
    useEffect(() => {
        let query: MediaQueryList | null = null;
        function onChange() {
            requestDraw();
            watch();
        }
        function watch() {
            query?.removeEventListener('change', onChange);
            query = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
            query.addEventListener('change', onChange);
        }
        watch();
        return () => query?.removeEventListener('change', onChange);
    }, [requestDraw]);

    // Sleep while scrolled out of view; wake on the way back in.
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || typeof IntersectionObserver === 'undefined') return;
        const observer = new IntersectionObserver(([entry]) => {
            const wasVisible = visibleRef.current;
            visibleRef.current = entry.isIntersecting;
            if (!wasVisible && entry.isIntersecting) requestDraw();
        });
        observer.observe(canvas);
        return () => observer.disconnect();
    }, [requestDraw]);

    /**
     * Which country's cell sits under a viewport point, if any. The pointer is
     * worked back through the projection to a place and H3 names its cell --
     * constant time, where scanning every drawn cell meant rebuilding a list
     * of thousands of them each frame.
     */
    const countryAtPoint = useCallback((clientX: number, clientY: number) => {
        const canvas = canvasRef.current;
        const view = viewRef.current;
        const tier = baseTier;
        if (!canvas || !view || !tier) return NO_HIT;

        const rect = canvas.getBoundingClientRect();
        const place = mapPointAt(view, clientX - rect.left, clientY - rect.top);
        if (!place) return NO_HIT;

        const cellPx = hexSpacing * (view.progress === 1 ? view.radius : view.flatW / (2 * Math.PI));
        const ring = Math.max(0, Math.min(3, Math.ceil(HIT_SLOP_PX / Math.max(cellPx, 0.1)) - 1));
        // Only a cell that is drawn: the globe hides its back, and the flat map
        // the cells that straddle the antimeridian.
        const drawn = view.progress === 1
            ? (cell: HexCell) => projectToGlobe(view, cell.center3d).z >= 0
            : (cell: HexCell) => !cell.crossesAntimeridian;
        const dotKey = hexAtPoint((place.lat * 180) / Math.PI, (place.lon * 180) / Math.PI, tier, ring, drawn);
        if (!dotKey) return NO_HIT;
        return { code: tier.cellCodes.get(dotKey) ?? null, dotKey };
    }, [baseTier, hexSpacing]);

    /**
     * Tells the page about a hover. Each report re-renders the Travel page, so
     * it hears only of changes it shows: the country, the region label and,
     * in the cities view, the hex.
     */
    const emitHover = useCallback((code: string | null, dotKey: string | null) => {
        const name = code ? (countryNames[code] ?? code) : null;
        const label = code && name ? getRegionHoverLabel(code, dotKey, name) : null;
        const key = `${code ?? ''}|${label ?? ''}|${viewMode === 'cities' ? (dotKey ?? '') : ''}`;
        if (key === lastHoverRef.current) return;
        lastHoverRef.current = key;
        onCountryHover?.(code, label, code ? `https://flagcdn.com/w80/${code.toLowerCase()}.png` : null, dotKey);
    }, [countryNames, viewMode, onCountryHover]);

    const setHover = useCallback((code: string | null, dotKey: string | null) => {
        const drag = dragRef.current;
        if (code !== hoveredCountryRef.current) {
            hoveredCountryRef.current = code;
            stylesDirtyRef.current = true;
            requestDraw();
        }
        drag.hoveredDotKey = dotKey;
        const canvas = canvasRef.current;
        if (canvas) canvas.style.cursor = drag.isDragging ? 'grabbing' : (code ? 'crosshair' : 'grab');
        emitHover(code, dotKey);
    }, [emitHover, requestDraw]);

    /** Select whatever is under a point: shared by a mouse click and a tap. */
    const selectAtPoint = useCallback((clientX: number, clientY: number) => {
        const { code, dotKey } = countryAtPoint(clientX, clientY);
        if (!code) return;

        // A tap has no hover pass before it, so light up the country as well as
        // selecting it -- otherwise the map would jump with nothing highlighted.
        setHover(code, dotKey);
        onCountryClick?.(code, countryNames[code] ?? code);
    }, [countryAtPoint, countryNames, onCountryClick, setHover]);

    // Mouse events
    useEffect(() => {
        const handleWheel = (e: WheelEvent) => {
            if (!activeTier) return;
            e.preventDefault();
            dragRef.current.lastInteractionTime = performance.now();
            releaseTargets(dragRef.current);

            const zoomDelta = e.deltaY * -0.001;
            const minZ = mode === '2d' ? 1.0 : 0.98;
            dragRef.current.targetZoom = Math.max(minZ, Math.min(10, dragRef.current.targetZoom + zoomDelta * dragRef.current.targetZoom));

            // Store cursor position for cursor-centered zooming (applied per-frame in draw())
            if (mode === '2d' && canvasRef.current) {
                const rect = canvasRef.current.getBoundingClientRect();
                dragRef.current.zoomCursorX = (e.clientX - rect.left) - rect.width / 2;
                dragRef.current.zoomCursorY = (e.clientY - rect.top) - rect.height / 2;
            }

            requestDraw();
        };

        const handleTouchStart = (e: TouchEvent) => {
            if (!activeTier) return;
            // Not cancelled for one finger: that would stop the page scrolling
            // when the swipe turns out to be vertical. touch-action keeps the
            // browser from doing anything else with it.
            if (e.touches.length > 1) e.preventDefault();
            if (e.touches.length === 1) {
                dragRef.current.isDragging = true;
                dragRef.current.touchGesture = canvasRef.current?.style.touchAction === 'pan-y' ? 'undecided' : 'drag';
                dragRef.current.lastX = e.touches[0].clientX;
                dragRef.current.lastY = e.touches[0].clientY;
                dragRef.current.startX = e.touches[0].clientX;
                dragRef.current.startY = e.touches[0].clientY;
                dragRef.current.velocityX = 0;
                dragRef.current.lastInteractionTime = performance.now();
                // A selection is let go only once the finger moves: a tap
                // must not drop it (see touchmove).
            } else if (e.touches.length === 2) {
                // Two fingers are a pinch, which a held selection would fight.
                dragRef.current.touchGesture = 'drag';
                releaseTargets(dragRef.current);
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                dragRef.current.pinchDist = Math.sqrt(dx * dx + dy * dy);
            }
        };

        const handleTouchMove = (e: TouchEvent) => {
            if (!activeTier) return;
            const drag = dragRef.current;
            if (e.touches.length === 1 && drag.touchGesture === 'undecided') {
                const dx = e.touches[0].clientX - drag.startX;
                const dy = e.touches[0].clientY - drag.startY;
                if (Math.hypot(dx, dy) < 6) return;
                drag.touchGesture = Math.abs(dy) > Math.abs(dx) ? 'scroll' : 'drag';
                if (drag.touchGesture === 'scroll') drag.isDragging = false;
            }
            // The page is scrolling: leave the globe where it is.
            if (drag.touchGesture === 'scroll' || !e.cancelable) return;
            e.preventDefault();

            if (e.touches.length === 1 && dragRef.current.isDragging) {
                dragRef.current.lastInteractionTime = performance.now();
                if (movedPastThreshold(dragRef.current, e.touches[0].clientX, e.touches[0].clientY)) releaseTargets(dragRef.current);
                const dx = e.touches[0].clientX - dragRef.current.lastX;
                const dy = e.touches[0].clientY - dragRef.current.lastY;
                dragRef.current.lastX = e.touches[0].clientX;
                dragRef.current.lastY = e.touches[0].clientY;

                if (mode === '3d') {
                    const rotDelta = -dx * 0.005;
                    animRef.current.rotation += rotDelta;
                    dragRef.current.velocityX = rotDelta; // Save for momentum
                    dragRef.current.offsetLat -= dy * 0.005;
                    dragRef.current.offsetLat = Math.max(-1.2, Math.min(1.2, dragRef.current.offsetLat));
                } else if (mode === '2d') {
                    dragRef.current.panX += rubberDelta(dragRef.current.panX, dx, dragRef.current.boundX);
                    dragRef.current.panY += rubberDelta(dragRef.current.panY, dy, dragRef.current.boundY);
                }
            } else if (e.touches.length === 2) {
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                const newDist = Math.sqrt(dx * dx + dy * dy);
                if (dragRef.current.pinchDist) {
                    const zoomDelta = (newDist - dragRef.current.pinchDist) * 0.01;
                    const minZ = mode === '2d' ? 1.0 : 0.98;
                    dragRef.current.targetZoom = Math.max(minZ, Math.min(10, dragRef.current.targetZoom + zoomDelta));

                    // Store pinch midpoint for cursor-centered zooming (applied per-frame in draw())
                    if (mode === '2d' && canvasRef.current) {
                        const rect = canvasRef.current.getBoundingClientRect();
                        dragRef.current.zoomCursorX = ((e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left) - rect.width / 2;
                        dragRef.current.zoomCursorY = ((e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top) - rect.height / 2;
                    }
                }
                dragRef.current.pinchDist = newDist;
            }

            requestDraw();
        };

        const handleTouchEnd = (e: TouchEvent) => {
            // No strict preventDefault here to allow tap-to-click events if needed natively
            const wasDragging = dragRef.current.isDragging;
            dragRef.current.isDragging = false;
            dragRef.current.pinchDist = 0;
            dragRef.current.lastInteractionTime = performance.now();
            // Let go: momentum, or the flat map springing back inside its edge.
            requestDraw();

            // Selection is done here rather than by the click a tap produces,
            // which arrives late and after the touch has already been read.
            // A finger that travelled more than 5px was a drag, not a tap.
            const touch = e.changedTouches[0];
            const gesture = dragRef.current.touchGesture;
            if (e.touches.length === 0) dragRef.current.touchGesture = 'idle';
            // touchstart no longer cancels a one-finger touch, so the browser
            // follows it with mouse events and a click. After a pan that click
            // would select whatever is under the finger, and after a tap it
            // would select a second time; the touch has been read here already.
            if (gesture !== 'scroll' && e.cancelable) e.preventDefault();
            if (!wasDragging || !touch) return;
            const dx = touch.clientX - dragRef.current.startX;
            const dy = touch.clientY - dragRef.current.startY;
            if (Math.sqrt(dx * dx + dy * dy) > 5) return;

            selectAtPoint(touch.clientX, touch.clientY);
        };

        const canvas = canvasRef.current;
        if (canvas) {
            canvas.addEventListener('wheel', handleWheel, { passive: false });
            canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
            canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
            canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
            canvas.addEventListener('touchcancel', handleTouchEnd, { passive: false });
        }
        return () => {
            if (canvas) {
                canvas.removeEventListener('wheel', handleWheel);
                canvas.removeEventListener('touchstart', handleTouchStart);
                canvas.removeEventListener('touchmove', handleTouchMove);
                canvas.removeEventListener('touchend', handleTouchEnd);
                canvas.removeEventListener('touchcancel', handleTouchEnd);
            }
        };
    }, [activeTier, mode, selectAtPoint, requestDraw]);

    const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!activeTier) return;
        dragRef.current.isDragging = true;
        dragRef.current.lastX = e.clientX;
        dragRef.current.lastY = e.clientY;
        dragRef.current.startX = e.clientX;
        dragRef.current.startY = e.clientY;
        dragRef.current.velocityX = 0;
        dragRef.current.lastInteractionTime = performance.now();
        e.currentTarget.style.cursor = 'grabbing';
        // A still click leaves a selection held; moving past the threshold
        // lets it go (see handleMouseMove).
    }, [activeTier]);

    const handleMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        dragRef.current.isDragging = false;
        dragRef.current.lastInteractionTime = performance.now();
        // Hover waited out the drag; catch it up with what is under the pointer now.
        const { code, dotKey } = countryAtPoint(e.clientX, e.clientY);
        setHover(code, dotKey);
        // Let go: momentum, or the flat map springing back inside its edge.
        requestDraw();
    }, [countryAtPoint, setHover, requestDraw]);

    const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!canvasRef.current || !activeTier) return;
        const drag = dragRef.current;

        // Handle dragging map
        if (drag.isDragging) {
            drag.lastInteractionTime = performance.now();
            const moved = movedPastThreshold(drag, e.clientX, e.clientY);
            if (moved) releaseTargets(drag);
            const dx = e.clientX - drag.lastX;
            const dy = e.clientY - drag.lastY;
            drag.lastX = e.clientX;
            drag.lastY = e.clientY;

            if (mode === '3d') {
                // Update rotation instantly (inverted dx)
                const rotDelta = -dx * 0.005;
                animRef.current.rotation += rotDelta;
                drag.velocityX = rotDelta; // Save for momentum

                // Update latitude tilt (inverted dy), limit range so we don't go upside down
                drag.offsetLat -= dy * 0.005;
                drag.offsetLat = Math.max(-1.2, Math.min(1.2, drag.offsetLat));
            } else if (mode === '2d') {
                drag.panX += rubberDelta(drag.panX, dx, drag.boundX);
                drag.panY += rubberDelta(drag.panY, dy, drag.boundY);
            }

            // A resting map has stopped its loop, so a drag wakes it.
            requestDraw();
            // Mid-drag the map is moving under the pointer; hover waits for it to stop.
            if (moved) return;
        }

        const { code, dotKey } = countryAtPoint(e.clientX, e.clientY);
        if (code === hoveredCountryRef.current && dotKey === drag.hoveredDotKey) return;
        setHover(code, dotKey);
    }, [activeTier, mode, countryAtPoint, setHover, requestDraw]);

    const handleMouseLeave = useCallback(() => {
        dragRef.current.isDragging = false;
        setHover(null, null);
        requestDraw();
    }, [setHover, requestDraw]);

    const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        // Calculate the total distance moved between pointer start and release
        const dx = e.clientX - dragRef.current.startX;
        const dy = e.clientY - dragRef.current.startY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // If the pointer moved more than 5px, treat it as a drag/scroll, not a click
        if (distance > 5) {
            return;
        }

        selectAtPoint(e.clientX, e.clientY);
    }, [selectAtPoint]);


    // The legend's swatches are the draw loop's own colours, so the two cannot drift.
    const legendPalette = resolvedTheme === 'dark' ? DOT_PALETTE.dark : DOT_PALETTE.light;

    if (mapError) return <div role="status" className="flex min-h-64 items-center justify-center rounded-xl border border-border p-6 text-center text-sm text-muted-foreground">The map is unavailable. You can still explore countries and city journals from the list.</div>;

    return (
        // The box used to be sized to the grid's ratio so the flat map would
        // not stretch. It does not have to be any more: the draw loop fits the
        // projection inside whatever canvas it is given, which is the only way
        // two projections of different shapes can morph without the box and
        // the dots easing on separate clocks. So the canvas simply takes the
        // slot, flat or globe, and never resizes underneath the drawing.
        <div className={`dot-matrix-map-slot ${className}`}>
            <div className="dot-matrix-map-container">
            {!activeTier && (
                <div className="dot-matrix-loading">
                    <div className="dot-matrix-loading-dots">
                        <span /><span /><span />
                    </div>
                </div>
            )}
            {/* Cells and borders, drawn by WebGL. The canvas over it carries
                the stars, the selection's glow and every pointer event. */}
            <canvas ref={glCanvasRef} className="dot-matrix-map-gl" aria-hidden="true" />
            <canvas
                ref={canvasRef}
                className="dot-matrix-map-canvas"
                style={{ width: '100%', height: '100%', cursor: 'grab' }}
                onMouseDown={handleMouseDown}
                onMouseUp={handleMouseUp}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
                onClick={handleClick}
            />
            {/* One bar for both, so on a narrow map the toggle wraps onto a
                line of its own instead of sliding over the label. */}
            {activeTier && (
                <div className="absolute inset-x-3 bottom-3 sm:inset-x-4 sm:bottom-4 z-10 flex flex-wrap items-end justify-between gap-2 pointer-events-none">
                    {/* What gold means, so visited and not visited never rest on
                        telling two shades apart unaided. */}
                    <div className="dot-matrix-legend">
                        {viewMode === 'cities' ? (
                            <>
                                <span><i aria-hidden="true" className="dot-matrix-legend-swatch" style={{ background: legendPalette.city, boxShadow: `0 0 0 2px ${legendPalette.visitedTint}` }} />City</span>
                                <span><i aria-hidden="true" className="dot-matrix-legend-swatch" style={{ background: legendPalette.visitedTint }} />Country</span>
                            </>
                        ) : (
                            <>
                                <span><i aria-hidden="true" className="dot-matrix-legend-swatch" style={{ background: legendPalette.visited }} />Visited</span>
                                <span><i aria-hidden="true" className="dot-matrix-legend-swatch" style={{ background: legendPalette.unvisited }} />Not yet</span>
                            </>
                        )}
                    </div>
                    {/* Says what you are looking at, and nothing more -- there is one
                        projection now. Hidden over the globe, which is in no projection
                        at all, so the label never names something the map is not.
                        Fades over the 500ms the dots take to roll up into the sphere.
                        Left out on a phone, where the map has no room to spare. */}
                    <div
                        className={`hidden sm:block px-3 py-1.5 rounded-full bg-background/80 backdrop-blur-md border border-border/50 shadow-sm text-xs font-semibold tracking-wider text-muted-foreground whitespace-nowrap cursor-default transition-opacity duration-500 ${
                            mode === '3d' ? 'opacity-0 pointer-events-none' : 'opacity-100 pointer-events-auto'
                        }`}
                        title={EQUAL_EARTH_NOTE}
                        aria-hidden={mode === '3d'}
                    >
                        {EQUAL_EARTH_LABEL}
                    </div>
                    <button
                        onClick={() => setMode(m => m === '2d' ? '3d' : '2d')}
                        className="ml-auto flex min-h-9 items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-full bg-background/80 backdrop-blur-md border border-border/50 shadow-sm hover:bg-muted text-xs font-semibold tracking-wider text-muted-foreground transition-[background-color,color] duration-300 pointer-events-auto"
                        aria-label="Toggle 3D View"
                        aria-pressed={mode === '3d'}
                    >
                        {mode === '2d' ? <Globe className="w-4 h-4" /> : <MapIcon className="w-4 h-4" />}
                        {/* Short on a phone, so the legend and the toggle share a line. */}
                        <span className="sm:hidden">{mode === '2d' ? '3D' : '2D'}</span>
                        <span className="hidden sm:inline">{mode === '2d' ? '3D Globe' : '2D Map'}</span>
                    </button>
                </div>
            )}
            </div>
        </div>
    );
}

export type { DotMatrixGlobeProps };
