import { describe, expect, it } from 'vitest';
import {
  BIRTHDAY_LEAVE_RULES,
  BIRTHDAY_LEAVE_RULE_LABELS,
  OPTIMAL_LEAVE_BIASES,
  OPTIMAL_LEAVE_BIAS_LABELS,
  adjustHolidayCountForBirthday,
  calculateBirthdayBenefitValue,
  calculateWorkingDaysInRange,
  computeUkBankHolidaysForYear,
  findBirthdayDayForHolidayRange,
  findHolidayCoveringDate,
  formatDatesToBookUk,
  formatDaysList,
  formatHolidayDates,
  formatUkDate,
  getBirthdayLeaveWindow,
  getBookedDaysForMonth,
  isHalfDay,
  normalizeHolidays,
  parseDays,
  parseEntryDays,
  planOptimalHolidays,
  resolveBankHolidaysForYear,
  resolveBirthdayInYear,
  removeHolidayWithBirthdayRestoration,
  type UserHoliday,
  validateBirthdayLeaveBooking,
} from './holidays';

describe('parseDays', () => {
  it('expands a range', () => {
    expect(parseDays('12-16')).toEqual([12, 13, 14, 15, 16]);
  });

  it('reads mixed singles and ranges across separators', () => {
    expect(parseDays('3 + 12-14, 20; 22')).toEqual([3, 12, 13, 14, 20, 22]);
  });

  it('drops an inverted range rather than looping', () => {
    expect(parseDays('16-12')).toEqual([]);
  });

  it('returns nothing for empty or unparseable input', () => {
    expect(parseDays('')).toEqual([]);
    expect(parseDays('nonsense')).toEqual([]);
  });
});

describe('formatDaysList', () => {
  it('collapses consecutive days into ranges', () => {
    expect(formatDaysList([12, 13, 14, 15, 16])).toBe('12-16');
  });

  it('keeps isolated days separate', () => {
    expect(formatDaysList([3, 12, 13, 14, 20])).toBe('3 + 12-14 + 20');
  });

  it('sorts before collapsing', () => {
    expect(formatDaysList([14, 3, 13, 12])).toBe('3 + 12-14');
  });

  it('round-trips with parseDays', () => {
    expect(parseDays(formatDaysList([3, 12, 13, 14]))).toEqual([3, 12, 13, 14]);
  });

  it('is empty for no days', () => {
    expect(formatDaysList([])).toBe('');
  });
});

describe('parseEntryDays', () => {
  it('counts a range inclusively', () => {
    expect(parseEntryDays('12-16')).toBe(5);
  });

  it('counts a single day as one', () => {
    expect(parseEntryDays(' 3 ')).toBe(1);
  });

  it('counts nothing for an unparseable entry', () => {
    expect(parseEntryDays('abc')).toBe(0);
  });
});

describe('calculateWorkingDaysInRange', () => {
  it('excludes weekends', () => {
    // Mon 1 Dec 2025 to Sun 7 Dec: five working days.
    expect(calculateWorkingDaysInRange('2025-12-01', '2025-12-07', [])).toBe(5);
  });

  it('excludes bank holidays', () => {
    expect(calculateWorkingDaysInRange('2025-12-22', '2025-12-26', ['2025-12-25', '2025-12-26'])).toBe(3);
  });

  it('counts a single working day', () => {
    expect(calculateWorkingDaysInRange('2025-12-01', '2025-12-01', [])).toBe(1);
  });

  it('returns 0 for a missing or inverted range', () => {
    expect(calculateWorkingDaysInRange('', '2025-12-01', [])).toBe(0);
    expect(calculateWorkingDaysInRange('2025-12-07', '2025-12-01', [])).toBe(0);
    expect(calculateWorkingDaysInRange('not-a-date', '2025-12-01', [])).toBe(0);
  });
});

