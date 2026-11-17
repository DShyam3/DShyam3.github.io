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
 * since the calendar fixes how many weeks there are. Which days they are does
 * not matter, so a week worked Tuesday to Saturday counts the same.
 */
export const daysOffInYear = (workingDaysPerWeek: number): number => {
  const days = Math.min(7, atLeastZero(workingDaysPerWeek));
  // With no working week every day is off, the 365th included.
  return days === 0 ? DAYS_IN_YEAR : (7 - days) * WHOLE_WEEKS_IN_YEAR;
};

export interface YearHoursInput {
  /** Days worked in a normal week, 0 to 7, weekends included. */
  workingDaysPerWeek: number;
  bankHolidays: number;
  /** Paid leave taken, in days. */
  leaveDays: number;
  /** Time at work, lunch and breaks included whether paid or not. */
  workingHoursPerDay: number;
  sleepHoursPerDay: number;
  gettingReadyHoursPerDay: number;
  eatingHoursPerDay: number;
  /** Cooking, cleaning, laundry, shopping and household admin. */
  houseworkHoursPerDay: number;
  /** Looking after children or adults who depend on you. */
  caringHoursPerDay: number;
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
  workingHoursPerDay: 8,
  sleepHoursPerDay: 7.5,
  gettingReadyHoursPerDay: 1,
  eatingHoursPerDay: 1,
  houseworkHoursPerDay: 2.5,
  caringHoursPerDay: 0,
  commuteDaysPerWeek: 5,
  commuteHoursPerDay: 1,
  exerciseDaysPerWeek: 0,
  exerciseMinutesPerDay: 60,
  learningHoursPerWeek: 0,
  friendsHoursPerWeek: 4,
};

/**
 * Dhyan's own year, which the page opens on: a 40-hour week on site five days,
 * a two-hour round trip, and 26 days' leave.
 */
