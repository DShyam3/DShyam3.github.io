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
import { FunctionsHttpError } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { persistWatchedProgress } from './up-next-query';
import { useToast } from '@/hooks/use-toast';
import { useCooldown } from '@/hooks/useCooldown';
import { supabase } from '@/integrations/supabase/client';
import type { TMDBDetails, TMDBEpisode, TMDBSeasonDetails } from './tmdb-types';
import {
  resolveFavouriteCategory,
  type FavouriteCategory,
  type TmdbFacts,
} from './favourite-category';

/** A TMDB episode that survived the "has an air date" filter. */
type AiredEpisode = TMDBEpisode & { air_date: string };

const hasAirDate = (v: TMDBEpisode): v is AiredEpisode => Boolean(v.air_date);
import { useAuth } from '@/contexts/AuthContext';

// Returns a referentially-stable function that always calls the latest
// version of `fn`. Used so the context value below doesn't hand out a new
// function reference on every render (which defeats React.memo on
// downstream components like WatchlistCard) without having to hand-audit
// dependency arrays for every handler in this file.
function useStableCallback<T extends (...args: never[]) => unknown>(fn: T): T {
  const ref = useRef(fn);
  ref.current = fn;
  return useCallback((...args: Parameters<T>) => ref.current(...args), []) as T;
}

// Routes TMDB requests through the tmdb-proxy edge function so the TMDB API
// key never has to live in (or be inlined into) the client bundle.
async function fetchTMDBProxy<T>(
  endpoint: string,
  params: Record<string, string> = {},
): Promise<T> {
  // The installed @supabase/supabase-js version has no `queryParams` option
  // on invoke() -- it's silently dropped, not an error, so this failed
  // with no indication why. invoke() just concatenates its first argument
  // onto the function URL and parses the result as a URL, so building the
  // query string in ourselves works correctly.
  const query = new URLSearchParams({ endpoint, ...params }).toString();
  const { data, error } = await supabase.functions.invoke(
    `tmdb-proxy?${query}`,
    {
      method: 'GET',
    },
  );
  if (error) throw error;
  return data as T;
}

/** What watchlist-cron-sync answers a finished run with. */
interface ServerSyncResult {
  itemsSynced: number;
  itemsTotal: number;
  failedTitles: string[];
  changes: string[];
  durationMs: number;
  /** Stopped at the time ceiling; the titles after that point were not reached. */
  truncated: boolean;
  /** Seconds left on the full-sync cooldown; only a manual full sync sets it. */
  retry_after?: number;
}

/**
 * The status and JSON body of a non-2xx edge function response. invoke()
 * reports one as a FunctionsHttpError whose `context` is the raw Response,
 * so the server's own message has to be read out of it.
 */
async function readFunctionError(
  error: unknown,
): Promise<{ status?: number; error?: string; retry_after?: number }> {
  if (!(error instanceof FunctionsHttpError)) return {};
  const response = error.context as Response;
  try {
    const body = (await response.json()) as { error?: string; retry_after?: number };
    return { status: response.status, ...body };
  } catch {
    return { status: response.status };
  }
}

export interface Episode {
  id?: number;
  episode_number: number;
  /**
   * Empty until the show's episodes are loaded in full. The grid only needs
   * episode_number and watched to compute a status badge; titles, runtimes
   * and air dates arrive when a detail dialog opens.
   */
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
  /** False until loadShowEpisodes has filled in the full episode rows. */
  episodesLoaded?: boolean;
  /**
   * False until loadItemDescription has fetched `overview`. Distinguishes
   * "not fetched yet" from "genuinely has no description", which matters
   * because the sync uses a missing description as a signal.
   */
  descriptionLoaded?: boolean;
  // TMDB returns the US spelling ('Canceled'); 'Cancelled' is kept for any
  // pre-existing stored rows using the British spelling.
  series_status?:
    'Returning Series' | 'In Production' | 'Ended' | 'Canceled' | 'Cancelled';
}

export type { FavouriteCategory } from './favourite-category';

