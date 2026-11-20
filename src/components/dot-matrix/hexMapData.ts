import {
    cellToBoundary,
    cellToLatLng,
    cellsToDirectedEdge,
    directedEdgeToBoundary,
    gridDisk,
    latLngToCell,
} from 'h3-js';
import { projectEqualEarth, type EqualEarthPoint } from '@/lib/equalEarth';

export interface UnitVector {
    ux: number;
    uy: number;
    uz: number;
}

export interface HexCell {
    h3Index: string;
    code: string;
    lat: number;
    lon: number;
    center3d: UnitVector;
    center2d: EqualEarthPoint;
    verts3d: UnitVector[];
    verts2d: EqualEarthPoint[];
    crossesAntimeridian: boolean;
}

export interface HexBorderSegment {
    p1: UnitVector;
    p2: UnitVector;
    fx1: number;
    fy1: number;
    fx2: number;
    fy2: number;
    crossesAntimeridian: boolean;
}

export const BUCKET_COLS = 16;
export const BUCKET_ROWS = 8;

export interface HexTierData {
    res: 3 | 4;
    cells: HexCell[];
    cellCodes: Map<string, string>;
    borderSegments: HexBorderSegment[];
    countryCentroids: Map<string, { lon: number; lat: number }>;
    /** 2D Equal Earth spatial buckets (`by * BUCKET_COLS + bx`) for fast viewport culling. */
    cellBuckets: HexCell[][];
    borderBuckets: HexBorderSegment[][];
}

interface RawHexMapJson {
    res: 3 | 4;
    cells: [string, string][];
}

const tierCache = new Map<3 | 4, HexTierData>();
const tierPromises = new Map<3 | 4, Promise<HexTierData>>();

function degToUnit(latDeg: number, lonDeg: number): { lat: number; lon: number; unit: UnitVector } {
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

function yieldToMain(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 0));
}

async function buildHexTierAsync(raw: RawHexMapJson, chunked: boolean): Promise<HexTierData> {
    const cellCodes = new Map<string, string>();
    for (const [h3Index, code] of raw.cells) {
        cellCodes.set(h3Index, code);
    }

    const totalBuckets = BUCKET_COLS * BUCKET_ROWS;
    const cellBuckets: HexCell[][] = Array.from({ length: totalBuckets }, () => []);
    const borderBuckets: HexBorderSegment[][] = Array.from({ length: totalBuckets }, () => []);

    const cells: HexCell[] = [];
    const countrySums = new Map<string, { ux: number; uy: number; uz: number; count: number }>();

    const CHUNK = 4000;
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
        const verts2d: EqualEarthPoint[] = [];
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
            h3Index,
            code,
            lat: center.lat,
            lon: center.lon,
            center3d: center.unit,
            center2d,
            verts3d,
            verts2d,
            crossesAntimeridian: maxLon - minLon > Math.PI,
        };
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
                    p1: a.unit,
                    p2: b.unit,
                    fx1: f1.nx,
                    fy1: f1.ny,
                    fx2: f2.nx,
                    fy2: f2.ny,
                    crossesAntimeridian: Math.abs(a.lon - b.lon) > Math.PI,
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

    return { res: raw.res, cells, cellCodes, borderSegments, countryCentroids, cellBuckets, borderBuckets };
}

export async function loadHexTier(res: 3 | 4): Promise<HexTierData> {
    const cached = tierCache.get(res);
    if (cached) return cached;

    let promise = tierPromises.get(res);
    if (!promise) {
        promise = (async () => {
            const response = await fetch(`/data/hex-world-map-r${res}.json`);
            if (!response.ok) throw new Error(`Hex map tier r${res} unavailable`);
            const data = (await response.json()) as RawHexMapJson;
            if (!Array.isArray(data.cells)) throw new Error(`Invalid hex map data r${res}`);
            const built = await buildHexTierAsync(data, res === 4);
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
