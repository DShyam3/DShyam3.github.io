import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { latLngToCell } from 'h3-js';
import { beforeAll, describe, expect, it } from 'vitest';
import { getMapProjection } from '@/lib/mapProjections';
import {
    buildDetailLevel,
    buildPatch,
    codeOf,
    detailHexAtPoint,
    patchOf,
    patchesAround,
    resolveDetailCityHex,
    type HexDetailLevel,
} from './hexDetail';
import { expandLevel, type HexLevelJson } from './hexMapData';

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
        const key = patchOf(latLngToCell(51.5, -0.12, 5));
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

    it('covers the whole level once across its patches', () => {
        const expanded = expandLevel(read(4)).length;
        let built = 0;
        for (const key of level4.patches.keys()) built += buildPatch(level4, key, equalEarth).data.count;
        expect(built).toBe(expanded);
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

    it('names the patches around places on screen', () => {
        const keys = patchesAround(level5, [{ lat: (51.5 * Math.PI) / 180, lon: (-0.12 * Math.PI) / 180 }]);
        expect(keys).toContain(patchOf(latLngToCell(51.5, -0.12, 5)));
        expect(keys.length).toBeGreaterThan(1);
    });
});
