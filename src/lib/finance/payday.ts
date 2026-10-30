/**
 * When pay actually lands. Pure; see REHAUL_PLAN.md 7.I.
 *
 * UK employers pay on the last working day on or before the scheduled date, so
 * a payday falling on a weekend or bank holiday moves *backwards*.
 */

import type { FinanceSettings } from '@/features/finance/finance-types';
import { epochDay, isoOfEpochDay } from './dates';

type PaydaySchedule = NonNullable<FinanceSettings['paydaySchedule']>;

export interface PaydayOptions {
  payDayOfMonth?: number;
  /** 0 = Sunday .. 6 = Saturday. */
  weekday?: number;
  /** A past payday (YYYY-MM-DD) that fixes the fortnightly cycle. */
  biweeklyAnchor?: string;
}

/**
 * Where the fortnightly cycle counts from when none is set. Must equal
 * DEFAULT_BIWEEKLY_ANCHOR in features/finance/finance-defaults.ts; lib/ takes no
 * value imports from features/, so payday.test.ts pins the two together.
 */
const BIWEEKLY_ANCHOR_FALLBACK = '2026-01-02';

const DAY_MS = 86_400_000;

/** Days since the epoch for a UTC calendar date; a day of 0 is the previous month's last day. */
const utcDay = (year: number, monthIndex: number, day: number): number => {
  // setUTCFullYear keeps years 0000-0099, unlike Date.UTC.
  const date = new Date(0);
  date.setUTCFullYear(year, monthIndex, day);
  return date.getTime() / DAY_MS;
};

const weekdayOfDay = (day: number): number => new Date(day * DAY_MS).getUTCDay();

interface ActualPayday {
  day: number;
  /** Why the scheduled date moved: what its own day was, not what the last day stepped over was. Null if it did not move. */
  reason: 'weekend' | 'bank_holiday' | null;
}

/** Payday as paid: the scheduled date, moved back past weekends and bank holidays. */
const adjustBackwards = (day: number, holidays: ReadonlySet<string>): ActualPayday => {
  let current = day;
  let reason: ActualPayday['reason'] = null;
  for (;;) {
    const weekday = weekdayOfDay(current);
    const stepReason = weekday === 0 || weekday === 6 ? 'weekend' : holidays.has(isoOfEpochDay(current)) ? 'bank_holiday' : null;
    if (stepReason === null) return { day: current, reason };
    if (reason === null) reason = stepReason;
    current -= 1;
  }
};

/**
 * Every date the schedule targets between `lo` and `hi` (epoch days, inclusive),
 * before any weekend or holiday adjustment. Undefined when an option is
 * present but cannot place a date, so the caller reports "unknown" instead of
 * guessing. An unset option takes its default, a set but unusable one does not.
 */
const rawPaydays = (
  schedule: PaydaySchedule,
  opts: PaydayOptions,
  lo: number,
  hi: number,
): number[] | undefined => {
  const days: number[] = [];
  const loDate = new Date(lo * DAY_MS);
  const hiDate = new Date(hi * DAY_MS);
  const firstMonth = loDate.getUTCFullYear() * 12 + loDate.getUTCMonth();
  const lastMonth = hiDate.getUTCFullYear() * 12 + hiDate.getUTCMonth();
  const forEachMonth = (visit: (year: number, monthIndex: number, lastDay: number) => void): void => {
    for (let month = firstMonth; month <= lastMonth; month += 1) {
      const year = Math.floor(month / 12);
      const monthIndex = month - year * 12;
      visit(year, monthIndex, utcDay(year, monthIndex + 1, 0));
    }
  };

  if (schedule === 'monthly_date') {
    // 0, NaN and unset all mean the default 25th.
    const target = opts.payDayOfMonth || 25;
    if (!Number.isInteger(target) || target < 1) return undefined;
    forEachMonth((year, monthIndex, lastDay) => days.push(Math.min(utcDay(year, monthIndex, target), lastDay)));
  } else if (schedule === 'last_working_day') {
    forEachMonth((_year, _monthIndex, lastDay) => days.push(lastDay));
  } else if (schedule === 'last_friday') {
    forEachMonth((_year, _monthIndex, lastDay) => days.push(lastDay - (weekdayOfDay(lastDay) + 2) % 7));
  } else if (schedule === 'semimonthly') {
    forEachMonth((year, monthIndex, lastDay) => days.push(utcDay(year, monthIndex, 15), lastDay));
  } else if (schedule === 'weekly') {
    const weekday = opts.weekday ?? 5;
    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) return undefined;
    for (let day = lo + (weekday - weekdayOfDay(lo) + 7) % 7; day <= hi; day += 7) days.push(day);
  } else if (schedule === 'biweekly') {
    const anchor = epochDay(opts.biweeklyAnchor || BIWEEKLY_ANCHOR_FALLBACK);
    if (anchor === undefined) return undefined;
    // The cycle runs in both directions from the anchor; only parity matters.
    for (let day = anchor + Math.ceil((lo - anchor) / 14) * 14; day <= hi; day += 14) days.push(day);
  } else {
    // A schedule this module does not know places nothing.
    return undefined;
  }
  return days;
};

