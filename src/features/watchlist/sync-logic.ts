import type { WatchlistItem } from './WatchlistContext';

/**
 * The decisions the watchlist sync makes, with no Supabase client, no React
 * and no network in sight: given an item and the TMDB payload for it, what
 * should be written back?
 *
 * This exists because the same decisions are made twice -- once in the browser
 * (WatchlistContext.syncWatchlist, which runs while an admin has the page
 * open) and once server-side (supabase/functions/watchlist-cron-sync, which
 * runs nightly whether or not anyone is looking). The Deno function cannot
 * import from src/, so it stays a hand-maintained copy; keeping the rules here
 * as plain functions at least means there is one authoritative version to copy
 * from, and it can be read without wading through 450 lines of sync loop.
 *
 * ANY CHANGE HERE MUST BE MIRRORED IN
 * supabase/functions/watchlist-cron-sync/index.ts.
 */

/**
 * Streaming services worth surfacing, and the various names TMDB uses for
 * each. Anything not on this list falls back to 'Online'.
 */
export const PLATFORM_ALLOWLIST: { tmdbNames: string[]; displayName: string }[] = [
  { tmdbNames: ['Netflix'], displayName: 'Netflix' },
  { tmdbNames: ['Disney Plus', 'Disney+'], displayName: 'Disney+' },
  { tmdbNames: ['Amazon Prime Video'], displayName: 'Prime Video' },
  { tmdbNames: ['Apple TV Plus', 'Apple TV+', 'Apple TV'], displayName: 'Apple TV+' },
  { tmdbNames: ['BBC iPlayer'], displayName: 'BBC iPlayer' },
];

/** Pick a display platform from a TMDB `watch/providers` region block. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- raw TMDB payload
export function getPlatform(providers: any): string {
  if (!providers) return 'Online';

  const available = [
    ...(providers.flatrate || []),
    ...(providers.free || []),
    ...(providers.ads || []),
  ];

  for (const entry of PLATFORM_ALLOWLIST) {
    const match = available.some((provider: { provider_name?: string }) =>
      entry.tmdbNames.some(
        (name) => provider.provider_name?.toLowerCase() === name.toLowerCase(),
      ),
    );
    if (match) return entry.displayName;
  }

  return 'Online';
}

/**
 * Columns shared by the `movies` and `tv_shows` tables.
 *
 * Note the asymmetry, which is deliberate and predates this extraction:
 * poster, overview and genre are only filled in when the stored row is
 * *missing* them, so a hand-edited value is never overwritten by TMDB, while
 * release_date and platform are always refreshed because those legitimately
 * change.
 */
export function buildCommonUpdates(
  item: Pick<WatchlistItem, 'image_url' | 'description' | 'genres'>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- raw TMDB payload
  data: any,
  imageBaseUrl: string,
): Record<string, unknown> {
  const updates: Record<string, unknown> = {};

  if (!item.image_url && data.poster_path) {
    updates.poster = `${imageBaseUrl}${data.poster_path}`;
  }
  if (!item.description && data.overview) {
    updates.overview = data.overview;
  }
  if (data.release_date || data.first_air_date) {
    updates.release_date = data.release_date || data.first_air_date;
  }
  if (!item.genres?.length && data.genres) {
    updates.genre = data.genres.map((g: { name: string }) => g.name).join(', ');
  }
  updates.platform = getPlatform(data['watch/providers']?.results?.GB);

  return updates;
}

/** Movie-only columns layered on top of the common ones. */
export function buildMovieUpdates(
  item: Pick<WatchlistItem, 'image_url' | 'description' | 'genres' | 'year'>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- raw TMDB payload
  data: any,
  imageBaseUrl: string,
): Record<string, unknown> {
  const updates = buildCommonUpdates(item, data, imageBaseUrl);

  if (!item.year && (data.release_date || data.first_air_date)) {
    updates.release_year = new Date(
      data.release_date || data.first_air_date,
    ).getFullYear();
  }
  if (data.runtime) updates.runtime = data.runtime;

  return updates;
}

/** TV-only columns. `status` here is the series status, not a watch status. */
export function buildShowUpdates(
  item: Pick<WatchlistItem, 'image_url' | 'description' | 'genres'>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- raw TMDB payload
  data: any,
  imageBaseUrl: string,
): Record<string, unknown> {
  return { ...buildCommonUpdates(item, data, imageBaseUrl), status: data.status };
}
