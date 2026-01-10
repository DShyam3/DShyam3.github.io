import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export interface Episode {
    id?: number;
    episode_number: number;
    title: string;
    release_date?: string;
    runtime?: number;
    watched?: boolean;
}

export interface Season {
    id?: number;
    season_number: number;
    release_date?: string;
    episodes: Episode[];
    watched?: boolean;
}

export interface WatchlistItem {
    id: string;
    title: string;
    category: 'TV Shows' | 'Movies' | 'Upcoming';
    status?: string;
    description?: string;
    year?: number;
    runtime?: number;
    genres?: string[];
    image_url?: string;
    link?: string;
    created_at: string;
    streaming_platform?: string;
    tmdb_id?: number;
    release_date?: string;
    seasons?: Season[];
    series_status?: 'Returning Series' | 'In Production' | 'Ended' | 'Cancelled';
}

interface WatchlistContextType {
    watchlist: WatchlistItem[];
    loading: boolean;
    syncing: boolean;
    syncProgress: number;
    syncWatchlist: () => Promise<void>;
    addWatchlistItem: (item: Omit<WatchlistItem, 'id' | 'created_at'>) => Promise<void>;
    removeWatchlistItem: (id: string) => Promise<void>;
    toggleEpisodeWatched: (showId: string, seasonNumber: number, episodeNumber: number) => Promise<void>;
    isEpisodeWatched: (showId: string, seasonNumber: number, episodeNumber: number) => boolean;
    isSeasonWatched: (showId: string, season: Season) => boolean;
    getAutoStatus: (item: WatchlistItem) => string;
    fetchData: () => Promise<void>;
}

const WatchlistContext = createContext<WatchlistContextType | undefined>(undefined);

