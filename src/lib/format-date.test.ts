import { describe, expect, it } from 'vitest';
import { formatDate, formatDateLong, formatDayMonth, formatMonthYear } from './format-date';

describe('formatDate', () => {
  it('writes day first, zero-padded', () => {
    expect(formatDate('2026-08-28')).toBe('28/08/2026');
    expect(formatDate('2026-01-05')).toBe('05/01/2026');
  });

  it('is unambiguous on a date that could be read either way', () => {
    // 5 June, not 6 May. This is the whole reason the helper exists.
    expect(formatDate('2026-06-05')).toBe('05/06/2026');
  });

  it('accepts a Date and a timestamp as well as a string', () => {
    expect(formatDate(new Date(2026, 7, 28))).toBe('28/08/2026');
    expect(formatDate(new Date(2026, 7, 28).getTime())).toBe('28/08/2026');
  });

  it('returns an empty string rather than "Invalid Date"', () => {
    for (const bad of [null, undefined, '', 'not a date', '2026-02-30', '2026-13-01']) {
      expect(formatDate(bad)).toBe('');
    }
  });

  it('reads a bare date as that calendar day, not as UTC midnight', () => {
    // West of UTC, UTC midnight is the previous evening; the day must not move.
    expect(formatDate('2026-01-01')).toBe('01/01/2026');
    expect(formatMonthYear('2026-03-01')).toBe('Mar 2026');
  });

  it('still reads a full timestamp as an instant', () => {
    const instant = '2026-08-28T12:00:00Z';
    expect(formatDate(instant)).toBe(formatDate(new Date(instant)));
  });
});

describe('formatDateLong and formatMonthYear', () => {
  it('spell the month out, still day-first', () => {
    expect(formatDateLong('2026-08-28')).toBe('28 August 2026');
  });

  it('drop the day for a month heading', () => {
    expect(formatMonthYear('2026-08-28')).toBe('Aug 2026');
  });

  it('are empty for a bad value too', () => {
    expect(formatDateLong('nonsense')).toBe('');
    expect(formatMonthYear(null)).toBe('');
  });
});

describe('formatDayMonth', () => {
  it('writes the day and a short month, with the year only when asked', () => {
    expect(formatDayMonth('2026-08-07')).toBe('7 Aug');
    expect(formatDayMonth('2026-08-07', { withYear: true })).toBe('7 Aug 2026');
    expect(formatDayMonth('2026-12-31', { withYear: false })).toBe('31 Dec');
  });

  it('matches the local helper it replaces, whatever the runtime calls September', () => {
    const old = (date: string) => {
      const [y, m, d] = date.split('-').map(Number);
      return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    };
    for (const date of ['2026-09-07', '2026-01-01', '2025-12-31', '2024-02-29']) {
      expect(formatDayMonth(date, { withYear: true })).toBe(old(date));
    }
  });

  it('reads a bare date as that calendar day, not as UTC midnight', () => {
    expect(formatDayMonth('2026-01-01')).toBe('1 Jan');
  });

  it('accepts a Date and is empty for a bad value', () => {
    expect(formatDayMonth(new Date(2026, 7, 7), { withYear: true })).toBe('7 Aug 2026');
    for (const bad of [null, undefined, '', 'not a date', '2026-02-30']) {
      expect(formatDayMonth(bad)).toBe('');
    }
  });
});