describe('getBookedDaysForMonth', () => {
  const holiday = {
    id: 'h1',
    startDate: '2025-12-22',
    endDate: '2025-12-28',
    occasion: 'Christmas',
    count: 3,
  };

  it('books only working days inside the month', () => {
    const booked = getBookedDaysForMonth([holiday], 2025, 11, ['2025-12-25', '2025-12-26']);
    expect(booked.map(b => b.day)).toEqual([22, 23, 24]);
    expect(booked.every(b => b.occasion === 'Christmas')).toBe(true);
    expect(booked.every(b => b.type === 'holiday')).toBe(true);
  });

  it('attributes type: "sick" for sick days', () => {
    const sickLeave = {
      id: 's1',
      startDate: '2025-12-08',
      endDate: '2025-12-09',
      occasion: 'Flu',
      count: 2,
      type: 'sick' as const,
    };
    const booked = getBookedDaysForMonth([holiday, sickLeave], 2025, 11, ['2025-12-25', '2025-12-26']);
    const sickDays = booked.filter(b => b.type === 'sick');
    const holidayDays = booked.filter(b => b.type === 'holiday');
    expect(sickDays.map(b => b.day)).toEqual([8, 9]);
    expect(sickDays.every(b => b.occasion === 'Flu')).toBe(true);
    expect(holidayDays.map(b => b.day)).toEqual([22, 23, 24]);
  });

  it('ignores days falling in another month', () => {
    const spanning = { ...holiday, startDate: '2025-11-28', endDate: '2025-12-02' };
    expect(getBookedDaysForMonth([spanning], 2025, 11, []).map(b => b.day)).toEqual([1, 2]);
  });

  it('skips a holiday with unparseable dates', () => {
    expect(getBookedDaysForMonth([{ ...holiday, startDate: 'nope' }], 2025, 11, [])).toEqual([]);
  });

  it('books a full day as fraction 1', () => {
    const booked = getBookedDaysForMonth([holiday], 2025, 11, ['2025-12-25', '2025-12-26']);
    expect(booked.every(b => b.fraction === 1)).toBe(true);
  });

  it('books a morning off as fraction 0.5 and carries the half', () => {
    const half = { ...holiday, startDate: '2025-12-19', endDate: '2025-12-19', count: 0.5, halfDay: 'am' as const };
    expect(getBookedDaysForMonth([half], 2025, 11, [])).toEqual([
      { day: 19, occasion: 'Christmas', type: 'holiday', fraction: 0.5, halfDay: 'am' },
    ]);
  });

  it('books a sick afternoon as fraction 0.5', () => {
    const halfSick = { ...holiday, startDate: '2025-12-19', endDate: '2025-12-19', count: 0.5, type: 'sick' as const, halfDay: 'pm' as const };
    const [day] = getBookedDaysForMonth([halfSick], 2025, 11, []);
    expect(day.type).toBe('sick');
    expect(day.fraction).toBe(0.5);
    expect(day.halfDay).toBe('pm');
  });

  it('books an unmarked single day costing 0.5 as a full calendar day', () => {
    const unmarked = { ...holiday, startDate: '2025-12-19', endDate: '2025-12-19', count: 0.5 };
    const [day] = getBookedDaysForMonth([unmarked], 2025, 11, []);
    expect(day.fraction).toBe(1);
    expect(day.halfDay).toBeUndefined();
  });

  it('keeps every day of a range with a fractional total whole', () => {
    const range = { ...holiday, startDate: '2025-12-15', endDate: '2025-12-17', count: 2.5 };
    const booked = getBookedDaysForMonth([range], 2025, 11, []);
    expect(booked.map(b => b.fraction)).toEqual([1, 1, 1]);
  });

  it('attributes type: "birthday" for a full birthday day off', () => {
    const birthdayLeave = {
      id: 'b1',
      startDate: '2025-12-10',
      endDate: '2025-12-10',
      occasion: 'Birthday Day Off',
      count: 1,
      type: 'birthday' as const,
    };
    const booked = getBookedDaysForMonth([birthdayLeave], 2025, 11, []);
    expect(booked).toEqual([
      { day: 10, occasion: 'Birthday Day Off', type: 'birthday', fraction: 1 },
    ]);
  });

  it('attributes type: "birthday" for a half-day birthday entry', () => {
    const halfBirthday = {
      id: 'b2',
      startDate: '2025-12-10',
      endDate: '2025-12-10',
      occasion: 'Birthday afternoon',
      count: 0.5,
      type: 'birthday' as const,
      halfDay: 'pm' as const,
    };
    const booked = getBookedDaysForMonth([halfBirthday], 2025, 11, []);
    expect(booked).toEqual([
      { day: 10, occasion: 'Birthday afternoon', type: 'birthday', fraction: 0.5, halfDay: 'pm' },
    ]);
  });
});

describe('formatHolidayDates', () => {
  it('prints the stored calendar day, whatever the machine timezone', () => {
    expect(formatHolidayDates('2025-12-22', '2025-12-22')).toBe('22 Dec 25');
  });

  it('drops the year from the start of a range within one year', () => {
    expect(formatHolidayDates('2025-12-22', '2025-12-28')).toBe('22 Dec - 28 Dec 25');
  });

  it('keeps both years for a range across new year', () => {
    expect(formatHolidayDates('2025-12-29', '2026-01-02')).toBe('29 Dec 25 - 2 Jan 26');
  });

  it('is empty for a missing or malformed date', () => {
    expect(formatHolidayDates('', '2025-12-01')).toBe('');
    expect(formatHolidayDates('2025-12-01', 'not-a-date')).toBe('');
  });
});

describe('isHalfDay', () => {
  const day = { startDate: '2025-12-19', endDate: '2025-12-19', halfDay: 'am' as const };

  it('is true for a single date marked morning or afternoon', () => {
    expect(isHalfDay(day)).toBe(true);
    expect(isHalfDay({ ...day, halfDay: 'pm' })).toBe(true);
  });

  it('is false for an unmarked day', () => {
    expect(isHalfDay({ ...day, halfDay: undefined })).toBe(false);
  });

  it('is false for a range, even if marked', () => {
    expect(isHalfDay({ ...day, endDate: '2025-12-20' })).toBe(false);
  });
});

describe('normalizeHolidays', () => {
  it('passes an array through unchanged', () => {
    const list = [{ id: 'a', startDate: '2025-01-01', endDate: '2025-01-02', occasion: 'x', count: 2 }];
    expect(normalizeHolidays(list, 2025)).toBe(list);
  });

  it('converts the legacy month-keyed map', () => {
    const result = normalizeHolidays({ '11': { dates: '22-24', count: 3, occasion: 'Christmas' } }, 2025);
    expect(result).toEqual([
      {
        id: 'legacy-11-0',
        startDate: '2025-12-22',
        endDate: '2025-12-24',
        occasion: 'Christmas',
        count: 3,
      },
    ]);
  });

  it('splits multiple segments in one month', () => {
    const result = normalizeHolidays({ '5': { dates: '3 + 10-12', count: 4 } }, 2025);
    expect(result.map(h => h.id)).toEqual(['legacy-5-0', 'legacy-5-1']);
    expect(result[0].startDate).toBe('2025-06-03');
    expect(result[1].endDate).toBe('2025-06-12');
    expect(result[1].occasion).toBe('Leave');
  });

  it('holds a day past the month end to its last day instead of dropping the range', () => {
    // Free text: "27-30" typed for February, which has 28 days in 2026.
    const result = normalizeHolidays({ '1': { dates: '27-30', count: 4, occasion: 'Ski' } }, 2026);
    expect(result).toHaveLength(1);
    expect(result[0].startDate).toBe('2026-02-27');
    expect(result[0].endDate).toBe('2026-02-28');
    expect(result[0].count).toBe(4);
    // 27 Feb 2026 is a Friday and 28 Feb a Saturday: one working day, booked, not zero.
    expect(calculateWorkingDaysInRange(result[0].startDate, result[0].endDate, [])).toBe(1);
    expect(getBookedDaysForMonth(result, 2026, 1, []).map(b => b.day)).toEqual([27]);
  });

  it('uses the real month length: 29 in a leap February, 30 in April', () => {
    const feb = normalizeHolidays({ '1': { dates: '27-30', count: 3 } }, 2028);
    expect(feb[0].endDate).toBe('2028-02-29');
    const apr = normalizeHolidays({ '3': { dates: '28-31', count: 4 } }, 2026);
    expect(apr[0].endDate).toBe('2026-04-30');
  });

  it('drops a single day past the month end from a list, leaving valid days alone', () => {
    const result = normalizeHolidays({ '1': { dates: '3 + 31, 10-12', count: 5 } }, 2026);
    expect(result.map(h => [h.startDate, h.endDate])).toEqual([
      ['2026-02-03', '2026-02-03'],
      ['2026-02-10', '2026-02-12'],
    ]);
  });

  it('drops a segment that lies wholly past the month end rather than booking a day nobody typed', () => {
    // "30-31" in February names no real day; holding it to 28 Feb would book one.
    expect(normalizeHolidays({ '1': { dates: '30-31', count: 2 } }, 2026)).toEqual([]);
  });

  it('produces ids that are stable across calls', () => {
    const map = { '5': { dates: '3', count: 1 } };
    expect(normalizeHolidays(map, 2025)[0].id).toBe(normalizeHolidays(map, 2025)[0].id);
  });

  it('skips months with no days booked', () => {
    expect(normalizeHolidays({ '5': { dates: '', count: 0 } }, 2025)).toEqual([]);
  });

  it('returns nothing for missing storage', () => {
    expect(normalizeHolidays(null, 2025)).toEqual([]);
  });
});

