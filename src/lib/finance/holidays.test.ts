import { describe, expect, it } from 'vitest';
import {
  calculateWorkingDaysInRange,
  formatDaysList,
  getBookedDaysForMonth,
  normalizeHolidays,
  parseDays,
  parseEntryDays,
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
