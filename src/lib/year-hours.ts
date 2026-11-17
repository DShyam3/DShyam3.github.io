/**
 * Where the 8,760 hours of a year go.
 *
 * Arithmetic over what the visitor enters: nothing here reads stored data, so
 * the public page that uses it cannot show anyone's real figures.
 */

export const DAYS_IN_YEAR = 365;
export const HOURS_IN_YEAR = DAYS_IN_YEAR * 24;
const WEEKS_IN_YEAR = DAYS_IN_YEAR / 7;

const atLeastZero = (value: number) => (Number.isFinite(value) && value > 0 ? value : 0);
/** The whole weeks in a 365-day year; the 365th day counts as a working day. */
const WHOLE_WEEKS_IN_YEAR = 52;

/**
 * Days off each week across the year's 52 whole weeks: 104 for a five-day
 * week, 156 for four. Follows from the working week rather than being entered,
 * since the calendar fixes how many weeks there are.
 */
export const weekendDaysInYear = (workingDaysPerWeek: number): number =>
  (7 - Math.min(7, atLeastZero(workingDaysPerWeek))) * WHOLE_WEEKS_IN_YEAR;

export interface YearHoursInput {
  /** Days worked in a normal week, 0 to 7. */
  workingDaysPerWeek: number;
  bankHolidays: number;
  /** Paid leave taken, in days. */
  leaveDays: number;
  workingHoursPerDay: number;
  sleepHoursPerDay: number;
  gettingReadyHoursPerDay: number;
  commuteDaysPerWeek: number;
  commuteHoursPerDay: number;
  exerciseDaysPerWeek: number;
  /** Minutes of exercise on each exercise day. */
  exerciseMinutesPerDay: number;
  learningHoursPerWeek: number;
  friendsHoursPerWeek: number;
}

/**
 * A UK starting point combining published statistics and rounded planning
 * assumptions. The page explains the sources, populations and dates.
 */
export const AVERAGE_YEAR_HOURS_INPUT: YearHoursInput = {
  workingDaysPerWeek: 5,
  bankHolidays: 8,
  leaveDays: 25,
  workingHoursPerDay: 7.5,
  sleepHoursPerDay: 7.5,
  gettingReadyHoursPerDay: 1,
  commuteDaysPerWeek: 5,
  commuteHoursPerDay: 1,
  exerciseDaysPerWeek: 0,
  exerciseMinutesPerDay: 60,
  learningHoursPerWeek: 0,
  friendsHoursPerWeek: 4,
};

/** Dhyan's own year, which the page opens on: a 40-hour week and 26 days' leave. */
export const DHYAN_YEAR_HOURS_INPUT: YearHoursInput = {
  workingDaysPerWeek: 5,
  bankHolidays: 8,
  leaveDays: 26,
  workingHoursPerDay: 8,
  sleepHoursPerDay: 8,
  gettingReadyHoursPerDay: 1,
  commuteDaysPerWeek: 0,
  commuteHoursPerDay: 0,
  exerciseDaysPerWeek: 0,
  exerciseMinutesPerDay: 0,
  learningHoursPerWeek: 0,
  friendsHoursPerWeek: 0,
};

/** Whether every field of `input` equals the same field of `preset`. */
export const matchesYearHoursInput = (input: YearHoursInput, preset: YearHoursInput): boolean =>
  (Object.keys(preset) as (keyof YearHoursInput)[]).every((key) => input[key] === preset[key]);

export type YearTimeUnit = 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks';

/**
 * Each unit as a fraction of an hour, numerator over denominator, so that
 * converting multiplies and divides by whole numbers: 8,760 hours is exactly
 * 31,536,000 seconds and 365 days.
 */
const PER_HOUR: Record<YearTimeUnit, readonly [number, number]> = {
  seconds: [3600, 1],
  minutes: [60, 1],
  hours: [1, 1],
  days: [1, 24],
  weeks: [1, 168],
};

