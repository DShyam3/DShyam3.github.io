/**
 * Calendar arithmetic shared across the finance feature.
 *
 * Everything here is pure and framework-free: no React, no Supabase, no DOM.
 * That is deliberate — see REHAUL_PLAN.md 7.I. These modules run in the
 * browser today and could run in a server process unchanged.
 */

/** `YYYY-MM-DD` in local time. `toISOString()` is not usable here: it converts
 *  to UTC first, which moves the date across midnight for negative offsets. */
export const toISODate = (date: Date): string => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

/** Saturday or Sunday. */
export const isWeekend = (date: Date): boolean => {
  const day = date.getDay();
  return day === 0 || day === 6;
};

/** Days in a month. `monthIndex` is 0-based, as `Date` uses it. */
export const getDaysInMonth = (year: number, monthIndex: number): number =>
  new Date(year, monthIndex + 1, 0).getDate();

/** Weekday the month opens on, Monday-first: 0 = Monday … 6 = Sunday. */
export const getStartDayOfWeek = (year: number, monthIndex: number): number => {
  const day = new Date(year, monthIndex, 1).getDay();
  return day === 0 ? 6 : day - 1;
};

const DAY_MS = 86_400_000;

/** Written as a calendar day, whether or not that day exists. */
const DAY_SHAPED = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Days since 1970-01-01 for a real `YYYY-MM-DD` calendar date, or undefined for
 * anything else (a timestamp, a day that does not exist, a bad format). Read as
 * UTC midnight, so subtracting two of these counts calendar days whatever the
 * machine's timezone and however the clocks changed in between. Unlike the
 * local-time helpers above, this one does not move with the system zone.
 */
export const epochDay = (iso: string): number | undefined => {
  if (!DAY_SHAPED.test(iso)) return undefined;
  const time = Date.parse(`${iso}T00:00:00Z`);
  if (!Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== iso) return undefined;
  return time / DAY_MS;
};

/**
 * Year, month (1-12), day and `epochDay` of a stored `YYYY-MM-DD`, read from the
 * string's own parts, or undefined for anything that is not a real calendar day
 * (what `epochDay` rejects). A stored date is a calendar day, not an instant:
 * `new Date(iso)` is UTC midnight, and a local getter then names the previous
 * day anywhere west of Greenwich. A bad date stays unknown here rather than
 * rolling into a neighbouring one.
 */
export const calendarParts = (
  iso: string,
): { year: number; month: number; day: number; epoch: number } | undefined => {
  const epoch = epochDay(iso);
  if (epoch === undefined) return undefined;
  return {
    year: Number(iso.slice(0, 4)),
    month: Number(iso.slice(5, 7)),
    day: Number(iso.slice(8, 10)),
    epoch,
  };
};

/**
 * The calendar day `on` names, as `calendarParts`, or undefined if it names
 * none. A `YYYY-MM-DD` string is that day. A `Date`, or any other string (a
 * timestamp), is an instant and is read at its local day, as `toISODate` does.
 * A day-shaped string that does not exist ("2026-02-30") is unknown rather than
 * handed to `new Date`, which would roll it into March.
 */
export const localCalendarDay = (
  on: Date | string,
): ReturnType<typeof calendarParts> => {
  if (typeof on === 'string' && DAY_SHAPED.test(on)) return calendarParts(on);
  const instant = typeof on === 'string' ? new Date(on) : on;
  return Number.isNaN(instant.getTime()) ? undefined : calendarParts(toISODate(instant));
};

/** The `YYYY-MM-DD` date of an `epochDay` value (years 0000 to 9999). */
export const isoOfEpochDay = (day: number): string => new Date(day * DAY_MS).toISOString().slice(0, 10);
