import {
    cellToBoundary,
    cellToChildren,
    cellToLatLng,
    cellToParent,
    cellsToDirectedEdge,
    directedEdgeToBoundary,
    getResolution,
    gridDisk,
    latLngToCell,
} from 'h3-js';
import type { MapProjection } from '@/lib/mapProjections';
import {
    HIDE_ACROSS_ANTIMERIDIAN,
    HIDE_BEYOND_CUT,
    codeFromStyleIndex,
    countryStyleIndex,
    degToUnit,
    splitLongToHex,
    type HexCell,
    type HexLevelJson,
    type HexPatchData,
} from './hexMapData';

/**
 * The finer hex levels, 4 (~45 km apart), 5 (~17 km) and 6 (~6 km), shown as
 * the map zooms in. Finer levels have hundreds of thousands to millions of
 * land cells, far too many to build or hold at once, so they are cut into
 * patches (resolution-1 cells for levels 4 and 5, resolution-2 cells for
 * level 6) and only the patches on screen are built.
 */

export type DetailRes = 4 | 5 | 6;

/** Default patch resolution for levels 4 and 5; level 6 uses resolution-2 patches (~260 km). */
export const PATCH_RES = 1;

export function patchResFor(res: DetailRes): number {
    return res >= 6 ? 2 : 1;
}

/** What the page needs of a level: which country any cell belongs to. */
export interface HexDetailLookup {
    res: DetailRes;
    /** Compacted cell (any resolution up to `res`) to country. */
    compact: Pick<ReadonlyMap<string, string>, 'get' | 'size'>;
}

/** What the worker needs as well: the level cut into patches. */
export interface HexDetailLevel extends HexDetailLookup {
    /** Patch key (a resolution-1 cell) to the compacted cells inside it and their countries. */
    patches: Map<string, [string, string][]>;
    /**
     * Pre-baked directed border edges per patch from `hex-map-v2-r{4,5}.bin`,
     * 4 uint32 words per edge: `[edgeLo, edgeHi, cellIdx | (localNbIdx << 16), countryA | (countryB << 16)]`.
     * When present, `buildPatch` skips `gridDisk` and `codeOf` completely.
     */
    prebakedEdges?: Map<string, Uint32Array>;
}

export function buildDetailLookup(json: HexLevelJson): HexDetailLookup {
    const compact = new Map<string, string>();
    for (const code of Object.keys(json.countries)) {
        for (const cell of json.countries[code]) compact.set(cell, code);
    }
    return { res: json.res as DetailRes, compact };
}

/** Index patch headers immediately and decode only the countries queried by a city or pointer. */
export function decodeDetailLookupBin(buffer: ArrayBuffer): HexDetailLookup {
    const header = new Uint32Array(buffer, 0, 5);
    if (header[0] !== 0x44584548) throw new Error('Invalid hex detail binary header');
    const res = header[1] as DetailRes;
    const patchCount = header[2];
    const compactCount = header[3];

    const offPatchH3 = 20;
    const offPatchStart = offPatchH3 + patchCount * 8;
    const offEdgeStart = offPatchStart + (patchCount + 1) * 4;
    const offCompactH3 = offEdgeStart + (patchCount + 1) * 4;
    const offCompactCountry = offCompactH3 + compactCount * 8;

    const compactH3 = new Uint32Array(buffer, offCompactH3, compactCount * 2);
    const compactCountry = new Uint16Array(buffer, offCompactCountry, compactCount);
    const patchH3 = new Uint32Array(buffer, offPatchH3, patchCount * 2);
    const patchStart = new Uint32Array(buffer, offPatchStart, patchCount + 1);
    const patchIndices = new Map<string, number>();
    for (let p = 0; p < patchCount; p++) {
        patchIndices.set(splitLongToHex(patchH3[p * 2], patchH3[p * 2 + 1]), p);
    }
    const patchRes = patchResFor(res);
    const decoded = new Map<string, Map<string, string>>();
    return {
        res,
        compact: {
            size: compactCount,
            get(cell) {
                const r = getResolution(cell);
                // The binary has already expanded coarser entries to the patch level.
                if (r < patchRes) return undefined;
                const home = r === patchRes ? cell : cellToParent(cell, patchRes);
                const p = patchIndices.get(home);
                if (p === undefined) return undefined;
                let countries = decoded.get(home);
                if (!countries) {
                    countries = new Map();
                    for (let i = patchStart[p]; i < patchStart[p + 1]; i++) {
                        const code = codeFromStyleIndex(compactCountry[i]);
                        if (code) countries.set(splitLongToHex(compactH3[i * 2], compactH3[i * 2 + 1]), code);
                    }
                    decoded.set(home, countries);
                }
                return countries.get(cell);
            },
        },
    };
}

