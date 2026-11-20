import {
    cellToBoundary,
    cellToLatLng,
    cellsToDirectedEdge,
    directedEdgeToBoundary,
    getHexagonEdgeLengthAvg,
    gridDisk,
    latLngToCell,
    uncompactCells,
    UNITS,
} from 'h3-js';
import { projectEqualEarth } from '@/lib/equalEarth';
import type { FlatPoint, MapProjection, MapProjectionId } from '@/lib/mapProjections';

export interface UnitVector {
    ux: number;
    uy: number;
    uz: number;
}

export interface HexCell {
    /** Position in `HexTierData.cells`, which is also its slot in the style texture. */
    index: number;
    h3Index: string;
    code: string;
    lat: number;
    lon: number;
    center3d: UnitVector;
    center2d: FlatPoint;
    verts3d: UnitVector[];
    verts2d: FlatPoint[];
    crossesAntimeridian: boolean;
    /**
     * Below this morph progress the cell is not drawn; 0 when it always is.
     * One that straddles the antimeridian would smear across the flat map;
     * one past the projection's latitudes has its flat side squashed onto the
     * cut, so it waits until the globe has nearly formed.
     */
    hideBelow: number;
}

export interface HexBorderSegment {
    /** The cell this edge was found from, so a patch of cells can take its own borders. */
    from: string;
    p1: UnitVector;
    p2: UnitVector;
    fx1: number;
    fy1: number;
    fx2: number;
    fy2: number;
    crossesAntimeridian: boolean;
    /** As for a cell. */
    hideBelow: number;
}

/** `hideBelow` for a cell that straddles the antimeridian. */
export const HIDE_ACROSS_ANTIMERIDIAN = 0.5;
/** `hideBelow` for a cell past the projection's latitudes (Antarctica on Mercator). */
export const HIDE_BEYOND_CUT = 0.85;

/**
 * A block of cells as the GPU takes them: flat arrays rather than an object
 * per cell, which at level 5 would be a million objects. The base level is
 * turned into one of these; the finer levels are built as these directly.
 */
export interface HexPatchData {
    count: number;
    /** Unit vectors, 3 per cell. */
    centre3: Float32Array;
    /** Flat-map positions in the patch's projection, 2 per cell. */
    centre2: Float32Array;
    /** Where each cell's corners start in `corner3` / `corner2`, count + 1 entries. */
    cornerStart: Uint32Array;
    corner3: Float32Array;
    corner2: Float32Array;
    /** `hideBelow` per cell. */
    hide: Float32Array;
    borderCount: number;
    /** Both ends' unit vectors, 6 per segment. */
    border3: Float32Array;
    /** Both ends on the flat map, 4 per segment. */
    border2: Float32Array;
    borderHide: Float32Array;
}

export const BUCKET_COLS = 16;
export const BUCKET_ROWS = 8;

export interface HexTierData {
    res: 3;
    /** The projection `center2d`, `verts2d` and the border ends are in. */
    projection: MapProjectionId;
    cells: HexCell[];
    cellCodes: Map<string, string>;
    /** Where each land cell sits in `cells`. */
    cellIndexByH3: Map<string, number>;
    borderSegments: HexBorderSegment[];
    countryCentroids: Map<string, { lon: number; lat: number }>;
    /** Flat-map spatial buckets (`by * BUCKET_COLS + bx`) for fast viewport culling. */
    cellBuckets: HexCell[][];
    borderBuckets: HexBorderSegment[][];
}

/** A level's file: each country's land cells, compacted (see scripts/generate-hex-map.mjs). */
export interface HexLevelJson {
    res: number;
    countries: Record<string, string[]>;
}

/** Every land cell of a level file, with its country. */
export interface RawHexMapJson {
    res: 3;
    cells: [string, string][];
}

export function expandLevel(json: HexLevelJson): [string, string][] {
    const cells: [string, string][] = [];
    for (const code of Object.keys(json.countries)) {
        for (const cell of uncompactCells(json.countries[code], json.res)) cells.push([cell, code]);
    }
    return cells;
}

const tierCache = new Map<3, HexTierData>();
const tierPromises = new Map<3, Promise<HexTierData>>();

export function degToUnit(latDeg: number, lonDeg: number): { lat: number; lon: number; unit: UnitVector } {
    const lat = (latDeg * Math.PI) / 180;
    const lon = (lonDeg * Math.PI) / 180;
    return {
        lat,
        lon,
        unit: {
            ux: Math.cos(lat) * Math.sin(lon),
            uy: -Math.sin(lat),
            uz: Math.cos(lat) * Math.cos(lon),
        },
    };
}

