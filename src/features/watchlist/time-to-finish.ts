import { daysUntil, formatRuntime, isSpecialsSeason } from './watchlist-utils';

/**
 * How long a show takes to finish from where it stands: the runtime of every
 * episode that has aired and is not yet watched. Computed from the rows the
 * library grid already holds, so the sort needs no extra read.
 *
 * Specials (season 0) never count: they are extras, not part of finishing a
 * show. Unaired episodes never count either: they cannot be watched yet, and
 * a weekly season would otherwise read as longer than what is on offer today.
 * A show or season with a season still airing cannot be finished at all yet,
 * so neither sort ranks it by the little that is out: see `airingSeason`.
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

export interface TimeToFinish {
  episodesLeft: number;
  /** Null when no episode of the show has a stored runtime to go on. */
  minutesLeft: number | null;
  /**
   * True when an episode counted here has no stored runtime and took the
   * show's median instead. TMDB lacks a runtime for about one episode in
   * thirteen, so leaving them out would rank a show as quicker than it is.
   */
  estimated: boolean;
  /**
   * The earliest regular season with an episode out and another dated after
   * today. Quickest to finish leaves such a show out: finishing it today
   * means catching up on a season mid-run, often one episode, not finishing
   * the show. A season with nothing out yet does not count -- what is out
   * is then whole seasons. The sync stores only episodes TMDB has dated, so
   * a season whose later episodes are still undated reads as complete; an
   * undated row, which only a hand edit could leave, is ignored rather than
   * holding a season open. Null when no season is mid-run.
   */
  airingSeason: number | null;
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
  let airingSeason: number | null = null;

  for (const season of regular) {
    let seasonAired = false;
    let seasonUnaired = false;
    for (const ep of season.episodes) {
      const age = daysUntil(ep.release_date, today);
      if (age === null) continue;
      if (age > 0) {
        seasonUnaired = true;
        continue;
      }
      airedEpisodes++;
      seasonAired = true;
      if (isWatched(season.season_number, ep.episode_number)) continue;
      episodesLeft++;
      if (hasRuntime(ep.runtime)) {
        minutes += ep.runtime;
      } else if (fallback !== null) {
        minutes += fallback;
        estimated = true;
      }
    }
    if (seasonAired && seasonUnaired) airingSeason ??= season.season_number;
  }

  return {
    episodesLeft,
    minutesLeft: fallback === null && episodesLeft > 0 ? null : minutes,
    estimated,
    airingSeason,
    airedEpisodes,
  };
};

/**
 * The season still airing that keeps the show from being finished, or null.
 * Only while something is left to watch: a viewer caught up on a season
 * mid-run is up to date.
 */
const airingBlock = (time: TimeToFinish): number | null =>
  time.episodesLeft > 0 ? time.airingSeason : null;

/**
 * Sort order, quickest first. Shows with a known time come first, by
 * minutes and then by episode count; then shows with episodes left but no
 * runtime to go on, by episode count; then shows held open by a season
 * still airing; then shows with nothing left to watch.
 * Returns 0 for a full tie so the caller can break it by title.
 */
export const compareTimeToFinish = (a: TimeToFinish, b: TimeToFinish): number => {
  const rank = (time: TimeToFinish): [number, number, number] => {
    if (airingBlock(time) !== null) return [2, 0, 0];
    if (time.episodesLeft === 0) return [3, 0, 0];
    if (time.minutesLeft === null) return [1, time.episodesLeft, 0];
    return [0, time.minutesLeft, time.episodesLeft];
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
 * or "6 eps · ~5h 10m". A tilde marks a total that includes an estimated
 * runtime.
 */
export const timeToFinishLabel = (time: TimeToFinish): string => {
  const airing = airingBlock(time);
  if (airing !== null) return `S${airing} still airing`;
  if (time.episodesLeft === 0) return time.airedEpisodes > 0 ? 'Up to date' : 'Not aired yet';
  const parts = [episodeCount(time.episodesLeft)];
  if (time.minutesLeft) {
    parts.push(`${time.estimated ? '~' : ''}${formatRuntime(time.minutesLeft)}`);
  }
  return parts.join(' · ');
};
