import { useState, useEffect } from 'react';

interface ContinentMap {
    // ISO-2 code → continent name (REST Countries API `region`)
    byCode: Record<string, string>;
    // continent name → total sovereign-state count (UN members only)
    totals: Record<string, number>;
    // set of ISO-2 codes that are UN-recognised sovereign states
    sovereignCodes: Set<string>;
    loading: boolean;
    error: boolean;
}

// Module-level cache — bump CACHE_VERSION if API fields change
const CACHE_VERSION = 3;
let cacheVersion = 0;
let cache: Pick<ContinentMap, 'byCode' | 'totals' | 'sovereignCodes'> | null = null;

export function useContinentMap(): ContinentMap {
    const [state, setState] = useState<ContinentMap>(() =>
        cache && cacheVersion === CACHE_VERSION
            ? { ...cache, loading: false, error: false }
            : { byCode: {}, totals: {}, sovereignCodes: new Set(), loading: true, error: false }
    );

    useEffect(() => {
        if (cache && cacheVersion === CACHE_VERSION) return;

        const load = async () => {
            try {
                const res = await fetch(
                    'https://restcountries.com/v3.1/all?fields=cca2,region,independent,status'
                );
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data: { cca2: string; region: string; independent: boolean; status: string }[] =
                    await res.json();

                const byCode: Record<string, string> = {};
                const totals: Record<string, number> = {};
                const sovereignCodes = new Set<string>();

                for (const country of data) {
                    if (!country.cca2 || !country.region) continue;
                    // Map every entry so territories still get a continent label
                    byCode[country.cca2] = country.region;
                    // Only sovereign UN member states count toward stats
                    if (country.independent === true && country.status === 'officially-assigned') {
                        totals[country.region] = (totals[country.region] ?? 0) + 1;
                        sovereignCodes.add(country.cca2);
                    }
                }

                cache = { byCode, totals, sovereignCodes };
                cacheVersion = CACHE_VERSION;
                setState({ byCode, totals, sovereignCodes, loading: false, error: false });
            } catch (err) {
                console.error('[useContinentMap] Failed to fetch continent data:', err);
                setState(prev => ({ ...prev, loading: false, error: true }));
            }
        };

        load();
    }, []);

    return state;
}
