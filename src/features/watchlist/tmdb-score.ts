/**
 * Collection pick and score formatting.
 *
 * `pickCollection` mirrors the hand-maintained copy in
 * supabase/functions/watchlist-cron-sync, since Deno cannot import from src/.
 * The two change together.
 */

/** Absent key returns undefined (write nothing); an explicit null clears the collection. */
export function pickCollection(data: {
  belongs_to_collection?: { id?: number; name?: string } | null;
}): { collection_id: number | null; collection_name: string | null } | undefined {
  if (!('belongs_to_collection' in data)) return undefined;
  const c = data.belongs_to_collection;
  if (!c || typeof c.id !== 'number' || c.id <= 0) return { collection_id: null, collection_name: null };
  return { collection_id: c.id, collection_name: c.name?.trim() || null };
}

/** 0..999 as-is; "1.2k" below 10k, "12k" from 10k, "1.3M" for millions. Truncates, never "1.0k". */
export function formatVoteCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10_000) return `${Math.floor(n / 100) / 10}k`;
  if (n < 1_000_000) return `${Math.floor(n / 1000)}k`;
  return `${Math.floor(n / 100_000) / 10}M`;
}

/** One decimal, with a trailing ".0" dropped. */
export function formatScore(value: number): string {
  return value.toFixed(1).replace(/\.0$/, '');
}
