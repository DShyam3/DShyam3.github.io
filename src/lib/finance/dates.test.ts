import { describe, expect, it } from 'vitest';
import { epochDay, getDaysInMonth, getStartDayOfWeek, isoOfEpochDay, isWeekend, toISODate } from './dates';

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

describe('epochDay', () => {
  it('counts days from 1970-01-01', () => {
    expect(epochDay('1970-01-01')).toBe(0);
    expect(epochDay('1970-01-02')).toBe(1);
    expect(epochDay('1969-12-31')).toBe(-1);
    expect(epochDay('2026-10-09')).toBe(20_735);
  });

  it('counts calendar days across the clocks changing, not elapsed hours', () => {
    // The UK clocks went forward on 29 Mar 2026 and back on 25 Oct 2026.
    expect((epochDay('2026-03-30') ?? NaN) - (epochDay('2026-03-28') ?? NaN)).toBe(2);
    expect((epochDay('2026-10-30') ?? NaN) - (epochDay('2026-10-24') ?? NaN)).toBe(6);
  });

  it('knows month lengths, leap years and the year boundary', () => {
    expect((epochDay('2028-03-01') ?? NaN) - (epochDay('2028-02-28') ?? NaN)).toBe(2);
    expect((epochDay('2026-03-01') ?? NaN) - (epochDay('2026-02-28') ?? NaN)).toBe(1);
    expect((epochDay('2100-03-01') ?? NaN) - (epochDay('2100-02-28') ?? NaN)).toBe(1);
    expect((epochDay('2027-01-01') ?? NaN) - (epochDay('2026-12-31') ?? NaN)).toBe(1);
  });

  it('accepts the first and last supported years', () => {
    expect(epochDay('0000-01-01')).toBe(-719_528);
    expect(epochDay('9999-12-31')).toBe(2_932_896);
  });

  it('is undefined for dates that do not exist and for anything not in YYYY-MM-DD form', () => {
    for (const bad of ['', 'bad', '2026-02-30', '2026-13-01', '2026-00-10', '2026-04-31', '2026-9-3', '2026-10-09T00:00:00Z', ' 2026-10-09', '2027-02-29']) {
      expect(epochDay(bad)).toBeUndefined();
    }
    expect(epochDay('2028-02-29')).toBeDefined();
  });
});

describe('isoOfEpochDay', () => {
  it('is the inverse of epochDay', () => {
    for (const iso of ['1970-01-01', '1969-12-31', '2026-03-29', '2026-10-25', '2028-02-29', '2026-12-31', '0050-06-15', '9999-12-31']) {
      expect(isoOfEpochDay(epochDay(iso) ?? NaN)).toBe(iso);
    }
  });

  it('steps a day at a time through the clock changes and month ends', () => {
    expect(isoOfEpochDay((epochDay('2026-03-28') ?? NaN) + 2)).toBe('2026-03-30');
    expect(isoOfEpochDay((epochDay('2026-10-24') ?? NaN) + 2)).toBe('2026-10-26');
    expect(isoOfEpochDay((epochDay('2026-02-28') ?? NaN) + 1)).toBe('2026-03-01');
    expect(isoOfEpochDay((epochDay('2028-02-28') ?? NaN) + 1)).toBe('2028-02-29');
    expect(isoOfEpochDay((epochDay('2026-12-31') ?? NaN) + 1)).toBe('2027-01-01');
  });
});
