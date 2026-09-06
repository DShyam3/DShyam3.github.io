/**
 * Equal Earth projection (Šavrič, Patterson & Jenny, 2018).
 *
 * Adopted by the UN General Assembly on 4 September 2026 as the projection it
 * recommends for default world maps, replacing Mercator. It is equal-area: a
 * country's footprint on screen is proportional to its true area.
 *
 * That is a property of the projection, not of the dot grid. The grid is 1°x1°
 * cells, whose real area shrinks with cos φ, so Greenland gets about 3.8 times
 * as many dots per square kilometre as the Congo does. `equalEarthRowScale`
 * shrinks those dots to match, so the footprint reads true -- but a dot is not
 * a fixed quantity of land, and dot counts are not areas.
 *
 * Forward projection only; the grid data is untouched, so the globe, the city
 * dot keys and the stored `dot_col`/`dot_row` values all still mean exactly
 * what they meant before.
 */

const A1 = 1.340264;
const A2 = -0.081106;
const A3 = 0.000893;
const A4 = 0.003796;

/** sin of the parametric latitude is this times sin φ. */
const SIN_SCALE = Math.sqrt(3) / 2;

/** dy/dθ -- also the denominator of the x term. */
function dydtheta(theta: number): number {
    const t2 = theta * theta;
    const t6 = t2 * t2 * t2;
    return 9 * A4 * t6 * t2 + 7 * A3 * t6 + 3 * A2 * t2 + A1;
}

function yOfTheta(theta: number): number {
    const t2 = theta * theta;
    const t3 = t2 * theta;
    const t7 = t3 * t3 * theta;
    return A4 * t7 * t2 + A3 * t7 + A2 * t3 + A1 * theta;
}

/** Half the projected width, at λ = π on the equator. */
const HALF_WIDTH = (2 * Math.sqrt(3) * Math.PI) / (3 * A1);
/** Half the projected height, at φ = 90°. */
const HALF_HEIGHT = yOfTheta(Math.PI / 3);

/** Width / height of the projected world, ~2.05:1. */
export const EQUAL_EARTH_ASPECT = HALF_WIDTH / HALF_HEIGHT;

/**
 * Row spacing at the equator, as a multiple of an even 1/rows split of the
 * height. Equal Earth gives the equator ~1.38x its even share.
 */
export const EQUAL_EARTH_ROW_UNIT = (A1 * SIN_SCALE * Math.PI) / (2 * HALF_HEIGHT);

/** Shown on the map. */
export const EQUAL_EARTH_LABEL = 'Equal Earth';
export const EQUAL_EARTH_NOTE =
    'Equal-area: every country covers its true share of the map. Adopted by the UN in September 2026.';

export interface EqualEarthPoint {
    /** 0 at the antimeridian on the left, 1 on the right. */
    nx: number;
    /** 0 at the north pole, 1 at the south. */
    ny: number;
}

/** Project radian lon/lat into the unit square, y pointing down. */
export function projectEqualEarth(lon: number, lat: number): EqualEarthPoint {
    const theta = Math.asin(SIN_SCALE * Math.sin(lat));
    const x = (2 * Math.sqrt(3) * lon * Math.cos(theta)) / (3 * dydtheta(theta));
    return {
        nx: (x + HALF_WIDTH) / (2 * HALF_WIDTH),
        ny: (HALF_HEIGHT - yOfTheta(theta)) / (2 * HALF_HEIGHT),
    };
}

export interface RowScale {
    /** Column spacing at this latitude, relative to the equator. */
    hScale: number;
    /** Row spacing at this latitude, relative to the equator. */
    vScale: number;
}

/**
 * How far apart neighbouring grid cells land at a given latitude, relative to
 * the equator. Equal-area means these multiply out to cos φ: the grid squeezes
 * towards the poles, hard vertically and mildly horizontally, and the dots have
 * to follow or they merge into a solid band.
 */
export function equalEarthRowScale(lat: number): RowScale {
    const theta = Math.asin(SIN_SCALE * Math.sin(lat));
    const cosTheta = Math.cos(theta);
    const d = dydtheta(theta);
    return {
        hScale: (cosTheta * A1) / d,
        vScale: (d * Math.cos(lat)) / (cosTheta * A1),
    };
}
