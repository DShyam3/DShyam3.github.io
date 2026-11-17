import { describe, expect, it } from 'vitest';
import {
  AVERAGE_YEAR_HOURS_INPUT,
  DHYAN_YEAR_HOURS_INPUT,
  HOURS_IN_YEAR,
  hoursIn,
  matchesYearHoursInput,
  weekendDaysInYear,
  yearHours,
  type YearActivityKey,
  type YearHoursInput,
} from './year-hours';

const hoursOf = (input: YearHoursInput, key: YearActivityKey) =>
  yearHours(input).activities.find((activity) => activity.key === key)!.hoursPerYear;

describe('yearHours', () => {
  it('counts a year as 8,760 hours', () => {
    expect(HOURS_IN_YEAR).toBe(8760);
  });

  it('takes weekends from the working week over 52 whole weeks', () => {
    expect(weekendDaysInYear(5)).toBe(104);
    expect(weekendDaysInYear(4)).toBe(156);
    expect(weekendDaysInYear(7)).toBe(0);
    expect(weekendDaysInYear(0)).toBe(364);
    expect(weekendDaysInYear(9)).toBe(0);
    expect(yearHours(AVERAGE_YEAR_HOURS_INPUT).weekendDays).toBe(104);
  });

  it('gives the working week before leave, which the yearly average sits below', () => {
    const result = yearHours(DHYAN_YEAR_HOURS_INPUT);
    expect(result.workingWeekHours).toBe(40);
    const work = result.activities.find((a) => a.key === 'work')!;
    // 227 days of 8 hours spread over 365/7 weeks: about 34.8.
    expect(work.hoursPerDay * 7).toBeCloseTo((227 * 8 * 7) / 365, 9);
    expect(work.hoursPerDay * 7).toBeLessThan(result.workingWeekHours);
  });

  it('works fewer days, and commutes fewer, in a four-day week', () => {
    const input: YearHoursInput = { ...AVERAGE_YEAR_HOURS_INPUT, workingDaysPerWeek: 4 };
    const result = yearHours(input);
    // 365 - 156 - 8 - 25
    expect(result.workDays).toBe(176);
    expect(result.workingWeekHours).toBe(30);
    // Five commute days cap at the four worked, so every working day commutes.
    expect(hoursOf(input, 'commute')).toBe(176);
  });

  it('works and commutes nothing in a zero-day week', () => {
    const input: YearHoursInput = { ...AVERAGE_YEAR_HOURS_INPUT, workingDaysPerWeek: 0 };
    expect(yearHours(input).workDays).toBe(0);
    expect(hoursOf(input, 'work')).toBe(0);
    expect(hoursOf(input, 'commute')).toBe(0);
  });

  it('works the days left after weekends, bank holidays and leave', () => {
    const result = yearHours(AVERAGE_YEAR_HOURS_INPUT);
    // 365 - 104 - 8 - 25
    expect(result.workDays).toBe(228);
    expect(hoursOf(AVERAGE_YEAR_HOURS_INPUT, 'work')).toBe(1710);
  });

  it("works Dhyan's 8-hour days with 26 days' leave", () => {
    const result = yearHours(DHYAN_YEAR_HOURS_INPUT);
    // 365 - 104 - 8 - 26
    expect(result.workDays).toBe(227);
    expect(hoursOf(DHYAN_YEAR_HOURS_INPUT, 'work')).toBe(227 * 8);
    // A 40-hour week.
    expect(DHYAN_YEAR_HOURS_INPUT.workingHoursPerDay * 5).toBe(40);
  });

  it('allocates the UK starting point without treating optional activities as averages', () => {
    expect(hoursOf(AVERAGE_YEAR_HOURS_INPUT, 'sleep')).toBe(2737.5);
    expect(hoursOf(AVERAGE_YEAR_HOURS_INPUT, 'gettingReady')).toBe(365);
    expect(hoursOf(AVERAGE_YEAR_HOURS_INPUT, 'commute')).toBe(228);
    expect(hoursOf(AVERAGE_YEAR_HOURS_INPUT, 'friends')).toBeCloseTo(4 * 365 / 7, 9);
    expect(hoursOf(AVERAGE_YEAR_HOURS_INPUT, 'exercise')).toBe(0);
    expect(hoursOf(AVERAGE_YEAR_HOURS_INPUT, 'learning')).toBe(0);
  });

  it('keeps the owner routine independent of the UK starting point', () => {
    expect(hoursOf(DHYAN_YEAR_HOURS_INPUT, 'sleep')).toBe(2920);
    expect(hoursOf(DHYAN_YEAR_HOURS_INPUT, 'gettingReady')).toBe(365);
    for (const key of ['commute', 'exercise', 'learning', 'friends'] as const) {
      expect(hoursOf(DHYAN_YEAR_HOURS_INPUT, key)).toBe(0);
    }
    expect(DHYAN_YEAR_HOURS_INPUT.commuteHoursPerDay).toBe(0);
    expect(DHYAN_YEAR_HOURS_INPUT.exerciseMinutesPerDay).toBe(0);
  });

  it('matches an input to a preset only when every field agrees', () => {
    expect(matchesYearHoursInput({ ...DHYAN_YEAR_HOURS_INPUT }, DHYAN_YEAR_HOURS_INPUT)).toBe(true);
    expect(matchesYearHoursInput(DHYAN_YEAR_HOURS_INPUT, AVERAGE_YEAR_HOURS_INPUT)).toBe(false);
    expect(
      matchesYearHoursInput({ ...AVERAGE_YEAR_HOURS_INPUT, sleepHoursPerDay: 7 }, AVERAGE_YEAR_HOURS_INPUT),
    ).toBe(false);
  });

  it('converts a year of hours into every unit exactly', () => {
    expect(hoursIn(HOURS_IN_YEAR, 'seconds')).toBe(31_536_000);
    expect(hoursIn(HOURS_IN_YEAR, 'minutes')).toBe(525_600);
    expect(hoursIn(HOURS_IN_YEAR, 'hours')).toBe(8760);
    expect(hoursIn(HOURS_IN_YEAR, 'days')).toBe(365);
    expect(hoursIn(HOURS_IN_YEAR, 'weeks')).toBeCloseTo(365 / 7, 12);
    expect(hoursIn(168, 'weeks')).toBe(1);
  });

  it('scales daily and weekly habits separately from workday commuting', () => {
    const input: YearHoursInput = {
      ...AVERAGE_YEAR_HOURS_INPUT,
      sleepHoursPerDay: 7,
      gettingReadyHoursPerDay: 0.5,
      commuteDaysPerWeek: 3,
      commuteHoursPerDay: 2,
      exerciseDaysPerWeek: 4,
      exerciseMinutesPerDay: 90,
      learningHoursPerWeek: 7,
      friendsHoursPerWeek: 14,
    };
    expect(hoursOf(input, 'sleep')).toBe(2555);
    expect(hoursOf(input, 'gettingReady')).toBe(182.5);
    expect(hoursOf(input, 'commute')).toBeCloseTo((6 * 228) / 5, 9);
    // 4 days of 90 minutes is 6 hours a week.
    expect(hoursOf(input, 'exercise')).toBeCloseTo((6 * 365) / 7, 9);
    expect(hoursOf(input, 'learning')).toBeCloseTo(365, 9);
    expect(hoursOf(input, 'friends')).toBeCloseTo(730, 9);
  });

  it('gives free time whatever the year has left, so the parts make the whole', () => {
    const result = yearHours(AVERAGE_YEAR_HOURS_INPUT);
    const total = result.activities.reduce((sum, activity) => sum + activity.hoursPerYear, 0);
    expect(total).toBeCloseTo(HOURS_IN_YEAR, 9);
    expect(result.overAllocatedHours).toBe(0);

    const shares = result.activities.reduce((sum, activity) => sum + activity.share, 0);
    expect(shares).toBeCloseTo(1, 12);
    const perDay = result.activities.reduce((sum, activity) => sum + activity.hoursPerDay, 0);
    expect(perDay).toBeCloseTo(24, 9);
  });

  it('reports the excess and leaves no free time when more than a year is entered', () => {
    const input: YearHoursInput = {
      ...AVERAGE_YEAR_HOURS_INPUT,
      sleepHoursPerDay: 12,
      gettingReadyHoursPerDay: 8,
      friendsHoursPerWeek: 60,
    };
    const result = yearHours(input);
    expect(hoursOf(input, 'free')).toBe(0);
    expect(result.overAllocatedHours).toBeCloseTo(result.allocatedHours - HOURS_IN_YEAR, 9);
    expect(result.overAllocatedHours).toBeGreaterThan(0);
  });

  it('commutes only on working days and caps the pattern at the working week', () => {
    expect(hoursOf({ ...AVERAGE_YEAR_HOURS_INPUT, commuteDaysPerWeek: 0 }, 'commute')).toBe(0);
    expect(hoursOf({ ...AVERAGE_YEAR_HOURS_INPUT, commuteHoursPerDay: 2 }, 'commute')).toBe(456);
    expect(hoursOf({ ...AVERAGE_YEAR_HOURS_INPUT, commuteDaysPerWeek: 7, commuteHoursPerDay: 2 }, 'commute')).toBe(456);
    expect(hoursOf({ ...AVERAGE_YEAR_HOURS_INPUT, leaveDays: 300 }, 'commute')).toBe(0);
  });

  it('never works a negative number of days', () => {
    const input: YearHoursInput = { ...AVERAGE_YEAR_HOURS_INPUT, bankHolidays: 100, leaveDays: 200 };
    expect(yearHours(input).workDays).toBe(0);
    expect(hoursOf(input, 'work')).toBe(0);
  });

  it('treats a negative or non-numeric entry as zero', () => {
    const input: YearHoursInput = {
      ...AVERAGE_YEAR_HOURS_INPUT,
      sleepHoursPerDay: -3,
      learningHoursPerWeek: Number.NaN,
    };
    expect(hoursOf(input, 'sleep')).toBe(0);
    expect(hoursOf(input, 'learning')).toBe(0);
  });

  it('lists every activity in a fixed order, including those at zero', () => {
    expect(yearHours(AVERAGE_YEAR_HOURS_INPUT).activities.map((a) => a.key)).toEqual([
      'sleep',
      'work',
      'commute',
      'gettingReady',
      'exercise',
      'learning',
      'friends',
      'free',
    ]);
  });
});
