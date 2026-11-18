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
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { invalidateWatchDerived, persistWatchedProgress } from './up-next-query';
import { watchedEpisodeKeys, watchlistLibraryQuery, type WatchlistLibrary } from './library-query';
import { useToast } from '@/hooks/use-toast';
import { useCooldown } from '@/hooks/useCooldown';
import { supabase } from '@/integrations/supabase/client';
import { selectAllPages } from '@/integrations/supabase/select-all-pages';
import type { TMDBDetails, TMDBEpisode, TMDBSeasonDetails } from './tmdb-types';
import { missingCategoryColumns } from './category-schema';
import { isSameTitle, isShowWithId, titleKey, type TitleRef } from './title-ref';
import { applyRatings, ratingColumn, watchlistRatingsQuery, withRating, type RatingTarget } from './ratings-query';
import { pickTrailerKey, TRAILER_VIDEO_PARAMS } from './trailer';
import { setWatchedArgs, type WatchedWhen } from './watched-when';
import {
  resolveFavouriteCategory,
  type FavouriteCategory,
  type TmdbFacts,
} from './favourite-category';

/** A TMDB episode that survived the "has an air date" filter. */
type AiredEpisode = TMDBEpisode & { air_date: string };

const hasAirDate = (v: TMDBEpisode): v is AiredEpisode => Boolean(v.air_date);
import { useAuth } from '@/contexts/AuthContext';
import { NIGHTLY_SYNC_HOUR_UTC } from './sync-logic';
import { releaseYear } from './watchlist-utils';
import { countdownRelease, isLibraryState, libraryStatus, isValidPersonalRating, releaseCountdown, type LibraryState } from './library-state';

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
  personal_rating?: number | null;
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
  personal_rating?: number | null;
  id?: number;
  season_number: number;
  release_date?: string;
  episodes: Episode[];
  watched?: boolean;
  /** YouTube key of this season's trailer. Loaded with the episodes. */
  trailer_key?: string;
}

export interface WatchlistItem {
  watched?: boolean;
  watched_at?: string | null;
  library_state?: LibraryState;
  personal_rating?: number | null;
  id: string;
  title: string;
  category: 'TV Shows' | 'Movies' | 'Upcoming';
  status?: string;
  description?: string;
  year?: number;
  runtime?: number;
  genres?: string[];
  genre_ids?: number[] | null;
  original_language?: string | null;
  origin_country?: string[] | null;
  image_url?: string;
  backdrop_url?: string;
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
  /**
   * YouTube key of the title's trailer, picked from TMDB's videos by the
   * sync. Loaded with the description, since only the detail view shows it.
   */
  trailer_key?: string;
  /**
   * Directors (films), creators (shows) and the top three billed actors,
   * from TMDB credits. Loaded with the description, since only the detail
   * view shows them.
   */
  directors?: string[];
  creators?: string[];
  top_cast?: string[];
  // TMDB returns the US spelling ('Canceled'); 'Cancelled' is kept for any
  // pre-existing stored rows using the British spelling.
  series_status?:
    'Returning Series' | 'In Production' | 'Ended' | 'Canceled' | 'Cancelled';
  /** OMDb scores, filled by the nightly sync; each absent when unknown. */
  imdb_id?: string;
  imdb_rating?: number;
  imdb_votes?: number;
  rt_score?: number;
  metascore?: number;
  /** Films only: the TMDB collection (film series) it belongs to. */
  collection_id?: number;
  collection_name?: string;
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
  /** The part of the library a nightly run covered; null for all of it. */
  shard?: number | null;
  shard_count?: number | null;
}

