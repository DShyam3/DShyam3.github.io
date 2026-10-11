import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { getNextPaydayDetails } from '@/features/finance/finance-calcs';
import { DEFAULT_BIWEEKLY_ANCHOR } from '@/features/finance/finance-defaults';
import type { FinanceSettings } from '@/features/finance/finance-types';
import { toISODate } from './dates';
import { nextPayday, paydaysBetween, paydaysPerYear } from './payday';

describe('paydaysBetween', () => {
  const all = (schedule: Parameters<typeof paydaysBetween>[0], opts: Parameters<typeof paydaysBetween>[1], from: string, to: string, holidays: string[] = []) =>
    paydaysBetween(schedule, opts, from, to, holidays);

  it('defaults to the 25th, paid on the Friday before when it falls on a weekend', () => {
    // 25 Jul 2026 is a Saturday and 25 Oct 2026 a Sunday; 25 Sep is a Friday.
    expect(all(undefined, {}, '2026-07-01', '2026-10-31')).toEqual(['2026-07-24', '2026-08-25', '2026-09-25', '2026-10-23']);
    expect(all('monthly_date', {}, '2026-07-01', '2026-10-31')).toEqual(all(undefined, {}, '2026-07-01', '2026-10-31'));
  });
  it('returns nothing for empty ranges, reversed ranges and invalid dates', () => {
    expect(all('monthly_date', {}, '2026-10-26', '2026-11-24')).toEqual([]);
    expect(all('monthly_date', {}, '2026-11-01', '2026-10-01')).toEqual([]);
    for (const bad of ['', 'bad', '2026-02-30', '2026-10-25T00:00:00Z']) {
      expect(all('monthly_date', {}, bad, '2026-12-31')).toEqual([]);
      expect(all('monthly_date', {}, '2026-01-01', bad)).toEqual([]);
    }
  });
  it('includes a single-day range that is a payday and excludes the day either side', () => {
    expect(all('monthly_date', {}, '2026-09-25', '2026-09-25')).toEqual(['2026-09-25']);
    expect(all('monthly_date', {}, '2026-09-24', '2026-09-24')).toEqual([]);
    expect(all('monthly_date', {}, '2026-09-26', '2026-09-26')).toEqual([]);
  });
  it('keeps a payday that is scheduled outside the range but paid inside it, and drops the reverse', () => {
    // 25 Oct 2026 is a Sunday, paid on Friday the 23rd.
    expect(all('monthly_date', {}, '2026-10-23', '2026-10-23')).toEqual(['2026-10-23']);
    expect(all('monthly_date', {}, '2026-10-24', '2026-10-31')).toEqual([]);
    expect(all('monthly_date', {}, '2026-10-24', '2026-10-26')).toEqual([]);
    // 1 Nov 2026 is a Sunday: the November payday lands on 30 Oct, in October.
    expect(all('monthly_date', { payDayOfMonth: 1 }, '2026-10-01', '2026-10-31')).toEqual(['2026-10-01', '2026-10-30']);
  });
  it('moves a payday back past a bank holiday and through a holiday run', () => {
    expect(all('monthly_date', {}, '2026-12-01', '2026-12-31', ['2026-12-25'])).toEqual(['2026-12-24']);
    expect(all('monthly_date', {}, '2026-12-01', '2026-12-31', ['2026-12-25', '2026-12-24'])).toEqual(['2026-12-23']);
    // 28 Dec 2026 is the Monday substitute holiday; the 31st is clear.
    expect(all('monthly_date', { payDayOfMonth: 28 }, '2026-12-01', '2026-12-31', ['2026-12-25', '2026-12-28'])).toEqual(['2026-12-24']);
  });
  it('clamps the pay day to the month length through leap and non-leap February', () => {
    // 28 Feb 2026 is a Saturday; 29 Feb 2028 is a Tuesday.
    expect(all('monthly_date', { payDayOfMonth: 31 }, '2026-01-01', '2026-03-31')).toEqual(['2026-01-30', '2026-02-27', '2026-03-31']);
    expect(all('monthly_date', { payDayOfMonth: 31 }, '2028-02-01', '2028-02-29')).toEqual(['2028-02-29']);
    expect(all('monthly_date', { payDayOfMonth: 40 }, '2028-02-01', '2028-02-29')).toEqual(['2028-02-29']);
  });
  it('takes the default pay day for 0, and reports unusable pay days as unknown', () => {
    expect(all('monthly_date', { payDayOfMonth: 0 }, '2026-09-01', '2026-09-30')).toEqual(['2026-09-25']);
    expect(all('monthly_date', { payDayOfMonth: -3 }, '2026-09-01', '2026-09-30')).toEqual([]);
    expect(all('monthly_date', { payDayOfMonth: 12.5 }, '2026-09-01', '2026-09-30')).toEqual([]);
  });
  it('pays last_working_day on the final working day of each month across the year boundary', () => {
    // 31 May 2026 Sunday, 30 Jun Tuesday, 31 Dec 2026 Thursday, 31 Jan 2027 Sunday.
    expect(all('last_working_day', {}, '2026-05-01', '2026-06-30')).toEqual(['2026-05-29', '2026-06-30']);
    expect(all('last_working_day', {}, '2026-12-01', '2027-01-31')).toEqual(['2026-12-31', '2027-01-29']);
    expect(all('last_working_day', {}, '2026-12-01', '2027-01-31', ['2026-12-31'])).toEqual(['2026-12-30', '2027-01-29']);
  });
  it('pays last_friday on the last Friday of the month, including a month ending on a Friday', () => {
    // 31 Jul 2026 and 30 Oct 2026 are Fridays; 31 Dec 2026 is a Thursday, so the 25th, a holiday.
    expect(all('last_friday', {}, '2026-07-01', '2026-07-31')).toEqual(['2026-07-31']);
    expect(all('last_friday', {}, '2026-10-01', '2026-12-31')).toEqual(['2026-10-30', '2026-11-27', '2026-12-25']);
    expect(all('last_friday', {}, '2026-12-01', '2026-12-31', ['2026-12-25'])).toEqual(['2026-12-24']);
  });
  it('pays semimonthly on the 15th and the last day, both moved back, with no duplicates', () => {
    // 15 Aug 2026 is a Saturday and 31 Aug a Monday.
    expect(all('semimonthly', {}, '2026-08-01', '2026-08-31')).toEqual(['2026-08-14', '2026-08-31']);
    expect(all('semimonthly', {}, '2026-02-01', '2026-02-28')).toEqual(['2026-02-13', '2026-02-27']);
    expect(all('semimonthly', {}, '2026-08-01', '2026-08-31', ['2026-08-31'])).toEqual(['2026-08-14', '2026-08-28']);
  });
  it('pays weekly on the chosen weekday, defaulting to Friday, moved back off weekends and holidays', () => {
    expect(all('weekly', {}, '2026-10-01', '2026-10-31')).toEqual(['2026-10-02', '2026-10-09', '2026-10-16', '2026-10-23', '2026-10-30']);
    // Saturday and Sunday paydays fall to Friday, so a Sunday weekday pays every Friday.
    expect(all('weekly', { weekday: 0 }, '2026-10-01', '2026-10-31')).toEqual(all('weekly', {}, '2026-10-01', '2026-10-31'));
    // Monday 4 May 2026 is a bank holiday: paid the Friday before.
    expect(all('weekly', { weekday: 1 }, '2026-04-27', '2026-05-11', ['2026-05-04'])).toEqual(['2026-04-27', '2026-05-01', '2026-05-11']);
    expect(all('weekly', { weekday: 9 }, '2026-10-01', '2026-10-31')).toEqual([]);
    expect(all('weekly', { weekday: 2.5 }, '2026-10-01', '2026-10-31')).toEqual([]);
  });
  it('steps a week at a time through the clocks going forward and back', () => {
    // The UK changed to BST on 29 Mar 2026 and back to GMT on 25 Oct 2026.
    expect(all('weekly', {}, '2026-03-20', '2026-04-10')).toEqual(['2026-03-20', '2026-03-27', '2026-04-03', '2026-04-10']);
    expect(all('weekly', {}, '2026-10-16', '2026-11-06')).toEqual(['2026-10-16', '2026-10-23', '2026-10-30', '2026-11-06']);
  });
  it('counts biweekly from the anchor in both directions, with the stated default anchor', () => {
    expect(all('biweekly', {}, '2026-10-01', '2026-11-30')).toEqual(['2026-10-09', '2026-10-23', '2026-11-06', '2026-11-20']);
    expect(all('biweekly', { biweeklyAnchor: DEFAULT_BIWEEKLY_ANCHOR }, '2026-10-01', '2026-11-30'))
      .toEqual(all('biweekly', {}, '2026-10-01', '2026-11-30'));
    expect(all('biweekly', { biweeklyAnchor: '2026-01-09' }, '2026-10-01', '2026-10-31')).toEqual(['2026-10-02', '2026-10-16', '2026-10-30']);
    // Before the anchor the fortnightly cycle keeps going backwards.
    expect(all('biweekly', {}, '2025-12-01', '2026-01-02')).toEqual(['2025-12-05', '2025-12-19', '2026-01-02']);
    expect(all('biweekly', { biweeklyAnchor: 'bad' }, '2026-10-01', '2026-11-30')).toEqual([]);
    // A fortnightly payday on Christmas Day is paid on the 24th.
    expect(all('biweekly', { biweeklyAnchor: '2026-12-11' }, '2026-12-20', '2026-12-31', ['2026-12-25'])).toEqual(['2026-12-24']);
  });
  it('returns each payday once when two scheduled dates move back onto the same day', () => {
    // Every weekday of February 2026 is a holiday, so both the 15th and the 28th are paid on Friday 30 January.
    const february = Array.from({ length: 26 }, (_, index) => `2026-02-${String(index + 2).padStart(2, '0')}`);
    expect(all('semimonthly', {}, '2026-01-01', '2026-02-28', february)).toEqual(['2026-01-15', '2026-01-30']);
  });
  it('gives 2026 exactly paydaysPerYear paydays for each schedule', () => {
    for (const schedule of ['monthly_date', 'last_working_day', 'last_friday', 'semimonthly', 'biweekly', 'weekly'] as const) {
      expect(all(schedule, {}, '2026-01-01', '2026-12-31')).toHaveLength(paydaysPerYear(schedule));
    }
  });
});