/** Decodes a full `hex-map-v2-r{4,5}.bin` buffer with pre-grouped patches and pre-baked border edges. */
export function decodeDetailLevelBin(buffer: ArrayBuffer): HexDetailLevel {
    const header = new Uint32Array(buffer, 0, 5);
    if (header[0] !== 0x44584548) throw new Error('Invalid hex detail binary header');
    const res = header[1] as DetailRes;
    const patchCount = header[2];
    const compactCount = header[3];
    const edgeCount = header[4];

    const offPatchH3 = 20;
    const offPatchStart = offPatchH3 + patchCount * 8;
    const offEdgeStart = offPatchStart + (patchCount + 1) * 4;
    const offCompactH3 = offEdgeStart + (patchCount + 1) * 4;
    const offCompactCountry = offCompactH3 + compactCount * 8;
    const offEdges = (offCompactCountry + compactCount * 2 + 3) & ~3;

    const patchH3 = new Uint32Array(buffer, offPatchH3, patchCount * 2);
    const patchStart = new Uint32Array(buffer, offPatchStart, patchCount + 1);
    const edgeStart = new Uint32Array(buffer, offEdgeStart, patchCount + 1);
    const compactH3 = new Uint32Array(buffer, offCompactH3, compactCount * 2);
    const compactCountry = new Uint16Array(buffer, offCompactCountry, compactCount);
    const edges = new Uint32Array(buffer, offEdges, edgeCount * 4);

    const compact = new Map<string, string>();
    const patches = new Map<string, [string, string][]>();
    const prebakedEdges = new Map<string, Uint32Array>();

    for (let p = 0; p < patchCount; p++) {
        const pKey = splitLongToHex(patchH3[p * 2], patchH3[p * 2 + 1]);
        const cStart = patchStart[p];
        const cEnd = patchStart[p + 1];
        const list: [string, string][] = new Array(cEnd - cStart);
        for (let i = cStart; i < cEnd; i++) {
            const cell = splitLongToHex(compactH3[i * 2], compactH3[i * 2 + 1]);
            const code = codeFromStyleIndex(compactCountry[i]) ?? 'ZZ';
            compact.set(cell, code);
            list[i - cStart] = [cell, code];
        }
        patches.set(pKey, list);
        const eStart = edgeStart[p];
        const eEnd = edgeStart[p + 1];
        prebakedEdges.set(pKey, edges.subarray(eStart * 4, eEnd * 4));
    }

    return { res, compact, patches, prebakedEdges };
}

export interface HexPatch {
    key: string;
    res: DetailRes;
    /** The projection `data`'s flat side is in. */
    projection: string;
    h3: string[];
    codes: string[];
    data: HexPatchData;
}

export function buildDetailLevel(json: HexLevelJson): HexDetailLevel {
    const res = json.res as DetailRes;
    const patchRes = patchResFor(res);
    const compact = new Map<string, string>();
    const patches = new Map<string, [string, string][]>();
    const add = (key: string, cell: string, code: string) => {
        let list = patches.get(key);
        if (!list) {
            list = [];
            patches.set(key, list);
        }
        list.push([cell, code]);
    };
    for (const code of Object.keys(json.countries)) {
        for (const cell of json.countries[code]) {
            compact.set(cell, code);
            const r = getResolution(cell);
            if (r < patchRes) {
                // Coarser than a patch: each child is a whole patch of this country.
                for (const child of cellToChildren(cell, patchRes)) add(child, child, code);
            } else {
                add(r === patchRes ? cell : cellToParent(cell, patchRes), cell, code);
            }
        }
    }
    return { res, compact, patches };
}

