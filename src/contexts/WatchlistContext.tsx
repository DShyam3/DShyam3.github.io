import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
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

interface SyncLogEntry {
    id: number;
    synced_at: string;
    sync_type: 'auto' | 'manual';
    status: 'success' | 'error';
    items_synced: number;
    error_message?: string;
    duration_ms: number;
}

interface WatchlistContextType {
    watchlist: WatchlistItem[];
    loading: boolean;
    syncing: boolean;
    syncProgress: number;
    lastSyncTime: string | null;
    lastAutoSyncTime: string | null;
    nextAutoSyncTime: string;
    syncLog: SyncLogEntry[];
    autoSyncEnabled: boolean;
    syncWatchlist: (type?: 'manual' | 'auto') => Promise<void>;
    addWatchlistItem: (item: Omit<WatchlistItem, 'id' | 'created_at'>) => Promise<void>;
    removeWatchlistItem: (id: string) => Promise<void>;
    toggleEpisodeWatched: (showId: string, seasonNumber: number, episodeNumber: number) => Promise<void>;
    isEpisodeWatched: (showId: string, seasonNumber: number, episodeNumber: number) => boolean;
    isSeasonWatched: (showId: string, season: Season) => boolean;
    getAutoStatus: (item: WatchlistItem) => string;
    fetchData: () => Promise<void>;
}

const WatchlistContext = createContext<WatchlistContextType | undefined>(undefined);

// Auto-sync target hour (6 AM in user's local timezone)
const AUTO_SYNC_HOUR = 6;

/** Get the most recent 6 AM timestamp (today if past 6 AM, yesterday if before 6 AM) */
const getMostRecent6AM = () => {
    const now = new Date();
    const target = new Date(now);
    target.setHours(AUTO_SYNC_HOUR, 0, 0, 0);
    if (now < target) {
        target.setDate(target.getDate() - 1);
    }
    return target;
};

/** Get the next upcoming 6 AM */
const getNext6AM = () => {
    const now = new Date();
    const target = new Date(now);
    target.setHours(AUTO_SYNC_HOUR, 0, 0, 0);
    if (now >= target) {
        target.setDate(target.getDate() + 1);
    }
    return target;
};