function bucketIndex(nx: number, ny: number): number {
    const bx = Math.max(0, Math.min(BUCKET_COLS - 1, Math.floor(nx * BUCKET_COLS)));
    const by = Math.max(0, Math.min(BUCKET_ROWS - 1, Math.floor(ny * BUCKET_ROWS)));
    return by * BUCKET_COLS + bx;
}

/**
 * Hands the main thread back between chunks of the build. A message rather
 * than a timer: nested timers are clamped to 4ms each, and a background tab
 * throttles them to one a second, which would stretch an idle warm-up to
 * several seconds.
 */
export function yieldToMain(): Promise<void> {
    return new Promise((resolve) => {
        const channel = new MessageChannel();
        channel.port1.onmessage = () => {
            channel.port1.close();
            resolve();
        };
        channel.port2.postMessage(null);
    });
}

/**
 * Builds a tier from the raw cell list. Chunked, it yields every couple of
 * thousand cells, so neither the idle warm-up nor opening Travel freezes the
 * page for the ~150ms the whole build takes.
 */
export async function buildHexTier(raw: RawHexMapJson, chunked = false): Promise<HexTierData> {
    const cellCodes = new Map<string, string>();
    for (const [h3Index, code] of raw.cells) {
        cellCodes.set(h3Index, code);
    }

    const totalBuckets = BUCKET_COLS * BUCKET_ROWS;
    const cellBuckets: HexCell[][] = Array.from({ length: totalBuckets }, () => []);
    const borderBuckets: HexBorderSegment[][] = Array.from({ length: totalBuckets }, () => []);

    const cells: HexCell[] = [];
    const cellIndexByH3 = new Map<string, number>();
    const countrySums = new Map<string, { ux: number; uy: number; uz: number; count: number }>();

    const CHUNK = 2000;
    for (let idx = 0; idx < raw.cells.length; idx++) {
        if (chunked && idx > 0 && idx % CHUNK === 0) {
            await yieldToMain();
        }
        const [h3Index, code] = raw.cells[idx];
        const [clatDeg, clonDeg] = cellToLatLng(h3Index);
        const center = degToUnit(clatDeg, clonDeg);
        const center2d = projectEqualEarth(center.lon, center.lat);

        const boundary = cellToBoundary(h3Index);
        const verts3d: UnitVector[] = [];
        const verts2d: FlatPoint[] = [];
        let minLon = Infinity;
        let maxLon = -Infinity;

        for (const [vLatDeg, vLonDeg] of boundary) {
            const v = degToUnit(vLatDeg, vLonDeg);
            verts3d.push(v.unit);
            verts2d.push(projectEqualEarth(v.lon, v.lat));
            if (v.lon < minLon) minLon = v.lon;
            if (v.lon > maxLon) maxLon = v.lon;
        }

        const cell: HexCell = {
            index: cells.length,
            h3Index,
            code,
            lat: center.lat,
            lon: center.lon,
            center3d: center.unit,
            center2d,
            verts3d,
            verts2d,
            crossesAntimeridian: maxLon - minLon > Math.PI,
            hideBelow: maxLon - minLon > Math.PI ? HIDE_ACROSS_ANTIMERIDIAN : 0,
        };
        cellIndexByH3.set(h3Index, cell.index);
        cells.push(cell);
        if (!cell.crossesAntimeridian) {
            cellBuckets[bucketIndex(center2d.nx, center2d.ny)].push(cell);
        }

        const acc = countrySums.get(code) ?? { ux: 0, uy: 0, uz: 0, count: 0 };
        acc.ux += center.unit.ux;
        acc.uy += center.unit.uy;
        acc.uz += center.unit.uz;
        acc.count += 1;
        countrySums.set(code, acc);
    }

    const countryCentroids = new Map<string, { lon: number; lat: number }>();
    for (const [code, acc] of countrySums) {
        const mag = Math.hypot(acc.ux, acc.uy, acc.uz) || 1;
        const ux = acc.ux / mag;
        const uy = acc.uy / mag;
        const uz = acc.uz / mag;
        countryCentroids.set(code, {
            lon: Math.atan2(ux, uz),
            lat: Math.asin(Math.max(-1, Math.min(1, -uy))),
        });
    }

    const seenPairs = new Set<string>();
    const borderSegments: HexBorderSegment[] = [];

    for (let idx = 0; idx < raw.cells.length; idx++) {
        if (chunked && idx > 0 && idx % CHUNK === 0) {
            await yieldToMain();
        }
        const [h3Index, code] = raw.cells[idx];
        const neighbors = gridDisk(h3Index, 1);
        for (const nb of neighbors) {
            if (nb === h3Index) continue;
            const nbCode = cellCodes.get(nb);
            if (nbCode === code) continue;
            const pairKey = h3Index < nb ? `${h3Index}|${nb}` : `${nb}|${h3Index}`;
            if (seenPairs.has(pairKey)) continue;
            seenPairs.add(pairKey);

            try {
                const edge = cellsToDirectedEdge(h3Index, nb);
                const pts = directedEdgeToBoundary(edge);
                if (pts.length < 2) continue;
                const a = degToUnit(pts[0][0], pts[0][1]);
                const b = degToUnit(pts[pts.length - 1][0], pts[pts.length - 1][1]);
                const f1 = projectEqualEarth(a.lon, a.lat);
                const f2 = projectEqualEarth(b.lon, b.lat);
                const seg: HexBorderSegment = {
                    from: h3Index,
                    p1: a.unit,
                    p2: b.unit,
                    fx1: f1.nx,
                    fy1: f1.ny,
                    fx2: f2.nx,
                    fy2: f2.ny,
                    crossesAntimeridian: Math.abs(a.lon - b.lon) > Math.PI,
                    hideBelow: Math.abs(a.lon - b.lon) > Math.PI ? HIDE_ACROSS_ANTIMERIDIAN : 0,
                };
                borderSegments.push(seg);
                if (!seg.crossesAntimeridian) {
                    borderBuckets[bucketIndex((f1.nx + f2.nx) * 0.5, (f1.ny + f2.ny) * 0.5)].push(seg);
                }
            } catch {
                // Skip invalid edge pairs (e.g., pentagon edge cases)
            }
        }
    }

    return {
        res: raw.res,
        // Built in Equal Earth whatever the default; `projectTier` makes the others.
        projection: 'equal-earth',
        cells,
        cellCodes,
        cellIndexByH3,
        borderSegments,
        countryCentroids,
        cellBuckets,
        borderBuckets,
    };
}