describe('resolveBirthdayInYear', () => {
  it('formats a normal birthday into YYYY-MM-DD', () => {
    expect(resolveBirthdayInYear(2026, { month: 5, day: 9 })).toBe('2026-05-09');
    expect(resolveBirthdayInYear(2026, { month: 12, day: 31 })).toBe('2026-12-31');
  });

  it('clamps 29 Feb to 28 Feb in non-leap years and keeps 29 Feb in leap years', () => {
    expect(resolveBirthdayInYear(2026, { month: 2, day: 29 })).toBe('2026-02-28');
    expect(resolveBirthdayInYear(2028, { month: 2, day: 29 })).toBe('2028-02-29');
  });

  it('returns null for missing or invalid month/day/year', () => {
    expect(resolveBirthdayInYear(2026, null)).toBeNull();
    expect(resolveBirthdayInYear(2026, undefined)).toBeNull();
    expect(resolveBirthdayInYear(2026, { month: 0, day: 10 })).toBeNull();
    expect(resolveBirthdayInYear(2026, { month: 13, day: 10 })).toBeNull();
    expect(resolveBirthdayInYear(2026, { month: 2, day: 30 })).toBeNull();
    expect(resolveBirthdayInYear(2026, { month: 4, day: 31 })).toBeNull();
    expect(resolveBirthdayInYear(2026, { month: -1, day: 10 })).toBeNull();
    expect(resolveBirthdayInYear(2026, { month: 5, day: 0 })).toBeNull();
    expect(resolveBirthdayInYear(2026, { month: 5, day: -5 })).toBeNull();
    expect(resolveBirthdayInYear(1899, { month: 5, day: 10 })).toBeNull();
    expect(resolveBirthdayInYear(10000, { month: 5, day: 10 })).toBeNull();
    expect(resolveBirthdayInYear(NaN, { month: 5, day: 10 })).toBeNull();
  });
});

describe('getBirthdayLeaveWindow', () => {
  it('exposes labels for every rule', () => {
    for (const rule of BIRTHDAY_LEAVE_RULES) {
      expect(BIRTHDAY_LEAVE_RULE_LABELS[rule].label.length).toBeGreaterThan(0);
      expect(BIRTHDAY_LEAVE_RULE_LABELS[rule].shortLabel.length).toBeGreaterThan(0);
    }
  });

  it('exact_or_nearest on a working day restricts to the exact birthday', () => {
    // 2026-06-10 is a Wednesday
    const win = getBirthdayLeaveWindow(2026, 'exact_or_nearest', { month: 6, day: 10 }, []);
    expect(win).toEqual({
      birthdayIso: '2026-06-10',
      startIso: '2026-06-10',
      endIso: '2026-06-10',
      eligibleDates: ['2026-06-10'],
    });
  });

  it('exact_or_nearest on a weekend offers the nearest working days before and after', () => {
    // 2026-06-13 is a Saturday -> Fri 12 Jun and Mon 15 Jun
    const win = getBirthdayLeaveWindow(2026, 'exact_or_nearest', { month: 6, day: 13 }, []);
    expect(win).toEqual({
      birthdayIso: '2026-06-13',
      startIso: '2026-06-12',
      endIso: '2026-06-15',
      eligibleDates: ['2026-06-12', '2026-06-15'],
    });
  });

  it('exact_or_nearest on a bank holiday skips over the bank holiday and weekend', () => {
    // 2026-12-25 (Fri) and 2026-12-28 (Mon) are bank holidays -> Thu 24 Dec and Tue 29 Dec
    const win = getBirthdayLeaveWindow(
      2026,
      'exact_or_nearest',
      { month: 12, day: 25 },
      ['2026-12-25', '2026-12-28'],
    );
    expect(win).toEqual({
      birthdayIso: '2026-12-25',
      startIso: '2026-12-24',
      endIso: '2026-12-29',
      eligibleDates: ['2026-12-24', '2026-12-29'],
    });
  });

  it('within_week spans ±7 calendar days clamped to the leave year', () => {
    // 2026-12-29 +/- 7 days clamped to 2026 -> 2026-12-22 to 2026-12-31
    const win = getBirthdayLeaveWindow(
      2026,
      'within_week',
      { month: 12, day: 29 },
      ['2026-12-25', '2026-12-28'],
    );
    expect(win?.startIso).toBe('2026-12-22');
    expect(win?.endIso).toBe('2026-12-31');
    expect(win?.eligibleDates).not.toContain('2026-12-25');
    expect(win?.eligibleDates).not.toContain('2026-12-26'); // Sat
    expect(win?.eligibleDates).toContain('2026-12-29');
    expect(win?.eligibleDates).toContain('2026-12-31');
    expect(win?.eligibleDates.every(d => d.startsWith('2026-'))).toBe(true);
  });

  it('birthday_month covers all working days in the birthday calendar month', () => {
    // Feb 2026: 2026-02-01 to 2026-02-28 (20 working days)
    const win = getBirthdayLeaveWindow(2026, 'birthday_month', { month: 2, day: 14 }, []);
    expect(win?.startIso).toBe('2026-02-01');
    expect(win?.endIso).toBe('2026-02-28');
    expect(win?.eligibleDates).toHaveLength(20);
  });

  it('within_month covers ±30 calendar days around the birthday', () => {
    const win = getBirthdayLeaveWindow(2026, 'within_month', { month: 6, day: 15 }, []);
    expect(win?.startIso).toBe('2026-05-16');
    expect(win?.endIso).toBe('2026-07-15');
    expect(win?.eligibleDates.includes('2026-06-15')).toBe(true);
  });

  it('anytime returns all working days in the year even without a birthday set', () => {
    const win = getBirthdayLeaveWindow(2026, 'anytime', null, ['2026-01-01']);
    expect(win?.birthdayIso).toBeNull();
    expect(win?.startIso).toBe('2026-01-01');
    expect(win?.endIso).toBe('2026-12-31');
    expect(win?.eligibleDates).not.toContain('2026-01-01');
    expect(win?.eligibleDates).toContain('2026-01-02');
  });

  it('returns null for non-anytime rules when birthday is missing or year is invalid', () => {
    expect(getBirthdayLeaveWindow(2026, 'exact_or_nearest', null, [])).toBeNull();
    expect(getBirthdayLeaveWindow(2026, 'within_week', undefined, [])).toBeNull();
    expect(getBirthdayLeaveWindow(2026, 'birthday_month', null, [])).toBeNull();
    expect(getBirthdayLeaveWindow(2026, 'within_month', null, [])).toBeNull();
    expect(getBirthdayLeaveWindow(1800, 'anytime', { month: 5, day: 10 }, [])).toBeNull();
  });
});

