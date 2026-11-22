import {
  LIBRARY_CATEGORIES,
  libraryCategories,
  type LibraryCategory,
} from '@/features/watchlist/library-categories';
import {
  LIBRARY_SHELVES,
  MORE_SHELVES,
  matchesLibraryType,
  nextAirDate,
  type LibraryShelf,
  type LibraryType,
} from '@/features/watchlist/library-state';
import {
  compareTimeToFinish,
  timeToFinish,
  timeToFinishLabel,
  type TimeToFinish,
} from '@/features/watchlist/time-to-finish';
import { formatRuntime } from '@/features/watchlist/watchlist-utils';
import { titleKey } from '@/features/watchlist/title-ref';
import type { FavouriteItem, NewFavourite, WatchlistItem } from '@/features/watchlist/useWatchlist';
import type { DisplaySyncLogEntry } from '@/features/watchlist/sync-logic';

/**
 * Library sort orders. `finish` ranks by time left to watch: a show's aired,
 * unwatched episodes, or a film's runtime. `watched` puts the latest watch
 * date first; titles without one follow in title order.
 */
export type LibrarySort = 'alphabetical' | 'recent' | 'finish' | 'watched' | 'rating';

/** Status shelves first, then the two set-aside shelves. */
export type Shelf = LibraryShelf;
export const MAIN_SHELVES: Shelf[] = [...LIBRARY_SHELVES];
export const SHELVES: Shelf[] = [...MAIN_SHELVES, ...MORE_SHELVES];

/** Each shelf's own orders, default first. Upcoming runs by date. */
export const SHELF_SORTS: Record<Shelf, LibrarySort[]> = {
  Watching: ['alphabetical', 'recent', 'finish'],
  'To watch': ['alphabetical', 'recent', 'finish'],
  Upcoming: [],
  'Up to date': ['alphabetical', 'recent'],
  Finished: ['watched', 'rating', 'alphabetical'],
  'Stopped watching': ['alphabetical', 'rating'],
  Hidden: ['alphabetical'],
};

/** What each shelf holds, said once under its count. */
export const SHELF_HINTS: Record<Shelf, string> = {
  Watching: 'Series you are part-way through a season of, or keeping up with as it airs (next episode due within two weeks). Films go straight from To watch to Finished.',
  'To watch': 'Out now and not started, or a series between seasons with the next one out. Its card says where you pick up.',
  Upcoming: 'Nothing to watch until a dated release: new titles, and the return of a series you are up to date on. Soonest first.',
  'Up to date': 'Running series with every aired episode watched and no next date known. A series moves to Upcoming once its return has a date, or to Watching when its next episode is due within two weeks.',
  Finished: 'Films you have watched, and ended series watched to the last episode.',
  'Stopped watching': 'Set aside, with your progress and ratings kept.',
  Hidden: 'Kept off every other shelf, with your history kept.',
};

export const SORT_LABELS: Record<LibrarySort, string> = {
  alphabetical: 'Title: A–Z',
  recent: 'Latest releases',
  finish: 'Quickest to finish',
  watched: 'Recently watched',
  rating: 'Your rating',
};

export const LIBRARY_TYPE_KEY = 'watchlist-library-type';

export const readStoredType = (): LibraryType => {
  try {
    const stored = localStorage.getItem(LIBRARY_TYPE_KEY);
    return stored === 'movie' || stored === 'tv' ? stored : 'all';
  } catch {
    return 'all';
  }
};

export const writeStoredType = (type: LibraryType): void => {
  try {
    localStorage.setItem(LIBRARY_TYPE_KEY, type);
  } catch {
    // Unavailable storage only means the choice resets next visit.
  }
};

export const ALL_PLATFORMS = [
  'Netflix',
  'Prime Video',
  'Disney+',
  'Apple TV+',
  'BBC iPlayer',
  'ITVX',
  'NOW',
  'Paramount+',
  'Channel 4',
  'Crunchyroll',
  'Online',
];