function projectUnit(projection: MapProjection, p: UnitVector): FlatPoint {
    return projection.project(Math.atan2(p.ux, p.uz), Math.asin(Math.max(-1, Math.min(1, -p.uy))));
}

function hideBelowIn(projection: MapProjection, crossesAntimeridian: boolean, points: UnitVector[]): number {
    if (beyondLatitudes(projection, points)) return HIDE_BEYOND_CUT;
    return crossesAntimeridian ? HIDE_ACROSS_ANTIMERIDIAN : 0;
}

/**
 * The base level's cells and borders as one patch for the GPU: all of them,
 * or the cells and border segments at the given indices.
 */
export function tierPatchData(tier: HexTierData, indices?: ArrayLike<number>, segmentIndices?: ArrayLike<number>): HexPatchData {
    const picked = indices ? Array.from(indices, (i) => tier.cells[i]) : tier.cells;
    const count = picked.length;
    let corners = 0;
    for (const cell of picked) corners += cell.verts3d.length;
    const centre3 = new Float32Array(count * 3);
    const centre2 = new Float32Array(count * 2);
    const cornerStart = new Uint32Array(count + 1);
    const corner3 = new Float32Array(corners * 3);
    const corner2 = new Float32Array(corners * 2);
    const hide = new Float32Array(count);
    let k = 0;
    picked.forEach((cell, i) => {
        centre3.set([cell.center3d.ux, cell.center3d.uy, cell.center3d.uz], i * 3);
        centre2.set([cell.center2d.nx, cell.center2d.ny], i * 2);
        hide[i] = cell.hideBelow;
        cornerStart[i] = k;
        for (let j = 0; j < cell.verts3d.length; j++, k++) {
            const v = cell.verts3d[j];
            corner3.set([v.ux, v.uy, v.uz], k * 3);
            corner2.set([cell.verts2d[j].nx, cell.verts2d[j].ny], k * 2);
        }
    });
    cornerStart[count] = k;
    const segments = indices ? Array.from(segmentIndices ?? [], (i) => tier.borderSegments[i]) : tier.borderSegments;
    const border3 = new Float32Array(segments.length * 6);
    const border2 = new Float32Array(segments.length * 4);
    const borderHide = new Float32Array(segments.length);
    segments.forEach((seg, i) => {
        border3.set([seg.p1.ux, seg.p1.uy, seg.p1.uz, seg.p2.ux, seg.p2.uy, seg.p2.uz], i * 6);
        border2.set([seg.fx1, seg.fy1, seg.fx2, seg.fy2], i * 4);
        borderHide[i] = seg.hideBelow;
    });
    return { count, centre3, centre2, cornerStart, corner3, corner2, hide, borderCount: segments.length, border3, border2, borderHide };
}