describe('paydaysPerYear', () => {
  it('counts 12 for the three monthly schedules and for an unset schedule', () => {
    for (const schedule of ['monthly_date', 'last_working_day', 'last_friday', undefined] as const) {
      expect(paydaysPerYear(schedule)).toBe(12);
    }
  });
  it('counts 24, 26 and 52 for semimonthly, biweekly and weekly', () => {
    expect(paydaysPerYear('semimonthly')).toBe(24);
    expect(paydaysPerYear('biweekly')).toBe(26);
    expect(paydaysPerYear('weekly')).toBe(52);
  });
});

describe('paydaysBetween agrees with getNextPaydayDetails', () => {
  const holidays = ['2026-04-03', '2026-04-06', '2026-05-04', '2026-05-25', '2026-08-31', '2026-12-25', '2026-12-28', '2027-01-01'];
  // Local noon: the function under test reads the clock through new Date(), in local time.
  const todays: [number, number, number][] = [
    [2026, 0, 31], [2026, 1, 28], [2026, 3, 2], [2026, 5, 30], [2026, 9, 9], [2026, 9, 25],
    [2026, 11, 24], [2026, 11, 25], [2026, 11, 31], [2027, 0, 1], [2028, 1, 29],
  ];
  const variants: { name: string; settings: Partial<FinanceSettings> }[] = [
    { name: 'monthly_date 25th', settings: { paydaySchedule: 'monthly_date', payDayOfMonth: 25 } },
    { name: 'monthly_date default', settings: { paydaySchedule: 'monthly_date' } },
    { name: 'monthly_date 31st', settings: { paydaySchedule: 'monthly_date', payDayOfMonth: 31 } },
    { name: 'monthly_date 1st', settings: { paydaySchedule: 'monthly_date', payDayOfMonth: 1 } },
    { name: 'unset schedule', settings: {} },
    { name: 'last_working_day', settings: { paydaySchedule: 'last_working_day' } },
    { name: 'last_friday', settings: { paydaySchedule: 'last_friday' } },
    { name: 'semimonthly', settings: { paydaySchedule: 'semimonthly' } },
    { name: 'weekly default Friday', settings: { paydaySchedule: 'weekly' } },
    { name: 'weekly Monday', settings: { paydaySchedule: 'weekly', paydayWeekday: 1 } },
    { name: 'weekly Sunday', settings: { paydaySchedule: 'weekly', paydayWeekday: 0 } },
    { name: 'biweekly default anchor', settings: { paydaySchedule: 'biweekly' } },
    { name: 'biweekly custom anchor', settings: { paydaySchedule: 'biweekly', paydayBiweeklyAnchor: '2026-01-09' } },
  ];

  afterEach(() => { vi.useRealTimers(); });

  const pairAt = (settings: Partial<FinanceSettings>, [year, month, day]: [number, number, number]) => {
    vi.setSystemTime(new Date(year, month, day, 12, 0, 0));
    const today = toISODate(new Date());
    return {
      today,
      expected: toISODate(getNextPaydayDetails(settings as FinanceSettings, holidays).date),
      next: paydaysBetween(
        settings.paydaySchedule,
        { payDayOfMonth: settings.payDayOfMonth, weekday: settings.paydayWeekday, biweeklyAnchor: settings.paydayBiweeklyAnchor },
        today, toISODate(new Date(year, month, day + 40)), holidays,
      )[0],
    };
  };

  for (const { name, settings } of variants) {
    it(`matches the next payday for ${name} on every sampled date`, () => {
      vi.useFakeTimers();
      for (const date of todays) {
        const { today, expected, next } = pairAt(settings, date);
        expect(next, `${name} from ${today}`).toBe(expected);
      }
    });
  }

  it('never returns a payday that has already passed', () => {
    vi.useFakeTimers();
    for (const { settings } of variants) {
      for (const date of todays) {
        const { today, expected } = pairAt(settings, date);
        expect(expected >= today).toBe(true);
      }
    }
  });

  it('gives the 27th of February for "the 1st" on 31 January 2026, not the 30th of January that has gone', () => {
    // 1 Feb 2026 is a Sunday, so that month's payday was Friday 30 January; 1 Mar is a Sunday too.
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 31, 12, 0, 0));
    const details = getNextPaydayDetails({ paydaySchedule: 'monthly_date', payDayOfMonth: 1 } as FinanceSettings, []);
    expect(toISODate(details.date)).toBe('2026-02-27');
    expect(details).toMatchObject({ adjusted: true, adjustReason: 'weekend', daysRemaining: 27 });
    vi.setSystemTime(new Date(2026, 1, 28, 12, 0, 0));
    expect(toISODate(getNextPaydayDetails({ paydaySchedule: 'monthly_date', payDayOfMonth: 1 } as FinanceSettings, []).date)).toBe('2026-04-01');
  });

  it('returns local midnight of the payday and counts the days from local midnight today', () => {
    vi.useFakeTimers();
    // Saturday 28 March 2026, the day before the clocks go forward; the next Friday is 3 April.
    vi.setSystemTime(new Date(2026, 2, 28, 12, 0, 0));
    const details = getNextPaydayDetails({ paydaySchedule: 'weekly' } as FinanceSettings, []);
    expect(details.date).toEqual(new Date(2026, 3, 3));
    expect(details.daysRemaining).toBe(6);
    vi.setSystemTime(new Date(2026, 3, 3, 23, 30, 0));
    const today = getNextPaydayDetails({ paydaySchedule: 'weekly' } as FinanceSettings, []);
    expect(today).toMatchObject({ date: new Date(2026, 3, 3), adjusted: false, adjustReason: null, daysRemaining: 0 });
  });

  it('falls back to today, unadjusted, when the settings cannot place a payday', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 9, 12, 0, 0));
    const details = getNextPaydayDetails({ paydaySchedule: 'weekly', paydayWeekday: 9 } as FinanceSettings, []);
    expect(details).toEqual({ date: new Date(2026, 9, 9), adjusted: false, adjustReason: null, daysRemaining: 0 });
  });

  it('keeps the default fortnightly anchor equal to the one the settings form uses', () => {
    expect(paydaysBetween('biweekly', {}, '2026-01-01', '2026-03-31', []))
      .toEqual(paydaysBetween('biweekly', { biweeklyAnchor: DEFAULT_BIWEEKLY_ANCHOR }, '2026-01-01', '2026-03-31', []));
  });
});

