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

/**
 * Days since 1970-01-01 for a real `YYYY-MM-DD` calendar date, or undefined for
 * anything else (a timestamp, a day that does not exist, a bad format). Read as
 * UTC midnight, so subtracting two of these counts calendar days whatever the
 * machine's timezone and however the clocks changed in between. Unlike the
 * local-time helpers above, this one does not move with the system zone.
 */
export const epochDay = (iso: string): number | undefined => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return undefined;
  const time = Date.parse(`${iso}T00:00:00Z`);
  if (!Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== iso) return undefined;
  return time / DAY_MS;
};

/** The `YYYY-MM-DD` date of an `epochDay` value (years 0000 to 9999). */
export const isoOfEpochDay = (day: number): string => new Date(day * DAY_MS).toISOString().slice(0, 10);
