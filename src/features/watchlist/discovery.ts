import type { FavouriteItem, WatchlistItem } from './WatchlistContext';
import { libraryShelf, nextAirDate, type LibraryType } from './library-state';
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

  const rated = usable
    .filter((item) => (item.personal_rating ?? 0) >= 8)
    .sort((a, b) => (b.personal_rating ?? 0) - (a.personal_rating ?? 0) || a.title.localeCompare(b.title))
    .map((item) => seed(item, `Because you rated ${item.title} ${item.personal_rating}/10`));
  const favoured = favourites
    .filter((item) => item.tmdb_id && !blocked.has(discoveryKey(item.media_type, item.tmdb_id)))
    .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? '') || a.title.localeCompare(b.title))
    .map((item): DiscoverySeed => ({ id: item.tmdb_id!, media: item.media_type, title: item.title, reason: `Because you favourited ${item.title}` }));
  const recent = usable
    .filter((item) => item.watched_at)
    .sort((a, b) => (b.watched_at ?? '').localeCompare(a.watched_at ?? ''))
    .map((item) => seed(item, `Because you watched ${item.title}`));
  const watching = usable
    .filter((item) => libraryShelf(item, today) === 'Watching')
    .sort((a, b) => a.title.localeCompare(b.title))
    .map((item) => seed(item, `Because you’re watching ${item.title}`));
  const awaited = usable
    .filter((item) => libraryShelf(item, today) === 'Upcoming')
    .map((item) => ({ item, date: nextAirDate(item, today) ?? '9999' }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.item.title.localeCompare(b.item.title))
    .map(({ item }) => seed(item, `Because you’re waiting for ${item.title}`));
  const saved = [...usable]
    .sort((a, b) => a.title.localeCompare(b.title))
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

/** Round-robin across seeds, keeping each seed's own order. */
export function interleaveBySeed(items: DiscoveryItem[]): DiscoveryItem[] {
  const groups = new Map<string, DiscoveryItem[]>();
  for (const item of items) {
    const key = item.seedKey ?? '';
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  const queues = [...groups.values()];
  const result: DiscoveryItem[] = [];
  for (let index = 0; result.length < items.length; index++) {
    for (const queue of queues) if (queue[index]) result.push(queue[index]);
  }
  return result;
}

/** Identity always includes media type: TMDB film/show IDs can collide. */
export function curateDiscovery(items: DiscoveryItem[], watchlist: WatchlistItem[], favourites: FavouriteItem[], dismissed: ReadonlySet<string>): DiscoveryItem[] {
  const seen = new Set([...dismissed, ...watchlist.filter((item) => item.tmdb_id).map((item) => discoveryKey(mediaOf(item), item.tmdb_id!)), ...favourites.filter((item) => item.tmdb_id).map((item) => discoveryKey(item.media_type, item.tmdb_id!))]);
  return items.filter((item) => {
    const key = discoveryKey(item.media, item.id);
    if (!Number.isInteger(item.id) || item.id <= 0 || !(item.title || item.name) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Give films and series space before the display limit, preserving each source's order. */
export function interleaveUpcoming(items: DiscoveryItem[]): DiscoveryItem[] {
  return takeTurns([
    items.filter((item) => item.media === 'movie'),
    items.filter((item) => item.media === 'tv'),
  ]);
}
