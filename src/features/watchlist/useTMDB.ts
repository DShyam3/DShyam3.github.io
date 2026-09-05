import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type {
    TMDBDetails,
    TMDBSearchItem,
    TMDBSearchResponse,
} from './tmdb-types';
import { getPlatform } from './sync-logic';

const TMDB_IMAGE_BASE_URL = import.meta.env.VITE_TMDB_IMAGE_BASE_URL;

/** A search row, tagged with which endpoint it came back from. */
export interface TMDBResult extends TMDBSearchItem {
    media_type: 'movie' | 'tv';
}

export function useTMDB() {
    const [results, setResults] = useState<TMDBResult[]>([]);
    const [loading, setLoading] = useState(false);

    const fetchTMDB = useCallback(async <T,>(endpoint: string, params: Record<string, string>): Promise<T> => {
        // Always route through the tmdb-proxy edge function so the TMDB API
        // key never has to live in (or be inlined into) the client bundle.
        // The installed @supabase/supabase-js version has no `queryParams`
        // option on invoke() -- it's silently dropped rather than erroring,
        // so build the query string into the function name argument instead
        // (invoke() just concatenates it onto the URL before parsing).
        const query = new URLSearchParams({ endpoint, ...params }).toString();
        const { data, error } = await supabase.functions.invoke(`tmdb-proxy?${query}`, {
            method: 'GET',
        });

        if (error) throw error;
        return data as T;
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

            const data = await fetchTMDB<TMDBSearchResponse>(endpoint, params);

            const mediaType: TMDBResult['media_type'] =
                type === 'Movies' ? 'movie' : 'tv';
            const mappedResults = (data.results || []).slice(0, 10).map((item) => ({
                ...item,
                media_type: mediaType,
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
            const data = await fetchTMDB<TMDBDetails>(`${type}/${id}`, { append_to_response: 'watch/providers' });

            // Extract platform based on UK (GB) region. Same allowlist and
            // same precedence as the sync path, so an item added by hand and
            // the same item refreshed by the nightly sync agree.
            const platform = getPlatform(data['watch/providers']?.results?.GB);

            return {
                title: data.title || data.name,
                overview: data.overview,
                poster: data.poster_path ? getPosterUrl(data.poster_path) : null,
                release_date: data.release_date || data.first_air_date || null,
                release_year: data.release_date || data.first_air_date ? new Date(data.release_date || data.first_air_date).getFullYear() : null,
                runtime: data.runtime || (data.episode_run_time ? data.episode_run_time[0] : null),
                genres: data.genres?.map((g) => g.name) || [],
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

    const searchMulti = useCallback(async (query: string) => {
        const trimmedQuery = query.trim();
        if (!trimmedQuery) {
            setResults([]);
            return;
        }

        setLoading(true);
        try {
            const [movieData, tvData] = await Promise.all([
                fetchTMDB<TMDBSearchResponse>('search/movie', { query: trimmedQuery }),
                fetchTMDB<TMDBSearchResponse>('search/tv', { query: trimmedQuery }),
            ]);

            const movies = (movieData.results || []).slice(0, 5).map((item) => ({
                ...item,
                media_type: 'movie' as const,
            }));
            const tvShows = (tvData.results || []).slice(0, 5).map((item) => ({
                ...item,
                media_type: 'tv' as const,
            }));

            // Interleave results: movie, tv, movie, tv...
            const combined: TMDBResult[] = [];
            const maxLen = Math.max(movies.length, tvShows.length);
            for (let i = 0; i < maxLen; i++) {
                if (i < movies.length) combined.push(movies[i]);
                if (i < tvShows.length) combined.push(tvShows[i]);
            }

            setResults(combined);
        } catch (error) {
            console.error('TMDB Multi-Search Error:', error);
            setResults([]);
        } finally {
            setLoading(false);
        }
    }, [fetchTMDB]);

    return {
        results,
        loading,
        search,
        searchMulti,
        getPosterUrl,
        getMovieDetails,
    };
}