export const WatchlistProvider = ({ children }: { children: ReactNode }) => {
    const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [syncProgress, setSyncProgress] = useState(0);
    const [watchedEpisodes, setWatchedEpisodes] = useState<Set<string>>(new Set());
    const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
    const [lastAutoSyncTime, setLastAutoSyncTime] = useState<string | null>(null);
    const [syncLog, setSyncLog] = useState<SyncLogEntry[]>([]);
    const [nextAutoSyncTime, setNextAutoSyncTime] = useState<string>(getNext6AM().toISOString());
    const autoSyncEnabled = true;
    const autoSyncTriggeredRef = useRef(false);
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

    // Fetch sync log from Supabase
    const fetchSyncLog = useCallback(async () => {
        try {
            const { data, error } = await (supabase.from('sync_log') as any)
                .select('*')
                .order('synced_at', { ascending: false })
                .limit(20);
            if (error) throw error;
            if (data) {
                setSyncLog(data);
                // Find most recent successful sync of any type
                const lastSuccessful = data.find((e: SyncLogEntry) => e.status === 'success');
                if (lastSuccessful) {
                    setLastSyncTime(lastSuccessful.synced_at);
                }
                // Find most recent successful auto sync
                const lastAutoSuccess = data.find((e: SyncLogEntry) => e.sync_type === 'auto' && e.status === 'success');
                if (lastAutoSuccess) {
                    setLastAutoSyncTime(lastAutoSuccess.synced_at);
                }
            }
        } catch (error) {
            console.error('Error fetching sync log:', error);
        }
    }, []);

    // Log a sync event to Supabase
    const logSync = useCallback(async (syncType: 'auto' | 'manual', status: 'success' | 'error', itemsSynced: number, durationMs: number, errorMessage?: string) => {
        try {
            await (supabase.from('sync_log') as any).insert({
                sync_type: syncType,
                status,
                items_synced: itemsSynced,
                duration_ms: durationMs,
                error_message: errorMessage || null,
            });
            // Clean up old logs (keep last 50)
            const { data: oldLogs } = await (supabase.from('sync_log') as any)
                .select('id')
                .order('synced_at', { ascending: false })
                .range(50, 1000);
            if (oldLogs && oldLogs.length > 0) {
                await (supabase.from('sync_log') as any)
                    .delete()
                    .in('id', oldLogs.map((l: any) => l.id));
            }
            await fetchSyncLog();
        } catch (error) {
            console.error('Error logging sync:', error);
        }
    }, [fetchSyncLog]);

    useEffect(() => {
        const stored = localStorage.getItem('watched_episodes');
        if (stored) {
            try { setWatchedEpisodes(new Set(JSON.parse(stored))); } catch (e) { }
        }
        fetchData();
        fetchSyncLog();
    }, [fetchData, fetchSyncLog]);

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

        let watchedCount = 0;
        let totalEpisodes = 0;
        let hasPartiallyWatchedSeason = false;

        for (const s of item.seasons) {
            const seasonEpisodes = s.episodes;
            const seasonTotal = seasonEpisodes.length;
            totalEpisodes += seasonTotal;

            let seasonWatchedCount = 0;
            for (const ep of seasonEpisodes) {
                if (watchedEpisodes.has(`${item.id}-s${s.season_number}-e${ep.episode_number}`)) {
                    seasonWatchedCount++;
                }
            }

            watchedCount += seasonWatchedCount;
            if (seasonWatchedCount > 0 && seasonWatchedCount < seasonTotal) {
                hasPartiallyWatchedSeason = true;
            }
        }

        if (watchedCount === 0) return 'To Watch';
        if (watchedCount === totalEpisodes && totalEpisodes > 0) {
            return item.series_status === 'Ended' || item.series_status === 'Cancelled' ? 'Completed' : 'Watched';
        }

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
                            // Skip Season 0 and seasons with no episodes
                            if (s.season_number === 0 || s.episode_count === 0) continue;

                            const { data: season, error: sErr } = await (supabase.from('tv_show_seasons') as any).insert({ tv_show_id: show.id, season_number: s.season_number, release_date: s.air_date || null }).select().single();
                            if (sErr) continue;

                            const sDetails = await (await fetch(`${TMDB_BASE_URL}/tv/${item.tmdb_id}/season/${s.season_number}?api_key=${TMDB_API_KEY}`)).json();
                            if (sDetails.episodes && sDetails.episodes.length > 0) {
                                // Filter out TBA episodes (episodes with no air date)
                                const validEpisodes = sDetails.episodes.filter((v: any) => v.air_date);
                                if (validEpisodes.length > 0) {
                                    const eps = validEpisodes.map((v: any) => ({
                                        season_id: season.id,
                                        episode_number: v.episode_number,
                                        title: v.name,
                                        runtime: v.runtime || null,
                                        release_date: v.air_date
                                    }));
                                    await (supabase.from('tv_show_episodes') as any).insert(eps);
                                } else {
                                    // No valid episodes, remove the season
                                    await (supabase.from('tv_show_seasons') as any).delete().eq('id', season.id);
                                }
                            } else {
                                // No episodes, remove the season
                                await (supabase.from('tv_show_seasons') as any).delete().eq('id', season.id);
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
            if (itemToRemove.category === 'TV Shows') {
                // For TV shows, manually cascade delete seasons and episodes
                // First, get all seasons for this show
                const { data: seasons } = await (supabase.from('tv_show_seasons') as any)
                    .select('id')
                    .eq('tv_show_id', parseInt(id));

                if (seasons && seasons.length > 0) {
                    const seasonIds = seasons.map((s: any) => s.id);

                    // Delete all episodes for these seasons
                    await (supabase.from('tv_show_episodes') as any)
                        .delete()
                        .in('season_id', seasonIds);

                    // Delete all seasons
                    await (supabase.from('tv_show_seasons') as any)
                        .delete()
                        .eq('tv_show_id', parseInt(id));
                }

                // Finally, delete the TV show itself
                const { error } = await (supabase.from('tv_shows') as any)
                    .delete()
                    .eq('id', parseInt(id));
                if (error) throw error;
            } else {
                // For movies, simple delete
                const { error } = await supabase.from('movies')
                    .delete()
                    .eq('id', parseInt(id));
                if (error) throw error;
            }

            setWatchlist(prev => prev.filter(item => item.id !== id));
            toast({ title: 'Success', description: 'Item removed' });
        } catch (error) {
            console.error('Error removing item:', error);
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

    const syncWatchlist = async (type: 'manual' | 'auto' = 'manual') => {
        if (syncing) return; // Prevent concurrent syncs
        setSyncing(true);
        setSyncProgress(0);
        const startTime = Date.now();
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
                { tmdbNames: ['Netflix'], displayName: 'Netflix' },
                { tmdbNames: ['Disney Plus', 'Disney+'], displayName: 'Disney+' },
                { tmdbNames: ['Amazon Prime Video'], displayName: 'Prime Video' },
                { tmdbNames: ['Apple TV Plus', 'Apple TV+', 'Apple TV'], displayName: 'Apple TV+' },
                { tmdbNames: ['BBC iPlayer'], displayName: 'BBC iPlayer' },
            ];
            for (const a of allowed) {
                if (available.some((p: any) =>
                    a.tmdbNames.some(name =>
                        p.provider_name?.toLowerCase() === name.toLowerCase()
                    )
                )) {
                    return a.displayName;
                }
            }
            return 'Online';
        };

        let itemsSynced = 0;
        try {
            const itemsToSync = watchlist.filter(item => item.tmdb_id);
            // Use smaller chunks for better progress tracking in background tabs
            const chunkSize = 50;
            let processedCount = 0;
            for (let i = 0; i < itemsToSync.length; i += chunkSize) {
                const chunk = itemsToSync.slice(i, i + chunkSize);
                await Promise.all(chunk.map(async (item) => {
                    try {
                        const tmdbType = item.category === 'TV Shows' ? 'tv' : 'movie';
                        const data = await (await fetch(`${TMDB_BASE_URL}/${tmdbType}/${item.tmdb_id}?api_key=${TMDB_API_KEY}&append_to_response=watch/providers`)).json();
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

                                // Check 1: TMDB doesn't have Season 0 or it has 0 episodes
                                if (!tmdbSeason0 || tmdbSeason0.episode_count === 0) {
                                    shouldDelete = true;
                                }

                                // Check 2: Season 0 release date matches any other season (duplicate)
                                if (!shouldDelete && localSeason0.release_date) {
                                    const otherSeasons = item.seasons?.filter(s => s.season_number !== 0) || [];
                                    const isDuplicate = otherSeasons.some(s =>
                                        s.release_date && s.release_date === localSeason0.release_date
                                    );
                                    if (isDuplicate) {
                                        shouldDelete = true;
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

                                        const now = new Date();
                                        now.setHours(0, 0, 0, 0);
                                        const seasonReleaseDate = s.air_date ? new Date(s.air_date) : null;
                                        const ninetyDaysAgo = new Date(now);
                                        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

                                        const isShowCurrentlyAiring = data.status === 'Returning Series' || data.status === 'In Production';
                                        const localSeason = item.seasons?.find(ls => ls.season_number === s.season_number);
                                        const localEpisodeCount = localSeason?.episodes?.length || 0;
                                        const hasEpisodeCountChanged = localEpisodeCount !== s.episode_count;

                                        const shouldUpdateEpisodes = !seasonReleaseDate ||
                                            seasonReleaseDate >= ninetyDaysAgo ||
                                            isShowCurrentlyAiring ||
                                            hasEpisodeCountChanged;

                                        if (shouldUpdateEpisodes) {
                                            const sDetails = await (await fetch(`${TMDB_BASE_URL}/tv/${item.tmdb_id}/season/${s.season_number}?api_key=${TMDB_API_KEY}`)).json();
                                            if (sDetails.episodes && sDetails.episodes.length > 0) {
                                                const validEpisodes = sDetails.episodes.filter((v: any) => v.air_date);

                                                if (validEpisodes.length > 0) {
                                                    const eps = validEpisodes.map((v: any) => {
                                                        const ep: any = { season_id: dbS.id, episode_number: v.episode_number };
                                                        ep.title = v.name || `Episode ${v.episode_number}`;
                                                        if (v.runtime) ep.runtime = v.runtime; else if (data.episode_run_time?.[0]) ep.runtime = data.episode_run_time[0];
                                                        ep.release_date = v.air_date;
                                                        return ep;
                                                    });
                                                    const { error: upsertError } = await (supabase.from('tv_show_episodes') as any).upsert(eps, { onConflict: 'season_id,episode_number' });
                                                    if (upsertError) console.error(`Episode upsert failed for ${item.title} S${s.season_number}:`, upsertError);

                                                    const validEpisodeNumbers = validEpisodes.map((v: any) => v.episode_number);
                                                    const { data: existingEpisodes } = await (supabase.from('tv_show_episodes') as any)
                                                        .select('id, episode_number')
                                                        .eq('season_id', dbS.id);

                                                    if (existingEpisodes) {
                                                        const episodesToDelete = existingEpisodes.filter((e: any) => !validEpisodeNumbers.includes(e.episode_number));
                                                        if (episodesToDelete.length > 0) {
                                                            await (supabase.from('tv_show_episodes') as any)
                                                                .delete()
                                                                .in('id', episodesToDelete.map((e: any) => e.id));
                                                        }
                                                    }
                                                } else {
                                                    await (supabase.from('tv_show_seasons') as any).delete().eq('id', dbS.id);
                                                }
                                            } else {
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
                        itemsSynced++;
                    } catch (itemError) {
                        console.error(`Error syncing item ${item.title}:`, itemError);
                    }
                    processedCount++;
                    setSyncProgress(Math.round((processedCount / itemsToSync.length) * 100));
                }));
            }
            await fetchData();
            const durationMs = Date.now() - startTime;
            const syncTime = new Date().toISOString();
            setLastSyncTime(syncTime);
            localStorage.setItem('last_sync_time', syncTime);
            await logSync(type, 'success', itemsSynced, durationMs);
            setNextAutoSyncTime(getNext6AM().toISOString());
            if (type === 'auto') {
                console.log(`[Auto-Sync] Completed at ${syncTime}. ${itemsSynced} items synced in ${(durationMs / 1000).toFixed(1)}s`);
            }
            toast({ title: type === 'auto' ? 'Auto-Sync Complete' : 'Sync Complete', description: `${itemsSynced} items synchronized${type === 'auto' ? ' (scheduled)' : ''}` });
        } catch (error) {
            const durationMs = Date.now() - startTime;
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            await logSync(type, 'error', itemsSynced, durationMs, errorMsg);
            toast({ title: 'Error', description: 'Sync failed', variant: 'destructive' });
        }
        finally { setSyncing(false); setTimeout(() => setSyncProgress(0), 1000); }
    };

    // Auto-sync: Check on load and every 15 minutes if a sync is due
    useEffect(() => {
        if (!autoSyncEnabled || loading || watchlist.length === 0) return;

        const checkAndAutoSync = async () => {
            // Prevent multiple triggers in the same session
            if (autoSyncTriggeredRef.current || syncing) return;

            const mostRecent6AM = getMostRecent6AM();

            // Check if any successful sync has happened since the most recent 6 AM
            const { data: recentSyncs } = await (supabase.from('sync_log') as any)
                .select('id')
                .gte('synced_at', mostRecent6AM.toISOString())
                .eq('status', 'success')
                .limit(1);

            if (!recentSyncs || recentSyncs.length === 0) {
                console.log(`[Auto-Sync] No sync since ${mostRecent6AM.toISOString()}. Triggering auto-sync...`);
                autoSyncTriggeredRef.current = true;
                await syncWatchlist('auto');
            } else {
                console.log(`[Auto-Sync] Already synced since ${mostRecent6AM.toISOString()}. Skipping.`);
            }
        };

        // Check immediately on load (with a small delay to let data settle)
        const initialTimer = setTimeout(checkAndAutoSync, 3000);

        // Also check every 15 minutes (for when the tab stays open overnight)
        const intervalTimer = setInterval(() => {
            autoSyncTriggeredRef.current = false; // Reset so it can trigger again for new 6 AM windows
            checkAndAutoSync();
        }, 15 * 60 * 1000);

        return () => {
            clearTimeout(initialTimer);
            clearInterval(intervalTimer);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loading, watchlist.length, autoSyncEnabled]);

    return (
        <WatchlistContext.Provider value={{ watchlist, loading, syncing, syncProgress, lastSyncTime, lastAutoSyncTime, nextAutoSyncTime, syncLog, autoSyncEnabled, syncWatchlist, addWatchlistItem, removeWatchlistItem, toggleEpisodeWatched, isEpisodeWatched, isSeasonWatched, getAutoStatus, fetchData }}>
            {children}
        </WatchlistContext.Provider>
    );
};

export const useWatchlistContext = () => {
    const context = useContext(WatchlistContext);
    if (!context) throw new Error('useWatchlistContext must be used within a WatchlistProvider');
    return context;
};