export interface AddWatchlistOptions {
  quiet?: boolean;
  skipRefresh?: boolean;
  /** When an item added as watched was watched; absent means now. */
  watchedWhen?: WatchedWhen;
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
  syncSingleItem: (ref: TitleRef) => Promise<void>;
  cancelSync: () => void;
  /** Resolves true once the title is in the library. `quiet` drops the
   *  success toast and `skipRefresh` the library re-read, for a batch (the
   *  import) that refreshes once at the end. */
  addWatchlistItem: (
    item: Omit<WatchlistItem, 'id' | 'created_at'>,
    options?: AddWatchlistOptions,
  ) => Promise<boolean>;
  isAddPending: (item: {
    tmdb_id?: number;
    title: string;
    category: string;
  }) => boolean;
  removeWatchlistItem: (ref: TitleRef) => Promise<void>;
  /** `when` says when it was watched (see set_watched); absent means now. */
  setMovieWatched: (item: WatchlistItem, watched: boolean, when?: WatchedWhen) => Promise<void>;
  setLibraryState: (item: WatchlistItem, state: LibraryState) => Promise<void>;
  setPersonalRating: (item: WatchlistItem, rating: number | null, seasonNumber?: number, episodeNumber?: number) => Promise<void>;
  /**
   * Whether the owner's scores are in. `ready` too when there are none to
   * wait for (a visitor). Rating controls show only when ready, so a failed
   * read is never mistaken for "nothing rated".
   */
  ratingsStatus: 'loading' | 'ready' | 'failed';
  addFavourite: (item: NewFavourite) => Promise<void>;
  /** Fills in missing TMDB facts on existing favourites. Admin-only. */
  syncFavouriteFacts: () => Promise<void>;
  removeFavourite: (id: string) => Promise<void>;
  toggleEpisodeWatched: (
    showId: string,
    seasonNumber: number,
    episodeNumber: number,
  ) => Promise<void>;
  /** `when` applies only when marking watched; unmarking clears the date. */
  toggleSeasonWatched: (
    showId: string,
    seasonNumber: number,
    when?: WatchedWhen,
  ) => Promise<void>;
  /** Corrects when already-watched rows were watched; null = unknown. One
   *  update for all the ids; rejects (no toast) if any row was not changed,
   *  so the caller can keep its form open and say so. */
  setWatchedDates: (kind: 'episode' | 'movie', ids: number[], watchedAt: string | null) => Promise<void>;
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
 * How many favourites one facts sync will fetch. tmdb-proxy allows 60
 * requests a minute; a loop with no cap would trip that and start failing
 * mid-run, so the run stops short and asks to be run again.
 */
const FAVOURITE_FACTS_BATCH = 50;

/**
 * The next time the server-side cron will start, as a Date. pg_cron reads
 * its schedule in UTC, so this does too -- computed as local time it would
 * promise 06:00 through British Summer Time while the sync landed at 07:00.
 */
const getNextAutoSync = () => {
  const now = new Date();
  const target = new Date(now);
  target.setUTCHours(NIGHTLY_SYNC_HOUR_UTC, 0, 0, 0);
  if (now >= target) {
    target.setUTCDate(target.getUTCDate() + 1);
  }
  return target;
};

export const WatchlistProvider = ({ children }: { children: ReactNode }) => {
  const queryClient = useQueryClient();
  // Seeded from the cache when the site warm-up or an earlier visit has
  // filled it, so the page renders its library without waiting on a read.
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>(
    () => queryClient.getQueryData(watchlistLibraryQuery.queryKey)?.watchlist ?? [],
  );
  const [favourites, setFavourites] = useState<FavouriteItem[]>(
    () => queryClient.getQueryData(watchlistLibraryQuery.queryKey)?.favourites ?? [],
  );
  const [loading, setLoading] = useState(
    () => !queryClient.getQueryData(watchlistLibraryQuery.queryKey),
  );
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<number | null>(0);
  const { until: syncAvailableAt, start: startSyncCooldown } = useCooldown('watchlist-sync');
  const [watchedEpisodes, setWatchedEpisodes] = useState<Set<string>>(() => {
    const cached = queryClient.getQueryData(watchlistLibraryQuery.queryKey);
    return cached ? watchedEpisodeKeys(cached.watchlist) : new Set();
  });
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
  const { isAdmin, isAuthLoading } = useAuth();
  // Public visitors can browse the watchlist (fetchData below), but the
  // auto-sync writes to sync_log/tv_shows/etc. and is admin-only -- RLS now
  // enforces that at the DB level, so gate it client-side too rather than
  // let it fail with permission errors for every non-admin visitor.
  const autoSyncEnabled = isAdmin;
  const { toast } = useToast();

  /** Puts a library read into state. The lists are replaced, so per-show and
   *  per-item detail loads start again. */
  const applyLibrary = useCallback((library: WatchlistLibrary) => {
    loadedShowsRef.current.clear();
    loadedDescriptionsRef.current.clear();
    setWatchlist(library.watchlist);
    setFavourites(library.favourites);
    setWatchedEpisodes(watchedEpisodeKeys(library.watchlist));
  }, []);

  /**
   * `force` re-reads the database whatever the cache holds, which is what
   * every call after a write needs. Without it -- the page mounting -- a
   * cached library is shown at once and re-read only if it is older than the
   * query client's staleTime, so returning to the page does not reload it.
   */
  const loadLibrary = useCallback(async (force: boolean) => {
    if (force || !queryClient.getQueryData(watchlistLibraryQuery.queryKey)) {
      setLoading(true);
    }
    try {
      applyLibrary(await queryClient.fetchQuery(
        force ? { ...watchlistLibraryQuery, staleTime: 0 } : watchlistLibraryQuery,
      ));
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, [queryClient, applyLibrary]);

  const fetchData = useCallback(() => loadLibrary(true), [loadLibrary]);

  // Write this provider's edits back into the cache entry it was seeded from,
  // so leaving /watchlist and coming back shows the library as it was left
  // rather than as it was last read. The entry keeps its read time: an edit
  // is not a fresh read, and must not stop a stale library being re-read.
  // News rows (watched flags, pins) are derived from the same tables, so they
  // are marked stale too -- without refetching while the page is still open.
  useEffect(() => {
    if (loading) return;
    const key = watchlistLibraryQuery.queryKey;
    const cached = queryClient.getQueryData(key);
    if (cached?.watchlist === watchlist && cached.favourites === favourites) return;
    queryClient.setQueryData(key, { watchlist, favourites }, {
      updatedAt: queryClient.getQueryState(key)?.dataUpdatedAt,
    });
    void queryClient.invalidateQueries({ queryKey: ['watchlist', 'news'], refetchType: 'none' });
  }, [queryClient, loading, watchlist, favourites]);

  /**
   * Fetch one item's plot summary, which the list query deliberately skips.
   * Called when a detail dialog opens -- the only place it is displayed.
   */
  const loadItemDescription = useCallback(async (item: WatchlistItem) => {
    // movies and tv_shows number their rows independently, so a film and a
    // show can share an id. Keyed and matched on id alone, opening one wrote
    // its overview, trailer and credits onto the other, and the other never
    // loaded its own.
    const key = titleKey(item);
    if (item.descriptionLoaded || loadedDescriptionsRef.current.has(key)) return;
    loadedDescriptionsRef.current.add(key);

    const id = parseInt(item.id);
    const isMovie = item.category === 'Movies';
    const { data, error } = isMovie
      ? await supabase.from('movies')
        .select('overview, trailer_key, directors, top_cast')
        .eq('id', id)
        .maybeSingle()
      : await supabase.from('tv_shows')
        .select('overview, trailer_key, creators, top_cast')
        .eq('id', id)
        .maybeSingle();

    if (error) {
      // Allow a retry on the next open rather than leaving the panel blank.
      loadedDescriptionsRef.current.delete(key);
      console.error('Error loading description:', error);
      return;
    }

    setWatchlist((prev) =>
      prev.map((i) =>
        isSameTitle(i, item)
          ? {
            ...i,
            description: data?.overview || '',
            trailer_key: data?.trailer_key || undefined,
            directors: (data && 'directors' in data ? data.directors : null) ?? undefined,
            creators: (data && 'creators' in data ? data.creators : null) ?? undefined,
            top_cast: data?.top_cast ?? undefined,
            descriptionLoaded: true,
          }
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
        'id, trailer_key, tv_show_episodes (id, episode_number, title, release_date, runtime, watched)',
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
    // season id -> its trailer's YouTube key
    const trailerBySeason = new Map<number, string>();
    (data || []).forEach((season) => {
      bySeason.set(
        season.id,
        new Map(
          (season.tv_show_episodes || []).map((ep) => [ep.episode_number, ep]),
        ),
      );
      if (season.trailer_key) trailerBySeason.set(season.id, season.trailer_key);
    });

    setWatchlist((prev) =>
      prev.map((item) => {
        if (!isShowWithId(item, showId)) return item;
        return {
          ...item,
          episodesLoaded: true,
          seasons: item.seasons?.map((season) => {
            const full = season.id ? bySeason.get(season.id) : undefined;
            if (!full) return season;
            return {
              ...season,
              trailer_key: season.id ? trailerBySeason.get(season.id) : undefined,
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
    void loadLibrary(false);
    fetchSyncLog();
  }, [loadLibrary, fetchSyncLog]);

  const getAutoStatus = useCallback(
    (item: WatchlistItem) => {
      const personalStatus = libraryStatus(item);
      if (['Hidden', 'Stopped watching', 'Watched', 'Completed', 'Watching'].includes(personalStatus)) return personalStatus;
      // The countdown comes from one pure source, shared with the card and
      // the detail dialog (library-state's countdownRelease).
      const next = countdownRelease(item);
      if (item.category === 'Movies') return next ? releaseCountdown(next) : 'Released';
      if (!item.seasons || item.seasons.length === 0) return 'Returning Series';
      return next ? releaseCountdown(next) : personalStatus;
    },
    [],
  );

  const addItemKey = (item: {
    tmdb_id?: number;
    title: string;
    category: string;
  }) => `${item.category}:${item.tmdb_id ?? item.title.toLowerCase()}`;

  const addWatchlistItem = async (
    item: Omit<WatchlistItem, 'id' | 'created_at'>,
    options: AddWatchlistOptions = {},
  ): Promise<boolean> => {
    const exists = watchlist.find(
      (i) =>
        (item.tmdb_id && i.tmdb_id === item.tmdb_id && i.category === item.category) ||
        (i.title.toLowerCase() === item.title.toLowerCase() &&
          i.category === item.category),
    );
    if (exists) {
      if (!options.quiet) {
        toast({
          title: 'Already in Watchlist',
          description: `"${item.title}" is already in your ${item.category} list.`,
        });
      }
      return true;
    }

    const key = addItemKey(item);
    if (pendingAddKeys.has(key)) return false; // already in flight -- ignore double-click
    setPendingAddKeys((prev) => new Set(prev).add(key));

    // "Seen it" watched now: the insert trigger stamps watched_at. Any other
    // "when" inserts the rows unwatched and lets set_watched flip and date
    // them, the path Mark as watched takes in the Library -- the trigger
    // stamps now() on a watched insert with no date, so "unknown" could not
    // survive an insert.
    const laterWhen = item.watched === true && options.watchedWhen && options.watchedWhen.mode !== 'now'
      ? options.watchedWhen
      : undefined;
    // The rows are in by then, so a failure must not read "Failed to add".
    const markAddedWatched = async (kind: 'episode' | 'movie', ids: number[]): Promise<boolean> => {
      if (!laterWhen || ids.length === 0) return true;
      const { error } = await supabase.rpc('set_watched', setWatchedArgs(kind, ids, true, laterWhen));
      if (!error) return true;
      console.error(`Failed to mark "${item.title}" as watched:`, error);
      toast({
        title: 'Added, but not marked watched',
        description: `"${item.title}" is in your library. Mark it as watched from there.`,
        variant: 'destructive',
      });
      return false;
    };

    try {
      if (item.category === 'Movies') {
        try {
          const payload = {
            title: item.title,
            platform: item.streaming_platform || 'Online',
            genre: item.genres?.join(', ') || null,
            poster: item.image_url || null,
            backdrop: item.backdrop_url || null,
            overview: item.description || null,
            tmdb_id: item.tmdb_id || null,
            release_date: item.release_date || null,
            runtime: item.runtime || null,
            release_year: item.year || null,
            trailer_key: item.trailer_key || null,
            directors: item.directors ?? null,
            top_cast: item.top_cast ?? null,
            imdb_id: item.imdb_id ?? null,
            collection_id: item.collection_id ?? null,
            collection_name: item.collection_name ?? null,
            // "Seen it" from discovery: straight to Finished.
            watched: item.watched === true && !laterWhen,
          };
          const firstInsert = await supabase.from('movies').insert({
            ...payload,
            genre_ids: item.genre_ids ?? null,
            original_language: item.original_language ?? null,
            origin_country: item.origin_country ?? null,
          }).select('id').single();
          const { data: inserted, error } = firstInsert.error && missingCategoryColumns(firstInsert.error.message)
            ? await supabase.from('movies').insert(payload).select('id').single()
            : firstInsert;
          if (error) throw error;
          const marked = await markAddedWatched('movie', [inserted.id]);
          if (!options.skipRefresh) await fetchData();
          if (!options.quiet && marked) {
            toast({ title: 'Success', description: item.watched ? 'Film added as watched' : 'Movie added to watchlist' });
          }
          return true;
        } catch (error) {
          toast({
            title: 'Error',
            description: `Failed to add ${item.title}`,
            variant: 'destructive',
          });
          throw error;
        }
      } else if (item.category === 'TV Shows') {
        try {
          const payload = {
              title: item.title,
              platform: item.streaming_platform || 'Online',
              genre: item.genres?.join(', ') || null,
              poster: item.image_url || null,
              backdrop: item.backdrop_url || null,
              overview: item.description || null,
              tmdb_id: item.tmdb_id || null,
              release_date: item.release_date || null,
              status: item.series_status || 'Returning Series',
              trailer_key: item.trailer_key || null,
              creators: item.creators ?? null,
              top_cast: item.top_cast ?? null,
              imdb_id: item.imdb_id ?? null,
          };
          const firstInsert = await supabase.from('tv_shows').insert({
            ...payload,
            genre_ids: item.genre_ids ?? null,
            original_language: item.original_language ?? null,
            origin_country: item.origin_country ?? null,
          }).select().single();
          const { data: show, error: showError } = firstInsert.error && missingCategoryColumns(firstInsert.error.message)
            ? await supabase.from('tv_shows').insert(payload).select().single()
            : firstInsert;

          if (showError) throw showError;

          let failedSeasonCount = 0;
          let detailsFailed = false;
          const airedEpisodeIds: number[] = [];

          const now = new Date();
          const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
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
                  const sDetails = await fetchTMDBProxy<TMDBSeasonDetails>(
                    `tv/${item.tmdb_id}/season/${s.season_number}`,
                    { append_to_response: 'videos', ...TRAILER_VIDEO_PARAMS },
                  );
                  const { data: season, error: sErr } = await supabase
                    .from('tv_show_seasons')
                    .insert({
                      tv_show_id: show.id,
                      season_number: s.season_number,
                      release_date: s.air_date || null,
                      trailer_key: pickTrailerKey(sDetails.videos?.results),
                      // Checked, so the sync's trailer backfill skips it.
                      trailer_checked_at: new Date().toISOString(),
                    })
                    .select()
                    .single();
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
                      // "Seen it": every episode aired so far is watched; the
                      // season trigger follows from the episodes.
                      watched: !laterWhen && item.watched === true && !!v.air_date && v.air_date <= todayIso,
                    }));
                    const { data: insertedEps } = await supabase.from('tv_show_episodes').insert(eps).select('id, release_date');
                    for (const ep of insertedEps ?? []) {
                      if (ep.release_date && ep.release_date <= todayIso) airedEpisodeIds.push(ep.id);
                    }
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

          const marked = await markAddedWatched('episode', airedEpisodeIds);
          if (!options.skipRefresh) await fetchData();
          if (!marked) return true;
          if (options.quiet && !detailsFailed && failedSeasonCount === 0) return true;
          toast({
            title: 'Success',
            description:
              detailsFailed
                ? 'TV Show added (its seasons failed to load -- resync it to retry)'
                : failedSeasonCount > 0
                  ? `TV Show added (${failedSeasonCount} season${failedSeasonCount > 1 ? 's' : ''} failed to load -- resync it to retry)`
                  : 'TV Show added',
          });
          return true;
        } catch (error) {
          toast({
            title: 'Error',
            description: `Failed to add ${item.title}`,
            variant: 'destructive',
          });
          throw error;
        }
      }
      return false;
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

  const reportPersonalUpdateError = (error: unknown) => {
    toast({ title: 'Could not save', description: 'Your library change was not saved. Please try again.', variant: 'destructive' });
    throw error;
  };

  const setMovieWatched = async (item: WatchlistItem, watched: boolean, when?: WatchedWhen) => {
    try {
      if (!isAdmin || item.category !== 'Movies') throw new Error('Movie update unavailable');
      const id = Number(item.id);
      // Any "when" but now goes through set_watched: the trigger stamps now()
      // whenever `watched` flips, so a client-sent watched_at cannot win.
      if (watched && when && when.mode !== 'now') {
        const { error: rpcError } = await supabase.rpc('set_watched', setWatchedArgs('movie', [id], true, when));
        if (rpcError) throw rpcError;
      } else {
        const { error: updateError } = await supabase.from('movies').update({ watched }).eq('id', id);
        if (updateError) throw updateError;
      }
      const { data, error } = await supabase.from('movies').select('id, watched, watched_at').eq('id', id).single();
      if (error || !data) throw error ?? new Error('Movie update failed');
      setWatchlist((prev) => prev.map((row) => row.category === item.category && row.id === item.id ? { ...row, watched: data.watched, watched_at: data.watched_at } : row));
      await invalidateWatchDerived(queryClient);
    } catch (error) { reportPersonalUpdateError(error); }
  };

  const setLibraryState = async (item: WatchlistItem, library_state: LibraryState) => {
    try {
      if (!isAdmin || !isLibraryState(library_state, item.category)) throw new Error('Library update unavailable');
      const table = item.category === 'Movies' ? 'movies' : 'tv_shows';
      const { data, error } = await supabase.from(table).update({ library_state }).eq('id', Number(item.id)).select('id').single();
      if (error || !data) throw error ?? new Error('Library update failed');
      setWatchlist((prev) => prev.map((row) => row.category === item.category && row.id === item.id ? { ...row, library_state } : row));
    } catch (error) { reportPersonalUpdateError(error); }
  };

  // Scores live in the owner-only watchlist_ratings table, one row per
  // title, season or episode. The library itself never carries them; they
  // are laid on at render (applyRatings) from their own query, so they are
  // never in the public library cache.
  const setPersonalRating = async (item: WatchlistItem, personal_rating: number | null, seasonNumber?: number, episodeNumber?: number) => {
    try {
      if (!isAdmin || !isValidPersonalRating(personal_rating)) throw new Error('Invalid rating');
      if (episodeNumber !== undefined && seasonNumber === undefined) throw new Error('Season required');
      const current = watchlist.find((row) => isSameTitle(row, item));
      if (!current) throw new Error('Title unavailable');
      const season = current.seasons?.find((row) => row.season_number === seasonNumber);
      const episode = season?.episodes.find((row) => row.episode_number === episodeNumber);
      if (seasonNumber !== undefined && item.category !== 'TV Shows') throw new Error('Rating target unavailable');
      const targetId = episodeNumber !== undefined ? episode?.id : seasonNumber !== undefined ? season?.id : Number(item.id);
      if (!targetId) throw new Error('Rating target unavailable');
      const target: RatingTarget = episodeNumber !== undefined
        ? { episode_id: targetId }
        : seasonNumber !== undefined
          ? { season_id: targetId }
          : item.category === 'Movies' ? { movie_id: targetId } : { tv_show_id: targetId };
      const column = ratingColumn(target);
      const { error } = personal_rating === null
        ? await supabase.from('watchlist_ratings').delete().eq(column, targetId)
        : await supabase.from('watchlist_ratings').upsert(
          { ...target, rating: personal_rating, updated_at: new Date().toISOString() },
          { onConflict: column },
        );
      if (error) throw error;
      // A read still in flight would land after this and undo the new score.
      await queryClient.cancelQueries({ queryKey: watchlistRatingsQuery.queryKey });
      queryClient.setQueryData(watchlistRatingsQuery.queryKey, (rows) => withRating(rows ?? [], target, personal_rating));
    } catch (error) { reportPersonalUpdateError(error); }
  };

  const removeWatchlistItem = async (ref: TitleRef) => {
    const itemToRemove = watchlist.find((item) => isSameTitle(item, ref));
    if (!itemToRemove) return;
    try {
      if (itemToRemove.category === 'TV Shows') {
        // For TV shows, manually cascade delete seasons and episodes
        // First, get all seasons for this show
        const { data: seasons } = await supabase.from('tv_show_seasons')
          .select('id')
          .eq('tv_show_id', parseInt(ref.id));

        if (seasons && seasons.length > 0) {
          const seasonIds = seasons.map((s) => s.id);

          // Delete all episodes for these seasons
          await supabase.from('tv_show_episodes')
            .delete()
            .in('season_id', seasonIds);

          // Delete all seasons
          await supabase.from('tv_show_seasons')
            .delete()
            .eq('tv_show_id', parseInt(ref.id));
        }

        // Finally, delete the TV show itself
        const { error } = await supabase.from('tv_shows')
          .delete()
          .eq('id', parseInt(ref.id));
        if (error) throw error;
      } else {
        // For movies, simple delete
        const { error } = await supabase
          .from('movies')
          .delete()
          .eq('id', parseInt(ref.id));
        if (error) throw error;
      }

      setWatchlist((prev) => prev.filter((item) => !isSameTitle(item, ref)));
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
        ((!item.tmdb_id || !f.tmdb_id) && f.media_type === item.media_type && f.title.toLowerCase() === item.title.toLowerCase()),
    );
    if (exists) {
      toast({
        title: 'Already in Favourites',
        description: `"${item.title}" is already in your favourites.`,
      });
      return;
    }

    try {
      // A heart from a card or a detail has no TMDB facts to hand, and the
      // favourite's section is derived from them -- without this it files
      // under Others until the next facts refresh. A failed lookup keeps that
      // fallback rather than blocking the favourite.
      let facts: TmdbFacts = item.facts ?? {};
      if (!item.facts && item.tmdb_id) {
        const details = await fetchTMDBProxy<TMDBDetails>(`${item.media_type}/${item.tmdb_id}`).catch(() => null);
        if (details) {
          facts = {
            original_language: details.original_language ?? null,
            origin_country: details.origin_country?.length ? details.origin_country : details.production_countries?.map((country) => country.iso_3166_1) ?? [],
            genre_ids: details.genres?.map((genre) => genre.id).filter((id): id is number => typeof id === 'number') ?? [],
          };
        }
      }
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
      // The About page's favourite cards read titles on their own key.
      void queryClient.invalidateQueries({ queryKey: ['favourites'] });
      toast({ title: 'Success', description: 'Added to favourites' });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to add favourite',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const removeFavourite = async (id: string) => {
    try {
      const { error } = await supabase.from('favourites')
        .delete()
        .eq('id', parseInt(id));
      if (error) throw error;
      setFavourites((prev) => prev.filter((f) => f.id !== id));
      void queryClient.invalidateQueries({ queryKey: ['favourites'] });
      toast({ title: 'Success', description: 'Removed from favourites' });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to remove favourite',
        variant: 'destructive',
      });
    }
  };

  /** Carries a watched toggle into the show's own episode rows. The Set alone
   *  is not enough: it is rebuilt from those rows whenever a cached library is
   *  applied, so only an edit to the rows reaches the cache write-back above. */
  const markEpisodesWatched = (
    showId: string,
    seasonNumber: number,
    episodeNumbers: ReadonlySet<number>,
    watched: boolean,
  ) => {
    setWatchlist((prev) => prev.map((show) => !isShowWithId(show, showId) ? show : {
      ...show,
      seasons: show.seasons?.map((season) => season.season_number !== seasonNumber ? season : {
        ...season,
        episodes: season.episodes.map((ep) =>
          episodeNumbers.has(ep.episode_number) ? { ...ep, watched } : ep),
      }),
    }));
  };

  /** The series' latest watch, re-read after a watched write: the database
   *  stamps episode dates, and an unwatch can move it back or clear it. A
   *  failed read leaves the old date; the next library read corrects it. */
  const showWatchedAtReads = useRef(new Map<string, number>());
  const refreshShowWatchedAt = async (showId: string) => {
    // Quick toggles on one show fire overlapping reads; only the latest one
    // applies, so an older reply cannot bring back a date just undone.
    const read = (showWatchedAtReads.current.get(showId) ?? 0) + 1;
    showWatchedAtReads.current.set(showId, read);
    const { data, error } = await supabase
      .from('watchlist_show_last_watched')
      .select('last_watched_at')
      .eq('tv_show_id', Number(showId))
      .maybeSingle();
    if (error || showWatchedAtReads.current.get(showId) !== read) return;
    const watchedAt = data?.last_watched_at ?? null;
    setWatchlist((prev) => prev.map((show) => isShowWithId(show, showId) ? { ...show, watched_at: watchedAt } : show));
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
      const show = watchlist.find((s) => isShowWithId(s, showId));
      const season = show?.seasons?.find(
        (s) => s.season_number === seasonNumber,
      );
      const episode = season?.episodes.find(
        (e) => e.episode_number === episodeNumber,
      );
      await persistWatchedProgress(queryClient, [episode?.id], nextWatched);
      markEpisodesWatched(showId, seasonNumber, new Set([episodeNumber]), nextWatched);
      void refreshShowWatchedAt(showId);
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

  const toggleSeasonWatched = async (
    showId: string,
    seasonNumber: number,
    when?: WatchedWhen,
  ) => {
    if (!isAdmin) return;
    const show = watchlist.find((s) => isShowWithId(s, showId));
    const season = show?.seasons?.find((s) => s.season_number === seasonNumber);
    const episodes = season?.episodes ?? [];
    const allWatched = episodes.every((ep) =>
      watchedEpisodes.has(`${showId}-s${seasonNumber}-e${ep.episode_number}`),
    );
    const nextWatched = !allWatched;

    try {
      await persistWatchedProgress(queryClient, episodes.map((ep) => ep.id), nextWatched, when);
      markEpisodesWatched(
        showId, seasonNumber, new Set(episodes.map((ep) => ep.episode_number)), nextWatched,
      );
      void refreshShowWatchedAt(showId);
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

  const setWatchedDates = async (kind: 'episode' | 'movie', ids: number[], watchedAt: string | null) => {
    if (!isAdmin) throw new Error('Not signed in as admin');
    if (ids.length === 0) return;
    if (watchedAt !== null && Date.parse(watchedAt) > Date.now() + 24 * 60 * 60 * 1000) {
      throw new Error('A watch date cannot be in the future');
    }
    // Only watched_at is in the SET list, so the trigger that stamps now()
    // on a watched flip does not fire; `.eq('watched', true)` keeps a date
    // off a row that is not watched.
    const { data, error } = kind === 'movie'
      ? await supabase.from('movies').update({ watched_at: watchedAt })
        .in('id', ids).eq('watched', true).select('id')
      : await supabase.from('tv_show_episodes').update({ watched_at: watchedAt })
        .in('id', ids).eq('watched', true).select('id');
    if (error) throw error;
    if ((data?.length ?? 0) !== new Set(ids).size) {
      throw new Error('Some of these are no longer marked watched');
    }
    if (kind === 'movie') {
      const changed = new Set(ids.map(String));
      setWatchlist((prev) => prev.map((item) =>
        item.category === 'Movies' && changed.has(item.id) ? { ...item, watched_at: watchedAt } : item));
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

  const syncSingleItem = async (ref: TitleRef) => {
    const item = watchlist.find((i) => isSameTitle(i, ref));
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
              origin_country: details.origin_country?.length ? details.origin_country : details.production_countries?.map((country) => country.iso_3166_1) ?? [],
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
  const stableSetMovieWatched = useStableCallback(setMovieWatched);
  const stableSetLibraryState = useStableCallback(setLibraryState);
  const stableSetPersonalRating = useStableCallback(setPersonalRating);
  const stableRemoveWatchlistItem = useStableCallback(removeWatchlistItem);
  const stableAddFavourite = useStableCallback(addFavourite);
  const stableRemoveFavourite = useStableCallback(removeFavourite);
  const stableToggleEpisodeWatched = useStableCallback(toggleEpisodeWatched);
  const stableToggleSeasonWatched = useStableCallback(toggleSeasonWatched);
  const stableIsEpisodeWatched = useStableCallback(isEpisodeWatched);
  const stableIsSeasonWatched = useStableCallback(isSeasonWatched);
  const stableSetWatchedDates = useStableCallback(setWatchedDates);

  // The owner's scores, public since 2026-11-18 (the owner's choice): every
  // visitor reads them and sees them beside TMDB's; only the admin writes.
  const ratings = useQuery(watchlistRatingsQuery);
  const ratedWatchlist = useMemo(
    () => (ratings.data ? applyRatings(watchlist, ratings.data) : watchlist),
    [ratings.data, watchlist],
  );
  const ratingsStatus: WatchlistContextType['ratingsStatus'] = isAuthLoading
    ? 'loading'
    // Scores already in stay usable when a background refetch fails.
    : ratings.data !== undefined ? 'ready' : ratings.isError ? 'failed' : 'loading';

  const value = useMemo(
    () => ({
      watchlist: ratedWatchlist,
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
      setMovieWatched: stableSetMovieWatched,
      setLibraryState: stableSetLibraryState,
      setPersonalRating: stableSetPersonalRating,
      ratingsStatus,
      addFavourite: stableAddFavourite,
      removeFavourite: stableRemoveFavourite,
      toggleEpisodeWatched: stableToggleEpisodeWatched,
      toggleSeasonWatched: stableToggleSeasonWatched,
      isEpisodeWatched: stableIsEpisodeWatched,
      isSeasonWatched: stableIsSeasonWatched,
      setWatchedDates: stableSetWatchedDates,
      getAutoStatus,
      loadShowEpisodes,
      loadItemDescription,
      fetchData,
    }),
    [
      ratedWatchlist,
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
      stableSetMovieWatched,
      stableSetLibraryState,
      stableSetPersonalRating,
      ratingsStatus,
      stableAddFavourite,
      stableRemoveFavourite,
      stableToggleEpisodeWatched,
      stableToggleSeasonWatched,
      stableIsEpisodeWatched,
      stableIsSeasonWatched,
      stableSetWatchedDates,
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
