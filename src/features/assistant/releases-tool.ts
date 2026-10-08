/**
 * `get_releases`: what in the watchlist comes out between two dates.
 *
 * Pure. `parseReleaseArgs` validates the model's arguments before anything is
 * read, so a bad range costs no request; `getReleases` filters and projects
 * the rows that came back.
 *
 * A season premiere is episode 1 of a real season, as on the Watchlist page
 * (`isPremiereEpisode`): it is counted as the season, not also as an episode,
 * and a season-0 special stays an episode. `tv_show_seasons.release_date` is
 * not read -- it carries the same date as episode 1, and reading both counted
 * every premiere twice.
 *
 * Today counts. The Watchlist page splits releases at today -- Upcoming reads
 * `release_date > today` and Out Now reads `<= today`, so a release on the day
 * itself sits in Out Now -- but a question names its own range and has no
 * second list to put today in. So the range here is closed at both ends, and
 * the filter is `filterByDayRange`, the same rule `filterUpcomingByWindow`
 * applies to its 7- and 30-day windows.
 */

import type { ToolSchema } from '@/lib/assistant/protocol';
import { toISODate } from '@/lib/finance/dates';
import { daysUntil, filterByDayRange, isPremiereEpisode } from '@/features/watchlist/watchlist-utils';

export type ReleaseKind = 'movie' | 'season' | 'episode';
export type ReleaseKindFilter = ReleaseKind | 'all';

/** A row as read: a film, or an episode. Premieres are worked out from episodes here. */
export interface ReleaseReadRow {
  kind: 'movie' | 'episode';
  title: string;
  date: string | null;
  platform: string | null;
  season: number | null;
  episode: number | null;
  episodeTitle: string | null;
}

export interface ReleaseRow {
  kind: ReleaseKind;
  /** The film's or the show's title. */
  title: string;
  /** YYYY-MM-DD. */
  date: string | null;
  platform: string | null;
  season: number | null;
  episode: number | null;
  episodeTitle: string | null;
}

export interface ReleaseArgs {
  from: string;
  to: string;
  kind: ReleaseKindFilter;
  /** Lower-cased words a title must contain, or null for every title. */
  title: string | null;
}

export interface ReleasesResult {
  from: string;
  to: string;
  kind: ReleaseKindFilter;
  title: string | null;
  /** Every release in range, before the list was capped. */
  total: number;
  counts: Record<ReleaseKind, number>;
  releases: ReleaseRow[];
}

export type ReleasesToolResult =
  | { tool: 'get_releases'; data: ReleasesResult }
  | { tool: 'get_releases'; error: string };

export const GET_RELEASES_SCHEMA = {
  name: 'get_releases',
  description:
    'Films, season premieres and episodes in the watchlist that release between two dates, '
    + 'both included. Use for "what comes out this year", "anything new this week" or "when is '
    + 'the next season of X" (pass title). A season counts once, on its premiere. Dates are '
    + 'YYYY-MM-DD; from defaults to today. counts and total are already tallied; never count the '
    + 'list yourself, since it is capped.',
  input_schema: {
    type: 'object',
    properties: {
      from: { type: 'string', description: 'First day, YYYY-MM-DD. Defaults to today.' },
      to: { type: 'string', description: 'Last day, YYYY-MM-DD, inclusive.' },
      kind: {
        type: 'string',
        enum: ['all', 'movie', 'season', 'episode'],
        description: 'Which releases to include. Defaults to all.',
      },
      title: { type: 'string', description: 'Optional part of a film or show title to look for.' },
    },
    required: ['to'],
  },
} as const satisfies ToolSchema;

/** Releases listed in full. `counts` and `total` still cover the whole range. */
export const MAX_RELEASES = 60;
/** A range longer than this is almost certainly a model's typo, and a big read. */
export const MAX_RELEASE_RANGE_DAYS = 400;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** A real calendar date: rejects 2026-02-30, which `new Date` would roll over. */
const isCalendarDate = (value: string): boolean => {
  if (!ISO_DATE.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(year, month - 1, day);
  return parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day;
};

const KINDS: readonly ReleaseKindFilter[] = ['all', 'movie', 'season', 'episode'];

export function parseReleaseArgs(
  input: Record<string, unknown>,
  today: Date,
): ReleaseArgs | { error: string } {
  const from = typeof input.from === 'string' && input.from.trim() !== '' ? input.from.trim() : toISODate(today);
  const to = typeof input.to === 'string' ? input.to.trim() : '';
  const kind = input.kind === undefined ? 'all' : input.kind;
  if (!isCalendarDate(from) || !isCalendarDate(to)) return { error: 'from and to must be YYYY-MM-DD dates' };
  if (to < from) return { error: 'to must not be before from' };
  const span = (daysUntil(to, today) ?? 0) - (daysUntil(from, today) ?? 0);
  if (span > MAX_RELEASE_RANGE_DAYS) return { error: `a range may cover at most ${MAX_RELEASE_RANGE_DAYS} days` };
  if (typeof kind !== 'string' || !KINDS.includes(kind as ReleaseKindFilter)) {
    return { error: 'kind must be all, movie, season or episode' };
  }
  const title = typeof input.title === 'string' && input.title.trim() !== '' ? input.title.trim().toLowerCase() : null;
  return { from, to, kind: kind as ReleaseKindFilter, title };
}

/** Which tables a range needs: films for movies, episodes for seasons and episodes. */
export const readsMovies = (args: ReleaseArgs): boolean => args.kind === 'all' || args.kind === 'movie';
export const readsEpisodes = (args: ReleaseArgs): boolean => args.kind !== 'movie';

/** Episode 1 of a real season becomes the season's premiere; everything else stays as read. */
const classify = (row: ReleaseReadRow): ReleaseRow => ({
  ...row,
  kind: row.kind === 'episode' && row.episode !== null && row.season !== null && isPremiereEpisode(row.episode, row.season)
    ? 'season'
    : row.kind,
});

const byDateThenTitle = (a: ReleaseRow, b: ReleaseRow): number =>
  (a.date ?? '').localeCompare(b.date ?? '')
  || a.title.localeCompare(b.title)
  || (a.season ?? 0) - (b.season ?? 0)
  || (a.episode ?? 0) - (b.episode ?? 0);

export function getReleases(args: ReleaseArgs, read: readonly ReleaseReadRow[], today: Date): ReleasesToolResult {
  const fromDays = daysUntil(args.from, today);
  const toDays = daysUntil(args.to, today);
  if (fromDays === null || toDays === null) return { tool: 'get_releases', error: 'from and to must be YYYY-MM-DD dates' };

  const rows = read.map(classify);
  const titled = args.title ? rows.filter(row => row.title.toLowerCase().includes(args.title as string)) : rows;
  const ofKind = args.kind === 'all' ? titled : titled.filter(row => row.kind === args.kind);
  const inRange = filterByDayRange(ofKind, fromDays, toDays, today).sort(byDateThenTitle);

  const counts: Record<ReleaseKind, number> = { movie: 0, season: 0, episode: 0 };
  for (const row of inRange) counts[row.kind] += 1;

  return {
    tool: 'get_releases',
    data: {
      from: args.from,
      to: args.to,
      kind: args.kind,
      title: args.title,
      total: inRange.length,
      counts,
      releases: inRange.slice(0, MAX_RELEASES).map(row => ({
        kind: row.kind,
        title: row.title,
        date: row.date,
        platform: row.platform,
        season: row.season,
        episode: row.episode,
        episodeTitle: row.episodeTitle,
      })),
    },
  };
}