export const DHYAN_YEAR_HOURS_INPUT: YearHoursInput = {
  workingDaysPerWeek: 5,
  bankHolidays: 8,
  leaveDays: 26,
  workingHoursPerDay: 8,
  sleepHoursPerDay: 7.5,
  gettingReadyHoursPerDay: 1,
  eatingHoursPerDay: 1,
  houseworkHoursPerDay: 1.5,
  caringHoursPerDay: 0,
  commuteDaysPerWeek: 5,
  commuteHoursPerDay: 2,
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

/** What has to happen, in the order the page lists it. */
const NEED_KEYS = ['sleep', 'work', 'commute', 'gettingReady', 'eating', 'housework', 'caring'] as const;
/** What is chosen to fill the time the needs leave, then what is still free. */
const FREE_TIME_KEYS = ['exercise', 'learning', 'friends', 'free'] as const;

export type YearActivityKey = (typeof NEED_KEYS)[number] | (typeof FREE_TIME_KEYS)[number];
export type YearActivityGroup = 'needs' | 'freeTime';

/** A number of hours a year, and the same spread evenly over every day and week of it. */
export interface YearTotal {
  hoursPerYear: number;
  /** Averaged over all 365 days rather than the days it happens. */
  hoursPerDay: number;
  /** Seven average days. */
  hoursPerWeek: number;
  /** Share of the year's 8,760 hours: 0 to 1, more once the year is over-filled. */
  share: number;
}

export const yearTotal = (hoursPerYear: number): YearTotal => ({
  hoursPerYear,
  hoursPerDay: hoursPerYear / DAYS_IN_YEAR,
  hoursPerWeek: (hoursPerYear / DAYS_IN_YEAR) * 7,
  share: hoursPerYear / HOURS_IN_YEAR,
});

export interface YearActivity extends YearTotal {
  key: YearActivityKey;
  group: YearActivityGroup;
  /**
   * Share of the free time the needs leave, 0 for a need or when none is left.
   * Above 1 when more is fitted in than the needs leave.
   */
  shareOfFreeTime: number;
}

/**
 * The activities in five groups, which the page's chart draws instead of
 * eleven: the smaller needs together, and what is fitted into free time.
 */
export const YEAR_SLICES = [
  { key: 'sleep', members: ['sleep'] },
  { key: 'otherNeeds', members: ['commute', 'gettingReady', 'eating', 'housework', 'caring'] },
  { key: 'work', members: ['work'] },
  { key: 'fitted', members: ['exercise', 'learning', 'friends'] },
  { key: 'free', members: ['free'] },
] as const satisfies readonly { key: string; members: readonly YearActivityKey[] }[];

export type YearSliceKey = (typeof YEAR_SLICES)[number]['key'];

export interface YearSlice extends YearTotal {
  key: YearSliceKey;
  members: readonly YearActivityKey[];
}

export interface YearHours {
  /** Days off each week across the year; see `daysOffInYear`. */
  daysOff: number;
  /** Days worked: the year less days off, bank holidays and leave. Never negative. */
  workDays: number;
  /** Bank holidays and leave together: why work averages below the working week. */
  holidayDays: number;
  /** Hours in a normal working week, before leave and bank holidays: 5 x 8 = 40. */
  workingWeekHours: number;
  /** Minutes of exercise in a week: the figure the NHS minimum is set against. */
  exerciseMinutesPerWeek: number;
  /** One entry per activity, needs then free time, including those at zero. */
  activities: YearActivity[];
  /** The activities in `YEAR_SLICES` order, including those at zero. */
  slices: YearSlice[];
  /** Every need added up. */
  needsHours: number;
  /** The year less the needs: what is left to choose how to spend. Never negative. */
  freeTimeHours: number;
  /** Exercise, learning and socialising: what is chosen to fill the free time. */
  fittedHours: number;
  /** What is fitted in as a share of the free time; 0 when none is left, above 1 when over-filled. */
  fittedShareOfFreeTime: number;
  /**
   * What the free-time activities add up to: what is fitted in and what is
   * still free. Equals `freeTimeHours` unless more is fitted in than it holds.
   */
  fittedAndStillFreeHours: number;
  /** Needs and what is fitted in: everything except what is still free. */
  allocatedHours: number;
  /** Every activity, still free included: 8,760, or more once over-filled. */
  totalHours: number;
  /**
   * Hours entered beyond the year's 8,760, or 0. Nothing is still free whenever
   * this is positive, so the activities then add up to more than a year.
   */
  overAllocatedHours: number;
}

export function yearHours(input: YearHoursInput): YearHours {
  const workingDaysPerWeek = Math.min(7, atLeastZero(input.workingDaysPerWeek));
  const daysOff = daysOffInYear(workingDaysPerWeek);
  const holidayDays = atLeastZero(input.bankHolidays) + atLeastZero(input.leaveDays);
  const workDays = workingDaysPerWeek === 0 ? 0 : atLeastZero(DAYS_IN_YEAR - daysOff - holidayDays);
  // Commuting happens only on working days, so a three-day pattern in a
  // five-day week covers three fifths of the days actually worked.
  const commuteDays = Math.min(workingDaysPerWeek, atLeastZero(input.commuteDaysPerWeek));
  const exerciseMinutesPerWeek = atLeastZero(input.exerciseDaysPerWeek) * atLeastZero(input.exerciseMinutesPerDay);

  const perYear: Record<Exclude<YearActivityKey, 'free'>, number> = {
    sleep: atLeastZero(input.sleepHoursPerDay) * DAYS_IN_YEAR,
    work: workDays * atLeastZero(input.workingHoursPerDay),
    commute:
      workingDaysPerWeek === 0
        ? 0
        : (commuteDays * atLeastZero(input.commuteHoursPerDay) * workDays) / workingDaysPerWeek,
    gettingReady: atLeastZero(input.gettingReadyHoursPerDay) * DAYS_IN_YEAR,
    eating: atLeastZero(input.eatingHoursPerDay) * DAYS_IN_YEAR,
    housework: atLeastZero(input.houseworkHoursPerDay) * DAYS_IN_YEAR,
    caring: atLeastZero(input.caringHoursPerDay) * DAYS_IN_YEAR,
    exercise: (exerciseMinutesPerWeek / 60) * WEEKS_IN_YEAR,
    learning: atLeastZero(input.learningHoursPerWeek) * WEEKS_IN_YEAR,
    friends: atLeastZero(input.friendsHoursPerWeek) * WEEKS_IN_YEAR,
  };

  const needsHours = NEED_KEYS.reduce((sum, key) => sum + perYear[key], 0);
  const fittedHours = perYear.exercise + perYear.learning + perYear.friends;
  const allocatedHours = needsHours + fittedHours;
  const freeTimeHours = atLeastZero(HOURS_IN_YEAR - needsHours);
  const free = atLeastZero(HOURS_IN_YEAR - allocatedHours);
  const hoursOf = (key: YearActivityKey) => (key === 'free' ? free : perYear[key]);

  const activity = (key: YearActivityKey, group: YearActivityGroup): YearActivity => ({
    key,
    group,
    ...yearTotal(hoursOf(key)),
    shareOfFreeTime: group === 'freeTime' && freeTimeHours > 0 ? hoursOf(key) / freeTimeHours : 0,
  });

  return {
    daysOff,
    workDays,
    holidayDays,
    workingWeekHours: workingDaysPerWeek * atLeastZero(input.workingHoursPerDay),
    exerciseMinutesPerWeek,
    activities: [
      ...NEED_KEYS.map((key) => activity(key, 'needs')),
      ...FREE_TIME_KEYS.map((key) => activity(key, 'freeTime')),
    ],
    slices: YEAR_SLICES.map(({ key, members }) => ({
      key,
      members,
      ...yearTotal(members.reduce((sum, member: YearActivityKey) => sum + hoursOf(member), 0)),
    })),
    needsHours,
    freeTimeHours,
    fittedHours,
    fittedShareOfFreeTime: freeTimeHours > 0 ? fittedHours / freeTimeHours : 0,
    fittedAndStillFreeHours: fittedHours + free,
    allocatedHours,
    totalHours: allocatedHours + free,
    overAllocatedHours: atLeastZero(allocatedHours - HOURS_IN_YEAR),
  };
}