export const ALL_GENRES = [
  'Action',
  'Adventure',
  'Animation',
  'Biography',
  'Comedy',
  'Crime',
  'Documentary',
  'Drama',
  'Family',
  'Fantasy',
  'History',
  'Horror',
  'Music',
  'Mystery',
  'Romance',
  'Sci-Fi',
  'Sport',
  'Thriller',
  'War',
  'Western',
];

export function computePlatformCounts(items: WatchlistItem[]): Record<string, number> {
  const counts: Record<string, number> = {};
  ALL_PLATFORMS.forEach((p) => (counts[p] = 0));
  items.forEach((item) => {
    if (
      item.streaming_platform &&
      counts[item.streaming_platform] !== undefined
    ) {
      counts[item.streaming_platform]++;
    }
  });
  return counts;
}

export function computeGenreCounts(items: WatchlistItem[]): Record<string, number> {
  const counts: Record<string, number> = {};
  ALL_GENRES.forEach((g) => (counts[g] = 0));
  items.forEach((item) => {
    item.genres?.forEach((g) => {
      if (counts[g] !== undefined) {
        counts[g]++;
      }
    });
  });
  return counts;
}

export function computeAutoCategoryCounts(items: WatchlistItem[]): Record<LibraryCategory, number> {
  const counts = Object.fromEntries(
    LIBRARY_CATEGORIES.map((category) => [category, 0]),
  ) as Record<LibraryCategory, number>;
  items.forEach((item) =>
    libraryCategories(item).forEach((category) => {
      counts[category]++;
    }),
  );
  return counts;
}

export function computeStatusCounts(items: WatchlistItem[]): Record<string, number> {
  const counts: Record<string, number> = {};
  items.forEach((item) => {
    if (item.category === 'TV Shows' && item.series_status) {
      const rawStatus = item.series_status;
      const normalizedStatus =
        rawStatus === 'Canceled' ||
        rawStatus === 'Cancelled' ||
        rawStatus === 'Ended'
          ? 'Ended / Cancelled'
          : rawStatus;
      counts[normalizedStatus] = (counts[normalizedStatus] || 0) + 1;
    }
  });
  return counts;
}

export function computeShelfCounts(
  watchlist: WatchlistItem[],
  shelfByItem: Map<string, Shelf>,
  libraryType: LibraryType,
  searchQuery: string,
): Record<Shelf, number> {
  const counts = Object.fromEntries(
    SHELVES.map((shelf) => [shelf, 0]),
  ) as Record<Shelf, number>;
  const normalizedQuery = searchQuery.trim().toLowerCase();
  watchlist.forEach((item) => {
    const shelf = shelfByItem.get(titleKey(item));
    if (
      shelf &&
      matchesLibraryType(item, libraryType) &&
      (!normalizedQuery || item.title.toLowerCase().includes(normalizedQuery))
    ) {
      counts[shelf]++;
    }
  });
  return counts;
}

export interface FilterAndSortOptions {
  items: WatchlistItem[];
  selectedPlatform: string | null;
  selectedGenre: string | null;
  selectedAutoCategory: LibraryCategory | null;
  selectedStatus: string | null;
  searchQuery: string;
  searching: boolean;
  sortable: boolean;
  sortOrder: LibrarySort;
  byTimeLeft: boolean;
  finishTimes: Map<string, TimeToFinish>;
  rankTimes: Map<string, TimeToFinish>;
  heldKeys: Map<string, string | number> | null;
}

