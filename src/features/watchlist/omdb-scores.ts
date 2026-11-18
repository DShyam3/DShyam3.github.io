// Mirror in supabase/functions/watchlist-cron-sync/index.ts. Deno cannot import
// from src/, so that file holds a hand-maintained copy -- change both together.
//
// OMDb (https://www.omdbapi.com/?i=<imdb_id>) returns IMDb, Rotten Tomatoes
// and Metacritic scores for a title. Every value is a string that may be
// "N/A", so each one is parsed strictly and anything unusable becomes null.

export interface OmdbScores {
  imdb_rating: number | null;
  imdb_votes: number | null;
  rt_score: number | null;
  metascore: number | null;
}

export type OmdbOutcome =
  | { kind: 'scores'; scores: OmdbScores }
  | { kind: 'not-found' }
  | { kind: 'limit' }
  | { kind: 'error'; message: string };

const IMDB_ID = /^tt\d{7,10}$/;
const DECIMAL = /^\d+(\.\d+)?$/;
const INTEGER = /^\d+$/;

export function isImdbId(value: unknown): value is string {
  return typeof value === 'string' && IMDB_ID.test(value);
}

function asText(value: unknown): string | null {
  return typeof value === 'string' ? value.trim() : null;
}

function parseDecimal(text: string | null): number | null {
  if (text === null || !DECIMAL.test(text)) return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

/** A whole number 0-100, or null. */
function parsePercent(text: string | null): number | null {
  const n = parseDecimal(text);
  if (n === null || n > 100) return null;
  return Math.round(n);
}

function ratingValue(ratings: unknown, source: string): string | null {
  if (!Array.isArray(ratings)) return null;
  for (const entry of ratings) {
    if (entry && typeof entry === 'object' && (entry as { Source?: unknown }).Source === source) {
      return asText((entry as { Value?: unknown }).Value);
    }
  }
  return null;
}

function parseImdbRating(text: string | null): number | null {
  const n = parseDecimal(text);
  if (n === null) return null;
  return Math.round(Math.min(10, Math.max(0, n)) * 10) / 10;
}

function parseVotes(text: string | null): number | null {
  if (text === null) return null;
  const digits = text.replace(/,/g, '');
  if (!INTEGER.test(digits)) return null;
  const n = Number(digits);
  return Number.isSafeInteger(n) ? n : null;
}

export function parseOmdbResponse(json: unknown): OmdbOutcome {
  if (!json || typeof json !== 'object') return { kind: 'error', message: 'OMDb returned no JSON object' };
  const data = json as Record<string, unknown>;

  if (data.Response === 'False') {
    const message = asText(data.Error) || 'OMDb returned an error';
    const lower = message.toLowerCase();
    if (lower.includes('limit')) return { kind: 'limit' };
    if (lower.includes('not found') || lower.includes('incorrect imdb id')) return { kind: 'not-found' };
    return { kind: 'error', message };
  }
  if (data.Response !== 'True') return { kind: 'error', message: 'OMDb response had no Response flag' };

  const imdbText = asText(data.imdbRating);
  const imdbFromRatings = ratingValue(data.Ratings, 'Internet Movie Database')?.split('/')[0] ?? null;
  const metacriticFromRatings = ratingValue(data.Ratings, 'Metacritic')?.split('/')[0] ?? null;
  const rtText = ratingValue(data.Ratings, 'Rotten Tomatoes');

  const imdb_rating = parseImdbRating(imdbText) ?? parseImdbRating(imdbFromRatings);
  const metascore = parsePercent(asText(data.Metascore)) ?? parsePercent(metacriticFromRatings);
  const rt_score = rtText?.endsWith('%') ? parsePercent(rtText.slice(0, -1)) : null;

  return {
    kind: 'scores',
    scores: { imdb_rating, imdb_votes: parseVotes(asText(data.imdbVotes)), rt_score, metascore },
  };
}
