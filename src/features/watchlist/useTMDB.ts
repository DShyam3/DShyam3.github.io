import { useState, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type {
    FilmUniverseMember,
    TMDBCollection,
    TMDBDetails,
    TMDBSearchItem,
    TMDBSearchResponse,
    WikidataTvSpinoffLink,
} from './tmdb-types';
import { getPlatform } from './sync-logic';
import { pickTrailerKey, TRAILER_VIDEO_PARAMS } from './trailer';
import { CREDITS_APPEND, pickCreators, pickDirectors, pickTopCast } from './credits';
import { pickCollection } from './tmdb-score';
import { isImdbId } from './omdb-scores';
import { releaseYear } from './watchlist-utils';
import { seriesStatus } from './discovery-add';

const TMDB_IMAGE_BASE_URL = import.meta.env.VITE_TMDB_IMAGE_BASE_URL;
const TMDB_BACKDROP_BASE_URL = 'https://image.tmdb.org/t/p/w1280';

/** tmdb-proxy's per-minute limit, which a busy Discover page can reach. */
export const isRateLimited = (error: unknown) =>
    error instanceof FunctionsHttpError && (error.context as Response | undefined)?.status === 429;
/**
 * Details back an add or "Seen it", so a rate-limited lookup waits for the
 * proxy's window to roll over instead of failing: 5 s, 20 s, then 40 s. The
 * window is a fixed clock minute and every retry counts against it, so the
 * waits add up to more than a minute. Anything else (a title TMDB does not
 * have) fails at once.
 */
const DETAIL_RETRY_DELAYS_MS = [5_000, 20_000, 40_000];
export const detailRetry = (failures: number, error: unknown) =>
    failures < DETAIL_RETRY_DELAYS_MS.length && isRateLimited(error);
export const detailRetryDelay = (failures: number) =>
    DETAIL_RETRY_DELAYS_MS[Math.min(failures, DETAIL_RETRY_DELAYS_MS.length - 1)];

/** A search row, tagged with which endpoint it came back from. */
export interface TMDBResult extends TMDBSearchItem {
    media_type: 'movie' | 'tv';
}

export function useTMDB() {
    const queryClient = useQueryClient();
    const [results, setResults] = useState<TMDBResult[]>([]);
    const [loading, setLoading] = useState(false);
    // A response for an earlier query must not replace results for what is
    // currently in the search field (or for another dialog using this hook).
    const searchRequest = useRef(0);
    const clearSearch = useCallback(() => {
        searchRequest.current += 1;
        setResults([]);
        setLoading(false);
    }, []);

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

    const getPosterUrl = useCallback((path: string | null) => {
        if (!path) return null;
        return `${TMDB_IMAGE_BASE_URL}${path}`;
    }, []);

    const getBackdropUrl = useCallback((path: string | null) => {
        if (!path) return null;
        return `${TMDB_BACKDROP_BASE_URL}${path}`;
    }, []);

    /**
     * `retryRateLimit: false` is for a caller that already waits out the
     * proxy limit itself (the watch-history import), so the waits don't stack.
     */
    const getMovieDetails = useCallback(async (id: number, type: 'movie' | 'tv', options?: { retryRateLimit?: boolean }) => {
        try {
            return await queryClient.fetchQuery({
                queryKey: ['watchlist', 'tmdb-details', type, id],
                staleTime: 30 * 60 * 1000,
                retry: options?.retryRateLimit === false ? false : detailRetry,
                retryDelay: detailRetryDelay,
                queryFn: async () => {
                    const data = await fetchTMDB<TMDBDetails>(`${type}/${id}`, {
                        append_to_response: `watch/providers,videos,${CREDITS_APPEND[type]}${type === 'tv' ? ',external_ids' : ''}`,
                        ...TRAILER_VIDEO_PARAMS,
                    });

                    // Extract platform based on UK (GB) region. Same allowlist and
                    // same precedence as the sync path, so an item added by hand and
                    // the same item refreshed by the nightly sync agree.
                    const platform = getPlatform(data['watch/providers']?.results?.GB);
                    // Missing only if TMDB left the block out; null then, so the
                    // sync's backfill asks again. An empty cast is [], as the sync
                    // stores it.
                    const credits = type === 'movie' ? data.credits : data.aggregate_credits;
                    const regularSeasons = data.seasons?.filter((s) => s.season_number > 0 && (s.episode_count ?? 1) > 0).length;
                    const seasonCount = type === 'tv' ? (regularSeasons || data.number_of_seasons || data.seasons?.length || 0) : 0;

                    const imdbId = type === 'movie' ? data.imdb_id : data.external_ids?.imdb_id;
                    return {
                        title: data.title || data.name,
                        series_status: seriesStatus(type, data.status),
                        season_count: seasonCount,
                        overview: data.overview,
                        poster: data.poster_path ? getPosterUrl(data.poster_path) : null,
                        backdrop: data.backdrop_path ? getBackdropUrl(data.backdrop_path) : null,
                        release_date: data.release_date || data.first_air_date || null,
                        release_year: releaseYear(data.release_date || data.first_air_date) ?? null,
                        runtime: data.runtime || (data.episode_run_time ? data.episode_run_time[0] : null),
                        genres: data.genres?.map((g) => g.name) || [],
                        genre_ids: data.genres?.map((g) => g.id).filter((gid): gid is number => typeof gid === 'number') ?? [],
                        original_language: data.original_language ?? null,
                        origin_country: data.origin_country?.length ? data.origin_country : data.production_countries?.map((country) => country.iso_3166_1) ?? [],
                        tmdb_id: data.id,
                        platform: platform,
                        // Same pick as the sync, so the title has its trailer from
                        // the moment it is added rather than from the next sync.
                        trailer_key: pickTrailerKey(data.videos?.results),
                        directors: type === 'movie' && credits ? pickDirectors(credits.crew) : null,
                        creators: type === 'tv' ? pickCreators(data.created_by) : null,
                        top_cast: credits ? pickTopCast(credits.cast) : null,
                        // The nightly sync looks the OMDb scores up by this id.
                        imdb_id: isImdbId(imdbId) ? imdbId : null,
                        tmdb_rating: data.vote_average && data.vote_average > 0 ? data.vote_average : null,
                        tmdb_votes: data.vote_count && data.vote_count > 0 ? data.vote_count : null,
                        // Same pick as the sync, so a film has its series at once.
                        ...(type === 'movie'
                            ? (pickCollection(data) ?? { collection_id: null, collection_name: null })
                            : { collection_id: null, collection_name: null }),
                        // TV show callers forward this to addWatchlistItem so it
                        // doesn't refetch `tv/{id}` a second time for the season list.
                        seasons: type === 'tv' ? data.seasons ?? [] : [],
                    };
                },
            });
        } catch (error) {
            console.error('TMDB Detail Error:', error);
            return null;
        }
    }, [fetchTMDB, getPosterUrl, getBackdropUrl, queryClient]);

    /** A film series and its parts; null when TMDB or the proxy fails. */
    const getCollection = useCallback(async (id: number) => {
        try {
            return await queryClient.fetchQuery({
                queryKey: ['watchlist', 'tmdb-collection', id],
                staleTime: 24 * 60 * 60 * 1000,
                // Discover walks many collections in a row; a 429 waits out
                // the proxy's minute instead of losing the collection.
                retry: detailRetry,
                retryDelay: detailRetryDelay,
                queryFn: () => fetchTMDB<TMDBCollection>(`collection/${id}`, {}),
            });
        } catch (error) {
            console.error('TMDB Collection Error:', error);
            return null;
        }
    }, [fetchTMDB, queryClient]);

    /**
     * TV spin-off and parent relationships from Wikidata via tmdb-proxy; []
     * on failure unless `throwOnError`, for a caller that caches the answer
     * and must not keep a failure as "no spin-offs".
     */
    const getTvSpinoffs = useCallback(async (tmdbIds: number[], options?: { throwOnError?: boolean }): Promise<WikidataTvSpinoffLink[]> => {
        const clean = [...new Set(tmdbIds.filter((id) => Number.isInteger(id) && id > 0))].sort((a, b) => a - b);
        if (clean.length === 0) return [];
        try {
            return await queryClient.fetchQuery({
                queryKey: ['watchlist', 'tmdb-spinoffs', clean],
                staleTime: 24 * 60 * 60 * 1000,
                retry: false,
                queryFn: async () => {
                    const data = await fetchTMDB<{ results?: WikidataTvSpinoffLink[] }>('wikidata/tv-spinoffs', {
                        ids: clean.join(','),
                    });
                    return data.results ?? [];
                },
            });
        } catch (error) {
            console.error('Wikidata TV Spin-offs Error:', error);
            if (options?.throwOnError) throw error;
            return [];
        }
    }, [fetchTMDB, queryClient]);

    /**
     * Films of the shared universes tmdb-proxy knows (the Marvel Cinematic
     * Universe), from Wikidata; [] on failure unless `throwOnError`, as for
     * `getTvSpinoffs`. Takes no ids: the proxy's registry decides which
     * universes, and the caller which of them the library has started.
     */
    const getFilmUniverses = useCallback(async (options?: { throwOnError?: boolean }): Promise<FilmUniverseMember[]> => {
        try {
            return await queryClient.fetchQuery({
                queryKey: ['watchlist', 'tmdb-film-universes'],
                staleTime: 24 * 60 * 60 * 1000,
                retry: false,
                queryFn: async () => {
                    const data = await fetchTMDB<{ results?: FilmUniverseMember[] }>('wikidata/film-universes', {});
                    return data.results ?? [];
                },
            });
        } catch (error) {
            console.error('Wikidata Film Universes Error:', error);
            if (options?.throwOnError) throw error;
            return [];
        }
    }, [fetchTMDB, queryClient]);

    const searchMulti = useCallback(async (query: string) => {
        const trimmedQuery = query.trim();
        if (!trimmedQuery) {
            clearSearch();
            return;
        }

        const request = ++searchRequest.current;
        setResults([]);
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

            if (request === searchRequest.current) setResults(combined);
        } catch (error) {
            console.error('TMDB Multi-Search Error:', error);
            if (request === searchRequest.current) setResults([]);
        } finally {
            if (request === searchRequest.current) setLoading(false);
        }
    }, [clearSearch, fetchTMDB]);

    /**
     * A title search returned rather than put in state, and throwing when the
     * request fails, so a batch (the history import) can tell "TMDB found
     * nothing" from "the call failed" and retry the latter. `year` narrows by
     * release year (films) or first-air year (shows).
     */
    const searchTitles = useCallback(async (query: string, type: 'TV Shows' | 'Movies', year?: number): Promise<TMDBResult[]> => {
        const trimmedQuery = query.trim();
        if (!trimmedQuery) return [];
        const endpoint = type === 'Movies' ? 'search/movie' : 'search/tv';
        const params: Record<string, string> = { query: trimmedQuery };
        if (year) params[type === 'Movies' ? 'primary_release_year' : 'first_air_date_year'] = year.toString();
        const data = await fetchTMDB<TMDBSearchResponse>(endpoint, params);
        const mediaType: TMDBResult['media_type'] = type === 'Movies' ? 'movie' : 'tv';
        return (data.results || []).slice(0, 10).map((item) => ({ ...item, media_type: mediaType }));
    }, [fetchTMDB]);

    const search = useCallback(async (query: string, type: 'TV Shows' | 'Movies', year?: number) => {
        if (!query.trim()) {
            clearSearch();
            return;
        }

        const request = ++searchRequest.current;
        setResults([]);
        setLoading(true);
        try {
            const found = await searchTitles(query, type, year);
            if (request === searchRequest.current) setResults(found);
        } catch (error) {
            console.error('TMDB Search Error:', error);
            if (request === searchRequest.current) setResults([]);
        } finally {
            if (request === searchRequest.current) setLoading(false);
        }
    }, [clearSearch, searchTitles]);

    return {
        results,
        loading,
        clearSearch,
        search,
        searchTitles,
        searchMulti,
        getPosterUrl,
        getMovieDetails,
        getCollection,
        getTvSpinoffs,
        getFilmUniverses,
    };
}
