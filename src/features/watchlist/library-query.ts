import { queryOptions } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { selectAllPages } from '@/integrations/supabase/select-all-pages';
import { resolveFavouriteCategory, type TmdbFacts } from './favourite-category';
import { releaseYear } from './watchlist-utils';
import type { FavouriteItem, WatchlistItem } from './WatchlistContext';

/** Everything the library grid and the favourites shelf render. */
export interface WatchlistLibrary {
  watchlist: WatchlistItem[];
  favourites: FavouriteItem[];
}

async function readWatchlistLibrary(): Promise<WatchlistLibrary> {
  // Each read is paged: the Data API stops at 1,000 rows without saying
  // so, and a single title-ordered read would drop the end of the
  // alphabet first. `id` breaks title ties so pages never overlap.
  const [moviesResult, showsResult, favouritesResult] = await Promise.all([
    // Every column except `overview`. Plot summaries are 218 kB of the
    // movies table's 357 kB and are only read by the detail dialog, so
    // they load per item in loadItemDescription instead.
    selectAllPages((from, to) => supabase
      .from('movies')
      .select(
        'id, title, platform, genre, release_year, poster, release_date, tmdb_id, runtime',
        { count: 'exact' },
      )
      .order('title', { ascending: true })
      .order('id', { ascending: true })
      .range(from, to), (movie) => String(movie.id)),
    selectAllPages((from, to) => supabase
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
        { count: 'exact' },
      )
      .order('title', { ascending: true })
      .order('id', { ascending: true })
      .range(from, to), (show) => String(show.id)),
    selectAllPages((from, to) => supabase
      .from('favourites')
      .select('*', { count: 'exact' })
      .order('title', { ascending: true })
      .order('id', { ascending: true })
      .range(from, to), (favourite) => String(favourite.id)),
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
      year: releaseYear(show.release_date),
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
