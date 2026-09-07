import { describe, expect, it } from 'vitest';
import { formatDate, formatDateLong, formatMonthYear } from './format-date';

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
    for (const bad of [null, undefined, '', 'not a date']) {
      expect(formatDate(bad)).toBe('');
    }
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
