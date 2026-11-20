import { useState, useCallback } from 'react';
import { ASSETS_URL } from '@/lib/constants';


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

function extraPlace(name: string, lat: number, lon: number, pop = 50000): CityEntry {
    const col = Math.max(0, Math.min(359, Math.floor(((lon + 180) / 360) * 360)));
    const row = Math.max(0, Math.min(179, Math.floor(((90 - lat) / 180) * 180)));
    return { name, ascii: name.normalize('NFD').replace(/[\u0300-\u036f]/g, ''), lat, lon, pop, dot: [col, row] };
}

/** Notable islands & destinations absent from GeoNames populated-place city lists. */
const EXTRA_PLACES: Record<string, CityEntry[]> = {
    ES: [
        extraPlace('Tenerife', 28.2916, -16.6291, 950000),
        extraPlace('Fuerteventura', 28.3587, -14.0537, 120000),
        extraPlace('Gran Canaria', 27.9202, -15.5474, 855000),
        extraPlace('Lanzarote', 29.0469, -13.5900, 156000),
        extraPlace('La Palma', 28.6835, -17.7642, 83000),
        extraPlace('La Gomera', 28.0916, -17.1133, 22000),
        extraPlace('El Hierro', 27.7406, -18.0204, 11000),
        extraPlace('Mallorca', 39.6953, 3.0176, 920000),
        extraPlace('Ibiza', 38.9067, 1.4206, 155000),
        extraPlace('Menorca', 39.9496, 4.1104, 96000),
        extraPlace('Formentera', 38.7055, 1.4534, 12000),
    ],
    PT: [
        extraPlace('Madeira', 32.7607, -16.9595, 250000),
        extraPlace('Azores', 37.7412, -25.6756, 236000),
        extraPlace('São Miguel', 37.7804, -25.4970, 137000),
    ],
    GR: [
        extraPlace('Santorini', 36.3932, 25.4615, 15500),
        extraPlace('Mykonos', 37.4467, 25.3289, 10700),
        extraPlace('Crete', 35.2401, 24.8093, 624000),
        extraPlace('Rhodes', 36.4341, 28.2176, 125000),
        extraPlace('Corfu', 39.6243, 19.9217, 102000),
        extraPlace('Zakynthos', 37.7870, 20.8999, 41000),
        extraPlace('Kos', 36.8933, 26.9881, 37000),
    ],
    IT: [
        extraPlace('Sicily', 37.5999, 14.0154, 4800000),
        extraPlace('Sardinia', 40.1209, 9.0129, 1575000),
        extraPlace('Capri', 40.5532, 14.2222, 14000),
    ],
    FR: [
        extraPlace('Corsica', 42.0396, 9.0129, 344000),
    ],
    US: [
        extraPlace('Maui', 20.7984, -156.3319, 165000),
        extraPlace('Oahu', 21.4389, -158.0001, 1000000),
        extraPlace('Kauai', 22.0964, -159.5261, 73000),
        extraPlace('Hawaii (Big Island)', 19.5429, -155.6659, 200000),
    ],
    ID: [
        extraPlace('Bali', -8.4095, 115.1889, 4360000),
        extraPlace('Lombok', -8.6509, 116.3249, 3750000),
    ],
    TH: [
        extraPlace('Phuket', 7.8804, 98.3923, 418000),
        extraPlace('Koh Samui', 9.5120, 100.0136, 70000),
    ],
    TZ: [
        extraPlace('Zanzibar', -6.1659, 39.2026, 1890000),
    ],
    JP: [
        extraPlace('Okinawa', 26.3344, 127.8056, 1468000),
        extraPlace('Hokkaido', 43.2203, 142.8635, 5140000),
    ],
    KR: [
        extraPlace('Jeju', 33.4996, 126.5312, 678000),
    ],
};

/** Module-level cache so data is only fetched once */
let cachedCityMap: CityMapData | null = null;
let loadPromise: Promise<CityMapData> | null = null;

async function fetchCityMap(): Promise<CityMapData> {
    if (cachedCityMap) return cachedCityMap;
    if (loadPromise) return loadPromise;

    loadPromise = fetch(`${ASSETS_URL}/dot-city-map.json`)
        .then(res => { if (!res.ok) throw new Error('City map unavailable'); return res.json(); })
        .then((data: CityMapData) => {
            if (!data.index || typeof data.index !== 'object') throw new Error('Invalid city map');
            cachedCityMap = data;
            return data;
        }).catch(error => { loadPromise = null; throw error; });

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
        const base = cachedCityMap?.index[countryCode]?.cities ?? [];
        const extras = EXTRA_PLACES[countryCode];
        if (!extras) return base;
        const seen = new Set(base.map((c) => c.name.toLowerCase()));
        return [...base, ...extras.filter((e) => !seen.has(e.name.toLowerCase()))];
    }, [loaded]); // eslint-disable-line react-hooks/exhaustive-deps

    return { loaded, loading, loadCityMap, getCitiesForCountry };
}