/**
 * The actual paydays in [fromDay, toDay] (epoch days), ascending, one per day.
 * Raw dates are generated a week either side, because a payday scheduled just
 * outside the range can be paid inside it.
 */
const actualPaydays = (
  schedule: PaydaySchedule,
  opts: PaydayOptions,
  fromDay: number,
  toDay: number,
  bankHolidays: readonly string[],
): ActualPayday[] => {
  const raw = rawPaydays(schedule, opts, fromDay - 7, toDay + 7);
  if (!raw) return [];
  const holidays = new Set(bankHolidays);
  const byDay = new Map<number, ActualPayday>();
  for (const day of raw) {
    const paid = adjustBackwards(day, holidays);
    if (paid.day >= fromDay && paid.day <= toDay && !byDay.has(paid.day)) byDay.set(paid.day, paid);
  }
  return [...byDay.values()].sort((a, b) => a.day - b.day);
};

/**
 * Every actual payday in [from, to], ascending and de-duplicated. Defaults:
 * monthly_date on the 25th, weekly on Friday, biweekly from 2026-01-02. A
 * payday on a weekend or bank holiday is paid on the last working day before
 * it, which can move it out of or into the range. A biweekly cycle runs
 * backwards from its anchor as well as forwards. Invalid dates, a schedule this
 * module does not know and unusable options give [].
 */
export const paydaysBetween = (
  schedule: FinanceSettings['paydaySchedule'],
  opts: PaydayOptions,
  from: string,
  to: string,
  bankHolidays: readonly string[],
): string[] => {
  const fromDay = epochDay(from);
  const toDay = epochDay(to);
  if (fromDay === undefined || toDay === undefined || fromDay > toDay) return [];
  return actualPaydays(schedule ?? 'monthly_date', opts, fromDay, toDay, bankHolidays).map(({ day }) => isoOfEpochDay(day));
};

export interface NextPayday {
  /** YYYY-MM-DD, the day the money lands. */
  date: string;
  /** True when the scheduled date was not a working day and the payday moved earlier. */
  adjusted: boolean;
  /** What the scheduled date itself was; null when it did not move. */
  adjustReason: 'weekend' | 'bank_holiday' | null;
}

/** Longer than any pay cycle plus the longest run of non-working days. */
const NEXT_PAYDAY_SEARCH_DAYS = 400;

/**
 * The first actual payday on or after `today`, and whether it moved from its
 * scheduled date: 'weekend' if that date was a Saturday or Sunday, else
 * 'bank_holiday'. Defaults and adjustment are those of paydaysBetween.
 * Undefined for an invalid `today`, a schedule this module does not know or
 * options that cannot place a date, so the caller decides what to show instead.
 */
export const nextPayday = (
  schedule: FinanceSettings['paydaySchedule'],
  opts: PaydayOptions,
  today: string,
  bankHolidays: readonly string[],
): NextPayday | undefined => {
  const todayDay = epochDay(today);
  if (todayDay === undefined) return undefined;
  const [first] = actualPaydays(schedule ?? 'monthly_date', opts, todayDay, todayDay + NEXT_PAYDAY_SEARCH_DAYS, bankHolidays);
  return first && { date: isoOfEpochDay(first.day), adjusted: first.reason !== null, adjustReason: first.reason };
};

/** How many paydays a year the schedule has. */
export const paydaysPerYear = (schedule: FinanceSettings['paydaySchedule']): number => {
  switch (schedule ?? 'monthly_date') {
    case 'semimonthly': return 24;
    case 'biweekly': return 26;
    case 'weekly': return 52;
    default: return 12;
  }
};
