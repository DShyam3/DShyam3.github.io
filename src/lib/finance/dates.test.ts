import { describe, expect, it } from 'vitest';
import { getDaysInMonth, getStartDayOfWeek, isWeekend, toISODate } from './dates';

describe('toISODate', () => {
  it('formats in local time, not UTC', () => {
    // 1 Jan at 00:30 local. toISOString() would report 31 Dec west of UTC.
    expect(toISODate(new Date(2025, 0, 1, 0, 30))).toBe('2025-01-01');
  });

  it('zero-pads month and day', () => {
    expect(toISODate(new Date(2025, 8, 5))).toBe('2025-09-05');
  });
});

describe('isWeekend', () => {
  it('is true for Saturday and Sunday', () => {
    expect(isWeekend(new Date(2025, 10, 29))).toBe(true); // Sat
    expect(isWeekend(new Date(2025, 10, 30))).toBe(true); // Sun
  });

  it('is false for Friday and Monday', () => {
    expect(isWeekend(new Date(2025, 10, 28))).toBe(false);
    expect(isWeekend(new Date(2025, 11, 1))).toBe(false);
  });
});

describe('getDaysInMonth', () => {
  it('handles leap years', () => {
    expect(getDaysInMonth(2024, 1)).toBe(29);
    expect(getDaysInMonth(2025, 1)).toBe(28);
  });

  it('handles 30- and 31-day months', () => {
    expect(getDaysInMonth(2025, 3)).toBe(30); // April
    expect(getDaysInMonth(2025, 11)).toBe(31); // December
  });
});

describe('getStartDayOfWeek', () => {
  it('is Monday-first, not Sunday-first', () => {
    // 1 Jan 2025 was a Wednesday: 2 counting from Monday, 3 from Sunday.
    expect(getStartDayOfWeek(2025, 0)).toBe(2);
  });

  it('maps Sunday to 6 rather than 0', () => {
    // 1 June 2025 was a Sunday.
    expect(getStartDayOfWeek(2025, 5)).toBe(6);
  });
});