describe('validateBirthdayLeaveBooking', () => {
  const bday = { month: 6, day: 10 }; // Wed 10 Jun 2026

  it('accepts a valid single working day inside the window', () => {
    expect(
      validateBirthdayLeaveBooking('2026-06-10', '2026-06-10', 2026, 'exact_or_nearest', bday, []),
    ).toEqual({ valid: true });
  });

  it('rejects missing or malformed dates', () => {
    expect(
      validateBirthdayLeaveBooking('', '2026-06-10', 2026, 'exact_or_nearest', bday, []),
    ).toEqual({ valid: false, reason: 'Choose a valid date for your birthday day off.' });
    expect(
      validateBirthdayLeaveBooking('not-a-date', 'not-a-date', 2026, 'exact_or_nearest', bday, []),
    ).toEqual({ valid: false, reason: 'Choose a valid date for your birthday day off.' });
  });

  it('rejects a multi-day range', () => {
    expect(
      validateBirthdayLeaveBooking('2026-06-10', '2026-06-11', 2026, 'within_week', bday, []),
    ).toEqual({ valid: false, reason: 'Birthday day off must be booked as a single day.' });
  });

  it('rejects a weekend or bank holiday', () => {
    // 2026-06-13 is Saturday
    expect(
      validateBirthdayLeaveBooking('2026-06-13', '2026-06-13', 2026, 'within_week', bday, []),
    ).toEqual({ valid: false, reason: 'Birthday day off must be booked on a working day.' });
    expect(
      validateBirthdayLeaveBooking('2026-06-10', '2026-06-10', 2026, 'within_week', bday, ['2026-06-10']),
    ).toEqual({ valid: false, reason: 'Birthday day off must be booked on a working day.' });
  });

  it('rejects a working day outside the configured rule window with a formatted window message', () => {
    const res = validateBirthdayLeaveBooking('2026-06-25', '2026-06-25', 2026, 'within_week', bday, []);
    expect(res.valid).toBe(false);
    expect(res.reason).toBe('Date falls outside your ±1 week birthday window (3 Jun - 17 Jun 26).');
  });

  it('allows any working day when no birthday date is configured yet', () => {
    expect(
      validateBirthdayLeaveBooking('2026-09-15', '2026-09-15', 2026, 'exact_or_nearest', null, []),
    ).toEqual({ valid: true });
  });
});

describe('calculateBirthdayBenefitValue', () => {
  it('computes the daily gross rate rounded to 2 decimal places', () => {
    expect(calculateBirthdayBenefitValue(52000, 260)).toBe(200);
    expect(calculateBirthdayBenefitValue(65000, 260)).toBe(250);
    expect(calculateBirthdayBenefitValue(50000, 260)).toBe(192.31);
  });

  it('returns 0 for zero, negative, or non-finite inputs', () => {
    expect(calculateBirthdayBenefitValue(0, 260)).toBe(0);
    expect(calculateBirthdayBenefitValue(-50000, 260)).toBe(0);
    expect(calculateBirthdayBenefitValue(50000, 0)).toBe(0);
    expect(calculateBirthdayBenefitValue(50000, -260)).toBe(0);
    expect(calculateBirthdayBenefitValue(NaN, 260)).toBe(0);
    expect(calculateBirthdayBenefitValue(Infinity, 260)).toBe(0);
    expect(calculateBirthdayBenefitValue(50000, NaN)).toBe(0);
  });
});

