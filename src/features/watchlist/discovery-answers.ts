import type { DiscoveryMedia } from './discovery';

/**
 * Why a title was turned down. `not_interested` is the per-title button and
 * hides the title everywhere. `skip` is the bulk button under YOU MIGHT LIKE:
 * it says no to a page of suggestions, not to having seen them, so it hides
 * a title from the suggestion lists for `SKIP_DAYS` and never from HAVE YOU
 * ALREADY WATCHED?.
 */
export type DismissReason = 'not_interested' | 'skip';
/** Where the answer was given; `unknown` for answers older than the column. */
export type DismissSource = 'coming_soon' | 'you_might_like' | 'likely_seen' | 'franchise' | 'unknown';

/**
 * What TMDB says about the title an answer is about, when the answer knew:
 * a tile does, a franchise entry knows only its year. It describes the
 * title, not the answer, so it is kept across later answers.
 */
export interface TitleFacts {
  genreIds: number[] | null;
  language: string | null;
  year: number | null;
}

/** A year from a TMDB date or a stored year, if it is one the table accepts. */
export function yearOf(value: string | number | null | undefined): number | null {
  const year = typeof value === 'number' ? value : typeof value === 'string' && /^\d{4}/.test(value) ? Number(value.slice(0, 4)) : Number.NaN;
  return Number.isInteger(year) && year >= 1870 && year <= 2100 ? year : null;
}

/** A title's facts from a TMDB item or a stored row, or undefined when it says nothing. */
export function titleFacts(item: {
  genre_ids?: readonly number[] | null;
  original_language?: string | null;
  release_date?: string | null;
  first_air_date?: string | null;
  year?: number | null;
}): TitleFacts | undefined {
  const ids = Array.isArray(item.genre_ids) ? item.genre_ids.filter((id) => Number.isInteger(id) && id > 0) : [];
  const genreIds = ids.length > 0 ? ids : null;
  const language = typeof item.original_language === 'string' && /^[a-z]{2,3}$/.test(item.original_language) ? item.original_language : null;
  const year = yearOf(item.year ?? (item.release_date || item.first_air_date));
  return genreIds || language || year ? { genreIds, language, year } : undefined;
}

/** Whether `stored` has every fact `known` has, so sending `known` adds nothing. */
const hasFacts = (stored: TitleFacts | undefined, known: TitleFacts | undefined) => !known || Boolean(
  stored
  && (!known.genreIds || stored.genreIds)
  && (!known.language || stored.language)
  && (known.year == null || stored.year != null),
);

export interface DismissalAnswer {
  reason: DismissReason;
  source: DismissSource;
  /** ISO time the current answer was given; a later answer replaces it. */
  answeredAt: string;
  facts?: TitleFacts;
}

/** Answers by `media:tmdbId` key. */
export type DismissalAnswers = ReadonlyMap<string, DismissalAnswer>;

export interface DismissalRow {
  media: DiscoveryMedia;
  tmdb_id: number;
  reason: DismissReason;
  source: DismissSource;
  answered_at: string;
  genre_ids: number[] | null;
  original_language: string | null;
  release_year: number | null;
}

export const SKIP_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

const REASONS: readonly DismissReason[] = ['not_interested', 'skip'];
const SOURCES: readonly DismissSource[] = ['coming_soon', 'you_might_like', 'likely_seen', 'franchise', 'unknown'];

export const isDismissReason = (value: unknown): value is DismissReason => REASONS.includes(value as DismissReason);
export const isDismissSource = (value: unknown): value is DismissSource => SOURCES.includes(value as DismissSource);

const timeOf = (answer: DismissalAnswer) => {
  const at = Date.parse(answer.answeredAt);
  return Number.isNaN(at) ? 0 : at;
};
const RANK: Record<DismissReason, number> = { skip: 1, not_interested: 2 };

/**
 * Whether `next` replaces `current` for the same title: Not interested
 * outranks a skip whenever either was given, and otherwise the later answer
 * wins. A skip never undoes Not interested; only a reset does. The table's
 * trigger applies the same rule, so no device can weaken an answer.
 */
export function outranks(next: DismissalAnswer, current: DismissalAnswer): boolean {
  const byReason = RANK[next.reason] - RANK[current.reason];
  return byReason !== 0 ? byReason > 0 : timeOf(next) > timeOf(current);
}

const mergeFacts = (first: TitleFacts | undefined, second: TitleFacts | undefined): TitleFacts | undefined => {
  if (!first || hasFacts(first, second)) return first ?? second;
  return { genreIds: first.genreIds ?? second!.genreIds, language: first.language ?? second!.language, year: first.year ?? second!.year };
};

/**
 * Per key, the answer that outranks the other (see `outranks`); on a tie,
 * `a`'s. Each of the title's facts comes from whichever copy has it, the
 * winner's first, as the table's trigger keeps them.
 */
export function mergeAnswers(a: DismissalAnswers, b: DismissalAnswers): Map<string, DismissalAnswer> {
  const merged = new Map(a);
  for (const [key, answer] of b) {
    const current = merged.get(key);
    if (!current) { merged.set(key, answer); continue; }
    const [winner, other] = outranks(answer, current) ? [answer, current] : [current, answer];
    const facts = mergeFacts(winner.facts, other.facts);
    merged.set(key, facts === winner.facts ? winner : { ...winner, facts });
  }
  return merged;
}

