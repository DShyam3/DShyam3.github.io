import { describe, expect, it } from 'vitest';
import { MAP_PROJECTIONS, getMapProjection, isMapProjectionId } from './mapProjections';

const DEG = Math.PI / 180;

describe.each(MAP_PROJECTIONS.map((p) => [p.id, p] as const))('%s', (_id, projection) => {
    it('round-trips places across the map', () => {
        for (let latDeg = -85; latDeg <= 85; latDeg += 17) {
            for (let lonDeg = -175; lonDeg <= 175; lonDeg += 25) {
                const lat = latDeg * DEG;
                if (lat < projection.minLat || lat > projection.maxLat) continue;
                const lon = lonDeg * DEG;
                const flat = projection.project(lon, lat);
                expect(flat.nx).toBeGreaterThanOrEqual(0);
                expect(flat.nx).toBeLessThanOrEqual(1);
                expect(flat.ny).toBeGreaterThanOrEqual(0);
                expect(flat.ny).toBeLessThanOrEqual(1);
                const back = projection.unproject(flat.nx, flat.ny);
                expect(back).not.toBeNull();
                expect(back!.lon).toBeCloseTo(lon, 6);
                expect(back!.lat).toBeCloseTo(lat, 6);
            }
        }
    });

    it('puts the origin in the middle across, north at the top', () => {
        const origin = projection.project(0, 0);
        expect(origin.nx).toBeCloseTo(0.5, 9);
        expect(projection.project(0, 30 * DEG).ny).toBeLessThan(origin.ny);
    });

    it('fills its aspect: the equator spans the width', () => {
        expect(projection.project(-Math.PI, 0).nx).toBeCloseTo(0, 6);
        expect(projection.project(Math.PI, 0).nx).toBeCloseTo(1, 6);
        expect(projection.aspect).toBeGreaterThan(1);
        expect(projection.aspect).toBeLessThan(2.2);
    });

    it('is null off the map', () => {
        expect(projection.unproject(-0.1, 0.5)).toBeNull();
        expect(projection.unproject(0.5, 1.2)).toBeNull();
    });
});

describe('outline corners', () => {
    it('leaves the corners off the curved maps', () => {
        for (const id of ['equal-earth', 'winkel-tripel', 'robinson'] as const) {
            expect(getMapProjection(id).unproject(0.01, 0.01)).toBeNull();
        }
    });

    it('fills the corners on Mercator, which is a rectangle', () => {
        expect(getMapProjection('mercator').unproject(0.01, 0.01)).not.toBeNull();
    });
});

describe('getMapProjection', () => {
    it('falls back to Equal Earth for an unknown id', () => {
        // @ts-expect-error -- an id from old storage
        expect(getMapProjection('gall-peters').id).toBe('equal-earth');
        expect(isMapProjectionId('robinson')).toBe(true);
        expect(isMapProjectionId('gall-peters')).toBe(false);
    });
});