describe('computeUkBankHolidaysForYear & resolveBankHolidaysForYear', () => {
  it('computes England & Wales 2026 bank holidays including Boxing Day substitute on 28 Dec', () => {
    const events = computeUkBankHolidaysForYear(2026, 'england-and-wales');
    expect(events.map(e => e.date)).toEqual([
      '2026-01-01',
      '2026-04-03',
      '2026-04-06',
      '2026-05-04',
      '2026-05-25',
      '2026-08-31',
      '2026-12-25',
      '2026-12-28',
    ]);
  });

  it('computes future years (2027, 2028, 2030) with weekend substitution for both Christmas and Boxing Day when needed', () => {
    // In 2027, 25 Dec is Sat and 26 Dec is Sun -> substitutes on Mon 27 Dec and Tue 28 Dec
    const bh2027 = computeUkBankHolidaysForYear(2027, 'england-and-wales');
    expect(bh2027.map(e => e.date)).toContain('2027-12-27');
    expect(bh2027.map(e => e.date)).toContain('2027-12-28');

    const bh2030 = computeUkBankHolidaysForYear(2030, 'england-and-wales');
    expect(bh2030).toHaveLength(8);
  });

  it('reflects regional differences for Scotland and Northern Ireland', () => {
    const scotland = computeUkBankHolidaysForYear(2026, 'scotland');
    expect(scotland.map(e => e.title)).toContain('2nd January');
    expect(scotland.map(e => e.title)).toContain('St Andrew’s Day');
    expect(scotland.map(e => e.title)).not.toContain('Easter Monday');
    // Scotland Summer bank holiday is first Monday of August (2026-08-03)
    expect(scotland.find(e => e.title === 'Summer bank holiday')?.date).toBe('2026-08-03');

    const ni = computeUkBankHolidaysForYear(2026, 'northern-ireland');
    expect(ni.map(e => e.title)).toContain('St Patrick’s Day');
    expect(ni.map(e => e.title)).toContain('Battle of the Boyne (Orangemen’s Day)');
    expect(ni).toHaveLength(10);
  });

  it('returns empty array for invalid years', () => {
    expect(computeUkBankHolidaysForYear(1850)).toEqual([]);
    expect(computeUkBankHolidaysForYear(10000)).toEqual([]);
    expect(computeUkBankHolidaysForYear(NaN)).toEqual([]);
  });

  it('resolveBankHolidaysForYear prefers fetched dates for that year and falls back to computed for future years', () => {
    const resolvedFromFetched = resolveBankHolidaysForYear(
      2026,
      'england-and-wales',
      ['2026-01-01', '2026-05-04'],
      { '2026-01-01': 'Custom NYD' },
    );
    expect(resolvedFromFetched.dates).toEqual(['2026-01-01', '2026-05-04']);
    expect(resolvedFromFetched.map['2026-01-01']).toBe('Custom NYD');
    expect(resolvedFromFetched.map['2026-05-04']).toBe('Early May bank holiday');

    // Fetched list only has 2026, requesting 2029 falls back to deterministic calculation
    const resolved2029 = resolveBankHolidaysForYear(2029, 'england-and-wales', ['2026-01-01']);
    expect(resolved2029.dates).toHaveLength(8);
    expect(resolved2029.dates[0]).toBe('2029-01-01');
  });
});