/** Titles marked Not interested: hidden everywhere, dimmed on Franchises. */
export function notInterestedKeys(answers: DismissalAnswers): Set<string> {
  const keys = new Set<string>();
  for (const [key, answer] of answers) if (answer.reason === 'not_interested') keys.add(key);
  return keys;
}

/**
 * Titles kept out of the suggestion lists (Coming soon, YOU MIGHT LIKE): Not
 * interested, and skips younger than `SKIP_DAYS`.
 */
export function hiddenFromSuggestionKeys(answers: DismissalAnswers, now: number): Set<string> {
  const keys = new Set<string>();
  for (const [key, answer] of answers) {
    if (answer.reason === 'not_interested' || now - timeOf(answer) < SKIP_DAYS * DAY_MS) keys.add(key);
  }
  return keys;
}

/** The title a key names, only if the key is exactly as `discoveryKey` writes it. */
export function parseKey(key: string): { media: DiscoveryMedia; tmdbId: number } | null {
  const [media, id] = key.split(':');
  const tmdbId = Number(id);
  if ((media !== 'movie' && media !== 'tv') || !Number.isInteger(tmdbId) || tmdbId <= 0) return null;
  // 'movie:1.0' or 'movie:1:x' would write the same row as 'movie:1', and two
  // keys for one row fail the whole upsert.
  if (`${media}:${tmdbId}` !== key) return null;
  return { media, tmdbId };
}

/**
 * What to do with this browser's answers once the owner's table is reachable.
 * An answer leaves the browser copy only when a read of the table has it, or
 * one that outranks it (`confirmed`), never on a successful write alone: a read already
 * in flight when the write lands finishes after it without the new row, and
 * an answer released on the write would then vanish from both copies and the
 * title would come back. Keys already being written are not sent twice; keys
 * that could never be written (malformed) are released.
 */
export function answersHandover(
  local: DismissalAnswers,
  confirmed: DismissalAnswers | undefined,
  sending: ReadonlySet<string>,
): { release: Set<string>; send: DismissalRow[] } {
  const release = new Set<string>();
  const send: DismissalRow[] = [];
  for (const [key, answer] of local) {
    const inTable = confirmed?.get(key);
    // Released once the table has this answer or a stronger one, and every
    // fact about the title this copy knows.
    if (inTable && !outranks(answer, inTable) && hasFacts(inTable.facts, answer.facts)) { release.add(key); continue; }
    const parsed = parseKey(key);
    if (!parsed) { release.add(key); continue; }
    if (!sending.has(key)) {
      send.push({
        media: parsed.media,
        tmdb_id: parsed.tmdbId,
        reason: answer.reason,
        source: answer.source,
        answered_at: answer.answeredAt,
        // Null leaves what the table has: the trigger keeps stored facts.
        genre_ids: answer.facts?.genreIds ?? null,
        original_language: answer.facts?.language ?? null,
        release_year: answer.facts?.year ?? null,
      });
    }
  }
  return { release, send };
}

/**
 * This browser's saved answers. Reads the current list of `[key, answer]`
 * pairs, and the older list of bare keys, which were all Not interested.
 */
export function parseStoredAnswers(current: unknown, legacy: unknown, now: string): Map<string, DismissalAnswer> {
  const answers = new Map<string, DismissalAnswer>();
  if (Array.isArray(legacy)) {
    for (const key of legacy) {
      if (typeof key === 'string') answers.set(key, { reason: 'not_interested', source: 'unknown', answeredAt: now });
    }
  }
  if (Array.isArray(current)) {
    for (const entry of current) {
      if (!Array.isArray(entry) || typeof entry[0] !== 'string') continue;
      const answer = entry[1] as Partial<DismissalAnswer> | null;
      if (!answer || !isDismissReason(answer.reason) || typeof answer.answeredAt !== 'string' || Number.isNaN(Date.parse(answer.answeredAt))) continue;
      const facts = answer.facts && typeof answer.facts === 'object'
        ? titleFacts({ genre_ids: answer.facts.genreIds, original_language: answer.facts.language, year: answer.facts.year })
        : undefined;
      answers.set(entry[0], {
        reason: answer.reason,
        source: isDismissSource(answer.source) ? answer.source : 'unknown',
        answeredAt: answer.answeredAt,
        ...(facts ? { facts } : {}),
      });
    }
  }
  return answers;
}

/**
 * `answersHandover` for a table that holds bare keys (Not seen): nothing to
 * rank, so a key leaves the browser copy once a read of the table has it.
 */
export function keySetHandover(
  local: ReadonlySet<string>,
  confirmed: ReadonlySet<string> | undefined,
  sending: ReadonlySet<string>,
): { release: Set<string>; send: { media: DiscoveryMedia; tmdb_id: number }[] } {
  const release = new Set<string>();
  const send: { media: DiscoveryMedia; tmdb_id: number }[] = [];
  for (const key of local) {
    if (confirmed?.has(key)) { release.add(key); continue; }
    const parsed = parseKey(key);
    if (!parsed) { release.add(key); continue; }
    if (!sending.has(key)) send.push({ media: parsed.media, tmdb_id: parsed.tmdbId });
  }
  return { release, send };
}