async function fetchLevelBin(res: DetailRes): Promise<ArrayBuffer | null> {
    try {
        const response = await fetch(`/data/hex-map-v2-r${res}.bin`);
        if (response.ok) return await response.arrayBuffer();
    } catch {
        // Fall back to JSON.
    }
    return null;
}

async function fetchLevel(res: DetailRes): Promise<HexLevelJson> {
    const response = await fetch(`/data/hex-map-v2-r${res}.json`);
    if (!response.ok) throw new Error(`Hex map level ${res} unavailable`);
    const json = (await response.json()) as HexLevelJson;
    if (json.res !== res || typeof json.countries !== 'object') throw new Error(`Invalid hex map level ${res}`);
    return json;
}

function cached<T>(
    cache: Map<DetailRes, Promise<T>>,
    res: DetailRes,
    fromBin: (buf: ArrayBuffer) => T,
    fromJson: (json: HexLevelJson) => T,
): Promise<T> {
    let promise = cache.get(res);
    if (!promise) {
        promise = (async () => {
            const bin = await fetchLevelBin(res);
            if (bin) return fromBin(bin);
            return fromJson(await fetchLevel(res));
        })().catch((error) => {
            cache.delete(res);
            throw error;
        });
        cache.set(res, promise);
    }
    return promise;
}

const levelPromises = new Map<DetailRes, Promise<HexDetailLevel>>();
const lookupPromises = new Map<DetailRes, Promise<HexDetailLookup>>();

/** The whole level, patches and all: for the worker. */
export function loadDetailLevel(res: DetailRes): Promise<HexDetailLevel> {
    return cached(levelPromises, res, decodeDetailLevelBin, buildDetailLevel);
}

/** Only the country lookup: for the page, where cutting the level into patches would stall a frame. */
export function loadDetailLookup(res: DetailRes): Promise<HexDetailLookup> {
    return cached(lookupPromises, res, decodeDetailLookupBin, buildDetailLookup);
}

/** The country a cell of this level belongs to, or undefined at sea. */
export function codeOf(level: HexDetailLookup, cell: string): string | undefined {
    const res = getResolution(cell);
    for (let r = res; r >= 0; r--) {
        const code = level.compact.get(r === res ? cell : cellToParent(cell, r));
        if (code !== undefined) return code;
    }
    return undefined;
}

/** How far a cell must wait into the morph, as `hideBelow`, from its corners in degrees. */
function hideFor(projection: MapProjection, corners: number[][]): number {
    let minLon = Infinity;
    let maxLon = -Infinity;
    const sinMin = Math.sin(projection.minLat);
    const sinMax = Math.sin(projection.maxLat);
    let beyond = false;
    for (const [lat, lon] of corners) {
        if (lon < minLon) minLon = lon;
        if (lon > maxLon) maxLon = lon;
        const s = Math.sin((lat * Math.PI) / 180);
        if (s < sinMin || s > sinMax) beyond = true;
    }
    if (beyond) return HIDE_BEYOND_CUT;
    return maxLon - minLon > 180 ? HIDE_ACROSS_ANTIMERIDIAN : 0;
}

/** As `hideFor`, for a single cell. */
export function cellHideBelow(projection: MapProjection, cell: string): number {
    return hideFor(projection, cellToBoundary(cell));
}

/**
 * Every land cell of one patch, as GPU-ready arrays in `projection`, with its
 * coastlines and borders. A border with a cell in the next patch is drawn
 * from both sides, which the renderer's MAX blending makes one line.
 */
