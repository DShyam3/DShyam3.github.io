import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY;
const TMDB_BASE_URL = import.meta.env.VITE_TMDB_BASE_URL;
const TMDB_IMAGE_BASE_URL = import.meta.env.VITE_TMDB_IMAGE_BASE_URL;

export interface TMDBResult {
    id: number;
    title?: string;
    name?: string;
    release_date?: string;
    first_air_date?: string;
    poster_path: string | null;
    overview: string;
    media_type: 'movie' | 'tv';
}

export function useTMDB() {
    const [results, setResults] = useState<TMDBResult[]>([]);
    const [loading, setLoading] = useState(false);

    const fetchTMDB = useCallback(async (endpoint: string, params: Record<string, string>) => {
        // If we have a local API key, use it directly (faster for development)
        if (TMDB_API_KEY && TMDB_API_KEY !== 'your-tmdb-api-key') {
            const queryParams = new URLSearchParams({ ...params, api_key: TMDB_API_KEY });
            const response = await fetch(`${TMDB_BASE_URL}/${endpoint}?${queryParams.toString()}`);
            return await response.json();
        }

        // Secure Mode: Use Supabase Edge Function Proxy to hide the key
        const { data, error } = await supabase.functions.invoke('tmdb-proxy', {
            method: 'GET',
            queryParams: { endpoint, ...params }
        });

        if (error) throw error;
        return data;
    }, []);

    const search = useCallback(async (query: string, type: 'TV Shows' | 'Movies', year?: number) => {
        const trimmedQuery = query.trim();
        if (!trimmedQuery) {
            setResults([]);
            return;
        }

        setLoading(true);
        try {
            const endpoint = type === 'Movies' ? 'search/movie' : 'search/tv';
            const params: Record<string, string> = { query: trimmedQuery };

            if (year) {
                if (type === 'Movies') params.primary_release_year = year.toString();
                else params.first_air_date_year = year.toString();
            }

            const data = await fetchTMDB(endpoint, params);

            const mappedResults = (data.results || []).slice(0, 10).map((item: any) => ({
                ...item,
                media_type: type === 'Movies' ? 'movie' : 'tv'
            }));

            setResults(mappedResults);
        } catch (error) {
            console.error('TMDB Search Error:', error);
            setResults([]);
        } finally {
            setLoading(false);
        }
    }, [fetchTMDB]);

    const getPosterUrl = useCallback((path: string | null) => {
        if (!path) return null;
        return `${TMDB_IMAGE_BASE_URL}${path}`;
    }, []);

    const getMovieDetails = useCallback(async (id: number, type: 'movie' | 'tv') => {
        setLoading(true);
        try {
            const data = await fetchTMDB(`${type}/${id}`, { append_to_response: 'watch/providers' });

            // Extract platform based on UK (GB) region
            const providers = data['watch/providers']?.results?.GB;
            let platform = 'Online';

            if (providers) {
                const available = [...(providers.flatrate || []), ...(providers.free || [])];
                const allowedPlatforms = [
                    { tmdbNames: ['Netflix'], displayName: 'Netflix' },
                    { tmdbNames: ['Disney Plus', 'Disney+'], displayName: 'Disney+' },
                    { tmdbNames: ['Amazon Prime Video'], displayName: 'Prime Video' },
                    { tmdbNames: ['Apple TV Plus', 'Apple TV+', 'Apple TV'], displayName: 'Apple TV+' },
                    { tmdbNames: ['BBC iPlayer'], displayName: 'BBC iPlayer' },
                    { tmdbNames: ['ITVX'], displayName: 'ITVX' },
                ];

                for (const allowed of allowedPlatforms) {
                    if (available.some((p: any) =>
                        allowed.tmdbNames.some(name =>
                            p.provider_name?.toLowerCase() === name.toLowerCase()
                        )
                    )) {
                        platform = allowed.displayName;
                        break;
                    }
                }
            }

            return {
                title: data.title || data.name,
                overview: data.overview,
                poster: data.poster_path ? getPosterUrl(data.poster_path) : null,
                release_date: data.release_date || data.first_air_date || null,
                release_year: data.release_date || data.first_air_date ? new Date(data.release_date || data.first_air_date).getFullYear() : null,
                runtime: data.runtime || (data.episode_run_time ? data.episode_run_time[0] : null),
                genres: data.genres?.map((g: any) => g.name) || [],
                tmdb_id: data.id,
                platform: platform,
            };
        } catch (error) {
            console.error('TMDB Detail Error:', error);
            return null;
        } finally {
            setLoading(false);
        }
    }, [fetchTMDB, getPosterUrl]);

    return {
        results,
        loading,
        search,
        getPosterUrl,
        getMovieDetails,
    };
}