describe('planOptimalHolidays', () => {
  it('generates high-efficiency bridges for 2026 and future years', () => {
    const plan2026 = planOptimalHolidays({
      year: 2026,
      annualAllowance: 25,
    });
    expect(plan2026.bridges.length).toBeGreaterThanOrEqual(6);
    for (const bridge of plan2026.bridges) {
      expect(bridge.totalDaysOff).toBeGreaterThan(bridge.workingDaysBooked);
      expect(bridge.efficiency).toBeGreaterThan(1);
    }
    // Check Easter pre-week (30 Mar - 2 Apr 2026: 4 leave days -> 10 days off from Sat 28 Mar to Mon 6 Apr)
    const preEaster = plan2026.bridges.find(b => b.startDate === '2026-03-30');
    expect(preEaster).toBeDefined();
    expect(preEaster?.workingDaysBooked).toBe(4);
    expect(preEaster?.totalDaysOff).toBe(10);

    // Check Christmas & New Year 2026 (29-31 Dec: 3 leave days -> 10 days off from Fri 25 Dec 2026 to Sun 3 Jan 2027)
    const xmas = plan2026.bridges.find(b => b.startDate === '2026-12-29' && b.endDate === '2026-12-31');
    expect(xmas).toBeDefined();
    expect(xmas?.workingDaysBooked).toBe(3);
    expect(xmas?.totalDaysOff).toBe(10);

    // Future year 2028 works deterministically without fetched bank holidays
    const plan2028 = planOptimalHolidays({
      year: 2028,
      annualAllowance: 25,
    });
    expect(plan2028.bridges.length).toBeGreaterThanOrEqual(6);
    expect(plan2028.recommendedLeaveDays).toBeLessThanOrEqual(25);
  });

  it('respects annualAllowance when selecting recommended bridges', () => {
    const tightPlan = planOptimalHolidays({
      year: 2026,
      annualAllowance: 7,
    });
    expect(tightPlan.recommendedLeaveDays).toBeLessThanOrEqual(7);
    expect(tightPlan.remainingAllowanceAfterPlan).toBe(7 - tightPlan.recommendedLeaveDays);
  });

  it('reduces leaveDaysRequired by 1 when birthday falls inside a bank-holiday bridge window', () => {
    // Early May 2026 bank holiday is Mon 4 May; week is 5-8 May. Birthday on 6 May:
    const plan = planOptimalHolidays({
      year: 2026,
      annualAllowance: 25,
      birthdayLeaveEnabled: true,
      birthdayLeaveRule: 'within_week',
      birthday: { month: 5, day: 6 },
    });
    const mayBridge = plan.bridges.find(b => b.startDate === '2026-05-05');
    expect(mayBridge).toBeDefined();
    expect(mayBridge?.usesBirthdayDay).toBe(true);
    expect(mayBridge?.birthdayDayDate).toBe('2026-05-06');
    expect(mayBridge?.workingDaysBooked).toBe(4);
    expect(mayBridge?.leaveDaysRequired).toBe(3);
    expect(plan.recommendedUsesBirthday).toBe(true);
  });

  it('creates a standalone 0-leave Birthday Day Off Break when birthday does not overlap a bank holiday week', () => {
    // Friday 16 Oct 2026 -> 3 consecutive days off (16-18 Oct) for 0 annual leave days
    const plan = planOptimalHolidays({
      year: 2026,
      annualAllowance: 25,
      birthdayLeaveEnabled: true,
      birthdayLeaveRule: 'exact_or_nearest',
      birthday: { month: 10, day: 16 },
    });
    const bdayBridge = plan.bridges.find(b => b.label === 'Birthday Day Off Break');
    expect(bdayBridge).toBeDefined();
    expect(bdayBridge?.usesBirthdayDay).toBe(true);
    expect(bdayBridge?.leaveDaysRequired).toBe(0);
    expect(bdayBridge?.workingDaysBooked).toBe(1);
    expect(bdayBridge?.totalDaysOff).toBe(3);
    expect(bdayBridge?.recommended).toBe(true);
  });

  it('excludes already-booked holidays and deducts used allowance', () => {
    const plan = planOptimalHolidays({
      year: 2026,
      annualAllowance: 10,
      existingHolidays: [
        {
          id: 'existing-1',
          startDate: '2026-05-05',
          endDate: '2026-05-08',
          occasion: 'May Trip',
          count: 4,
          type: 'holiday',
        },
      ],
    });
    // The 5-8 May week is already booked so it is not offered again
    expect(plan.bridges.find(b => b.startDate === '2026-05-05' && b.endDate === '2026-05-08')).toBeUndefined();
    // Only 6 days of allowance remain (10 - 4)
    expect(plan.recommendedLeaveDays).toBeLessThanOrEqual(6);
  });

  it('generates Christmas Tiers 1, 2, and 3 with datesToBook, returnToWorkDate, and tierLabel', () => {
    const plan = planOptimalHolidays({
      year: 2026,
      annualAllowance: 25,
    });
    const xmasTier1 = plan.bridges.find(b => b.label.includes('Christmas') && b.tier === 1);
    const xmasTier2 = plan.bridges.find(b => b.label.includes('Christmas') && b.tier === 2);
    const xmasTier3 = plan.bridges.find(b => b.label.includes('Christmas') && b.tier === 3);

    expect(xmasTier1).toBeDefined();
    expect(xmasTier1?.workingDaysBooked).toBe(3);
    expect(xmasTier1?.totalDaysOff).toBe(10);
    expect(xmasTier1?.datesToBook).toEqual(['2026-12-29', '2026-12-30', '2026-12-31']);
    expect(xmasTier1?.returnToWorkDate).toBe('2027-01-04');
    expect(xmasTier1?.tierLabel).toContain('Tier 1');

    expect(xmasTier2).toBeDefined();
    expect(xmasTier2?.workingDaysBooked).toBe(5);
    expect(xmasTier2?.totalDaysOff).toBe(12);
    expect(xmasTier2?.returnToWorkDate).toBe('2027-01-04');
    expect(xmasTier2?.tierLabel).toContain('Tier 2');

    expect(xmasTier3).toBeDefined();
    expect(xmasTier3?.workingDaysBooked).toBe(7);
    expect(xmasTier3?.totalDaysOff).toBe(16);
    expect(xmasTier3?.breakStartDate).toBe('2026-12-19');
    expect(xmasTier3?.breakEndDate).toBe('2027-01-03');
    expect(xmasTier3?.returnToWorkDate).toBe('2027-01-04');
    expect(xmasTier3?.datesToBook).toEqual([
      '2026-12-21',
      '2026-12-22',
      '2026-12-23',
      '2026-12-24',
      '2026-12-29',
      '2026-12-30',
      '2026-12-31',
    ]);
  });

  it('bias: "long_christmas" recommends the Tier 3 Ultimate Christmas Shutdown even on a tighter allowance', () => {
    const plan = planOptimalHolidays({
      year: 2026,
      annualAllowance: 15,
      bias: 'long_christmas',
    });
    expect(plan.bias).toBe('long_christmas');
    const xmasTier3 = plan.bridges.find(b => b.label.includes('Christmas') && b.tier === 3);
    expect(xmasTier3?.recommended).toBe(true);
    expect(plan.recommendedLeaveDays).toBeLessThanOrEqual(15);
  });

  it('bias: "long_easter" recommends the 16-Day Easter Mega-Break', () => {
    const plan = planOptimalHolidays({
      year: 2026,
      annualAllowance: 15,
      bias: 'long_easter',
    });
    expect(plan.bias).toBe('long_easter');
    const easterTier3 = plan.bridges.find(b => b.label.includes('Easter') && b.tier === 3);
    expect(easterTier3).toBeDefined();
    expect(easterTier3?.workingDaysBooked).toBe(8);
    expect(easterTier3?.totalDaysOff).toBe(16);
    expect(easterTier3?.recommended).toBe(true);
  });

  it('bias: "summer_focus" prioritises May and August bridges when allowance is limited', () => {
    const plan = planOptimalHolidays({
      year: 2026,
      annualAllowance: 8,
      bias: 'summer_focus',
    });
    const recommended = plan.bridges.filter(b => b.recommended);
    expect(recommended.every(b => b.startDate.startsWith('2026-05-') || b.startDate.startsWith('2026-08-'))).toBe(true);
    expect(plan.recommendedLeaveDays).toBe(8);
  });
});

describe('formatUkDate & formatDatesToBookUk', () => {
  it('exposes labels for every OptimalLeaveBias', () => {
    for (const b of OPTIMAL_LEAVE_BIASES) {
      expect(OPTIMAL_LEAVE_BIAS_LABELS[b].label.length).toBeGreaterThan(0);
      expect(OPTIMAL_LEAVE_BIAS_LABELS[b].shortLabel.length).toBeGreaterThan(0);
    }
  });

  it('formats a single date in UK day-first order with optional weekday', () => {
    expect(formatUkDate('2027-01-04')).toBe('4 Jan 27');
    expect(formatUkDate('2027-01-04', true)).toBe('Mon 4 Jan 27');
    expect(formatUkDate('invalid')).toBe('');
  });

  it('collapses disjoint working-day runs into UK range segments', () => {
    expect(
      formatDatesToBookUk([
        '2026-12-21',
        '2026-12-22',
        '2026-12-23',
        '2026-12-24',
        '2026-12-29',
        '2026-12-30',
        '2026-12-31',
      ]),
    ).toBe('21 Dec - 24 Dec 26 + 29 Dec - 31 Dec 26');
    expect(formatDatesToBookUk([])).toBe('');
  });
});

