import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  ReactNode,
} from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

// Returns a referentially-stable function that always calls the latest
// version of `fn`. Used so the context value below doesn't hand out a new
// function reference on every render (which defeats React.memo on
// downstream components like WatchlistCard) without having to hand-audit
// dependency arrays for every handler in this file.
function useStableCallback<T extends (...args: any[]) => any>(fn: T): T {
  const ref = useRef(fn);
  ref.current = fn;
  return useCallback((...args: Parameters<T>) => ref.current(...args), []) as T;
}

// Routes TMDB requests through the tmdb-proxy edge function so the TMDB API
// key never has to live in (or be inlined into) the client bundle.
async function fetchTMDBProxy(endpoint: string, params: Record<string, string> = {}) {
  // The installed @supabase/supabase-js version has no `queryParams` option
  // on invoke() -- it's silently dropped, not an error, so this failed
  // with no indication why. invoke() just concatenates its first argument
  // onto the function URL and parses the result as a URL, so building the
  // query string in ourselves works correctly.
  const query = new URLSearchParams({ endpoint, ...params }).toString();
  const { data, error } = await supabase.functions.invoke(`tmdb-proxy?${query}`, {
    method: 'GET',
  });
  if (error) throw error;
  return data;
}

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
  // TMDB returns the US spelling ('Canceled'); 'Cancelled' is kept for any
  // pre-existing stored rows using the British spelling.
  series_status?: 'Returning Series' | 'In Production' | 'Ended' | 'Canceled' | 'Cancelled';
}

export interface FavouriteItem {
  id: string;
  title: string;
  poster?: string;
  media_type: 'movie' | 'tv';
  tmdb_id?: number;
  created_at: string;
  category: string;
}

// 'manual' = admin clicked "Sync Updates"; 'daily' = the client-side check
// (an admin had the Watchlist page open) found the 6 AM sync was due;
// 'auto' = the server-side pg_cron edge function fired on schedule with no
// browser involved at all. See watchlist-cron-sync/index.ts.
interface SyncLogEntry {
  id: number;
  synced_at: string;
  sync_type: 'auto' | 'manual' | 'daily';
  status: 'success' | 'error';
  items_synced: number;
  error_message?: string;
  duration_ms: number;
}

interface WatchlistContextType {
  watchlist: WatchlistItem[];
  favourites: FavouriteItem[];
  loading: boolean;
  syncing: boolean;
  syncProgress: number;
  lastSyncTime: string | null;
  lastAutoSyncTime: string | null;
  nextAutoSyncTime: string;
  syncLog: SyncLogEntry[];
  autoSyncEnabled: boolean;
  syncWatchlist: (type?: 'manual' | 'daily', itemsOverride?: WatchlistItem[]) => Promise<void>;
  syncSingleItem: (id: string) => Promise<void>;
  cancelSync: () => void;
  addWatchlistItem: (
    item: Omit<WatchlistItem, 'id' | 'created_at'>,
  ) => Promise<void>;
  isAddPending: (item: { tmdb_id?: number; title: string; category: string }) => boolean;
  removeWatchlistItem: (id: string) => Promise<void>;
  addFavourite: (item: Omit<FavouriteItem, 'id' | 'created_at'>) => Promise<void>;
  removeFavourite: (id: string) => Promise<void>;
  toggleEpisodeWatched: (
    showId: string,
    seasonNumber: number,
    episodeNumber: number,
  ) => Promise<void>;
  toggleSeasonWatched: (showId: string, seasonNumber: number) => Promise<void>;
  isEpisodeWatched: (
    showId: string,
    seasonNumber: number,
    episodeNumber: number,
  ) => boolean;
  isSeasonWatched: (showId: string, season: Season) => boolean;
  getAutoStatus: (item: WatchlistItem) => string;
  fetchData: () => Promise<void>;
}

