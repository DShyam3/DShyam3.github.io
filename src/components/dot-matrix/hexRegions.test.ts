import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { latLngToCell } from 'h3-js';
import { describe, expect, it } from 'vitest';
import { buildRegionLevel, hexPlaceLabel, regionOf } from './hexRegions';

const level = (res: number) =>
    buildRegionLevel(JSON.parse(readFileSync(resolve(__dirname, `../../../public/data/hex-regions-v1-r${res}.json`), 'utf8')));

describe('hex regions', () => {
    const r3 = level(3);
    const r5 = level(5);

    it('names the state a hex is mostly in, at any level', () => {
        expect(regionOf(r3, latLngToCell(12.97, 77.59, 3))).toBe('Karnataka');
        expect(regionOf(r5, latLngToCell(12.97, 77.59, 5))).toBe('Karnataka');
        expect(regionOf(r5, latLngToCell(36.17, -115.14, 5))).toBe('Nevada');
    });

    it('leads with the largest town in the hex, then its state', () => {
        const label = hexPlaceLabel(latLngToCell(12.97, 77.59, 5), 'India', r5);
        expect(label).toMatch(/, Karnataka$/);
        expect(label?.split(', ')[0]).not.toBe('Karnataka');
    });

    it('falls back to the state and country with no town in the hex', () => {
        // Central Australian desert: a state, no town.
        expect(hexPlaceLabel(latLngToCell(-25.5, 131.5, 5), 'Australia', r5)).toBe('Northern Territory, Australia');
    });

    it('never names a state the same as its country, nor a town across a border', () => {
        expect(hexPlaceLabel(latLngToCell(-80, 0, 5), 'Antarctica', r5)).toBeNull();
        for (const res of [3, 4, 5]) {
            const json = JSON.parse(readFileSync(resolve(__dirname, `../../../public/data/hex-regions-v1-r${res}.json`), 'utf8')) as { towns: Record<string, [string, string]> };
            expect(Object.values(json.towns).filter(([, state]) => state.includes('?'))).toEqual([]);
        }
        // Edirne (Turkey) sits beside Bulgaria: no Bulgarian hex is named after it.
        const bg = level(3);
        const named = [...bg.towns.entries()].filter(([, [town]]) => town === 'Edirne');
        expect(named.every(([cell]) => regionOf(bg, cell) !== undefined)).toBe(true);
    });

    it('has nothing at sea, and waits for a level that has not loaded', () => {
        expect(hexPlaceLabel(latLngToCell(30, -40, 5), 'Nowhere', r5)).toBeNull();
        expect(hexPlaceLabel(latLngToCell(12.97, 77.59, 4), 'India')).toBeNull();
    });
});