function beyondLatitudes(projection: MapProjection, points: UnitVector[]): boolean {
    // -uy is sin(lat), so the test needs no inverse trig.
    const sinMin = Math.sin(projection.minLat);
    const sinMax = Math.sin(projection.maxLat);
    return points.some((p) => -p.uy < sinMin || -p.uy > sinMax);
}

const projectedTiers = new WeakMap<HexTierData, Map<MapProjectionId, HexTierData>>();

/**
 * `tier` with its flat-map positions in `projection`. The cells keep their
 * indices, codes and globe positions, so styles, picking and the selection
 * carry over; only the 2D side and the buckets are new. Built once per
 * projection, in a few milliseconds.
 */
export function projectTier(tier: HexTierData, projection: MapProjection): HexTierData {
    if (tier.projection === projection.id) return tier;
    let byId = projectedTiers.get(tier);
    if (!byId) {
        byId = new Map();
        projectedTiers.set(tier, byId);
    }
    const cached = byId.get(projection.id);
    if (cached) return cached;

    const totalBuckets = BUCKET_COLS * BUCKET_ROWS;
    const cellBuckets: HexCell[][] = Array.from({ length: totalBuckets }, () => []);
    const borderBuckets: HexBorderSegment[][] = Array.from({ length: totalBuckets }, () => []);

    const cells = tier.cells.map((cell): HexCell => {
        const hideBelow = hideBelowIn(projection, cell.crossesAntimeridian, cell.verts3d);
        const projected: HexCell = {
            ...cell,
            center2d: projectUnit(projection, cell.center3d),
            verts2d: cell.verts3d.map((v) => projectUnit(projection, v)),
            hideBelow,
        };
        if (hideBelow === 0) cellBuckets[bucketIndex(projected.center2d.nx, projected.center2d.ny)].push(projected);
        return projected;
    });

    const borderSegments = tier.borderSegments.map((seg): HexBorderSegment => {
        const f1 = projectUnit(projection, seg.p1);
        const f2 = projectUnit(projection, seg.p2);
        const hideBelow = hideBelowIn(projection, seg.crossesAntimeridian, [seg.p1, seg.p2]);
        const projected: HexBorderSegment = { ...seg, fx1: f1.nx, fy1: f1.ny, fx2: f2.nx, fy2: f2.ny, hideBelow };
        if (hideBelow === 0) borderBuckets[bucketIndex((f1.nx + f2.nx) * 0.5, (f1.ny + f2.ny) * 0.5)].push(projected);
        return projected;
    });

    const projected: HexTierData = { ...tier, projection: projection.id, cells, borderSegments, cellBuckets, borderBuckets };
    byId.set(projection.id, projected);
    return projected;
}

export async function loadHexTier(res: 3): Promise<HexTierData> {
    const cached = tierCache.get(res);
    if (cached) return cached;

    let promise = tierPromises.get(res);
    if (!promise) {
        promise = (async () => {
            const response = await fetch(`/data/hex-map-v2-r${res}.json`);
            if (!response.ok) throw new Error(`Hex map tier r${res} unavailable`);
            const data = (await response.json()) as HexLevelJson;
            if (data.res !== res || typeof data.countries !== 'object') throw new Error(`Invalid hex map data r${res}`);
            const built = await buildHexTier({ res, cells: expandLevel(data) }, true);
            tierCache.set(res, built);
            return built;
        })().catch((err) => {
            tierPromises.delete(res);
            throw err;
        });
        tierPromises.set(res, promise);
    }
    return promise;
}

/** Find the H3 cell for a lat/lon, preferring `countryCode` if provided. */
export function resolveCityHex(
    latDeg: number,
    lonDeg: number,
    tier: HexTierData,
    countryCode?: string,
): string | null {
    const exact = latLngToCell(latDeg, lonDeg, tier.res);
    if (!countryCode || tier.cellCodes.get(exact) === countryCode) {
        return tier.cellCodes.has(exact) ? exact : null;
    }

    for (const candidate of gridDisk(exact, 1)) {
        if (tier.cellCodes.get(candidate) === countryCode) return candidate;
    }

    const targetLat = (latDeg * Math.PI) / 180;
    const targetLon = (lonDeg * Math.PI) / 180;
    let best: string | null = null;
    let bestDist = Infinity;
    for (const cell of tier.cells) {
        if (cell.code !== countryCode) continue;
        const dLon = Math.min(
            Math.abs(cell.lon - targetLon),
            2 * Math.PI - Math.abs(cell.lon - targetLon),
        );
        const dist = dLon * dLon + (cell.lat - targetLat) ** 2;
        if (dist < bestDist) {
            bestDist = dist;
            best = cell.h3Index;
        }
    }
    return best;
}

