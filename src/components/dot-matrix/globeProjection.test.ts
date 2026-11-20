import { describe, expect, it } from 'vitest';
import { projectEqualEarth } from '@/lib/equalEarth';
import { globePointAt, mapPointAt, projectToGlobe, type GlobeView } from './globeProjection';

const rad = (deg: number) => (deg * Math.PI) / 180;

const unit = (lat: number, lon: number) => ({
    ux: Math.cos(lat) * Math.sin(lon),
    uy: -Math.sin(lat),
    uz: Math.cos(lat) * Math.cos(lon),
});

function view(overrides: Partial<GlobeView> = {}): GlobeView {
    const rotation = 0.7;
    const tilt = -0.4;
    return {
        width: 800,
        height: 600,
        dpr: 2,
        radius: 270,
        cosRot: Math.cos(rotation),
        sinRot: Math.sin(rotation),
        cosLat: Math.cos(tilt),
        sinLat: Math.sin(tilt),
        flatW: 1600,
        flatH: 780,
        flatX: -300,
        flatY: -90,
        progress: 1,
        ...overrides,
    };
}

describe('globePointAt', () => {
    it('undoes projectToGlobe for every point on the front of the globe', () => {
        const v = view();
        let checked = 0;
        for (let latDeg = -80; latDeg <= 80; latDeg += 10) {
            for (let lonDeg = -170; lonDeg <= 170; lonDeg += 20) {
                const p = projectToGlobe(v, unit(rad(latDeg), rad(lonDeg)));
                if (p.z <= 0.05) continue; // the back, and the limb where the inverse is ill-conditioned
                const back = globePointAt(v, p.x, p.y);
                expect(back).not.toBeNull();
                expect(back!.lat).toBeCloseTo(rad(latDeg), 6);
                expect(back!.lon).toBeCloseTo(rad(lonDeg), 6);
                checked++;
            }
        }
        expect(checked).toBeGreaterThan(50);
    });

    it('is null off the disc', () => {
        const v = view();
        expect(globePointAt(v, 0, 0)).toBeNull();
        expect(globePointAt(v, v.width / 2 + v.radius + 1, v.height / 2)).toBeNull();
    });
});

describe('mapPointAt', () => {
    it('reads the flat map when it is showing', () => {
        const v = view({ progress: 0 });
        const flat = projectEqualEarth(rad(-3.2), rad(55.9));
        const back = mapPointAt(v, flat.nx * v.flatW + v.flatX, flat.ny * v.flatH + v.flatY);
        expect(back!.lat).toBeCloseTo(rad(55.9), 9);
        expect(back!.lon).toBeCloseTo(rad(-3.2), 9);
    });

    it('names nowhere mid-morph', () => {
        expect(mapPointAt(view({ progress: 0.5 }), 400, 300)).toBeNull();
    });
});
