#!/usr/bin/env node
/**
 * Builds the Travel map's hex levels from Natural Earth's 1:50m countries.
 *
 *   node scripts/generate-hex-map.mjs
 *
 * Writes public/data/hex-map-v2-r{3,4,5}.json: for each level, every
 * country's land cells, compacted (a parent stands for all seven of its
 * children where they all belong to that country). The site expands them
 * with the same h3-js it draws with, so the cells match exactly.
 *
 * Also writes public/data/hex-regions-v2-r{3,4,5}.json: for each land cell, the
 * state or province of its own country that covers most of it (Natural
 * Earth's 1:10m admin-1 areas), and the largest town inside it (GeoNames'
 * places of 1,000 people or more, CC BY 4.0, credited on the map). The Travel
 * map's city view names these on hover. GeoNames is not fetched for you:
 * download https://download.geonames.org/export/dump/cities1000.zip and
 * unzip it into .cache/geonames/.
 *
 * A cell belongs to the country that covers most of it, judged by the
 * resolution-6 cells inside it (343 to a level-3 cell, 49 to a level-4 one,
 * 7 to a level-5 one), and only if at least half of it is land. Testing the
 * centre point alone, as the first version did, broke anything narrower than
 * a cell into pieces (Vietnam's 26 cells came out in four) and let a coast
 * turn on whichever side of it the centre happened to fall.
 */

import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const h3 = require('h3-js');

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_URL =
    'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson';
const CACHE = resolve(ROOT, '.cache/ne_50m_admin_0_countries.geojson');
const NE_RAW = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson';

const LEVELS = [3, 4, 5, 6];
const patchResFor = (res) => (res >= 6 ? 2 : 1);
/** The resolution coverage is measured at. */
const SAMPLE_RES = 6;
/** A cell is land when at least this share of it is. */
const LAND_SHARE = 0.5;

function countryStyleIndex(code) {
    if (!code || !/^[A-Z]{2}$/.test(code)) return 0;
    return (code.charCodeAt(0) - 65) * 26 + code.charCodeAt(1) - 64;
}

function align4(bytes) {
    return (bytes + 3) & ~3;
}

/**
 * Pre-bakes public/data/hex-map-v2-r3.bin (full base-tier cell & border geometry
 * in radians so the browser does zero H3 WASM calls on startup) and
 * public/data/hex-map-v2-r{4,5}.bin (compacted cells pre-grouped by patch plus
 * pre-computed directed border edges so detail workers do zero gridDisk or
 * codeOf searches at runtime).
 */
