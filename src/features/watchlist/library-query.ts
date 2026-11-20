import { queryOptions } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { selectAllPages } from '@/integrations/supabase/select-all-pages';
import { resolveFavouriteCategory, type TmdbFacts } from './favourite-category';
import type { LibraryState } from './library-state';
import { releaseYear } from './watchlist-utils';
import { missingActivityColumn, missingCategoryColumns } from './category-schema';
import type { FavouriteItem, WatchlistItem } from './WatchlistContext';


/** Everything the library grid and the favourites shelf render. */
export interface WatchlistLibrary {
  watchlist: WatchlistItem[];
  favourites: FavouriteItem[];
}

// Every column except `overview`. Plot summaries are 218 kB of the movies
// table's 357 kB and are only read by the detail dialog, so they load per
// item in loadItemDescription instead.
const MOVIE_COLUMNS = `id, title, platform, genre, genre_ids, original_language, origin_country, release_year, poster, release_date, tmdb_id, runtime,
  watched, watched_at, library_state, collection_id, collection_name, franchise,
  imdb_id, imdb_rating, imdb_votes, rt_score, metascore, tmdb_rating, tmdb_votes` as const;

// Deliberately not `tv_show_episodes (*)`. Every mount of this page was
// pulling all ~7,600 episode rows in full (~474 kB) purely to render a grid
// of posters. The grid needs episode_number and watched, runtime for the
// watched total, and air dates for scheduling; episode titles load per show
// when a detail dialog opens. As above: no `overview` (62 kB of tv_shows'
// 108 kB).
const SHOW_COLUMNS = `id, title, platform, genre, genre_ids, original_language, origin_country, status, poster, release_date, tmdb_id, library_state, franchise,
  imdb_id, imdb_rating, imdb_votes, rt_score, metascore, tmdb_rating, tmdb_votes,
  tv_show_seasons (
    id, season_number, release_date, watched,
    tv_show_episodes (id, episode_number, watched, runtime, release_date)
  )` as const;

/** A column some stack has not been migrated to yet, so read without it. */
const rolloutGap = (message: string) => missingActivityColumn(message) || missingCategoryColumns(message);