/** Mean Earth radius H3 measures against, in km. */
const EARTH_RADIUS_KM = 6371.007180918475;

/** Angle between neighbouring cell centres at `res`, in radians. */
export function hexSpacingRad(res: number): number {
    return (getHexagonEdgeLengthAvg(res, UNITS.km) / EARTH_RADIUS_KM) * Math.sqrt(3);
}

/**
 * The land cell under a point, in degrees. Over the sea, the nearest land
 * cell within `ring` steps, so a small island stays grabbable when its cell is
 * only a pixel or two across. Null over open water. `drawn` leaves out cells
 * the map is not showing, so the pointer never lands on one it cannot see.
 */
export function hexAtPoint(
    latDeg: number,
    lonDeg: number,
    tier: HexTierData,
    ring: number,
    drawn: (cell: HexCell) => boolean = () => true,
): string | null {
    const exact = latLngToCell(latDeg, lonDeg, tier.res);
    const exactIndex = tier.cellIndexByH3.get(exact);
    if (exactIndex !== undefined && drawn(tier.cells[exactIndex])) return exact;
    if (ring <= 0) return null;

    const { ux, uy, uz } = degToUnit(latDeg, lonDeg).unit;
    let best: string | null = null;
    let bestDot = -Infinity;
    for (const candidate of gridDisk(exact, ring)) {
        const index = tier.cellIndexByH3.get(candidate);
        if (index === undefined || !drawn(tier.cells[index])) continue;
        const c = tier.cells[index].center3d;
        const dot = c.ux * ux + c.uy * uy + c.uz * uz;
        if (dot > bestDot) {
            bestDot = dot;
            best = candidate;
        }
    }
    return best;
}

/** Map a list of city lat/lons to their H3 cell indices at `tier.res`. */
export function buildCityHexSet(
    cities: { lat: number; lon: number; countryCode: string }[] | undefined,
    tier: HexTierData | null,
): Set<string> {
    const out = new Set<string>();
    if (!cities || !tier) return out;
    for (const c of cities) {
        const hex = resolveCityHex(c.lat, c.lon, tier, c.countryCode);
        if (hex) out.add(hex);
    }
    return out;
}

/** Return a more specific region label on hover for notable sub-national island/exclave regions. */
export function getRegionHoverLabel(code: string, h3Index: string | null, countryName: string): string {
    if (!h3Index) return countryName;
    try {
        const [lat, lon] = cellToLatLng(h3Index);
        if (code === 'ES') {
            if (lat >= 27 && lat <= 30 && lon >= -19 && lon <= -13) return `Canary Islands, ${countryName}`;
            if (lat >= 38.5 && lat <= 40.3 && lon >= 1.0 && lon <= 4.5) return `Balearic Islands, ${countryName}`;
        } else if (code === 'PT') {
            if (lat >= 32 && lat <= 33.5 && lon >= -17.5 && lon <= -16) return `Madeira, ${countryName}`;
            if (lat >= 36.5 && lat <= 40 && lon >= -32 && lon <= -24.5) return `Azores, ${countryName}`;
        } else if (code === 'US') {
            if (lat >= 18.5 && lat <= 23 && lon >= -161 && lon <= -154) return `Hawaii, ${countryName}`;
            if (lat >= 51 && lon <= -130) return `Alaska, ${countryName}`;
        } else if (code === 'IT') {
            if (lat >= 36.5 && lat <= 38.4 && lon >= 12.2 && lon <= 15.8) return `Sicily, ${countryName}`;
            if (lat >= 38.8 && lat <= 41.4 && lon >= 8.0 && lon <= 10.0) return `Sardinia, ${countryName}`;
        } else if (code === 'FR') {
            if (lat >= 41.2 && lat <= 43.1 && lon >= 8.4 && lon <= 9.7) return `Corsica, ${countryName}`;
        }
    } catch {
        // Fallback to country name if key is not an H3 index
    }
    return countryName;
}