function writeBinaryLevels() {
    const t0 = Date.now();
    // --- Base tier (res 3) ---
    const json3 = JSON.parse(readFileSync(resolve(ROOT, 'public/data/hex-map-v2-r3.json'), 'utf8'));
    const rawCells3 = [];
    for (const code of Object.keys(json3.countries).sort()) {
        for (const cell of h3.uncompactCells(json3.countries[code], 3).sort()) {
            rawCells3.push([cell, code]);
        }
    }
    const cellCount3 = rawCells3.length;
    const cellCodes3 = new Map(rawCells3);
    const cellIndexByH3 = new Map(rawCells3.map(([c], i) => [c, i]));
    const boundaries3 = rawCells3.map(([c]) => h3.cellToBoundary(c));
    const cornerCount3 = boundaries3.reduce((n, b) => n + b.length, 0);

    const seenPairs = new Set();
    const borders3 = [];
    for (let i = 0; i < cellCount3; i++) {
        const [cell, code] = rawCells3[i];
        for (const nb of h3.gridDisk(cell, 1)) {
            if (nb === cell) continue;
            const nbCode = cellCodes3.get(nb);
            if (nbCode === code) continue;
            const pairKey = cell < nb ? `${cell}|${nb}` : `${nb}|${cell}`;
            if (seenPairs.has(pairKey)) continue;
            seenPairs.add(pairKey);
            try {
                const pts = h3.directedEdgeToBoundary(h3.cellsToDirectedEdge(cell, nb));
                if (pts.length < 2) continue;
                const aLat = (pts[0][0] * Math.PI) / 180;
                const aLon = (pts[0][1] * Math.PI) / 180;
                const bLat = (pts[pts.length - 1][0] * Math.PI) / 180;
                const bLon = (pts[pts.length - 1][1] * Math.PI) / 180;
                const crosses = Math.abs(aLon - bLon) > Math.PI;
                borders3.push({
                    from: i | (crosses ? 0x8000 : 0),
                    c1: countryStyleIndex(code),
                    c2: countryStyleIndex(nbCode),
                    aLat, aLon, bLat, bLon,
                });
            } catch {
                // Skip invalid pentagon edge pairs.
            }
        }
    }
    const borderCount3 = borders3.length;

    const offH3 = 16;
    const offCountry = offH3 + cellCount3 * 8;
    const offMeta = offCountry + cellCount3 * 2;
    const offCellLatLon = align4(offMeta + cellCount3);
    const offCornerLatLon = offCellLatLon + cellCount3 * 8;
    const offBorderFrom = offCornerLatLon + cornerCount3 * 8;
    const offBorderCountries = align4(offBorderFrom + borderCount3 * 2);
    const offBorderLatLon = offBorderCountries + borderCount3 * 4;
    const totalBytes3 = offBorderLatLon + borderCount3 * 16;

    const buf3 = new ArrayBuffer(totalBytes3);
    const header3 = new Uint32Array(buf3, 0, 4);
    header3[0] = 0x33584548; // "HEX3"
    header3[1] = cellCount3;
    header3[2] = cornerCount3;
    header3[3] = borderCount3;

    const cellH3_3 = new Uint32Array(buf3, offH3, cellCount3 * 2);
    const cellCountry3 = new Uint16Array(buf3, offCountry, cellCount3);
    const cellMeta3 = new Uint8Array(buf3, offMeta, cellCount3);
    const cellLatLon3 = new Float32Array(buf3, offCellLatLon, cellCount3 * 2);
    const cornerLatLon3 = new Float32Array(buf3, offCornerLatLon, cornerCount3 * 2);
    const borderFrom3 = new Uint16Array(buf3, offBorderFrom, borderCount3);
    const borderCountries3 = new Uint16Array(buf3, offBorderCountries, borderCount3 * 2);
    const borderLatLon3 = new Float32Array(buf3, offBorderLatLon, borderCount3 * 4);

    let cornerCursor = 0;
    for (let i = 0; i < cellCount3; i++) {
        const [cell, code] = rawCells3[i];
        const [lo, hi] = h3.h3IndexToSplitLong(cell);
        cellH3_3[i * 2] = lo;
        cellH3_3[i * 2 + 1] = hi;
        cellCountry3[i] = countryStyleIndex(code);
        const [clat, clon] = h3.cellToLatLng(cell);
        cellLatLon3[i * 2] = (clat * Math.PI) / 180;
        cellLatLon3[i * 2 + 1] = (clon * Math.PI) / 180;
        const boundary = boundaries3[i];
        let minLon = Infinity;
        let maxLon = -Infinity;
        for (const [vLat, vLon] of boundary) {
            const rLat = (vLat * Math.PI) / 180;
            const rLon = (vLon * Math.PI) / 180;
            if (rLon < minLon) minLon = rLon;
            if (rLon > maxLon) maxLon = rLon;
            cornerLatLon3[cornerCursor * 2] = rLat;
            cornerLatLon3[cornerCursor * 2 + 1] = rLon;
            cornerCursor++;
        }
        const crosses = maxLon - minLon > Math.PI;
        cellMeta3[i] = (crosses ? 0x80 : 0) | boundary.length;
    }
    for (let i = 0; i < borderCount3; i++) {
        const b = borders3[i];
        borderFrom3[i] = b.from;
        borderCountries3[i * 2] = b.c1;
        borderCountries3[i * 2 + 1] = b.c2;
        borderLatLon3[i * 4] = b.aLat;
        borderLatLon3[i * 4 + 1] = b.aLon;
        borderLatLon3[i * 4 + 2] = b.bLat;
        borderLatLon3[i * 4 + 3] = b.bLon;
    }
    const path3 = resolve(ROOT, 'public/data/hex-map-v2-r3.bin');
    writeFileSync(path3, Buffer.from(buf3));
    console.log(`binary res 3: ${cellCount3.toLocaleString()} cells, ${borderCount3.toLocaleString()} borders, ${Math.round(totalBytes3 / 1024)} KB`);

    // --- Detail tiers (res 4, 5, 6) ---
    for (const res of [4, 5, 6]) {
        const patchRes = patchResFor(res);
        const json = JSON.parse(readFileSync(resolve(ROOT, `public/data/hex-map-v2-r${res}.json`), 'utf8'));
        const patches = new Map();
        const compactCountryByCell = new Map();
        const full = new Map();
        for (const code of Object.keys(json.countries).sort()) {
            const cIdx = countryStyleIndex(code);
            for (const cell of json.countries[code]) {
                compactCountryByCell.set(cell, cIdx);
                const r = h3.getResolution(cell);
                const add = (pKey, c) => {
                    let list = patches.get(pKey);
                    if (!list) {
                        list = [];
                        patches.set(pKey, list);
                    }
                    list.push([c, cIdx]);
                };
                if (r < patchRes) {
                    for (const child of h3.cellToChildren(cell, patchRes)) add(child, child);
                } else {
                    add(r === patchRes ? cell : h3.cellToParent(cell, patchRes), cell);
                }
            }
            for (const c of h3.uncompactCells(json.countries[code], res)) {
                full.set(c, cIdx);
            }
        }

        const isWhollyOwnedAtRes = (cell, r, targetCountry) => {
            for (let k = r; k >= 0; k--) {
                const owner = compactCountryByCell.get(k === r ? cell : h3.cellToParent(cell, k));
                if (owner !== undefined) return owner === targetCountry;
            }
            return false;
        };

        const patchKeys = [...patches.keys()].sort();
        const patchCount = patchKeys.length;
        const patchStart = new Uint32Array(patchCount + 1);
        const edgeStart = new Uint32Array(patchCount + 1);
        const compactList = [];
        const edgeList = [];

        for (let p = 0; p < patchCount; p++) {
            const pKey = patchKeys[p];
            const entries = patches.get(pKey);
            patchStart[p] = compactList.length;
            edgeStart[p] = edgeList.length;

            const h3Cells = [];
            const cIndices = [];
            const checkBorders = [];
            for (const [cell, cIdx] of entries) {
                compactList.push([cell, cIdx]);
                const r = h3.getResolution(cell);
                if (r === res) {
                    h3Cells.push(cell);
                    cIndices.push(cIdx);
                    checkBorders.push(true);
                } else {
                    const ring = h3.gridDisk(cell, 1);
                    const strictlyInterior = ring.every((nb) => nb === cell || isWhollyOwnedAtRes(nb, r, cIdx));
                    for (const ch of h3.cellToChildren(cell, res)) {
                        h3Cells.push(ch);
                        cIndices.push(cIdx);
                        checkBorders.push(!strictlyInterior);
                    }
                }
            }

            const indexByH3 = new Map();
            h3Cells.forEach((c, i) => indexByH3.set(c, i));

            for (let i = 0; i < h3Cells.length; i++) {
                if (!checkBorders[i]) continue;
                const cell = h3Cells[i];
                const cIdx = cIndices[i];
                for (const nb of h3.gridDisk(cell, 1)) {
                    if (nb === cell) continue;
                    const local = indexByH3.get(nb);
                    const nbIdx = local !== undefined ? cIndices[local] : (full.get(nb) ?? 0);
                    if (nbIdx === cIdx) continue;
                    if (local !== undefined && nb < cell) continue;
                    try {
                        const edge = h3.cellsToDirectedEdge(cell, nb);
                        const [eLo, eHi] = h3.h3IndexToSplitLong(edge);
                        edgeList.push({
                            eLo,
                            eHi,
                            cells: (i & 0xFFFF) | (((local ?? 0xFFFF) & 0xFFFF) << 16),
                            countries: (cIdx & 0xFFFF) | ((nbIdx & 0xFFFF) << 16),
                        });
                    } catch {
                        // Pentagon missing edge.
                    }
                }
            }
        }
        patchStart[patchCount] = compactList.length;
        edgeStart[patchCount] = edgeList.length;

        const compactCount = compactList.length;
        const edgeCount = edgeList.length;

        const offPatchH3 = 20;
        const offPatchStart = offPatchH3 + patchCount * 8;
        const offEdgeStart = offPatchStart + (patchCount + 1) * 4;
        const offCompactH3 = offEdgeStart + (patchCount + 1) * 4;
        const offCompactCountry = offCompactH3 + compactCount * 8;
        const offEdges = align4(offCompactCountry + compactCount * 2);
        const totalBytes = offEdges + edgeCount * 16;

        const buf = new ArrayBuffer(totalBytes);
        const header = new Uint32Array(buf, 0, 5);
        header[0] = 0x44584548; // "HEXD"
        header[1] = res;
        header[2] = patchCount;
        header[3] = compactCount;
        header[4] = edgeCount;

        const patchH3Arr = new Uint32Array(buf, offPatchH3, patchCount * 2);
        const patchStartArr = new Uint32Array(buf, offPatchStart, patchCount + 1);
        const edgeStartArr = new Uint32Array(buf, offEdgeStart, patchCount + 1);
        const compactH3Arr = new Uint32Array(buf, offCompactH3, compactCount * 2);
        const compactCountryArr = new Uint16Array(buf, offCompactCountry, compactCount);
        const edgesArr = new Uint32Array(buf, offEdges, edgeCount * 4);

        patchStartArr.set(patchStart);
        edgeStartArr.set(edgeStart);

        for (let p = 0; p < patchCount; p++) {
            const [lo, hi] = h3.h3IndexToSplitLong(patchKeys[p]);
            patchH3Arr[p * 2] = lo;
            patchH3Arr[p * 2 + 1] = hi;
        }
        for (let i = 0; i < compactCount; i++) {
            const [cell, cIdx] = compactList[i];
            const [lo, hi] = h3.h3IndexToSplitLong(cell);
            compactH3Arr[i * 2] = lo;
            compactH3Arr[i * 2 + 1] = hi;
            compactCountryArr[i] = cIdx;
        }
        for (let i = 0; i < edgeCount; i++) {
            const e = edgeList[i];
            edgesArr[i * 4] = e.eLo;
            edgesArr[i * 4 + 1] = e.eHi;
            edgesArr[i * 4 + 2] = e.cells >>> 0;
            edgesArr[i * 4 + 3] = e.countries >>> 0;
        }

        const path = resolve(ROOT, `public/data/hex-map-v2-r${res}.bin`);
        writeFileSync(path, Buffer.from(buf));
        console.log(
            `binary res ${res}: ${patchCount} patches, ${compactCount.toLocaleString()} compacted cells, ` +
                `${edgeCount.toLocaleString()} pre-baked border edges, ${Math.round(totalBytes / 1024)} KB`,
        );
    }
    console.log(`Built binary levels in ${((Date.now() - t0) / 1000).toFixed(2)}s`);
}

