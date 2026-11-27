import {
    DEFAULT_MAP_PROJECTION,
    isMapProjectionId,
    type MapProjection,
    type MapProjectionId,
} from '@/lib/mapProjections';
import {
    BUCKET_COLS,
    BUCKET_ROWS,
    hexSpacingRad,
    loadHexTier,
    type HexBorderSegment,
    type HexCell,
    type HexTierData,
} from './hexMapData';
import { projectToGlobe, type GlobeView } from './globeProjection';
import type { HexGlPalette } from './hexGlRenderer';
import { HEX_KM, type ShownRes } from './hexLevels';
import { surfaceRows } from './surfaceColors';

/** The selected cell, placed for this frame, for the glow drawn over the map. */
export interface SelectedHex {
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
export const IDLE_SPIN_DELAY_MS = 12000;
/** How long the lock button holds the globe still before it may turn again. */
export const SPIN_LOCK_MS = 2 * 60 * 1000;
/** The hovered hex is outlined once hexes are at least this many pixels across. */
export const HOVER_OUTLINE_MIN_PX = 6;
export const IDLE_SPIN_RAMP_MS = 4000;

/** How close each kind of selection is brought in. */
export const FOCUS_ZOOM = { country: { '3d': 2.5, '2d': 4 }, city: { '3d': 3.5, '2d': 6 } } as const;

/**
 * As far in as the wheel or a pinch goes. Deep enough for level 6's cells,
 * ~6km apart, to be 25-35px across: neighbourhoods and small islands get their own.
 */
export const MAX_ZOOM = 64;

/**
 * How far the globe turns per pixel dragged, at 1x. Divided by the zoom, so
 * zoomed in the land moves with the pointer instead of racing past it; at a
 * fixed rate a drag at 10x swept a country off screen in a flick.
 */
export const DRAG_RAD_PER_PX = 0.005;

/**
 * A dot with no country of its own on the grid (open sea round a small
 * island), drawn for a selection there, is the size of a visited dot.
 */
export const MARKER_EMPHASIS = 1.2;

/**
 * Border strength at the whole-world view, and the most it reaches zoomed in.
 * At 0.15 the borders all but vanished under the dots until you zoomed in.
 */
export const BORDER_ALPHA = 0.3;
export const BORDER_ALPHA_ZOOMED = 0.6;

/**
 * How near, in CSS pixels, the pointer has to come to a land cell to pick it
 * when it is over the sea. Res-3 cells are two or three pixels across on the
 * whole globe, so a small island would otherwise be all but impossible to hit.
 */
export const HIT_SLOP_PX = 8;

/** The globe's per-cell depth shading, in this many steps, for the canvas 2D path. */
export const OPACITY_STEPS = 7;

/**
 * Dot colours, one set per theme. Visited has to read at a glance against not
 * visited, so the two differ in hue, strength and size, never by alpha alone:
 * a faint gold over a faint grey was indistinguishable in either theme. Light
 * uses a deeper amber, because the dark theme's gold washes out on cream.
 */
export const DOT_PALETTE = {
    dark: {
        unvisited: 'rgba(237, 227, 207, 0.2)',
        unvisitedHovered: 'rgba(237, 227, 207, 0.58)',
        visited: 'rgba(196, 155, 80, 1)',
        cityHovered: 'rgba(222, 184, 108, 1)',
        city: 'rgba(216, 134, 48, 1)',
        // The selection is the one dot in a different hue, matte Indicolite,
        // so it never reads as one more antique brass dot.
        selected: 'rgba(46, 166, 178, 1)',
        selectedGlow: 'rgba(46, 166, 178, 0.5)',
        // The sea: a cool tint apart from the page, so land reads against
        // water and the globe against space. Lighter at the globe's middle,
        // as if lit from the front.
        ocean: 'rgba(60, 110, 150, 0.3)',
        oceanEdge: 'rgba(60, 110, 150, 0.42)',
        // The ground under every land hex, opaque, so land never takes the
        // sea's colour through its hexes or the gaps between them.
        land: 'rgba(44, 39, 48, 1)',
    },
    light: {
        unvisited: 'rgba(31, 25, 36, 0.18)',
        unvisitedHovered: 'rgba(31, 25, 36, 0.58)',
        visited: 'rgba(150, 112, 45, 1)',
        cityHovered: 'rgba(122, 88, 28, 1)',
        city: 'rgba(179, 98, 18, 1)',
        selected: 'rgba(15, 100, 109, 1)',
        selectedGlow: 'rgba(15, 100, 109, 0.38)',
        ocean: 'rgba(80, 125, 165, 0.34)',
        oceanEdge: 'rgba(80, 125, 165, 0.46)',
        land: 'rgba(240, 233, 218, 1)',
    },
} as const;

export const outlines = new Map<string, Float32Array>();

/**
 * The flat map's edge in a projection, in the unit square: down the west
 * edge, along the bottom, up the east edge, back along the top. The sea is
 * this shape filled, so it follows Equal Earth's curves or Mercator's
 * straight sides rather than a box around them.
 */
export function projectionOutline(projection: MapProjection): Float32Array {
    const cached = outlines.get(projection.id);
    if (cached) return cached;
    const steps = 64;
    const points: number[] = [];
    const push = (lon: number, lat: number) => {
        const p = projection.project(lon, lat);
        points.push(p.nx, p.ny);
    };
    const { minLat, maxLat } = projection;
    for (let i = 0; i <= steps; i++) push(-Math.PI, maxLat + ((minLat - maxLat) * i) / steps);
    for (let i = 0; i <= steps; i++) push(-Math.PI + (2 * Math.PI * i) / steps, minLat);
    for (let i = 0; i <= steps; i++) push(Math.PI, minLat + ((maxLat - minLat) * i) / steps);
    for (let i = 0; i <= steps; i++) push(Math.PI - (2 * Math.PI * i) / steps, maxLat);
    const outline = new Float32Array(points);
    outlines.set(projection.id, outline);
    return outline;
}

export type DotPalette = Record<keyof typeof DOT_PALETTE.dark, string>;

/**
 * Every look a cell can have, one byte per cell, in one table: its colour and
 * how far its hex reaches towards its corners. Both renderers read the same
 * bytes, so WebGL and canvas 2D cannot disagree about what a visited, hovered
 * or selected cell looks like.
 */
export const CELL_STYLES = [
    { name: 'unvisited', scale: 0.84, color: 'unvisited' },
    { name: 'unvisitedHovered', scale: 0.9, color: 'unvisitedHovered' },
    { name: 'city', scale: 0.92, color: 'city' },
    { name: 'cityHovered', scale: 0.96, color: 'cityHovered' },
    { name: 'selected', scale: 0.92, color: 'selected' },
] as const satisfies readonly { name: string; scale: number; color: keyof DotPalette }[];

export const CELL_STYLE = Object.fromEntries(CELL_STYLES.map((style, i) => [style.name, i])) as Record<(typeof CELL_STYLES)[number]['name'], number>;
export const STYLE_SCALES = CELL_STYLES.map((style) => style.scale);
const styleColors = (p: DotPalette): string[] => CELL_STYLES.map((style) => p[style.color]);

export const STYLE_CSS = { dark: styleColors(DOT_PALETTE.dark), light: styleColors(DOT_PALETTE.light) };

export function parseRgba(css: string): number[] {
    const [r, g, b, a] = css.slice(css.indexOf('(') + 1, css.indexOf(')')).split(',').map((part) => Number(part.trim()));
    return [r / 255, g / 255, b / 255, a ?? 1];
}

const glPalette = (colors: string[], land: string): HexGlPalette => ({
    colors: new Float32Array(colors.flatMap(parseRgba)),
    scales: new Float32Array(STYLE_SCALES),
    land: new Float32Array(parseRgba(land)),
});

export const STYLE_GL = {
    dark: glPalette(STYLE_CSS.dark, DOT_PALETTE.dark.land),
    light: glPalette(STYLE_CSS.light, DOT_PALETTE.light.land),
};

export interface StyleInputs {
    cityHexes: ReadonlySet<string>;
    hoveredKey: string | null;
    selected: string | null;
    focusedDot: string | null;
}

/** A cell's `CELL_STYLE`, at any level: `key` is its H3 index. */
export function cellStyle(key: string, s: StyleInputs): number {
    if (key === s.selected) return CELL_STYLE.selected;
    const hovered = key === s.hoveredKey;
    if (s.cityHexes.has(key) || key === s.focusedDot) {
        return hovered ? CELL_STYLE.cityHovered : CELL_STYLE.city;
    }
    return hovered ? CELL_STYLE.unvisitedHovered : CELL_STYLE.unvisited;
}

/** Writes each cell's `CELL_STYLE` into `out`, by `HexCell.index`. */
export function fillCellStyles(out: Uint8Array, tier: HexTierData, s: StyleInputs) {
    for (const cell of tier.cells) out[cell.index] = cellStyle(cell.h3Index, s);
}

/** Where the selected cell sits this frame, or null where it is hidden (the back of the globe). */
export function placeSelectedHex(cell: HexCell, view: GlobeView, radius: number): SelectedHex | null {
    const { progress } = view;
    if (progress < cell.hideBelow) return null;
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

export interface CanvasBorders {
    visited: ReadonlySet<string>;
    accent: string;
    color: string;
    alpha: number;
    width: number;
}

type CanvasSurface = Pick<NonNullable<HexGlPalette['surface']>, 'raster' | 'colors' | 'zoom'>;
const surfaceIndices = new WeakMap<HexTierData, WeakMap<ImageData, Uint8Array>>();
const baseHexSpacing = hexSpacingRad(3);

function canvasTerrainIndices(tier: HexTierData, raster: ImageData): Uint8Array {
    let byRaster = surfaceIndices.get(tier);
    if (!byRaster) {
        byRaster = new WeakMap();
        surfaceIndices.set(tier, byRaster);
    }
    const cached = byRaster.get(raster);
    if (cached) return cached;
    const indices = new Uint8Array(tier.cells.length);
    for (const cell of tier.cells) {
        const u = 0.5 + cell.lon / (2 * Math.PI);
        const x = Math.floor((u - Math.floor(u)) * raster.width);
        const { first, rows } = surfaceRows[tier.res];
        const y = first + Math.max(0, Math.min(rows - 1, Math.floor((0.5 - cell.lat / Math.PI) * rows)));
        indices[cell.index] = raster.data[(y * raster.width + x) * 4];
    }
    byRaster.set(raster, indices);
    return indices;
}

const isCityStyle = (style: number) => style === CELL_STYLE.city || style === CELL_STYLE.cityHovered;
const visitedOrange = (style: number) => style === CELL_STYLE.cityHovered
    ? '#ff8c60' : '#ff571f';

/**
 * The canvas 2D renderer, for a browser without WebGL2 or a GPU that dropped
 * the context. It builds its path point by point every frame -- the cost that
 * made the globe slow -- so it is the fallback, not the default.
 */
export function drawCellsCanvas(
    ctx: CanvasRenderingContext2D,
    tier: HexTierData,
    styles: Uint8Array,
    colors: string[],
    view: GlobeView,
    borders: CanvasBorders,
    surface?: CanvasSurface,
) {
    const { width: W, height: H, progress, radius: R, cosRot, sinRot, cosLat, sinLat, flatW, flatH, flatX, flatY } = view;
    const W_half = W / 2;
    const H_half = H / 2;
    const margin = 80;

    let visitedBoundary: Path2D | undefined;
    function traceBoundary(seg: HexBorderSegment, x1: number, y1: number, x2: number, y2: number) {
        const visited = borders.visited.has(seg.code) || (seg.neighborCode && borders.visited.has(seg.neighborCode));
        const path = visited ? (visitedBoundary ??= new Path2D()) : ctx;
        path.moveTo(x1, y1);
        path.lineTo(x2, y2);
    }

    const indices = surface && canvasTerrainIndices(tier, surface.raster);
    const bands = surface?.colors.length ?? 0;
    const steps = progress === 0 ? 1 : OPACITY_STEPS;
    const batches: Path2D[] = [];
    // Project the base hex spacing in CSS pixels. Near the globe's limb the
    // short dimension shrinks further, so those cells keep their solid mark.
    const flatSpacing = baseHexSpacing * flatW / (2 * Math.PI);
    const globeSpacing = baseHexSpacing * R;
    const pathFor = (cell: HexCell, style: number, step: number, depth: number) => {
        let paint = style;
        if (surface && indices && style !== CELL_STYLE.selected) {
            const width = flatSpacing * (1 - progress) + globeSpacing * progress * Math.max(0, depth);
            const outline = surface.zoom >= 3 && width >= 8;
            if (!isCityStyle(style) || outline) {
                paint = CELL_STYLES.length + style * bands + indices[cell.index];
            }
        }
        return batches[paint * steps + step] ??= new Path2D();
    };

    const paintBatches = () => {
        batches.forEach((path, key) => {
            const paint = Math.floor(key / steps);
            const alpha = steps === 1 ? 1 : (key % steps) / (steps - 1);
            if (alpha <= 0.01) return;
            ctx.globalAlpha = alpha;
            if (surface && paint >= CELL_STYLES.length) {
                const offset = paint - CELL_STYLES.length;
                const style = Math.floor(offset / bands);
                let color = surface.colors[offset % bands];
                if (style === CELL_STYLE.unvisitedHovered) {
                    color = `color-mix(in srgb, ${color} 68%, white)`;
                }
                ctx.fillStyle = color;
                ctx.fill(path);
                if (isCityStyle(style)) {
                    ctx.strokeStyle = '#552519';
                    ctx.lineWidth = 2.6;
                    ctx.stroke(path);
                    ctx.strokeStyle = visitedOrange(style);
                    ctx.lineWidth = 1.5;
                    ctx.stroke(path);
                }
            } else {
                ctx.fillStyle = surface && isCityStyle(paint) ? visitedOrange(paint) : colors[paint];
                ctx.fill(path);
            }
        });
        // The visited outline goes above the cells, so opaque terrain cannot
        // cover their coastlines or their shared edges with other countries.
        if (visitedBoundary) {
            ctx.globalAlpha = Math.min(1, 3 * borders.alpha);
            ctx.strokeStyle = borders.accent;
            ctx.lineWidth = Math.max(1.5, borders.width + 0.8);
            ctx.stroke(visitedBoundary);
        }
        ctx.globalAlpha = 1;
    };

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
                        traceBoundary(seg, x1, y1, x2, y2);
                    }
                }
            }
            ctx.strokeStyle = borders.color;
            ctx.lineWidth = borders.width;
            ctx.stroke();
        }

        for (let by = byMin; by <= byMax; by++) {
            for (let bx = bxMin; bx <= bxMax; bx++) {
                for (const cell of tier.cellBuckets[by * BUCKET_COLS + bx]) {
                    const cx = cell.center2d.nx * flatW + flatX;
                    const cy = cell.center2d.ny * flatH + flatY;
                    if (cx < -margin || cx > W + margin || cy < -margin || cy > H + margin) continue;
                    const style = styles[cell.index];
                    const scale = surface ? 0.96 : STYLE_SCALES[style];
                    const path = pathFor(cell, style, 0, 1);
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
        paintBatches();
        return;
    }

    // --- Globe and morph: every cell turned, then mixed with its flat place ---
    if (borders.alpha > 0.015) {
        ctx.globalAlpha = borders.alpha;
        ctx.beginPath();
        for (const seg of tier.borderSegments) {
            if (progress < seg.hideBelow) continue;
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
            traceBoundary(seg, x1, y1, x2, y2);
        }
        ctx.strokeStyle = borders.color;
        ctx.lineWidth = borders.width;
        ctx.stroke();
        ctx.globalAlpha = 1;
    }

    for (const cell of tier.cells) {
        if (progress < cell.hideBelow) continue;
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
        const scale = surface ? 0.96 : STYLE_SCALES[style];
        const path = pathFor(cell, style, step, czt / R);

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
    paintBatches();
}

// Country name lookup - loaded from REST Countries API
export let cachedCountryNames: Record<string, string> = {};
let countryNamesPromise: Promise<Record<string, string>> | null = null;

export async function loadCountryNames(): Promise<Record<string, string>> {
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

/** Where the chosen flat-map projection is remembered, per browser. */
export const PROJECTION_STORAGE_KEY = 'travel-map-projection';

export function readStoredProjection(): MapProjectionId {
    try {
        const stored = window.localStorage.getItem(PROJECTION_STORAGE_KEY);
        return isMapProjectionId(stored) ? stored : DEFAULT_MAP_PROJECTION;
    } catch {
        return DEFAULT_MAP_PROJECTION;
    }
}

/** Where the chosen hex size is remembered, per browser. */
export const HEX_SIZE_STORAGE_KEY = 'travel-map-hex-size';

export type HexSizeChoice = 'auto' | ShownRes;

export const HEX_SIZE_CHOICES: readonly { value: HexSizeChoice; label: string; note: string }[] = [
    { value: 'auto', label: 'Auto', note: 'Finer hexes as you zoom in.' },
    { value: 3, label: `${HEX_KM[3]} km`, note: 'The whole-world size, at any zoom.' },
    { value: 4, label: `${HEX_KM[4]} km`, note: 'At any zoom; the whole world is about 82,000 hexes.' },
    { value: 5, label: `${HEX_KM[5]} km`, note: 'Towns a few miles apart get their own. Zooms in to where these show.' },
    { value: 6, label: `${HEX_KM[6]} km`, note: 'Neighbourhoods and small islands get their own. Zooms in to where these show.' },
];

export function readStoredHexSize(): HexSizeChoice {
    try {
        const stored = window.localStorage.getItem(HEX_SIZE_STORAGE_KEY);
        if (stored === '3' || stored === '4' || stored === '5' || stored === '6') return Number(stored) as ShownRes;
    } catch {
        // Storage refused: the default.
    }
    return 'auto';
}

/** Each press of the zoom buttons. */
export const ZOOM_BUTTON_STEP = 1.6;

/** Prefetches base H3 hex map + country names in the background so Travel paints on frame 1. */
export function warmGlobeData(): void {
    void Promise.all([loadHexTier(3), loadCountryNames()]).catch(() => {});
}

/**
 * How far past its own edge the flat map may be pulled, in CSS pixels. The
 * excess is never a resting place: `settlePan` gives it back on release.
 */
export const PAN_OVERSCROLL = 90;

/** Past the edge a drag moves a third as far, so the pull reads as elastic. */
export function rubberDelta(pan: number, delta: number, limit: number): number {
    const pullingFurtherOut = Math.abs(pan) > limit && Math.sign(pan) === Math.sign(delta);
    return pullingFurtherOut ? delta * 0.35 : delta;
}

export interface FocusTargets {
    targetRotation: number | null;
    targetOffsetLat: number | null;
    targetPanXNorm: number | null;
    targetPanYNorm: number | null;
}

/** Let go of a selection's resting place: the user has taken the map. */
export function releaseTargets(drag: FocusTargets) {
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
export const DRAG_THRESHOLD = 5;

export function movedPastThreshold(drag: { startX: number; startY: number }, x: number, y: number) {
    return Math.hypot(x - drag.startX, y - drag.startY) > DRAG_THRESHOLD;
}

/**
 * The flat map's size in a W x H canvas. It is fitted inside rather than the
 * canvas resized to it, so the box never moves under the drawing. A phone's
 * slot is far taller than the map, and fitting its width there left a thin
 * strip of sub-pixel cells; a narrow slot fits the height and pans sideways.
 */
export function fitFlatMap(W: number, H: number, aspect: number): { mapW: number; mapH: number } {
    const fitHeight = W < 600 && H * aspect > W;
    const mapW = fitHeight ? H * aspect : Math.min(W, H * aspect);
    return { mapW, mapH: mapW / aspect };
}

/** A 60 Hz frame: the rate the easing constants below were tuned at. */
export const FRAME_MS = 1000 / 60;

/**
 * The share of the gap an ease closes in `dt` ms, given the share it closes
 * per 60 Hz frame. Applied per frame as it stood, an ease ran twice as fast on
 * a 120 Hz screen and four times as fast on a 240 Hz one.
 */
export function easeOver(perFrame: number, dt: number): number {
    return 1 - Math.pow(1 - perFrame, dt / FRAME_MS);
}

/** One frame of spring-back towards the allowed range; a no-op inside it. */
export function settlePan(pan: number, limit: number, dt: number): number {
    const inRange = Math.max(-limit, Math.min(limit, pan));
    const excess = pan - inRange;
    return Math.abs(excess) < 0.5 ? inRange : inRange + excess * (1 - easeOver(0.18, dt));
}

/**
 * Zoom per pixel of wheel travel, as an exponent so a notch in and a notch
 * out land back where they started. A 100 px mouse notch is ~7%.
 */
export const WHEEL_ZOOM_PER_PX = 0.0007;
/** One wheel event moves at most this far, so a free-spinning wheel cannot leap. */
export const WHEEL_MAX_PX = 240;

export const NO_HIT = { code: null as string | null, dotKey: null as string | null };
export const NO_CELLS: ReadonlySet<string> = new Set();
