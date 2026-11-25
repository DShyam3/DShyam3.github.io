/**
 * Collection pick, episode score extraction, and score formatting.
 *
 * `pickCollection` and `pickTmdbEpisodeScores` mirror the hand-maintained
 * copies in supabase/functions/watchlist-cron-sync, since Deno cannot import
 * from src/. The two change together.
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

/** Normalises one TMDB episode's rating (1..10, 1dp, or null when unrated) and vote count (>= 0). */
export function pickTmdbEpisodeScores(episode: {
  vote_average?: number;
  vote_count?: number;
}): { tmdb_rating: number | null; tmdb_votes: number } {
  const tmdb_rating =
    typeof episode.vote_average === 'number' && Number.isFinite(episode.vote_average) && episode.vote_average > 0
      ? Math.round(Math.min(10, episode.vote_average) * 10) / 10
      : null;
  const tmdb_votes =
    typeof episode.vote_count === 'number' && Number.isFinite(episode.vote_count) && episode.vote_count >= 0
      ? Math.round(episode.vote_count)
      : 0;
  return { tmdb_rating, tmdb_votes };
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