export const WatchlistProvider = ({ children }: { children: ReactNode }) => {
    const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [syncProgress, setSyncProgress] = useState(0);
    const [watchedEpisodes, setWatchedEpisodes] = useState<Set<string>>(new Set());
    const { toast } = useToast();

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [moviesResult, showsResult] = await Promise.all([
                supabase.from('movies').select('*').order('title', { ascending: true }),
                (supabase.from('tv_shows') as any).select(`
                    *,
                    tv_show_seasons (*, tv_show_episodes (*))
                `).order('title', { ascending: true })
            ]);

            if (moviesResult.error) throw moviesResult.error;
            if (showsResult.error) throw showsResult.error;

            const mappedMovies: WatchlistItem[] = (moviesResult.data || []).map(movie => ({
                id: movie.id.toString(),
                title: movie.title,
                category: 'Movies',
                description: movie.overview || '',
                year: movie.release_year || undefined,
                runtime: movie.runtime || undefined,
                genres: movie.genre ? movie.genre.split(',').map(g => g.trim()) : [],
                image_url: movie.poster || undefined,
                link: movie.tmdb_id ? `https://www.themoviedb.org/movie/${movie.tmdb_id}` : undefined,
                tmdb_id: movie.tmdb_id || undefined,
                release_date: movie.release_date || undefined,
                created_at: movie.release_date ? new Date(movie.release_date).toISOString() : new Date().toISOString(),
                streaming_platform: movie.platform,
            }));

            const mappedShows: WatchlistItem[] = (showsResult.data || []).map((show: any) => ({
                id: show.id.toString(),
                title: show.title,
                category: 'TV Shows' as const,
                status: show.status || 'Plan to Watch',
                description: show.overview || '',
                year: show.release_date ? new Date(show.release_date).getFullYear() : undefined,
                genres: show.genre ? show.genre.split(',').map((g: string) => g.trim()) : [],
                image_url: show.poster || undefined,
                link: show.tmdb_id ? `https://www.themoviedb.org/tv/${show.tmdb_id}` : undefined,
                tmdb_id: show.tmdb_id || undefined,
                release_date: show.release_date || undefined,
                created_at: show.release_date ? new Date(show.release_date).toISOString() : new Date().toISOString(),
                streaming_platform: show.platform,
                series_status: show.status as any,
                seasons: (show.tv_show_seasons || [])
                    .sort((a: any, b: any) => a.season_number - b.season_number)
                    .map((season: any) => ({
                        id: season.id,
                        season_number: season.season_number,
                        release_date: season.release_date || undefined,
                        watched: season.watched,
                        episodes: (season.tv_show_episodes || [])
                            .sort((a: any, b: any) => (a.episode_number || 0) - (b.episode_number || 0))
                            .map((ep: any) => ({
                                id: ep.id,
                                episode_number: ep.episode_number,
                                title: ep.title || `Episode ${ep.episode_number}`,
                                release_date: ep.release_date || undefined,
                                runtime: ep.runtime || undefined,
                                watched: ep.watched,
                            })),
                    })),
            }));

            setWatchlist([...mappedMovies, ...mappedShows]);

            const newWatchedSet = new Set<string>();
            mappedShows.forEach(show => {
                show.seasons?.forEach(season => {
                    season.episodes.forEach(ep => {
                        if (ep.watched) {
                            newWatchedSet.add(`${show.id}-s${season.season_number}-e${ep.episode_number}`);
                        }
                    });
                });
            });
            setWatchedEpisodes(newWatchedSet);

        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const stored = localStorage.getItem('watched_episodes');
        if (stored) {
            try { setWatchedEpisodes(new Set(JSON.parse(stored))); } catch (e) { }
        }
        fetchData();
    }, [fetchData]);

    const getAutoStatus = useCallback((item: WatchlistItem) => {
        const now = new Date();
        now.setHours(0, 0, 0, 0);

        if (item.category === 'Movies') {
            if (item.release_date) {
                const releaseDate = new Date(item.release_date);
                releaseDate.setHours(0, 0, 0, 0);
                if (releaseDate > now) {
                    const diffTime = Math.abs(releaseDate.getTime() - now.getTime());
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    return `releases in ${diffDays} day${diffDays === 1 ? '' : 's'}`;
                }
            }
            return 'Released';
        }

        if (!item.seasons || item.seasons.length === 0) return 'Returning Series';

        const futureSeasons = item.seasons.filter(s => s.release_date && new Date(s.release_date) > now);
        if (futureSeasons.length > 0) {
            const earliestSeason = futureSeasons.reduce((earliest, current) => {
                if (!earliest.release_date) return current;
                if (!current.release_date) return earliest;
                return new Date(current.release_date) < new Date(earliest.release_date) ? current : earliest;
            });

            if (earliestSeason.release_date) {
                const releaseDate = new Date(earliestSeason.release_date);
                releaseDate.setHours(0, 0, 0, 0);
                const diffTime = Math.abs(releaseDate.getTime() - now.getTime());
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                return `S${earliestSeason.season_number} releases in ${diffDays} day${diffDays === 1 ? '' : 's'}`;
            }
            return 'Coming Soon';
        }

        const allEpisodes = item.seasons.flatMap(s =>
            s.episodes.map(ep => ({
                ...ep,
                season_number: s.season_number
            }))
        );
        const watchedCount = allEpisodes.filter(ep =>
            watchedEpisodes.has(`${item.id}-s${ep.season_number}-e${ep.episode_number}`)
        ).length;

        if (watchedCount === 0) return 'To Watch';
        if (watchedCount === allEpisodes.length && allEpisodes.length > 0) {
            return item.series_status === 'Ended' || item.series_status === 'Cancelled' ? 'Completed' : 'Watched';
        }

        // Check if there are any partially watched seasons
        const hasPartiallyWatchedSeason = item.seasons.some(s => {
            const seasonEpisodes = s.episodes;
            const seasonWatchedCount = seasonEpisodes.filter(ep =>
                watchedEpisodes.has(`${item.id}-s${s.season_number}-e${ep.episode_number}`)
            ).length;
            return seasonWatchedCount > 0 && seasonWatchedCount < seasonEpisodes.length;
        });

        if (hasPartiallyWatchedSeason) {
            return 'Watching';
        }

        // If no partially watched season, but some episodes ARE watched (and we aren't finished),
        // it means we finished a season and haven't started the next.
        return 'To Watch';
    }, [watchedEpisodes]);

    const addWatchlistItem = async (item: Omit<WatchlistItem, 'id' | 'created_at'>) => {
        const exists = watchlist.find(i => (item.tmdb_id && i.tmdb_id === item.tmdb_id) || (i.title.toLowerCase() === item.title.toLowerCase() && i.category === item.category));
        if (exists) {
            toast({ title: 'Already in Watchlist', description: `"${item.title}" is already in your ${item.category} list.` });
            return;
        }

        if (item.category === 'Movies') {
            try {
                const { error } = await supabase.from('movies').insert({
                    title: item.title, platform: item.streaming_platform || 'Online', genre: item.genres?.join(', ') || null,
                    poster: item.image_url || null, overview: item.description || null, tmdb_id: item.tmdb_id || null, release_date: item.release_date || null,
                    runtime: item.runtime || null, release_year: item.year || null,
                });
                if (error) throw error;
                await fetchData();
                toast({ title: 'Success', description: 'Movie added to watchlist' });
            } catch (error) {
                toast({ title: 'Error', description: 'Failed to add movie', variant: 'destructive' });
            }
        } else if (item.category === 'TV Shows') {
            try {
                const { data: show, error: showError } = await (supabase.from('tv_shows') as any).insert({
                    title: item.title, platform: item.streaming_platform || 'Online', genre: item.genres?.join(', ') || null,
                    poster: item.image_url || null, overview: item.description || null, tmdb_id: item.tmdb_id || null, release_date: item.release_date || null,
                    status: item.series_status || 'Returning Series',
                }).select().single();

                if (showError) throw showError;

                if (item.tmdb_id) {
                    const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY;
                    const TMDB_BASE_URL = import.meta.env.VITE_TMDB_BASE_URL;
                    const showDetails = await (await fetch(`${TMDB_BASE_URL}/tv/${item.tmdb_id}?api_key=${TMDB_API_KEY}`)).json();
                    if (showDetails.seasons) {
                        for (const s of showDetails.seasons) {
                            if (s.season_number === 0) continue;
                            const { data: season, error: sErr } = await (supabase.from('tv_show_seasons') as any).insert({ tv_show_id: show.id, season_number: s.season_number, release_date: s.air_date || null }).select().single();
                            if (sErr) continue;
                            const sDetails = await (await fetch(`${TMDB_BASE_URL}/tv/${item.tmdb_id}/season/${s.season_number}?api_key=${TMDB_API_KEY}`)).json();
                            if (sDetails.episodes) {
                                const eps = sDetails.episodes.map((v: any) => ({ season_id: season.id, episode_number: v.episode_number, title: v.name, runtime: v.runtime || null, release_date: v.air_date || null }));
                                await (supabase.from('tv_show_episodes') as any).insert(eps);
                            }
                        }
                    }
                }
                await fetchData();
                toast({ title: 'Success', description: 'TV Show added' });
            } catch (error) {
                toast({ title: 'Error', description: 'Failed to add TV Show', variant: 'destructive' });
            }
        }
    };

    const removeWatchlistItem = async (id: string) => {
        const itemToRemove = watchlist.find(item => item.id === id);
        if (!itemToRemove) return;
        try {
            const table = itemToRemove.category === 'Movies' ? 'movies' : 'tv_shows';
            const { error } = await (supabase.from(table) as any).delete().eq('id', parseInt(id));
            if (error) throw error;
            setWatchlist(prev => prev.filter(item => item.id !== id));
            toast({ title: 'Success', description: 'Item removed' });
        } catch (error) {
            toast({ title: 'Error', description: 'Failed to remove item', variant: 'destructive' });
        }
    };


    const toggleEpisodeWatched = async (showId: string, seasonNumber: number, episodeNumber: number) => {
        const episodeKey = `${showId}-s${seasonNumber}-e${episodeNumber}`;
        const isCurrentlyWatched = watchedEpisodes.has(episodeKey);
        const nextWatched = !isCurrentlyWatched;

        setWatchedEpisodes(prev => {
            const next = new Set(prev);
            if (nextWatched) next.add(episodeKey);
            else next.delete(episodeKey);
            localStorage.setItem('watched_episodes', JSON.stringify([...next]));
            return next;
        });

        try {
            const show = watchlist.find(s => s.id === showId);
            const season = show?.seasons?.find(s => s.season_number === seasonNumber);
            const episode = season?.episodes.find(e => e.episode_number === episodeNumber);
            if (episode?.id) {
                await (supabase.from('tv_show_episodes') as any).update({
                    watched: nextWatched
                }).eq('id', episode.id);
            }
        } catch (error) { console.error(error); }
    };

    const isEpisodeWatched = (showId: string, seasonNumber: number, episodeNumber: number) => {
        return watchedEpisodes.has(`${showId}-s${seasonNumber}-e${episodeNumber}`);
    };

    const isSeasonWatched = (showId: string, season: Season) => {
        return season.episodes.every(ep => isEpisodeWatched(showId, season.season_number, ep.episode_number));
    };

    const syncWatchlist = async () => {
        setSyncing(true);
        setSyncProgress(0);
        const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY;
        const TMDB_BASE_URL = import.meta.env.VITE_TMDB_BASE_URL;
        const TMDB_IMAGE_BASE_URL = import.meta.env.VITE_TMDB_IMAGE_BASE_URL;

        const getPlatform = (providers: any) => {
            if (!providers) return 'Online';
            const available = [
                ...(providers.flatrate || []),
                ...(providers.free || []),
                ...(providers.ads || [])
            ];
            const allowed = [
                { tmdbName: 'netflix', displayName: 'Netflix' },
                { tmdbName: 'disney plus', displayName: 'Disney+' },
                { tmdbName: 'amazon prime video', displayName: 'Prime Video' },
                { tmdbName: 'apple tv plus', displayName: 'Apple TV+' },
                { tmdbName: 'bbc iplayer', displayName: 'BBC iPlayer' },
            ];
            for (const a of allowed) {
                if (available.some((p: any) => p.provider_name?.toLowerCase() === a.tmdbName)) {
                    return a.displayName;
                }
            }
            return 'Online';
        };

        try {
            const itemsToSync = watchlist.filter(item => item.tmdb_id);
            const chunkSize = 30;
            let processedCount = 0;
            for (let i = 0; i < itemsToSync.length; i += chunkSize) {
                const chunk = itemsToSync.slice(i, i + chunkSize);
                await Promise.all(chunk.map(async (item) => {
                    const type = item.category === 'TV Shows' ? 'tv' : 'movie';
                    const data = await (await fetch(`${TMDB_BASE_URL}/${type}/${item.tmdb_id}?api_key=${TMDB_API_KEY}&append_to_response=watch/providers`)).json();
                    if (!data.id) return;

                    // Common fields for both movies and TV shows
                    const commonUpdates: any = {};
                    if (!item.image_url && data.poster_path) commonUpdates.poster = `${TMDB_IMAGE_BASE_URL}${data.poster_path}`;
                    if (!item.description && data.overview) commonUpdates.overview = data.overview;
                    if (data.release_date || data.first_air_date) commonUpdates.release_date = data.release_date || data.first_air_date;
                    if (!item.genres?.length && data.genres) commonUpdates.genre = data.genres.map((g: any) => g.name).join(', ');
                    commonUpdates.platform = getPlatform(data['watch/providers']?.results?.GB);

                    if (item.category === 'Movies') {
                        // Movies have release_year and runtime columns
                        const movieUpdates = { ...commonUpdates };
                        if (!item.year && (data.release_date || data.first_air_date)) {
                            movieUpdates.release_year = new Date(data.release_date || data.first_air_date).getFullYear();
                        }
                        if (data.runtime) movieUpdates.runtime = data.runtime;
                        await supabase.from('movies').update(movieUpdates).eq('id', parseInt(item.id));
                    } else {
                        // TV shows only have status (no release_year or runtime columns)
                        const tvUpdates = { ...commonUpdates };
                        tvUpdates.status = data.status;
                        await (supabase.from('tv_shows') as any).update(tvUpdates).eq('id', parseInt(item.id));

                        // Season 0 Cleanup Logic
                        const tmdbSeason0 = data.seasons?.find((s: any) => s.season_number === 0);
                        const localSeason0 = item.seasons?.find(s => s.season_number === 0);

                        if (localSeason0) {
                            let shouldDelete = false;
                            let reason = '';

                            // Check 1: TMDB doesn't have Season 0 or it has 0 episodes
                            if (!tmdbSeason0 || tmdbSeason0.episode_count === 0) {
                                shouldDelete = true;
                                reason = 'TMDB has no Season 0 or it has 0 episodes';
                            }

                            // Check 2: Season 0 release date matches any other season (duplicate)
                            if (!shouldDelete && localSeason0.release_date) {
                                const otherSeasons = item.seasons?.filter(s => s.season_number !== 0) || [];
                                const isDuplicate = otherSeasons.some(s =>
                                    s.release_date && s.release_date === localSeason0.release_date
                                );
                                if (isDuplicate) {
                                    shouldDelete = true;
                                    reason = 'Season 0 release date matches another season (duplicate)';
                                }
                            }

                            if (shouldDelete) {

                                await (supabase.from('tv_show_seasons') as any).delete().eq('id', localSeason0.id);
                            }
                        }

                        // Sync regular seasons (skip Season 0 and empty announced seasons)
                        if (data.seasons) {
                            await Promise.all(data.seasons.map(async (s: any) => {
                                if (s.season_number === 0) return;

                                // Skip seasons that have been announced but have no episodes yet
                                if (s.episode_count === 0) {
                                    // Check if we have this empty season locally and remove it
                                    const localEmptySeason = item.seasons?.find(ls => ls.season_number === s.season_number);
                                    if (localEmptySeason) {

                                        await (supabase.from('tv_show_seasons') as any).delete().eq('id', localEmptySeason.id);
                                    }
                                    return; // Don't add this season
                                }

                                try {
                                    const { data: dbS, error: sErr } = await (supabase.from('tv_show_seasons') as any).upsert({ tv_show_id: parseInt(item.id), season_number: s.season_number, release_date: s.air_date || null }, { onConflict: 'tv_show_id,season_number' }).select().single();
                                    if (sErr || !dbS) return;

                                    // Determine if we should update episode details
                                    // Only fetch episode details for seasons that:
                                    // 1. Have no release date (unknown)
                                    // 2. Release date is in the future
                                    // 3. Released within the last 90 days (to catch any date changes)
                                    const now = new Date();
                                    now.setHours(0, 0, 0, 0);
                                    const seasonReleaseDate = s.air_date ? new Date(s.air_date) : null;
                                    const ninetyDaysAgo = new Date(now);
                                    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

                                    const shouldUpdateEpisodes = !seasonReleaseDate ||
                                        seasonReleaseDate >= ninetyDaysAgo; // Future or within 90 days

                                    if (shouldUpdateEpisodes) {
                                        const sDetails = await (await fetch(`${TMDB_BASE_URL}/tv/${item.tmdb_id}/season/${s.season_number}?api_key=${TMDB_API_KEY}`)).json();
                                        if (sDetails.episodes && sDetails.episodes.length > 0) {
                                            const eps = sDetails.episodes.map((v: any) => {
                                                const ep: any = { season_id: dbS.id, episode_number: v.episode_number };
                                                if (v.name) ep.title = v.name;
                                                if (v.runtime) ep.runtime = v.runtime; else if (data.episode_run_time?.[0]) ep.runtime = data.episode_run_time[0];
                                                if (v.air_date) ep.release_date = v.air_date;
                                                return ep;
                                            });
                                            await (supabase.from('tv_show_episodes') as any).upsert(eps, { onConflict: 'season_id,episode_number' });
                                        } else {
                                            // Season was added but has no episode details - remove it

                                            await (supabase.from('tv_show_seasons') as any).delete().eq('id', dbS.id);
                                        }
                                    }
                                } catch (e) { }
                            }));

                            // Clean up any local seasons that no longer exist in TMDB (except Season 0)
                            const localSeasons = item.seasons?.filter(s => s.season_number !== 0) || [];
                            for (const localSeason of localSeasons) {
                                const existsInTmdb = data.seasons.some((ts: any) => ts.season_number === localSeason.season_number);
                                if (!existsInTmdb) {

                                    await (supabase.from('tv_show_seasons') as any).delete().eq('id', localSeason.id);
                                }
                            }
                        }
                    }
                    processedCount++;
                    setSyncProgress(Math.round((processedCount / itemsToSync.length) * 100));
                }));
            }
            await fetchData();
            toast({ title: 'Success', description: 'Watchlist synchronized' });
        } catch (error) { toast({ title: 'Error', description: 'Sync failed', variant: 'destructive' }); }
        finally { setSyncing(false); setTimeout(() => setSyncProgress(0), 1000); }
    };

    return (
        <WatchlistContext.Provider value={{ watchlist, loading, syncing, syncProgress, syncWatchlist, addWatchlistItem, removeWatchlistItem, toggleEpisodeWatched, isEpisodeWatched, isSeasonWatched, getAutoStatus, fetchData }}>
            {children}
        </WatchlistContext.Provider>
    );
};

export const useWatchlistContext = () => {
    const context = useContext(WatchlistContext);
    if (!context) throw new Error('useWatchlistContext must be used within a WatchlistProvider');
    return context;
};
