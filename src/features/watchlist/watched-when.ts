/**
 * When something was watched: just now, on the release date, unknown, or a
 * picked day. A date-only value is stored as local noon so it stays on the same
 * calendar day in nearby zones.
 */

export type WatchedWhen =
  | { mode: 'now' }
  | { mode: 'release' }
  | { mode: 'unknown' }
  | { mode: 'at'; date: string };

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Strict YYYY-MM-DD and a real date (no 2026-02-30). */
export function isCalendarDate(value: string): boolean {
  const m = DATE_RE.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const probe = new Date(y, mo - 1, d, 12, 0, 0);
  return probe.getFullYear() === y && probe.getMonth() === mo - 1 && probe.getDate() === d;
}

export function localNoonIso(date: string): string {
  if (!isCalendarDate(date)) throw new Error(`Invalid calendar date: ${date}`);
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0).toISOString();
}

/** Both arguments must be valid dates; compared as strings. */
export function isOnOrBefore(date: string, today: string): boolean {
  return date <= today;
}

/** YYYY-MM-DD in the runtime's zone. */
export function todayLocal(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export interface SetWatchedArgs {
  p_kind: 'episode' | 'movie';
  p_ids: number[];
  p_watched: boolean;
  p_when: 'now' | 'release' | 'unknown' | 'at';
  p_at: string | null;
}

export function setWatchedArgs(
  kind: 'episode' | 'movie',
  ids: number[],
  watched: boolean,
  when: WatchedWhen,
): SetWatchedArgs {
  if (ids.length === 0) throw new Error('No ids to mark');
  if (ids.some((id) => !Number.isInteger(id) || id <= 0)) throw new Error('Ids must be positive integers');
  if (!watched) return { p_kind: kind, p_ids: ids, p_watched: false, p_when: 'now', p_at: null };
  return {
    p_kind: kind,
    p_ids: ids,
    p_watched: true,
    p_when: when.mode,
    p_at: when.mode === 'at' ? localNoonIso(when.date) : null,
  };
}

export function describeWatchedAt(
  iso: string | null | undefined,
  watched: boolean,
  locale?: string,
): string {
  if (!watched) return '';
  if (!iso) return 'Watched · date unknown';
  const text = new Intl.DateTimeFormat(locale ?? 'en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso));
  return `Watched ${text}`;
}
