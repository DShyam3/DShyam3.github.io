import { localDay, type WatchRecord } from './diary';

/**
 * A year in review: arithmetic over the watch records of one local year.
 * Nothing is estimated. A watch with no date is reported as `undated` and never
 * bucketed; a record with no runtime adds 0 minutes and is counted in
 * `unknownRuntime`, so every total reads as "at least".
 */

export interface RatedThing {
  kind: 'movie' | 'season' | 'show';
  titleId: string;
  title: string;
  poster: string | null;
  seasonNumber?: number;
  /** 1..10 */
  rating: number;
}

export interface YearReview {
  year: number;
  totals: {
    minutes: number;
    episodes: number;
    episodeMinutes: number;
    films: number;
    filmMinutes: number;
    /** Distinct titleIds with at least one episode. */
    shows: number;
    /** Distinct local days with at least one record. */
    days: number;
    unknownRuntime: number;
  };
  /** Always 12 entries. */
  months: { month: number; minutes: number; episodes: number; films: number }[];
  topShows: { titleId: string; title: string; poster: string | null; episodes: number; minutes: number }[];
  genres: { genre: string; minutes: number; share: number }[];
  platforms: { platform: string; minutes: number }[];
  busiestDay: { day: string; minutes: number; records: number } | null;
  longestStreak: { days: number; start: string; end: string } | null;
  topRatedFilms: RatedThing[];
  topRatedSeasons: RatedThing[];
  /** Records with watchedAt null, across all years. */
  undated: number;
}

interface Dated {
  record: WatchRecord;
  day: string;
}

/** Dedupe by kind+id, then split into dated (with local day) and undated. */
function split(records: WatchRecord[], timeZone?: string): { dated: Dated[]; undated: number } {
  const seen = new Set<string>();
  const dated: Dated[] = [];
  let undated = 0;
  for (const record of records) {
    const key = `${record.kind}:${record.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (record.watchedAt === null || Number.isNaN(Date.parse(record.watchedAt))) {
      undated += 1;
    } else {
      dated.push({ record, day: localDay(record.watchedAt, timeZone) });
    }
  }
  return { dated, undated };
}

const yearOf = (day: string): number => Number(day.slice(0, 4));
const minutesOf = (r: WatchRecord): number => r.runtime ?? 0;
const byName = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** Calendar day number for a YYYY-MM-DD, DST-proof. */
function dayNumber(day: string): number {
  const [y, m, d] = day.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / 86_400_000;
}

/** Years that have at least one dated record, newest first. */
export function yearsWithData(records: WatchRecord[], timeZone?: string): number[] {
  const years = new Set(split(records, timeZone).dated.map((d) => yearOf(d.day)));
  return [...years].sort((a, b) => b - a);
}

export function buildYearReview(input: {
  records: WatchRecord[];
  ratings: RatedThing[];
  year: number;
  timeZone?: string;
}): YearReview {
  const { year } = input;
  const { dated, undated } = split(input.records, input.timeZone);
  const inYear = dated.filter((d) => yearOf(d.day) === year);

  const totals = {
    minutes: 0,
    episodes: 0,
    episodeMinutes: 0,
    films: 0,
    filmMinutes: 0,
    shows: 0,
    days: 0,
    unknownRuntime: 0,
  };
  const months = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, minutes: 0, episodes: 0, films: 0 }));
  const shows = new Map<string, { titleId: string; title: string; poster: string | null; episodes: number; minutes: number }>();
  const genreMinutes = new Map<string, number>();
  const platformMinutes = new Map<string, number>();
  const dayStats = new Map<string, { minutes: number; records: number }>();

  for (const { record: r, day } of inYear) {
    const minutes = minutesOf(r);
    totals.minutes += minutes;
    if (r.runtime === null) totals.unknownRuntime += 1;

    const month = months[Number(day.slice(5, 7)) - 1];
    month.minutes += minutes;

    if (r.kind === 'episode') {
      totals.episodes += 1;
      totals.episodeMinutes += minutes;
      month.episodes += 1;
      const show = shows.get(r.titleId) ?? { titleId: r.titleId, title: r.title, poster: r.poster, episodes: 0, minutes: 0 };
      show.episodes += 1;
      show.minutes += minutes;
      shows.set(r.titleId, show);
    } else {
      totals.films += 1;
      totals.filmMinutes += minutes;
      month.films += 1;
    }

    const genres = [...new Set(r.genres)];
    const shared = genres.length > 0 ? genres : ['Unknown'];
    for (const genre of shared) {
      genreMinutes.set(genre, (genreMinutes.get(genre) ?? 0) + minutes / shared.length);
    }

    const platform = r.platform ?? 'Unknown';
    platformMinutes.set(platform, (platformMinutes.get(platform) ?? 0) + minutes);

    const stat = dayStats.get(day) ?? { minutes: 0, records: 0 };
    stat.minutes += minutes;
    stat.records += 1;
    dayStats.set(day, stat);
  }

  totals.shows = shows.size;
  totals.days = dayStats.size;

  const topShows = [...shows.values()]
    .sort((a, b) => b.minutes - a.minutes || b.episodes - a.episodes || byName(a.title, b.title))
    .slice(0, 5);

  const genres = [...genreMinutes.entries()]
    .map(([genre, minutes]) => ({
      genre,
      minutes,
      share: totals.minutes > 0 ? minutes / totals.minutes : 0,
    }))
    .sort((a, b) => b.minutes - a.minutes || byName(a.genre, b.genre))
    .slice(0, 6);

  const platforms = [...platformMinutes.entries()]
    .map(([platform, minutes]) => ({ platform, minutes }))
    .sort((a, b) => b.minutes - a.minutes || byName(a.platform, b.platform));

  const sortedDays = [...dayStats.keys()].sort(byName);

  let busiestDay: YearReview['busiestDay'] = null;
  for (const day of sortedDays) {
    const stat = dayStats.get(day) as { minutes: number; records: number };
    if (busiestDay === null || stat.minutes > busiestDay.minutes) {
      busiestDay = { day, minutes: stat.minutes, records: stat.records };
    }
  }

  let longestStreak: YearReview['longestStreak'] = null;
  let runStart = 0;
  for (let i = 1; i <= sortedDays.length; i++) {
    if (i === sortedDays.length || dayNumber(sortedDays[i]) !== dayNumber(sortedDays[i - 1]) + 1) {
      const length = i - runStart;
      if (length > 0 && (longestStreak === null || length > longestStreak.days)) {
        longestStreak = { days: length, start: sortedDays[runStart], end: sortedDays[i - 1] };
      }
      runStart = i;
    }
  }

  const watchedFilms = new Set(inYear.filter((d) => d.record.kind === 'movie').map((d) => d.record.titleId));
  const watchedSeasons = new Set(
    inYear
      .filter((d) => d.record.kind === 'episode')
      .map((d) => `${d.record.titleId}:${d.record.seasonNumber ?? 0}`),
  );
  const rank = (a: RatedThing, b: RatedThing): number => b.rating - a.rating || byName(a.title, b.title);

  const topRatedFilms = input.ratings
    .filter((r) => r.kind === 'movie' && watchedFilms.has(r.titleId))
    .sort(rank)
    .slice(0, 5);
  const topRatedSeasons = input.ratings
    .filter((r) => r.kind === 'season' && watchedSeasons.has(`${r.titleId}:${r.seasonNumber ?? 0}`))
    .sort(rank)
    .slice(0, 5);

  return {
    year,
    totals,
    months,
    topShows,
    genres,
    platforms,
    busiestDay,
    longestStreak,
    topRatedFilms,
    topRatedSeasons,
    undated,
  };
}
