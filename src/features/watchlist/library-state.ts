import type { WatchlistItem } from './WatchlistContext';

/**
 * Active is the default. Paused (series only) is a break: the show leaves
 * Watch Next and Your Week and keeps its shelf, so it is easy to resume.
 * Stopped watching and Hidden take a title off the working shelves.
 */
export type LibraryState = 'active' | 'paused' | 'hidden' | 'stopped';

/** Titles News follows: Paused stays; Stopped watching and Hidden leave. */
export const FOLLOWED_STATES = ['active', 'paused'] as const;
export function isFollowedState(state: string | null | undefined): boolean {
  return !state || (FOLLOWED_STATES as readonly string[]).includes(state);
}

/** Films cannot be paused: there is nothing to resume. */
export function isLibraryState(value: string, category: string): value is LibraryState {
  if (value === 'paused') return category === 'TV Shows';
  return value === 'active' || value === 'hidden' || value === 'stopped';
}

const isoDay = (day: Date) =>
  `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;

export function isValidPersonalRating(value: number | null): boolean {
  return value === null || (Number.isFinite(value) && value >= 0.5 && value <= 10 && Number.isInteger(value * 2));
}

/** Personal progress is independent of the show's production status. */
export function libraryStatus(item: WatchlistItem, today = new Date()): string {
  if (item.library_state === 'hidden') return 'Hidden';
  if (item.library_state === 'stopped') return 'Stopped watching';
  if (item.category === 'Movies') return item.watched ? 'Watched' : 'To Watch';
  const date = isoDay(today);
  const episodes = (item.seasons ?? []).filter((season) => season.season_number > 0).flatMap((season) => season.episodes);
  const released = episodes.filter((episode) => episode.release_date && episode.release_date.slice(0, 10) <= date);
  const watched = released.filter((episode) => episode.watched).length;
  if (released.length > 0 && watched === released.length) {
    const ended = ['Ended', 'Canceled', 'Cancelled'].includes(item.series_status ?? '');
    // An ended show's undated episode will never air and cannot be marked
    // one by one, so it must not hold the show off Completed.
    return ended && episodes.every((episode) => episode.watched || !episode.release_date) ? 'Completed' : 'Caught up';
  }
  return episodes.some((episode) => episode.watched) ? 'Watching' : 'To Watch';
}


/**
 * The one shelf a title sits on. Status is the primary axis; films and
 * series share every shelf and are split by a separate type filter.
 *
 * - Watching: a series with released episodes still to watch.
 * - To watch: released and not started.
 * - Upcoming: nothing released yet.
 * - Up to date: a running series with every released episode watched. It
 *   returns to Watching by itself when the next episode airs.
 * - Finished: a watched film, or an ended series watched to the end.
 */
export const LIBRARY_SHELVES = ['Watching', 'To watch', 'Upcoming', 'Up to date', 'Finished'] as const;
export const MORE_SHELVES = ['Stopped watching', 'Hidden'] as const;
export type LibraryShelf = (typeof LIBRARY_SHELVES)[number] | (typeof MORE_SHELVES)[number];
export type LibraryType = 'all' | 'movie' | 'tv';
export const LIBRARY_TYPE_OPTIONS: readonly { key: LibraryType; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'movie', label: 'Films' },
  { key: 'tv', label: 'Series' },
];

/** Air dates that count as the future, from the title and its episodes. */
function futureDates(item: WatchlistItem, today: Date): string[] {
  const date = isoDay(today);
  const dates = [
    item.release_date,
    ...(item.seasons ?? []).filter((season) => season.season_number > 0).flatMap((season) => [
      season.release_date,
      ...season.episodes.map((episode) => episode.release_date),
    ]),
  ];
  return dates.filter((value): value is string => !!value && value.slice(0, 10) > date).map((value) => value.slice(0, 10));
}

/** True when nothing of the title has come out yet. Unknown dates never count as future. */
function isUnreleased(item: WatchlistItem, today: Date): boolean {
  const date = isoDay(today);
  if (item.category === 'Movies') return !!item.release_date && item.release_date.slice(0, 10) > date;
  const episodes = (item.seasons ?? []).filter((season) => season.season_number > 0).flatMap((season) => season.episodes);
  if (episodes.some((episode) => episode.release_date && episode.release_date.slice(0, 10) <= date)) return false;
  return futureDates(item, today).length > 0;
}

export function libraryShelf(item: WatchlistItem, today = new Date()): LibraryShelf {
  const status = libraryStatus(item, today);
  if (status === 'Hidden' || status === 'Stopped watching') return status;
  if (status === 'Watched' || status === 'Completed') return 'Finished';
  if (status === 'Caught up') return 'Up to date';
  if (status === 'Watching') return 'Watching';
  return isUnreleased(item, today) ? 'Upcoming' : 'To watch';
}

/** The soonest future air date, for ordering Upcoming and Up to date. Null when none is known. */
export function nextAirDate(item: WatchlistItem, today = new Date()): string | null {
  const dates = futureDates(item, today).sort();
  return dates[0] ?? null;
}

export function matchesLibraryType(item: WatchlistItem, type: LibraryType): boolean {
  if (type === 'all') return true;
  return type === 'movie' ? item.category === 'Movies' : item.category === 'TV Shows';
}

/**
 * Old `?category=` slugs still land somewhere sensible: links to the former
 * TV Shows and Movies tabs open To watch with the matching type.
 */
export function shelfFromParam(param: string | null): { shelf: LibraryShelf | 'Favourites'; type?: LibraryType } | null {
  switch (param) {
    case 'favourites': return { shelf: 'Favourites' };
    case 'watching': case 'currently-watching': return { shelf: 'Watching' };
    case 'to-watch': return { shelf: 'To watch' };
    case 'tv-shows': return { shelf: 'To watch', type: 'tv' };
    case 'movies': return { shelf: 'To watch', type: 'movie' };
    case 'upcoming': return { shelf: 'Upcoming' };
    case 'up-to-date': return { shelf: 'Up to date' };
    case 'finished': case 'watched': return { shelf: 'Finished' };
    case 'stopped-watching': return { shelf: 'Stopped watching' };
    case 'hidden': return { shelf: 'Hidden' };
    default: return null;
  }
}