export interface FavouriteItem {
  id: string;
  title: string;
  poster?: string;
  media_type: 'movie' | 'tv';
  tmdb_id?: number;
  created_at: string;
  /**
   * The bucket the grid groups by, *resolved* rather than stored: derived
   * from the TMDB facts below, and only falling back to the row's stored
   * `category` string when a row predates the facts columns. Nothing writes
   * this field directly.
   */
  category: FavouriteCategory;
  /** The stored TMDB facts the bucket is derived from. Null until synced. */
  facts: TmdbFacts;
}

/** What an add flow supplies. `category` is resolved, so it is not in here. */
export interface NewFavourite {
  title: string;
  poster?: string;
  media_type: 'movie' | 'tv';
  tmdb_id?: number;
  /**
   * The TMDB facts, when the add flow has them -- the favourites search does,
   * because `search/tv` and `search/movie` already return them. The
   * watchlist-to-favourites move does not, and relies on `category` below
   * until the facts sync reaches the row.
   */
  facts?: TmdbFacts;
  /**
   * Fallback bucket written to the legacy `category` column. Read only when
   * the facts are too thin to derive from, so it is a starting guess rather
   * than a decision.
   */
  category?: FavouriteCategory;
}

// 'auto'   = the pg_cron edge function fired on schedule, no browser involved
//             (watchlist-cron-sync/index.ts). This is the only scheduled path.
// 'manual' = an admin clicked "Sync Updates".
// 'daily'  = historic only. A client-side fallback used to sync whenever an
//             admin opened the page and the local 6 AM window looked unmet;
//             it was removed because it duplicated the cron at arbitrary
//             times. Kept in the union so existing log rows still parse.
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
  /**
   * Percent done while syncing favourite facts. Null while a library sync
   * runs server-side, which reports nothing until it finishes.
   */
  syncProgress: number | null;
  /** When the server's cooldown on a full sync ends; null when none is known. */
  syncAvailableAt: number | null;
  lastSyncTime: string | null;
  lastAutoSyncTime: string | null;
  nextAutoSyncTime: string;
  syncLog: SyncLogEntry[];
  autoSyncEnabled: boolean;
  syncWatchlist: () => Promise<void>;
  syncSingleItem: (id: string) => Promise<void>;
  cancelSync: () => void;
  addWatchlistItem: (
    item: Omit<WatchlistItem, 'id' | 'created_at'>,
  ) => Promise<void>;
  isAddPending: (item: {
    tmdb_id?: number;
    title: string;
    category: string;
  }) => boolean;
  removeWatchlistItem: (id: string) => Promise<void>;
  addFavourite: (item: NewFavourite) => Promise<void>;
  /** Fills in missing TMDB facts on existing favourites. Admin-only. */
  syncFavouriteFacts: () => Promise<void>;
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
  loadShowEpisodes: (showId: string) => Promise<void>;
  loadItemDescription: (item: WatchlistItem) => Promise<void>;
  fetchData: () => Promise<void>;
}

const WatchlistContext = createContext<WatchlistContextType | undefined>(
  undefined,
);

/**
 * The pg_cron job is scheduled `0 6 * * *`, which pg_cron evaluates in UTC.
 * This has to match, or the countdown shown to the user is wrong -- it used
 * to compute 6 AM *local*, so through British Summer Time the page promised
 * 06:00 while the sync actually landed at 07:00.
 */
const AUTO_SYNC_UTC_HOUR = 6;

/**
 * How many favourites one facts sync will fetch. tmdb-proxy allows 60
 * requests a minute; a loop with no cap would trip that and start failing
 * mid-run, so the run stops short and asks to be run again.
 */
const FAVOURITE_FACTS_BATCH = 50;

/** The next time the server-side cron will run, as a Date. */
const getNextAutoSync = () => {
  const now = new Date();
  const target = new Date(now);
  target.setUTCHours(AUTO_SYNC_UTC_HOUR, 0, 0, 0);
  if (now >= target) {
    target.setUTCDate(target.getUTCDate() + 1);
  }
  return target;
};

