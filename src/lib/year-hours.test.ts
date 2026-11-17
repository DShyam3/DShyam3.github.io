import { describe, expect, it } from 'vitest';
import {
  AVERAGE_YEAR_HOURS_INPUT,
  DHYAN_YEAR_HOURS_INPUT,
  HOURS_IN_YEAR,
  hoursIn,
  daysOffInYear,
  matchesYearHoursInput,
  YEAR_SLICES,
  yearHours,
  yearTotal,
  type YearActivityKey,
  type YearHoursInput,
} from './year-hours';

const hoursOf = (input: YearHoursInput, key: YearActivityKey) =>
  yearHours(input).activities.find((activity) => activity.key === key)!.hoursPerYear;

describe('yearHours', () => {
  it('counts a year as 8,760 hours', () => {
    expect(HOURS_IN_YEAR).toBe(8760);
  });

  it('takes days off from the working week over 52 whole weeks', () => {
    expect(daysOffInYear(5)).toBe(104);
    expect(daysOffInYear(4)).toBe(156);
    expect(daysOffInYear(6)).toBe(52);
    expect(daysOffInYear(7)).toBe(0);
    expect(daysOffInYear(0)).toBe(365);
    expect(daysOffInYear(9)).toBe(0);
    expect(yearHours(AVERAGE_YEAR_HOURS_INPUT).daysOff).toBe(104);
  });

  it('gives the working week before leave, which the yearly average sits below', () => {
    const result = yearHours(DHYAN_YEAR_HOURS_INPUT);
    expect(result.workingWeekHours).toBe(40);
    const work = result.activities.find((a) => a.key === 'work')!;
    // 227 days of 8 hours spread over 365/7 weeks: about 34.8.
    expect(work.hoursPerWeek).toBeCloseTo((227 * 8 * 7) / 365, 9);
    expect(work.hoursPerWeek).toBeLessThan(result.workingWeekHours);
    // The 34 days of bank holidays and leave that pull it below.
    expect(result.holidayDays).toBe(34);
  });

  it('works fewer days, and commutes fewer, in a four-day week', () => {
    const input: YearHoursInput = { ...AVERAGE_YEAR_HOURS_INPUT, workingDaysPerWeek: 4 };
    const result = yearHours(input);
    // 365 - 156 - 8 - 25
    expect(result.workDays).toBe(176);
    expect(result.workingWeekHours).toBe(32);
    // Five commute days cap at the four worked, so every working day commutes.
    expect(hoursOf(input, 'commute')).toBe(176);
  });

  it('works and commutes nothing in a zero-day week', () => {
    const input: YearHoursInput = { ...AVERAGE_YEAR_HOURS_INPUT, workingDaysPerWeek: 0 };
    expect(yearHours(input).workDays).toBe(0);
    expect(hoursOf(input, 'work')).toBe(0);
    expect(hoursOf(input, 'commute')).toBe(0);
    // Every day is off, not 52 weeks' worth of them.
    expect(yearHours(input).daysOff).toBe(365);
  });

  it('works every day of a seven-day week but bank holidays and leave', () => {
    const input: YearHoursInput = { ...AVERAGE_YEAR_HOURS_INPUT, workingDaysPerWeek: 7, commuteDaysPerWeek: 9 };
    const result = yearHours(input);
    expect(result.daysOff).toBe(0);
    // 365 - 0 - 8 - 25
    expect(result.workDays).toBe(332);
    expect(result.workingWeekHours).toBe(56);
    // Nine commute days cap at the seven worked: one round trip each working day.
    expect(hoursOf(input, 'commute')).toBe(332);
  });

  it('works the days left after days off, bank holidays and leave', () => {
    const result = yearHours(AVERAGE_YEAR_HOURS_INPUT);
    // 365 - 104 - 8 - 25
    expect(result.workDays).toBe(228);
    // 7.5 paid hours and a 30-minute unpaid lunch.
    expect(hoursOf(AVERAGE_YEAR_HOURS_INPUT, 'work')).toBe(228 * 8);
  });

  it("works Dhyan's 8-hour days with 26 days' leave", () => {
    const result = yearHours(DHYAN_YEAR_HOURS_INPUT);
    // 365 - 104 - 8 - 26
    expect(result.workDays).toBe(227);
    expect(hoursOf(DHYAN_YEAR_HOURS_INPUT, 'work')).toBe(227 * 8);
  });

  it('allocates the UK starting point without treating optional activities as averages', () => {
    expect(hoursOf(AVERAGE_YEAR_HOURS_INPUT, 'sleep')).toBe(2737.5);
    expect(hoursOf(AVERAGE_YEAR_HOURS_INPUT, 'gettingReady')).toBe(365);
    expect(hoursOf(AVERAGE_YEAR_HOURS_INPUT, 'eating')).toBe(365);
    expect(hoursOf(AVERAGE_YEAR_HOURS_INPUT, 'housework')).toBe(912.5);
    expect(hoursOf(AVERAGE_YEAR_HOURS_INPUT, 'caring')).toBe(0);
    expect(hoursOf(AVERAGE_YEAR_HOURS_INPUT, 'commute')).toBe(228);
    expect(hoursOf(AVERAGE_YEAR_HOURS_INPUT, 'friends')).toBeCloseTo(4 * 365 / 7, 9);
    expect(hoursOf(AVERAGE_YEAR_HOURS_INPUT, 'exercise')).toBe(0);
    expect(hoursOf(AVERAGE_YEAR_HOURS_INPUT, 'learning')).toBe(0);
  });

  it("allocates the owner's own routine", () => {
    expect(hoursOf(DHYAN_YEAR_HOURS_INPUT, 'sleep')).toBe(2737.5);
    expect(hoursOf(DHYAN_YEAR_HOURS_INPUT, 'gettingReady')).toBe(365);
    expect(hoursOf(DHYAN_YEAR_HOURS_INPUT, 'eating')).toBe(365);
    expect(hoursOf(DHYAN_YEAR_HOURS_INPUT, 'housework')).toBe(547.5);
    // On site all five days, two hours there and back, on each of 227 working days.
    expect(hoursOf(DHYAN_YEAR_HOURS_INPUT, 'commute')).toBe(227 * 2);
    for (const key of ['caring', 'exercise', 'learning', 'friends'] as const) {
      expect(hoursOf(DHYAN_YEAR_HOURS_INPUT, key)).toBe(0);
    }
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

  it('lists the needs, then the free time, including activities at zero', () => {
    const activities = yearHours(AVERAGE_YEAR_HOURS_INPUT).activities;
    expect(activities.map((a) => a.key)).toEqual([
      'sleep',
      'work',
      'commute',
      'gettingReady',
      'eating',
      'housework',
      'caring',
      'exercise',
      'learning',
      'friends',
      'free',
    ]);
    expect(activities.filter((a) => a.group === 'needs').map((a) => a.key)).toEqual([
      'sleep',
      'work',
      'commute',
      'gettingReady',
      'eating',
      'housework',
      'caring',
    ]);
  });

  it('leaves as free time whatever the needs do not take', () => {
    const result = yearHours(DHYAN_YEAR_HOURS_INPUT);
    // Sleep 7.5, personal care 1, eating 1 and housework 1.5 hours a day, and
    // 227 days of 8 hours' work and a 2-hour commute.
    const needs = (7.5 + 1 + 1 + 1.5) * 365 + 227 * 8 + 227 * 2;
    expect(result.needsHours).toBeCloseTo(needs, 9);
    expect(result.freeTimeHours).toBeCloseTo(HOURS_IN_YEAR - needs, 9);
    expect(result.freeTimeHours).toBeCloseTo(2475, 9);
    expect(result.fittedHours).toBe(0);
    expect(hoursOf(DHYAN_YEAR_HOURS_INPUT, 'free')).toBeCloseTo(result.freeTimeHours, 9);
  });

  it('splits the free time between what is fitted in and what is still free', () => {
    const input: YearHoursInput = {
      ...DHYAN_YEAR_HOURS_INPUT,
      exerciseDaysPerWeek: 5,
      exerciseMinutesPerDay: 30,
      learningHoursPerWeek: 3,
      friendsHoursPerWeek: 6,
    };
    const result = yearHours(input);
    const freeTime = result.activities.filter((a) => a.group === 'freeTime');
    // 150 minutes a week, the NHS minimum, is 2.5 hours a week.
    expect(result.fittedHours).toBeCloseTo(((2.5 + 3 + 6) * 365) / 7, 9);
    expect(freeTime.reduce((sum, a) => sum + a.hoursPerYear, 0)).toBeCloseTo(result.freeTimeHours, 9);
    expect(freeTime.reduce((sum, a) => sum + a.shareOfFreeTime, 0)).toBeCloseTo(1, 12);
    for (const need of result.activities.filter((a) => a.group === 'needs')) {
      expect(need.shareOfFreeTime).toBe(0);
    }
  });

  it('leaves no free time when the needs alone fill the year', () => {
    const input: YearHoursInput = { ...DHYAN_YEAR_HOURS_INPUT, sleepHoursPerDay: 16, caringHoursPerDay: 8 };
    const result = yearHours(input);
    expect(result.freeTimeHours).toBe(0);
    expect(result.overAllocatedHours).toBeGreaterThan(0);
    for (const activity of result.activities) expect(activity.shareOfFreeTime).toBe(0);
  });

  it('spreads a year of hours evenly over its days and weeks', () => {
    expect(yearTotal(HOURS_IN_YEAR)).toEqual({ hoursPerYear: 8760, hoursPerDay: 24, hoursPerWeek: 168, share: 1 });
    expect(yearTotal(0)).toEqual({ hoursPerYear: 0, hoursPerDay: 0, hoursPerWeek: 0, share: 0 });
    const work = yearHours(DHYAN_YEAR_HOURS_INPUT).activities.find((a) => a.key === 'work')!;
    expect(work.hoursPerWeek).toBeCloseTo(work.hoursPerDay * 7, 12);
  });

  it('puts every activity in exactly one slice, and the slices add up to the total', () => {
    const result = yearHours(DHYAN_YEAR_HOURS_INPUT);
    const members = YEAR_SLICES.flatMap((slice) => [...slice.members]).sort();
    expect(members).toEqual(result.activities.map((a) => a.key).sort());
    const byKey = Object.fromEntries(result.slices.map((slice) => [slice.key, slice.hoursPerYear]));
    expect(byKey.sleep).toBe(2737.5);
    // Commute 454, personal care 365, eating 365, housework 547.5, caring 0.
    expect(byKey.otherNeeds).toBeCloseTo(1731.5, 9);
    expect(byKey.work).toBe(1816);
    expect(byKey.fitted).toBe(0);
    expect(byKey.free).toBeCloseTo(2475, 9);
    expect(result.slices.reduce((sum, slice) => sum + slice.hoursPerYear, 0)).toBeCloseTo(result.totalHours, 9);
    expect(result.totalHours).toBe(HOURS_IN_YEAR);
  });

  it('counts exercise in minutes a week, as the NHS minimum is', () => {
    const input: YearHoursInput = { ...DHYAN_YEAR_HOURS_INPUT, exerciseDaysPerWeek: 5, exerciseMinutesPerDay: 30 };
    expect(yearHours(input).exerciseMinutesPerWeek).toBe(150);
    expect(yearHours(DHYAN_YEAR_HOURS_INPUT).exerciseMinutesPerWeek).toBe(0);
  });

  it('keeps the free-time rows adding up to their subtotal when more is fitted in than is free', () => {
    const input: YearHoursInput = { ...DHYAN_YEAR_HOURS_INPUT, learningHoursPerWeek: 80, friendsHoursPerWeek: 80 };
    const result = yearHours(input);
    const freeTime = result.activities.filter((a) => a.group === 'freeTime');
    const stillFree = freeTime.find((a) => a.key === 'free')!;
    expect(stillFree.hoursPerYear).toBe(0);
    // The needs still leave 2,475 hours; 160 hours a week is far more.
    expect(result.freeTimeHours).toBeCloseTo(2475, 9);
    expect(result.fittedAndStillFreeHours).toBeCloseTo((160 * 365) / 7, 9);
    expect(freeTime.reduce((sum, a) => sum + a.hoursPerYear, 0)).toBeCloseTo(result.fittedAndStillFreeHours, 9);
    expect(result.needsHours + result.fittedAndStillFreeHours).toBeCloseTo(result.totalHours, 9);
    expect(result.totalHours).toBeCloseTo(result.allocatedHours, 9);
    expect(result.overAllocatedHours).toBeCloseTo(result.allocatedHours - HOURS_IN_YEAR, 9);
    // Shares of the free time pass 1 rather than being capped.
    expect(result.fittedShareOfFreeTime).toBeCloseTo(result.fittedHours / 2475, 9);
    expect(result.fittedShareOfFreeTime).toBeGreaterThan(3);
    expect(freeTime.reduce((sum, a) => sum + a.shareOfFreeTime, 0)).toBeCloseTo(result.fittedShareOfFreeTime, 9);
  });

  it('matches the free-time subtotal to the free time whenever it holds what is fitted in', () => {
    const result = yearHours({ ...DHYAN_YEAR_HOURS_INPUT, learningHoursPerWeek: 3 });
    expect(result.fittedAndStillFreeHours).toBeCloseTo(result.freeTimeHours, 9);
    expect(result.fittedShareOfFreeTime).toBeCloseTo((3 * 365) / 7 / 2475, 9);
  });
});
