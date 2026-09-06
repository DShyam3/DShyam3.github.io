/**
 * Equal Earth projection (Šavrič, Patterson & Jenny, 2018).
 *
 * Adopted by the UN General Assembly on 4 September 2026 as the projection it
 * recommends for default world maps, replacing Mercator. It is equal-area, so
 * a dot covers the same number of square kilometres wherever it sits -- which
 * is the whole point of a dot-matrix map that counts places.
 *
 * The flat map used to be plate carrée: the dot grid is a 360x180 lon/lat
 * grid, drawn by scaling col/row straight onto the canvas. That is not as bad
 * as Mercator (it inflates area by 1/cos φ rather than 1/cos² φ) but it still
 * draws Greenland at roughly three times its true size. This module is the
 * forward projection only; the grid data itself is untouched, so the globe,
 * the city dot keys and the stored `dot_col`/`dot_row` values all still mean
 * exactly what they meant before.
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

/** Half the width of the projected world, at λ = π on the equator. */
const HALF_WIDTH = (2 * Math.sqrt(3) * Math.PI) / (3 * A1);

/** Half the height of the projected world, at φ = 90°. */
const HALF_HEIGHT = yOfTheta(Math.PI / 3);

/**
 * Width / height of the projected world, ~2.0546. The flat map's box has to
 * carry this ratio or the continents smear, the same way it had to carry 2:1
 * (cols/rows) when the map was plate carrée.
 */
export const EQUAL_EARTH_ASPECT = HALF_WIDTH / HALF_HEIGHT;

/** dy/dφ at the equator, the reference for `vScale`. */
const DYDPHI_EQUATOR = A1 * SIN_SCALE;

/**
 * Equatorial row spacing as a multiple of the plate carrée row spacing
 * (1/rows of the canvas height). Equal Earth spends more of its height near
 * the equator, so rows there are ~1.38x further apart than an even grid.
 */
export const EQUAL_EARTH_ROW_UNIT = (DYDPHI_EQUATOR * Math.PI) / (2 * HALF_HEIGHT);

export interface EqualEarthPoint {
    /** 0 at the antimeridian on the left, 1 on the right. */
    nx: number;
    /** 0 at the north pole, 1 at the south pole. */
    ny: number;
}

/** Project radian lon/lat to the unit square, y pointing down. */
export function projectEqualEarth(lon: number, lat: number): EqualEarthPoint {
    const theta = Math.asin(SIN_SCALE * Math.sin(lat));
    const x = (2 * Math.sqrt(3) * lon * Math.cos(theta)) / (3 * dydtheta(theta));
    const y = yOfTheta(theta);
    return {
        nx: (x + HALF_WIDTH) / (2 * HALF_WIDTH),
        ny: (HALF_HEIGHT - y) / (2 * HALF_HEIGHT),
    };
}

export interface EqualEarthRowScale {
    /** Column spacing at this latitude, relative to the equator. */
    hScale: number;
    /** Row spacing at this latitude, relative to the equator. */
    vScale: number;
}

/**
 * How far apart neighbouring grid cells land at a given latitude, relative to
 * the equator. Equal-area means `hScale * vScale === cos φ`, so towards the
 * poles the grid squeezes -- mostly vertically -- and the dots have to shrink
 * with it or they merge into a solid band.
 */
export function equalEarthRowScale(lat: number): EqualEarthRowScale {
    const theta = Math.asin(SIN_SCALE * Math.sin(lat));
    const cosTheta = Math.cos(theta);
    const d = dydtheta(theta);
    return {
        hScale: (cosTheta * A1) / d,
        vScale: (d * Math.cos(lat)) / (cosTheta * A1),
    };
}
