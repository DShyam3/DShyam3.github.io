import { describe, expect, it } from 'vitest';
import { deriveFinanceChangeSummary, type ChangeSummaryTransaction } from './change-summary';

const transaction = (overrides: Partial<ChangeSummaryTransaction> = {}): ChangeSummaryTransaction => ({
  id: 'transaction',
  date: '2026-09-01',
  amount: 10,
  category: 'Food',
  ...overrides,
});

describe('deriveFinanceChangeSummary', () => {
  it('compares month-to-date windows with the same day count', () => {
    const summary = deriveFinanceChangeSummary([
      transaction({ id: 'salary-now', date: '2026-09-02', amount: -2000 }),
      transaction({ id: 'food-now', date: '2026-09-05', amount: 80 }),
      transaction({ id: 'salary-before', date: '2026-08-02', amount: -1800 }),
      transaction({ id: 'food-before', date: '2026-08-05', amount: 50 }),
      transaction({ id: 'after-today', date: '2026-09-11', amount: 999 }),
      transaction({ id: 'after-comparison', date: '2026-08-11', amount: 999 }),
    ], '2026-09-10');

    expect(summary.currentPeriod).toEqual({ startDate: '2026-09-01', endDate: '2026-09-10', label: '1–10 Sep' });
    expect(summary.previousPeriod).toEqual({ startDate: '2026-08-01', endDate: '2026-08-10', label: '1–10 Aug' });
    expect(summary.current).toEqual({ income: 2000, spending: 80, net: 1920, transactionCount: 2 });
    expect(summary.previous).toEqual({ income: 1800, spending: 50, net: 1750, transactionCount: 2 });
    expect(summary.deltas).toEqual({ income: 200, spending: 30, net: 170 });
  });

  it('finds the category with the largest absolute spending movement', () => {
    const summary = deriveFinanceChangeSummary([
      transaction({ id: 'travel-now', date: '2026-09-02', amount: 250, category: 'Travel' }),
      transaction({ id: 'food-now', date: '2026-09-04', amount: 100, category: 'Food' }),
      transaction({ id: 'travel-before', date: '2026-08-02', amount: 20, category: 'Travel' }),
      transaction({ id: 'food-before', date: '2026-08-04', amount: 400, category: 'Food' }),
    ], '2026-09-10');

    expect(summary.largestSpendingChange).toEqual({
      category: 'Food', current: 100, previous: 400, change: -300,
    });
  });

  it('keeps ledger signs explicit and only categorises outgoing money', () => {
    const summary = deriveFinanceChangeSummary([
      transaction({ id: 'income', date: '2026-09-01', amount: -123.45, category: 'Salary' }),
      transaction({ id: 'other', date: '2026-09-02', amount: 25, category: '  ' }),
    ], '2026-09-10');

    expect(summary.current).toEqual({ income: 123.45, spending: 25, net: 98.45, transactionCount: 2 });
    expect(summary.largestSpendingChange).toEqual({
      category: 'Uncategorised', current: 25, previous: 0, change: 25,
    });
  });

  it('handles February and missing comparison data without using the device clock', () => {
    const summary = deriveFinanceChangeSummary([
      transaction({ date: '2028-03-01', amount: 10 }),
      transaction({ date: 'not-a-date', amount: 99 }),
    ], '2028-03-31');

    expect(summary.previousPeriod).toEqual({ startDate: '2028-02-01', endDate: '2028-02-29', label: '1–29 Feb' });
    expect(summary.hasComparison).toBe(false);
    expect(summary.current.spending).toBe(10);
  });

  it('returns an empty, deterministic summary for an invalid today value', () => {
    const summary = deriveFinanceChangeSummary([transaction()], 'tomorrow');

    expect(summary.current).toEqual({ income: 0, spending: 0, net: 0, transactionCount: 0 });
    expect(summary.previous).toEqual({ income: 0, spending: 0, net: 0, transactionCount: 0 });
    expect(summary.hasComparison).toBe(false);
  });
});
