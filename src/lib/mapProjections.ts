/**
 * The world-map projections the Travel map can be drawn in. Each maps radian
 * lon/lat into the unit square (y down) and back, so the flat map, its picking
 * and its pan targets all work the same whichever one is chosen.
 *
 * Four, because they are the ones people meet: Equal Earth (the UN's default
 * since 2026), Winkel Tripel and Robinson (National Geographic's, in turn),
 * and Mercator (every web map's).
 */

import {
    EQUAL_EARTH_ASPECT,
    EQUAL_EARTH_LABEL,
    EQUAL_EARTH_NOTE,
    projectEqualEarth,
    unprojectEqualEarth,
} from './equalEarth';

/** A point in the unit square: 0 at the left and top, 1 at the right and bottom. */
export interface FlatPoint {
    nx: number;
    ny: number;
}

export type MapProjectionId = 'equal-earth' | 'winkel-tripel' | 'robinson' | 'mercator';

export interface MapProjection {
    id: MapProjectionId;
    label: string;
    /** One line on what the projection keeps and what it gives up. */
    note: string;
    /** Width / height of the projected world. */
    aspect: number;
    /** The latitudes the map shows, in radians. A cell reaching past them is left off. */
    minLat: number;
    maxLat: number;
    project(lon: number, lat: number): FlatPoint;
    /** The radian lon/lat under a point of the unit square, or null off the map. */
    unproject(nx: number, ny: number): { lon: number; lat: number } | null;
}

const HALF_PI = Math.PI / 2;
const DEG = Math.PI / 180;

/**
 * A projection from its raw plane coordinates (y up) and their extent:
 * `halfWidth` either side of the central meridian, `top` and `bottom` in y.
 */
function fromRaw(
    base: Omit<MapProjection, 'aspect' | 'project' | 'unproject'>,
    forward: (lon: number, lat: number) => [number, number],
    inverse: (x: number, y: number) => [number, number] | null,
    halfWidth: number,
    top: number,
    bottom: number,
): MapProjection {
    const height = top - bottom;
    return {
        ...base,
        aspect: (2 * halfWidth) / height,
        project(lon, lat) {
            const [x, y] = forward(lon, Math.max(base.minLat, Math.min(base.maxLat, lat)));
            return { nx: (x + halfWidth) / (2 * halfWidth), ny: (top - y) / height };
        },
        unproject(nx, ny) {
            const place = inverse(nx * 2 * halfWidth - halfWidth, top - ny * height);
            if (!place) return null;
            const [lon, lat] = place;
            if (Math.abs(lon) > Math.PI || lat < base.minLat || lat > base.maxLat) return null;
            return { lon, lat };
        },
    };
}

// ─── Equal Earth ─────────────────────────────────────────────────────────

const EQUAL_EARTH: MapProjection = {
    id: 'equal-earth',
    label: EQUAL_EARTH_LABEL,
    note: EQUAL_EARTH_NOTE,
    aspect: EQUAL_EARTH_ASPECT,
    minLat: -HALF_PI,
    maxLat: HALF_PI,
    project: projectEqualEarth,
    unproject: unprojectEqualEarth,
};

// ─── Winkel Tripel ───────────────────────────────────────────────────────

/** cos of the standard parallel, arccos(2/π). */
const WINKEL_COS_PHI1 = 2 / Math.PI;

function winkelForward(lon: number, lat: number): [number, number] {
    const cosLat = Math.cos(lat);
    const alpha = Math.acos(Math.max(-1, Math.min(1, cosLat * Math.cos(lon / 2))));
    // 1 / sinc(alpha), which tends to 1 as alpha does to 0.
    const inverseSinc = alpha < 1e-9 ? 1 : alpha / Math.sin(alpha);
    return [
        0.5 * (lon * WINKEL_COS_PHI1 + 2 * cosLat * Math.sin(lon / 2) * inverseSinc),
        0.5 * (lat + Math.sin(lat) * inverseSinc),
    ];
}

/**
 * Winkel Tripel has no closed-form inverse: Newton's method in two
 * dimensions, with the Jacobian taken by finite differences. A point off the
 * outline has no solution inside it, which the residual check turns into null.
 */
function winkelInverse(x: number, y: number): [number, number] | null {
    let lon = (2 * x) / (1 + WINKEL_COS_PHI1);
    let lat = y;
    const h = 1e-7;
    for (let i = 0; i < 30; i++) {
        lat = Math.max(-HALF_PI, Math.min(HALF_PI, lat));
        const [fx, fy] = winkelForward(lon, lat);
        const ex = fx - x;
        const ey = fy - y;
        if (Math.abs(ex) < 1e-11 && Math.abs(ey) < 1e-11) break;
        // Step away from the pole, where a step towards it would leave the domain.
        const hLat = lat + h > HALF_PI ? -h : h;
        const [ax, ay] = winkelForward(lon + h, lat);
        const [bx, by] = winkelForward(lon, lat + hLat);
        const j11 = (ax - fx) / h;
        const j21 = (ay - fy) / h;
        const j12 = (bx - fx) / hLat;
        const j22 = (by - fy) / hLat;
        const det = j11 * j22 - j12 * j21;
        if (Math.abs(det) < 1e-14) return null;
        lon -= (ex * j22 - ey * j12) / det;
        lat -= (ey * j11 - ex * j21) / det;
    }
    lat = Math.max(-HALF_PI, Math.min(HALF_PI, lat));
    const [fx, fy] = winkelForward(lon, lat);
    if (Math.abs(fx - x) > 1e-6 || Math.abs(fy - y) > 1e-6) return null;
    return [lon, lat];
}

