import { useCallback } from 'react';
import { queryOptions, useQuery, useQueryClient } from '@tanstack/react-query';
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

/**
 * In the query cache rather than component state, so the site warm-up can
 * fetch it before Travel opens and a return visit renders without waiting.
 */
export const visitedCountriesQuery = queryOptions({
    queryKey: ['travel', 'visited-countries'],
    queryFn: async () => {
        const { data, error } = await supabase.from('visited_countries')
            .select('*')
            .order('country_name', { ascending: true });
        if (error) {
            console.error('Error fetching visited countries:', error);
            throw error;
        }
        const rows: VisitedCountry[] = data ?? [];
        return rows;
    },
});

const NO_COUNTRIES: VisitedCountry[] = [];

export function useVisitedCountries() {
    const queryClient = useQueryClient();
    const { data: visitedCountries = NO_COUNTRIES, isLoading: loading } = useQuery(visitedCountriesQuery);

    const fetchCountries = useCallback(
        () => queryClient.invalidateQueries({ queryKey: visitedCountriesQuery.queryKey }),
        [queryClient],
    );

    const addCountry = async (countryCode: string, countryName: string) => {
        try {
            const flag_url = getFlagUrl(countryCode);
            const { error } = await supabase.from('visited_countries')
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
            const { error } = await supabase.from('visited_countries')
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
