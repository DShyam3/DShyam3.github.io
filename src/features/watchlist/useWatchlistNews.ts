import { useState, useEffect, useCallback } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import {
  computeFirstSeenAt,
  type AnnouncementCandidate,
  type SeasonEpisodeCandidate,
} from './watchlist-utils';

// `pinned`, `trailer_key` (tv_shows/movies) and `created_at`
// (tv_show_seasons/tv_show_episodes) were added by migration
// 20260912100000, which src/integrations/supabase/types.ts has not been
// regenerated against yet. The generated client cannot type a column it does
// not know about, so these hooks drop to the untyped client once here rather
// than casting at every call site -- same pattern as useSupabaseTable.ts.
const db = supabase as unknown as SupabaseClient;

const toDateStr = (date: Date) => date.toISOString().slice(0, 10);

// The untyped client (see `db` above) has no schema to tell it a `!inner`
// embed on a to-one foreign key returns a single object rather than an
// array, so it types every embed as an array. It is a single object at
// runtime regardless -- this reads it back out either way.
function unwrapEmbed(value) {
  return Array.isArray(value) ? value[0] : value;
}

export type WatchlistNewsMediaType = 'tv' | 'movie';

export interface PinnedTitle {
  id: number;
  title: string;
  poster: string | null;
  /**
   * The date the Countdown card counts down to. For a movie this is its own
   * `release_date`. For a TV show it is the next upcoming episode's
   * `release_date` when one is scheduled, otherwise the show's own
   * `release_date` -- so a pinned show with a dated next episode counts down
   * to that episode, not to when it first aired.
   */
  release_date: string | null;
  media_type: WatchlistNewsMediaType;
}

/**
 * The single pinned title for the countdown widget (REHAUL_PLAN.md 8.C). At
 * most one row across `tv_shows` and `movies` should be pinned at a time --
 * enforced in WatchlistContext.tsx, not here -- so whichever table answers
 * first wins; there is nothing to reconcile between them.
 */
