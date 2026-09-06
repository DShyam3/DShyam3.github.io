import { describe, expect, it } from 'vitest';
import { calculateActualPayday } from './payday';

describe('calculateActualPayday', () => {
  it('leaves a working day alone', () => {
    // 25 Nov 2025 was a Tuesday.
    const { date, adjusted, adjustReason } = calculateActualPayday(2025, 10, 25, []);
    expect(date.getDate()).toBe(25);
    expect(adjusted).toBe(false);
    expect(adjustReason).toBeNull();
  });

  it('moves backwards off a weekend, not forwards', () => {
    // 30 Nov 2025 was a Sunday; the Saturday before it is also skipped.
    const { date, adjusted, adjustReason } = calculateActualPayday(2025, 10, 30, []);
    expect(date.getDate()).toBe(28); // Friday
    expect(adjusted).toBe(true);
    expect(adjustReason).toBe('weekend');
  });

  it('moves backwards off a bank holiday', () => {
    // 25 Dec 2025 was a Thursday.
    const { date, adjustReason } = calculateActualPayday(2025, 11, 25, ['2025-12-25']);
    expect(date.getDate()).toBe(24);
    expect(adjustReason).toBe('bank_holiday');
  });

  it('walks back through consecutive bank holidays and a weekend', () => {
    // 25th Thu and 26th Fri are holidays, so the 25th falls to Wednesday 24th.
    const { date } = calculateActualPayday(2025, 11, 26, ['2025-12-25', '2025-12-26']);
    expect(date.getDate()).toBe(24);
  });

  it('clamps a scheduled day past the end of the month', () => {
    // No 31st in February; 28 Feb 2025 was a Friday, so no further adjustment.
    const { date, adjusted } = calculateActualPayday(2025, 1, 31, []);
    expect(date.getDate()).toBe(28);
    expect(adjusted).toBe(false);
  });

  it('crosses into the previous month when the 1st is a weekend', () => {
    // 1 Nov 2025 was a Saturday.
    const { date } = calculateActualPayday(2025, 10, 1, []);
    expect(date.getMonth()).toBe(9); // October
    expect(date.getDate()).toBe(31);
  });
});