describe('findBirthdayDayForHolidayRange & birthday-in-range deduplication', () => {
  it('deduplicates a 1-day birthday entry inside a 5-day holiday range in getBookedDaysForMonth', () => {
    const entries = [
      {
        id: 'h-may',
        startDate: '2026-05-11',
        endDate: '2026-05-15',
        occasion: 'May Week',
        count: 4,
        type: 'holiday' as const,
      },
      {
        id: 'b-may',
        startDate: '2026-05-13',
        endDate: '2026-05-13',
        occasion: 'Birthday Day Off (May Week)',
        count: 1,
        type: 'birthday' as const,
      },
    ];
    const booked = getBookedDaysForMonth(entries, 2026, 4, []);
    expect(booked).toHaveLength(5);
    expect(booked.filter(b => b.type === 'holiday').map(b => b.day)).toEqual([11, 12, 14, 15]);
    expect(booked.filter(b => b.type === 'birthday').map(b => b.day)).toEqual([13]);
  });

  it('finds the exact birthday inside a multi-day range for exact_or_nearest and within_week', () => {
    expect(
      findBirthdayDayForHolidayRange(
        '2026-05-11',
        '2026-05-15',
        2026,
        'exact_or_nearest',
        { month: 5, day: 13 },
        [],
      ),
    ).toBe('2026-05-13');

    // Birthday on Sunday 10 May 2026, trip is Mon 11 May - Fri 15 May -> closest matching working day is Mon 11 May
    expect(
      findBirthdayDayForHolidayRange(
        '2026-05-11',
        '2026-05-15',
        2026,
        'within_week',
        { month: 5, day: 10 },
        [],
      ),
    ).toBe('2026-05-11');
  });

  it('supports anytime rule and returns null for single-day or out-of-window ranges', () => {
    expect(
      findBirthdayDayForHolidayRange('2026-09-07', '2026-09-11', 2026, 'anytime', null, []),
    ).toBe('2026-09-07');

    // Single-day range returns null
    expect(
      findBirthdayDayForHolidayRange('2026-05-13', '2026-05-13', 2026, 'within_week', { month: 5, day: 13 }, []),
    ).toBeNull();

    // Out-of-window range returns null
    expect(
      findBirthdayDayForHolidayRange('2026-09-07', '2026-09-11', 2026, 'within_week', { month: 5, day: 13 }, []),
    ).toBeNull();
  });
});

describe('findHolidayCoveringDate', () => {
  const trip = {
    id: 'h-trip',
    startDate: '2026-05-28',
    endDate: '2026-06-03',
    occasion: 'Trip',
    count: 5,
    type: 'holiday' as const,
  };

  it('covers every date of the range inclusive, across a month boundary', () => {
    expect(findHolidayCoveringDate([trip], '2026-05-28')).toBe(trip);
    expect(findHolidayCoveringDate([trip], '2026-05-31')).toBe(trip);
    expect(findHolidayCoveringDate([trip], '2026-06-03')).toBe(trip);
  });

  it('does not cover the days either side of the range', () => {
    expect(findHolidayCoveringDate([trip], '2026-05-27')).toBeUndefined();
    expect(findHolidayCoveringDate([trip], '2026-06-04')).toBeUndefined();
  });

  it('treats an entry with no type as a holiday', () => {
    const { type: _type, ...untyped } = trip;
    expect(findHolidayCoveringDate([untyped], '2026-06-01')).toBe(untyped);
  });

  it('ignores sick and birthday entries', () => {
    const sick = { ...trip, id: 'sick', type: 'sick' as const };
    const birthday = { ...trip, id: 'bday', type: 'birthday' as const };
    expect(findHolidayCoveringDate([sick, birthday], '2026-06-01')).toBeUndefined();
  });

  it('skips the excluded entry and falls through to another that covers', () => {
    const other = { ...trip, id: 'h-other', startDate: '2026-06-01', endDate: '2026-06-05' };
    expect(findHolidayCoveringDate([trip], '2026-06-01', 'h-trip')).toBeUndefined();
    expect(findHolidayCoveringDate([trip, other], '2026-06-01', 'h-trip')).toBe(other);
  });

  it('covers its own date when it is a half day', () => {
    const half = {
      id: 'h-half',
      startDate: '2026-06-01',
      endDate: '2026-06-01',
      occasion: 'Appointment',
      count: 0.5,
      type: 'holiday' as const,
      halfDay: 'am' as const,
    };
    expect(findHolidayCoveringDate([half], '2026-06-01')).toBe(half);
  });

  it('returns nothing for a missing or malformed date or an empty list', () => {
    expect(findHolidayCoveringDate([trip], '')).toBeUndefined();
    expect(findHolidayCoveringDate([trip], 'not-a-date')).toBeUndefined();
    expect(findHolidayCoveringDate([], '2026-06-01')).toBeUndefined();
  });
});

