import { describe, expect, it } from 'vitest';
import {
  DEFAULT_YEAR_HOURS_INPUT,
  HOURS_IN_YEAR,
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

  it('works the days left after weekends, bank holidays and leave', () => {
    const result = yearHours(DEFAULT_YEAR_HOURS_INPUT);
    // 365 - 104 - 8 - 20
    expect(result.workDays).toBe(233);
    expect(hoursOf(DEFAULT_YEAR_HOURS_INPUT, 'work')).toBe(233 * 7.5);
  });

  it('multiplies daily habits by 365 and weekly ones by 365/7', () => {
    const input: YearHoursInput = {
      ...DEFAULT_YEAR_HOURS_INPUT,
      sleepHoursPerDay: 7,
      gettingReadyHoursPerDay: 0.5,
      commuteDaysPerWeek: 3,
      commuteHoursPerDay: 2,
      gymDaysPerWeek: 4,
      gymHoursPerSession: 1.5,
      learningHoursPerWeek: 7,
      friendsHoursPerWeek: 14,
    };
    expect(hoursOf(input, 'sleep')).toBe(2555);
    expect(hoursOf(input, 'gettingReady')).toBe(182.5);
    expect(hoursOf(input, 'commute')).toBeCloseTo((6 * 365) / 7, 9);
    expect(hoursOf(input, 'gym')).toBeCloseTo((6 * 365) / 7, 9);
    expect(hoursOf(input, 'learning')).toBeCloseTo(365, 9);
    expect(hoursOf(input, 'friends')).toBeCloseTo(730, 9);
  });

  it('gives free time whatever the year has left, so the parts make the whole', () => {
    const result = yearHours(DEFAULT_YEAR_HOURS_INPUT);
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
      ...DEFAULT_YEAR_HOURS_INPUT,
      sleepHoursPerDay: 12,
      gettingReadyHoursPerDay: 8,
      friendsHoursPerWeek: 60,
    };
    const result = yearHours(input);
    expect(hoursOf(input, 'free')).toBe(0);
    expect(result.overAllocatedHours).toBeCloseTo(result.allocatedHours - HOURS_IN_YEAR, 9);
    expect(result.overAllocatedHours).toBeGreaterThan(0);
  });

  it('never works a negative number of days', () => {
    const input: YearHoursInput = { ...DEFAULT_YEAR_HOURS_INPUT, weekendDays: 300, leaveDays: 100 };
    expect(yearHours(input).workDays).toBe(0);
    expect(hoursOf(input, 'work')).toBe(0);
  });

  it('treats a negative or non-numeric entry as zero', () => {
    const input: YearHoursInput = {
      ...DEFAULT_YEAR_HOURS_INPUT,
      sleepHoursPerDay: -3,
      learningHoursPerWeek: Number.NaN,
    };
    expect(hoursOf(input, 'sleep')).toBe(0);
    expect(hoursOf(input, 'learning')).toBe(0);
  });

  it('lists every activity in a fixed order, including those at zero', () => {
    expect(yearHours(DEFAULT_YEAR_HOURS_INPUT).activities.map((a) => a.key)).toEqual([
      'sleep',
      'work',
      'commute',
      'gettingReady',
      'gym',
      'learning',
      'friends',
      'free',
    ]);
  });
});