export function usePinnedTitle() {
  const [pinned, setPinned] = useState<PinnedTitle | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchPinned = useCallback(async () => {
    try {
      const [showResult, movieResult] = await Promise.all([
        db
          .from('tv_shows')
          .select('id, title, poster, release_date')
          .eq('pinned', true)
          .limit(1)
          .maybeSingle(),
        db
          .from('movies')
          .select('id, title, poster, release_date')
          .eq('pinned', true)
          .limit(1)
          .maybeSingle(),
      ]);

      if (showResult.error) throw showResult.error;
      if (movieResult.error) throw movieResult.error;

      const row = showResult.data || movieResult.data;
      if (!row) {
        setPinned(null);
        return;
      }

      const mediaType: WatchlistNewsMediaType = showResult.data ? 'tv' : 'movie';
      let releaseDate: string | null = row.release_date;

      if (mediaType === 'tv') {
        const { data: nextEpisode, error: nextEpisodeError } = await db
          .from('tv_show_episodes')
          .select('release_date, tv_show_seasons!inner(tv_show_id)')
          .eq('tv_show_seasons.tv_show_id', row.id)
          .gt('release_date', toDateStr(new Date()))
          .order('release_date', { ascending: true })
          .limit(1)
          .maybeSingle();

        if (nextEpisodeError) throw nextEpisodeError;
        if (nextEpisode?.release_date) releaseDate = nextEpisode.release_date;
      }

      setPinned({
        id: row.id,
        title: row.title,
        poster: row.poster,
        release_date: releaseDate,
        media_type: mediaType,
      });
    } catch (error) {
      console.error('Error fetching pinned title:', error);
      setPinned(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPinned();
  }, [fetchPinned]);

  return { pinned, loading };
}

export interface WatchlistNewsEpisode {
  tv_show_id: number;
  title: string;
  poster: string | null;
  platform: string;
  season_number: number;
  episode_number: number;
  episode_title: string | null;
  release_date: string;
  watched: boolean;
}

/** Flattens the `tv_show_episodes -> tv_show_seasons -> tv_shows` embed. */
function mapEpisodeRow(row): WatchlistNewsEpisode {
  const season = unwrapEmbed(row.tv_show_seasons) || {};
  const show = unwrapEmbed(season.tv_shows) || {};
  return {
    tv_show_id: season.tv_show_id,
    title: show.title ?? '',
    poster: show.poster ?? null,
    platform: show.platform ?? '',
    season_number: season.season_number,
    episode_number: row.episode_number,
    episode_title: row.title,
    release_date: row.release_date,
    watched: !!row.watched,
  };
}

const EPISODE_EMBED =
  'episode_number, title, release_date, watched, tv_show_seasons!inner(season_number, tv_show_id, tv_shows!inner(title, poster, platform))';

/** Episodes aired in the last 30 days, newest first, watched or not. */
export function useRecentEpisodes(windowDays = 30) {
  const [episodes, setEpisodes] = useState<WatchlistNewsEpisode[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEpisodes = useCallback(async () => {
    try {
      const today = new Date();
      const cutoff = new Date(today);
      cutoff.setDate(cutoff.getDate() - windowDays);

      const { data, error } = await db
        .from('tv_show_episodes')
        .select(EPISODE_EMBED)
        .gte('release_date', toDateStr(cutoff))
        .lte('release_date', toDateStr(today))
        .order('release_date', { ascending: false });

      if (error) throw error;
      setEpisodes((data || []).map(mapEpisodeRow));
    } catch (error) {
      console.error('Error fetching recently released episodes:', error);
      setEpisodes([]);
    } finally {
      setLoading(false);
    }
  }, [windowDays]);

  useEffect(() => {
    fetchEpisodes();
  }, [fetchEpisodes]);

  return { episodes, loading };
}

/** Episodes with a future air date, nearest first. */
export function useUpcomingEpisodes() {
  const [episodes, setEpisodes] = useState<WatchlistNewsEpisode[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEpisodes = useCallback(async () => {
    try {
      const today = new Date();

      const { data, error } = await db
        .from('tv_show_episodes')
        .select(EPISODE_EMBED)
        .gt('release_date', toDateStr(today))
        .order('release_date', { ascending: true });

      if (error) throw error;
      setEpisodes((data || []).map(mapEpisodeRow));
    } catch (error) {
      console.error('Error fetching upcoming episodes:', error);
      setEpisodes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEpisodes();
  }, [fetchEpisodes]);

  return { episodes, loading };
}

export interface WatchlistNewsMovie {
  id: number;
  title: string;
  poster: string | null;
  platform: string;
  release_date: string;
}

function mapMovieRow(row): WatchlistNewsMovie {
  return {
    id: row.id,
    title: row.title,
    poster: row.poster ?? null,
    platform: row.platform ?? '',
    release_date: row.release_date,
  };
}

const MOVIE_SELECT = 'id, title, poster, platform, release_date';

/** Movies released within the last `windowDays` days, newest first. */
export function useRecentMovies(windowDays = 30) {
  const [movies, setMovies] = useState<WatchlistNewsMovie[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMovies = useCallback(async () => {
    try {
      const today = new Date();
      const cutoff = new Date(today);
      cutoff.setDate(cutoff.getDate() - windowDays);

      const { data, error } = await db
        .from('movies')
        .select(MOVIE_SELECT)
        .gte('release_date', toDateStr(cutoff))
        .lte('release_date', toDateStr(today))
        .order('release_date', { ascending: false });

      if (error) throw error;
      setMovies((data || []).map(mapMovieRow));
    } catch (error) {
      console.error('Error fetching recently released movies:', error);
      setMovies([]);
    } finally {
      setLoading(false);
    }
  }, [windowDays]);

  useEffect(() => {
    fetchMovies();
  }, [fetchMovies]);

  return { movies, loading };
}

/** Movies with a future release date, nearest first. */
export function useUpcomingMovies() {
  const [movies, setMovies] = useState<WatchlistNewsMovie[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMovies = useCallback(async () => {
    try {
      const today = new Date();

      const { data, error } = await db
        .from('movies')
        .select(MOVIE_SELECT)
        .gt('release_date', toDateStr(today))
        .order('release_date', { ascending: true });

      if (error) throw error;
      setMovies((data || []).map(mapMovieRow));
    } catch (error) {
      console.error('Error fetching upcoming movies:', error);
      setMovies([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMovies();
  }, [fetchMovies]);

  return { movies, loading };
}

export type WatchlistEventEntityType = 'tv_show' | 'movie';
export type WatchlistEventKind = 'platform_change' | 'status_change';

export interface WatchlistEvent {
  id: number;
  entity_type: WatchlistEventEntityType;
  entity_id: number;
  kind: WatchlistEventKind;
  occurred_at: string;
  payload: { from: string | null; to: string | null };
  title: string;
  poster: string | null;
  platform: string | null;
}

const WATCHLIST_EVENTS_WINDOW_DAYS = 30;

/**
 * Platform and status changes from `public.watchlist_events`
 * (REHAUL_PLAN.md 8.C-bis), newest first, over the last `windowDays` days.
 * Fetched over the widest window the Updates control offers (30 days) and
 * filtered client-side by `filterUpdatesByWindow`, so switching "This
 * week"/"Past month" never refetches. The table is written by a trigger on
 * `tv_shows`/`movies` (see migration 20260912140000) and may not exist yet on
 * a database that has not had it applied -- the query then throws and this
 * degrades to an empty list exactly like `useUpNext` does for
 * `watchlist_up_next`, never a thrown error or a toast.
 */
export function useWatchlistEvents(windowDays = WATCHLIST_EVENTS_WINDOW_DAYS) {
  const [events, setEvents] = useState<WatchlistEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEvents = useCallback(async () => {
    try {
      const cutoff = new Date(Date.now() - windowDays * 86_400_000).toISOString();
      const { data, error } = await db
        .from('watchlist_events')
        .select('id, entity_type, entity_id, kind, occurred_at, payload')
        .gte('occurred_at', cutoff)
        .order('occurred_at', { ascending: false });

      if (error) throw error;

      const rows = data || [];
      const tvIds = rows
        .filter((row) => row.entity_type === 'tv_show')
        .map((row) => row.entity_id);
      const movieIds = rows
        .filter((row) => row.entity_type === 'movie')
        .map((row) => row.entity_id);

      const [showsResult, moviesResult] = await Promise.all([
        tvIds.length
          ? db.from('tv_shows').select('id, title, poster, platform').in('id', tvIds)
          : Promise.resolve({ data: [], error: null }),
        movieIds.length
          ? db.from('movies').select('id, title, poster, platform').in('id', movieIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (showsResult.error) throw showsResult.error;
      if (moviesResult.error) throw moviesResult.error;

      const showsById = new Map((showsResult.data || []).map((row) => [row.id, row]));
      const moviesById = new Map((moviesResult.data || []).map((row) => [row.id, row]));

      setEvents(
        rows.map((row): WatchlistEvent => {
          const source =
            row.entity_type === 'tv_show'
              ? showsById.get(row.entity_id)
              : moviesById.get(row.entity_id);
          return {
            id: row.id,
            entity_type: row.entity_type,
            entity_id: row.entity_id,
            kind: row.kind,
            occurred_at: row.occurred_at,
            payload: row.payload || {},
            title: source?.title ?? '',
            poster: source?.poster ?? null,
            platform: source?.platform ?? null,
          };
        }),
      );
    } catch (error) {
      // Includes the table-not-yet-migrated case -- an absent section, never
      // a thrown error or a toast. See the doc comment above.
      console.error('Error fetching watchlist events:', error);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [windowDays]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  return { events, loading };
}

// Rows that predate migration 20260912090000 carry a null created_at -- see
// the COMMENT ON COLUMN for tv_show_seasons.created_at /
// tv_show_episodes.created_at in supabase/schemas/20_watchlist.sql. That is
// what makes a rolling window safe here rather than dangerous: `created_at >
// <cutoff>` is UNKNOWN for a null row, so the pre-existing library drops out
// on its own and the feed fills only as the sync inserts genuinely new rows.
//
// This replaced a fixed floor pinned to that migration's timestamp. Both hide
// the same rows; the floor only kept doing so for as long as every future
// reader remembered a constant that nothing enforced.
const ANNOUNCEMENT_WINDOW_DAYS = 7;

/**
 * Seasons and episodes inserted within the window (candidates -- not every
 * one is an announcement, see `isAnnouncement` in watchlist-utils.ts), plus
 * every season's `created_at` -- including nulls -- for each show a
 * candidate belongs to, folded into `firstSeenByShow` via
 * `computeFirstSeenAt`. That second fetch is what lets
 * `groupAnnouncementsByShow` tell a genuine announcement apart from a show's
 * back catalogue landing in one batch when it is first added.
 */
export function useRecentAnnouncements(windowDays = ANNOUNCEMENT_WINDOW_DAYS) {
  const [announcements, setAnnouncements] = useState<AnnouncementCandidate[]>([]);
  const [firstSeenByShow, setFirstSeenByShow] = useState<Map<number, string | null>>(new Map());
  const [loading, setLoading] = useState(true);

  const fetchAnnouncements = useCallback(async () => {
    try {
      const cutoff = new Date(Date.now() - windowDays * 86_400_000).toISOString();

      const [seasonsResult, episodesResult] = await Promise.all([
        db
          .from('tv_show_seasons')
          .select('id, tv_show_id, season_number, created_at, tv_shows!inner(title, poster, platform)')
          .gt('created_at', cutoff),
        db
          .from('tv_show_episodes')
          .select(
            'id, episode_number, title, release_date, created_at, tv_show_seasons!inner(season_number, tv_show_id, tv_shows!inner(title, poster, platform))',
          )
          .gt('created_at', cutoff),
      ]);

      if (seasonsResult.error) throw seasonsResult.error;
      if (episodesResult.error) throw episodesResult.error;

      const seasonItems: AnnouncementCandidate[] = (seasonsResult.data || []).map(
        (row): AnnouncementCandidate => {
          const show = unwrapEmbed(row.tv_shows) || {};
          return {
            kind: 'season',
            tv_show_id: row.tv_show_id,
            title: show.title ?? '',
            poster: show.poster ?? null,
            platform: show.platform ?? null,
            season_number: row.season_number,
            created_at: row.created_at,
          };
        },
      );

      const episodeItems: AnnouncementCandidate[] = (episodesResult.data || []).map(
        (row): AnnouncementCandidate => {
          const season = unwrapEmbed(row.tv_show_seasons) || {};
          const show = unwrapEmbed(season.tv_shows) || {};
          return {
            kind: 'episode',
            tv_show_id: season.tv_show_id,
            title: show.title ?? '',
            poster: show.poster ?? null,
            platform: show.platform ?? null,
            season_number: season.season_number,
            episode_number: row.episode_number,
            episode_title: row.title,
            release_date: row.release_date,
            created_at: row.created_at,
          };
        },
      );

      const candidates = [...seasonItems, ...episodeItems];
      const showIds = Array.from(new Set(candidates.map((item) => item.tv_show_id)));

      const allSeasonsResult = showIds.length
        ? await db.from('tv_show_seasons').select('tv_show_id, created_at').in('tv_show_id', showIds)
        : { data: [], error: null };

      if (allSeasonsResult.error) throw allSeasonsResult.error;

      setAnnouncements(candidates);
      setFirstSeenByShow(computeFirstSeenAt(allSeasonsResult.data || []));
    } catch (error) {
      console.error('Error fetching watchlist announcements:', error);
      setAnnouncements([]);
      setFirstSeenByShow(new Map());
    } finally {
      setLoading(false);
    }
  }, [windowDays]);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  return { announcements, firstSeenByShow, loading };
}

/** One (show, season) pair to check for `isSeasonFinished`. */
export interface PremiereSeasonKey {
  tv_show_id: number;
  season_number: number;
}

/**
 * `watched`/`release_date` for every episode of a set of premiere seasons --
 * what `isSeasonFinished` needs to decide whether an Out Now premiere's
 * season is already finished. Fetched separately from the recently-released
 * window because a season can be finished by episodes outside it: a
 * full-season drop watched days after its last episode, or a weekly season
 * where only episode 1 falls in the Out Now window.
 *
 * Keyed by `${tv_show_id}:${season_number}`. Degrades to an empty map on
 * error or when there is nothing to check, same as every other hook here.
 */
export function usePremiereSeasonEpisodes(seasons: PremiereSeasonKey[]) {
  const [episodesBySeason, setEpisodesBySeason] = useState<
    Map<string, SeasonEpisodeCandidate[]>
  >(new Map());
  const [loading, setLoading] = useState(true);

  // `seasons` is rebuilt on every render of the caller; the effect keys off
  // its contents instead of its identity so it does not refetch every render.
  const seasonsKey = seasons
    .map((s) => `${s.tv_show_id}:${s.season_number}`)
    .sort()
    .join(',');

  const fetchEpisodes = useCallback(async () => {
    if (seasonsKey === '') {
      setEpisodesBySeason(new Map());
      setLoading(false);
      return;
    }

    const wanted = new Set(seasonsKey.split(','));
    const showIds = Array.from(
      new Set(seasonsKey.split(',').map((pair) => Number(pair.split(':')[0]))),
    );

    try {
      const { data, error } = await db
        .from('tv_show_episodes')
        .select('release_date, watched, tv_show_seasons!inner(season_number, tv_show_id)')
        .in('tv_show_seasons.tv_show_id', showIds);

      if (error) throw error;

      const map = new Map<string, SeasonEpisodeCandidate[]>();
      for (const row of data || []) {
        const season = unwrapEmbed(row.tv_show_seasons) || {};
        const key = `${season.tv_show_id}:${season.season_number}`;
        if (!wanted.has(key)) continue;
        const list = map.get(key) ?? [];
        list.push({ release_date: row.release_date, watched: !!row.watched });
        map.set(key, list);
      }
      setEpisodesBySeason(map);
    } catch (error) {
      console.error('Error fetching premiere season episodes:', error);
      setEpisodesBySeason(new Map());
    } finally {
      setLoading(false);
    }
  }, [seasonsKey]);

  useEffect(() => {
    fetchEpisodes();
  }, [fetchEpisodes]);

  return { episodesBySeason, loading };
}
