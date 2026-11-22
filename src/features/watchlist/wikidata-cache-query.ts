import { supabase } from '@/integrations/supabase/client';
import type { FilmUniverseMember, WikidataTvSpinoffLink } from './tmdb-types';
import type { WatchlistItem } from './WatchlistContext';

/**
 * Discover and Franchises read tmdb-proxy's two Wikidata lookups from
 * `watchlist_wikidata_cache`, which watchlist-cron-sync refills every night
 * with the proxy's own code (supabase/functions/_shared/wikidata-lookups.ts),
 * before asking the proxy. A row holds the proxy's `results` array as it
 * built it, so an answer read here makes the same groups the proxy's would.
 *
 * The spin-off row answers one seed list: a signed-out visitor's (every TV
 * show not hidden or stopped). A browser sending any other list -- the
 * owner's, which holds hidden shows, or anyone's after the library changed
 * since the last sync -- asks the proxy, as does any browser when the row is
 * older than this, missing, unreadable or the read fails. Every row is
 * rewritten nightly, so this allows one missed night and no more.
 */
export const WIKIDATA_CACHE_MAX_AGE_MS = 48 * 60 * 60 * 1000;

export type WikidataCacheLookup = 'tv-spinoffs' | 'film-universes';

export interface WikidataCacheRow {
  lookup: string;
  seed_ids: number[];
  results: unknown;
  synced_at: string;
}

/** The TV seeds a library sends for spin-offs: every TV show's TMDB id, smallest first. */
export function tvSeedIdsOf(library: readonly Pick<WatchlistItem, 'category' | 'tmdb_id'>[]): number[] {
  return library
    .filter((item) => item.category === 'TV Shows' && item.tmdb_id)
    .map((item) => item.tmdb_id!)
    .sort((a, b) => a - b);
}

/**
 * The seed list a spin-off lookup is asked for: positive integer ids, each
 * once, smallest first. The cron builds a visitor's list the same way
 * (`visitorTvSeedIds`).
 */
export function spinoffSeedList(tmdbIds: readonly number[]): number[] {
  return [...new Set(tmdbIds.filter((id) => Number.isInteger(id) && id > 0))].sort((a, b) => a - b);
}

const isFresh = (row: WikidataCacheRow, now: number, maxAgeMs: number): boolean => {
  const at = Date.parse(row.synced_at);
  return !Number.isNaN(at) && now - at <= maxAgeMs;
};

const isPositiveInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value > 0;
const isText = (value: unknown): value is string => typeof value === 'string';
const isTextOrNull = (value: unknown): value is string | null => value === null || typeof value === 'string';

const isSpinoffLink = (value: unknown): value is WikidataTvSpinoffLink => {
  if (value === null || typeof value !== 'object') return false;
  const link = value as Record<string, unknown>;
  return (
    isPositiveInteger(link.seedTmdbId) &&
    isText(link.seedTitle) &&
    isTextOrNull(link.franchiseId) &&
    isTextOrNull(link.franchiseName) &&
    (link.relatedMediaType === 'tv' || link.relatedMediaType === 'movie') &&
    isPositiveInteger(link.relatedTmdbId) &&
    isText(link.relatedTitle) &&
    isTextOrNull(link.releaseDate) &&
    (link.posterPath === undefined || isTextOrNull(link.posterPath))
  );
};

const isUniverseMember = (value: unknown): value is FilmUniverseMember => {
  if (value === null || typeof value !== 'object') return false;
  const member = value as Record<string, unknown>;
  return (
    isText(member.universeId) &&
    isText(member.universeName) &&
    isPositiveInteger(member.tmdbId) &&
    isTextOrNull(member.title) &&
    isTextOrNull(member.releaseDate) &&
    isTextOrNull(member.posterPath)
  );
};

const sameIds = (a: readonly number[], b: readonly number[]): boolean =>
  a.length === b.length && a.every((id, index) => id === b[index]);

/**
 * The cached spin-off links for exactly `seedIds` (as `spinoffSeedList`
 * builds it), or null when the row is for another list, stale, or not the
 * shape the proxy sends. An empty array is an answer: no spin-offs.
 */
export function spinoffLinksFromCacheRow(
  row: WikidataCacheRow | null,
  seedIds: readonly number[],
  now: number,
  maxAgeMs: number = WIKIDATA_CACHE_MAX_AGE_MS,
): WikidataTvSpinoffLink[] | null {
  if (!row || row.lookup !== 'tv-spinoffs' || !isFresh(row, now, maxAgeMs)) return null;
  if (!Array.isArray(row.seed_ids) || !sameIds(row.seed_ids, seedIds)) return null;
  if (!Array.isArray(row.results) || !row.results.every(isSpinoffLink)) return null;
  return row.results;
}

/**
 * The cached universe films, or null when the row is stale, empty (the
 * proxy never answers with no films) or not the shape the proxy sends.
 */
export function filmUniverseMembersFromCacheRow(
  row: WikidataCacheRow | null,
  now: number,
  maxAgeMs: number = WIKIDATA_CACHE_MAX_AGE_MS,
): FilmUniverseMember[] | null {
  if (!row || row.lookup !== 'film-universes' || !isFresh(row, now, maxAgeMs)) return null;
  if (!Array.isArray(row.results) || row.results.length === 0 || !row.results.every(isUniverseMember)) return null;
  return row.results;
}

/** One lookup's row, or null when there is none. Thrown on failure. */
export async function fetchWikidataCacheRow(lookup: WikidataCacheLookup): Promise<WikidataCacheRow | null> {
  const { data, error } = await supabase
    .from('watchlist_wikidata_cache')
    .select('lookup, seed_ids, results, synced_at')
    .eq('lookup', lookup)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

/**
 * The cached spin-off links for `seedIds`, or null on a miss or a failed
 * read: either way the caller asks the proxy.
 */
export async function cachedSpinoffLinks(seedIds: readonly number[]): Promise<WikidataTvSpinoffLink[] | null> {
  try {
    return spinoffLinksFromCacheRow(await fetchWikidataCacheRow('tv-spinoffs'), seedIds, Date.now());
  } catch (error) {
    console.warn('Wikidata cache read failed, asking tmdb-proxy:', error);
    return null;
  }
}

/** The cached universe films, or null on a miss or a failed read. */
export async function cachedFilmUniverseMembers(): Promise<FilmUniverseMember[] | null> {
  try {
    return filmUniverseMembersFromCacheRow(await fetchWikidataCacheRow('film-universes'), Date.now());
  } catch (error) {
    console.warn('Wikidata cache read failed, asking tmdb-proxy:', error);
    return null;
  }
}