const WINKEL_HALF_WIDTH = winkelForward(Math.PI, 0)[0];
const WINKEL_HALF_HEIGHT = winkelForward(0, HALF_PI)[1];

const WINKEL_TRIPEL = fromRaw(
    {
        id: 'winkel-tripel',
        label: 'Winkel Tripel',
        note: 'Keeps area, shape and distance errors all low at once. National Geographic’s world map since 1998.',
        minLat: -HALF_PI,
        maxLat: HALF_PI,
    },
    winkelForward,
    winkelInverse,
    WINKEL_HALF_WIDTH,
    WINKEL_HALF_HEIGHT,
    -WINKEL_HALF_HEIGHT,
);

// ─── Robinson ────────────────────────────────────────────────────────────

/**
 * Robinson's own table, every 5° from the equator: the parallel's length
 * (X) and its distance from the equator (Y), both relative. Robinson worked
 * these out by eye rather than from a formula.
 */
const ROBINSON_TABLE: readonly (readonly [number, number])[] = [
    [1.0, 0.0], [0.9986, 0.062], [0.9954, 0.124], [0.99, 0.186],
    [0.9822, 0.248], [0.973, 0.31], [0.96, 0.372], [0.9427, 0.434],
    [0.9216, 0.4958], [0.8962, 0.5571], [0.8679, 0.6176], [0.835, 0.6769],
    [0.7986, 0.7346], [0.7597, 0.7903], [0.7186, 0.8435], [0.6732, 0.8936],
    [0.6213, 0.9394], [0.5722, 0.9761], [0.5322, 1.0],
];
const ROBINSON_X = 0.8487;
const ROBINSON_Y = 1.3523;

/** The table read between rows, at a latitude in degrees from the equator. */
function robinsonRow(absLatDeg: number): [number, number] {
    const pos = Math.min(absLatDeg, 90) / 5;
    const i = Math.min(17, Math.floor(pos));
    const t = pos - i;
    const [x0, y0] = ROBINSON_TABLE[i];
    const [x1, y1] = ROBINSON_TABLE[i + 1];
    return [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t];
}

function robinsonForward(lon: number, lat: number): [number, number] {
    const [rx, ry] = robinsonRow(Math.abs(lat) / DEG);
    return [ROBINSON_X * rx * lon, ROBINSON_Y * ry * Math.sign(lat)];
}

/** Read straight back off the table: Y rises with latitude, so its row is found by search. */
function robinsonInverse(x: number, y: number): [number, number] | null {
    const ry = Math.abs(y) / ROBINSON_Y;
    if (ry > 1) return null;
    let i = 0;
    while (i < 17 && ROBINSON_TABLE[i + 1][1] < ry) i++;
    const [x0, y0] = ROBINSON_TABLE[i];
    const [x1, y1] = ROBINSON_TABLE[i + 1];
    const t = (ry - y0) / (y1 - y0);
    const latDeg = 5 * (i + t);
    const rx = x0 + (x1 - x0) * t;
    return [x / (ROBINSON_X * rx), latDeg * DEG * Math.sign(y)];
}

const ROBINSON = fromRaw(
    {
        id: 'robinson',
        label: 'Robinson',
        note: 'A compromise: no size or shape is exact, and none is far off. National Geographic’s world map from 1988 to 1998.',
        minLat: -HALF_PI,
        maxLat: HALF_PI,
    },
    robinsonForward,
    robinsonInverse,
    ROBINSON_X * Math.PI,
    ROBINSON_Y,
    -ROBINSON_Y,
);

// ─── Mercator ────────────────────────────────────────────────────────────

/** Mercator runs to infinity at the poles, so it is cut where world maps usually cut it. */
const MERCATOR_MAX_LAT = 84 * DEG;
const MERCATOR_MIN_LAT = -60 * DEG;

const mercatorY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + lat / 2));

const MERCATOR = fromRaw(
    {
        id: 'mercator',
        label: 'Mercator',
        note: 'Keeps shapes and compass bearings, so sizes swell towards the poles: Greenland looks as big as Africa. Cut at 84°N and 60°S.',
        minLat: MERCATOR_MIN_LAT,
        maxLat: MERCATOR_MAX_LAT,
    },
    (lon, lat) => [lon, mercatorY(lat)],
    (x, y) => [x, 2 * Math.atan(Math.exp(y)) - HALF_PI],
    Math.PI,
    mercatorY(MERCATOR_MAX_LAT),
    mercatorY(MERCATOR_MIN_LAT),
);

// ─── Registry ────────────────────────────────────────────────────────────

/** In the order the picker lists them. */
export const MAP_PROJECTIONS: readonly MapProjection[] = [EQUAL_EARTH, WINKEL_TRIPEL, ROBINSON, MERCATOR];

export const DEFAULT_MAP_PROJECTION: MapProjectionId = 'equal-earth';

export function getMapProjection(id: MapProjectionId): MapProjection {
    return MAP_PROJECTIONS.find((p) => p.id === id) ?? EQUAL_EARTH;
}

export function isMapProjectionId(value: unknown): value is MapProjectionId {
    return MAP_PROJECTIONS.some((p) => p.id === value);
}
