import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface VisitedCity {
    id: number;
    country_code: string;
    city_name: string;
    lat: number;
    lon: number;
    dot_col: number;
    dot_row: number;
    created_at: string;
}

export function useVisitedCities() {
    const [visitedCities, setVisitedCities] = useState<VisitedCity[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchCities = useCallback(async () => {
        try {
            const { data, error } = await (supabase.from('visited_cities') as any)
                .select('*')
                .order('city_name', { ascending: true });
            if (error) throw error;
            setVisitedCities(data || []);
        } catch (err) {
            console.error('Error fetching visited cities:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchCities();
    }, [fetchCities]);

    /** Group cities by country code — memoized */
    const citiesByCountry = useMemo(() => {
        const groups: Record<string, VisitedCity[]> = {};
        for (const city of visitedCities) {
            if (!groups[city.country_code]) groups[city.country_code] = [];
            groups[city.country_code].push(city);
        }
        return groups;
    }, [visitedCities]);

    /** Set of "col,row" keys for visited city dots — O(1) globe lookup */
    const visitedDotKeys = useMemo(() => {
        const s = new Set<string>();
        for (const city of visitedCities) {
            s.add(`${city.dot_col},${city.dot_row}`);
        }
        return s;
    }, [visitedCities]);

    const addCity = async (
        countryCode: string,
        cityName: string,
        lat: number,
        lon: number,
        dotCol: number,
        dotRow: number
    ) => {
        try {
            const { error } = await (supabase.from('visited_cities') as any)
                .insert({
                    country_code: countryCode,
                    city_name: cityName,
                    lat,
                    lon,
                    dot_col: dotCol,
                    dot_row: dotRow,
                });
            if (error) throw error;
            await fetchCities();
            return true;
        } catch (err) {
            console.error('Error adding visited city:', err);
            return false;
        }
    };

    const removeCity = async (countryCode: string, cityName: string) => {
        try {
            const { error } = await (supabase.from('visited_cities') as any)
                .delete()
                .eq('country_code', countryCode)
                .eq('city_name', cityName);
            if (error) throw error;
            await fetchCities();
            return true;
        } catch (err) {
            console.error('Error removing visited city:', err);
            return false;
        }
    };

    return {
        visitedCities,
        citiesByCountry,
        visitedDotKeys,
        loading,
        addCity,
        removeCity,
        fetchCities,
    };
}
