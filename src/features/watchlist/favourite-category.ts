/**
 * Which bucket a favourite belongs in, derived from TMDB facts.
 *
 * TMDB has no "K-Drama", "Bollywood" or "Anime" genre -- those buckets are
 * this project's editorial choice, so the derivation is ours, built from
 * `original_language`, `origin_country` and `genre_ids` rather than a
 * per-title hardcoded list.
 *
 * Animation is checked first, because it cuts across every other bucket:
 * Japanese animation is Anime, and any other animation is Cartoon -- so a
 * Pixar film is a Cartoon rather than Hollywood, and Korean animation is a
 * Cartoon rather than K-Drama. Anime goes before Cartoon so a Japanese
 * co-production resolves to Anime.
 *
 * Bollywood means Hindi-language, not Indian-origin: India produces films in
 * many languages, and only the Hindi-language industry is Bollywood. K-Drama
 * is Korean-language on the same footing, so a Korean film lands there too --
 * the bucket is about where something comes from, not its runtime.
 */

/**
 * The buckets, in the order the favourites grid renders them. `Others` is
 * last because it is the catch-all, not because it is least important.
 *
 * This list is the single source for both the type and the grid's section
 * order -- a bucket added here appears in the UI without a second edit.
 */
export const FAVOURITE_CATEGORIES = [
  'Bollywood',
  'Hollywood',
  'Anime',
  'Cartoon',
  'K-Drama',
  'Others',
] as const;

export type FavouriteCategory = (typeof FAVOURITE_CATEGORIES)[number];

/**
 * Whether a stored legacy `category` string is still one of the buckets.
 * Guards the fallback path: the column is plain text, so a value written by
 * an older build can be anything.
 */
export function isFavouriteCategory(
  value: string | null | undefined,
): value is FavouriteCategory {
  return (
    value != null &&
    (FAVOURITE_CATEGORIES as readonly string[]).includes(value)
  );
}

/** The TMDB facts stored on a favourite row. All optional -- a row added
 *  before the facts columns existed has none of them. */
export interface TmdbFacts {
  original_language?: string | null;
  origin_country?: string[] | null;
  genre_ids?: number[] | null;
}

const ANIMATION_GENRE_ID = 16;

/**
 * Returns null when the facts are too thin to decide, which is what lets
 * `resolveFavouriteCategory` fall back to a row's stored string.
 *
 * `original_language` is the only fact that can produce Hollywood or
 * Bollywood, so "thin" means *no language*, regardless of how much country
 * and genre data came with it. A row carrying `{origin_country: ['US'],
 * genre_ids: [28]}` and nothing else must not derive a confident 'Others'
 * and overrule a stored 'Hollywood' that was right -- so 'Others' means "a
 * known language that matches no bucket", never "some facts, no match".
 */
export function deriveFavouriteCategory(
  facts: TmdbFacts,
): FavouriteCategory | null {
  const lang = facts.original_language?.trim().toLowerCase() ?? '';
  const countries = (facts.origin_country ?? []).map((c) => c.toUpperCase());
  const genres = facts.genre_ids ?? [];

  const isJapanese = countries.includes('JP') || lang === 'ja';
  const isAnimated = genres.includes(ANIMATION_GENRE_ID);
  if (isAnimated && isJapanese) {
    return 'Anime';
  }

  // Needs *some* origin to rule out Japan. Animation with no language or
  // country could be either bucket, so it stays undecided like any other
  // thin row.
  if (isAnimated && (lang !== '' || countries.length > 0)) {
    return 'Cartoon';
  }

  if (countries.includes('KR') || lang === 'ko') {
    return 'K-Drama';
  }

  if (lang === 'hi') {
    return 'Bollywood';
  }

  if (lang === 'en') {
    return 'Hollywood';
  }

  // A known language that matches no bucket. Country or genre without a
  // language is not enough to decide -- see the doc comment above.
  if (lang !== '') {
    return 'Others';
  }

  return null;
}

/**
 * The bucket the grid actually shows: derived from TMDB's facts, falling back
 * to the string an older add-flow froze into the row's `category` column, and
 * finally to `'Others'`.
 *
 * This lives here rather than at the call sites because there were two of
 * them -- the grid and the add dialog's "Auto:" chip -- and they disagreed on
 * the last resort, so the chip could advertise a bucket the grid then
 * contradicted.
 */
export function resolveFavouriteCategory(
  facts: TmdbFacts,
  stored?: string | null,
): FavouriteCategory {
  return (
    deriveFavouriteCategory(facts) ??
    (isFavouriteCategory(stored) ? stored : 'Others')
  );
}
