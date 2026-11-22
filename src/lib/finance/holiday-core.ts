/**
 * Annual-leave arithmetic and the shorthand used to enter it.
 *
 * Pure; see REHAUL_PLAN.md 7.I. Leave is entered as day shorthand — "3", or
 * "12-16", or "3 + 12-16" — which these functions parse, count and format.
 */

import { calendarParts, getDaysInMonth, isoOfEpochDay } from './dates';

export type LeaveType = 'holiday' | 'sick' | 'birthday';

export type BirthdayLeaveRule =
  | 'exact_or_nearest'
  | 'within_week'
  | 'birthday_month'
  | 'within_month'
  | 'anytime';

export interface BirthdayDate {
  /** 1-based month (1 = January .. 12 = December). */
  month: number;
  /** 1-based day of month (1..31). */
  day: number;
}

export const BIRTHDAY_LEAVE_RULES: readonly BirthdayLeaveRule[] = [
  'exact_or_nearest',
  'within_week',
  'birthday_month',
  'within_month',
  'anytime',
];

export const BIRTHDAY_LEAVE_RULE_LABELS: Record<
  BirthdayLeaveRule,
  { label: string; shortLabel: string; description: string }
> = {
  exact_or_nearest: {
    label: 'On birthday (or nearest working day)',
    shortLabel: 'On day / nearest',
    description: 'Taken on your birthday, or the nearest working day before or after when it falls on a weekend or bank holiday.',
  },
  within_week: {
    label: 'Within ±1 week of birthday',
    shortLabel: '±1 week',
    description: 'Any working day within 7 calendar days before or after your birthday.',
  },
  birthday_month: {
    label: 'Within birthday calendar month',
    shortLabel: 'Birthday month',
    description: 'Any working day during the calendar month of your birthday.',
  },
  within_month: {
    label: 'Within ±30 days of birthday',
    shortLabel: '±30 days',
    description: 'Any working day within 30 calendar days before or after your birthday.',
  },
  anytime: {
    label: 'Floating day (any time in year)',
    shortLabel: 'Any time in year',
    description: 'A flexible extra day off that can be booked on any working day in the leave year.',
  },
};

/** Which half of a single day is taken: the morning or the afternoon. */
export type HalfDay = 'am' | 'pm';

export interface UserHoliday {
  id: string;
  startDate: string;
  endDate: string;
  occasion: string;
  count: number;
  type?: LeaveType;
  /** Set only for a half day; absent for a full day or a range. */
  halfDay?: HalfDay;
}

/** What a half day of leave costs against the allowance. */
export const HALF_DAY = 0.5;

/** A half day is a single-date entry marked morning or afternoon. The database
 *  also holds its count to `HALF_DAY`; a range is never a half day. */
export const isHalfDay = (holiday: Pick<UserHoliday, 'startDate' | 'endDate' | 'halfDay'>): boolean =>
  !!holiday.halfDay && holiday.startDate === holiday.endDate;

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

/** UTC midnight of a `YYYY-MM-DD` already checked by `calendarParts`. Read it
 *  with the UTC getters or `timeZone: 'UTC'` only; the local ones move with the
 *  zone. */
export const utcMidnight = (iso: string): Date => new Date(`${iso}T00:00:00Z`);

export interface CalendarDay {
  iso: string;
  year: number;
  /** 0-based, as `Date` uses it. */
  monthIdx: number;
  day: number;
  weekend: boolean;
}

/**
 * Each calendar day from `startStr` to `endStr`, inclusive. Nothing is yielded
 * for a range that is inverted or has an end that is not a real `YYYY-MM-DD`.
 *
 * A stored date is a calendar day, not an instant. It is stepped as a whole-day
 * number and read back as that day's own fields, so the machine's timezone and
 * any clock change between the two dates cannot move it onto a neighbour.
 */
export function* calendarDays(startStr: string, endStr: string): Generator<CalendarDay> {
  const first = calendarParts(startStr);
  const last = calendarParts(endStr);
  if (!first || !last) return;

  for (let epoch = first.epoch; epoch <= last.epoch; epoch++) {
    const iso = isoOfEpochDay(epoch);
    const parts = calendarParts(iso);
    // Always a real day: `epoch` lies between two that were just validated.
    if (!parts) continue;
    const weekday = utcMidnight(iso).getUTCDay();
    yield {
      iso,
      year: parts.year,
      monthIdx: parts.month - 1,
      day: parts.day,
      weekend: weekday === 0 || weekday === 6,
    };
  }
}

