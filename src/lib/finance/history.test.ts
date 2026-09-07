import { describe, expect, it } from 'vitest';
import { netWorthChangeSince, startOfMonth, type NetWorthPoint } from './history';

const p = (capturedOn: string, netWorth: number): NetWorthPoint => ({
  capturedOn, netWorth, assets: 0, liabilities: 0,
});

describe('netWorthChangeSince', () => {
  it('reports nothing recorded when the series is empty', () => {
    const c = netWorthChangeSince([], '2026-09-01');
    expect(c.latest).toBeNull();
    expect(c.direction).toBe('unknown');
  });

  it('has a latest but no comparison from a single point', () => {
    const c = netWorthChangeSince([p('2026-09-06', -48794)], '2026-09-01');
    expect(c.latest?.netWorth).toBe(-48794);
    expect(c.previous).toBeNull();
    expect(c.direction).toBe('unknown');
  });

  it('compares newest against the oldest point in the window', () => {
    const c = netWorthChangeSince(
      [p('2026-09-01', -50000), p('2026-09-04', -49500), p('2026-09-08', -48000)],
      '2026-09-01',
    );
    expect(c.absolute).toBe(2000);
    expect(c.direction).toBe('up');
    expect(c.spanDays).toBe(7);
  });

  it('ignores points before the window', () => {
    const c = netWorthChangeSince(
      [p('2026-08-01', -60000), p('2026-09-02', -50000), p('2026-09-08', -48000)],
      '2026-09-01',
    );
    expect(c.previous?.capturedOn).toBe('2026-09-02');
    expect(c.absolute).toBe(2000);
  });

  it('does not care what order the rows arrive in', () => {
    const asc = netWorthChangeSince([p('2026-09-01', -500), p('2026-09-09', -400)], '2026-09-01');
    const desc = netWorthChangeSince([p('2026-09-09', -400), p('2026-09-01', -500)], '2026-09-01');
    expect(desc).toEqual(asc);
  });

  it('reports a percentage against the magnitude, so a rising debt is positive', () => {
    // -50,000 to -48,000 is a 2,000 improvement, which is 4% of the old figure.
    const c = netWorthChangeSince([p('2026-09-01', -50000), p('2026-09-08', -48000)], '2026-09-01');
    expect(c.percent).toBe(4);
  });

  it('reports null percent rather than Infinity from a zero baseline', () => {
    const c = netWorthChangeSince([p('2026-09-01', 0), p('2026-09-08', 500)], '2026-09-01');
    expect(c.percent).toBeNull();
    expect(c.absolute).toBe(500);
  });

  it('calls an unchanged position flat rather than up', () => {
    expect(netWorthChangeSince([p('2026-09-01', 100), p('2026-09-08', 100)], '2026-09-01').direction)
      .toBe('flat');
  });

  it('widens the span across a gap instead of pretending it was a day', () => {
    // A fortnight missing from the middle still compares across the whole window.
    const c = netWorthChangeSince([p('2026-09-01', 100), p('2026-09-20', 300)], '2026-09-01');
    expect(c.spanDays).toBe(19);
  });
});

describe('startOfMonth', () => {
  it('anchors to the first of the same month', () => {
    expect(startOfMonth('2026-09-17')).toBe('2026-09-01');
  });

  it('is already the first when given the first', () => {
    expect(startOfMonth('2026-01-01')).toBe('2026-01-01');
  });
});
