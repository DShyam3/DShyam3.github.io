import { supabase } from '@/integrations/supabase/client';
import { selectAllPages } from '@/integrations/supabase/select-all-pages';
import type { TMDBCollection } from './tmdb-types';

/**
 * Discover's collection walk reads film collections from
 * `watchlist_collection_parts`, which watchlist-cron-sync refills every night,
 * instead of one tmdb-proxy call per collection. The rows are TMDB's own
 * response for `collection/{id}`, trimmed to what the walk reads (see
 * supabase/functions/_shared/collection-parts.ts), so a collection answered
 * here makes the same group it would from TMDB. One exception, never seen in
 * TMDB's data: two parts with the same release date and the same title keep
 * id order here, TMDB's order there.
 *
 * A collection the table lacks (added since the last sync, gone from TMDB, a
 * hidden or stopped film's, which is never stored) or holds only from longer
 * ago than this is asked of TMDB as before. Every collection is rewritten
 * nightly, so this allows one missed night and no more.
 */
export const COLLECTION_PARTS_MAX_AGE_MS = 48 * 60 * 60 * 1000;

export interface CollectionPartRow {
  collection_id: number;
  tmdb_id: number;
  title: string;
  release_date: string | null;
  poster_path: string | null;
  synced_at: string;
}

const COLLECTION_PARTS_SELECT = 'collection_id, tmdb_id, title, release_date, poster_path, synced_at';

/**
 * Rows as collections, keyed by collection id. Only each collection's newest
 * sync counts: a part TMDB dropped can outlive its sync by a failed delete,
 * and is older than its siblings. A collection whose newest sync is older
 * than `maxAgeMs`, or unreadable, is left out.
 */
export function collectionsFromPartRows(
  rows: readonly CollectionPartRow[],
  now: number,
  maxAgeMs: number = COLLECTION_PARTS_MAX_AGE_MS,
): Map<number, TMDBCollection> {
  const newest = new Map<number, number>();
  for (const row of rows) {
    const at = Date.parse(row.synced_at);
    if (Number.isNaN(at)) continue;
    newest.set(row.collection_id, Math.max(newest.get(row.collection_id) ?? at, at));
  }
  const collections = new Map<number, TMDBCollection>();
  for (const row of rows) {
    const latest = newest.get(row.collection_id);
    if (latest === undefined || now - latest > maxAgeMs) continue;
    if (Date.parse(row.synced_at) !== latest) continue;
    const collection = collections.get(row.collection_id) ?? { id: row.collection_id, parts: [] };
    collection.parts!.push({
      id: row.tmdb_id,
      title: row.title,
      release_date: row.release_date,
      poster_path: row.poster_path,
    });
    collections.set(row.collection_id, collection);
  }
  return collections;
}

/**
 * Every cached collection the walk may use now. Thrown on failure; the walk
 * then asks TMDB for each collection, as it did before the cache.
 */
export async function fetchCachedCollections(): Promise<Map<number, TMDBCollection>> {
  const { data, error } = await selectAllPages<CollectionPartRow>(
    (from, to) =>
      supabase
        .from('watchlist_collection_parts')
        .select(COLLECTION_PARTS_SELECT, { count: 'exact' })
        .order('collection_id')
        .order('tmdb_id')
        .range(from, to),
    (row) => `${row.collection_id}:${row.tmdb_id}`,
  );
  if (error) throw new Error(error.message);
  return collectionsFromPartRows(data, Date.now());
}
