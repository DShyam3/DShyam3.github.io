import { describe, expect, it } from 'vitest';
import { formatDayHeading, formatMinutes, formatTotal } from './format';

describe('diary formatting', () => {
  it('formats minutes', () => {
    expect(formatMinutes(0)).toBe('0m');
    expect(formatMinutes(45)).toBe('45m');
    expect(formatMinutes(725)).toBe('12h 5m');
    expect(formatMinutes(130)).toBe('2h 10m');
  });
  it('prefixes at least when runtimes are unknown', () => {
    expect(formatTotal(130, 0)).toBe('2h 10m');
    expect(formatTotal(130, 2)).toBe('at least 2h 10m');
  });
  it('formats a day heading', () => {
    expect(formatDayHeading('2026-11-12')).toMatch(/Thu.*12 Nov 2026/);
  });
});
