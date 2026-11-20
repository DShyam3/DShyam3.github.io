import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cellToLatLng, gridDisk } from 'h3-js';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildHexTier, hexAtPoint, hexSpacingRad, type HexTierData, type RawHexMapJson } from './hexMapData';

let tier: HexTierData;

beforeAll(async () => {
    const raw = JSON.parse(readFileSync(resolve(__dirname, '../../../public/data/hex-world-map-r3.json'), 'utf8')) as RawHexMapJson;
    tier = await buildHexTier(raw);
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
        const raw = JSON.parse(readFileSync(resolve(__dirname, '../../../public/data/hex-world-map-r3.json'), 'utf8')) as RawHexMapJson;
        const chunked = await buildHexTier(raw, true);
        expect(chunked.cells.length).toBe(tier.cells.length);
        expect(chunked.borderSegments.length).toBe(tier.borderSegments.length);
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