const WatchlistContext = createContext<WatchlistContextType | undefined>(
  undefined,
);

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
  const [favourites, setFavourites] = useState<FavouriteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [watchedEpisodes, setWatchedEpisodes] = useState<Set<string>>(
    new Set(),
  );
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [lastAutoSyncTime, setLastAutoSyncTime] = useState<string | null>(null);
  const [syncLog, setSyncLog] = useState<SyncLogEntry[]>([]);
  const [nextAutoSyncTime, setNextAutoSyncTime] = useState<string>(
    getNext6AM().toISOString(),
  );
  // Tracks TV shows/movies currently mid-add so a rapid double-click (or a
  // slow network + impatient user) can't insert the same item twice while
  // the multi-second TMDB season fetch is still in flight.
  const [pendingAddKeys, setPendingAddKeys] = useState<Set<string>>(new Set());
  // Lets a full sync be stopped mid-flight. Checked between chunks rather
  // than aborting in-flight requests, so "stop" takes effect after the
  // current batch finishes rather than instantly.
  const syncCancelRef = useRef(false);
  const { isAdmin } = useAuth();
  // Public visitors can browse the watchlist (fetchData below), but the
  // auto-sync writes to sync_log/tv_shows/etc. and is admin-only -- RLS now
  // enforces that at the DB level, so gate it client-side too rather than
  // let it fail with permission errors for every non-admin visitor.
  const autoSyncEnabled = isAdmin;
  const autoSyncTriggeredRef = useRef(false);
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [moviesResult, showsResult, favouritesResult] = await Promise.all([
        supabase.from('movies').select('*').order('title', { ascending: true }),
        (supabase.from('tv_shows') as any)
          .select(
            `
                    *,
                    tv_show_seasons (*, tv_show_episodes (*))
                `,
          )
          .order('title', { ascending: true }),
        (supabase.from('favourites') as any).select('*').order('title', { ascending: true }),
      ]);

      if (moviesResult.error) throw moviesResult.error;
      if (showsResult.error) throw showsResult.error;
      if (favouritesResult.error) throw favouritesResult.error;

      const mappedMovies: WatchlistItem[] = (moviesResult.data || []).map(
        (movie) => ({
          id: movie.id.toString(),
          title: movie.title,
          category: 'Movies',
          description: movie.overview || '',
          year: movie.release_year || undefined,
          runtime: movie.runtime || undefined,
          genres: movie.genre
            ? movie.genre.split(',').map((g) => g.trim())
            : [],
          image_url: movie.poster || undefined,
          link: movie.tmdb_id
            ? `https://www.themoviedb.org/movie/${movie.tmdb_id}`
            : undefined,
          tmdb_id: movie.tmdb_id || undefined,
          release_date: movie.release_date || undefined,
          created_at: movie.release_date
            ? new Date(movie.release_date).toISOString()
            : new Date().toISOString(),
          streaming_platform: movie.platform,
        }),
      );

      const mappedShows: WatchlistItem[] = (showsResult.data || []).map(
        (show: any) => ({
          id: show.id.toString(),
          title: show.title,
          category: 'TV Shows' as const,
          status: show.status || 'Plan to Watch',
          description: show.overview || '',
          year: show.release_date
            ? new Date(show.release_date).getFullYear()
            : undefined,
          genres: show.genre
            ? show.genre.split(',').map((g: string) => g.trim())
            : [],
          image_url: show.poster || undefined,
          link: show.tmdb_id
            ? `https://www.themoviedb.org/tv/${show.tmdb_id}`
            : undefined,
          tmdb_id: show.tmdb_id || undefined,
          release_date: show.release_date || undefined,
          created_at: show.release_date
            ? new Date(show.release_date).toISOString()
            : new Date().toISOString(),
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
                .sort(
                  (a: any, b: any) =>
                    (a.episode_number || 0) - (b.episode_number || 0),
                )
                .map((ep: any) => ({
                  id: ep.id,
                  episode_number: ep.episode_number,
                  title: ep.title || `Episode ${ep.episode_number}`,
                  release_date: ep.release_date || undefined,
                  runtime: ep.runtime || undefined,
                  watched: ep.watched,
                })),
            })),
        }),
      );

      setWatchlist([...mappedMovies, ...mappedShows]);

      const mappedFavourites: FavouriteItem[] = (favouritesResult.data || []).map(
        (fav: any) => ({
          id: fav.id.toString(),
          title: fav.title,
          poster: fav.poster || undefined,
          media_type: fav.media_type,
          tmdb_id: fav.tmdb_id || undefined,
          created_at: fav.created_at || new Date().toISOString(),
          category: fav.category || 'Hollywood',
        }),
      );
      setFavourites(mappedFavourites);

      const newWatchedSet = new Set<string>();
      mappedShows.forEach((show) => {
        show.seasons?.forEach((season) => {
          season.episodes.forEach((ep) => {
            if (ep.watched) {
              newWatchedSet.add(
                `${show.id}-s${season.season_number}-e${ep.episode_number}`,
              );
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
        const lastSuccessful = data.find(
          (e: SyncLogEntry) => e.status === 'success',
        );
        if (lastSuccessful) {
          setLastSyncTime(lastSuccessful.synced_at);
        }
        // Find most recent successful auto sync
        const lastAutoSuccess = data.find(
          (e: SyncLogEntry) => e.sync_type === 'auto' && e.status === 'success',
        );
        if (lastAutoSuccess) {
          setLastAutoSyncTime(lastAutoSuccess.synced_at);
        }
      }
    } catch (error) {
      console.error('Error fetching sync log:', error);
    }
  }, []);

  // Log a sync event to Supabase
  const logSync = useCallback(
    async (
      syncType: 'manual' | 'daily',
      status: 'success' | 'error',
      itemsSynced: number,
      durationMs: number,
      errorMessage?: string,
    ) => {
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
          await (supabase.from('sync_log') as any).delete().in(
            'id',
            oldLogs.map((l: any) => l.id),
          );
        }
        await fetchSyncLog();
      } catch (error) {
        console.error('Error logging sync:', error);
      }
    },
    [fetchSyncLog],
  );

  useEffect(() => {
    const stored = localStorage.getItem('watched_episodes');
    if (stored) {
      try {
        setWatchedEpisodes(new Set(JSON.parse(stored)));
      } catch (e) {
        console.error('Failed to parse stored watched_episodes, ignoring:', e);
      }
    }
    fetchData();
    fetchSyncLog();
  }, [fetchData, fetchSyncLog]);

  const getAutoStatus = useCallback(
    (item: WatchlistItem) => {
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

      const futureSeasons = item.seasons.filter(
        (s) => s.release_date && new Date(s.release_date) > now,
      );
      if (futureSeasons.length > 0) {
        const earliestSeason = futureSeasons.reduce((earliest, current) => {
          if (!earliest.release_date) return current;
          if (!current.release_date) return earliest;
          return new Date(current.release_date) <
            new Date(earliest.release_date)
            ? current
            : earliest;
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
          if (
            watchedEpisodes.has(
              `${item.id}-s${s.season_number}-e${ep.episode_number}`,
            )
          ) {
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
        return item.series_status === 'Ended' ||
          item.series_status === 'Canceled' ||
          item.series_status === 'Cancelled'
          ? 'Completed'
          : 'Watched';
      }

      if (hasPartiallyWatchedSeason) {
        return 'Watching';
      }

      // If no partially watched season, but some episodes ARE watched (and we aren't finished),
      // it means we finished a season and haven't started the next.
      return 'To Watch';
    },
    [watchedEpisodes],
  );

  const addItemKey = (item: { tmdb_id?: number; title: string; category: string }) =>
    `${item.category}:${item.tmdb_id ?? item.title.toLowerCase()}`;

  const addWatchlistItem = async (
    item: Omit<WatchlistItem, 'id' | 'created_at'>,
  ) => {
    const exists = watchlist.find(
      (i) =>
        (item.tmdb_id && i.tmdb_id === item.tmdb_id) ||
        (i.title.toLowerCase() === item.title.toLowerCase() &&
          i.category === item.category),
    );
    if (exists) {
      toast({
        title: 'Already in Watchlist',
        description: `"${item.title}" is already in your ${item.category} list.`,
      });
      return;
    }

    const key = addItemKey(item);
    if (pendingAddKeys.has(key)) return; // already in flight -- ignore double-click
    setPendingAddKeys((prev) => new Set(prev).add(key));

    try {
      if (item.category === 'Movies') {
        try {
          const { error } = await supabase.from('movies').insert({
            title: item.title,
            platform: item.streaming_platform || 'Online',
            genre: item.genres?.join(', ') || null,
            poster: item.image_url || null,
            overview: item.description || null,
            tmdb_id: item.tmdb_id || null,
            release_date: item.release_date || null,
            runtime: item.runtime || null,
            release_year: item.year || null,
          });
          if (error) throw error;
          await fetchData();
          toast({ title: 'Success', description: 'Movie added to watchlist' });
        } catch (error) {
          toast({
            title: 'Error',
            description: 'Failed to add movie',
            variant: 'destructive',
          });
        }
      } else if (item.category === 'TV Shows') {
        try {
          const { data: show, error: showError } = await (
            supabase.from('tv_shows') as any
          )
            .insert({
              title: item.title,
              platform: item.streaming_platform || 'Online',
              genre: item.genres?.join(', ') || null,
              poster: item.image_url || null,
              overview: item.description || null,
              tmdb_id: item.tmdb_id || null,
              release_date: item.release_date || null,
              status: item.series_status || 'Returning Series',
            })
            .select()
            .single();

          if (showError) throw showError;

          let failedSeasonCount = 0;

          if (item.tmdb_id) {
            const showDetails = await fetchTMDBProxy(`tv/${item.tmdb_id}`);
            const validSeasons = (showDetails.seasons || []).filter(
              // Skip Season 0 and seasons with no episodes
              (s: any) => s.season_number !== 0 && s.episode_count !== 0,
            );

            // Seasons are independent of each other, so fetch/write them all
            // in parallel instead of one at a time.
            const results = await Promise.all(
              validSeasons.map(async (s: any) => {
                try {
                  const [{ data: season, error: sErr }, sDetails] = await Promise.all([
                    (supabase.from('tv_show_seasons') as any)
                      .insert({
                        tv_show_id: show.id,
                        season_number: s.season_number,
                        release_date: s.air_date || null,
                      })
                      .select()
                      .single(),
                    fetchTMDBProxy(`tv/${item.tmdb_id}/season/${s.season_number}`),
                  ]);
                  if (sErr) return false;

                  // Filter out TBA episodes (episodes with no air date)
                  const validEpisodes = (sDetails.episodes || []).filter(
                    (v: any) => v.air_date,
                  );
                  if (validEpisodes.length > 0) {
                    const eps = validEpisodes.map((v: any) => ({
                      season_id: season.id,
                      episode_number: v.episode_number,
                      title: v.name,
                      runtime: v.runtime || null,
                      release_date: v.air_date,
                    }));
                    await (supabase.from('tv_show_episodes') as any).insert(eps);
                  } else {
                    // No valid episodes, remove the season
                    await (supabase.from('tv_show_seasons') as any)
                      .delete()
                      .eq('id', season.id);
                  }
                  return true;
                } catch (seasonError) {
                  console.error(
                    `Failed to sync season ${s.season_number} while adding "${item.title}":`,
                    seasonError,
                  );
                  return false;
                }
              }),
            );
            failedSeasonCount = results.filter((ok) => !ok).length;
          }

          await fetchData();
          toast({
            title: 'Success',
            description:
              failedSeasonCount > 0
                ? `TV Show added (${failedSeasonCount} season${failedSeasonCount > 1 ? 's' : ''} failed to load -- use Sync Updates to retry)`
                : 'TV Show added',
          });
        } catch (error) {
          toast({
            title: 'Error',
            description: 'Failed to add TV Show',
            variant: 'destructive',
          });
        }
      }
    } finally {
      setPendingAddKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const isAddPending = (item: { tmdb_id?: number; title: string; category: string }) =>
    pendingAddKeys.has(addItemKey(item));

  const removeWatchlistItem = async (id: string) => {
    const itemToRemove = watchlist.find((item) => item.id === id);
    if (!itemToRemove) return;
    try {
      if (itemToRemove.category === 'TV Shows') {
        // For TV shows, manually cascade delete seasons and episodes
        // First, get all seasons for this show
        const { data: seasons } = await (
          supabase.from('tv_show_seasons') as any
        )
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
        const { error } = await supabase
          .from('movies')
          .delete()
          .eq('id', parseInt(id));
        if (error) throw error;
      }

      setWatchlist((prev) => prev.filter((item) => item.id !== id));
      toast({ title: 'Success', description: 'Item removed' });
    } catch (error) {
      console.error('Error removing item:', error);
      toast({
        title: 'Error',
        description: 'Failed to remove item',
        variant: 'destructive',
      });
    }
  };

  const addFavourite = async (
    item: Omit<FavouriteItem, 'id' | 'created_at'>,
  ) => {
    const exists = favourites.find(
      (f) =>
        (item.tmdb_id && f.tmdb_id === item.tmdb_id && f.media_type === item.media_type) ||
        f.title.toLowerCase() === item.title.toLowerCase(),
    );
    if (exists) {
      toast({
        title: 'Already in Favourites',
        description: `"${item.title}" is already in your favourites.`,
      });
      return;
    }

    try {
      const { error } = await (supabase.from('favourites') as any).insert({
        title: item.title,
        poster: item.poster || null,
        media_type: item.media_type,
        tmdb_id: item.tmdb_id || null,
        category: item.category,
      });
      if (error) throw error;
      await fetchData();
      toast({ title: 'Success', description: 'Added to favourites' });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to add favourite',
        variant: 'destructive',
      });
    }
  };

  const removeFavourite = async (id: string) => {
    try {
      const { error } = await (supabase.from('favourites') as any)
        .delete()
        .eq('id', parseInt(id));
      if (error) throw error;
      setFavourites((prev) => prev.filter((f) => f.id !== id));
      toast({ title: 'Success', description: 'Removed from favourites' });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to remove favourite',
        variant: 'destructive',
      });
    }
  };

  const toggleEpisodeWatched = async (
    showId: string,
    seasonNumber: number,
    episodeNumber: number,
  ) => {
    const episodeKey = `${showId}-s${seasonNumber}-e${episodeNumber}`;
    const isCurrentlyWatched = watchedEpisodes.has(episodeKey);
    const nextWatched = !isCurrentlyWatched;

    setWatchedEpisodes((prev) => {
      const next = new Set(prev);
      if (nextWatched) next.add(episodeKey);
      else next.delete(episodeKey);
      localStorage.setItem('watched_episodes', JSON.stringify([...next]));
      return next;
    });

    try {
      const show = watchlist.find((s) => s.id === showId);
      const season = show?.seasons?.find(
        (s) => s.season_number === seasonNumber,
      );
      const episode = season?.episodes.find(
        (e) => e.episode_number === episodeNumber,
      );
      if (episode?.id) {
        await (supabase.from('tv_show_episodes') as any)
          .update({
            watched: nextWatched,
          })
          .eq('id', episode.id);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const isEpisodeWatched = (
    showId: string,
    seasonNumber: number,
    episodeNumber: number,
  ) => {
    return watchedEpisodes.has(`${showId}-s${seasonNumber}-e${episodeNumber}`);
  };

  const isSeasonWatched = (showId: string, season: Season) => {
    return season.episodes.every((ep) =>
      isEpisodeWatched(showId, season.season_number, ep.episode_number),
    );
  };

  const toggleSeasonWatched = async (showId: string, seasonNumber: number) => {
    const show = watchlist.find((s) => s.id === showId);
    const season = show?.seasons?.find((s) => s.season_number === seasonNumber);
    if (!season) return;

    const allWatched = season.episodes.every((ep) =>
      watchedEpisodes.has(`${showId}-s${seasonNumber}-e${ep.episode_number}`),
    );
    const nextWatched = !allWatched;

    // Update local state in one batch
    setWatchedEpisodes((prev) => {
      const next = new Set(prev);
      for (const ep of season.episodes) {
        const key = `${showId}-s${seasonNumber}-e${ep.episode_number}`;
        if (nextWatched) next.add(key);
        else next.delete(key);
      }
      localStorage.setItem('watched_episodes', JSON.stringify([...next]));
      return next;
    });

    // Update all episodes in DB
    try {
      const episodeIds = season.episodes
        .filter((ep) => ep.id)
        .map((ep) => ep.id!);
      if (episodeIds.length > 0) {
        await (supabase.from('tv_show_episodes') as any)
          .update({ watched: nextWatched })
          .in('id', episodeIds);
      }
    } catch (error) {
      console.error('Error toggling season watched:', error);
    }
  };

  // `itemsOverride` lets a single item be resynced through the exact same
  // logic (progress tracking, change summary, failure handling) as a full
  // sync, instead of duplicating ~250 lines of season/episode reconciliation
  // for a "resync this one show" action.
  const syncWatchlist = async (
    type: 'manual' | 'daily' = 'manual',
    itemsOverride?: WatchlistItem[],
  ) => {
    if (syncing) return; // Prevent concurrent syncs
    syncCancelRef.current = false;
    setSyncing(true);
    setSyncProgress(0);
    const startTime = Date.now();
    const TMDB_IMAGE_BASE_URL = import.meta.env.VITE_TMDB_IMAGE_BASE_URL;

    const getPlatform = (providers: any) => {
      if (!providers) return 'Online';
      const available = [
        ...(providers.flatrate || []),
        ...(providers.free || []),
        ...(providers.ads || []),
      ];
      const allowed = [
        { tmdbNames: ['Netflix'], displayName: 'Netflix' },
        { tmdbNames: ['Disney Plus', 'Disney+'], displayName: 'Disney+' },
        { tmdbNames: ['Amazon Prime Video'], displayName: 'Prime Video' },
        {
          tmdbNames: ['Apple TV Plus', 'Apple TV+', 'Apple TV'],
          displayName: 'Apple TV+',
        },
        { tmdbNames: ['BBC iPlayer'], displayName: 'BBC iPlayer' },
      ];
      for (const a of allowed) {
        if (
          available.some((p: any) =>
            a.tmdbNames.some(
              (name) => p.provider_name?.toLowerCase() === name.toLowerCase(),
            ),
          )
        ) {
          return a.displayName;
        }
      }
      return 'Online';
    };

    let itemsSynced = 0;
    // Individual item/season failures used to just be console.error'd and
    // silently skipped -- the completion toast looked identical whether
    // everything worked or half the shows failed. Track them so the user
    // actually finds out. changesSummary is a lightweight "what happened"
    // trail (status changes, new episodes) instead of just a bare count.
    const failedTitles: string[] = [];
    const changesSummary: string[] = [];
    try {
      const itemsToSync = itemsOverride ?? watchlist.filter((item) => item.tmdb_id);
      // Use smaller chunks for better progress tracking in background tabs
      const chunkSize = 50;
      let processedCount = 0;
      let wasCancelled = false;
      for (let i = 0; i < itemsToSync.length; i += chunkSize) {
        if (syncCancelRef.current) {
          wasCancelled = true;
          break;
        }
        const chunk = itemsToSync.slice(i, i + chunkSize);
        await Promise.all(
          chunk.map(async (item) => {
            try {
              const tmdbType = item.category === 'TV Shows' ? 'tv' : 'movie';
              const data = await fetchTMDBProxy(`${tmdbType}/${item.tmdb_id}`, {
                append_to_response: 'watch/providers',
              });
              if (!data.id) return;

              // Common fields for both movies and TV shows
              const commonUpdates: any = {};
              if (!item.image_url && data.poster_path)
                commonUpdates.poster = `${TMDB_IMAGE_BASE_URL}${data.poster_path}`;
              if (!item.description && data.overview)
                commonUpdates.overview = data.overview;
              if (data.release_date || data.first_air_date)
                commonUpdates.release_date =
                  data.release_date || data.first_air_date;
              if (!item.genres?.length && data.genres)
                commonUpdates.genre = data.genres
                  .map((g: any) => g.name)
                  .join(', ');
              commonUpdates.platform = getPlatform(
                data['watch/providers']?.results?.GB,
              );

              if (item.category === 'Movies') {
                // Movies have release_year and runtime columns
                const movieUpdates = { ...commonUpdates };
                if (!item.year && (data.release_date || data.first_air_date)) {
                  movieUpdates.release_year = new Date(
                    data.release_date || data.first_air_date,
                  ).getFullYear();
                }
                if (data.runtime) movieUpdates.runtime = data.runtime;
                await supabase
                  .from('movies')
                  .update(movieUpdates)
                  .eq('id', parseInt(item.id));
              } else {
                // TV shows only have status (no release_year or runtime columns)
                const tvUpdates = { ...commonUpdates };
                tvUpdates.status = data.status;
                if (data.status && item.series_status && data.status !== item.series_status) {
                  changesSummary.push(`${item.title}: status → ${data.status}`);
                }
                await (supabase.from('tv_shows') as any)
                  .update(tvUpdates)
                  .eq('id', parseInt(item.id));

                // Season 0 Cleanup Logic
                const tmdbSeason0 = data.seasons?.find(
                  (s: any) => s.season_number === 0,
                );
                const localSeason0 = item.seasons?.find(
                  (s) => s.season_number === 0,
                );

                if (localSeason0) {
                  let shouldDelete = false;

                  // Check 1: TMDB doesn't have Season 0 or it has 0 episodes
                  if (!tmdbSeason0 || tmdbSeason0.episode_count === 0) {
                    shouldDelete = true;
                  }

                  // Check 2: Season 0 release date matches any other season (duplicate)
                  if (!shouldDelete && localSeason0.release_date) {
                    const otherSeasons =
                      item.seasons?.filter((s) => s.season_number !== 0) || [];
                    const isDuplicate = otherSeasons.some(
                      (s) =>
                        s.release_date &&
                        s.release_date === localSeason0.release_date,
                    );
                    if (isDuplicate) {
                      shouldDelete = true;
                    }
                  }

                  if (shouldDelete) {
                    await (supabase.from('tv_show_seasons') as any)
                      .delete()
                      .eq('id', localSeason0.id);
                  }
                }

                // Sync regular seasons (skip Season 0 and empty announced seasons)
                if (data.seasons) {
                  await Promise.all(
                    data.seasons.map(async (s: any) => {
                      if (s.season_number === 0) return;

                      // Skip seasons that have been announced but have no episodes yet
                      if (s.episode_count === 0) {
                        // Only remove if the local season has no episodes and no watched data
                        const localEmptySeason = item.seasons?.find(
                          (ls) => ls.season_number === s.season_number,
                        );
                        if (
                          localEmptySeason &&
                          localEmptySeason.episodes.length === 0
                        ) {
                          await (supabase.from('tv_show_seasons') as any)
                            .delete()
                            .eq('id', localEmptySeason.id);
                        }
                        return; // Don't add this season
                      }

                      try {
                        const { data: dbS, error: sErr } = await (
                          supabase.from('tv_show_seasons') as any
                        )
                          .upsert(
                            {
                              tv_show_id: parseInt(item.id),
                              season_number: s.season_number,
                              release_date: s.air_date || null,
                            },
                            { onConflict: 'tv_show_id,season_number' },
                          )
                          .select()
                          .single();
                        if (sErr || !dbS) return;

                        const now = new Date();
                        now.setHours(0, 0, 0, 0);
                        const seasonReleaseDate = s.air_date
                          ? new Date(s.air_date)
                          : null;
                        const ninetyDaysAgo = new Date(now);
                        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

                        const isShowCurrentlyAiring =
                          data.status === 'Returning Series' ||
                          data.status === 'In Production';
                        const localSeason = item.seasons?.find(
                          (ls) => ls.season_number === s.season_number,
                        );
                        const localEpisodeCount =
                          localSeason?.episodes?.length || 0;
                        const hasEpisodeCountChanged =
                          localEpisodeCount !== s.episode_count;

                        const shouldUpdateEpisodes =
                          !seasonReleaseDate ||
                          seasonReleaseDate >= ninetyDaysAgo ||
                          isShowCurrentlyAiring ||
                          hasEpisodeCountChanged;

                        if (shouldUpdateEpisodes) {
                          const sDetails = await fetchTMDBProxy(
                            `tv/${item.tmdb_id}/season/${s.season_number}`,
                          );
                          if (
                            sDetails.episodes &&
                            sDetails.episodes.length > 0
                          ) {
                            const validEpisodes = sDetails.episodes.filter(
                              (v: any) => v.air_date,
                            );

                            if (validEpisodes.length > 0) {
                              if (validEpisodes.length > localEpisodeCount) {
                                changesSummary.push(
                                  `${item.title}: +${validEpisodes.length - localEpisodeCount} new episode(s) (S${s.season_number})`,
                                );
                              }
                              // Read existing watched states to preserve them during upsert
                              const { data: existingEps } = await (
                                supabase.from('tv_show_episodes') as any
                              )
                                .select('episode_number, watched')
                                .eq('season_id', dbS.id);
                              const watchedMap = new Map<number, boolean>(
                                (existingEps || []).map((e: any) => [
                                  e.episode_number,
                                  e.watched ?? false,
                                ]),
                              );

                              const eps = validEpisodes.map((v: any) => {
                                const ep: any = {
                                  season_id: dbS.id,
                                  episode_number: v.episode_number,
                                };
                                ep.title =
                                  v.name || `Episode ${v.episode_number}`;
                                if (v.runtime) ep.runtime = v.runtime;
                                else if (data.episode_run_time?.[0])
                                  ep.runtime = data.episode_run_time[0];
                                ep.release_date = v.air_date;
                                // Preserve existing watched state
                                ep.watched =
                                  watchedMap.get(v.episode_number) ?? false;
                                return ep;
                              });
                              const { error: upsertError } = await (
                                supabase.from('tv_show_episodes') as any
                              ).upsert(eps, {
                                onConflict: 'season_id,episode_number',
                              });
                              if (upsertError)
                                console.error(
                                  `Episode upsert failed for ${item.title} S${s.season_number}:`,
                                  upsertError,
                                );

                              const validEpisodeNumbers = validEpisodes.map(
                                (v: any) => v.episode_number,
                              );
                              const { data: existingEpisodes } = await (
                                supabase.from('tv_show_episodes') as any
                              )
                                .select('id, episode_number')
                                .eq('season_id', dbS.id);

                              if (existingEpisodes) {
                                const episodesToDelete =
                                  existingEpisodes.filter(
                                    (e: any) =>
                                      !validEpisodeNumbers.includes(
                                        e.episode_number,
                                      ),
                                  );
                                if (episodesToDelete.length > 0) {
                                  await (
                                    supabase.from('tv_show_episodes') as any
                                  )
                                    .delete()
                                    .in(
                                      'id',
                                      episodesToDelete.map((e: any) => e.id),
                                    );
                                }
                              }
                            } else {
                              // Only delete season if no local episodes have watched state
                              const localS = item.seasons?.find(
                                (ls) => ls.season_number === s.season_number,
                              );
                              const hasWatched = localS?.episodes.some(
                                (ep) =>
                                  watchedEpisodes.has(
                                    `${item.id}-s${s.season_number}-e${ep.episode_number}`,
                                  ),
                              );
                              if (!hasWatched) {
                                await (supabase.from('tv_show_seasons') as any)
                                  .delete()
                                  .eq('id', dbS.id);
                              }
                            }
                          } else {
                            // Only delete season if no local episodes have watched state
                            const localS = item.seasons?.find(
                              (ls) => ls.season_number === s.season_number,
                            );
                            const hasWatched = localS?.episodes.some(
                              (ep) =>
                                watchedEpisodes.has(
                                  `${item.id}-s${s.season_number}-e${ep.episode_number}`,
                                ),
                            );
                            if (!hasWatched) {
                              await (supabase.from('tv_show_seasons') as any)
                                .delete()
                                .eq('id', dbS.id);
                            }
                          }
                        }
                      } catch (e) {
                        console.error('Failed to sync season during syncWatchlist:', e);
                      }
                    }),
                  );

                  // Clean up any local seasons that no longer exist in TMDB (except Season 0)
                  const localSeasons =
                    item.seasons?.filter((s) => s.season_number !== 0) || [];
                  for (const localSeason of localSeasons) {
                    const existsInTmdb = data.seasons.some(
                      (ts: any) =>
                        ts.season_number === localSeason.season_number,
                    );
                    if (!existsInTmdb) {
                      // Don't delete seasons that have watched episodes
                      const hasWatchedEps = localSeason.episodes.some(
                        (ep) =>
                          watchedEpisodes.has(
                            `${item.id}-s${localSeason.season_number}-e${ep.episode_number}`,
                          ),
                      );
                      if (!hasWatchedEps) {
                        await (supabase.from('tv_show_seasons') as any)
                          .delete()
                          .eq('id', localSeason.id);
                      }
                    }
                  }
                }
              }
              itemsSynced++;
            } catch (itemError) {
              console.error(`Error syncing item ${item.title}:`, itemError);
              failedTitles.push(item.title);
            }
            processedCount++;
            setSyncProgress(
              Math.round((processedCount / itemsToSync.length) * 100),
            );
          }),
        );
      }
      await fetchData();
      const durationMs = Date.now() - startTime;
      const syncTime = new Date().toISOString();
      setLastSyncTime(syncTime);
      localStorage.setItem('last_sync_time', syncTime);
      await logSync(
        type,
        'success',
        itemsSynced,
        durationMs,
        wasCancelled
          ? `Stopped by user after ${itemsSynced} item(s)${failedTitles.length > 0 ? `; ${failedTitles.length} failed` : ''}`
          : failedTitles.length > 0
            ? `${failedTitles.length} item(s) failed: ${failedTitles.join(', ')}`
            : undefined,
      );
      setNextAutoSyncTime(getNext6AM().toISOString());
      if (type === 'daily') {
        console.log(
          `[Daily Sync] Completed at ${syncTime}. ${itemsSynced} items synced in ${(durationMs / 1000).toFixed(1)}s`,
        );
      }

      const isSingleItemResync = !!itemsOverride && itemsOverride.length === 1;
      const descriptionParts = [
        wasCancelled
          ? `Stopped after ${itemsSynced} item(s) synchronized`
          : isSingleItemResync && itemsSynced > 0
            ? `"${itemsOverride[0].title}" resynced`
            : `${itemsSynced} items synchronized${type === 'daily' ? ' (scheduled)' : ''}`,
      ];
      if (changesSummary.length > 0) {
        const preview = changesSummary.slice(0, 3).join('; ');
        descriptionParts.push(
          changesSummary.length > 3
            ? `${preview}; +${changesSummary.length - 3} more`
            : preview,
        );
      }
      if (failedTitles.length > 0) {
        const preview = failedTitles.slice(0, 3).join(', ');
        descriptionParts.push(
          `${failedTitles.length} failed: ${preview}${failedTitles.length > 3 ? ', ...' : ''}`,
        );
      }

      toast({
        title: wasCancelled
          ? 'Sync Stopped'
          : type === 'daily'
            ? 'Daily Sync Complete'
            : 'Sync Complete',
        description: descriptionParts.join(' — '),
        variant: failedTitles.length > 0 ? 'destructive' : undefined,
      });
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      await logSync(type, 'error', itemsSynced, durationMs, errorMsg);
      toast({
        title: 'Error',
        description: 'Sync failed',
        variant: 'destructive',
      });
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncProgress(0), 1000);
    }
  };

  // Resync a single show/movie instead of the whole watchlist -- reuses
  // syncWatchlist's itemsOverride so it gets the same progress/change/failure
  // handling without duplicating the sync logic.
  const syncSingleItem = async (id: string) => {
    const item = watchlist.find((i) => i.id === id);
    if (!item || !item.tmdb_id) return;
    await syncWatchlist('manual', [item]);
  };

  // Stops a full sync between chunks (see syncCancelRef declaration above).
  const cancelSync = () => {
    syncCancelRef.current = true;
  };

  // Daily sync: Check on load and every 15 minutes if a sync is due (this is
  // the client-side fallback for while an admin has the tab open -- the
  // server-side pg_cron edge function covers the case where nobody does;
  // see watchlist-cron-sync/index.ts, logged as sync_type 'auto').
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
        console.log(
          `[Daily Sync] No sync since ${mostRecent6AM.toISOString()}. Triggering daily sync...`,
        );
        autoSyncTriggeredRef.current = true;
        await syncWatchlist('daily');
      } else {
        console.log(
          `[Daily Sync] Already synced since ${mostRecent6AM.toISOString()}. Skipping.`,
        );
      }
    };

    // Check immediately on load (with a small delay to let data settle)
    const initialTimer = setTimeout(checkAndAutoSync, 3000);

    // Also check every 15 minutes (for when the tab stays open overnight)
    const intervalTimer = setInterval(
      () => {
        autoSyncTriggeredRef.current = false; // Reset so it can trigger again for new 6 AM windows
        checkAndAutoSync();
      },
      15 * 60 * 1000,
    );

    return () => {
      clearTimeout(initialTimer);
      clearInterval(intervalTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, watchlist.length, autoSyncEnabled]);

  const stableSyncWatchlist = useStableCallback(syncWatchlist);
  const stableSyncSingleItem = useStableCallback(syncSingleItem);
  const stableCancelSync = useStableCallback(cancelSync);
  const stableAddWatchlistItem = useStableCallback(addWatchlistItem);
  const stableIsAddPending = useStableCallback(isAddPending);
  const stableRemoveWatchlistItem = useStableCallback(removeWatchlistItem);
  const stableAddFavourite = useStableCallback(addFavourite);
  const stableRemoveFavourite = useStableCallback(removeFavourite);
  const stableToggleEpisodeWatched = useStableCallback(toggleEpisodeWatched);
  const stableToggleSeasonWatched = useStableCallback(toggleSeasonWatched);
  const stableIsEpisodeWatched = useStableCallback(isEpisodeWatched);
  const stableIsSeasonWatched = useStableCallback(isSeasonWatched);

  const value = useMemo(
    () => ({
      watchlist,
      favourites,
      loading,
      syncing,
      syncProgress,
      lastSyncTime,
      lastAutoSyncTime,
      nextAutoSyncTime,
      syncLog,
      autoSyncEnabled,
      syncWatchlist: stableSyncWatchlist,
      syncSingleItem: stableSyncSingleItem,
      cancelSync: stableCancelSync,
      addWatchlistItem: stableAddWatchlistItem,
      isAddPending: stableIsAddPending,
      removeWatchlistItem: stableRemoveWatchlistItem,
      addFavourite: stableAddFavourite,
      removeFavourite: stableRemoveFavourite,
      toggleEpisodeWatched: stableToggleEpisodeWatched,
      toggleSeasonWatched: stableToggleSeasonWatched,
      isEpisodeWatched: stableIsEpisodeWatched,
      isSeasonWatched: stableIsSeasonWatched,
      getAutoStatus,
      fetchData,
    }),
    [
      watchlist,
      favourites,
      loading,
      syncing,
      syncProgress,
      lastSyncTime,
      lastAutoSyncTime,
      nextAutoSyncTime,
      syncLog,
      autoSyncEnabled,
      stableSyncWatchlist,
      stableSyncSingleItem,
      stableCancelSync,
      stableAddWatchlistItem,
      stableIsAddPending,
      stableRemoveWatchlistItem,
      stableAddFavourite,
      stableRemoveFavourite,
      stableToggleEpisodeWatched,
      stableToggleSeasonWatched,
      stableIsEpisodeWatched,
      stableIsSeasonWatched,
      getAutoStatus,
      fetchData,
    ],
  );

  return (
    <WatchlistContext.Provider value={value}>
      {children}
    </WatchlistContext.Provider>
  );
};

export const useWatchlistContext = () => {
  const context = useContext(WatchlistContext);
  if (!context)
    throw new Error(
      'useWatchlistContext must be used within a WatchlistProvider',
    );
  return context;
};