/** Countries smaller than any cell, placed by hand so they still appear. */
const MICROSTATES = [
    [41.9029, 12.4534, 'VA'], [43.7384, 7.4246, 'MC'], [43.9424, 12.4578, 'SM'],
    [47.166, 9.5554, 'LI'], [42.5063, 1.5218, 'AD'], [49.8153, 6.1296, 'LU'],
    [35.9375, 14.3754, 'MT'], [3.2028, 73.2207, 'MV'], [26.0667, 50.5577, 'BH'],
    [1.3521, 103.8198, 'SG'], [4.5353, 114.7277, 'BN'], [-0.5228, 166.9315, 'NR'],
    [-7.1095, 177.6493, 'TV'], [7.515, 134.5825, 'PW'], [7.1315, 171.1845, 'MH'],
    [6.8874, 158.215, 'FM'], [1.8709, -157.3627, 'KI'], [-21.179, -175.1982, 'TO'],
    [-13.759, -172.1046, 'WS'], [-15.3767, 166.9592, 'VU'], [-11.6455, 43.3333, 'KM'],
    [0.1864, 6.6131, 'ST'], [16.5388, -23.0418, 'CV'], [-4.6796, 55.492, 'SC'],
    [-20.3484, 57.5522, 'MU'], [10.6918, -61.2225, 'TT'], [13.1939, -59.5432, 'BB'],
    [13.9094, -60.9789, 'LC'], [12.1165, -61.679, 'GD'], [13.2528, -61.1971, 'VC'],
    [17.0608, -61.7964, 'AG'], [17.3578, -62.783, 'KN'], [15.415, -61.371, 'DM'],
    [25.0343, -77.3963, 'BS'], [25.3548, 51.1839, 'QA'], [29.3117, 47.4818, 'KW'],
    [-8.8742, 125.7275, 'TL'],
];

