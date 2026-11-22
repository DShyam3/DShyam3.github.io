/**
 * Deterministic UK bank holiday computation and GOV.UK resolution helpers.
 *
 * Pure; see REHAUL_PLAN.md 7.I.
 */

import { calendarParts, getDaysInMonth, isoOfEpochDay } from './dates';
import { utcMidnight } from './holiday-core';

export type UkHolidayRegion = 'england-and-wales' | 'scotland' | 'northern-ireland';

export interface BankHolidayEvent {
  date: string;
  title: string;
}

/** Anonymous Gregorian algorithm (Meeus/Jones/Butcher) for Easter Sunday. */
const computeEasterSundayEpoch = (year: number): number => {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  const pad = (n: number) => String(n).padStart(2, '0');
  const parts = calendarParts(`${year}-${pad(month)}-${pad(day)}`);
  return parts ? parts.epoch : 0;
};

const firstMondayOfMonth = (year: number, month1Based: number): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  const firstIso = `${year}-${pad(month1Based)}-01`;
  const weekday = utcMidnight(firstIso).getUTCDay();
  const offset = (1 - weekday + 7) % 7;
  return `${year}-${pad(month1Based)}-${pad(1 + offset)}`;
};

const lastMondayOfMonth = (year: number, month1Based: number): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  const lastDay = getDaysInMonth(year, month1Based - 1);
  const lastIso = `${year}-${pad(month1Based)}-${pad(lastDay)}`;
  const weekday = utcMidnight(lastIso).getUTCDay();
  const offset = (weekday - 1 + 7) % 7;
  return `${year}-${pad(month1Based)}-${pad(lastDay - offset)}`;
};

const substituteWeekday = (iso: string, taken: Set<string>): string => {
  const parts = calendarParts(iso);
  if (!parts) return iso;
  let epoch = parts.epoch;
  while (true) {
    const candidate = isoOfEpochDay(epoch);
    const weekday = utcMidnight(candidate).getUTCDay();
    if (weekday !== 0 && weekday !== 6 && !taken.has(candidate)) {
      taken.add(candidate);
      return candidate;
    }
    epoch++;
  }
};

/** Deterministically computes official UK bank holidays for any calendar year. */
export const computeUkBankHolidaysForYear = (
  year: number,
  region: UkHolidayRegion = 'england-and-wales',
): BankHolidayEvent[] => {
  if (!Number.isInteger(year) || year < 1900 || year > 9999) return [];

  const taken = new Set<string>();
  const events: BankHolidayEvent[] = [];
  const addFixedWithSubstitute = (iso: string, title: string) => {
    const date = substituteWeekday(iso, taken);
    events.push({ date, title });
  };
  const addExact = (iso: string, title: string) => {
    taken.add(iso);
    events.push({ date: iso, title });
  };

  // 1. New Year's Day (+ 2nd January in Scotland)
  addFixedWithSubstitute(`${year}-01-01`, 'New Year’s Day');
  if (region === 'scotland') {
    addFixedWithSubstitute(`${year}-01-02`, '2nd January');
  }

  // 2. St Patrick's Day (Northern Ireland)
  if (region === 'northern-ireland') {
    addFixedWithSubstitute(`${year}-03-17`, 'St Patrick’s Day');
  }

  // 3. Good Friday & Easter Monday
  const easterEpoch = computeEasterSundayEpoch(year);
  addExact(isoOfEpochDay(easterEpoch - 2), 'Good Friday');
  if (region !== 'scotland') {
    addExact(isoOfEpochDay(easterEpoch + 1), 'Easter Monday');
  }

  // 4. Early May & Spring bank holidays
  addExact(firstMondayOfMonth(year, 5), 'Early May bank holiday');
  addExact(lastMondayOfMonth(year, 5), 'Spring bank holiday');

  // 5. Battle of the Boyne (Northern Ireland)
  if (region === 'northern-ireland') {
    addFixedWithSubstitute(`${year}-07-12`, 'Battle of the Boyne (Orangemen’s Day)');
  }

  // 6. Summer bank holiday (first Monday of August in Scotland, last Monday elsewhere)
  addExact(
    region === 'scotland' ? firstMondayOfMonth(year, 8) : lastMondayOfMonth(year, 8),
    'Summer bank holiday',
  );

  // 7. St Andrew's Day (Scotland)
  if (region === 'scotland') {
    addFixedWithSubstitute(`${year}-11-30`, 'St Andrew’s Day');
  }

  // 8. Christmas Day & Boxing Day
  addFixedWithSubstitute(`${year}-12-25`, 'Christmas Day');
  addFixedWithSubstitute(`${year}-12-26`, 'Boxing Day');

  return events.sort((a, b) => a.date.localeCompare(b.date));
};

/** Resolves bank holidays for `year`, preferring fetched GOV.UK dates when
 *  available for `year` and falling back to deterministic calculation. */
export const resolveBankHolidaysForYear = (
  year: number,
  region: UkHolidayRegion = 'england-and-wales',
  fetchedDates?: string[],
  fetchedMap?: Record<string, string>,
): { dates: string[]; map: Record<string, string> } => {
  const computed = computeUkBankHolidaysForYear(year, region);
  const computedMap: Record<string, string> = {};
  for (const ev of computed) {
    computedMap[ev.date] = ev.title;
  }

  const prefix = `${year}-`;
  const matchingFetched = (fetchedDates ?? []).filter(d => d.startsWith(prefix));
  if (matchingFetched.length > 0) {
    const dates = [...new Set(matchingFetched)].sort();
    const map: Record<string, string> = {};
    for (const d of dates) {
      map[d] = fetchedMap?.[d] || computedMap[d] || 'Bank Holiday';
    }
    return { dates, map };
  }

  return {
    dates: computed.map(e => e.date),
    map: computedMap,
  };
};

/** Past two years a range is a typo, not leave. */
export const MAX_LEAVE_RANGE_DAYS = 731;

/** Whether a `YYYY-MM-DD` range is one leave could cover: both ends valid and
 *  in order, from 1900, and at most `MAX_LEAVE_RANGE_DAYS` apart. A date field
 *  passes through years like 0002 while one is typed, and counting that range
 *  would walk two thousand years per keystroke. */
export const isCountableLeaveRange = (startIso: string, endIso: string): boolean => {
  const first = calendarParts(startIso);
  const last = calendarParts(endIso);
  return (
    !!first &&
    !!last &&
    first.year >= 1900 &&
    last.epoch >= first.epoch &&
    last.epoch - first.epoch <= MAX_LEAVE_RANGE_DAYS
  );
};

/** Bank holidays for every calendar year a `YYYY-MM-DD` range touches, so a
 *  range that crosses New Year also skips the next year's holidays. Each year
 *  prefers its own fetched GOV.UK dates and falls back to calculation, as
 *  `resolveBankHolidaysForYear` does, so `fetchedDates` may cover one year
 *  only. Returns [] for a missing, malformed or inverted range. */
export const resolveBankHolidaysForRange = (
  startIso: string,
  endIso: string,
  region: UkHolidayRegion = 'england-and-wales',
  fetchedDates?: string[],
): string[] => {
  const first = calendarParts(startIso);
  const last = calendarParts(endIso);
  if (!first || !last || last.epoch < first.epoch) return [];

  const dates = new Set<string>();
  for (let year = first.year; year <= last.year; year++) {
    for (const iso of resolveBankHolidaysForYear(year, region, fetchedDates).dates) {
      dates.add(iso);
    }
  }
  return [...dates].sort();
};
