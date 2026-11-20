import type { MapProjection } from '@/lib/mapProjections';
import type { UnitVector } from './hexMapData';

/**
 * Everything one frame needs to place a point on the map, and to work back
 * from a pointer to the place under it. CSS pixels throughout.
 */
export interface GlobeView {
    width: number;
    height: number;
    dpr: number;
    /** The globe's radius at the current zoom. */
    radius: number;
    cosRot: number;
    sinRot: number;
    cosLat: number;
    sinLat: number;
    /** The flat map's size and top-left corner at the current zoom and pan. */
    flatW: number;
    flatH: number;
    flatX: number;
    flatY: number;
    /** 0 is the flat map, 1 the globe; between the two, the morph. */
    progress: number;
}

export interface GlobePoint {
    x: number;
    y: number;
    /** -1 at the back of the globe, 1 at the front. */
    z: number;
}

/** A point on the unit sphere, turned and tilted onto the globe. */
export function projectToGlobe(view: GlobeView, p: UnitVector): GlobePoint {
    const { radius: R, cosRot, sinRot, cosLat, sinLat } = view;
    const x3d = R * p.ux;
    const y3d = R * p.uy;
    const z3d = R * p.uz;
    const xRot = x3d * cosRot - z3d * sinRot;
    const zRot = x3d * sinRot + z3d * cosRot;
    const yTilt = y3d * cosLat - zRot * sinLat;
    const zTilt = y3d * sinLat + zRot * cosLat;
    return { x: view.width / 2 + xRot, y: view.height / 2 + yTilt, z: zTilt / R };
}

/**
 * The radian lon/lat on the front of the globe under a canvas point, or null
 * off the disc. `projectToGlobe` run backwards: the tilt undone, then the turn.
 */
export function globePointAt(view: GlobeView, x: number, y: number): { lon: number; lat: number } | null {
    const { radius: R, cosRot, sinRot, cosLat, sinLat } = view;
    const xRot = x - view.width / 2;
    const yTilt = y - view.height / 2;
    const d2 = xRot * xRot + yTilt * yTilt;
    if (R <= 0 || d2 > R * R) return null;
    const zTilt = Math.sqrt(R * R - d2);

    const y3d = yTilt * cosLat + zTilt * sinLat;
    const zRot = -yTilt * sinLat + zTilt * cosLat;
    const x3d = xRot * cosRot + zRot * sinRot;
    const z3d = -xRot * sinRot + zRot * cosRot;
    return {
        lon: Math.atan2(x3d, z3d),
        lat: Math.asin(Math.max(-1, Math.min(1, -y3d / R))),
    };
}

/**
 * The place under a canvas point on whichever map is showing. Null mid-morph,
 * when a point on screen is between two places and stands for neither.
 */
export function mapPointAt(
    view: GlobeView,
    x: number,
    y: number,
    projection: Pick<MapProjection, 'unproject'>,
): { lon: number; lat: number } | null {
    if (view.progress === 1) return globePointAt(view, x, y);
    if (view.progress === 0) {
        return projection.unproject((x - view.flatX) / view.flatW, (y - view.flatY) / view.flatH);
    }
    return null;
}
