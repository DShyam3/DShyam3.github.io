import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import {
  computeFirstSeenAt,
  type AnnouncementCandidate,
  type SeasonEpisodeCandidate,
} from './watchlist-utils';

// Every hook here reports `failed` alongside its rows. A failed query and an
// empty week are different answers, and the page renders them differently --
// turning the first into the second is how an outage used to read as
// "Nothing this week".

/** `YYYY-MM-DD` in the viewer's own time zone. `release_date` is a calendar
 *  date, so "today" has to be the local one: `toISOString()` gives the UTC
 *  date, which is still yesterday between 00:00 and 01:00 in BST. */
const toDateStr = (date: Date) => {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
};

// PostgREST returns a `!inner` embed on a to-one foreign key as a single
// object; this also accepts the array form so a mapper never has to care.
function unwrapEmbed(value) {
  return Array.isArray(value) ? value[0] : value;
}

export type WatchlistNewsMediaType = 'tv' | 'movie';

export interface PinnedTitle {
  id: number;
  title: string;
  poster: string | null;
  backdrop: string | null;
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
 * The pinned title for the countdown widget (REHAUL_PLAN.md 8.C). Nothing in
 * the app sets `pinned` yet and nothing enforces a single one, so this takes
 * one row from each table and prefers the show.
 */
export function usePinnedTitle() {
  const [pinned, setPinned] = useState<PinnedTitle | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const fetchPinned = useCallback(async () => {
    try {
      const [showResult, movieResult] = await Promise.all([
        supabase
          .from('tv_shows')
          .select('id, title, poster, backdrop, release_date')
          .eq('pinned', true)
          .limit(1)
          .maybeSingle(),
        supabase
          .from('movies')
          .select('id, title, poster, backdrop, release_date')
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
        const { data: nextEpisode, error: nextEpisodeError } = await supabase
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
        backdrop: row.backdrop,
        release_date: releaseDate,
        media_type: mediaType,
      });
      setFailed(false);
    } catch (error) {
      console.error('Error fetching pinned title:', error);
      setPinned(null);
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPinned();
  }, [fetchPinned]);

  return { pinned, loading, failed };
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
  const [failed, setFailed] = useState(false);

  const fetchEpisodes = useCallback(async () => {
    try {
      const today = new Date();
      const cutoff = new Date(today);
      cutoff.setDate(cutoff.getDate() - windowDays);

      const { data, error } = await supabase
        .from('tv_show_episodes')
        .select(EPISODE_EMBED)
        .gte('release_date', toDateStr(cutoff))
        .lte('release_date', toDateStr(today))
        .order('release_date', { ascending: false });

      if (error) throw error;
      setEpisodes((data || []).map(mapEpisodeRow));
      setFailed(false);
    } catch (error) {
      console.error('Error fetching recently released episodes:', error);
      setEpisodes([]);
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [windowDays]);

  useEffect(() => {
    fetchEpisodes();
  }, [fetchEpisodes]);

  return { episodes, loading, failed };
}

/** Episodes with a future air date, nearest first. */
export function useUpcomingEpisodes() {
  const [episodes, setEpisodes] = useState<WatchlistNewsEpisode[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const fetchEpisodes = useCallback(async () => {
    try {
      const today = new Date();

      const { data, error } = await supabase
        .from('tv_show_episodes')
        .select(EPISODE_EMBED)
        .gt('release_date', toDateStr(today))
        .order('release_date', { ascending: true });

      if (error) throw error;
      setEpisodes((data || []).map(mapEpisodeRow));
      setFailed(false);
    } catch (error) {
      console.error('Error fetching upcoming episodes:', error);
      setEpisodes([]);
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEpisodes();
  }, [fetchEpisodes]);

  return { episodes, loading, failed };
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
  const [failed, setFailed] = useState(false);

  const fetchMovies = useCallback(async () => {
    try {
      const today = new Date();
      const cutoff = new Date(today);
      cutoff.setDate(cutoff.getDate() - windowDays);

      const { data, error } = await supabase
        .from('movies')
        .select(MOVIE_SELECT)
        .gte('release_date', toDateStr(cutoff))
        .lte('release_date', toDateStr(today))
        .order('release_date', { ascending: false });

      if (error) throw error;
      setMovies((data || []).map(mapMovieRow));
      setFailed(false);
    } catch (error) {
      console.error('Error fetching recently released movies:', error);
      setMovies([]);
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [windowDays]);

  useEffect(() => {
    fetchMovies();
  }, [fetchMovies]);

  return { movies, loading, failed };
}

/** Movies with a future release date, nearest first. */
export function useUpcomingMovies() {
  const [movies, setMovies] = useState<WatchlistNewsMovie[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const fetchMovies = useCallback(async () => {
    try {
      const today = new Date();

      const { data, error } = await supabase
        .from('movies')
        .select(MOVIE_SELECT)
        .gt('release_date', toDateStr(today))
        .order('release_date', { ascending: true });

      if (error) throw error;
      setMovies((data || []).map(mapMovieRow));
      setFailed(false);
    } catch (error) {
      console.error('Error fetching upcoming movies:', error);
      setMovies([]);
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMovies();
  }, [fetchMovies]);

  return { movies, loading, failed };
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

/** The trigger writes `{ from, to }`; anything else reads as unknown sides. */
function eventPayload(value: Json): WatchlistEvent['payload'] {
  const payload = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {
    from: typeof payload.from === 'string' ? payload.from : null,
    to: typeof payload.to === 'string' ? payload.to : null,
  };
}

/**
 * Platform and status changes from `public.watchlist_events`
 * (REHAUL_PLAN.md 8.C-bis), newest first, over the last `windowDays` days.
 * Fetched over the widest window the Updates control offers (30 days) and
 * filtered client-side by `filterUpdatesByWindow`, so switching "This
 * week"/"Past month" never refetches. The table is written by a trigger on
 * `tv_shows`/`movies`. An event whose title has since been removed from the
 * watchlist is dropped: the row would have nothing to show and nothing to
 * open.
 */
export function useWatchlistEvents(windowDays = WATCHLIST_EVENTS_WINDOW_DAYS) {
  const [events, setEvents] = useState<WatchlistEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const fetchEvents = useCallback(async () => {
    try {
      const cutoff = new Date(Date.now() - windowDays * 86_400_000).toISOString();
      const { data, error } = await supabase
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
          ? supabase.from('tv_shows').select('id, title, poster, platform').in('id', tvIds)
          : Promise.resolve({ data: [], error: null }),
        movieIds.length
          ? supabase.from('movies').select('id, title, poster, platform').in('id', movieIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (showsResult.error) throw showsResult.error;
      if (moviesResult.error) throw moviesResult.error;

      const showsById = new Map((showsResult.data || []).map((row) => [row.id, row]));
      const moviesById = new Map((moviesResult.data || []).map((row) => [row.id, row]));

      setEvents(
        rows.flatMap((row): WatchlistEvent[] => {
          const source =
            row.entity_type === 'tv_show'
              ? showsById.get(row.entity_id)
              : moviesById.get(row.entity_id);
          if (!source) return [];
          return [{
            id: row.id,
            // CHECK constraints hold both columns to these values; the
            // generated types only know they are text.
            entity_type: row.entity_type as WatchlistEventEntityType,
            entity_id: row.entity_id,
            kind: row.kind as WatchlistEventKind,
            occurred_at: row.occurred_at,
            payload: eventPayload(row.payload),
            title: source.title,
            poster: source.poster ?? null,
            platform: source.platform ?? null,
          }];
        }),
      );
      setFailed(false);
    } catch (error) {
      console.error('Error fetching watchlist events:', error);
      setEvents([]);
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [windowDays]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  return { events, loading, failed };
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

// PostgREST stops at 1,000 rows whether asked to or not, and a show's whole
// back catalogue lands at once when it is first added -- as the newest rows,
// so any cut falls on older, genuine announcements. No order makes the cut
// harmless; a capped result is reported as partial instead of passed off as
// complete.
const ANNOUNCEMENT_ROW_CAP = 1000;

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
  const [failed, setFailed] = useState(false);

  const fetchAnnouncements = useCallback(async () => {
    try {
      const cutoff = new Date(Date.now() - windowDays * 86_400_000).toISOString();

      const [seasonsResult, episodesResult] = await Promise.all([
        supabase
          .from('tv_show_seasons')
          .select('id, tv_show_id, season_number, created_at, tv_shows!inner(title, poster, platform)')
          .gt('created_at', cutoff)
          .order('created_at', { ascending: false })
          .limit(ANNOUNCEMENT_ROW_CAP),
        supabase
          .from('tv_show_episodes')
          .select(
            'id, episode_number, title, release_date, created_at, tv_show_seasons!inner(season_number, tv_show_id, tv_shows!inner(title, poster, platform))',
          )
          .gt('created_at', cutoff)
          .order('created_at', { ascending: false })
          .limit(ANNOUNCEMENT_ROW_CAP),
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
        ? await supabase.from('tv_show_seasons').select('tv_show_id, created_at').in('tv_show_id', showIds)
        : { data: [], error: null };

      if (allSeasonsResult.error) throw allSeasonsResult.error;

      setAnnouncements(candidates);
      setFirstSeenByShow(computeFirstSeenAt(allSeasonsResult.data || []));
      setFailed(
        (seasonsResult.data?.length ?? 0) >= ANNOUNCEMENT_ROW_CAP ||
          (episodesResult.data?.length ?? 0) >= ANNOUNCEMENT_ROW_CAP,
      );
    } catch (error) {
      console.error('Error fetching watchlist announcements:', error);
      setAnnouncements([]);
      setFirstSeenByShow(new Map());
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [windowDays]);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  return { announcements, firstSeenByShow, loading, failed };
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
 * Keyed by `${tv_show_id}:${season_number}`. Empty when there is nothing to
 * check; empty with `failed` set when the query fails.
 */
export function usePremiereSeasonEpisodes(seasons: PremiereSeasonKey[]) {
  const [episodesBySeason, setEpisodesBySeason] = useState<
    Map<string, SeasonEpisodeCandidate[]>
  >(new Map());
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  // `seasons` is rebuilt on every render of the caller; the effect keys off
  // its contents instead of its identity so it does not refetch every render.
  const seasonsKey = seasons
    .map((s) => `${s.tv_show_id}:${s.season_number}`)
    .sort()
    .join(',');

  const fetchEpisodes = useCallback(async () => {
    if (seasonsKey === '') {
      setEpisodesBySeason(new Map());
      setFailed(false);
      setLoading(false);
      return;
    }

    const wanted = new Set(seasonsKey.split(','));
    const showIds = Array.from(
      new Set(seasonsKey.split(',').map((pair) => Number(pair.split(':')[0]))),
    );

    try {
      const { data, error } = await supabase
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
      setFailed(false);
    } catch (error) {
      console.error('Error fetching premiere season episodes:', error);
      setEpisodesBySeason(new Map());
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [seasonsKey]);

  useEffect(() => {
    fetchEpisodes();
  }, [fetchEpisodes]);

  return { episodesBySeason, loading, failed };
}
