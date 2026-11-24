/**
 * "Rate what you've watched": the watched titles with no overall rating, in
 * the order the queue asks about them. A rating is the clearest thing the
 * taste profile hears about a title (8 and up seeds suggestions, under 6
 * never does), and a library logged from history arrives with none.
 *
 * Fixed rules over the library, like the rest of Discover: the same library
 * and the same skips always give the same order.
 */

import type { WatchlistItem } from './WatchlistContext';
import { libraryStatus } from './library-state';
import { titleKey } from './title-ref';

/**
 * A series is asked about as a whole only once there is a whole to judge,
 * as Library's "Finished — rate the show?" waits: finished, caught up with
 * what has aired, or given up on. Mid-season, a low score would drop it from
 * the seeds for good.
 */
const SERIES_READY = new Set(['Completed', 'Caught up', 'Stopped watching']);

/**
 * Ready for an overall rating: a film marked watched, or a series with an
 * episode watched (specials aside) that is also SERIES_READY. Never a hidden
 * title: hiding keeps it out of the taste profile, and a rating would bring
 * it back in.
 */
export function isRateable(item: WatchlistItem, today = new Date()): boolean {
  if (item.library_state === 'hidden') return false;
  if (item.category === 'Movies') return item.watched === true;
  if (item.category !== 'TV Shows') return false;
  const started = (item.seasons ?? []).some((season) => season.season_number > 0 && season.episodes.some((episode) => episode.watched));
  return started && SERIES_READY.has(libraryStatus(item, today));
}

/**
 * Rateable titles with no rating. Most recently watched first (a series by
 * its last watched episode); then those with no watch date, the most voted
 * on first (TMDB's count, which every title has; IMDb's runs on another
 * scale); ties by title. Titles skipped before go last, longest-skipped
 * first, so a skip is not asked again before the rest.
 */
export function ratingQueue(items: readonly WatchlistItem[], skipped: ReadonlyMap<string, number>, today = new Date()): WatchlistItem[] {
  return items
    .filter((item) => item.personal_rating == null && isRateable(item, today))
    .sort((a, b) => {
      const skipA = skipped.get(titleKey(a));
      const skipB = skipped.get(titleKey(b));
      if (skipA !== undefined || skipB !== undefined) {
        if (skipA === undefined) return -1;
        if (skipB === undefined) return 1;
        if (skipA !== skipB) return skipA - skipB;
      }
      const watchedA = a.watched_at ?? '';
      const watchedB = b.watched_at ?? '';
      if (watchedA !== watchedB) {
        if (!watchedA) return 1;
        if (!watchedB) return -1;
        return watchedB.localeCompare(watchedA);
      }
      return (b.tmdb_votes ?? 0) - (a.tmdb_votes ?? 0) || a.title.localeCompare(b.title);
    });
}

/** Skips of titles still waiting to be rated; the rest are stale. */
export function pruneSkips(skips: ReadonlyMap<string, number>, waiting: ReadonlySet<string>): Map<string, number> {
  return new Map([...skips].filter(([key]) => waiting.has(key)));
}

const SKIPS_KEY = 'watchlist-rating-queue-skips';

/** Skips remembered on this browser: title key to when it was skipped. */
export function readSkips(): Map<string, number> {
  try {
    const raw = JSON.parse(localStorage.getItem(SKIPS_KEY) ?? '{}') as unknown;
    if (!raw || typeof raw !== 'object') return new Map();
    return new Map(Object.entries(raw).filter((entry): entry is [string, number] => typeof entry[1] === 'number'));
  } catch {
    return new Map();
  }
}

export function writeSkips(skips: ReadonlyMap<string, number>): void {
  try {
    localStorage.setItem(SKIPS_KEY, JSON.stringify(Object.fromEntries(skips)));
  } catch {
    // Storage full or blocked: the skip holds for this visit only.
  }
}