export interface LeaveRangeSummary {
  /** Weekdays in the range that are not bank holidays. */
  workingDays: number;
  /** Saturdays and Sundays in the range. */
  weekendDays: number;
  /** Bank holidays in the range that fall on a weekday, ascending. */
  bankHolidayDates: string[];
}

/** What a `YYYY-MM-DD` range is made of, for explaining a leave count: working
 *  days, weekend days, and the weekday bank holidays it skips. A bank holiday
 *  on a weekend counts once, as a weekend day. `workingDays` is what
 *  `calculateWorkingDaysInRange` returns. Everything is 0 or empty for a
 *  missing, malformed or inverted range. */
export const summariseLeaveRange = (
  startStr: string,
  endStr: string,
  bankHolidays: string[],
): LeaveRangeSummary => {
  const holidays = new Set(bankHolidays);
  let workingDays = 0;
  let weekendDays = 0;
  // Days arrive once each and in order, so this is already ascending and unique.
  const bankHolidayDates: string[] = [];
  for (const current of calendarDays(startStr, endStr)) {
    if (current.weekend) weekendDays++;
    else if (holidays.has(current.iso)) bankHolidayDates.push(current.iso);
    else workingDays++;
  }
  return { workingDays, weekendDays, bankHolidayDates };
};

/** Working days between two `YYYY-MM-DD` dates, inclusive, excluding weekends
 *  and bank holidays. Returns 0 for a missing, malformed or inverted range.
 *  Shares `summariseLeaveRange`'s single pass, which looks each holiday up in a
 *  `Set`: a long range against a multi-year list stays linear in the days. */
export const calculateWorkingDaysInRange = (
  startStr: string,
  endStr: string,
  bankHolidays: string[],
): number => summariseLeaveRange(startStr, endStr, bankHolidays).workingDays;

export interface BookedDay {
  day: number;
  occasion: string;
  type: LeaveType;
  /** How much of the day is taken: 1, or `HALF_DAY` for a half day. */
  fraction: number;
  /** Which half, for a half day. */
  halfDay?: HalfDay;
}

/** Which days of one month a set of holidays actually books off. Weekends and
 *  bank holidays inside a holiday range do not consume leave. When a single-day
 *  birthday leave entry falls inside a multi-day holiday range, that day is
 *  attributed to `'birthday'` rather than duplicated as holiday or sick leave.
 *  Half-day birthday entries replace only the matching half. */
export const getBookedDaysForMonth = (
  holidays: UserHoliday[],
  year: number,
  monthIdx: number,
  bankHolidays: string[],
): BookedDay[] => {
  const booked: BookedDay[] = [];
  const birthdayHalves = new Map<string, Set<HalfDay>>();

  for (const hol of holidays) {
    if (hol.type !== 'birthday') continue;
    for (const current of calendarDays(hol.startDate, hol.endDate)) {
      const inMonth = current.year === year && current.monthIdx === monthIdx;
      if (inMonth && !current.weekend && !bankHolidays.includes(current.iso)) {
        const halves = birthdayHalves.get(current.iso) ?? new Set<HalfDay>();
        for (const half of isHalfDay(hol) ? [hol.halfDay!] : ['am', 'pm'] as const) halves.add(half);
        birthdayHalves.set(current.iso, halves);
      }
    }
  }

  for (const hol of holidays) {
    const leaveType: LeaveType = hol.type || 'holiday';
    const halfDay = isHalfDay(hol) ? hol.halfDay : undefined;
    const fraction = halfDay ? HALF_DAY : 1;
    for (const current of calendarDays(hol.startDate, hol.endDate)) {
      const inMonth = current.year === year && current.monthIdx === monthIdx;
      if (inMonth && !current.weekend && !bankHolidays.includes(current.iso)) {
        const birthdayCoverage = birthdayHalves.get(current.iso);
        if (leaveType !== 'birthday' && birthdayCoverage) {
          const remaining = (halfDay ? [halfDay] : ['am', 'pm'] as const)
            .filter(half => !birthdayCoverage.has(half));
          if (remaining.length === 0) continue;
          if (remaining.length === 1) {
            booked.push({ day: current.day, occasion: hol.occasion, type: leaveType, fraction: HALF_DAY, halfDay: remaining[0] });
            continue;
          }
        }
        booked.push({ day: current.day, occasion: hol.occasion, type: leaveType, fraction, ...(halfDay ? { halfDay } : {}) });
      }
    }
  }
  return booked;
};

