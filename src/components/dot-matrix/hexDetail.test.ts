import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cellToParent, latLngToCell, uncompactCells } from 'h3-js';
import { beforeAll, describe, expect, it } from 'vitest';
import { getMapProjection } from '@/lib/mapProjections';
import {
    PATCH_RES,
    buildDetailLevel,
    buildPatch,
    codeOf,
    decodeDetailLevelBin,
    decodeDetailLookupBin,
    detailHexAtPoint,
    resolveDetailCityHex,
    type HexDetailLevel,
} from './hexDetail';
import { countryStyleIndex, expandLevel, type HexLevelJson } from './hexMapData';

const read = (res: number) =>
    JSON.parse(readFileSync(resolve(__dirname, `../../../public/data/hex-map-v2-r${res}.json`), 'utf8')) as HexLevelJson;

let level4: HexDetailLevel;
let level5: HexDetailLevel;
const equalEarth = getMapProjection('equal-earth');

beforeAll(() => {
    level4 = buildDetailLevel(read(4));
    level5 = buildDetailLevel(read(5));
});

describe('codeOf', () => {
    it('finds a country through its compacted cells', () => {
        expect(codeOf(level4, latLngToCell(51.5, -0.12, 4))).toBe('GB');
        expect(codeOf(level5, latLngToCell(48.86, 2.35, 5))).toBe('FR');
        // Deep inside Russia, where the file holds coarse parents only.
        expect(codeOf(level5, latLngToCell(60, 100, 5))).toBe('RU');
    });

    it('is undefined at sea', () => {
        expect(codeOf(level5, latLngToCell(30, -40, 5))).toBeUndefined();
    });
});

describe('buildPatch', () => {
    it('builds every land cell under a patch, with borders', () => {
        const key = cellToParent(latLngToCell(51.5, -0.12, 5), PATCH_RES);
        const patch = buildPatch(level5, key, equalEarth);
        expect(patch.h3.length).toBeGreaterThan(100);
        expect(patch.codes).toContain('GB');
        const { data } = patch;
        expect(data.count).toBe(patch.h3.length);
        expect(data.cornerStart[data.count]).toBe(data.corner3.length / 3);
        expect(data.corner2.length / 2).toBe(data.corner3.length / 3);
        expect(data.borderCount).toBeGreaterThan(0);
        expect(data.border3.length).toBe(data.borderCount * 6);
        expect([...data.centre2].every(Number.isFinite)).toBe(true);
    });

    it('keeps both country codes at a cross-patch boundary and only the outside coast', () => {
        // The French and Belgian cells touch across a resolution-1 patch boundary.
        const french = '841fb45ffffffff';
        const belgian = '841865bffffffff';
        const domestic = '841fb6bffffffff'; // Touches the French cell only.
        const level = buildDetailLevel({ res: 4, countries: { FR: [french, domestic], BE: [belgian] } });
        for (const [cell, own, other, coasts] of [
            [french, 'FR', 'BE', 9],
            [belgian, 'BE', 'FR', 5],
        ] as const) {
            const patch = buildPatch(level, cellToParent(cell, PATCH_RES), equalEarth).data;
            expect(patch.borderCount).toBe(coasts + 1);
            expect(patch.borderCountries.length).toBe(2 * patch.borderCount);
            const neighbors: number[] = [];
            for (let i = 0; i < patch.borderCount; i++) {
                expect(patch.borderCountries[2 * i]).toBe(countryStyleIndex(own));
                neighbors.push(patch.borderCountries[2 * i + 1]);
            }
            expect(neighbors.filter(Boolean)).toEqual([countryStyleIndex(other)]);
        }
    });

    it('covers the whole level once across its patches', () => {
        const expanded = expandLevel(read(4)).length;
        let built = 0;
        for (const key of level4.patches.keys()) built += buildPatch(level4, key, equalEarth).data.count;
        expect(built).toBe(expanded);
    });

    it('decodes pre-baked binary detail levels with identical patch cells and border counts', () => {
        for (const [res, jsonLevel] of [[4, level4], [5, level5]] as const) {
            const buf = readFileSync(resolve(__dirname, `../../../public/data/hex-map-v2-r${res}.bin`));
            const slice = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
            const lookup = decodeDetailLookupBin(slice);
            const binLevel = decodeDetailLevelBin(slice);
            expect(lookup.compact.size).toBe(jsonLevel.compact.size);
            expect(binLevel.patches.size).toBe(jsonLevel.patches.size);
            const key = cellToParent(latLngToCell(51.5, -0.12, res), PATCH_RES);
            const fromJson = buildPatch(jsonLevel, key, equalEarth);
            const fromBin = buildPatch(binLevel, key, equalEarth);
            expect(fromBin.data.count).toBe(fromJson.data.count);
            expect(fromBin.data.borderCount).toBe(fromJson.data.borderCount);
            expect([...fromBin.data.borderCountries]).toEqual([...fromJson.data.borderCountries]);
        }
    });
});

describe('cities and picking', () => {
    it('puts a city on its own country', () => {
        const cell = resolveDetailCityHex(51.5, -0.12, level5, 'GB');
        expect(cell).not.toBeNull();
        expect(codeOf(level5, cell!)).toBe('GB');
    });

    it('reaches from the sea to the nearest land within the ring', () => {
        // Just off Dover, in the Channel.
        expect(detailHexAtPoint(51.0, 1.4, level5, 0, () => true)).toBeNull();
        const hit = detailHexAtPoint(51.0, 1.4, level5, 3, () => true);
        expect(hit).not.toBeNull();
    });
});

describe('level files', () => {
    const known = new Set(
        (JSON.parse(readFileSync(resolve(__dirname, '../../../public/countries.json'), 'utf8')) as { cca2: string }[]).map((c) => c.cca2),
    );

    it.each([3, 4, 5, 6])('names only real countries at level %i', (res) => {
        const unknown = Object.keys(read(res).countries).filter((code) => !known.has(code));
        expect(unknown).toEqual([]);
    });

    it('keeps Antarctica, which h3 cannot sample in one piece', () => {
        const antarctica = uncompactCells(read(3).countries.AQ ?? [], 3);
        expect(antarctica.length).toBeGreaterThan(900);
    });

    it('cuts every level-5 cell into exactly one patch', () => {
        let total = 0;
        for (const entries of level5.patches.values()) total += entries.length;
        const compacted = Object.values(read(5).countries).reduce((n, cells) => n + cells.length, 0);
        expect(total).toBeGreaterThanOrEqual(compacted);
    });
});
