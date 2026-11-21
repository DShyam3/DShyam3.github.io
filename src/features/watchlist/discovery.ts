import type { FavouriteItem, WatchlistItem } from './WatchlistContext';
import { libraryShelf, libraryStatus, nextAirDate, type LibraryType } from './library-state';
import type { TMDBSearchItem } from './tmdb-types';

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
}
export const discoveryKey = (media: DiscoveryMedia, id: number) => `${media}:${id}`;
export const discoveryDate = (item: DiscoveryItem) => item.release_date || item.first_air_date || '';

/** How many seeds one page of suggestions asks TMDB about. */
export const SEEDS_PER_PAGE = 4;
/** The strong-signal seeds that rotate week to week; weaker ones follow. */
const ROTATING_POOL = 24;

const mediaOf = (item: WatchlistItem): DiscoveryMedia => (item.category === 'Movies' ? 'movie' : 'tv');

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
function takeTurns<T>(lists: T[][]): T[] {
  const result: T[] = [];
  const longest = Math.max(0, ...lists.map((list) => list.length));
  for (let index = 0; index < longest; index++) {
    for (const list of lists) if (index < list.length) result.push(list[index]);
  }
  return result;
}

export const MAX_SUGGESTIONS_PER_SEED = 4;

/**
 * Round-robin across seeds, keeping each seed's own order, and capping each
 * non-filler seed so one prolific show cannot dominate the grid.
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
      if (key.startsWith('filler:') || maxPerSeed <= 0 || existing.length < maxPerSeed) {
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
 * to nothing.
 */
export function interleaveFreshBySeed(items: DiscoveryItem[], known: ReadonlySet<string>): DiscoveryItem[] {
  return interleaveBySeed(items.filter((item) => !known.has(discoveryKey(item.media, item.id))));
}

/**
 * What to do with this browser's dismissals once the owner's table is
 * reachable. A key leaves the browser copy only when a read of the table
 * has it (`confirmed`), never on a successful write alone: a read already in
 * flight when the write lands finishes after it without the new row, and a
 * key released on the write would then vanish from both copies and the title
 * would come back. Keys already being written are not sent twice; keys that
 * could never be written (malformed) are released.
 */
export function dismissalHandover(
  local: ReadonlySet<string>,
  confirmed: readonly string[] | undefined,
  sending: ReadonlySet<string>,
): { release: Set<string>; send: { media: DiscoveryMedia; tmdb_id: number }[] } {
  const inTable = new Set(confirmed ?? []);
  const release = new Set<string>();
  const send: { media: DiscoveryMedia; tmdb_id: number }[] = [];
  for (const key of local) {
    if (inTable.has(key)) { release.add(key); continue; }
    const [media, id] = key.split(':');
    const tmdbId = Number(id);
    if ((media !== 'movie' && media !== 'tv') || !Number.isInteger(tmdbId) || tmdbId <= 0) { release.add(key); continue; }
    if (!sending.has(key)) send.push({ media, tmdb_id: tmdbId });
  }
  return { release, send };
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

/** Titles never to suggest: in the library, favourited, or dismissed. */
export function knownDiscoveryKeys(
  watchlist: WatchlistItem[],
  favourites: FavouriteItem[],
  dismissed: ReadonlySet<string>,
): Set<string> {
  return new Set([
    ...dismissed,
    ...watchlist.filter((item) => item.tmdb_id).map((item) => discoveryKey(mediaOf(item), item.tmdb_id!)),
    ...favourites.filter((item) => item.tmdb_id).map((item) => discoveryKey(item.media_type, item.tmdb_id!)),
  ]);
}

/** Identity always includes media type: TMDB film/show IDs can collide. */
export function curateDiscovery(
  items: DiscoveryItem[],
  watchlist: WatchlistItem[],
  favourites: FavouriteItem[],
  dismissed: ReadonlySet<string>,
  excludedKeys?: ReadonlySet<string>,
): DiscoveryItem[] {
  const seen = knownDiscoveryKeys(watchlist, favourites, dismissed);
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
    if (item.kind !== 'recommendation' || !item.seedKey || item.seedKey.startsWith('filler:')) continue;
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
