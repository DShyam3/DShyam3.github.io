/**
 * Annual-leave arithmetic and the shorthand used to enter it.
 *
 * Pure; see REHAUL_PLAN.md 7.I. Leave is entered as day shorthand — "3", or
 * "12-16", or "3 + 12-16" — which these functions parse, count and format.
 */

import { isWeekend, toISODate } from './dates';

export interface UserHoliday {
  id: string;
  startDate: string;
  endDate: string;
  occasion: string;
  count: number;
}

/** Expands day shorthand into individual day numbers. "3 + 12-14" -> [3,12,13,14]. */
export const parseDays = (datesStr: string): number[] => {
  if (!datesStr) return [];

  const days: number[] = [];
  for (const part of datesStr.split(/[+,;]/)) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    const range = trimmed.match(/^(\d+)\s*-\s*(\d+)$/);
    if (range) {
      const start = parseInt(range[1], 10);
      const end = parseInt(range[2], 10);
      if (start <= end) {
        for (let day = start; day <= end; day++) days.push(day);
      }
      continue;
    }

    const day = parseInt(trimmed, 10);
    if (!isNaN(day)) days.push(day);
  }
  return days;
};

/** The inverse of `parseDays`: collapses day numbers back into shorthand. */
export const formatDaysList = (days: number[]): string => {
  if (days.length === 0) return '';

  const sorted = [...days].sort((a, b) => a - b);
  const ranges: string[] = [];
  let start = sorted[0];
  let prev = sorted[0];

  for (let i = 1; i <= sorted.length; i++) {
    const current = sorted[i];
    if (current === prev + 1) {
      prev = current;
      continue;
    }
    ranges.push(start === prev ? String(start) : `${start}-${prev}`);
    start = current;
    prev = current;
  }
  return ranges.join(' + ');
};

/** How many days a single shorthand segment covers. "12-16" -> 5, "3" -> 1. */
export const parseEntryDays = (entry: string): number => {
  const clean = entry.trim();

  const range = clean.match(/^(\d+)\s*-\s*(\d+)$/);
  if (range) {
    const start = parseInt(range[1], 10);
    const end = parseInt(range[2], 10);
    if (end >= start) return end - start + 1;
  }

  return isNaN(parseInt(clean, 10)) ? 0 : 1;
};

/** Working days between two `YYYY-MM-DD` dates, inclusive, excluding weekends
 *  and bank holidays. Returns 0 for a missing, malformed or inverted range. */
export const calculateWorkingDaysInRange = (
  startStr: string,
  endStr: string,
  bankHolidays: string[],
): number => {
  if (!startStr || !endStr) return 0;

  const start = new Date(startStr);
  const end = new Date(endStr);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return 0;

  let count = 0;
  const current = new Date(start);
  while (current <= end) {
    if (!isWeekend(current) && !bankHolidays.includes(toISODate(current))) count++;
    current.setDate(current.getDate() + 1);
  }
  return count;
};

/** Which days of one month a set of holidays actually books off. Weekends and
 *  bank holidays inside a holiday range do not consume leave. */
export const getBookedDaysForMonth = (
  holidays: UserHoliday[],
  year: number,
  monthIdx: number,
  bankHolidays: string[],
): { day: number; occasion: string }[] => {
  const booked: { day: number; occasion: string }[] = [];

  for (const hol of holidays) {
    const start = new Date(hol.startDate);
    const end = new Date(hol.endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) continue;

    const current = new Date(start);
    while (current <= end) {
      const inMonth = current.getFullYear() === year && current.getMonth() === monthIdx;
      if (inMonth && !isWeekend(current) && !bankHolidays.includes(toISODate(current))) {
        booked.push({ day: current.getDate(), occasion: hol.occasion });
      }
      current.setDate(current.getDate() + 1);
    }
  }
  return booked;
};

/** Formats a holiday range for display, dropping the year where it is implied. */
export const formatHolidayDates = (startStr: string, endStr: string): string => {
  const start = new Date(startStr);
  const end = new Date(endStr);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return '';

  const withoutYear: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  const withYear: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: '2-digit' };

  if (startStr === endStr) return start.toLocaleDateString('en-GB', withYear);
  if (start.getFullYear() === end.getFullYear()) {
    return `${start.toLocaleDateString('en-GB', withoutYear)} - ${end.toLocaleDateString('en-GB', withYear)}`;
  }
  return `${start.toLocaleDateString('en-GB', withYear)} - ${end.toLocaleDateString('en-GB', withYear)}`;
};

/** The pre-`UserHoliday` storage shape: a map of month index to day shorthand. */
export type LegacyHolidayMap = Record<string, { dates?: string; count?: number; occasion?: string }>;

/**
 * Normalises stored leave into `UserHoliday[]`.
 *
 * Early versions stored leave as a month-keyed map of day shorthand; later
 * versions store a flat array. Both are still in the wild, so both are read.
 *
 * Legacy ids used to include `Date.now()`, which made them change on every
 * call. They are now derived from position, so they are stable across renders.
 */
export const normalizeHolidays = (
  stored: UserHoliday[] | LegacyHolidayMap | null | undefined,
  taxYear: number,
): UserHoliday[] => {
  if (!stored) return [];
  if (Array.isArray(stored)) return stored;

  const pad = (n: number) => String(n).padStart(2, '0');
  const list: UserHoliday[] = [];

  for (const [monthKey, val] of Object.entries(stored)) {
    const monthIdx = parseInt(monthKey, 10);
    if (isNaN(monthIdx) || !val?.dates || !val.count) continue;

    const segments = val.dates.split(/[,+]/).map(s => s.trim()).filter(Boolean);
    segments.forEach((seg, segIdx) => {
      const range = seg.match(/^(\d+)\s*-\s*(\d+)$/);
      let startDay = 1;
      let endDay = 1;

      if (range) {
        startDay = parseInt(range[1], 10);
        endDay = parseInt(range[2], 10);
      } else {
        const single = parseInt(seg, 10);
        if (!isNaN(single)) {
          startDay = single;
          endDay = single;
        }
      }

      list.push({
        id: `legacy-${monthIdx}-${segIdx}`,
        startDate: `${taxYear}-${pad(monthIdx + 1)}-${pad(startDay)}`,
        endDate: `${taxYear}-${pad(monthIdx + 1)}-${pad(endDay)}`,
        occasion: val.occasion || 'Leave',
        count: parseEntryDays(seg),
      });
    });
  }
  return list;
};