/** Formats a holiday range for display, dropping the year where it is implied. */
export const formatHolidayDates = (startStr: string, endStr: string): string => {
  const first = calendarParts(startStr);
  const last = calendarParts(endStr);
  if (!first || !last) return '';
  const start = utcMidnight(startStr);
  const end = utcMidnight(endStr);

  // `timeZone: 'UTC'` because the dates are UTC midnights: formatting them in
  // the local zone would print the previous day anywhere west of Greenwich.
  const withoutYear: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', timeZone: 'UTC' };
  const withYear: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: '2-digit', timeZone: 'UTC' };

  if (startStr === endStr) return start.toLocaleDateString('en-GB', withYear);
  if (first.year === last.year) {
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

    // The shorthand is free text, so "27-30" can be typed for February. A
    // range running past the month's end stops at its last day, and a segment
    // that starts past it names no real day and is dropped rather than booked
    // on a day nobody typed. Left as written, the strict day reader would book
    // nothing for the whole range. Only the real days are booked; `count`
    // stays as typed.
    const lastDayOfMonth = getDaysInMonth(taxYear, monthIdx);
    const withinMonth = (day: number): number => Math.min(day, lastDayOfMonth);

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

      if (startDay > lastDayOfMonth) return;

      list.push({
        id: `legacy-${monthIdx}-${segIdx}`,
        startDate: `${taxYear}-${pad(monthIdx + 1)}-${pad(withinMonth(startDay))}`,
        endDate: `${taxYear}-${pad(monthIdx + 1)}-${pad(withinMonth(endDay))}`,
        occasion: val.occasion || 'Leave',
        count: parseEntryDays(seg),
      });
    });
  }
  return list;
};

/** Resolves a `{ month, day }` birthday into `YYYY-MM-DD` for `year`, clamping
 *  29 Feb to 28 Feb in non-leap years and returning `null` for invalid dates. */
