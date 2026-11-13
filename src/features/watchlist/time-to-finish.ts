import { daysUntil, formatRuntime, isSpecialsSeason } from './watchlist-utils';

/**
 * How long a show takes to finish from where it stands: the runtime of every
 * episode that has aired and is not yet watched. Computed from the rows the
 * library grid already holds, so the sort needs no extra read.
 *
 * Specials (season 0) never count: they are extras, not part of finishing a
 * show. Unaired episodes never count either: they cannot be watched yet, and
 * a weekly season would otherwise read as longer than what is on offer today.
 */

/** The columns this needs, a subset of a `tv_show_episodes` row. */
export interface FinishEpisode {
  episode_number: number;
  runtime?: number | null;
  release_date?: string | null;
}

export interface FinishSeason {
  season_number: number;
  episodes: FinishEpisode[];
}

export interface FinishRemaining {
  episodesLeft: number;
  /** Null when no episode of the show has a stored runtime to go on. */
  minutesLeft: number | null;
  /**
   * True when an episode counted here has no stored runtime and took the
   * show's median instead. TMDB lacks a runtime for about one episode in
   * thirteen, so leaving them out would rank a show as quicker than it is.
   */
  estimated: boolean;
}

export interface TimeToFinish extends FinishRemaining {
  /** The earliest season with an aired, unwatched episode. Null when none. */
  nextSeason: (FinishRemaining & {
    seasonNumber: number;
    /**
     * The season has a stored episode dated after today. Quickest season
     * leaves such a season out: finishing it today means only the episodes
     * out so far, often one, which is not a season to sit down to. The sync
     * stores only episodes TMDB has dated, so a season whose later episodes
     * are still undated reads as complete; an undated row, which only a hand
     * edit could leave, is ignored rather than holding a season open.
     */
    stillAiring: boolean;
  }) | null;
  /**
   * Aired regular episodes, watched or not. Zero means nothing has aired (or
   * no episode rows are stored), which is not the same as being up to date.
   */
  airedEpisodes: number;
}

/** The middle known runtime, rounded to the minute; null when none is known. */
const medianRuntime = (runtimes: number[]): number | null => {
  if (runtimes.length === 0) return null;
  const sorted = [...runtimes].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[mid]
    : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
};

const hasRuntime = (runtime: number | null | undefined): runtime is number =>
  typeof runtime === 'number' && runtime > 0;

export const timeToFinish = (
  seasons: FinishSeason[] | undefined,
  isWatched: (seasonNumber: number, episodeNumber: number) => boolean,
  today: Date,
): TimeToFinish => {
  const regular = [...(seasons ?? [])]
    .filter((season) => !isSpecialsSeason(season.season_number))
    .sort((a, b) => a.season_number - b.season_number);

  const fallback = medianRuntime(
    regular.flatMap((season) =>
      season.episodes.map((ep) => ep.runtime).filter(hasRuntime),
    ),
  );

  let airedEpisodes = 0;
  let episodesLeft = 0;
  let minutes = 0;
  let estimated = false;
  let nextSeason: TimeToFinish['nextSeason'] = null;

  for (const season of regular) {
    let seasonEpisodes = 0;
    let seasonMinutes = 0;
    let seasonEstimated = false;
    let seasonUnaired = false;
    for (const ep of season.episodes) {
      const age = daysUntil(ep.release_date, today);
      if (age === null) continue;
      if (age > 0) {
        seasonUnaired = true;
        continue;
      }
      airedEpisodes++;
      if (isWatched(season.season_number, ep.episode_number)) continue;
      seasonEpisodes++;
      if (hasRuntime(ep.runtime)) {
        seasonMinutes += ep.runtime;
      } else if (fallback !== null) {
        seasonMinutes += fallback;
        seasonEstimated = true;
      }
    }
    if (seasonEpisodes === 0) continue;
    episodesLeft += seasonEpisodes;
    minutes += seasonMinutes;
    estimated ||= seasonEstimated;
    nextSeason ??= {
      seasonNumber: season.season_number,
      episodesLeft: seasonEpisodes,
      minutesLeft: fallback === null ? null : seasonMinutes,
      estimated: seasonEstimated,
      stillAiring: seasonUnaired,
    };
  }

  return {
    episodesLeft,
    minutesLeft: fallback === null && episodesLeft > 0 ? null : minutes,
    nextSeason,
    estimated,
    airedEpisodes,
  };
};

/** Whole show, or only the season to watch next. */
export type FinishScope = 'show' | 'season';

const remainingFor = (
  time: TimeToFinish,
  scope: FinishScope,
): FinishRemaining | null => {
  if (scope === 'show') return time.episodesLeft > 0 ? time : null;
  return time.nextSeason && !time.nextSeason.stillAiring ? time.nextSeason : null;
};

/**
 * Sort order, quickest first. Shows with a known time come first, by
 * minutes and then by episode count; then shows with episodes left but no
 * runtime to go on, by episode count; in season scope, then shows whose
 * next season is still airing; then shows with nothing left to watch.
 * Returns 0 for a full tie so the caller can break it by title.
 */
export const compareTimeToFinish = (
  a: TimeToFinish,
  b: TimeToFinish,
  scope: FinishScope,
): number => {
  const rank = (time: TimeToFinish): [number, number, number] => {
    const left = remainingFor(time, scope);
    if (!left) return scope === 'season' && time.nextSeason?.stillAiring ? [2, 0, 0] : [3, 0, 0];
    if (left.minutesLeft === null) return [1, left.episodesLeft, 0];
    return [0, left.minutesLeft, left.episodesLeft];
  };
  const ra = rank(a);
  const rb = rank(b);
  for (let i = 0; i < ra.length; i++) {
    if (ra[i] !== rb[i]) return ra[i] - rb[i];
  }
  return 0;
};

const episodeCount = (count: number) => `${count} ${count === 1 ? 'ep' : 'eps'}`;

/**
 * The card line for a show sorted by time to finish, e.g. "8 eps · 6h 40m"
 * or "S2 · 6 eps · ~5h 10m". A tilde marks a total that includes an
 * estimated runtime.
 */
export const timeToFinishLabel = (
  time: TimeToFinish,
  scope: FinishScope,
): string => {
  if (scope === 'season' && time.nextSeason?.stillAiring) {
    return `S${time.nextSeason.seasonNumber} still airing`;
  }
  const left = remainingFor(time, scope);
  if (!left) return time.airedEpisodes > 0 ? 'Up to date' : 'Not aired yet';
  const parts = [episodeCount(left.episodesLeft)];
  if (scope === 'season' && time.nextSeason) {
    parts.unshift(`S${time.nextSeason.seasonNumber}`);
  }
  if (left.minutesLeft) {
    parts.push(`${left.estimated ? '~' : ''}${formatRuntime(left.minutesLeft)}`);
  }
  return parts.join(' · ');
};
