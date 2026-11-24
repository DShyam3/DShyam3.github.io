/**
 * Wildcards: a few places in YOU MIGHT LIKE (one for every five other
 * suggestions on screen, see `admitWildcards`) for well-loved titles outside
 * the genres the owner usually watches. Every other suggestion comes from
 * what they already like, so without these the profile never hears about a
 * genre it has not seen. Answering one feeds the profile like any other tile.
 *
 * Fixed rules over the page's taste profile, like the rest of Discover: the
 * same profile, week and page always ask TMDB the same question.
 */

import type { DiscoveryMedia } from './discovery';
import { GENRE_NAMES, avoidedGenres, tasteGenres, type TasteProfile } from './taste-profile';

/**
 * A genre is outside the usual below this share of the profile's best-liked
 * genre; at or above it, it is one the owner already watches.
 */
export const WILDCARD_MAX_SHARE = 0.25;
/** How many of the best-liked genres a wildcard may not carry. */
const USUAL_GENRES = 3;

/**
 * Genres a wildcard can be drawn from, in each media's own TMDB ids. Films
 * leave out TV Movie; series leave out Kids, News, Reality, Soap and Talk.
 */
const WILDCARD_GENRES: Readonly<Record<DiscoveryMedia, readonly number[]>> = {
  movie: [28, 12, 16, 35, 80, 99, 18, 10751, 14, 36, 27, 10402, 9648, 10749, 878, 53, 10752, 37],
  tv: [10759, 16, 35, 80, 99, 18, 10751, 9648, 10765, 10768, 37],
};
/** Every series genre id, for ruling out the usual and the avoided by series' own ids. */
const ALL_SERIES_GENRE_IDS = [...WILDCARD_GENRES.tv, 10762, 10763, 10764, 10766, 10767];

/** Well rated: TMDB's average and enough votes to trust it. Series draw fewer votes. */
const WELL_RATED: Readonly<Record<DiscoveryMedia, { average: string; votes: string }>> = {
  movie: { average: '7.5', votes: '500' },
  tv: { average: '7.5', votes: '200' },
};

const bestLiked = (profile: TasteProfile) => {
  let best = 0;
  for (const value of profile.genre.values()) best = Math.max(best, value);
  return best;
};

/**
 * The genres outside the usual for one media, least liked first: under
 * `WILDCARD_MAX_SHARE` of the best-liked genre, and not one the profile is
 * turned away from (`avoidedGenres`). A series genre that is two film genres
 * is usual if either half is, and avoided if either half is. None while the
 * profile likes nothing.
 */
export function wildcardGenres(profile: TasteProfile, media: DiscoveryMedia): number[] {
  const best = bestLiked(profile);
  if (best <= 0) return [];
  const avoided = new Set(avoidedGenres(profile));
  return WILDCARD_GENRES[media]
    .map((id) => {
      const films = tasteGenres([id]);
      return { id, films, liked: Math.max(...films.map((film) => profile.genre.get(film) ?? 0)) };
    })
    .filter(({ films, liked }) => liked < WILDCARD_MAX_SHARE * best && !films.some((film) => avoided.has(film)))
    .sort((a, b) => a.liked - b.liked || a.id - b.id)
    .map(({ id }) => id);
}

/**
 * Film genres a wildcard may not carry: the profile's best-liked few that
 * are usual (see `WILDCARD_MAX_SHARE`), and every genre it is turned away
 * from. A wildcard tagged Western and Action is still mostly Action.
 */
export function wildcardExcludedGenres(profile: TasteProfile): Set<number> {
  const best = bestLiked(profile);
  const usual = [...profile.genre]
    .filter(([, value]) => value > 0 && value >= WILDCARD_MAX_SHARE * best)
    .sort(([a, x], [b, y]) => y - x || a - b)
    .slice(0, USUAL_GENRES)
    .map(([id]) => id);
  return new Set([...usual, ...avoidedGenres(profile)]);
}

export interface WildcardQuery {
  /** The genre in the media's own TMDB id. */
  genre: number;
  name: string;
  /** For TMDB's `discover/{media}`. */
  params: Record<string, string>;
}

/**
 * What one page of suggestions asks TMDB for its wildcards: a genre outside
 * the usual, its best-loved titles without the usual genres, most voted
 * first. The genres take turns page by page, starting one further on each
 * week, and each has one turn a visit: its first 20 titles keep a page in
 * wildcards as they are answered, and some genres have no more than that.
 * Null when no genre is outside the usual, or every one has had its turn.
 */
export function wildcardQuery(profile: TasteProfile, media: DiscoveryMedia, page: number, week: number): WildcardQuery | null {
  const genres = wildcardGenres(profile, media);
  if (page >= genres.length) return null;
  const genre = genres[(week + page) % genres.length];
  const excluded = wildcardExcludedGenres(profile);
  const without = media === 'movie'
    ? [...excluded].sort((a, b) => a - b)
    : ALL_SERIES_GENRE_IDS.filter((id) => tasteGenres([id]).some((film) => excluded.has(film))).sort((a, b) => a - b);
  return {
    genre,
    name: GENRE_NAMES[genre] ?? 'Other',
    params: {
      with_genres: String(genre),
      // TMDB leaves out a title with any of these.
      ...(without.length > 0 ? { without_genres: without.join(',') } : {}),
      'vote_average.gte': WELL_RATED[media].average,
      'vote_count.gte': WELL_RATED[media].votes,
      sort_by: 'vote_count.desc',
      include_adult: 'false',
    },
  };
}
