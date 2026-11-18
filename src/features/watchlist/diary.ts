/**
 * The viewing diary: every dated watch grouped into local days, and within a
 * day into one row per show (a binge collapses to "S2 E1-E4") or per film.
 *
 * Pure arithmetic over the rows passed in. A watch with no date means
 * "watched, date unknown": it is counted as `undated` and appears in no day. A
 * record with no runtime adds 0 minutes and is counted in `unknownRuntime`, so
 * a total reads as "at least".
 */

export interface WatchRecord {
  kind: 'episode' | 'movie';
  /** tv_show_episodes.id or movies.id */
  id: number;
  /** ISO timestamp; null means watched, date unknown. */
  watchedAt: string | null;
  /** Minutes. */
  runtime: number | null;
  /** The show's or film's library id. */
  titleId: string;
  /** Show title or film title. */
  title: string;
  poster: string | null;
  /** Episodes only. */
  seasonNumber?: number;
  /** Episodes only. */
  episodeNumber?: number;
  episodeTitle?: string | null;
  genres: string[];
  /** The title is Hidden (owner-only): the page leaves it out for visitors. */
  hidden?: boolean;
  platform: string | null;
}

export interface DiaryRow {
  /** `${kind}:${titleId}:${day}` */
  key: string;
  kind: 'episode' | 'movie';
  titleId: string;
  title: string;
  poster: string | null;
  /** Episodes ascending by season, episode. */
  records: WatchRecord[];
  minutes: number;
  unknownRuntime: number;
  /** Episodes: compressed range, e.g. "S2 E1–E4". Films: ''. */
  label: string;
  /** Latest watchedAt in the row. */
  latestAt: string;
}

export interface DiaryDay {
  day: string;
  rows: DiaryRow[];
  minutes: number;
  unknownRuntime: number;
}

export interface Diary {
  days: DiaryDay[];
  undated: number;
  dated: number;
}

/** YYYY-MM-DD of an instant in `timeZone` (default: the runtime's zone). */
export function localDay(iso: string, timeZone?: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
}

/**
 * "S1 E1–E3, E5" for 1,2,3,5 of season 1; seasons are joined with " · ".
 * Only consecutive episode numbers within a season compress.
 */
export function episodeRangeLabel(
  episodes: { seasonNumber: number; episodeNumber: number }[],
): string {
  const bySeason = new Map<number, Set<number>>();
  for (const e of episodes) {
    const set = bySeason.get(e.seasonNumber) ?? new Set<number>();
    set.add(e.episodeNumber);
    bySeason.set(e.seasonNumber, set);
  }
  return [...bySeason.keys()]
    .sort((a, b) => a - b)
    .map((season) => {
      const numbers = [...(bySeason.get(season) ?? [])].sort((a, b) => a - b);
      const parts: string[] = [];
      let start = 0;
      for (let i = 1; i <= numbers.length; i++) {
        if (i === numbers.length || numbers[i] !== numbers[i - 1] + 1) {
          const first = numbers[start];
          const last = numbers[i - 1];
          parts.push(first === last ? `E${first}` : `E${first}–E${last}`);
          start = i;
        }
      }
      return `S${season} ${parts.join(', ')}`;
    })
    .join(' · ');
}

const time = (iso: string): number => Date.parse(iso);

function buildRow(kind: 'episode' | 'movie', day: string, records: WatchRecord[]): DiaryRow {
  const sorted =
    kind === 'episode'
      ? [...records].sort(
          (a, b) =>
            (a.seasonNumber ?? 0) - (b.seasonNumber ?? 0) ||
            (a.episodeNumber ?? 0) - (b.episodeNumber ?? 0),
        )
      : records;
  let latestAt = sorted[0].watchedAt as string;
  let minutes = 0;
  let unknownRuntime = 0;
  for (const r of sorted) {
    if (time(r.watchedAt as string) > time(latestAt)) latestAt = r.watchedAt as string;
    if (r.runtime === null) unknownRuntime += 1;
    else minutes += r.runtime;
  }
  const first = sorted[0];
  return {
    key: `${kind}:${first.titleId}:${day}`,
    kind,
    titleId: first.titleId,
    title: first.title,
    poster: first.poster,
    records: sorted,
    minutes,
    unknownRuntime,
    label:
      kind === 'episode'
        ? episodeRangeLabel(
            sorted.map((r) => ({
              seasonNumber: r.seasonNumber ?? 0,
              episodeNumber: r.episodeNumber ?? 0,
            })),
          )
        : '',
    latestAt,
  };
}

export function buildDiary(records: WatchRecord[], options: { timeZone?: string } = {}): Diary {
  const seen = new Set<string>();
  let undated = 0;
  let dated = 0;
  const groups = new Map<string, { kind: 'episode' | 'movie'; day: string; records: WatchRecord[] }>();

  for (const r of records) {
    const dedupeKey = `${r.kind}:${r.id}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    if (r.watchedAt === null || Number.isNaN(time(r.watchedAt))) {
      undated += 1;
      continue;
    }
    dated += 1;
    const day = localDay(r.watchedAt, options.timeZone);
    // Each film watch is its own row; a show's episodes on one day share one.
    const groupKey = r.kind === 'episode' ? `episode:${r.titleId}:${day}` : `movie:${r.id}:${day}`;
    const group = groups.get(groupKey) ?? { kind: r.kind, day, records: [] };
    group.records.push(r);
    groups.set(groupKey, group);
  }

  const byDay = new Map<string, DiaryRow[]>();
  for (const g of groups.values()) {
    const rows = byDay.get(g.day) ?? [];
    rows.push(buildRow(g.kind, g.day, g.records));
    byDay.set(g.day, rows);
  }

  const days: DiaryDay[] = [...byDay.entries()]
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([day, rows]) => {
      rows.sort(
        (a, b) => time(b.latestAt) - time(a.latestAt) || a.title.localeCompare(b.title),
      );
      return {
        day,
        rows,
        minutes: rows.reduce((sum, r) => sum + r.minutes, 0),
        unknownRuntime: rows.reduce((sum, r) => sum + r.unknownRuntime, 0),
      };
    });

  return { days, undated, dated };
}
