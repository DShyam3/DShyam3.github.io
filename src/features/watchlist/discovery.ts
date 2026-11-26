import type { FavouriteItem, WatchlistItem } from './WatchlistContext';
import { libraryShelf, libraryStatus, nextAirDate, type LibraryType } from './library-state';
import type { TMDBSearchItem } from './tmdb-types';
import { languageDisplayName } from './language-groups';

export type DiscoveryMedia = 'movie' | 'tv';
export interface DiscoverySeed { id: number; media: DiscoveryMedia; title: string; reason: string }
export interface DiscoveryItem extends TMDBSearchItem {
  media: DiscoveryMedia;
  reason: string;
  kind: 'recommendation' | 'upcoming';
  /** The seed a recommendation came from, so one seed cannot fill a page. */
  seedKey?: string;
  /** A tile-length reason, "Like Arcane"; `reason` is the full sentence. */
  shortReason?: string;
  /** A well-loved title outside the usual genres (wildcards.ts), not a seed's. */
  wildcard?: boolean;
}
/** Where Discover's suggestions come from: one tmdb-proxy call. */
export interface DiscoverySource {
  endpoint: string;
  params: Record<string, string>;
  media: DiscoveryMedia;
  reason: string;
  kind: DiscoveryItem['kind'];
  seedKey?: string;
  shortReason?: string;
  wildcard?: boolean;
}
export const discoveryKey = (media: DiscoveryMedia, id: number) => `${media}:${id}`;
export const discoveryDate = (item: DiscoveryItem) => item.release_date || item.first_air_date || '';

/** How many seeds one page of suggestions asks TMDB about. */
export const SEEDS_PER_PAGE = 4;
/** The strong-signal seeds that rotate week to week; weaker ones follow. */
const ROTATING_POOL = 24;

export const mediaOf = (item: WatchlistItem): DiscoveryMedia => (item.category === 'Movies' ? 'movie' : 'tv');

/** Whole weeks since the epoch, so the rotation turns over every week. */
export const weekIndex = (today: Date) => Math.floor(today.getTime() / (7 * 24 * 60 * 60 * 1000));

/**
 * Every title worth asking TMDB "more like this" about. Five signals --
 * high personal scores, favourites newest first, recent watches, shows in
 * progress, and saved titles not out yet (soonest first) -- take turns, so
 * no one signal (101 favourites, say) fills every page. Anything else saved
 * follows. Hidden, stopped and low-scored titles are never seeds.
 *
 * The strong part of the list rotates weekly, so the first page differs from
 * week to week; paging on walks the whole list. An unreleased title often
 * has few TMDB recommendations yet, which the turn-taking absorbs.
 */