async function readWatchlistLibrary(): Promise<WatchlistLibrary> {
  // Each read is paged: the Data API stops at 1,000 rows without saying
  // so, and a single title-ordered read would drop the end of the
  // alphabet first. `id` breaks title ties so pages never overlap.
  const [moviesResult, showsResult, favouritesResult, lastWatchedResult] = await Promise.all([
    // `last_activity_at` first; a stack without its migration reads the
    // rest, and older stacks still drop the TMDB facts columns as before.
    (async () => {
      const withActivity = await selectAllPages((from, to) => supabase
      .from('movies')
      .select(`${MOVIE_COLUMNS}, last_activity_at`, { count: 'exact' })
      .order('title', { ascending: true })
      .order('id', { ascending: true })
      .range(from, to), (movie) => String(movie.id));
      if (!withActivity.error || !rolloutGap(withActivity.error.message)) return withActivity;
      const withFacts = await selectAllPages((from, to) => supabase
      .from('movies')
      .select(MOVIE_COLUMNS, { count: 'exact' })
      .order('title', { ascending: true })
      .order('id', { ascending: true })
      .range(from, to), (movie) => String(movie.id));
      if (!withFacts.error || !missingCategoryColumns(withFacts.error.message)) return withFacts;
      return selectAllPages((from, to) => supabase.from('movies')
        .select(`id, title, platform, genre, release_year, poster, release_date, tmdb_id, runtime,
          watched, watched_at, library_state, collection_id, collection_name, imdb_id, imdb_rating, imdb_votes, rt_score, metascore, tmdb_rating, tmdb_votes`, { count: 'exact' })
        .order('title', { ascending: true }).order('id', { ascending: true }).range(from, to), (movie) => String(movie.id));
    })(),
    (async () => {
      const withActivity = await selectAllPages((from, to) => supabase
      .from('tv_shows')
      .select(`${SHOW_COLUMNS}, last_activity_at`, { count: 'exact' })
      .order('title', { ascending: true })
      .order('id', { ascending: true })
      .range(from, to), (show) => String(show.id));
      if (!withActivity.error || !rolloutGap(withActivity.error.message)) return withActivity;
      const withFacts = await selectAllPages((from, to) => supabase
      .from('tv_shows')
      .select(SHOW_COLUMNS, { count: 'exact' })
      .order('title', { ascending: true })
      .order('id', { ascending: true })
      .range(from, to), (show) => String(show.id));
      if (!withFacts.error || !missingCategoryColumns(withFacts.error.message)) return withFacts;
      return selectAllPages((from, to) => supabase.from('tv_shows')
        .select(`id, title, platform, genre, status, poster, release_date, tmdb_id, library_state,
          imdb_id, imdb_rating, imdb_votes, rt_score, metascore, tmdb_rating, tmdb_votes,
          tv_show_seasons (id, season_number, release_date, watched,
            tv_show_episodes (id, episode_number, watched, runtime, release_date))`, { count: 'exact' })
        .order('title', { ascending: true }).order('id', { ascending: true }).range(from, to), (show) => String(show.id));
    })(),
    selectAllPages((from, to) => supabase
      .from('favourites')
      .select('id, title, poster, media_type, tmdb_id, created_at, category, original_language, origin_country, genre_ids', { count: 'exact' })
      .order('title', { ascending: true })
      .order('id', { ascending: true })
      .range(from, to), (favourite) => String(favourite.id)),
    // When each series was last watched: one row per show with a dated
    // watch, so far fewer rows than shows and no paging needed. On a stack
    // without the view (migration 20261118074422 not applied) the read
    // fails and series simply carry no watch date.
    supabase.from('watchlist_show_last_watched').select('tv_show_id, last_watched_at'),
  ]);
  // Personal scores are not read here: they live in the owner-only
  // watchlist_ratings table, which this public read cannot see (ratings-query).

  const lastWatched = new Map<string, string>();
  if (!lastWatchedResult.error) {
    for (const row of lastWatchedResult.data ?? []) {
      if (row.tv_show_id != null && row.last_watched_at) lastWatched.set(String(row.tv_show_id), row.last_watched_at);
    }
  }

  if (moviesResult.error) throw moviesResult.error;
  if (showsResult.error) throw showsResult.error;
  if (favouritesResult.error) throw favouritesResult.error;

  const mappedMovies: WatchlistItem[] = (moviesResult.data || []).map(
    (movie) => ({
      id: movie.id.toString(),
      watched: movie.watched,
      watched_at: movie.watched_at,
      library_state: movie.library_state as LibraryState,
      last_activity_at: ('last_activity_at' in movie ? movie.last_activity_at : null) as string | null,
      title: movie.title,
      category: 'Movies',
      description: undefined,
      descriptionLoaded: false,
      year: movie.release_year || undefined,
      runtime: movie.runtime || undefined,
      genres: movie.genre
        ? movie.genre.split(',').map((g) => g.trim())
        : [],
      genre_ids: ('genre_ids' in movie ? movie.genre_ids : null) as number[] | null,
      original_language: ('original_language' in movie ? movie.original_language : null) as string | null,
      origin_country: ('origin_country' in movie ? movie.origin_country : null) as string[] | null,
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
      imdb_id: movie.imdb_id ?? undefined,
      imdb_rating: movie.imdb_rating ?? undefined,
      imdb_votes: movie.imdb_votes ?? undefined,
      tmdb_rating: movie.tmdb_rating ?? undefined,
      tmdb_votes: movie.tmdb_votes ?? undefined,
      rt_score: movie.rt_score ?? undefined,
      metascore: movie.metascore ?? undefined,
      collection_id: movie.collection_id ?? undefined,
      collection_name: movie.collection_name ?? undefined,
      franchise: (('franchise' in movie ? movie.franchise : null) as string | null) ?? undefined,
    }),
  );

  const mappedShows: WatchlistItem[] = (showsResult.data || []).map(
    (show) => ({
      id: show.id.toString(),
      library_state: show.library_state as LibraryState,
      last_activity_at: ('last_activity_at' in show ? show.last_activity_at : null) as string | null,
      franchise: (('franchise' in show ? show.franchise : null) as string | null) ?? undefined,
      watched_at: lastWatched.get(String(show.id)) ?? null,
      title: show.title,
      category: 'TV Shows' as const,
      status: show.status || 'Plan to Watch',
      description: undefined,
      descriptionLoaded: false,
      year: releaseYear(show.release_date),
      genres: show.genre
        ? show.genre.split(',').map((g: string) => g.trim())
        : [],
      genre_ids: ('genre_ids' in show ? show.genre_ids : null) as number[] | null,
      original_language: ('original_language' in show ? show.original_language : null) as string | null,
      origin_country: ('origin_country' in show ? show.origin_country : null) as string[] | null,
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
      imdb_id: show.imdb_id ?? undefined,
      imdb_rating: show.imdb_rating ?? undefined,
      imdb_votes: show.imdb_votes ?? undefined,
      tmdb_rating: show.tmdb_rating ?? undefined,
      tmdb_votes: show.tmdb_votes ?? undefined,
      rt_score: show.rt_score ?? undefined,
      metascore: show.metascore ?? undefined,
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

  return { watchlist: [...mappedMovies, ...mappedShows], favourites: mappedFavourites };
}

/**
 * The library as one cache entry, so the site warm-up can read it before
 * /watchlist opens and leaving the page does not throw it away.
 *
 * `WatchlistProvider` seeds its state from this entry on mount and writes its
 * own edits back into it, so the entry is the provider's state kept alive
 * across unmounts rather than a plain database read.
 */
export const watchlistLibraryQuery = queryOptions({
  queryKey: ['watchlist', 'library'],
  queryFn: readWatchlistLibrary,
  staleTime: 10 * 60 * 1000,
  // The provider owns these objects' identity and writes them back on every
  // edit; structural sharing would deep-compare ~7,600 episode rows each time
  // to preserve references nothing relies on.
  structuralSharing: false,
});

/** The `show-sN-eN` keys of every watched episode in a library. */
export function watchedEpisodeKeys(watchlist: WatchlistItem[]): Set<string> {
  const keys = new Set<string>();
  watchlist.forEach((show) => {
    show.seasons?.forEach((season) => {
      season.episodes.forEach((ep) => {
        if (ep.watched) {
          keys.add(`${show.id}-s${season.season_number}-e${ep.episode_number}`);
        }
      });
    });
  });
  return keys;
}
