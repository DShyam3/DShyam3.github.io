import { describe, expect, it } from 'vitest';
import { projectEqualEarth, unprojectEqualEarth } from './equalEarth';

const rad = (deg: number) => (deg * Math.PI) / 180;

describe('unprojectEqualEarth', () => {
    it('undoes projectEqualEarth across the map', () => {
        for (let latDeg = -89; latDeg <= 89; latDeg += 7) {
            for (let lonDeg = -179; lonDeg <= 179; lonDeg += 13) {
                const { nx, ny } = projectEqualEarth(rad(lonDeg), rad(latDeg));
                const back = unprojectEqualEarth(nx, ny);
                expect(back).not.toBeNull();
                expect(back!.lat).toBeCloseTo(rad(latDeg), 9);
                expect(back!.lon).toBeCloseTo(rad(lonDeg), 9);
            }
        }
    });

    it('is null outside the outline', () => {
        // Above the top edge, below the bottom, and the corners the rounded sides leave empty.
        expect(unprojectEqualEarth(0.5, -0.01)).toBeNull();
        expect(unprojectEqualEarth(0.5, 1.01)).toBeNull();
        expect(unprojectEqualEarth(0.01, 0.02)).toBeNull();
        expect(unprojectEqualEarth(0.99, 0.98)).toBeNull();
    });

    it('puts the centre of the square on the equator at the meridian', () => {
        const centre = unprojectEqualEarth(0.5, 0.5);
        expect(centre!.lat).toBeCloseTo(0, 12);
        expect(centre!.lon).toBeCloseTo(0, 12);
    });
});