export function discoverySeeds(
  watchlist: WatchlistItem[],
  favourites: FavouriteItem[],
  today = new Date(),
  type: LibraryType = 'all',
): DiscoverySeed[] {
  const usable = watchlist.filter((item) => {
    if (!item.tmdb_id) return false;
    if (item.library_state === 'hidden' || item.library_state === 'stopped') return false;
    return item.personal_rating == null || item.personal_rating >= 6;
  });
  const blocked = new Set(
    watchlist.filter((item) => item.tmdb_id && !usable.includes(item)).map((item) => discoveryKey(mediaOf(item), item.tmdb_id!)),
  );
  const seed = (item: WatchlistItem, reason: string): DiscoverySeed => ({ id: item.tmdb_id!, media: mediaOf(item), title: item.title, reason });

  const hasFranchise = (item: WatchlistItem) => item.collection_id != null || Boolean(item.franchise);

  const rated = usable
    .filter((item) => (item.personal_rating ?? 0) >= 8)
    .sort((a, b) => Number(hasFranchise(b)) - Number(hasFranchise(a)) || (b.personal_rating ?? 0) - (a.personal_rating ?? 0) || a.title.localeCompare(b.title))
    .map((item) => seed(item, `Because you rated ${item.title} ${item.personal_rating}/10`));
  const favoured = favourites
    .filter((item) => item.tmdb_id && !blocked.has(discoveryKey(item.media_type, item.tmdb_id)))
    .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? '') || a.title.localeCompare(b.title))
    .map((item): DiscoverySeed => ({ id: item.tmdb_id!, media: item.media_type, title: item.title, reason: `Because you favourited ${item.title}` }));
  const recent = usable
    .filter((item) => item.watched_at)
    .sort((a, b) => Number(hasFranchise(b)) - Number(hasFranchise(a)) || (b.watched_at ?? '').localeCompare(a.watched_at ?? ''))
    .map((item) => seed(item, `Because you watched ${item.title}`));
  const watching = usable
    // Any started show with episodes in play: mid-season, kept up with, or
    // between seasons on To watch.
    .filter((item) => ['Watching', 'Between seasons'].includes(libraryStatus(item, today)))
    .sort((a, b) => Number(hasFranchise(b)) - Number(hasFranchise(a)) || a.title.localeCompare(b.title))
    .map((item) => seed(item, `Because you’re watching ${item.title}`));
  const awaited = usable
    // New titles only: a caught-up series' dated return also sits on
    // Upcoming, but it is not what "waiting for" means here.
    .filter((item) => libraryShelf(item, today) === 'Upcoming' && libraryStatus(item, today) !== 'Caught up')
    .map((item) => ({ item, date: nextAirDate(item, today) ?? '9999' }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.item.title.localeCompare(b.item.title))
    .map(({ item }) => seed(item, `Because you’re waiting for ${item.title}`));
  const saved = [...usable]
    .sort((a, b) => Number(hasFranchise(b)) - Number(hasFranchise(a)) || a.title.localeCompare(b.title))
    .map((item) => seed(item, `Based on ${item.title} in your library`));

  const seen = new Set<string>();
  const ordered = [...takeTurns([rated, favoured, recent, watching, awaited]), ...saved].filter((item) => {
    if (type !== 'all' && item.media !== type) return false;
    const key = discoveryKey(item.media, item.id);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const strong = ordered.slice(0, ROTATING_POOL);
  if (strong.length === 0) return ordered;
  const offset = (weekIndex(today) * SEEDS_PER_PAGE) % strong.length;
  return [...strong.slice(offset), ...strong.slice(0, offset), ...ordered.slice(ROTATING_POOL)];
}

/** One from each list in turn, keeping each list's own order. */
export function takeTurns<T>(lists: readonly (readonly T[])[]): T[] {
  const result: T[] = [];
  const longest = Math.max(0, ...lists.map((list) => list.length));
  for (let index = 0; index < longest; index++) {
    for (const list of lists) if (index < list.length) result.push(list[index]);
  }
  return result;
}

/**
 * Likely seen's widely watched pool reads TMDB's most-voted titles, films and
 * series apart: the top pages, which rotate weekly, and the pages below them.
 * A large library already holds nearly every title on the top pages, so the
 * pool takes turns between the two from its first page, then walks the rest.
 */
export const LIKELY_SEEN_TOP_PAGES = 15;
/** The pool's last TMDB page: the top 1,000, still titles with thousands of votes. */
export const LIKELY_SEEN_POOL_PAGES = 50;

/**
 * The TMDB page the pool's `index`th page reads (0-based). Even indices walk
 * the top pages from the week's start, odd ones the deeper pages from theirs;
 * once the top pages are spent, the deeper ones carry on alone. Every page
 * from 1 to `LIKELY_SEEN_POOL_PAGES` is read once.
 */
export function likelySeenTmdbPage(index: number, week: number): number {
  const top = LIKELY_SEEN_TOP_PAGES;
  const deep = LIKELY_SEEN_POOL_PAGES - top;
  const topStart = ((week % top) + top) % top;
  const deepStart = ((week % deep) + deep) % deep;
  const deepPage = (n: number) => top + 1 + ((deepStart + n) % deep);
  if (index < 2 * top) {
    return index % 2 === 0 ? 1 + ((topStart + index / 2) % top) : deepPage((index - 1) / 2);
  }
  return deepPage(index - top);
}

/** A language's least share of a taste profile before Likely seen reads its most-voted titles. */
export const LIKELY_SEEN_LANGUAGE_MIN_SHARE = 0.03;

/**
 * The language, other than English, whose most-voted titles Likely seen also
 * reads: the profile's strongest, if it holds `LIKELY_SEEN_LANGUAGE_MIN_SHARE`
 * of it. English needs no pool of its own, since the most-voted titles are
 * mostly English already; `xx` is TMDB's "no language". Ties go to the
 * earlier code.
 */
export function likelySeenLanguage(language: ReadonlyMap<string, number>): string | null {
  let best: string | null = null;
  let bestShare = LIKELY_SEEN_LANGUAGE_MIN_SHARE;
  for (const [code, share] of language) {
    if (code === 'en' || code === 'xx' || share < bestShare || (share === bestShare && best !== null && code > best)) continue;
    best = code;
    bestShare = share;
  }
  return best;
}

export type LikelySeenLanguages = Readonly<Record<DiscoveryMedia, string | null>>;
/** Pool pages that also read the taste profile's language's most-voted titles: its top 60. */
export const LIKELY_SEEN_LANGUAGE_PAGES = 3;
/**
 * A language's most-voted titles run out of votes quickly: below this, a
 * title is not one most people who watch that language would know.
 */
export const LIKELY_SEEN_LANGUAGE_MIN_VOTES = 100;
const LIKELY_SEEN_LANGUAGE_KEY = 'likely-seen:language';

/**
 * One page of Likely seen's widely watched pool: TMDB's most-voted released
 * films and series on the page `likelySeenTmdbPage` picks and, for the first
 * `LIKELY_SEEN_LANGUAGE_PAGES`, the most-voted in the language other than
 * English the taste profile leans to, films and series apart
 * (`likelySeenLanguage`). Two calls, or up to four with a language.
 */
export function likelySeenPoolSources(
  index: number,
  week: number,
  today: string,
  languages: LikelySeenLanguages,
): DiscoverySource[] {
  const released = (media: DiscoveryMedia) => (media === 'movie' ? { 'release_date.lte': today } : { 'first_air_date.lte': today });
  const page = String(likelySeenTmdbPage(index, week));
  const sources: DiscoverySource[] = (['movie', 'tv'] as const).map((media) => ({
    endpoint: `discover/${media}`,
    params: { ...released(media), sort_by: 'vote_count.desc', include_adult: 'false', page },
    media,
    reason: 'Widely watched on TMDB — have you seen this already?',
    shortReason: 'Widely watched',
    kind: 'recommendation' as const,
  }));
  if (index >= LIKELY_SEEN_LANGUAGE_PAGES) return sources;
  for (const media of ['movie', 'tv'] as const) {
    const language = languages[media];
    if (!language) continue;
    const name = languageDisplayName(language);
    sources.push({
      endpoint: `discover/${media}`,
      params: {
        ...released(media),
        with_original_language: language,
        'vote_count.gte': String(LIKELY_SEEN_LANGUAGE_MIN_VOTES),
        sort_by: 'vote_count.desc',
        include_adult: 'false',
        page: String(index + 1),
      },
      media,
      reason: `One of the most watched ${name} ${media === 'movie' ? 'films' : 'series'} on TMDB — have you seen it already?`,
      shortReason: `Widely watched · ${name}`,
      kind: 'recommendation',
      seedKey: LIKELY_SEEN_LANGUAGE_KEY,
    });
  }
  return sources;
}

/**
 * A pool page's titles for one view, in grid order: its most-voted titles
 * take turns with its language's, and in All each takes turns between films
 * and series.
 */
export function likelySeenPoolPageItems(items: readonly DiscoveryItem[], type: LibraryType): DiscoveryItem[] {
  const shown = items.filter((item) => type === 'all' || item.media === type);
  const alternate = (list: DiscoveryItem[]) => (type === 'all' ? interleaveUpcoming(list) : list);
  return takeTurns([
    alternate(shown.filter((item) => item.seedKey !== LIKELY_SEEN_LANGUAGE_KEY)),
    alternate(shown.filter((item) => item.seedKey === LIKELY_SEEN_LANGUAGE_KEY)),
  ]);
}

/**
 * Whether Likely seen is still paging its pool for a grid short of `target`:
 * a page on its way (which can wait a minute for Discover's share of calls),
 * or one still to ask for, automatic or after a None of these. The paging
 * effect asks for a page on exactly this, and an empty grid then says it is
 * still looking, not that nothing was found.
 */
export function likelySeenStillPaging(state: {
  ready: boolean;
  shown: number;
  target: number;
  libraryLoading: boolean;
  failed: boolean;
  fetchingNext: boolean;
  hasNext: boolean;
  autoPagesLeft: number;
  answerPagesLeft: number;
}): boolean {
  if (!state.ready || state.shown >= state.target || state.libraryLoading || state.failed) return false;
  return state.fetchingNext || (state.hasNext && (state.autoPagesLeft > 0 || state.answerPagesLeft > 0));
}

export const MAX_SUGGESTIONS_PER_SEED = 4;
/** Wildcards on one page of suggestions for one media: a few, not a seed's share. */
export const WILDCARDS_PER_PAGE = 2;

/**
 * Round-robin across seeds, keeping each seed's own order, and capping each
 * non-filler seed so one prolific show cannot dominate the grid. A page's
 * wildcards are one more turn, capped at `WILDCARDS_PER_PAGE`.
 */
export function interleaveBySeed(
  items: DiscoveryItem[],
  maxPerSeed = MAX_SUGGESTIONS_PER_SEED,
): DiscoveryItem[] {
  const groups = new Map<string, DiscoveryItem[]>();
  for (const item of items) {
    const key = item.seedKey ?? '';
    const existing = groups.get(key);
    if (existing) {
      const cap = item.wildcard ? WILDCARDS_PER_PAGE : maxPerSeed;
      if (key.startsWith('filler:') || cap <= 0 || existing.length < cap) {
        existing.push(item);
      }
    } else {
      groups.set(key, [item]);
    }
  }
  const queues = [...groups.values()];
  const total = queues.reduce((sum, q) => sum + q.length, 0);
  const result: DiscoveryItem[] = [];
  for (let index = 0; result.length < total; index++) {
    for (const queue of queues) if (queue[index]) result.push(queue[index]);
  }
  return result;
}

/**
 * Drops known titles (in the library, favourited, dismissed), then caps and
 * interleaves by seed as `interleaveBySeed` does. Capping first would let a
 * seed's four be four known titles, and with a large library whole pages came
 * to nothing. With `score`, each seed's titles are ordered best first before
 * the cap, so a seed offers its four best fits rather than TMDB's first four;
 * seeds keep their turns, and ties keep TMDB's order. Wildcards keep TMDB's
 * order, most voted first: they are chosen for being outside the profile, so
 * ranking them by it would pick the ones nearest the usual genres.
 */
export function interleaveFreshBySeed(
  items: DiscoveryItem[],
  known: ReadonlySet<string>,
  score?: (item: DiscoveryItem) => number,
): DiscoveryItem[] {
  const fresh = items.filter((item) => !known.has(discoveryKey(item.media, item.id)));
  if (!score) return interleaveBySeed(fresh);
  const seedOrder = new Map<string, number>();
  for (const item of fresh) if (!seedOrder.has(item.seedKey ?? '')) seedOrder.set(item.seedKey ?? '', seedOrder.size);
  const ranked = fresh
    .map((item, index) => ({ item, index, seed: seedOrder.get(item.seedKey ?? '')!, fit: item.wildcard ? 0 : score(item) }))
    .sort((a, b) => a.seed - b.seed || b.fit - a.fit || a.index - b.index)
    .map(({ item }) => item);
  return interleaveBySeed(ranked);
}

/**
 * Orders items by when each key was first seen, oldest first, and records new
 * keys in `seen` as they turn up. A list that fills in as pages load then only
 * grows at its end: nothing already on screen moves.
 */
export function keepFirstSeenOrder<T>(items: readonly T[], keyOf: (item: T) => string, seen: Map<string, number>): T[] {
  for (const item of items) {
    const key = keyOf(item);
    if (!seen.has(key)) seen.set(key, seen.size);
  }
  return [...items].sort((a, b) => (seen.get(keyOf(a)) ?? 0) - (seen.get(keyOf(b)) ?? 0));
}

/** A tile kept on screen after its title has left the list. */
export interface HeldTile<T> {
  item: T;
  /** The keys of the tiles before it when it was held, nearest last. */
  after: readonly string[];
}

/**
 * `items` with each held tile that has left them put back after the nearest
 * tile that was before it and is still shown (first if none is), so a title
 * logged with Seen it stays where it was while it offers the rating, and
 * the list closes up around it as it would around any tile. Held tiles go
 * back nearest the start first, so one can follow another. One still in
 * `items` is not doubled.
 */
export function keepHeldInPlace<T>(items: readonly T[], held: readonly HeldTile<T>[], keyOf: (item: T) => string): T[] {
  const out = [...items];
  const present = new Set(items.map(keyOf));
  for (const { item, after } of [...held].sort((a, b) => a.after.length - b.after.length)) {
    const key = keyOf(item);
    if (present.has(key)) continue;
    const position = new Map(out.map((candidate, index) => [keyOf(candidate), index]));
    let at = 0;
    for (let index = after.length - 1; index >= 0; index -= 1) {
      const found = position.get(after[index]);
      if (found !== undefined) { at = found + 1; break; }
    }
    out.splice(at, 0, item);
    present.add(key);
  }
  return out;
}

/** One wildcard for every this many other suggestions on screen; see `admitWildcards`. */
export const SUGGESTIONS_PER_WILDCARD = 5;

/**
 * Keeps wildcards to a few places in a list: a new one comes in only while
 * there are `SUGGESTIONS_PER_WILDCARD` other titles in the list for every
 * wildcard in it. A large library already holds most of what seeds suggest,
 * while a page's wildcards are rarely in it, so without this they would fill
 * the grid. A title already shown (`seen`, as `keepFirstSeenOrder` keeps it)
 * always stays, so answering one tile never takes another away, even one
 * that came back as a wildcard after first showing as a seed's suggestion.
 * New wildcards come in in the list's order.
 */
export function admitWildcards<T extends { wildcard?: boolean }>(
  items: readonly T[],
  keyOf: (item: T) => string,
  seen: ReadonlyMap<string, number>,
): T[] {
  let others = 0;
  let shown = 0;
  for (const item of items) {
    if (!item.wildcard) others += 1;
    else if (seen.has(keyOf(item))) shown += 1;
  }
  let room = Math.floor(others / SUGGESTIONS_PER_WILDCARD) - shown;
  return items.filter((item) => {
    if (!item.wildcard || seen.has(keyOf(item))) return true;
    if (room <= 0) return false;
    room -= 1;
    return true;
  });
}

/**
 * How many film collections with something unanswered HAVE YOU ALREADY
 * WATCHED? needs before it can stop checking older ones. Films and series
 * take turns on screen, a film first, so in All at least half the cards are
 * films whenever there are enough, however many spin-off groups there are.
 */
export function filmGroupsNeeded(type: LibraryType, target: number, seriesGroups: number): number {
  if (type === 'tv') return 0;
  if (type === 'movie') return target;
  return Math.max(target - seriesGroups, Math.ceil(target / 2));
}

/** Titles never to suggest: in the library, favourited, or turned down (`hidden`). */
export function knownDiscoveryKeys(
  watchlist: WatchlistItem[],
  favourites: FavouriteItem[],
  hidden: ReadonlySet<string>,
): Set<string> {
  return new Set([
    ...hidden,
    ...watchlist.filter((item) => item.tmdb_id).map((item) => discoveryKey(mediaOf(item), item.tmdb_id!)),
    ...favourites.filter((item) => item.tmdb_id).map((item) => discoveryKey(item.media_type, item.tmdb_id!)),
  ]);
}

/** Identity always includes media type: TMDB film/show IDs can collide. */
export function curateDiscovery(
  items: DiscoveryItem[],
  watchlist: WatchlistItem[],
  favourites: FavouriteItem[],
  hidden: ReadonlySet<string>,
  excludedKeys?: ReadonlySet<string>,
): DiscoveryItem[] {
  const seen = knownDiscoveryKeys(watchlist, favourites, hidden);
  for (const key of excludedKeys ?? []) seen.add(key);
  return items.filter((item) => {
    const key = discoveryKey(item.media, item.id);
    if (!Number.isInteger(item.id) || item.id <= 0 || !(item.title || item.name) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export interface UpcomingFranchiseSource {
  name: string;
  entries: {
    mediaType: DiscoveryMedia;
    tmdbId: number;
    title: string;
    releaseDate: string | null;
    posterPath: string | null;
  }[];
}

/**
 * Turns dated future instalments from the user's film collections and TV
 * franchises into high-priority Coming soon items, sorted soonest first.
 */
export function franchiseUpcomingItems(
  sources: UpcomingFranchiseSource[],
  todayIso: string,
): DiscoveryItem[] {
  const seen = new Set<string>();
  const items: DiscoveryItem[] = [];
  for (const source of sources) {
    for (const entry of source.entries) {
      if (!entry.releaseDate || entry.releaseDate <= todayIso) continue;
      const key = discoveryKey(entry.mediaType, entry.tmdbId);
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({
        id: entry.tmdbId,
        media: entry.mediaType,
        title: entry.mediaType === 'movie' ? entry.title : undefined,
        name: entry.mediaType === 'tv' ? entry.title : undefined,
        release_date: entry.mediaType === 'movie' ? entry.releaseDate : undefined,
        first_air_date: entry.mediaType === 'tv' ? entry.releaseDate : undefined,
        poster_path: entry.posterPath,
        overview: '',
        kind: 'upcoming',
        reason: `In your franchise · ${source.name}`,
        shortReason: 'In your franchise',
      });
    }
  }
  return items.sort(
    (a, b) =>
      discoveryDate(a).localeCompare(discoveryDate(b)) ||
      (a.title || a.name || '').localeCompare(b.title || b.name || ''),
  );
}

/**
 * Keep priority franchise releases at the front of Coming soon, then give
 * general films and series alternating space while preserving each source's order.
 */
export function interleaveUpcoming(items: DiscoveryItem[]): DiscoveryItem[] {
  const priority = items.filter((item) => item.kind === 'upcoming' && Boolean(item.shortReason));
  const rest = items.filter((item) => !(item.kind === 'upcoming' && Boolean(item.shortReason)));
  return [
    ...priority,
    ...takeTurns([
      rest.filter((item) => item.media === 'movie'),
      rest.filter((item) => item.media === 'tv'),
    ]),
  ];
}

/**
 * Finds released titles recommended independently by `minSeeds` or more
 * distinct titles in the library (multi-seed consensus) so obvious
 * "Likely seen" classics can be surfaced in HAVE YOU ALREADY WATCHED?
 * rather than cluttering YOU MIGHT LIKE.
 */
export function likelySeenConsensus(
  items: DiscoveryItem[],
  today = new Date(),
  minSeeds = 2,
): DiscoveryItem[] {
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const groups = new Map<string, { item: DiscoveryItem; seeds: Set<string> }>();

  for (const item of items) {
    if (item.kind !== 'recommendation' || !item.seedKey || item.seedKey.startsWith('filler:') || item.wildcard) continue;
    const date = discoveryDate(item).slice(0, 10);
    if (!date || date > todayIso) continue;
    const key = discoveryKey(item.media, item.id);
    const existing = groups.get(key);
    if (existing) {
      existing.seeds.add(item.seedKey);
    } else {
      groups.set(key, { item, seeds: new Set([item.seedKey]) });
    }
  }

  return [...groups.values()]
    .filter((entry) => entry.seeds.size >= minSeeds)
    .sort(
      (a, b) =>
        b.seeds.size - a.seeds.size ||
        (b.item.vote_count ?? 0) - (a.item.vote_count ?? 0) ||
        (a.item.title || a.item.name || '').localeCompare(b.item.title || b.item.name || ''),
    )
    .map(({ item, seeds }) => ({
      ...item,
      reason: `Recommended across ${seeds.size} titles in your library`,
      shortReason: `In ${seeds.size} of your lists`,
    }));
}
