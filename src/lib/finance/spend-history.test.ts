import { describe, expect, it } from 'vitest';
import { monthlySpend, spendYears, yearlySpend, type DatedAmount } from './spend-history';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// Mid-March 2026: a current year that is a quarter over, so "elapsed" and
// "twelve" give visibly different averages.
const TODAY = new Date(2026, 2, 15);
const none = () => 0;

describe('spendYears', () => {
  it('always offers this year and last, newest first', () => {
    expect(spendYears([], TODAY)).toEqual([2026, 2025]);
  });

  it('adds years the transactions mention, without duplicates', () => {
    const txs: DatedAmount[] = [
      { date: '2023-04-01', amount: 10 },
      { date: '2026-01-02', amount: 10 },
      { date: '2023-11-30', amount: 10 },
    ];
    expect(spendYears(txs, TODAY)).toEqual([2026, 2025, 2023]);
  });

  it('ignores rows whose date has no parseable year', () => {
    expect(spendYears([{ date: 'unknown', amount: 5 }], TODAY)).toEqual([2026, 2025]);
  });
});

describe('yearlySpend', () => {
  it('counts only the transactions in that year', () => {
    const txs: DatedAmount[] = [
      { date: '2026-01-10', amount: 100 },
      { date: '2026-02-10', amount: 200 },
      { date: '2025-12-31', amount: 999 },
    ];
    const [current] = yearlySpend([2026], txs, none, TODAY);
    expect(current.spentPerYear).toBe(300);
  });

  it('averages the current year over elapsed months, not twelve', () => {
    const txs: DatedAmount[] = [{ date: '2026-01-10', amount: 300 }];
    const [current] = yearlySpend([2026], txs, none, TODAY);
    expect(current.monthsElapsed).toBe(3);
    expect(current.avgMonthlySpend).toBe(100);
  });

  it('averages a past year over twelve months', () => {
    const txs: DatedAmount[] = [{ date: '2025-06-10', amount: 1200 }];
    const [past] = yearlySpend([2025], txs, none, TODAY);
    expect(past.monthsElapsed).toBe(12);
    expect(past.avgMonthlySpend).toBe(100);
  });

  it('adds one recurring charge per elapsed month', () => {
    const [current] = yearlySpend([2026], [], () => 50, TODAY);
    // Three elapsed months in the current year, so three charges.
    expect(current.spentPerYear).toBe(150);
  });

  it('reports zero rather than dividing by zero in January of the year', () => {
    // Elapsed is 1 in January, never 0 -- but the guard is what stops a NaN
    // reaching the page if that ever changes.
    const [jan] = yearlySpend([2026], [], none, new Date(2026, 0, 1));
    expect(jan.monthsElapsed).toBe(1);
    expect(jan.avgMonthlySpend).toBe(0);
  });

  it('treats a missing amount as zero', () => {
    const txs = [{ date: '2026-01-01' }] as unknown as DatedAmount[];
    expect(yearlySpend([2026], txs, none, TODAY)[0].spentPerYear).toBe(0);
  });
});

describe('monthlySpend', () => {
  it('returns the trailing window ending with the current month', () => {
    const series = monthlySpend([], none, 0, MONTHS, TODAY, 24);
    expect(series).toHaveLength(24);
    expect(series[0].monthLabel).toBe('Apr 2024');
    expect(series[23].monthLabel).toBe('Mar 2026');
  });

  it('crosses the year boundary backwards correctly', () => {
    const series = monthlySpend([], none, 0, MONTHS, TODAY, 4);
    expect(series.map(m => m.monthLabel)).toEqual(['Dec 2025', 'Jan 2026', 'Feb 2026', 'Mar 2026']);
  });

  it('buckets transactions by their own month, not the neighbouring one', () => {
    const txs: DatedAmount[] = [
      { date: '2026-02-28', amount: 10 },
      { date: '2026-03-01', amount: 20 },
    ];
    const series = monthlySpend(txs, none, 0, MONTHS, TODAY, 2);
    expect(series.map(m => m.spent)).toEqual([10, 20]);
  });

  it('adds the recurring total for that calendar month', () => {
    // Only March gets a charge, so the February bucket must stay empty.
    const series = monthlySpend([], (m) => (m === 3 ? 75 : 0), 0, MONTHS, TODAY, 2);
    expect(series.map(m => m.spent)).toEqual([0, 75]);
  });

  it('rounds to pence so the tooltip does not show a long float', () => {
    const txs: DatedAmount[] = [
      { date: '2026-03-01', amount: 0.1 },
      { date: '2026-03-02', amount: 0.2 },
    ];
    expect(monthlySpend(txs, none, 0, MONTHS, TODAY, 1)[0].spent).toBe(0.3);
  });

  it('carries the budget onto every point and abbreviates the labels', () => {
    const series = monthlySpend([], none, 500, MONTHS, TODAY, 2);
    expect(series.every(m => m.budget === 500)).toBe(true);
    expect(series.map(m => m.tickLabel)).toEqual(['F', 'M']);
  });
});