export function filterAndSortWatchlist({
  items,
  selectedPlatform,
  selectedGenre,
  selectedAutoCategory,
  selectedStatus,
  searchQuery,
  searching,
  sortable,
  sortOrder,
  byTimeLeft,
  finishTimes,
  rankTimes,
  heldKeys,
}: FilterAndSortOptions): WatchlistItem[] {
  let result = items;
  if (selectedPlatform) {
    result = result.filter(
      (item) => item.streaming_platform === selectedPlatform,
    );
  }
  if (selectedGenre) {
    result = result.filter((item) => item.genres?.includes(selectedGenre));
  }
  if (selectedAutoCategory) {
    result = result.filter((item) =>
      libraryCategories(item).includes(selectedAutoCategory),
    );
  }
  if (selectedStatus) {
    if (selectedStatus === 'Ended / Cancelled') {
      result = result.filter(
        (item) =>
          item.series_status === 'Ended' ||
          item.series_status === 'Cancelled' ||
          item.series_status === 'Canceled',
      );
    } else {
      result = result.filter((item) => item.series_status === selectedStatus);
    }
  }
  const normalizedQuery = searchQuery.trim().toLowerCase();
  if (normalizedQuery) {
    result = result.filter((item) =>
      item.title.toLowerCase().includes(normalizedQuery),
    );
  }
  if (searching || sortable) {
    result = [...result].sort((a, b) => {
      if (searching || sortOrder === 'alphabetical') return a.title.localeCompare(b.title);
      if (sortOrder === 'watched') {
        // ISO timestamps compare as strings; no date sorts last.
        const date = (item: WatchlistItem) => String(heldKeys?.get(titleKey(item)) ?? item.watched_at ?? '');
        const byDate = date(b).localeCompare(date(a));
        return byDate || a.title.localeCompare(b.title);
      }
      if (sortOrder === 'rating') {
        const score = (item: WatchlistItem) => Number(heldKeys?.get(titleKey(item)) ?? item.personal_rating ?? 0);
        const byRating = score(b) - score(a);
        return byRating || a.title.localeCompare(b.title);
      }
      if (byTimeLeft) {
        const ta = rankTimes.get(titleKey(a)) ?? finishTimes.get(titleKey(a));
        const tb = rankTimes.get(titleKey(b)) ?? finishTimes.get(titleKey(b));
        if (ta && tb) {
          return compareTimeToFinish(ta, tb) || a.title.localeCompare(b.title);
        }
        // A film against a film or a show, by minutes left: a film's
        // runtime, a show's minutes still to watch. No figure goes last.
        const ra = (ta ? ta.minutesLeft : a.runtime) || Infinity;
        const rb = (tb ? tb.minutesLeft : b.runtime) || Infinity;
        if (ra !== rb) return ra < rb ? -1 : 1;
        return a.title.localeCompare(b.title);
      }
      if (sortOrder === 'recent') {
        // A show by its latest season, a film by its release.
        const latest = (item: WatchlistItem) => {
          const dates = [item.release_date, ...(item.seasons ?? []).map((season) => season.release_date)]
            .filter((date): date is string => !!date)
            .map((date) => new Date(date).getTime());
          return Math.max(...dates, 0);
        };
        return latest(b) - latest(a);
      }
      return 0;
    });
  }
  return result;
}

export function selectCategoryItems(options: {
  watchlist: WatchlistItem[];
  libraryType: LibraryType;
  searching: boolean;
  searchAllShelves: boolean;
  shelfByItem: Map<string, Shelf>;
  gridShelfOf: (item: WatchlistItem) => Shelf | undefined;
  selectedCategory: Shelf;
  isAdmin: boolean;
}): WatchlistItem[] {
  const {
    watchlist,
    libraryType,
    searching,
    searchAllShelves,
    shelfByItem,
    gridShelfOf,
    selectedCategory,
    isAdmin,
  } = options;
  const typed = watchlist.filter((item) => matchesLibraryType(item, libraryType));
  // Hidden and Stopped watching are the owner's own shelves.
  const isPrivate = (item: WatchlistItem) =>
    (MORE_SHELVES as readonly string[]).includes(shelfByItem.get(titleKey(item)) ?? '');
  if (searching && searchAllShelves) return isAdmin ? typed : typed.filter((item) => !isPrivate(item));
  if (!isAdmin && (MORE_SHELVES as readonly string[]).includes(selectedCategory)) return [];
  const onShelf = typed.filter((item) => gridShelfOf(item) === selectedCategory);
  if (selectedCategory !== 'Upcoming') return onShelf;
  // Soonest first; a title with no known date goes last.
  const today = new Date();
  return onShelf
    .map((item) => ({ item, date: nextAirDate(item, today) }))
    .sort((a, b) => (a.date ?? '9999').localeCompare(b.date ?? '9999') || a.item.title.localeCompare(b.item.title))
    .map(({ item }) => item);
}

