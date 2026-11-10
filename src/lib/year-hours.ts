/**
 * Where the 8,760 hours of a year go.
 *
 * Arithmetic over what the visitor enters: nothing here reads stored data, so
 * the public page that uses it cannot show anyone's real figures.
 */

export const DAYS_IN_YEAR = 365;
export const HOURS_IN_YEAR = DAYS_IN_YEAR * 24;
const WEEKS_IN_YEAR = DAYS_IN_YEAR / 7;

export interface YearHoursInput {
  /** Days a year that are weekends: 104 for a five-day week. */
  weekendDays: number;
  bankHolidays: number;
  /** Paid leave taken, in days. */
  leaveDays: number;
  workingHoursPerDay: number;
  sleepHoursPerDay: number;
  gettingReadyHoursPerDay: number;
  commuteDaysPerWeek: number;
  commuteHoursPerDay: number;
  gymDaysPerWeek: number;
  gymHoursPerSession: number;
  learningHoursPerWeek: number;
  friendsHoursPerWeek: number;
}

/** A five-day week with UK statutory leave and no optional activities. */
export const DEFAULT_YEAR_HOURS_INPUT: YearHoursInput = {
  weekendDays: 104,
  bankHolidays: 8,
  leaveDays: 20,
  workingHoursPerDay: 7.5,
  sleepHoursPerDay: 8,
  gettingReadyHoursPerDay: 1,
  commuteDaysPerWeek: 0,
  commuteHoursPerDay: 0,
  gymDaysPerWeek: 0,
  gymHoursPerSession: 0,
  learningHoursPerWeek: 0,
  friendsHoursPerWeek: 0,
};

export type YearActivityKey =
  | 'sleep'
  | 'work'
  | 'commute'
  | 'gettingReady'
  | 'gym'
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
  /** Days worked: the year less weekends, bank holidays and leave. Never negative. */
  workDays: number;
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

const atLeastZero = (value: number) => (Number.isFinite(value) && value > 0 ? value : 0);

export function yearHours(input: YearHoursInput): YearHours {
  const workDays = atLeastZero(
    DAYS_IN_YEAR -
      atLeastZero(input.weekendDays) -
      atLeastZero(input.bankHolidays) -
      atLeastZero(input.leaveDays),
  );

  const perYear: Record<Exclude<YearActivityKey, 'free'>, number> = {
    sleep: atLeastZero(input.sleepHoursPerDay) * DAYS_IN_YEAR,
    work: workDays * atLeastZero(input.workingHoursPerDay),
    commute:
      atLeastZero(input.commuteDaysPerWeek) * atLeastZero(input.commuteHoursPerDay) * WEEKS_IN_YEAR,
    gettingReady: atLeastZero(input.gettingReadyHoursPerDay) * DAYS_IN_YEAR,
    gym: atLeastZero(input.gymDaysPerWeek) * atLeastZero(input.gymHoursPerSession) * WEEKS_IN_YEAR,
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
    'gym',
    'learning',
    'friends',
    'free',
  ];

  return {
    workDays,
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
