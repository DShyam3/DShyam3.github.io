/**
 * TMDB's community score, and how it is shown beside the owner's own.
 *
 * `pickTitleVotes`, `pickSeasonVote` and `pickCollection` are mirrors of the
 * hand-maintained copies in supabase/functions/watchlist-cron-sync, since Deno
 * cannot import from src/. The two change together.
 */

function roundVote(value: number): number {
  return Math.round(Math.min(10, Math.max(0, value)) * 10) / 10;
}

/** A missing vote_count returns undefined so the caller writes nothing. A zero average or count stores no average. */
export function pickTitleVotes(data: {
  vote_average?: number | null;
  vote_count?: number | null;
}): { tmdb_vote_average: number | null; tmdb_vote_count: number } | undefined {
  if (typeof data.vote_count !== 'number' || !Number.isFinite(data.vote_count)) return undefined;
  const count = Math.max(0, Math.round(data.vote_count));
  const average =
    typeof data.vote_average === 'number' && Number.isFinite(data.vote_average) ? data.vote_average : 0;
  return { tmdb_vote_average: count > 0 && average > 0 ? roundVote(average) : null, tmdb_vote_count: count };
}

export function pickSeasonVote(value: number | null | undefined): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || !Number.isFinite(value) || value <= 0) return null;
  return roundVote(value);
}

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

export interface ScoreLine {
  mine: number | null;
  tmdb: number | null;
  votes: number | null;
  fewVotes: boolean;
  difference: number | null;
}

const FEW_VOTES = 50;

export function scoreLine(
  mine: number | null | undefined,
  tmdbAverage: number | null | undefined,
  tmdbVotes: number | null | undefined,
): ScoreLine {
  const m = mine ?? null;
  const tmdb = tmdbAverage ? tmdbAverage : null;
  const votes = tmdbVotes ?? null;
  return {
    mine: m,
    tmdb,
    votes,
    fewVotes: votes != null && votes < FEW_VOTES,
    difference: m != null && tmdb != null ? Math.round((m - tmdb) * 10) / 10 : null,
  };
}
