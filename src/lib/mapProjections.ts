/**
 * The two projections the flat map can be drawn in.
 *
 * On 4 September 2026 the UN General Assembly adopted Equal Earth as the
 * projection it recommends for default world maps, replacing Mercator. Both
 * are kept here so the map can put them side by side -- that comparison is
 * the whole argument the resolution was about.
 *
 * Equal-area is a property of the projection, not of the dot grid. The grid is
 * 1°x1° cells, whose real area shrinks with cos φ, so Greenland gets about 3.8
 * times as many dots per square kilometre as the Congo does. `rowScale` shrinks
 * those dots to match, so the footprint reads true -- but a dot is not a fixed
 * quantity of land, and dot counts are not areas.
 *
 * These are forward projections only; the grid data is untouched, so the globe,
 * the city dot keys and the stored `dot_col`/`dot_row` values all still mean
 * exactly what they meant before.
 */

export type FlatProjection = 'equal-earth' | 'mercator';

export interface FlatPoint {
    /** 0 at the antimeridian on the left, 1 on the right. */
    nx: number;
    /** 0 at the top edge, 1 at the bottom. */
    ny: number;
    /**
     * True where the projection cannot show this latitude and the position
     * above is a clamp to the edge rather than a real place. Mercator runs to
     * infinity at the poles, so every version of it crops somewhere.
     */
    cropped: boolean;
}

export interface RowScale {
    /** Column spacing at this latitude, relative to the equator. */
    hScale: number;
    /** Row spacing at this latitude, relative to the equator. */
    vScale: number;
}

export interface FlatProjectionSpec {
    /** Shown on the map's projection toggle. */
    label: string;
    /** One line on what it does to the world, for the toggle's tooltip. */
    note: string;
    /** Width / height of the projected world. The map's box has to hold this. */
    aspect: number;
    /**
     * Row spacing at the equator, as a multiple of an even 1/rows split of the
     * height. Projections spend their height differently: Equal Earth gives
     * the equator more than its even share, Mercator half.
     */
    rowUnit: number;
    project(lon: number, lat: number): FlatPoint;
    rowScale(lat: number): RowScale;
}

/* ── Equal Earth (Šavrič, Patterson & Jenny, 2018) ──────────────────────── */

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

function eeY(theta: number): number {
    const t2 = theta * theta;
    const t3 = t2 * theta;
    const t7 = t3 * t3 * theta;
    return A4 * t7 * t2 + A3 * t7 + A2 * t3 + A1 * theta;
}

/** Half the projected width, at λ = π on the equator. */
const EE_HALF_WIDTH = (2 * Math.sqrt(3) * Math.PI) / (3 * A1);
/** Half the projected height, at φ = 90°. */
const EE_HALF_HEIGHT = eeY(Math.PI / 3);

const equalEarth: FlatProjectionSpec = {
    label: 'Equal Earth',
    note: 'Equal-area: every country covers its true share of the map.',
    aspect: EE_HALF_WIDTH / EE_HALF_HEIGHT,
    rowUnit: (A1 * SIN_SCALE * Math.PI) / (2 * EE_HALF_HEIGHT),
    project(lon, lat) {
        const theta = Math.asin(SIN_SCALE * Math.sin(lat));
        const x = (2 * Math.sqrt(3) * lon * Math.cos(theta)) / (3 * dydtheta(theta));
        return {
            nx: (x + EE_HALF_WIDTH) / (2 * EE_HALF_WIDTH),
            ny: (EE_HALF_HEIGHT - eeY(theta)) / (2 * EE_HALF_HEIGHT),
            cropped: false,
        };
    },
    rowScale(lat) {
        const theta = Math.asin(SIN_SCALE * Math.sin(lat));
        const cosTheta = Math.cos(theta);
        const d = dydtheta(theta);
        // Equal-area, so these multiply out to cos φ: the grid squeezes towards
        // the poles, a lot vertically and mildly horizontally.
        return {
            hScale: (cosTheta * A1) / d,
            vScale: (d * Math.cos(lat)) / (cosTheta * A1),
        };
    },
};

/* ── Mercator ───────────────────────────────────────────────────────────── */

/**
 * Mercator runs to infinity at the poles, so it has to stop somewhere. This is
 * the web-map cutoff (~85.05°), the one that makes the world square -- the
 * same crop Google Maps and every other slippy map uses. Antarctica and the
 * far Arctic fall off the edge, which is what wall maps do too.
 */
const MERCATOR_MAX_LAT = (2 * Math.atan(Math.exp(Math.PI)) - Math.PI / 2);
const MERCATOR_HALF_HEIGHT = Math.PI;

const mercator: FlatProjectionSpec = {
    label: 'Mercator',
    note: 'Conformal, not equal-area: it inflates area by 1/cos² φ, so Greenland reads the size of Africa.',
    aspect: (2 * Math.PI) / (2 * MERCATOR_HALF_HEIGHT),
    // Half the height of a plate carrée row, because Mercator spends the other
    // half stretching the latitudes it does keep.
    rowUnit: 0.5,
    project(lon, lat) {
        const clamped = Math.max(-MERCATOR_MAX_LAT, Math.min(MERCATOR_MAX_LAT, lat));
        const y = Math.asinh(Math.tan(clamped));
        return {
            nx: (lon + Math.PI) / (2 * Math.PI),
            ny: (MERCATOR_HALF_HEIGHT - y) / (2 * MERCATOR_HALF_HEIGHT),
            cropped: Math.abs(lat) > MERCATOR_MAX_LAT,
        };
    },
    rowScale(lat) {
        const clamped = Math.max(-MERCATOR_MAX_LAT, Math.min(MERCATOR_MAX_LAT, lat));
        // x is linear in λ, so columns never move; rows spread as sec φ. That
        // is the whole distortion, and it is why Greenland swells.
        return { hScale: 1, vScale: 1 / Math.cos(clamped) };
    },
};

export const FLAT_PROJECTIONS: Record<FlatProjection, FlatProjectionSpec> = {
    'equal-earth': equalEarth,
    mercator,
};

/** Toggle order: the one the UN replaced, then the one it adopted. */
export const FLAT_PROJECTION_ORDER: FlatProjection[] = ['mercator', 'equal-earth'];