export const resolveBirthdayInYear = (
  year: number,
  birthday?: BirthdayDate | null,
): string | null => {
  if (
    !birthday ||
    !Number.isInteger(year) ||
    year < 1900 ||
    year > 9999 ||
    !Number.isInteger(birthday.month) ||
    !Number.isInteger(birthday.day) ||
    birthday.month < 1 ||
    birthday.month > 12 ||
    birthday.day < 1
  ) {
    return null;
  }

  const maxEverInMonth = getDaysInMonth(2024, birthday.month - 1);
  if (birthday.day > maxEverInMonth) return null;

  const clampedDay = Math.min(birthday.day, getDaysInMonth(year, birthday.month - 1));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${year}-${pad(birthday.month)}-${pad(clampedDay)}`;
};

export interface BirthdayLeaveWindow {
  /** The resolved birthday in `year` (`YYYY-MM-DD`), or `null` if no valid birthday is configured. */
  birthdayIso: string | null;
  /** First calendar day of the window (`YYYY-MM-DD`). */
  startIso: string;
  /** Last calendar day of the window (`YYYY-MM-DD`). */
  endIso: string;
  /** Working days (`YYYY-MM-DD`, excluding weekends and `bankHolidays`) on which the birthday day off may be booked. */
  eligibleDates: string[];
}

export const getBirthdayLeaveWindow = (
  year: number,
  rule: BirthdayLeaveRule,
  birthday: BirthdayDate | null | undefined,
  bankHolidays: string[],
): BirthdayLeaveWindow | null => {
  if (!Number.isInteger(year) || year < 1900 || year > 9999) return null;

  const birthdayIso = resolveBirthdayInYear(year, birthday);

  const isWorkingIso = (iso: string): boolean => {
    if (!calendarParts(iso)) return false;
    const weekday = utcMidnight(iso).getUTCDay();
    if (weekday === 0 || weekday === 6) return false;
    return !bankHolidays.includes(iso);
  };

  const workingDaysInRange = (startIso: string, endIso: string): string[] => {
    const days: string[] = [];
    for (const current of calendarDays(startIso, endIso)) {
      if (!current.weekend && !bankHolidays.includes(current.iso)) {
        days.push(current.iso);
      }
    }
    return days;
  };

  const yearStartIso = `${year}-01-01`;
  const yearEndIso = `${year}-12-31`;
  const clampToYear = (iso: string): string => {
    if (iso < yearStartIso) return yearStartIso;
    if (iso > yearEndIso) return yearEndIso;
    return iso;
  };

  if (rule === 'anytime') {
    return {
      birthdayIso,
      startIso: yearStartIso,
      endIso: yearEndIso,
      eligibleDates: workingDaysInRange(yearStartIso, yearEndIso),
    };
  }

  if (!birthdayIso) return null;
  const bdayParts = calendarParts(birthdayIso);
  if (!bdayParts) return null;

  if (rule === 'exact_or_nearest') {
    if (isWorkingIso(birthdayIso)) {
      return {
        birthdayIso,
        startIso: birthdayIso,
        endIso: birthdayIso,
        eligibleDates: [birthdayIso],
      };
    }

    let prevWorking: string | undefined;
    for (let offset = 1; offset <= 10; offset++) {
      const candidate = isoOfEpochDay(bdayParts.epoch - offset);
      if (candidate >= yearStartIso && isWorkingIso(candidate)) {
        prevWorking = candidate;
        break;
      }
    }

    let nextWorking: string | undefined;
    for (let offset = 1; offset <= 10; offset++) {
      const candidate = isoOfEpochDay(bdayParts.epoch + offset);
      if (candidate <= yearEndIso && isWorkingIso(candidate)) {
        nextWorking = candidate;
        break;
      }
    }

    const eligibleDates = [prevWorking, nextWorking].filter((d): d is string => Boolean(d));
    const startIso = eligibleDates[0] ?? birthdayIso;
    const endIso = eligibleDates[eligibleDates.length - 1] ?? birthdayIso;
    return {
      birthdayIso,
      startIso,
      endIso,
      eligibleDates,
    };
  }

  if (rule === 'within_week') {
    const startIso = clampToYear(isoOfEpochDay(bdayParts.epoch - 7));
    const endIso = clampToYear(isoOfEpochDay(bdayParts.epoch + 7));
    return {
      birthdayIso,
      startIso,
      endIso,
      eligibleDates: workingDaysInRange(startIso, endIso),
    };
  }

  if (rule === 'birthday_month') {
    const pad = (n: number) => String(n).padStart(2, '0');
    const lastDay = getDaysInMonth(year, bdayParts.month - 1);
    const startIso = `${year}-${pad(bdayParts.month)}-01`;
    const endIso = `${year}-${pad(bdayParts.month)}-${pad(lastDay)}`;
    return {
      birthdayIso,
      startIso,
      endIso,
      eligibleDates: workingDaysInRange(startIso, endIso),
    };
  }

  // rule === 'within_month'
  const startIso = clampToYear(isoOfEpochDay(bdayParts.epoch - 30));
  const endIso = clampToYear(isoOfEpochDay(bdayParts.epoch + 30));
  return {
    birthdayIso,
    startIso,
    endIso,
    eligibleDates: workingDaysInRange(startIso, endIso),
  };
};

export interface BirthdayLeaveValidation {
  valid: boolean;
  reason?: string;
}

export const validateBirthdayLeaveBooking = (
  startIso: string,
  endIso: string,
  year: number,
  rule: BirthdayLeaveRule,
  birthday: BirthdayDate | null | undefined,
  bankHolidays: string[],
): BirthdayLeaveValidation => {
  if (!startIso || !endIso || !calendarParts(startIso) || !calendarParts(endIso)) {
    return { valid: false, reason: 'Choose a valid date for your birthday day off.' };
  }
  if (startIso !== endIso) {
    return { valid: false, reason: 'Birthday day off must be booked as a single day.' };
  }
  if (calculateWorkingDaysInRange(startIso, startIso, bankHolidays) === 0) {
    return { valid: false, reason: 'Birthday day off must be booked on a working day.' };
  }
  const window = getBirthdayLeaveWindow(year, rule, birthday, bankHolidays);
  if (!window) {
    return { valid: true };
  }
  if (!window.eligibleDates.includes(startIso)) {
    return {
      valid: false,
      reason: `Date falls outside your ${BIRTHDAY_LEAVE_RULE_LABELS[rule].shortLabel} birthday window (${formatHolidayDates(window.startIso, window.endIso)}).`,
    };
  }
  return { valid: true };
};

/** Finds an eligible working day inside a multi-day holiday range (`startDate .. endDate`)
 *  that can be covered by the user's 1-day Birthday Day Off. Returns `null` if the
 *  range has fewer than 2 working days or no working day falls within the rule window. */
export const findBirthdayDayForHolidayRange = (
  startDate: string,
  endDate: string,
  year: number,
  rule: BirthdayLeaveRule,
  birthday: BirthdayDate | null | undefined,
  bankHolidays: string[],
): string | null => {
  const tripWorkingDays: string[] = [];
  for (const current of calendarDays(startDate, endDate)) {
    if (current.year === year && !current.weekend && !bankHolidays.includes(current.iso)) {
      tripWorkingDays.push(current.iso);
    }
  }
  if (tripWorkingDays.length < 2) return null;

  const window = getBirthdayLeaveWindow(year, rule, birthday, bankHolidays);
  if (!window) return null;

  const eligibleSet = new Set(window.eligibleDates);
  const matching = tripWorkingDays.filter(d => eligibleSet.has(d));
  if (matching.length === 0) return null;

  if (window.birthdayIso && matching.includes(window.birthdayIso)) {
    return window.birthdayIso;
  }

  if (window.birthdayIso) {
    const bdayParts = calendarParts(window.birthdayIso);
    if (bdayParts) {
      let best = matching[0];
      let bestDist = Math.abs((calendarParts(best)?.epoch ?? 0) - bdayParts.epoch);
      for (let i = 1; i < matching.length; i++) {
        const candidate = matching[i];
        const dist = Math.abs((calendarParts(candidate)?.epoch ?? 0) - bdayParts.epoch);
        if (dist < bestDist) {
          best = candidate;
          bestDist = dist;
        }
      }
      return best;
    }
  }

  return matching[0];
};

/** The regular holiday whose range covers `isoDate`, or `undefined`. Sick and
 *  birthday entries never cover: only annual leave is charged per day, so only
 *  a holiday can be charged twice for a birthday that lands inside it. The entry
 *  `excludeId` is skipped, for an entry that is being edited into something else. */
export const findHolidayCoveringDate = (
  holidays: UserHoliday[],
  isoDate: string,
  excludeId?: string,
): UserHoliday | undefined => {
  if (!calendarParts(isoDate)) return undefined;
  return holidays.find(
    hol =>
      (hol.type || 'holiday') === 'holiday' &&
      hol.id !== excludeId &&
      hol.startDate <= isoDate &&
      hol.endDate >= isoDate,
  );
};

/** Transfer birthday leave without recalculating a user-entered holiday count. */
export const adjustHolidayCountForBirthday = (
  count: number,
  birthdayCount: number,
  attach: boolean,
): number | null => {
  if (!Number.isFinite(count) || count < 0 || (birthdayCount !== HALF_DAY && birthdayCount !== 1)) {
    return null;
  }
  if (attach && count < birthdayCount) return null;
  return attach ? count - birthdayCount : count + birthdayCount;
};

/** The leave a booking's dates charge before any typed override: half a day
 *  for a half day, otherwise its working days less a Birthday Day Off it
 *  carries, never below 0. */
export const expectedLeaveCount = ({
  workingDays,
  halfDay,
  useBirthday,
  birthdayCount,
}: {
  workingDays: number;
  halfDay: boolean;
  useBirthday: boolean;
  birthdayCount: number;
}): number => {
  if (halfDay) return HALF_DAY;
  if (useBirthday) return Math.max(0, workingDays - birthdayCount);
  return workingDays;
};

/** Removing a birthday restores its charge to the first regular holiday host. */
export const removeHolidayWithBirthdayRestoration = (
  holidays: UserHoliday[],
  holidayId: string,
): UserHoliday[] => {
  const target = holidays.find(holiday => holiday.id === holidayId);
  const host = target?.type === 'birthday'
    ? findHolidayCoveringDate(
      holidays.filter(holiday => !(isHalfDay(holiday) && isHalfDay(target) && holiday.halfDay !== target.halfDay)),
      target.startDate,
      target.id,
    )
    : undefined;
  const restoredCount = host && target
    ? adjustHolidayCountForBirthday(host.count, target.count, false)
    : null;
  return holidays
    .filter(holiday => holiday.id !== holidayId)
    .map(holiday => holiday === host && restoredCount !== null
      ? { ...holiday, count: restoredCount }
      : holiday);
};

/** Birthday and sickness cannot cover the same half of a date. */
export const hasBirthdaySickOverlap = (
  holidays: UserHoliday[],
  candidate: UserHoliday,
  excludeId?: string,
): boolean => holidays.some(holiday => {
  if (holiday.id === excludeId) return false;
  if (!((candidate.type === 'birthday' && holiday.type === 'sick') ||
    (candidate.type === 'sick' && holiday.type === 'birthday'))) return false;
  if (candidate.startDate > holiday.endDate || candidate.endDate < holiday.startDate) return false;
  return !(isHalfDay(candidate) && isHalfDay(holiday) && candidate.halfDay !== holiday.halfDay);
});