describe('nextPayday', () => {
  const next = (
    schedule: Parameters<typeof nextPayday>[0], today: string, opts: Parameters<typeof nextPayday>[1] = {}, holidays: string[] = [],
  ) => nextPayday(schedule, opts, today, holidays);

  it('returns the first payday on or after today, today included', () => {
    expect(next('monthly_date', '2026-10-09')?.date).toBe('2026-10-23');
    expect(next('monthly_date', '2026-10-23')?.date).toBe('2026-10-23');
    expect(next('monthly_date', '2026-10-24')?.date).toBe('2026-11-25');
    expect(next(undefined, '2026-10-24')).toEqual(next('monthly_date', '2026-10-24'));
  });
  it('says a payday did not move when it was a working day', () => {
    expect(next('monthly_date', '2026-10-24')).toEqual({ date: '2026-11-25', adjusted: false, adjustReason: null });
  });
  it('names a weekend when the scheduled date was a Saturday or Sunday', () => {
    expect(next('monthly_date', '2026-10-09')).toEqual({ date: '2026-10-23', adjusted: true, adjustReason: 'weekend' });
    expect(next('monthly_date', '2026-07-01')).toEqual({ date: '2026-07-24', adjusted: true, adjustReason: 'weekend' });
  });
  it('names a bank holiday when the scheduled date was a working day that is a holiday', () => {
    expect(next('monthly_date', '2026-12-01', {}, ['2026-12-25'])).toEqual({ date: '2026-12-24', adjusted: true, adjustReason: 'bank_holiday' });
    expect(next('weekly', '2026-05-01', { weekday: 1 }, ['2026-05-04'])).toEqual({ date: '2026-05-01', adjusted: true, adjustReason: 'bank_holiday' });
  });
  it('names the scheduled date, not the last day stepped over, when a holiday follows a weekend', () => {
    // 25 Jul 2026 is a Saturday and Friday 24th is a holiday: paid on Thursday 23rd.
    expect(next('monthly_date', '2026-07-01', {}, ['2026-07-24'])).toEqual({ date: '2026-07-23', adjusted: true, adjustReason: 'weekend' });
  });
  it('skips a payday that has already been paid, even when the next one is paid earlier than its month', () => {
    // 1 Feb and 1 Mar 2026 are Sundays: paid on 30 Jan and 27 Feb.
    expect(next('monthly_date', '2026-01-30', { payDayOfMonth: 1 })?.date).toBe('2026-01-30');
    expect(next('monthly_date', '2026-01-31', { payDayOfMonth: 1 })?.date).toBe('2026-02-27');
    expect(next('monthly_date', '2026-02-28', { payDayOfMonth: 1 })?.date).toBe('2026-04-01');
  });
  it('finds paydays across month, year, leap-day and clock-change boundaries', () => {
    expect(next('last_working_day', '2028-02-28')?.date).toBe('2028-02-29');
    expect(next('last_working_day', '2026-12-31')?.date).toBe('2026-12-31');
    expect(next('last_working_day', '2027-01-01')?.date).toBe('2027-01-29');
    expect(next('monthly_date', '2026-12-26', { payDayOfMonth: 31 }, ['2027-01-01'])?.date).toBe('2026-12-31');
    expect(next('last_friday', '2026-12-26')?.date).toBe('2027-01-29');
    expect(next('semimonthly', '2026-08-15')?.date).toBe('2026-08-31');
    expect(next('weekly', '2026-03-28')?.date).toBe('2026-04-03');
    expect(next('weekly', '2026-10-24')?.date).toBe('2026-10-30');
  });
  it('counts a fortnightly cycle backwards from its anchor, not just forwards', () => {
    expect(next('biweekly', '2025-12-01')?.date).toBe('2025-12-05');
    expect(next('biweekly', '2026-10-10')?.date).toBe('2026-10-23');
    expect(next('biweekly', '2026-10-10', { biweeklyAnchor: '2026-01-09' })?.date).toBe('2026-10-16');
  });
  it('is undefined for an invalid today, a schedule it does not know and options that cannot place a date', () => {
    for (const today of ['', 'bad', '2026-02-30', '2026-10-09T00:00:00Z']) expect(next('monthly_date', today)).toBeUndefined();
    expect(next('fortnightly' as FinanceSettings['paydaySchedule'], '2026-10-09')).toBeUndefined();
    expect(next('weekly', '2026-10-09', { weekday: 9 })).toBeUndefined();
    expect(next('monthly_date', '2026-10-09', { payDayOfMonth: -1 })).toBeUndefined();
    expect(next('biweekly', '2026-10-09', { biweeklyAnchor: 'bad' })).toBeUndefined();
  });
  it('agrees with the first date paydaysBetween finds', () => {
    for (const today of ['2026-01-31', '2026-04-02', '2026-12-24', '2028-02-29']) {
      expect(next('semimonthly', today, {}, ['2026-04-03'])?.date).toBe(paydaysBetween('semimonthly', {}, today, '2028-12-31', ['2026-04-03'])[0]);
    }
  });
});

