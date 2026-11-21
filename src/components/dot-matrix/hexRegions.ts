import { cellToParent, getResolution } from 'h3-js';

/**
 * What the city view calls a hex: the state or province of its country that
 * covers most of it, and the largest town inside it, per hex level. Built by
 * scripts/generate-hex-map.mjs from Natural Earth's 1:10m admin-1 areas and
 * populated places, and fetched only once the city view needs a level.
 */

interface HexRegionJson {
    res: number;
    /** [name, ISO country] per region. */
    regions: [string, string][];
    /** Each region's cells, compacted, in `regions` order. */
    cells: string[][];
    /** The largest town in a cell, by cell, with the state it is in ('' where its point fell outside every state). */
    towns: Record<string, [string, string]>;
}

export interface HexRegionLevel {
    res: number;
    names: [string, string][];
    /** Compacted cell (any resolution up to `res`) to its index in `names`. */
    compact: Map<string, number>;
    towns: Map<string, [string, string]>;
}

export function buildRegionLevel(json: HexRegionJson): HexRegionLevel {
    const compact = new Map<string, number>();
    json.cells.forEach((cells, index) => {
        for (const cell of cells) compact.set(cell, index);
    });
    return { res: json.res, names: json.regions, compact, towns: new Map(Object.entries(json.towns)) };
}

/** As `buildRegionLevel`, yielding every few thousand cells: level 5 has ~165,000, a long task in one go. */
async function buildRegionLevelChunked(json: HexRegionJson): Promise<HexRegionLevel> {
    const compact = new Map<string, number>();
    let since = 0;
    for (let index = 0; index < json.cells.length; index++) {
        for (const cell of json.cells[index]) compact.set(cell, index);
        since += json.cells[index].length;
        if (since >= 8000) {
            since = 0;
            await new Promise<void>((resolve) => {
                const channel = new MessageChannel();
                channel.port1.onmessage = () => resolve();
                channel.port2.postMessage(null);
            });
        }
    }
    return { res: json.res, names: json.regions, compact, towns: new Map(Object.entries(json.towns)) };
}

const loaded = new Map<number, HexRegionLevel>();
const pending = new Map<number, Promise<HexRegionLevel>>();

/** Fetches a level's regions and towns once; later calls share the first. */
export function loadRegionLevel(res: number): Promise<HexRegionLevel> {
    let promise = pending.get(res);
    if (!promise) {
        promise = fetch(`/data/hex-regions-v1-r${res}.json`)
            .then((response) => {
                if (!response.ok) throw new Error(`Hex regions level ${res} unavailable`);
                return response.json() as Promise<HexRegionJson>;
            })
            .then(async (json) => {
                if (json.res !== res || !Array.isArray(json.regions)) throw new Error(`Invalid hex regions level ${res}`);
                const level = await buildRegionLevelChunked(json);
                loaded.set(res, level);
                return level;
            })
            .catch((error) => {
                pending.delete(res);
                throw error;
            });
        pending.set(res, promise);
    }
    return promise;
}

/** The state or province a cell of this level is mostly in. */
export function regionOf(level: HexRegionLevel, cell: string): string | undefined {
    const res = getResolution(cell);
    for (let r = res; r >= 0; r--) {
        const index = level.compact.get(r === res ? cell : cellToParent(cell, r));
        if (index !== undefined) return level.names[index][0];
    }
    return undefined;
}

/**
 * A hex's name for the city view, or null where its level has not loaded:
 * "Bengaluru, Karnataka" with a town in it, else "Karnataka, India". A town
 * is named with its own state, which at a coarse level need not be the one
 * most of the hex is in.
 */
export function hexPlaceLabel(cell: string, countryName: string, level = loaded.get(getResolution(cell))): string | null {
    if (!level) return null;
    // A state named as its country (Luxembourg, Puerto Rico, Antarctica) adds nothing.
    const named = (state: string | undefined) => (state && state !== countryName ? state : undefined);
    const town = level.towns.get(cell);
    if (town) {
        const [name, own] = town;
        const state = named(own || regionOf(level, cell));
        return state && state !== name ? `${name}, ${state}` : `${name}, ${countryName}`;
    }
    const region = named(regionOf(level, cell));
    return region ? `${region}, ${countryName}` : null;
}