async function loadCountries() {
    let text;
    if (existsSync(CACHE)) {
        text = readFileSync(CACHE, 'utf8');
    } else {
        console.log('Fetching Natural Earth 1:50m countries...');
        const response = await fetch(SOURCE_URL);
        if (!response.ok) throw new Error(`Natural Earth fetch failed: ${response.status}`);
        text = await response.text();
        mkdirSync(dirname(CACHE), { recursive: true });
        writeFileSync(CACHE, text);
    }
    const features = JSON.parse(text).features;
    const countries = [];
    for (const feature of features) {
        const p = feature.properties ?? {};
        let iso = String(p.ISO_A2_EH ?? p.iso_a2_eh ?? p.ISO_A2 ?? p.iso_a2 ?? '').trim().toUpperCase();
        if (!/^[A-Z]{2}$/.test(iso)) iso = String(p.ADM0_ISO ?? '').slice(0, 2).toUpperCase();
        // Unassigned land (Siachen Glacier, -99) is left off rather than shown under a made-up code.
        if (/^[A-Z]{2}$/.test(iso)) countries.push([iso, feature.geometry]);
        else console.log(`  left off: ${p.ADMIN ?? p.NAME ?? 'unnamed'} (${iso || 'no code'})`);
    }
    return countries;
}

