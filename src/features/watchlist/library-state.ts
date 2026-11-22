import type { WatchlistItem } from './WatchlistContext';

/**
 * Active is the default. Paused (series only) is a break: the show leaves
 * Watch Next and Your Week and keeps its shelf, so it is easy to resume.
 * Stopped watching and Hidden take a title off the working shelves.
 */
export type LibraryState = 'active' | 'paused' | 'hidden' | 'stopped';

/**
 * The library as a viewer sees it: all of it for the owner; for anyone else,
 * nothing hidden or stopped. Discover and Franchises build their cards, and
 * the TV seeds they send for spin-offs, from this, so a card never reveals a
 * hidden or stopped title. watchlist-cron-sync builds the visitor's seed list
 * the same way (`visitorTvSeedIds`) for the Wikidata cache.
 */
export function visibleLibraryFor(watchlist: WatchlistItem[], isAdmin: boolean): WatchlistItem[] {
  return isAdmin ? watchlist : watchlist.filter((item) => item.library_state !== 'hidden' && item.library_state !== 'stopped');
}

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
  if (!episodes.some((episode) => episode.watched)) return 'To Watch';
  const { midSeason, keptUp } = currentSeasons(item, today);
  // Watching: part-way through a season, or keeping up with one as it airs.
  if (midSeason || keptUp) return 'Watching';
  const released = episodes.filter((episode) => airedBy(episode.release_date, date));
  if (released.every((episode) => episode.watched)) {
    const ended = ['Ended', 'Canceled', 'Cancelled'].includes(item.series_status ?? '');
    // An ended show's undated episode will never air and cannot be marked
    // one by one, so it must not hold the show off Completed.
    if (ended && released.length > 0 && episodes.every((episode) => episode.watched || !episode.release_date)) return 'Completed';
    return 'Caught up';
  }
  // Started, with aired episodes left, but in no season under way: at a
  // season boundary, or with only some seasons ticked. It waits on To watch
  // and says where it picks up (nextSeasonToWatch).
  return 'Between seasons';
}

/** How far ahead a next episode counts as keeping up, rather than a break. */
const KEEPING_UP_DAYS = 14;

/** True when a TMDB date has come out by the local calendar day `date`. */
const airedBy = (releaseDate: string | null | undefined, date: string) => !!releaseDate && releaseDate.slice(0, 10) <= date;

/**
 * The seasons behind Watching. A season is part-way through when it has a
 * watched episode and an aired one not watched. It is being kept up with
 * when it has a watched episode, every aired one watched, and its next
 * episode due within KEEPING_UP_DAYS; `keptUp` is the soonest such episode.
 * A longer wait is a break: the series is caught up, and its next episode
 * goes on Upcoming.
 */
function currentSeasons(item: WatchlistItem, today: Date): { midSeason: boolean; keptUp: NextRelease | null } {
  const date = isoDay(today);
  const limit = isoDay(new Date(today.getFullYear(), today.getMonth(), today.getDate() + KEEPING_UP_DAYS));
  let midSeason = false;
  let keptUp: NextRelease | null = null;
  for (const season of item.seasons ?? []) {
    if (season.season_number <= 0 || !season.episodes.some((episode) => episode.watched)) continue;
    if (season.episodes.some((episode) => !episode.watched && airedBy(episode.release_date, date))) {
      midSeason = true;
      continue;
    }
    for (const episode of season.episodes) {
      const day = episode.release_date?.slice(0, 10);
      if (episode.watched || !day || day <= date || day > limit) continue;
      if (!keptUp || day < keptUp.date) keptUp = { date: day, season: season.season_number, episode: episode.episode_number };
    }
  }
  return { midSeason, keptUp };
}

/**
 * Where a series between seasons picks up: the first season after the last
 * one with a watched episode that has an aired episode left, or failing that
 * the first season with one left. Null when nothing aired is left.
 */
export function nextSeasonToWatch(item: WatchlistItem, today = new Date()): number | null {
  const date = isoDay(today);
  const seasons = (item.seasons ?? []).filter((season) => season.season_number > 0).sort((a, b) => a.season_number - b.season_number);
  const left = seasons.filter((season) => season.episodes.some((episode) => !episode.watched && airedBy(episode.release_date, date)));
  const lastWatched = Math.max(0, ...seasons.filter((season) => season.episodes.some((episode) => episode.watched)).map((season) => season.season_number));
  return (left.find((season) => season.season_number > lastWatched) ?? left[0])?.season_number ?? null;
}