export const WatchlistProvider = ({ children }: { children: ReactNode }) => {
  const queryClient = useQueryClient();
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [favourites, setFavourites] = useState<FavouriteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<number | null>(0);
  const { until: syncAvailableAt, start: startSyncCooldown } = useCooldown('watchlist-sync');
  const [watchedEpisodes, setWatchedEpisodes] = useState<Set<string>>(
    new Set(),
  );
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [lastAutoSyncTime, setLastAutoSyncTime] = useState<string | null>(null);
  const [syncLog, setSyncLog] = useState<SyncLogEntry[]>([]);
  const [nextAutoSyncTime, setNextAutoSyncTime] = useState<string>(
    getNextAutoSync().toISOString(),
  );
  // Tracks TV shows/movies currently mid-add so a rapid double-click (or a
  // slow network + impatient user) can't insert the same item twice while
  // the multi-second TMDB season fetch is still in flight.
  const [pendingAddKeys, setPendingAddKeys] = useState<Set<string>>(new Set());
  // Lets a favourite-facts sync be stopped mid-flight. Checked between
  // titles rather than aborting the request in flight, so "stop" takes
  // effect after the current one finishes. A library sync runs server-side
  // and cannot be stopped from here.
  const syncCancelRef = useRef(false);
  /** Shows whose full episode rows have been fetched, so we fetch once each. */
  const loadedShowsRef = useRef<Set<string>>(new Set());
  /** Same, for plot summaries. */
  const loadedDescriptionsRef = useRef<Set<string>>(new Set());
  const { isAdmin } = useAuth();
  // Public visitors can browse the watchlist (fetchData below), but the
  // auto-sync writes to sync_log/tv_shows/etc. and is admin-only -- RLS now
  // enforces that at the DB level, so gate it client-side too rather than
  // let it fail with permission errors for every non-admin visitor.
  const autoSyncEnabled = isAdmin;
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    setLoading(true);
    loadedShowsRef.current.clear();
    loadedDescriptionsRef.current.clear();
    try {
      const [moviesResult, showsResult, favouritesResult] = await Promise.all([
        // Every column except `overview`. Plot summaries are 218 kB of the
        // movies table's 357 kB and are only read by the detail dialog, so
        // they load per item in loadItemDescription instead.
        supabase
          .from('movies')
          .select(
            'id, title, platform, genre, release_year, poster, release_date, tmdb_id, runtime',
          )
          .order('title', { ascending: true }),
        supabase
          .from('tv_shows')
          // Deliberately not `tv_show_episodes (*)`. Every mount of this page
          // was pulling all ~7,600 episode rows in full (~474 kB) purely to
          // render a grid of posters. The grid needs episode_number and
          // watched, runtime for the watched total, and air dates for scheduling;
          // episode titles load per show when a detail dialog opens.
          // As above: no `overview` (62 kB of tv_shows' 108 kB).
          .select(
            `
                    id, title, platform, genre, status, poster, release_date, tmdb_id,
                    tv_show_seasons (
                      id, season_number, release_date, watched,
                      tv_show_episodes (id, episode_number, watched, runtime, release_date)
                    )
                `,
          )
          .order('title', { ascending: true }),
        supabase.from('favourites').select('*').order('title', { ascending: true }),
      ]);

      if (moviesResult.error) throw moviesResult.error;
      if (showsResult.error) throw showsResult.error;
      if (favouritesResult.error) throw favouritesResult.error;

      const mappedMovies: WatchlistItem[] = (moviesResult.data || []).map(
        (movie) => ({
          id: movie.id.toString(),
          title: movie.title,
          category: 'Movies',
          description: undefined,
          descriptionLoaded: false,
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
        (show) => ({
          id: show.id.toString(),
          title: show.title,
          category: 'TV Shows' as const,
          status: show.status || 'Plan to Watch',
          description: undefined,
          descriptionLoaded: false,
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
          series_status: show.status as WatchlistItem['series_status'],
          episodesLoaded: false,
          seasons: (show.tv_show_seasons || [])
            .sort((a, b) => a.season_number - b.season_number)
            .map((season) => ({
              id: season.id,
              season_number: season.season_number,
              release_date: season.release_date || undefined,
              watched: season.watched,
              episodes: (season.tv_show_episodes || [])
                .sort(
                  (a, b) =>
                    (a.episode_number || 0) - (b.episode_number || 0),
                )
                .map((ep) => ({
                  id: ep.id,
                  episode_number: ep.episode_number,
                  // Filled in by loadShowEpisodes.
                  title: '',
                  watched: ep.watched,
                  runtime: ep.runtime ?? undefined,
                  release_date: ep.release_date ?? undefined,
                })),
            })),
        }),
      );

      setWatchlist([...mappedMovies, ...mappedShows]);

      const mappedFavourites: FavouriteItem[] = (
        favouritesResult.data || []
      ).map((fav) => {
        const facts: TmdbFacts = {
          original_language: fav.original_language,
          origin_country: fav.origin_country,
          genre_ids: fav.genre_ids,
        };
        return {
          id: fav.id.toString(),
          title: fav.title,
          poster: fav.poster || undefined,
          // A plain text column; the union is this file's contract for
          // what the add flows are allowed to write.
          media_type: fav.media_type as FavouriteItem['media_type'],
          tmdb_id: fav.tmdb_id || undefined,
          created_at: fav.created_at || new Date().toISOString(),
          // TMDB facts first, the stored string only as a fallback. A row
          // synced from TMDB reclassifies itself when the rules improve; a
          // row that predates the facts columns keeps whatever the old
          // add-flow guessed, until the facts sync reaches it.
          category: resolveFavouriteCategory(facts, fav.category),
          facts,
        };
      });
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

  /**
   * Fetch one item's plot summary, which the list query deliberately skips.
   * Called when a detail dialog opens -- the only place it is displayed.
   */
  const loadItemDescription = useCallback(async (item: WatchlistItem) => {
    if (item.descriptionLoaded || loadedDescriptionsRef.current.has(item.id)) return;
    loadedDescriptionsRef.current.add(item.id);

    const table = item.category === 'Movies' ? 'movies' : 'tv_shows';
    const { data, error } = await supabase.from(table)
      .select('overview')
      .eq('id', parseInt(item.id))
      .maybeSingle();

    if (error) {
      // Allow a retry on the next open rather than leaving the panel blank.
      loadedDescriptionsRef.current.delete(item.id);
      console.error('Error loading description:', error);
      return;
    }

    setWatchlist((prev) =>
      prev.map((i) =>
        i.id === item.id
          ? { ...i, description: data?.overview || '', descriptionLoaded: true }
          : i,
      ),
    );
  }, []);

  /**
   * Load a single show's episodes in full -- titles, air dates and runtimes --
   * and merge them into the item already in state. Called when a detail dialog
   * opens, so the page mount stays cheap.
   *
   * A no-op if the show has already been loaded.
   */
  const loadShowEpisodes = useCallback(async (showId: string) => {
    if (loadedShowsRef.current.has(showId)) return;
    loadedShowsRef.current.add(showId);

    const { data, error } = await supabase
      .from('tv_show_seasons')
      .select(
        'id, tv_show_episodes (id, episode_number, title, release_date, runtime, watched)',
      )
      .eq('tv_show_id', parseInt(showId));

    if (error) {
      // Allow a retry on the next open rather than leaving the show blank.
      loadedShowsRef.current.delete(showId);
      console.error('Error loading episodes:', error);
      return;
    }

    /** One episode row as `loadShowEpisodes` selects it. */
    type LoadedEpisode = {
      episode_number: number;
      title: string | null;
      release_date: string | null;
      runtime: number | null;
    };

    // season id -> its full episode rows, keyed by episode number
    const bySeason = new Map<number, Map<number, LoadedEpisode>>();
    (data || []).forEach((season) => {
      bySeason.set(
        season.id,
        new Map(
          (season.tv_show_episodes || []).map((ep) => [ep.episode_number, ep]),
        ),
      );
    });

    setWatchlist((prev) =>
      prev.map((item) => {
        if (item.id !== showId) return item;
        return {
          ...item,
          episodesLoaded: true,
          seasons: item.seasons?.map((season) => {
            const full = season.id ? bySeason.get(season.id) : undefined;
            if (!full) return season;
            return {
              ...season,
              episodes: season.episodes.map((ep) => {
                const row = full.get(ep.episode_number);
                if (!row) return ep;
                return {
                  ...ep,
                  title: row.title || `Episode ${ep.episode_number}`,
                  release_date: row.release_date || undefined,
                  runtime: row.runtime || undefined,
                };
              }),
            };
          }),
        };
      }),
    );
  }, []);

  // Fetch sync log from Supabase. Admin-only, and not just as a matter of
  // taste: `sync_log`'s RLS restricts reads to is_admin(), and migration
  // 20260905160000 revoked anon's table grant on it outright, so calling this
  // as a public visitor is a guaranteed 42501 -- a wasted round trip and a
  // console error on every load of the page.
  const fetchSyncLog = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const { data, error } = await supabase.from('sync_log')
        .select('*')
        .order('synced_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      if (data) {
        // `sync_type` and `status` are plain text columns; the union below is
        // this file's contract for what the sync writers put in them.
        const entries = data as SyncLogEntry[];
        setSyncLog(entries);
        // Find most recent successful sync of any type
        const lastSuccessful = entries.find((e) => e.status === 'success');
        if (lastSuccessful) {
          setLastSyncTime(lastSuccessful.synced_at);
        }
        // Find most recent successful auto sync
        const lastAutoSuccess = entries.find(
          (e) => e.sync_type === 'auto' && e.status === 'success',
        );
        if (lastAutoSuccess) {
          setLastAutoSyncTime(lastAutoSuccess.synced_at);
        }
      }
    } catch (error) {
      console.error('Error fetching sync log:', error);
    }
  }, [isAdmin]);

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

  const addItemKey = (item: {
    tmdb_id?: number;
    title: string;
    category: string;
  }) => `${item.category}:${item.tmdb_id ?? item.title.toLowerCase()}`;

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
          const { data: show, error: showError } = await supabase.from('tv_shows')
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
          let detailsFailed = false;

          if (item.tmdb_id) {
            // The show row exists by now, so this must not reach the outer
            // catch: that says "Failed to add" about a row that is there,
            // never refetches it, and lets a retry insert it twice.
            const showDetails = await fetchTMDBProxy<TMDBDetails>(
              `tv/${item.tmdb_id}`,
            ).catch((error) => {
              console.error(`Failed to load "${item.title}" from TMDB:`, error);
              detailsFailed = true;
              return {} as TMDBDetails;
            });
            const validSeasons = (showDetails.seasons || []).filter(
              // Skip Season 0 and seasons with no episodes
              (s) => s.season_number !== 0 && s.episode_count !== 0,
            );

            // Seasons are independent of each other, so fetch/write them all
            // in parallel instead of one at a time.
            const results = await Promise.all(
              validSeasons.map(async (s) => {
                try {
                  const [{ data: season, error: sErr }, sDetails] =
                    await Promise.all([
                      supabase
                        .from('tv_show_seasons')
                        .insert({
                          tv_show_id: show.id,
                          season_number: s.season_number,
                          release_date: s.air_date || null,
                        })
                        .select()
                        .single(),
                      fetchTMDBProxy<TMDBSeasonDetails>(
                        `tv/${item.tmdb_id}/season/${s.season_number}`,
                      ),
                    ]);
                  if (sErr) return false;

                  // Filter out TBA episodes (episodes with no air date)
                  const validEpisodes = (sDetails.episodes || []).filter(
                    hasAirDate,
                  );
                  if (validEpisodes.length > 0) {
                    const eps = validEpisodes.map((v) => ({
                      season_id: season.id,
                      episode_number: v.episode_number,
                      title: v.name,
                      runtime: v.runtime || null,
                      release_date: v.air_date,
                    }));
                    await supabase.from('tv_show_episodes').insert(eps);
                  } else {
                    // No valid episodes, remove the season
                    await supabase.from('tv_show_seasons')
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
              detailsFailed
                ? 'TV Show added (its seasons failed to load -- resync it to retry)'
                : failedSeasonCount > 0
                  ? `TV Show added (${failedSeasonCount} season${failedSeasonCount > 1 ? 's' : ''} failed to load -- resync it to retry)`
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

  const isAddPending = (item: {
    tmdb_id?: number;
    title: string;
    category: string;
  }) => pendingAddKeys.has(addItemKey(item));

  const removeWatchlistItem = async (id: string) => {
    const itemToRemove = watchlist.find((item) => item.id === id);
    if (!itemToRemove) return;
    try {
      if (itemToRemove.category === 'TV Shows') {
        // For TV shows, manually cascade delete seasons and episodes
        // First, get all seasons for this show
        const { data: seasons } = await supabase.from('tv_show_seasons')
          .select('id')
          .eq('tv_show_id', parseInt(id));

        if (seasons && seasons.length > 0) {
          const seasonIds = seasons.map((s) => s.id);

          // Delete all episodes for these seasons
          await supabase.from('tv_show_episodes')
            .delete()
            .in('season_id', seasonIds);

          // Delete all seasons
          await supabase.from('tv_show_seasons')
            .delete()
            .eq('tv_show_id', parseInt(id));
        }

        // Finally, delete the TV show itself
        const { error } = await supabase.from('tv_shows')
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

  const addFavourite = async (item: NewFavourite) => {
    const exists = favourites.find(
      (f) =>
        (item.tmdb_id &&
          f.tmdb_id === item.tmdb_id &&
          f.media_type === item.media_type) ||
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
      const facts = item.facts ?? {};
      const { error } = await supabase.from('favourites').insert({
        title: item.title,
        poster: item.poster || null,
        media_type: item.media_type,
        tmdb_id: item.tmdb_id || null,
        original_language: facts.original_language ?? null,
        origin_country: facts.origin_country ?? null,
        genre_ids: facts.genre_ids ?? null,
        // The fallback string, read back only for a row whose facts stay
        // thin. Resolved rather than left null so it always holds a real
        // bucket -- a null here would fall through to a different last
        // resort than the add dialog just advertised.
        category: item.category ?? resolveFavouriteCategory(facts),
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
      const { error } = await supabase.from('favourites')
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
    if (!isAdmin) return;
    const episodeKey = `${showId}-s${seasonNumber}-e${episodeNumber}`;
    const isCurrentlyWatched = watchedEpisodes.has(episodeKey);
    const nextWatched = !isCurrentlyWatched;

    try {
      const show = watchlist.find((s) => s.id === showId);
      const season = show?.seasons?.find(
        (s) => s.season_number === seasonNumber,
      );
      const episode = season?.episodes.find(
        (e) => e.episode_number === episodeNumber,
      );
      await persistWatchedProgress(queryClient, [episode?.id], nextWatched);
      setWatchedEpisodes((prev) => {
        const next = new Set(prev);
        if (nextWatched) next.add(episodeKey);
        else next.delete(episodeKey);
        localStorage.setItem('watched_episodes', JSON.stringify([...next]));
        return next;
      });
    } catch (error) {
      console.error(error);
      toast({ title: 'Error', description: 'Failed to update watched progress', variant: 'destructive' });
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
    if (!isAdmin) return;
    const show = watchlist.find((s) => s.id === showId);
    const season = show?.seasons?.find((s) => s.season_number === seasonNumber);
    const episodes = season?.episodes ?? [];
    const allWatched = episodes.every((ep) =>
      watchedEpisodes.has(`${showId}-s${seasonNumber}-e${ep.episode_number}`),
    );
    const nextWatched = !allWatched;

    try {
      await persistWatchedProgress(queryClient, episodes.map((ep) => ep.id), nextWatched);
      setWatchedEpisodes((prev) => {
        const next = new Set(prev);
        for (const ep of episodes) {
          const key = `${showId}-s${seasonNumber}-e${ep.episode_number}`;
          if (nextWatched) next.add(key);
          else next.delete(key);
        }
        localStorage.setItem('watched_episodes', JSON.stringify([...next]));
        return next;
      });
    } catch (error) {
      console.error('Error toggling season watched:', error);
      toast({ title: 'Error', description: 'Failed to update watched progress', variant: 'destructive' });
    }
  };

  /**
   * Runs the sync in the watchlist-cron-sync edge function -- the same code
   * the nightly job runs -- for the whole library or for one title.
   *
   * It used to run here, in the browser, through tmdb-proxy. That proxy
   * allows 60 requests a minute per IP and a library sync makes well over a
   * thousand, so a manual sync failed most titles by construction. The
   * function calls TMDB directly and enforces its own cooldown, which is
   * what actually stops a repeated press from spending the calls again.
   */
  const runServerSync = async (target?: WatchlistItem) => {
    if (syncing) return; // Prevent concurrent syncs
    setSyncing(true);
    // No per-title progress comes back from a server run.
    setSyncProgress(null);
    try {
      const { data, error } = await supabase.functions.invoke<ServerSyncResult>(
        'watchlist-cron-sync',
        { body: target ? { category: target.category, id: target.id } : {} },
      );

      if (error) {
        const detail = await readFunctionError(error);
        if (!target) startSyncCooldown(detail.retry_after);
        toast({
          title: detail.status === 429 ? 'Sync not run' : 'Error',
          description: detail.error ?? 'Sync failed',
          variant: 'destructive',
        });
        return;
      }

      if (!target) startSyncCooldown(data?.retry_after);
      await Promise.all([fetchData(), fetchSyncLog()]);
      setNextAutoSyncTime(getNextAutoSync().toISOString());

      const itemsSynced = data?.itemsSynced ?? 0;
      const failedTitles = data?.failedTitles ?? [];
      const changes = data?.changes ?? [];
      const truncated = data?.truncated === true;
      const descriptionParts = [
        target && itemsSynced > 0
          ? `"${target.title}" resynced`
          : truncated
            ? `Stopped at the time limit after ${itemsSynced} of ${data?.itemsTotal ?? '?'} items -- run again for the rest`
            : `${itemsSynced} items synchronized`,
      ];
      if (changes.length > 0) {
        const preview = changes.slice(0, 3).join('; ');
        descriptionParts.push(
          changes.length > 3 ? `${preview}; +${changes.length - 3} more` : preview,
        );
      }
      if (failedTitles.length > 0) {
        const preview = failedTitles.slice(0, 3).join(', ');
        descriptionParts.push(
          `${failedTitles.length} failed: ${preview}${failedTitles.length > 3 ? ', ...' : ''}`,
        );
      }

      toast({
        title: truncated ? 'Sync Incomplete' : 'Sync Complete',
        description: descriptionParts.join(' — '),
        variant: failedTitles.length > 0 || truncated ? 'destructive' : undefined,
      });
    } finally {
      setSyncing(false);
      setSyncProgress(0);
    }
  };

  const syncWatchlist = () => runServerSync();

  const syncSingleItem = async (id: string) => {
    const item = watchlist.find((i) => i.id === id);
    if (!item || !item.tmdb_id) return;
    await runServerSync(item);
  };

  /**
   * Fills in the TMDB facts on favourites that have none, so their category
   * bucket can be derived rather than read from the string the old add-flow
   * froze into `category`.
   *
   * Capped per run because tmdb-proxy rate-limits to 60 requests a minute
   * and this loop would otherwise burn through that in seconds.
   *
   * "Has none" means all three columns are *null*, not empty -- which is why
   * the update below writes `[]` rather than null for an array TMDB had
   * nothing for. Without that distinction there is no value the sync can
   * write to mark such a row finished, so it would be re-fetched on every
   * run forever and, since `stale` keeps the query's order, permanently
   * occupy the head of the batch and starve every row behind it.
   */
  const syncFavouriteFacts = async () => {
    const withTmdbId = favourites.filter((f) => f.tmdb_id);
    const stale = withTmdbId.filter(
      (f) =>
        f.facts.original_language == null &&
        f.facts.origin_country == null &&
        f.facts.genre_ids == null,
    );

    if (stale.length === 0) {
      const unsyncable = favourites.length - withTmdbId.length;
      toast({
        title: 'Already up to date',
        description:
          unsyncable > 0
            ? `Every favourite TMDB can identify carries its facts. ${unsyncable} has no TMDB id and cannot be synced.`
            : 'Every favourite carries its TMDB facts.',
      });
      return;
    }

    const batch = stale.slice(0, FAVOURITE_FACTS_BATCH);
    syncCancelRef.current = false;
    setSyncing(true);
    setSyncProgress(0);
    let synced = 0;
    let failed = 0;
    let attempted = 0;

    try {
      for (const fav of batch) {
        // Shares the Sync Updates button's cancel flag, because it shares the
        // toolbar's Cancel affordance. Without this the button rendered and
        // did nothing for 50 sequential proxy calls.
        if (syncCancelRef.current) break;
        attempted++;
        try {
          const details = await fetchTMDBProxy<TMDBDetails>(
            `${fav.media_type}/${fav.tmdb_id}`,
          ).catch((error) => {
            // TMDB no longer has this id. Empty facts retire the row; thrown,
            // it would stay stale and head every batch after this one.
            if (
              error instanceof FunctionsHttpError &&
              (error.context as Response).status === 404
            ) {
              return {} as TMDBDetails;
            }
            throw error;
          });
          // The detail endpoints expand genres to objects; the derivation
          // wants ids, and TMDB never returns both shapes at once.
          const genreIds =
            details.genres
              ?.map((g) => g.id)
              .filter((id): id is number => typeof id === 'number') ?? [];

          const { error } = await supabase
            .from('favourites')
            .update({
              original_language: details.original_language ?? null,
              // Empty rather than null: see the note above on what marks a
              // row finished.
              origin_country: details.origin_country ?? [],
              genre_ids: genreIds,
            })
            .eq('id', Number(fav.id));
          if (error) throw error;
          synced++;
        } catch (error) {
          console.error(`Favourite facts sync failed for ${fav.title}:`, error);
          failed++;
        }
        setSyncProgress(Math.round((attempted / batch.length) * 100));
      }

      await fetchData();

      // Counts what is still stale, not what this batch left over: a failed
      // row is still stale, and reporting only `stale - batch` understates
      // the remainder by exactly the failures.
      const remaining = stale.length - synced;
      const cancelled = syncCancelRef.current;
      toast({
        title: cancelled
          ? 'Sync cancelled'
          : failed > 0
            ? 'Synced with errors'
            : 'Favourites synced',
        description: [
          `${synced} updated`,
          failed > 0 ? `${failed} failed` : null,
          remaining > 0 ? `${remaining} left -- run again` : null,
        ]
          .filter(Boolean)
          .join(', '),
        variant: failed > 0 ? 'destructive' : undefined,
      });
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncProgress(0), 1000);
    }
  };

  // Stops a favourite-facts sync between titles (see syncCancelRef above).
  const cancelSync = () => {
    syncCancelRef.current = true;
  };

  // There is deliberately no client-side auto-sync here any more.
  //
  // It used to fire whenever an admin opened the page and no successful sync
  // had happened since the most recent local 6 AM, logging as sync_type
  // 'daily'. Once the pg_cron job became reliable that only produced
  // duplicate syncs at arbitrary times -- 21:34, 06:06, 09:37 -- which is
  // what made the sync history look erratic. The cron
  // (watchlist-cron-sync, logged as 'auto') is the scheduled path; the
  // Sync Updates button is the manual one.

  const stableSyncWatchlist = useStableCallback(syncWatchlist);
  const stableSyncSingleItem = useStableCallback(syncSingleItem);
  const stableSyncFavouriteFacts = useStableCallback(syncFavouriteFacts);
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
      syncAvailableAt,
      lastSyncTime,
      lastAutoSyncTime,
      nextAutoSyncTime,
      syncLog,
      autoSyncEnabled,
      syncWatchlist: stableSyncWatchlist,
      syncSingleItem: stableSyncSingleItem,
      syncFavouriteFacts: stableSyncFavouriteFacts,
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
      loadShowEpisodes,
      loadItemDescription,
      fetchData,
    }),
    [
      watchlist,
      favourites,
      loading,
      syncing,
      syncProgress,
      syncAvailableAt,
      lastSyncTime,
      lastAutoSyncTime,
      nextAutoSyncTime,
      syncLog,
      autoSyncEnabled,
      stableSyncWatchlist,
      stableSyncSingleItem,
      stableSyncFavouriteFacts,
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
      loadShowEpisodes,
      loadItemDescription,
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