function polygonsOf(geometry) {
    if (geometry.type === 'Polygon') return [geometry.coordinates];
    if (geometry.type === 'MultiPolygon') return geometry.coordinates;
    return [];
}

/** Natural Earth files some overseas territories under their sovereign. */
function polygonIso(iso, outer) {
    const lat = outer.reduce((s, p) => s + p[1], 0) / outer.length;
    const lng = outer.reduce((s, p) => s + p[0], 0) / outer.length;
    if (iso === 'FR') {
        if (lat >= -15 && lat <= -11 && lng >= 43 && lng <= 47) return 'YT';
        if (lat >= -23 && lat <= -19 && lng >= 53 && lng <= 58) return 'RE';
        if (lat >= 1 && lat <= 7 && lng >= -56 && lng <= -50) return 'GF';
        if (lat >= 13.8 && lat <= 15.2 && lng >= -62 && lng <= -60) return 'MQ';
        if (lat >= 15.5 && lat <= 17 && lng >= -63 && lng <= -60.5) return 'GP';
    } else if (iso === 'NO' && lat > 73) {
        return 'SJ';
    } else if (iso === 'NL' && lat < 30) {
        return 'BQ';
    }
    return iso;
}

/** Area-weighted centre of a ring, in degrees; good enough for an islet. */
function ringCentre(ring) {
    let a = 0;
    let x = 0;
    let y = 0;
    for (let i = 0; i < ring.length - 1; i++) {
        const [x0, y0] = ring[i];
        const [x1, y1] = ring[i + 1];
        const f = x0 * y1 - x1 * y0;
        a += f;
        x += (x0 + x1) * f;
        y += (y0 + y1) * f;
    }
    if (Math.abs(a) < 1e-12) return [ring[0][1], ring[0][0]];
    return [y / (3 * a), x / (3 * a)];
}

/** One ring clipped to the longitudes [west, east] (Sutherland-Hodgman, in plain lon/lat). */
function clipRing(ring, west, east) {
    const clip = (points, inside, cross) => {
        const out = [];
        for (let i = 0; i < points.length; i++) {
            const a = points[i];
            const b = points[(i + 1) % points.length];
            if (inside(a)) {
                out.push(a);
                if (!inside(b)) out.push(cross(a, b));
            } else if (inside(b)) {
                out.push(cross(a, b));
            }
        }
        return out;
    };
    const at = (x) => (a, b) => [x, a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0])];
    const open = ring.slice(0, -1);
    const clipped = clip(clip(open, (p) => p[0] >= west, at(west)), (p) => p[0] <= east, at(east));
    return clipped.length >= 3 ? [...clipped, clipped[0]] : [];
}