describe('getNextPaydayDetails counts calendar days across the clock changes', () => {
  // The UK clocks went forward on 29 Mar 2026 and back on 25 Oct 2026. Pinned to London so the 23-hour and
  // 25-hour days are really there to be miscounted; the answers are calendar days, the same in any zone.
  const originalZone = process.env.TZ;
  beforeAll(() => { process.env.TZ = 'Europe/London'; });
  afterAll(() => {
    if (originalZone === undefined) delete process.env.TZ;
    else process.env.TZ = originalZone;
  });
  afterEach(() => { vi.useRealTimers(); });

  const daysFrom = (settings: Partial<FinanceSettings>, now: [number, number, number, number], holidays: string[] = []) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(now[0], now[1], now[2], now[3], 0, 0));
    const details = getNextPaydayDetails(settings as FinanceSettings, holidays);
    return { date: toISODate(details.date), daysRemaining: details.daysRemaining };
  };
  const friday = { paydaySchedule: 'weekly' } as const;

  it('counts six days from Saturday 24 to Friday 30 October, with the clocks going back in between', () => {
    expect(daysFrom(friday, [2026, 9, 24, 12])).toEqual({ date: '2026-10-30', daysRemaining: 6 });
    expect(daysFrom(friday, [2026, 9, 24, 0])).toEqual({ date: '2026-10-30', daysRemaining: 6 });
    expect(daysFrom(friday, [2026, 9, 24, 23])).toEqual({ date: '2026-10-30', daysRemaining: 6 });
    expect(daysFrom(friday, [2026, 9, 25, 12])).toEqual({ date: '2026-10-30', daysRemaining: 5 });
    expect(daysFrom(friday, [2026, 9, 26, 12])).toEqual({ date: '2026-10-30', daysRemaining: 4 });
  });
  it('counts six days from Saturday 28 March to Friday 3 April, with the clocks going forward in between', () => {
    expect(daysFrom(friday, [2026, 2, 28, 12])).toEqual({ date: '2026-04-03', daysRemaining: 6 });
    expect(daysFrom(friday, [2026, 2, 28, 0])).toEqual({ date: '2026-04-03', daysRemaining: 6 });
    expect(daysFrom(friday, [2026, 2, 29, 12])).toEqual({ date: '2026-04-03', daysRemaining: 5 });
  });
  it('is zero on the payday itself, either side of a clock change', () => {
    expect(daysFrom(friday, [2026, 9, 23, 12]).daysRemaining).toBe(0);
    expect(daysFrom(friday, [2026, 2, 27, 12]).daysRemaining).toBe(0);
  });
  it('counts a monthly payday across the autumn change by the calendar', () => {
    // 31 October 2026 is a Saturday: the last working day is Friday the 30th.
    expect(daysFrom({ paydaySchedule: 'last_working_day' }, [2026, 9, 20, 12])).toEqual({ date: '2026-10-30', daysRemaining: 10 });
    expect(daysFrom({ paydaySchedule: 'monthly_date', payDayOfMonth: 28 }, [2026, 9, 24, 12])).toEqual({ date: '2026-10-28', daysRemaining: 4 });
  });
  it('counts to a payday in the next year', () => {
    expect(daysFrom({ paydaySchedule: 'last_working_day' }, [2026, 11, 31, 12])).toEqual({ date: '2026-12-31', daysRemaining: 0 });
    expect(daysFrom({ paydaySchedule: 'monthly_date', payDayOfMonth: 5 }, [2026, 11, 28, 12], [])).toEqual({ date: '2027-01-05', daysRemaining: 8 });
  });
});