export function computeFinishTimes(
  items: WatchlistItem[],
  enabled: boolean,
  isEpisodeWatched: (showId: string, seasonNumber: number, episodeNumber: number) => boolean,
): Map<string, TimeToFinish> {
  const times = new Map<string, TimeToFinish>();
  if (!enabled) return times;
  const today = new Date();
  for (const item of items) {
    if (item.category !== 'TV Shows') continue;
    times.set(
      titleKey(item),
      timeToFinish(
        item.seasons,
        (seasonNumber, episodeNumber) =>
          isEpisodeWatched(item.id, seasonNumber, episodeNumber),
        today,
      ),
    );
  }
  return times;
}

export function buildSortKeys(
  items: WatchlistItem[],
  sortable: boolean,
  sortOrder: LibrarySort,
): Map<string, string | number> | null {
  if (!sortable || (sortOrder !== 'watched' && sortOrder !== 'rating')) return null;
  return new Map(
    items.map((item) => [
      titleKey(item),
      sortOrder === 'watched' ? item.watched_at ?? '' : item.personal_rating ?? 0,
    ] as const),
  );
}

export function findFavouriteFor(
  favourites: FavouriteItem[],
  item: WatchlistItem,
): FavouriteItem | undefined {
  const mediaType = item.category === 'TV Shows' ? 'tv' : 'movie';
  return favourites.find(
    (candidate) =>
      candidate.media_type === mediaType &&
      (item.tmdb_id ? candidate.tmdb_id === item.tmdb_id : candidate.title === item.title),
  );
}

export function favouritePayloadFor(item: WatchlistItem): NewFavourite {
  const hasFacts =
    item.genre_ids !== undefined ||
    item.original_language !== undefined ||
    item.origin_country !== undefined;
  return {
    title: item.title,
    poster: item.image_url,
    media_type: item.category === 'TV Shows' ? 'tv' : 'movie',
    tmdb_id: item.tmdb_id,
    facts: hasFacts
      ? {
          genre_ids: item.genre_ids ?? null,
          original_language: item.original_language ?? null,
          origin_country: item.origin_country ?? null,
        }
      : undefined,
  };
}

export function syncEntryFailureBadge(entry: DisplaySyncLogEntry): string | null {
  const match = entry.error_message?.match(/^(\d+)\s*item\(s\)\s*failed/i);
  return match ? `${match[1]} failed` : null;
}

export function syncEntryTypeLabel(entry: DisplaySyncLogEntry): string {
  if (entry.is_missed) return 'MISSED';
  if (entry.sync_type === 'auto') return 'AUTO';
  if (entry.sync_type === 'daily') return 'DAILY';
  return 'MAN';
}

export function formatItemTimeLeft(
  item: WatchlistItem,
  byTimeLeft: boolean,
  finishTimes: Map<string, TimeToFinish>,
): string | undefined {
  if (!byTimeLeft) return undefined;
  const finish = finishTimes.get(titleKey(item));
  if (finish) return timeToFinishLabel(finish);
  return item.runtime ? formatRuntime(item.runtime) : undefined;
}

export function formatSyncTimestamp(iso: string): string {
  return new Date(iso).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatNextAutoSync(iso: string): string {
  return new Date(iso).toLocaleString([], {
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}