/**
 * The resolution-6 cells inside a polygon. h3 rejects a polygon that runs the
 * whole way round along a pole -- Natural Earth's Antarctica does, along
 * -90 from +180 to -180 -- so one it rejects is cut into 30-degree slices
 * held just off the pole, each of which it takes.
 */
function sampleCells(rings, code) {
    try {
        return h3.polygonToCells(rings, SAMPLE_RES, true);
    } catch {
        // Sliced, below.
    }
    const offPole = rings.map((ring) => ring.map(([x, y]) => [x, Math.max(-89.999, Math.min(89.999, y))]));
    const cells = new Set();
    for (let west = -180; west < 180; west += 30) {
        const slice = offPole.map((ring) => clipRing(ring, west, west + 30)).filter((ring, i) => i > 0 ? ring.length >= 4 : true);
        if (slice[0].length < 4) continue;
        let part;
        try {
            part = h3.polygonToCells(slice, SAMPLE_RES, true);
        } catch (error) {
            throw new Error(`Could not sample ${code} between ${west} and ${west + 30} degrees: ${error.message}`);
        }
        for (const cell of part) cells.add(cell);
    }
    console.log(`  ${code}: sampled in slices (${cells.size.toLocaleString()} cells)`);
    return [...cells];
}

/** Feature codes for places that are gone or were never towns: historical, abandoned, destroyed. */
const NOT_TOWNS = new Set(['PPLH', 'PPLQ', 'PPLW', 'PPLCH']);

/** GeoNames' cities1000: every place of 1,000 people or more, ~170,000 of them. */
function loadGeoNames() {
    const path = resolve(ROOT, '.cache/geonames/cities1000.txt');
    if (!existsSync(path)) {
        throw new Error('Missing .cache/geonames/cities1000.txt: download and unzip https://download.geonames.org/export/dump/cities1000.zip there.');
    }
    const places = [];
    for (const line of readFileSync(path, 'utf8').split('\n')) {
        const f = line.split('\t');
        if (f.length < 15 || NOT_TOWNS.has(f[7])) continue;
        const lat = Number(f[4]);
        const lon = Number(f[5]);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
        places.push({ name: f[1], lat, lon, pop: Number(f[14]) || 0, cc: f[8] });
    }
    return places;
}

/** A Natural Earth layer, fetched once into .cache/. */
async function naturalEarth(name) {
    const path = resolve(ROOT, `.cache/${name}.geojson`);
    if (!existsSync(path)) {
        console.log(`Fetching ${name}...`);
        const response = await fetch(`${NE_RAW}/${name}.geojson`);
        if (!response.ok) throw new Error(`${name} fetch failed: ${response.status}`);
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(path, await response.text());
    }
    return JSON.parse(readFileSync(path, 'utf8'));
}

/**
 * Each land cell's state or province and largest town. The region is the one
 * of the cell's own country that covers most of it, so a cell on a border
 * never names a region across it.
 */