describe('planOptimalHolidays with asOfDate remaining-year filtering', () => {
  it('excludes past bank holidays before asOfDate and emits remaining-year stretches', () => {
    const plan = planOptimalHolidays({
      year: 2026,
      annualAllowance: 25,
      asOfDate: '2026-10-25',
    });

    // No bridge before 2026-10-25 (Easter, Early May, Spring, Summer are all excluded)
    expect(plan.bridges.every(b => b.startDate >= '2026-10-25')).toBe(true);
    expect(plan.bridges.some(b => b.label.includes('Easter'))).toBe(false);
    expect(plan.bridges.some(b => b.label.includes('May'))).toBe(false);
    expect(plan.bridges.some(b => b.label.includes('Summer'))).toBe(false);

    // Christmas 2026 and remaining-year stretches (Long Weekend + 9-Day Week Break) are present
    expect(plan.bridges.some(b => b.label.includes('Christmas'))).toBe(true);
    expect(plan.bridges.some(b => b.clusterId === 'rem_long_weekend')).toBe(true);
    expect(plan.bridges.some(b => b.clusterId === 'rem_week_stretch')).toBe(true);

    // Positional overload also works identically
    const positionalPlan = planOptimalHolidays(
      2026,
      25,
      undefined,
      [],
      { enabled: false, rule: 'within_week', birthday: null },
      'balanced',
      '2026-10-25',
    );
    expect(positionalPlan.bridges.map(b => b.id)).toEqual(plan.bridges.map(b => b.id));
  });
});





describe('adjustHolidayCountForBirthday', () => {
  it.each([0.5, 1])('preserves a custom count through a %s-day round trip', birthdayCount => {
    const attached = adjustHolidayCountForBirthday(3.5, birthdayCount, true);
    expect(attached).toBe(3.5 - birthdayCount);
    expect(adjustHolidayCountForBirthday(attached!, birthdayCount, false)).toBe(3.5);
  });

  it('allows exact attachment and restoration from zero', () => {
    expect(adjustHolidayCountForBirthday(0.5, 0.5, true)).toBe(0);
    expect(adjustHolidayCountForBirthday(0, 0.5, false)).toBe(0.5);
    expect(adjustHolidayCountForBirthday(0, 1, false)).toBe(1);
  });

  it.each([0, 0.5])('rejects insufficient count %s rather than clamping', count => {
    expect(adjustHolidayCountForBirthday(count, 1, true)).toBeNull();
  });

  it.each([-1, NaN, Infinity, -Infinity])('rejects invalid existing count %s in both directions', count => {
    expect(adjustHolidayCountForBirthday(count, 1, true)).toBeNull();
    expect(adjustHolidayCountForBirthday(count, 1, false)).toBeNull();
  });

  it.each([0, -0.5, 0.25, 2, NaN, Infinity])('rejects invalid birthday count %s', birthdayCount => {
    expect(adjustHolidayCountForBirthday(3.5, birthdayCount, true)).toBeNull();
    expect(adjustHolidayCountForBirthday(3.5, birthdayCount, false)).toBeNull();
  });
});

describe('removeHolidayWithBirthdayRestoration', () => {
  const host: UserHoliday = {
    id: 'trip', startDate: '2026-05-28', endDate: '2026-06-03',
    occasion: 'Custom week', count: 3.5, type: 'holiday',
  };
  const birthday: UserHoliday = {
    id: 'birthday', startDate: '2026-06-01', endDate: '2026-06-01',
    occasion: 'Birthday', count: 1, type: 'birthday',
  };

  it.each([0.5, 1])('restores a %s-day birthday without recounting a custom week', count => {
    expect(removeHolidayWithBirthdayRestoration([host, { ...birthday, count }], birthday.id))
      .toEqual([{ ...host, count: 3.5 + count }]);
  });

  it('restores a cross-year host by stored calendar date', () => {
    const crossYear = { ...host, startDate: '2026-12-28', endDate: '2027-01-03' };
    const newYear = { ...birthday, startDate: '2027-01-01', endDate: '2027-01-01' };
    expect(removeHolidayWithBirthdayRestoration([crossYear, newYear], birthday.id))
      .toEqual([{ ...crossYear, count: 4.5 }]);
  });

  it('restores only the first regular host and never sick or birthday entries', () => {
    const sick: UserHoliday = { ...host, id: 'sick', type: 'sick' };
    const otherBirthday: UserHoliday = { ...host, id: 'other-birthday', type: 'birthday' };
    const second = { ...host, id: 'second' };
    expect(removeHolidayWithBirthdayRestoration([sick, otherBirthday, host, second, birthday], birthday.id))
      .toEqual([sick, otherBirthday, { ...host, count: 4.5 }, second]);
    expect(removeHolidayWithBirthdayRestoration([sick, otherBirthday, birthday], birthday.id))
      .toEqual([sick, otherBirthday]);
  });

  it('removes a standalone birthday and handles empty input', () => {
    expect(removeHolidayWithBirthdayRestoration([birthday], birthday.id)).toEqual([]);
    expect(removeHolidayWithBirthdayRestoration([], birthday.id)).toEqual([]);
  });

  it.each(['holiday', 'sick'] as const)('removes a %s without changing other counts', type => {
    const target = { ...host, type };
    expect(removeHolidayWithBirthdayRestoration([target, birthday], target.id)).toEqual([birthday]);
  });

  it('leaves all values unchanged for a nonexistent id', () => {
    expect(removeHolidayWithBirthdayRestoration([host, birthday], 'missing')).toEqual([host, birthday]);
  });

  it.each([0, -1, 2, NaN, Infinity])('does not restore invalid birthday count %s', count => {
    expect(removeHolidayWithBirthdayRestoration([host, { ...birthday, count }], birthday.id)).toEqual([host]);
  });

  it.each([-1, NaN, Infinity])('does not alter invalid host count %s', count => {
    const invalidHost = { ...host, count };
    expect(removeHolidayWithBirthdayRestoration([invalidHost, birthday], birthday.id)).toEqual([invalidHost]);
  });

  it('restores a zero-count host and leaves frozen inputs untouched', () => {
    const zeroHost = Object.freeze({ ...host, count: 0 });
    const frozenBirthday = Object.freeze({ ...birthday });
    const holidays = [zeroHost, frozenBirthday];
    Object.freeze(holidays);
    expect(removeHolidayWithBirthdayRestoration(holidays, birthday.id)).toEqual([{ ...host, count: 1 }]);
    expect(holidays).toEqual([{ ...host, count: 0 }, birthday]);
  });
});
