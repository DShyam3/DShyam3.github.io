import { buildMemberships, countMembers } from '@/features/travel/memberships';

/**
 * The arithmetic behind the About page's fact cards, kept out of the component
 * so every number a card shows is covered by a test.
 */

/** The `site_content` keys that hold the owner's chosen favourites. */
export const FAVOURITE_PICK_KEYS = {
  movie: 'favourite_film',
  tv: 'favourite_series',
} as const;

export interface FavouriteTitle {
  id: number;
  title: string;
  poster: string | null;
  media_type: string;
  tmdb_id: number | null;
}

export interface FeaturedFavourite {
  item: FavouriteTitle;
  /** True when the owner chose it; false when it is the day's pick from the list. */
  chosen: boolean;
}

/** Days since the Unix epoch in UTC, so the day's pick turns over at the same moment everywhere. */
export function dayNumber(date: Date): number {
  return Math.floor(date.getTime() / 86_400_000);
}

/**
 * The favourite a card shows: the one the owner chose, if it is still in the
 * list; otherwise one picked by the day, so the card changes daily but every
 * visitor sees the same title on the same day.
 */
export function featuredFavourite(
  items: FavouriteTitle[],
  chosenTmdbId: string | undefined,
  day: number,
): FeaturedFavourite | null {
  if (items.length === 0) return null;
  const wanted = chosenTmdbId?.trim();
  const chosen = wanted ? items.find((item) => item.tmdb_id !== null && String(item.tmdb_id) === wanted) : undefined;
  if (chosen) return { item: chosen, chosen: true };
  // By id, not title: a renamed row must not reshuffle every later day.
  const ordered = [...items].sort((a, b) => a.id - b.id);
  const index = ((day % ordered.length) + ordered.length) % ordered.length;
  return { item: ordered[index], chosen: false };
}

export interface TravelFacts {
  /** UN member and observer states visited -- the same count as the Travel page's UN row. */
  countries: number;
  /** The UN denominator: 193 members plus the Holy See and Palestine. */
  total: number;
  /** Visited places that are not UN states, such as Gibraltar. */
  territories: number;
  /** Continents with a visited UN state in them, as the Travel page's continent sections count. */
  continents: number;
}

/**
 * Counts against the UN list the Travel page's membership breakdown uses, so
 * the card and the page never disagree. Null until the country dataset is in:
 * without it every visit would read as a territory.
 */
export function travelFacts(
  visitedCodes: string[],
  sovereignCodes: Set<string>,
  continentByCode: Record<string, string>,
): TravelFacts | null {
  if (sovereignCodes.size === 0) return null;
  const un = buildMemberships(sovereignCodes).find((body) => body.key === 'un');
  if (!un) return null;
  const unique = [...new Set(visitedCodes)];
  const countries = countMembers(un, unique);
  const continents = new Set(unique.filter((code) => un.members.has(code)).map((code) => continentByCode[code]).filter(Boolean)).size;
  return { countries, total: un.total, territories: unique.length - countries, continents };
}

export interface RoleLike {
  title: string;
  company: string;
  start_date: string;
  end_date: string;
  order: number;
}

/**
 * The role held now: the first, by the order the timeline is sorted in, whose
 * end date says "Present". Null when none does -- a blank end date is as likely
 * a missing one as an ongoing role, and the card must not claim a job is current.
 */
export function currentRole<T extends RoleLike>(roles: T[]): T | null {
  return [...roles]
    .sort((a, b) => a.order - b.order)
    .find((role) => /^\s*(present|current|now)\s*$/i.test(role.end_date ?? '')) ?? null;
}