export function buildPatch(level: HexDetailLevel, key: string, projection: MapProjection): HexPatch {
    const res = level.res;
    const h3: string[] = [];
    const codes: string[] = [];
    for (const [cell, code] of level.patches.get(key) ?? []) {
        const r = getResolution(cell);
        if (r === res) {
            h3.push(cell);
            codes.push(code);
        } else {
            for (const child of cellToChildren(cell, res)) {
                h3.push(child);
                codes.push(code);
            }
        }
    }
    const count = h3.length;
    const boundaries = h3.map((cell) => cellToBoundary(cell));
    let corners = 0;
    for (const b of boundaries) corners += b.length;
    const centre3 = new Float32Array(count * 3);
    const centre2 = new Float32Array(count * 2);
    const cornerStart = new Uint32Array(count + 1);
    const corner3 = new Float32Array(corners * 3);
    const corner2 = new Float32Array(corners * 2);
    const hide = new Float32Array(count);
    let k = 0;
    for (let i = 0; i < count; i++) {
        const [lat, lon] = cellToLatLng(h3[i]);
        const c = degToUnit(lat, lon);
        centre3[i * 3] = c.unit.ux;
        centre3[i * 3 + 1] = c.unit.uy;
        centre3[i * 3 + 2] = c.unit.uz;
        const f = projection.project(c.lon, c.lat);
        centre2[i * 2] = f.nx;
        centre2[i * 2 + 1] = f.ny;
        hide[i] = hideFor(projection, boundaries[i]);
        cornerStart[i] = k;
        for (const [vLat, vLon] of boundaries[i]) {
            const v = degToUnit(vLat, vLon);
            corner3[k * 3] = v.unit.ux;
            corner3[k * 3 + 1] = v.unit.uy;
            corner3[k * 3 + 2] = v.unit.uz;
            const vf = projection.project(v.lon, v.lat);
            corner2[k * 2] = vf.nx;
            corner2[k * 2 + 1] = vf.ny;
            k++;
        }
    }
    cornerStart[count] = k;

    const b3: number[] = [];
    const b2: number[] = [];
    const bHide: number[] = [];
    const borderCountries: number[] = [];
    const prebaked = level.prebakedEdges?.get(key);
    if (prebaked) {
        for (let e = 0; e < prebaked.length; e += 4) {
            const edge = splitLongToHex(prebaked[e], prebaked[e + 1]);
            const pts = directedEdgeToBoundary(edge);
            if (pts.length < 2) continue;
            const cellsWord = prebaked[e + 2];
            const cellIdx = cellsWord & 0xffff;
            const localNb = (cellsWord >>> 16) & 0xffff;
            const countriesWord = prebaked[e + 3];
            const c1 = countriesWord & 0xffff;
            const c2 = (countriesWord >>> 16) & 0xffff;
            const a = degToUnit(pts[0][0], pts[0][1]);
            const b = degToUnit(pts[pts.length - 1][0], pts[pts.length - 1][1]);
            const fa = projection.project(a.lon, a.lat);
            const fb = projection.project(b.lon, b.lat);
            b3.push(a.unit.ux, a.unit.uy, a.unit.uz, b.unit.ux, b.unit.uy, b.unit.uz);
            b2.push(fa.nx, fa.ny, fb.nx, fb.ny);
            borderCountries.push(c1, c2);
            bHide.push(Math.max(hide[cellIdx] ?? 0, localNb !== 0xffff ? (hide[localNb] ?? 0) : 0, hideFor(projection, pts)));
        }
    } else {
        const indexByH3 = new Map<string, number>();
        h3.forEach((cell, i) => indexByH3.set(cell, i));
        for (let i = 0; i < count; i++) {
            const cell = h3[i];
            const code = codes[i];
            for (const nb of gridDisk(cell, 1)) {
                if (nb === cell) continue;
                const local = indexByH3.get(nb);
                const nbCode = local !== undefined ? codes[local] : codeOf(level, nb);
                if (nbCode === code) continue;
                // Two cells of this patch share the edge: draw it once.
                if (local !== undefined && nb < cell) continue;
                try {
                    const pts = directedEdgeToBoundary(cellsToDirectedEdge(cell, nb));
                    if (pts.length < 2) continue;
                    const a = degToUnit(pts[0][0], pts[0][1]);
                    const b = degToUnit(pts[pts.length - 1][0], pts[pts.length - 1][1]);
                    const fa = projection.project(a.lon, a.lat);
                    const fb = projection.project(b.lon, b.lat);
                    b3.push(a.unit.ux, a.unit.uy, a.unit.uz, b.unit.ux, b.unit.uy, b.unit.uz);
                    b2.push(fa.nx, fa.ny, fb.nx, fb.ny);
                    borderCountries.push(countryStyleIndex(code), countryStyleIndex(nbCode));
                    bHide.push(Math.max(hide[i], local !== undefined ? hide[local] : 0, hideFor(projection, pts)));
                } catch {
                    // Not neighbours after all (a pentagon's missing edge).
                }
            }
        }
    }

    return {
        key,
        res,
        projection: projection.id,
        h3,
        codes,
        data: {
            count,
            centre3,
            centre2,
            cornerStart,
            corner3,
            corner2,
            hide,
            borderCount: bHide.length,
            border3: new Float32Array(b3),
            border2: new Float32Array(b2),
            borderHide: new Float32Array(bHide),
            borderCountries: new Uint16Array(borderCountries),
        },
    };
}