async function writeRegions(assignedByRes) {
    const t0 = Date.now();
    const admin1 = await naturalEarth('ne_10m_admin_1_states_provinces');
    const places = loadGeoNames();
    const regions = [];
    const tallies = new Map(LEVELS.map((res) => [res, new Map()]));
    // The sample cell each town's point falls in, so its own state can be read
    // off the same sampling: Natural Earth's `adm1name` spells states
    // differently from the admin-1 layer, and some of its names are garbled.
    const townAt = new Map();
    for (const place of places) {
        place.sample = h3.latLngToCell(place.lat, place.lon, SAMPLE_RES);
        townAt.set(place.sample, null);
    }
    for (const feature of admin1.features) {
        const p = feature.properties ?? {};
        const iso = String(p.iso_a2 ?? '');
        const name = String(p.name_en ?? p.name ?? '').trim();
        if (!/^[A-Z]{2}$/.test(iso) || !name) continue;
        const index = regions.push([name, iso]) - 1;
        for (const rings of polygonsOf(feature.geometry)) {
            if (!rings[0] || rings[0].length < 4) continue;
            let samples;
            try {
                samples = sampleCells(rings, `${iso} ${name}`);
            } catch (error) {
                console.warn(`  skipped part of ${name}, ${iso}: ${error.message}`);
                continue;
            }
            for (const sample of samples) {
                for (const res of LEVELS) {
                    increment(tallies.get(res), res === SAMPLE_RES ? sample : h3.cellToParent(sample, res), index);
                }
                if (townAt.has(sample)) townAt.set(sample, index);
            }
        }
    }
    console.log(`Sampled ${regions.length} regions in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

    for (const res of LEVELS) {
        const assigned = assignedByRes.get(res);
        const byRegion = new Map();
        for (const [cell, code] of assigned) {
            const counts = tallies.get(res).get(cell);
            if (!counts) continue;
            let best = -1;
            let bestCount = 0;
            for (const [index, count] of counts) {
                if (regions[index][1] === code && count > bestCount) {
                    best = index;
                    bestCount = count;
                }
            }
            if (best < 0) continue;
            if (!byRegion.has(best)) byRegion.set(best, []);
            byRegion.get(best).push(cell);
        }

        // The largest town in each land cell, named with its own state -- the
        // hex's may be the one next door -- and only a town of the hex's own
        // country: a border hex never names a town across the border.
        const best = new Map();
        for (const place of places) {
            const cell = h3.latLngToCell(place.lat, place.lon, res);
            const country = assigned.get(cell);
            if (!country) continue;
            const region = townAt.get(place.sample);
            const iso = region == null ? place.cc : regions[region][1];
            if (iso !== country) continue;
            const kept = best.get(cell);
            if (!kept || place.pop > kept.place.pop) best.set(cell, { place, region });
        }

        // Ordinal, so a rerun on another machine writes the same file.
        const used = [...byRegion.keys()].sort((a, b) => (regions[a][0] < regions[b][0] ? -1 : regions[a][0] > regions[b][0] ? 1 : a - b));
        const position = new Map(used.map((region, i) => [region, i]));
        // A town's state as an index into `regions`, -1 where its point fell
        // outside every state: the names would otherwise repeat ~100,000 times.
        const towns = {};
        for (const cell of [...best.keys()].sort()) {
            const { place, region } = best.get(cell);
            towns[cell] = [place.name, region == null ? -1 : (position.get(region) ?? -1)];
        }
        const out = {
            res,
            regions: used.map((i) => regions[i]),
            cells: used.map((i) => h3.compactCells(byRegion.get(i)).sort()),
            towns,
        };
        const path = resolve(ROOT, `public/data/hex-regions-v2-r${res}.json`);
        writeFileSync(path, JSON.stringify(out));
        const named = [...byRegion.values()].reduce((n, cells) => n + cells.length, 0);
        console.log(
            `regions res ${res}: ${used.length} regions over ${named.toLocaleString()} of ${assigned.size.toLocaleString()} cells, ` +
                `${Object.keys(towns).length.toLocaleString()} towns, ${Math.round(statSync(path).size / 1024)} KB`,
        );
    }
}

function increment(map, key, iso) {
    let counts = map.get(key);
    if (!counts) {
        counts = new Map();
        map.set(key, counts);
    }
    counts.set(iso, (counts.get(iso) ?? 0) + 1);
}

async function main() {
    const t0 = Date.now();
    const countries = await loadCountries();

    // Per level: cell -> (iso -> samples inside it).
    const tallies = new Map(LEVELS.map((res) => [res, new Map()]));
    // Each polygon's samples per level, to keep islands that no cell is mostly made of.
    const polygons = [];

    for (const [iso, geometry] of countries) {
        for (const rings of polygonsOf(geometry)) {
            const outer = rings[0];
            if (!outer || outer.length < 4) continue;
            const code = polygonIso(iso, outer);
            const samples = sampleCells(rings, code);
            const own = new Map(LEVELS.map((res) => [res, new Map()]));
            for (const sample of samples) {
                for (const res of LEVELS) {
                    const parent = res === SAMPLE_RES ? sample : h3.cellToParent(sample, res);
                    increment(tallies.get(res), parent, code);
                    const mine = own.get(res);
                    mine.set(parent, (mine.get(parent) ?? 0) + 1);
                }
            }
            polygons.push({ code, own, centre: ringCentre(outer) });
        }
    }
    console.log(`Sampled ${polygons.length} polygons in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

    const assignedByRes = new Map();
    for (const res of LEVELS) {
        const assigned = new Map();
        assignedByRes.set(res, assigned);
        for (const [cell, counts] of tallies.get(res)) {
            let land = 0;
            let best = null;
            let bestCount = 0;
            for (const [code, count] of counts) {
                land += count;
                if (count > bestCount) {
                    best = code;
                    bestCount = count;
                }
            }
            const childrenSize = res === SAMPLE_RES ? 1 : h3.cellToChildrenSize(cell, SAMPLE_RES);
            if (land >= LAND_SHARE * childrenSize) assigned.set(cell, best);
        }

        // An island no cell is mostly made of still gets the cell it covers most.
        let islands = 0;
        for (const polygon of polygons) {
            const mine = polygon.own.get(res);
            let kept = false;
            let best = null;
            let bestCount = 0;
            for (const [cell, count] of mine) {
                if (assigned.get(cell) === polygon.code) kept = true;
                if (count > bestCount) {
                    best = cell;
                    bestCount = count;
                }
            }
            if (kept) continue;
            const cell = best ?? h3.latLngToCell(polygon.centre[0], polygon.centre[1], res);
            if (!assigned.has(cell)) {
                assigned.set(cell, polygon.code);
                islands++;
            }
        }

        // A country left with no cell at all (Luxembourg at level 3, the
        // Vatican at level 5) takes the cell it covers most, or failing that
        // the one its point falls in, from a neighbour with cells to spare.
        const sizes = new Map();
        for (const code of assigned.values()) sizes.set(code, (sizes.get(code) ?? 0) + 1);
        const claim = (cell, code) => {
            const owner = assigned.get(cell);
            if (owner === code) return true;
            if (owner !== undefined && (sizes.get(owner) ?? 0) <= 1) return false;
            if (owner !== undefined) sizes.set(owner, sizes.get(owner) - 1);
            assigned.set(cell, code);
            sizes.set(code, (sizes.get(code) ?? 0) + 1);
            return true;
        };
        const covered = new Map();
        for (const polygon of polygons) {
            for (const [cell, count] of polygon.own.get(res)) {
                const best = covered.get(polygon.code);
                if (!best || count > best[1]) covered.set(polygon.code, [cell, count]);
            }
        }
        for (const [code, [cell]] of covered) {
            if (!sizes.get(code)) claim(cell, code);
        }
        for (const [lat, lng, code] of MICROSTATES) {
            if (sizes.get(code)) continue;
            const home = h3.latLngToCell(lat, lng, res);
            const cell = [home, ...h3.gridDisk(home, 1)].find((c) => claim(c, code));
            if (!cell) console.warn(`  res ${res}: could not place ${code}`);
        }

        const byCountry = new Map();
        for (const [cell, code] of assigned) {
            if (!byCountry.has(code)) byCountry.set(code, []);
            byCountry.get(code).push(cell);
        }
        const out = { res, countries: {} };
        let compacted = 0;
        for (const code of [...byCountry.keys()].sort()) {
            const cells = h3.compactCells(byCountry.get(code)).sort();
            compacted += cells.length;
            out.countries[code] = cells;
        }
        const path = resolve(ROOT, `public/data/hex-map-v2-r${res}.json`);
        writeFileSync(path, JSON.stringify(out));
        console.log(
            `res ${res}: ${assigned.size.toLocaleString()} cells, ${byCountry.size} countries, ` +
                `${islands} islands kept, ${compacted.toLocaleString()} after compacting, ` +
                `${Math.round(statSync(path).size / 1024)} KB`,
        );
    }
    await writeRegions(assignedByRes);
    writeBinaryLevels();
    console.log(`Done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

if (process.argv.includes('--binary-only')) {
    writeBinaryLevels();
} else {
    main().catch((error) => {
        console.error(error);
        process.exit(1);
    });
}
