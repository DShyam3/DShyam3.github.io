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
const utcMidnight = (iso: string): Date => new Date(`${iso}T00:00:00Z`);

interface CalendarDay {
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
function* calendarDays(startStr: string, endStr: string): Generator<CalendarDay> {
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

/** Working days between two `YYYY-MM-DD` dates, inclusive, excluding weekends
 *  and bank holidays. Returns 0 for a missing, malformed or inverted range. */
export const calculateWorkingDaysInRange = (
  startStr: string,
  endStr: string,
  bankHolidays: string[],
): number => {
  let count = 0;
  for (const current of calendarDays(startStr, endStr)) {
    if (!current.weekend && !bankHolidays.includes(current.iso)) count++;
  }
  return count;
};

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
 *  attributed to `'birthday'` rather than duplicated as `'holiday'`. */
export const getBookedDaysForMonth = (
  holidays: UserHoliday[],
  year: number,
  monthIdx: number,
  bankHolidays: string[],
): BookedDay[] => {
  const booked: BookedDay[] = [];
  const birthdayIsos = new Set<string>();

  for (const hol of holidays) {
    if (hol.type !== 'birthday') continue;
    for (const current of calendarDays(hol.startDate, hol.endDate)) {
      const inMonth = current.year === year && current.monthIdx === monthIdx;
      if (inMonth && !current.weekend && !bankHolidays.includes(current.iso)) {
        birthdayIsos.add(current.iso);
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
        if (leaveType === 'holiday' && birthdayIsos.has(current.iso)) continue;
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

export const calculateBirthdayBenefitValue = (
  grossSalary: number,
  workingDaysPerYear: number,
): number => {
  if (
    !Number.isFinite(grossSalary) ||
    grossSalary <= 0 ||
    !Number.isFinite(workingDaysPerYear) ||
    workingDaysPerYear <= 0
  ) {
    return 0;
  }
  return Math.round((grossSalary / workingDaysPerYear) * 100) / 100;
};

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

export type OptimalLeaveBias =
  | 'balanced'
  | 'long_christmas'
  | 'long_easter'
  | 'summer_focus';

export const OPTIMAL_LEAVE_BIASES: readonly OptimalLeaveBias[] = [
  'balanced',
  'long_christmas',
  'long_easter',
  'summer_focus',
];

export const OPTIMAL_LEAVE_BIAS_LABELS: Record<
  OptimalLeaveBias,
  { label: string; shortLabel: string; description: string }
> = {
  balanced: {
    label: 'Balanced (Max Efficiency)',
    shortLabel: 'Balanced',
    description: 'Maximises total days off per leave day spent across the whole year.',
  },
  long_christmas: {
    label: 'Long Christmas Shutdown',
    shortLabel: 'Long Christmas',
    description: 'Reserves leave first for the Ultimate 15–18 day Christmas & New Year shutdown, trading off lower-priority bridges if needed.',
  },
  long_easter: {
    label: 'Long Easter Mega-Break',
    shortLabel: 'Long Easter',
    description: 'Reserves leave first for the combined 16-day Easter shutdown across Good Friday and Easter Monday.',
  },
  summer_focus: {
    label: 'May & Summer Focus',
    shortLabel: 'Summer Focus',
    description: 'Prioritises May, Spring, and Late Summer bank-holiday bridges first.',
  },
};

/** Formats a single `YYYY-MM-DD` date in UK format (`4 Jan 27` or `Mon 4 Jan 27`). */
export const formatUkDate = (iso: string, includeWeekday = false): string => {
  if (!calendarParts(iso)) return '';
  return utcMidnight(iso)
    .toLocaleDateString('en-GB', {
      ...(includeWeekday ? { weekday: 'short' } : {}),
      day: 'numeric',
      month: 'short',
      year: '2-digit',
      timeZone: 'UTC',
    })
    .replace(/,\s*/g, ' ');
};

/** Collapses an array of `YYYY-MM-DD` dates to book into UK range segments
 *  (e.g. `21 Dec - 24 Dec 26 + 29 Dec - 31 Dec 26`). */
export const formatDatesToBookUk = (dates: string[]): string => {
  const valid = [...new Set(dates.filter(d => Boolean(calendarParts(d))))].sort();
  if (valid.length === 0) return '';

  const segments: Array<{ start: string; end: string }> = [];
  let segStart = valid[0];
  let prevIso = valid[0];
  let prevEpoch = calendarParts(valid[0])!.epoch;

  for (let i = 1; i < valid.length; i++) {
    const curIso = valid[i];
    const curParts = calendarParts(curIso);
    if (!curParts) continue;
    if (curParts.epoch === prevEpoch + 1) {
      prevIso = curIso;
      prevEpoch = curParts.epoch;
      continue;
    }
    segments.push({ start: segStart, end: prevIso });
    segStart = curIso;
    prevIso = curIso;
    prevEpoch = curParts.epoch;
  }
  segments.push({ start: segStart, end: prevIso });

  return segments.map(s => formatHolidayDates(s.start, s.end)).join(' + ');
};

export interface OptimalHolidayBridge {
  id: string;
  clusterId?: string;
  label: string;
  startDate: string;
  endDate: string;
  breakStartDate: string;
  breakEndDate: string;
  /** Exact working days (`YYYY-MM-DD`) that need to be booked as leave (including birthday day if used). */
  datesToBook: string[];
  /** First working day back at work after `breakEndDate` (`YYYY-MM-DD`). */
  returnToWorkDate: string;
  /** Optional tier (1 = Efficient 3-Day Bridge, 2 = Balanced 4-5 Day Stretch, 3 = Ultimate 7-8 Day Shutdown). */
  tier?: 1 | 2 | 3;
  /** Human-readable tier badge, e.g. "Tier 1 · Efficient Bridge". */
  tierLabel?: string;
  /** Standard annual leave days required (excludes the 1 birthday day when usesBirthdayDay is true). */
  leaveDaysRequired: number;
  /** Total working days in [startDate, endDate] (leaveDaysRequired + (usesBirthdayDay ? 1 : 0)). */
  workingDaysBooked: number;
  /** Total consecutive calendar days off from breakStartDate to breakEndDate inclusive. */
  totalDaysOff: number;
  /** Ratio of totalDaysOff to workingDaysBooked, rounded to 2 decimal places. */
  efficiency: number;
  usesBirthdayDay: boolean;
  birthdayDayDate?: string;
  bankHolidayNames: string[];
  recommended: boolean;
}

export interface PlanOptimalHolidaysOptions {
  year: number;
  region?: UkHolidayRegion;
  /** Annual leave allowance in days (e.g. 25). */
  annualAllowance: number;
  /** Optional explicit bank holiday dates for `year` (falls back to `computeUkBankHolidaysForYear`). */
  bankHolidays?: string[];
  /** Optional bank holiday title map for `year`. */
  bankHolidaysMap?: Record<string, string>;
  /** Existing booked holidays (used to exclude already-booked ranges and deduct already-used holiday allowance). */
  existingHolidays?: UserHoliday[];
  birthdayLeaveEnabled?: boolean;
  birthdayLeaveRule?: BirthdayLeaveRule;
  birthday?: BirthdayDate | null;
  bias?: OptimalLeaveBias;
  /** Optional reference date (`YYYY-MM-DD`) to plan only remaining bridges from `asOfDate` onwards. */
  asOfDate?: string;
}

export interface OptimalHolidayPlan {
  year: number;
  bias: OptimalLeaveBias;
  bridges: OptimalHolidayBridge[];
  recommendedLeaveDays: number;
  recommendedTotalDaysOff: number;
  recommendedUsesBirthday: boolean;
  remainingAllowanceAfterPlan: number;
}

export type OptimalLeavePlan = OptimalHolidayPlan;

/** Computes optimal annual-leave bridges around bank holidays, weekends, and
 *  an optional birthday day off for any calendar year. Accepts either an options
 *  object or positional parameters. */
export function planOptimalHolidays(options: PlanOptimalHolidaysOptions): OptimalHolidayPlan;
export function planOptimalHolidays(
  year: number,
  workHolidaysAllowance: number,
  bankHolidayStrings?: string[],
  existingHolidays?: UserHoliday[],
  birthdayConfig?: {
    enabled: boolean;
    rule: BirthdayLeaveRule;
    birthday?: BirthdayDate | null;
  },
  bias?: OptimalLeaveBias,
  asOfDate?: string,
): OptimalHolidayPlan;
export function planOptimalHolidays(
  optionsOrYear: PlanOptimalHolidaysOptions | number,
  workHolidaysAllowance?: number,
  bankHolidayStrings?: string[],
  existingHolidaysArg?: UserHoliday[],
  birthdayConfig?: {
    enabled: boolean;
    rule: BirthdayLeaveRule;
    birthday?: BirthdayDate | null;
  },
  biasArg?: OptimalLeaveBias,
  asOfDateArg?: string,
): OptimalHolidayPlan {
  const options: PlanOptimalHolidaysOptions =
    typeof optionsOrYear === 'number'
      ? {
          year: optionsOrYear,
          annualAllowance: workHolidaysAllowance ?? 0,
          bankHolidays: bankHolidayStrings,
          existingHolidays: existingHolidaysArg,
          birthdayLeaveEnabled: birthdayConfig?.enabled,
          birthdayLeaveRule: birthdayConfig?.rule,
          birthday: birthdayConfig?.birthday,
          bias: biasArg,
          asOfDate: asOfDateArg,
        }
      : optionsOrYear;

  const { year } = options;
  const bias: OptimalLeaveBias = options.bias ?? 'balanced';
  const safeAllowance = Number.isFinite(options.annualAllowance) ? Math.max(0, options.annualAllowance) : 0;

  if (!Number.isInteger(year) || year < 1900 || year > 9999) {
    return {
      year,
      bias,
      bridges: [],
      recommendedLeaveDays: 0,
      recommendedTotalDaysOff: 0,
      recommendedUsesBirthday: false,
      remainingAllowanceAfterPlan: safeAllowance,
    };
  }

  const asOfParts = options.asOfDate ? calendarParts(options.asOfDate) : null;
  const activeAsOfIso = asOfParts && asOfParts.year === year ? options.asOfDate! : null;

  const region = options.region ?? 'england-and-wales';
  const currentYearBh = resolveBankHolidaysForYear(
    year,
    region,
    options.bankHolidays,
    options.bankHolidaysMap,
  );
  const prevYearBh = computeUkBankHolidaysForYear(year - 1, region);
  const nextYearBh = computeUkBankHolidaysForYear(year + 1, region);

  const allBhSet = new Set<string>([
    ...prevYearBh.map(e => e.date),
    ...currentYearBh.dates,
    ...nextYearBh.map(e => e.date),
  ]);
  const allBhMap: Record<string, string> = {};
  for (const e of prevYearBh) allBhMap[e.date] = e.title;
  for (const [k, v] of Object.entries(currentYearBh.map)) allBhMap[k] = v;
  for (const e of nextYearBh) allBhMap[e.date] = e.title;

  const existing = options.existingHolidays ?? [];
  const bookedDatesSet = new Set<string>();
  let usedHolidayDays = 0;
  let alreadyHasBirthdayInYear = false;

  for (const hol of existing) {
    if (hol.type === 'sick') continue;
    const inYear = calendarParts(hol.startDate)?.year === year;
    if (hol.type === 'birthday' && inYear) {
      alreadyHasBirthdayInYear = true;
    } else if (inYear) {
      usedHolidayDays += Number.isFinite(hol.count) ? hol.count : 0;
    }
    for (const day of calendarDays(hol.startDate, hol.endDate)) {
      if (!day.weekend && !allBhSet.has(day.iso)) {
        bookedDatesSet.add(day.iso);
      }
    }
  }

  const availableAllowance = Math.max(0, safeAllowance - usedHolidayDays);
  const canUseBirthday = Boolean(options.birthdayLeaveEnabled) && !alreadyHasBirthdayInYear;
  const birthdayRule: BirthdayLeaveRule = options.birthdayLeaveRule ?? 'within_week';
  const birthdayWindow = canUseBirthday
    ? getBirthdayLeaveWindow(year, birthdayRule, options.birthday, currentYearBh.dates)
    : null;

  const isNonWorkingOrBooked = (iso: string, extraBooked?: Set<string>): boolean => {
    if (!calendarParts(iso)) return false;
    const wd = utcMidnight(iso).getUTCDay();
    if (wd === 0 || wd === 6) return true;
    if (allBhSet.has(iso) || bookedDatesSet.has(iso)) return true;
    return Boolean(extraBooked?.has(iso));
  };

  interface RawCandidate {
    customId?: string;
    clusterId?: string;
    startDate: string;
    endDate: string;
    workDays: string[];
    breakStartDate: string;
    breakEndDate: string;
    returnToWorkDate: string;
    totalDaysOff: number;
    bankHolidayNames: string[];
    label: string;
    tier?: 1 | 2 | 3;
    tierLabel?: string;
    usesBirthdayDay: boolean;
    birthdayDayDate?: string;
    leaveDaysRequired: number;
  }

  const candidateMap = new Map<string, RawCandidate>();

  const deriveBridgeLabel = (
    startDate: string,
    breakStartDate: string,
    breakEndDate: string,
    bhDatesInBreak: string[],
  ): string => {
    const titles = bhDatesInBreak.map(d => allBhMap[d]).filter(Boolean);
    const hasGoodFriday = titles.includes('Good Friday');
    const hasEasterMonday = titles.includes('Easter Monday');
    if (hasGoodFriday || hasEasterMonday) {
      const goodFridayIso = bhDatesInBreak.find(d => allBhMap[d] === 'Good Friday');
      if (goodFridayIso && startDate < goodFridayIso) {
        return 'Easter (Pre-Easter Week)';
      }
      return 'Easter (Post-Easter Week)';
    }
    if (
      titles.includes('Christmas Day') ||
      titles.includes('Boxing Day') ||
      (breakStartDate.startsWith(`${year}-12-`) && breakEndDate.startsWith(`${year + 1}-01-`))
    ) {
      return 'Christmas & New Year Break';
    }
    if (titles.length > 0) {
      return `${titles[0]} Bridge`;
    }
    return 'Holiday Bridge';
  };

  interface SpanMeta {
    customLabel?: string;
    tier?: 1 | 2 | 3;
    tierLabel?: string;
  }

  const addCandidateSpan = (rawStartIso: string, rawEndIso: string, meta?: SpanMeta) => {
    const workDays: string[] = [];
    for (const day of calendarDays(rawStartIso, rawEndIso)) {
      if (day.year !== year) continue;
      if (!day.weekend && !allBhSet.has(day.iso) && !bookedDatesSet.has(day.iso)) {
        workDays.push(day.iso);
      }
    }
    if (workDays.length === 0) return;

    const startDate = workDays[0];
    const endDate = workDays[workDays.length - 1];
    const key = `${startDate}:${endDate}`;
    const existingCand = candidateMap.get(key);
    if (existingCand) {
      if (meta?.customLabel) existingCand.label = meta.customLabel;
      if (meta?.tier) existingCand.tier = meta.tier;
      if (meta?.tierLabel) existingCand.tierLabel = meta.tierLabel;
      return;
    }

    const workSet = new Set(workDays);
    const startParts = calendarParts(startDate);
    const endParts = calendarParts(endDate);
    if (!startParts || !endParts) return;

    let breakStartEpoch = startParts.epoch;
    while (isNonWorkingOrBooked(isoOfEpochDay(breakStartEpoch - 1), workSet)) {
      breakStartEpoch--;
    }

    let breakEndEpoch = endParts.epoch;
    while (isNonWorkingOrBooked(isoOfEpochDay(breakEndEpoch + 1), workSet)) {
      breakEndEpoch++;
    }

    const breakStartDate = isoOfEpochDay(breakStartEpoch);
    const breakEndDate = isoOfEpochDay(breakEndEpoch);
    const returnToWorkDate = isoOfEpochDay(breakEndEpoch + 1);
    const totalDaysOff = breakEndEpoch - breakStartEpoch + 1;
    if (totalDaysOff <= workDays.length) return;

    const bhDatesInBreak: string[] = [];
    for (let ep = breakStartEpoch; ep <= breakEndEpoch; ep++) {
      const iso = isoOfEpochDay(ep);
      if (allBhSet.has(iso)) bhDatesInBreak.push(iso);
    }
    const bankHolidayNames = [...new Set(bhDatesInBreak.map(d => allBhMap[d] || 'Bank Holiday'))];
    const label = meta?.customLabel ?? deriveBridgeLabel(startDate, breakStartDate, breakEndDate, bhDatesInBreak);

    candidateMap.set(key, {
      startDate,
      endDate,
      workDays,
      breakStartDate,
      breakEndDate,
      returnToWorkDate,
      totalDaysOff,
      bankHolidayNames,
      label,
      ...(meta?.tier ? { tier: meta.tier } : {}),
      ...(meta?.tierLabel ? { tierLabel: meta.tierLabel } : {}),
      usesBirthdayDay: false,
      leaveDaysRequired: workDays.length,
    });
  };

  // Generate Monday-Friday week spans around every bank holiday in `year`
  for (const bhDate of currentYearBh.dates) {
    // Skip Dec 25/26/27/28 here so Christmas Tiers 1, 2, 3 are added cleanly below
    if (bhDate.startsWith(`${year}-12-2`)) continue;
    const parts = calendarParts(bhDate);
    if (!parts) continue;
    const wd = utcMidnight(bhDate).getUTCDay();
    const offsetToMon = (wd + 6) % 7;
    const monIso = isoOfEpochDay(parts.epoch - offsetToMon);
    const friIso = isoOfEpochDay(parts.epoch - offsetToMon + 4);
    const clampedStart = monIso < `${year}-01-01` ? `${year}-01-01` : monIso;
    const clampedEnd = friIso > `${year}-12-31` ? `${year}-12-31` : friIso;
    addCandidateSpan(clampedStart, clampedEnd);
  }

  // Easter Tiers (Tier 1 Pre-Easter, Tier 1 Post-Easter, Tier 3 16-Day Easter Mega-Break)
  const goodFridayIso = currentYearBh.dates.find(d => currentYearBh.map[d] === 'Good Friday');
  const easterMondayIso = currentYearBh.dates.find(d => currentYearBh.map[d] === 'Easter Monday');
  if (goodFridayIso) {
    const gfParts = calendarParts(goodFridayIso);
    if (gfParts) {
      const monBeforeGf = isoOfEpochDay(gfParts.epoch - 4);
      const thuBeforeGf = isoOfEpochDay(gfParts.epoch - 1);
      addCandidateSpan(monBeforeGf, thuBeforeGf, {
        customLabel: 'Easter (Pre-Easter Week)',
        tier: 1,
        tierLabel: 'Tier 1 · Pre-Easter 4-Day Bridge',
      });

      if (easterMondayIso) {
        const emParts = calendarParts(easterMondayIso);
        if (emParts) {
          const tueAfterEm = isoOfEpochDay(emParts.epoch + 1);
          const friAfterEm = isoOfEpochDay(emParts.epoch + 4);
          addCandidateSpan(tueAfterEm, friAfterEm, {
            customLabel: 'Easter (Post-Easter Week)',
            tier: 1,
            tierLabel: 'Tier 1 · Post-Easter 4-Day Bridge',
          });
          addCandidateSpan(monBeforeGf, friAfterEm, {
            customLabel: 'Easter (16-Day Mega-Break)',
            tier: 3,
            tierLabel: 'Tier 3 · 16-Day Easter Shutdown',
          });
        }
      }
    }
  }

  // Christmas Tiers (Tier 1: Efficient Bridge, Tier 2: Balanced Stretch, Tier 3: Ultimate Shutdown)
  const xmasParts = calendarParts(`${year}-12-25`);
  if (xmasParts) {
    const xmasWd = utcMidnight(`${year}-12-25`).getUTCDay();
    const offsetToMon = (xmasWd + 6) % 7;
    const xmasMonEpoch = xmasParts.epoch - offsetToMon;
    const xmasMonIso = isoOfEpochDay(xmasMonEpoch);
    const prevWeekMonIso = isoOfEpochDay(xmasMonEpoch - 7);

    // Count unbooked working days in xmasMonIso .. Dec 24
    const preXmasWorkDays: string[] = [];
    for (const day of calendarDays(xmasMonIso, `${year}-12-24`)) {
      if (!day.weekend && !allBhSet.has(day.iso) && !bookedDatesSet.has(day.iso)) {
        preXmasWorkDays.push(day.iso);
      }
    }

    // Tier 1: Twixmas working days only (between Christmas/Boxing Day and New Year)
    addCandidateSpan(`${year}-12-25`, `${year}-12-31`, {
      customLabel: 'Christmas & New Year (3-Day Bridge)',
      tier: 1,
      tierLabel: 'Tier 1 · Efficient Bridge',
    });

    if (preXmasWorkDays.length >= 3) {
      // Tier 2: last 2 pre-Christmas working days + Twixmas (5 working days -> 12 days off)
      addCandidateSpan(preXmasWorkDays[preXmasWorkDays.length - 2], `${year}-12-31`, {
        customLabel: 'Christmas & New Year (Balanced Stretch)',
        tier: 2,
        tierLabel: 'Tier 2 · Balanced Stretch',
      });
      // Tier 3: full Christmas week + Twixmas (7–8 working days -> 16 days off)
      addCandidateSpan(xmasMonIso, `${year}-12-31`, {
        customLabel: 'Christmas & New Year (Ultimate Shutdown)',
        tier: 3,
        tierLabel: 'Tier 3 · Ultimate Shutdown',
      });
    } else if (preXmasWorkDays.length >= 1) {
      // Tier 2: 1–2 pre-Christmas working days + Twixmas (4–5 working days -> 11–12 days off)
      addCandidateSpan(xmasMonIso, `${year}-12-31`, {
        customLabel: 'Christmas & New Year (Balanced Stretch)',
        tier: 2,
        tierLabel: 'Tier 2 · Balanced Stretch',
      });
      // Tier 3: preceding Monday + Christmas week + Twixmas
      addCandidateSpan(prevWeekMonIso, `${year}-12-31`, {
        customLabel: 'Christmas & New Year (Ultimate Shutdown)',
        tier: 3,
        tierLabel: 'Tier 3 · Ultimate Shutdown',
      });
    } else {
      // Dec 25 is Monday: Tier 2 takes Thu+Fri before Christmas + Twixmas; Tier 3 takes full prior week + Twixmas
      addCandidateSpan(isoOfEpochDay(xmasMonEpoch - 4), `${year}-12-31`, {
        customLabel: 'Christmas & New Year (Balanced Stretch)',
        tier: 2,
        tierLabel: 'Tier 2 · Balanced Stretch',
      });
      addCandidateSpan(prevWeekMonIso, `${year}-12-31`, {
        customLabel: 'Christmas & New Year (Ultimate Shutdown)',
        tier: 3,
        tierLabel: 'Tier 3 · Ultimate Shutdown',
      });
    }
  }

  // Filter out candidates in the past when `asOfDate` is in `year`
  if (activeAsOfIso) {
    for (const [key, cand] of candidateMap.entries()) {
      if (cand.endDate < activeAsOfIso || cand.workDays.some(d => d < activeAsOfIso)) {
        candidateMap.delete(key);
      }
    }
  }

  // Integrate birthday day off
  if (canUseBirthday && birthdayWindow && birthdayWindow.eligibleDates.length > 0) {
    const validEligibleDates = activeAsOfIso
      ? birthdayWindow.eligibleDates.filter(d => d >= activeAsOfIso)
      : birthdayWindow.eligibleDates;
    const eligibleSet = new Set(validEligibleDates);

    // Find candidate bridges that contain an eligible birthday working day
    const matchingCandidates = [...candidateMap.values()].filter(c =>
      c.workDays.some(d => eligibleSet.has(d)),
    );

    if (matchingCandidates.length > 0 && (birthdayRule !== 'anytime' || birthdayWindow.birthdayIso)) {
      matchingCandidates.sort((a, b) => {
        const aHasExact = birthdayWindow.birthdayIso && a.workDays.includes(birthdayWindow.birthdayIso) ? 1 : 0;
        const bHasExact = birthdayWindow.birthdayIso && b.workDays.includes(birthdayWindow.birthdayIso) ? 1 : 0;
        if (aHasExact !== bHasExact) return bHasExact - aHasExact;
        return b.totalDaysOff / b.workDays.length - a.totalDaysOff / a.workDays.length;
      });
      const primary = matchingCandidates[0];
      const matchDate =
        (birthdayWindow.birthdayIso && primary.workDays.includes(birthdayWindow.birthdayIso)
          ? birthdayWindow.birthdayIso
          : primary.workDays.find(d => eligibleSet.has(d))) ?? primary.workDays[0];
      for (const cand of matchingCandidates) {
        if (cand.workDays.includes(matchDate)) {
          cand.usesBirthdayDay = true;
          cand.birthdayDayDate = matchDate;
          cand.leaveDaysRequired = Math.max(0, cand.workDays.length - 1);
        }
      }
    } else if (birthdayRule !== 'anytime' || birthdayWindow.birthdayIso) {
      // Create a standalone 1-day Birthday Day Off Break
      const unbookedEligible = validEligibleDates.filter(d => !bookedDatesSet.has(d));
      if (unbookedEligible.length > 0) {
        const isMonOrFri = (iso: string) => {
          const wd = utcMidnight(iso).getUTCDay();
          return wd === 1 || wd === 5;
        };
        const chosenDate =
          (birthdayWindow.birthdayIso &&
          unbookedEligible.includes(birthdayWindow.birthdayIso) &&
          isMonOrFri(birthdayWindow.birthdayIso)
            ? birthdayWindow.birthdayIso
            : unbookedEligible.find(isMonOrFri) ??
              (birthdayWindow.birthdayIso && unbookedEligible.includes(birthdayWindow.birthdayIso)
                ? birthdayWindow.birthdayIso
                : unbookedEligible[0]));

        const parts = calendarParts(chosenDate);
        if (parts) {
          const singleSet = new Set([chosenDate]);
          let breakStartEpoch = parts.epoch;
          while (isNonWorkingOrBooked(isoOfEpochDay(breakStartEpoch - 1), singleSet)) {
            breakStartEpoch--;
          }
          let breakEndEpoch = parts.epoch;
          while (isNonWorkingOrBooked(isoOfEpochDay(breakEndEpoch + 1), singleSet)) {
            breakEndEpoch++;
          }
          const breakStartDate = isoOfEpochDay(breakStartEpoch);
          const breakEndDate = isoOfEpochDay(breakEndEpoch);
          const returnToWorkDate = isoOfEpochDay(breakEndEpoch + 1);
          const totalDaysOff = breakEndEpoch - breakStartEpoch + 1;
          const bhDatesInBreak: string[] = [];
          for (let ep = breakStartEpoch; ep <= breakEndEpoch; ep++) {
            const iso = isoOfEpochDay(ep);
            if (allBhSet.has(iso)) bhDatesInBreak.push(iso);
          }
          const bankHolidayNames = [...new Set(bhDatesInBreak.map(d => allBhMap[d] || 'Bank Holiday'))];

          candidateMap.set(`${chosenDate}:${chosenDate}`, {
            startDate: chosenDate,
            endDate: chosenDate,
            workDays: [chosenDate],
            breakStartDate,
            breakEndDate,
            returnToWorkDate,
            totalDaysOff,
            bankHolidayNames,
            label: 'Birthday Day Off Break',
            usesBirthdayDay: true,
            birthdayDayDate: chosenDate,
            leaveDaysRequired: 0,
          });
        }
      }
    } else if (validEligibleDates.length > 0) {
      // Floating 'anytime' rule with no specific birthday date set: apply to best Tier 1 bridge
      const allCandidates = [...candidateMap.values()]
        .filter(c => !c.tier || c.tier === 1)
        .sort((a, b) => b.totalDaysOff / b.workDays.length - a.totalDaysOff / a.workDays.length);
      if (allCandidates.length > 0) {
        const best = allCandidates[0];
        best.usesBirthdayDay = true;
        best.birthdayDayDate = best.workDays[0];
        best.leaveDaysRequired = Math.max(0, best.workDays.length - 1);
      }
    }
  }

  // When planning from mid-year (`asOfDate >= YYYY-02-01`) and spare allowance exceeds
  // the remaining bank-holiday bridges, emit up to 2 high-efficiency non-bank-holiday stretches
  if (activeAsOfIso && activeAsOfIso >= `${year}-02-01` && availableAllowance > 0) {
    const bhBreakDates = new Set<string>();
    for (const cand of candidateMap.values()) {
      for (const d of calendarDays(cand.breakStartDate, cand.breakEndDate)) {
        bhBreakDates.add(d.iso);
      }
    }

    const usedStretchDates = new Set<string>();
    const monthNameOf = (iso: string): string =>
      utcMidnight(iso).toLocaleDateString('en-GB', { month: 'long', timeZone: 'UTC' });

    // 1. Long Weekend Bridge (Fri + Mon across a weekend -> 4 days off for 2 leave days, efficiency 2.0)
    for (const day of calendarDays(activeAsOfIso, `${year}-12-20`)) {
      const wd = utcMidnight(day.iso).getUTCDay();
      if (wd !== 5) continue; // look for Friday
      const friParts = calendarParts(day.iso);
      if (!friParts) continue;
      const satIso = isoOfEpochDay(friParts.epoch + 1);
      const sunIso = isoOfEpochDay(friParts.epoch + 2);
      const monIso = isoOfEpochDay(friParts.epoch + 3);
      if (monIso > `${year}-12-31`) break;

      const spanIsos = [day.iso, satIso, sunIso, monIso];
      if (
        spanIsos.some(d => allBhSet.has(d) || bookedDatesSet.has(d) || bhBreakDates.has(d))
      ) {
        continue;
      }

      const workDays = [day.iso, monIso];
      const workSet = new Set(workDays);
      let breakStartEpoch = friParts.epoch;
      while (isNonWorkingOrBooked(isoOfEpochDay(breakStartEpoch - 1), workSet)) {
        breakStartEpoch--;
      }
      let breakEndEpoch = friParts.epoch + 3;
      while (isNonWorkingOrBooked(isoOfEpochDay(breakEndEpoch + 1), workSet)) {
        breakEndEpoch++;
      }
      const breakStartDate = isoOfEpochDay(breakStartEpoch);
      const breakEndDate = isoOfEpochDay(breakEndEpoch);
      const returnToWorkDate = isoOfEpochDay(breakEndEpoch + 1);
      const totalDaysOff = breakEndEpoch - breakStartEpoch + 1;

      candidateMap.set(`${day.iso}:${monIso}`, {
        customId: `rem_long_weekend_${day.iso}`,
        clusterId: 'rem_long_weekend',
        startDate: day.iso,
        endDate: monIso,
        workDays,
        breakStartDate,
        breakEndDate,
        returnToWorkDate,
        totalDaysOff,
        bankHolidayNames: [],
        label: `${monthNameOf(day.iso)} Long Weekend`,
        tier: 1,
        tierLabel: '2-Day Weekend Bridge',
        usesBirthdayDay: false,
        leaveDaysRequired: 2,
      });
      for (const d of calendarDays(breakStartDate, breakEndDate)) {
        usedStretchDates.add(d.iso);
      }
      break;
    }

    // 2. Full Week Nine-Day Break (Mon..Fri between two weekends -> 9 days off for 5 leave days, efficiency 1.8)
    for (const day of calendarDays(activeAsOfIso, `${year}-12-18`)) {
      const wd = utcMidnight(day.iso).getUTCDay();
      if (wd !== 1) continue; // look for Monday
      const monParts = calendarParts(day.iso);
      if (!monParts) continue;
      const friIso = isoOfEpochDay(monParts.epoch + 4);
      if (friIso > `${year}-12-31`) break;

      const weekDays: string[] = [];
      let blocked = false;
      for (let offset = 0; offset <= 4; offset++) {
        const curIso = isoOfEpochDay(monParts.epoch + offset);
        if (
          allBhSet.has(curIso) ||
          bookedDatesSet.has(curIso) ||
          bhBreakDates.has(curIso) ||
          usedStretchDates.has(curIso)
        ) {
          blocked = true;
          break;
        }
        weekDays.push(curIso);
      }
      if (blocked || weekDays.length !== 5) continue;

      const workSet = new Set(weekDays);
      let breakStartEpoch = monParts.epoch;
      while (isNonWorkingOrBooked(isoOfEpochDay(breakStartEpoch - 1), workSet)) {
        breakStartEpoch--;
      }
      let breakEndEpoch = monParts.epoch + 4;
      while (isNonWorkingOrBooked(isoOfEpochDay(breakEndEpoch + 1), workSet)) {
        breakEndEpoch++;
      }
      const breakStartDate = isoOfEpochDay(breakStartEpoch);
      const breakEndDate = isoOfEpochDay(breakEndEpoch);
      const returnToWorkDate = isoOfEpochDay(breakEndEpoch + 1);
      const totalDaysOff = breakEndEpoch - breakStartEpoch + 1;

      candidateMap.set(`${day.iso}:${friIso}`, {
        customId: `rem_week_stretch_${day.iso}`,
        clusterId: 'rem_week_stretch',
        startDate: day.iso,
        endDate: friIso,
        workDays: weekDays,
        breakStartDate,
        breakEndDate,
        returnToWorkDate,
        totalDaysOff,
        bankHolidayNames: [],
        label: `${monthNameOf(day.iso)} 9-Day Week Break`,
        tier: 2,
        tierLabel: '5-Day Week Bridge',
        usesBirthdayDay: false,
        leaveDaysRequired: 5,
      });
      break;
    }
  }

  const getBiasPriority = (cand: RawCandidate): number => {
    if (cand.leaveDaysRequired === 0) return 200;

    if (bias === 'long_christmas') {
      if (cand.label.includes('Christmas')) {
        if (cand.tier === 3) return 150;
        if (cand.tier === 2) return 140;
        return 130;
      }
      if (cand.tier === 3) return 20;
      return 60;
    }

    if (bias === 'long_easter') {
      if (cand.label.includes('Easter')) {
        if (cand.tier === 3) return 150;
        return 130;
      }
      if (cand.tier === 3) return 20;
      return 60;
    }

    if (bias === 'summer_focus') {
      const month = parseInt(cand.startDate.slice(5, 7), 10);
      if (month >= 5 && month <= 8) return 150;
      if (!cand.tier || cand.tier === 1) return 60;
      return 20;
    }

    // 'balanced' default: favour high-efficiency Tier 1 bridges
    if (!cand.tier || cand.tier === 1) return 80;
    if (cand.tier === 2) return 30;
    return 20;
  };

  // Rank candidates to select recommended non-overlapping bridges within availableAllowance
  const ranked = [...candidateMap.values()].sort((a, b) => {
    const aPrio = getBiasPriority(a);
    const bPrio = getBiasPriority(b);
    if (aPrio !== bPrio) return bPrio - aPrio;
    const aEff = a.totalDaysOff / Math.max(1, a.leaveDaysRequired);
    const bEff = b.totalDaysOff / Math.max(1, b.leaveDaysRequired);
    if (bEff !== aEff) return bEff - aEff;
    if (b.totalDaysOff !== a.totalDaysOff) return b.totalDaysOff - a.totalDaysOff;
    return a.startDate.localeCompare(b.startDate);
  });

  const selectedKeys = new Set<string>();
  const usedWorkDays = new Set<string>();
  let recommendedLeaveDays = 0;
  let recommendedTotalDaysOff = 0;
  let recommendedUsesBirthday = false;

  for (const cand of ranked) {
    if (cand.workDays.some(d => usedWorkDays.has(d))) continue;
    if (recommendedLeaveDays + cand.leaveDaysRequired > availableAllowance) continue;

    selectedKeys.add(`${cand.startDate}:${cand.endDate}`);
    for (const d of cand.workDays) usedWorkDays.add(d);
    recommendedLeaveDays += cand.leaveDaysRequired;
    recommendedTotalDaysOff += cand.totalDaysOff;
    if (cand.usesBirthdayDay) recommendedUsesBirthday = true;
  }

  const bridges: OptimalHolidayBridge[] = [...candidateMap.values()]
    .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.workDays.length - b.workDays.length)
    .map((cand, idx) => {
      const workingDaysBooked = cand.workDays.length;
      const efficiency = Math.round((cand.totalDaysOff / workingDaysBooked) * 100) / 100;
      const recommended = selectedKeys.has(`${cand.startDate}:${cand.endDate}`);
      return {
        id: cand.customId ?? `bridge-${year}-${idx}-${cand.startDate}-${cand.endDate}`,
        ...(cand.clusterId ? { clusterId: cand.clusterId } : {}),
        label: cand.label,
        startDate: cand.startDate,
        endDate: cand.endDate,
        breakStartDate: cand.breakStartDate,
        breakEndDate: cand.breakEndDate,
        datesToBook: cand.workDays,
        returnToWorkDate: cand.returnToWorkDate,
        ...(cand.tier ? { tier: cand.tier } : {}),
        ...(cand.tierLabel ? { tierLabel: cand.tierLabel } : {}),
        leaveDaysRequired: cand.leaveDaysRequired,
        workingDaysBooked,
        totalDaysOff: cand.totalDaysOff,
        efficiency,
        usesBirthdayDay: cand.usesBirthdayDay,
        ...(cand.birthdayDayDate ? { birthdayDayDate: cand.birthdayDayDate } : {}),
        bankHolidayNames: cand.bankHolidayNames,
        recommended,
      };
    });

  return {
    year,
    bias,
    bridges,
    recommendedLeaveDays,
    recommendedTotalDaysOff,
    recommendedUsesBirthday,
    remainingAllowanceAfterPlan: Math.max(0, availableAllowance - recommendedLeaveDays),
  };
};
