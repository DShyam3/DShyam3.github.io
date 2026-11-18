import { queryOptions } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { selectAllPages } from '@/integrations/supabase/select-all-pages';
import type { WatchlistItem } from './WatchlistContext';

/**
 * The owner's personal scores. They live in `watchlist_ratings`, which only
 * the signed-in owner can read, so they never reach a visitor -- not in the
 * page and not through the public API. One row names exactly one target.
 */
export interface RatingRow {
  movie_id: number | null;
  tv_show_id: number | null;
  season_id: number | null;
  episode_id: number | null;
  rating: number;
}

export const watchlistRatingsQuery = queryOptions({
  queryKey: ['watchlist', 'ratings'] as const,
  staleTime: 5 * 60 * 1000,
  // Paged: there are thousands of episodes to rate, and the Data API stops
  // at 1,000 rows without saying so. A short read would show rated titles
  // as unrated. Default retries; a failure is shown, never read as "none".
  queryFn: async (): Promise<RatingRow[]> => {
    const { data, error } = await selectAllPages((from, to) => supabase
      .from('watchlist_ratings')
      .select('id, movie_id, tv_show_id, season_id, episode_id, rating', { count: 'exact' })
      .order('id', { ascending: true })
      .range(from, to), (row) => String(row.id));
    if (error) throw new Error(error.message);
    return data.map(({ movie_id, tv_show_id, season_id, episode_id, rating }) => ({ movie_id, tv_show_id, season_id, episode_id, rating }));
  },
});

export type RatingTarget =
  | { movie_id: number }
  | { tv_show_id: number }
  | { season_id: number }
  | { episode_id: number };

export const ratingColumn = (target: RatingTarget) =>
  Object.keys(target)[0] as 'movie_id' | 'tv_show_id' | 'season_id' | 'episode_id';

/** The rows after one score is set (or cleared, with null). */
export function withRating(rows: readonly RatingRow[], target: RatingTarget, rating: number | null): RatingRow[] {
  const column = ratingColumn(target);
  const id = (target as Record<string, number>)[column];
  const rest = rows.filter((row) => row[column] !== id);
  if (rating === null) return rest;
  return [...rest, { movie_id: null, tv_show_id: null, season_id: null, episode_id: null, [column]: id, rating }];
}

/** The library with the owner's scores laid onto titles, seasons and episodes. */
export function applyRatings(watchlist: WatchlistItem[], rows: readonly RatingRow[]): WatchlistItem[] {
  if (rows.length === 0) return watchlist;
  const movies = new Map<number, number>();
  const shows = new Map<number, number>();
  const seasons = new Map<number, number>();
  const episodes = new Map<number, number>();
  for (const row of rows) {
    if (row.movie_id != null) movies.set(row.movie_id, row.rating);
    else if (row.tv_show_id != null) shows.set(row.tv_show_id, row.rating);
    else if (row.season_id != null) seasons.set(row.season_id, row.rating);
    else if (row.episode_id != null) episodes.set(row.episode_id, row.rating);
  }
  return watchlist.map((item) => {
    if (item.category === 'Movies') {
      const rating = movies.get(Number(item.id));
      return rating === undefined ? item : { ...item, personal_rating: rating };
    }
    const rating = shows.get(Number(item.id));
    const touched = rating !== undefined || (item.seasons ?? []).some((season) =>
      (season.id != null && seasons.has(season.id)) || season.episodes.some((episode) => episode.id != null && episodes.has(episode.id)));
    if (!touched) return item;
    return {
      ...item,
      personal_rating: rating ?? item.personal_rating,
      seasons: item.seasons?.map((season) => ({
        ...season,
        personal_rating: season.id != null ? seasons.get(season.id) ?? season.personal_rating : season.personal_rating,
        episodes: season.episodes.map((episode) => {
          const score = episode.id != null ? episodes.get(episode.id) : undefined;
          return score === undefined ? episode : { ...episode, personal_rating: score };
        }),
      })),
    };
  });
}
