import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface VisitedCountry {
    id: number;
    country_code: string;
    country_name: string;
    flag_url: string | null;
    created_at: string;
}

/** Returns a flagcdn.com URL for a given ISO-2 country code */
export function getFlagUrl(countryCode: string): string {
    return `https://flagcdn.com/w80/${countryCode.toLowerCase()}.png`;
}

export function useVisitedCountries() {
    const [visitedCountries, setVisitedCountries] = useState<VisitedCountry[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchCountries = useCallback(async () => {
        try {
            const { data, error } = await (supabase.from('visited_countries') as any)
                .select('*')
                .order('country_name', { ascending: true });
            if (error) throw error;
            setVisitedCountries(data || []);
        } catch (err) {
            console.error('Error fetching visited countries:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchCountries();
    }, [fetchCountries]);

    const addCountry = async (countryCode: string, countryName: string) => {
        try {
            const flag_url = getFlagUrl(countryCode);
            const { error } = await (supabase.from('visited_countries') as any)
                .insert({ country_code: countryCode, country_name: countryName, flag_url });
            if (error) throw error;
            await fetchCountries();
            return true;
        } catch (err) {
            console.error('Error adding visited country:', err);
            return false;
        }
    };

    const removeCountry = async (countryCode: string) => {
        try {
            const { error } = await (supabase.from('visited_countries') as any)
                .delete()
                .eq('country_code', countryCode);
            if (error) throw error;
            await fetchCountries();
            return true;
        } catch (err) {
            console.error('Error removing visited country:', err);
            return false;
        }
    };

    return { visitedCountries, loading, addCountry, removeCountry, fetchCountries };
}
