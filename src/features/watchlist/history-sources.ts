import { TOP_CAST_SIZE } from './credits';
import type { DiscoveryItem } from './discovery';

/**
 * Sources for HAVE YOU ALREADY WATCHED? that read the owner's whole history
 * rather than franchises: the directors and leads of the films they have
 * watched most, whose other well-known films they have likely seen too.
 * Rules over rows; nothing here is guessed by a model.
 */

export type PersonRole = 'director' | 'actor';
export interface HistoryPerson { name: string; role: PersonRole; watched: number }

/** A watched film's credits, as stored on `movies`: names only. */
export interface WatchedFilmCredits { directors: string[] | null; top_cast: string[] | null }

/** How many of each role are asked about in a week. */
export const PEOPLE_PER_ROLE = 4;
/** The pool those rotate through, most-watched first. */
const CANDIDATES_PER_ROLE = 12;
/** Fewer watched films than this is not a pattern. */
const MIN_WATCHED: Record<PersonRole, number> = { director: 3, actor: 4 };
/**
 * "Likely seen" means widely seen: a credit with fewer TMDB votes than this
 * is too obscure to ask about.
 */
export const MIN_CREDIT_VOTES = 1000;
/** At most this many titles per person, so one person cannot fill the grid. */
export const TITLES_PER_PERSON = 6;

const clean = (name: string) => name.trim().replace(/\s+/g, ' ');

/**
 * The people asked about this week: the directors and leads of the most
 * watched films, rotating weekly through the top `CANDIDATES_PER_ROLE` of
 * each so a different few lead each week. Ties go by name, so the order is
 * the same on every device.
 */
export function historyPeople(films: readonly WatchedFilmCredits[], week: number): HistoryPerson[] {
  const counts: Record<PersonRole, Map<string, number>> = { director: new Map(), actor: new Map() };
  for (const film of films) {
    for (const [role, names] of [['director', film.directors], ['actor', film.top_cast]] as const) {
      // Once per film, however the names are repeated.
      for (const name of new Set((names ?? []).map(clean).filter(Boolean))) {
        counts[role].set(name, (counts[role].get(name) ?? 0) + 1);
      }
    }
  }
  return (['director', 'actor'] as const).flatMap((role) => {
    const candidates = [...counts[role]]
      .filter(([, watched]) => watched >= MIN_WATCHED[role])
      .sort(([a, x], [b, y]) => y - x || a.localeCompare(b, 'en'))
      .slice(0, CANDIDATES_PER_ROLE);
    if (candidates.length <= PEOPLE_PER_ROLE) return candidates.map(([name, watched]) => ({ name, role, watched }));
    const start = (((week * PEOPLE_PER_ROLE) % candidates.length) + candidates.length) % candidates.length;
    return Array.from({ length: PEOPLE_PER_ROLE }, (_, i) => {
      const [name, watched] = candidates[(start + i) % candidates.length];
      return { name, role, watched };
    });
  });
}

export interface PersonSearchResult { id: number; name: string; known_for_department?: string }

/**
 * The TMDB person a stored name means: an exact name match only, preferring
 * the department the name was stored under, then whoever TMDB ranks first.
 * No exact match is no person, never the nearest name; two people with the
 * same name and department can still be confused.
 */
export function matchPerson(results: readonly PersonSearchResult[], person: HistoryPerson): PersonSearchResult | null {
  const want = clean(person.name).toLowerCase();
  const exact = results.filter((result) => typeof result.id === 'number' && clean(result.name ?? '').toLowerCase() === want);
  const department = person.role === 'director' ? 'Directing' : 'Acting';
  return exact.find((result) => result.known_for_department === department) ?? exact[0] ?? null;
}

/** A `person/{id}/combined_credits` entry, with the fields Discover shows. */
export interface PersonCreditEntry {
  id?: number;
  media_type?: string;
  title?: string;
  release_date?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  overview?: string;
  original_language?: string;
  genre_ids?: number[];
  vote_average?: number;
  vote_count?: number;
  character?: string | null;
  /** Billing position in the cast, 0 first. */
  order?: number;
  job?: string | null;
  adult?: boolean;
}

const playsThemself = (character?: string | null) => /\b(self|himself|herself|themselves)\b/i.test(character ?? '');
/**
 * A lead, as the watched counts are: billed in the top `TOP_CAST_SIZE`, as
 * `top_cast` is stored, and credited.
 */
const isLead = (entry: PersonCreditEntry) =>
  typeof entry.order === 'number' && entry.order < TOP_CAST_SIZE
  && !playsThemself(entry.character) && !/uncredited/i.test(entry.character ?? '');

/**
 * A person's best-known released films, as Likely seen tiles: films they
 * directed, or led (see `isLead`), with at least
 * `MIN_CREDIT_VOTES` votes, most voted first, at most `TITLES_PER_PERSON`.
 * Films only: the counts come from watched films, and an actor's TV credits
 * are mostly guest and talk-show spots.
 */
export function personHistoryItems(
  person: HistoryPerson,
  credits: { cast?: readonly PersonCreditEntry[]; crew?: readonly PersonCreditEntry[] },
  todayIso: string,
): DiscoveryItem[] {
  const entries = person.role === 'director'
    ? (credits.crew ?? []).filter((entry) => entry.job === 'Director')
    : (credits.cast ?? []).filter(isLead);
  const byId = new Map<number, PersonCreditEntry>();
  for (const entry of entries) {
    if (entry.media_type !== 'movie' || entry.adult || typeof entry.id !== 'number' || !Number.isInteger(entry.id) || entry.id <= 0) continue;
    const date = (entry.release_date ?? '').slice(0, 10);
    if (!entry.title || !date || date > todayIso || (entry.vote_count ?? 0) < MIN_CREDIT_VOTES) continue;
    byId.set(entry.id, entry);
  }
  const reason = person.role === 'director'
    ? `Directed by ${person.name}; you have watched ${person.watched} of their films`
    : `With ${person.name}; you have watched ${person.watched} of their films`;
  const shortReason = person.role === 'director' ? `By ${person.name}` : `With ${person.name}`;
  return [...byId.values()]
    .sort((a, b) => (b.vote_count ?? 0) - (a.vote_count ?? 0) || (a.title ?? '').localeCompare(b.title ?? '', 'en'))
    .slice(0, TITLES_PER_PERSON)
    .map((entry): DiscoveryItem => ({
      id: entry.id!,
      title: entry.title,
      release_date: entry.release_date,
      poster_path: entry.poster_path ?? null,
      backdrop_path: entry.backdrop_path ?? null,
      overview: entry.overview ?? '',
      original_language: entry.original_language,
      genre_ids: entry.genre_ids,
      vote_average: entry.vote_average,
      vote_count: entry.vote_count,
      media: 'movie',
      kind: 'recommendation',
      seedKey: `person:${person.role}:${person.name}`,
      reason,
      shortReason,
    }));
}
