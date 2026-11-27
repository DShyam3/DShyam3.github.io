/// <reference lib="webworker" />
import { getResolution } from 'h3-js';
import { hexPlaceLabel, loadRegionLevel } from './hexRegions';

export interface PlaceRequest {
    cell: string;
    country: string;
}

export interface PlaceResult extends PlaceRequest {
    label: string | null;
}

// A fine region catalogue is several MB. Decode and keep it in the worker;
// only the label for the latest hover ever needs to cross back to the map.
const scope = self as unknown as DedicatedWorkerGlobalScope;
let latest: PlaceRequest;
scope.onmessage = async ({ data }: MessageEvent<PlaceRequest>) => {
    latest = data;
    try {
        const level = await loadRegionLevel(getResolution(data.cell));
        if (latest === data) {
            scope.postMessage({ ...data, label: hexPlaceLabel(data.cell, data.country, level) } satisfies PlaceResult);
        }
    } catch {
        // The caller has already shown the country. The level loader retries on the next request.
    }
};