/** `hours` expressed in `unit`. */
export const hoursIn = (hours: number, unit: YearTimeUnit): number => {
  const [numerator, denominator] = PER_HOUR[unit];
  return (hours * numerator) / denominator;
};

export type YearActivityKey =
  | 'sleep'
  | 'work'
  | 'commute'
  | 'gettingReady'
  | 'exercise'
  | 'learning'
  | 'friends'
  | 'free';

export interface YearActivity {
  key: YearActivityKey;
  hoursPerYear: number;
  /** Hours a day, averaged over all 365 days rather than the days it happens. */
  hoursPerDay: number;
  /** Share of the year, 0 to 1. */
  share: number;
}

export interface YearHours {
  /** Days off each week across the year; see `weekendDaysInYear`. */
  weekendDays: number;
  /** Days worked: the year less weekends, bank holidays and leave. Never negative. */
  workDays: number;
  /** Hours in a normal working week, before leave and bank holidays: 5 x 8 = 40. */
  workingWeekHours: number;
  /** One entry per activity, in a fixed order, including those at zero. */
  activities: YearActivity[];
  /** Everything except free time. */
  allocatedHours: number;
  /**
   * Hours entered beyond the year's 8,760, or 0. Free time is 0 whenever this
   * is positive, so the activities then add up to more than a year.
   */
  overAllocatedHours: number;
}

export function yearHours(input: YearHoursInput): YearHours {
  const workingDaysPerWeek = Math.min(7, atLeastZero(input.workingDaysPerWeek));
  const weekendDays = weekendDaysInYear(workingDaysPerWeek);
  const workDays =
    workingDaysPerWeek === 0
      ? 0
      : atLeastZero(DAYS_IN_YEAR - weekendDays - atLeastZero(input.bankHolidays) - atLeastZero(input.leaveDays));
  // Commuting happens only on working days, so a three-day pattern in a
  // five-day week covers three fifths of the days actually worked.
  const commuteDays = Math.min(workingDaysPerWeek, atLeastZero(input.commuteDaysPerWeek));

  const perYear: Record<Exclude<YearActivityKey, 'free'>, number> = {
    sleep: atLeastZero(input.sleepHoursPerDay) * DAYS_IN_YEAR,
    work: workDays * atLeastZero(input.workingHoursPerDay),
    commute:
      workingDaysPerWeek === 0
        ? 0
        : (commuteDays * atLeastZero(input.commuteHoursPerDay) * workDays) / workingDaysPerWeek,
    gettingReady: atLeastZero(input.gettingReadyHoursPerDay) * DAYS_IN_YEAR,
    exercise:
      ((atLeastZero(input.exerciseDaysPerWeek) * atLeastZero(input.exerciseMinutesPerDay)) / 60) * WEEKS_IN_YEAR,
    learning: atLeastZero(input.learningHoursPerWeek) * WEEKS_IN_YEAR,
    friends: atLeastZero(input.friendsHoursPerWeek) * WEEKS_IN_YEAR,
  };

  const allocatedHours = Object.values(perYear).reduce((sum, hours) => sum + hours, 0);
  const free = atLeastZero(HOURS_IN_YEAR - allocatedHours);

  const order: YearActivityKey[] = [
    'sleep',
    'work',
    'commute',
    'gettingReady',
    'exercise',
    'learning',
    'friends',
    'free',
  ];

  return {
    weekendDays,
    workDays,
    workingWeekHours: workingDaysPerWeek * atLeastZero(input.workingHoursPerDay),
    activities: order.map((key) => {
      const hoursPerYear = key === 'free' ? free : perYear[key];
      return {
        key,
        hoursPerYear,
        hoursPerDay: hoursPerYear / DAYS_IN_YEAR,
        share: hoursPerYear / HOURS_IN_YEAR,
      };
    }),
    allocatedHours,
    overAllocatedHours: atLeastZero(allocatedHours - HOURS_IN_YEAR),
  };
}