/**
 * The cell for a city at this level: the one under it if it is the city's
 * country's, or else the nearest of that country's within a few rings (a
 * coastal city whose own cell is mostly sea).
 */
export function resolveDetailCityHex(
    latDeg: number,
    lonDeg: number,
    level: HexDetailLookup,
    countryCode?: string,
): string | null {
    const exact = latLngToCell(latDeg, lonDeg, level.res);
    const exactCode = codeOf(level, exact);
    if (!countryCode) return exactCode ? exact : null;
    if (exactCode === countryCode) return exact;
    const target = degToUnit(latDeg, lonDeg).unit;
    for (let ring = 1; ring <= 4; ring++) {
        let best: string | null = null;
        let bestDot = -Infinity;
        for (const cell of gridDisk(exact, ring)) {
            if (codeOf(level, cell) !== countryCode) continue;
            const [lat, lon] = cellToLatLng(cell);
            const u = degToUnit(lat, lon).unit;
            const dot = u.ux * target.ux + u.uy * target.uy + u.uz * target.uz;
            if (dot > bestDot) {
                bestDot = dot;
                best = cell;
            }
        }
        if (best) return best;
    }
    return null;
}

/** As `hexAtPoint`, for a detail level: the land cell under a point, or the nearest within `ring`. */
export function detailHexAtPoint(
    latDeg: number,
    lonDeg: number,
    level: HexDetailLookup,
    ring: number,
    drawn: (cell: string) => boolean,
): string | null {
    const exact = latLngToCell(latDeg, lonDeg, level.res);
    if (codeOf(level, exact) !== undefined && drawn(exact)) return exact;
    if (ring <= 0) return null;
    const target = degToUnit(latDeg, lonDeg).unit;
    let best: string | null = null;
    let bestDot = -Infinity;
    for (const cell of gridDisk(exact, ring)) {
        if (codeOf(level, cell) === undefined || !drawn(cell)) continue;
        const [lat, lon] = cellToLatLng(cell);
        const u = degToUnit(lat, lon).unit;
        const dot = u.ux * target.ux + u.uy * target.uy + u.uz * target.uz;
        if (dot > bestDot) {
            bestDot = dot;
            best = cell;
        }
    }
    return best;
}

/** One cell of any level in the shape the base level's cells have, for the selection outline. */
export function hexCellOf(cell: string, projection: MapProjection, code = ''): HexCell {
    const [lat, lon] = cellToLatLng(cell);
    const centre = degToUnit(lat, lon);
    const boundary = cellToBoundary(cell);
    const corners = boundary.map(([vLat, vLon]) => degToUnit(vLat, vLon));
    let minLon = Infinity;
    let maxLon = -Infinity;
    for (const c of corners) {
        minLon = Math.min(minLon, c.lon);
        maxLon = Math.max(maxLon, c.lon);
    }
    return {
        index: -1,
        h3Index: cell,
        code,
        lat: centre.lat,
        lon: centre.lon,
        center3d: centre.unit,
        center2d: projection.project(centre.lon, centre.lat),
        verts3d: corners.map((c) => c.unit),
        verts2d: corners.map((c) => projection.project(c.lon, c.lat)),
        crossesAntimeridian: maxLon - minLon > Math.PI,
        hideBelow: hideFor(projection, boundary),
    };
}