/**
 * The one shelf a title sits on. Status is the primary axis; films and
 * series share every shelf and are split by a separate type filter.
 *
 * - Watching: a series part-way through a season, or keeping up with one
 *   as it airs.
 * - To watch: released and not started, or a series between seasons with
 *   the next one out (or only some seasons ticked).
 * - Upcoming: nothing to watch until a dated release: a title not out yet,
 *   or the return of a series you are caught up on (a new season, or an
 *   episode after a break of more than KEEPING_UP_DAYS). When it comes out a
 *   new season puts the series on To watch, a returning episode on Watching.
 * - Up to date: a running series with every released episode watched and
 *   no next date known.
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
  // Waiting on a known date reads as upcoming, whether or not the series
  // was started; only an open-ended wait is Up to date.
  if (status === 'Caught up') return futureDates(item, today).length > 0 ? 'Upcoming' : 'Up to date';
  if (status === 'Watching') return 'Watching';
  if (status === 'Between seasons') return 'To watch';
  return isUnreleased(item, today) ? 'Upcoming' : 'To watch';
}

/** The soonest future air date, for ordering Upcoming. Null when none is known. */
export function nextAirDate(item: WatchlistItem, today = new Date()): string | null {
  const dates = futureDates(item, today).sort();
  return dates[0] ?? null;
}

/**
 * The release a title's countdown names: a film's release date, or a
 * series' soonest future season premiere or episode (specials excluded).
 * An episode 1, or an episode on its season's premiere date, reads as the
 * season. Dates compare as local calendar days, like the shelves, so a
 * release dated today has come out.
 */
export interface NextRelease {
  date: string;
  season?: number;
  episode?: number;
}

export function nextRelease(item: WatchlistItem, today = new Date(), withEpisodes = true): NextRelease | null {
  const date = isoDay(today);
  const day = (value?: string | null) => (value && value.slice(0, 10) > date ? value.slice(0, 10) : null);
  if (item.category === 'Movies') {
    const release = day(item.release_date);
    return release ? { date: release } : null;
  }
  const candidates: NextRelease[] = [];
  for (const season of item.seasons ?? []) {
    if (season.season_number <= 0) continue;
    const premiere = day(season.release_date);
    if (premiere) candidates.push({ date: premiere, season: season.season_number });
    for (const episode of season.episodes) {
      if (!withEpisodes && episode.episode_number !== 1) continue;
      const airs = day(episode.release_date);
      if (!airs) continue;
      const opensSeason = episode.episode_number === 1 || airs === premiere;
      candidates.push(opensSeason ? { date: airs, season: season.season_number } : { date: airs, season: season.season_number, episode: episode.episode_number });
    }
  }
  // Soonest first; on a shared date the season reads better than an episode.
  return candidates.reduce<NextRelease | null>(
    (best, candidate) =>
      !best || candidate.date < best.date || (candidate.date === best.date && best.episode !== undefined && candidate.episode === undefined)
        ? candidate
        : best,
    null,
  );
}

/** A NextRelease's day as a local-midnight Date, for display. */
export function releaseDay(release: NextRelease): Date {
  return new Date(`${release.date}T00:00:00`);
}

/**
 * The release a title's status pill counts down to. A series being kept up
 * with counts to its next episode; a series part-way through a season or
 * between seasons has something to watch now, so no countdown.
 */
export function countdownRelease(item: WatchlistItem, today = new Date()): NextRelease | null {
  const status = libraryStatus(item, today);
  if (status === 'Between seasons') return null;
  if (status === 'Watching') {
    const { midSeason, keptUp } = currentSeasons(item, today);
    return midSeason ? null : keptUp;
  }
  // A caught-up series counts to its return, which may be an episode after
  // a break; anything else to its release or next season premiere.
  return nextRelease(item, today, status === 'Caught up');
}

/**
 * A card's status pill: "Watching", "S5 next" for a series between seasons,
 * a countdown such as "S2E6 releases in 3 days", or the status itself.
 */
export function statusLabel(item: WatchlistItem, today = new Date()): string {
  const status = libraryStatus(item, today);
  if (status === 'Between seasons') {
    const season = nextSeasonToWatch(item, today);
    return season ? `S${season} next` : 'To Watch';
  }
  if (['Hidden', 'Stopped watching', 'Watched', 'Completed'].includes(status)) return status;
  const next = countdownRelease(item, today);
  if (status === 'Watching') return next ? releaseCountdown(next, today) : 'Watching';
  if (item.category === 'Movies') return next ? releaseCountdown(next, today) : 'Released';
  if (!item.seasons || item.seasons.length === 0) return 'Returning Series';
  return next ? releaseCountdown(next, today) : status;
}

/** The pill text, e.g. "S2E6 releases in 3 days", "S3 releases in 1 day", "releases in 9 days". */
export function releaseCountdown(release: NextRelease, today = new Date()): string {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const days = Math.round((releaseDay(release).getTime() - start.getTime()) / 86_400_000);
  const what = release.season === undefined ? '' : release.episode === undefined ? `S${release.season} ` : `S${release.season}E${release.episode} `;
  return `${what}releases in ${days} day${days === 1 ? '' : 's'}`;
}

export function matchesLibraryType(item: WatchlistItem, type: LibraryType): boolean {
  if (type === 'all') return true;
  return type === 'movie' ? item.category === 'Movies' : item.category === 'TV Shows';
}

/**
 * Old `?category=` slugs still land somewhere sensible: links to the former
 * TV Shows and Movies tabs open To watch with the matching type.
 */
export function shelfFromParam(param: string | null): { shelf: LibraryShelf; type?: LibraryType } | null {
  switch (param) {
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
