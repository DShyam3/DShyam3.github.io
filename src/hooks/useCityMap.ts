import { useState, useCallback } from 'react';

export interface CityEntry {
    name: string;
    ascii: string;
    lat: number;
    lon: number;
    pop: number;
    dot: [number, number];
}

interface CityMapIndex {
    [countryCode: string]: {
        cities: CityEntry[];
    };
}

interface CityMapData {
    index: CityMapIndex;
}

/** Module-level cache so data is only fetched once */
let cachedCityMap: CityMapData | null = null;
let loadPromise: Promise<CityMapData> | null = null;

async function fetchCityMap(): Promise<CityMapData> {
    if (cachedCityMap) return cachedCityMap;
    if (loadPromise) return loadPromise;

    loadPromise = fetch('/data/dot-city-map.json')
        .then(res => res.json())
        .then((data: CityMapData) => {
            cachedCityMap = data;
            return data;
        });

    return loadPromise;
}

/**
 * Lazy loads the city map data. Call `loadCityMap()` when user activates city view.
 * Returns cities for a specific country with `getCitiesForCountry(code)`.
 */
export function useCityMap() {
    const [loaded, setLoaded] = useState(!!cachedCityMap);
    const [loading, setLoading] = useState(false);

    const loadCityMap = useCallback(async () => {
        if (cachedCityMap) {
            setLoaded(true);
            return;
        }
        setLoading(true);
        try {
            await fetchCityMap();
            setLoaded(true);
        } catch (err) {
            console.error('Error loading city map data:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    const getCitiesForCountry = useCallback((countryCode: string): CityEntry[] => {
        if (!cachedCityMap) return [];
        return cachedCityMap.index[countryCode]?.cities ?? [];
    }, [loaded]); // eslint-disable-line react-hooks/exhaustive-deps

    return { loaded, loading, loadCityMap, getCitiesForCountry };
}
