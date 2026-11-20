import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cellToLatLng, gridDisk } from 'h3-js';
import { beforeAll, describe, expect, it } from 'vitest';
import { getMapProjection } from '@/lib/mapProjections';
import { buildHexTier, expandLevel, hexAtPoint, hexSpacingRad, projectTier, type HexLevelJson, type HexTierData, type RawHexMapJson } from './hexMapData';

let tier: HexTierData;

function readRaw(): RawHexMapJson {
    const json = JSON.parse(readFileSync(resolve(__dirname, '../../../public/data/hex-map-v2-r3.json'), 'utf8')) as HexLevelJson;
    return { res: 3, cells: expandLevel(json) };
}

beforeAll(async () => {
    tier = await buildHexTier(readRaw());
});

describe('buildHexTier', () => {
    it('indexes every cell by its slot', () => {
        expect(tier.cells.length).toBeGreaterThan(10000);
        tier.cells.forEach((cell, i) => {
            expect(cell.index).toBe(i);
            expect(tier.cellIndexByH3.get(cell.h3Index)).toBe(i);
        });
    });

    it('builds the same tier chunked as in one go', async () => {
        const chunked = await buildHexTier(readRaw(), true);
        expect(chunked.cells.length).toBe(tier.cells.length);
        expect(chunked.borderSegments.length).toBe(tier.borderSegments.length);
    });
});

describe('projectTier', () => {
    it('returns the tier itself for its own projection', () => {
        expect(projectTier(tier, getMapProjection('equal-earth'))).toBe(tier);
    });

    it('moves only the flat side, keeping indices and globe positions', () => {
        const robinson = projectTier(tier, getMapProjection('robinson'));
        expect(projectTier(tier, getMapProjection('robinson'))).toBe(robinson);
        expect(robinson.cells.length).toBe(tier.cells.length);
        const i = tier.cellIndexByH3.get(robinson.cells[100].h3Index)!;
        expect(robinson.cells[100].index).toBe(i);
        expect(robinson.cells[100].center3d).toBe(tier.cells[i].center3d);
        expect(robinson.cells[100].center2d).not.toEqual(tier.cells[i].center2d);
    });

    it('leaves Antarctica off Mercator, which is cut at 60°S', () => {
        const mercator = projectTier(tier, getMapProjection('mercator'));
        const antarctic = mercator.cells.filter((c) => c.code === 'AQ');
        expect(antarctic.length).toBeGreaterThan(0);
        expect(antarctic.every((c) => c.hideBelow > 0.5)).toBe(true);
        expect(mercator.cells.find((c) => c.code === 'GB')!.hideBelow).toBe(0);
        const bucketed = mercator.cellBuckets.reduce((n, b) => n + b.length, 0);
        expect(bucketed).toBe(mercator.cells.filter((c) => c.hideBelow === 0).length);
    });
});

describe('hexAtPoint', () => {
    it('finds the land cell under a point', () => {
        const key = hexAtPoint(51.5, -0.12, tier, 0);
        expect(key).not.toBeNull();
        expect(tier.cellCodes.get(key!)).toBe('GB');
    });

    it('is null over open sea with no reach', () => {
        expect(hexAtPoint(30, -40, tier, 0)).toBeNull();
        expect(hexAtPoint(30, -40, tier, 3)).toBeNull();
    });

    it('reaches from a sea cell to the land beside it', () => {
        // A sea cell with land next to it: the first coastline found.
        let sea: string | null = null;
        for (const cell of tier.cells) {
            sea = gridDisk(cell.h3Index, 1).find((nb) => !tier.cellCodes.has(nb)) ?? null;
            if (sea) break;
        }
        expect(sea).not.toBeNull();
        const [lat, lon] = cellToLatLng(sea!);
        expect(hexAtPoint(lat, lon, tier, 0)).toBeNull();
        const reached = hexAtPoint(lat, lon, tier, 1);
        expect(reached).not.toBeNull();
        expect(gridDisk(sea!, 1)).toContain(reached);
    });
});

describe('hexSpacingRad', () => {
    it('is about 120 km at res 3', () => {
        expect(hexSpacingRad(3) * 6371).toBeGreaterThan(100);
        expect(hexSpacingRad(3) * 6371).toBeLessThan(140);
    });
});
