import { describe, expect, it } from 'vitest';
import { calculateNetWorth } from './net-worth';

describe('current net worth', () => {
  it('counts broker cash and positions once alongside bank assets and liabilities', () => {
    expect(calculateNetWorth(
      [{ balance: 1000 }, { balance: 50 }, { balance: -100 }],
      [{ balance: 200 }],
      [{ shares: 2, currentPrice: 12, currentPriceKnown: true }],
    )).toEqual({ totalAssets: 1074, totalLoanBalance: 200, totalDebt: 300, netWorth: 774 });
  });

  it('ignores unknown quotes even when a stale price is present', () => {
    expect(calculateNetWorth([], [], [
      { shares: 2, currentPrice: 100, currentPriceKnown: false },
      { shares: 3, currentPrice: 0, currentPriceKnown: true },
      { shares: 2, currentPrice: 12 },
    ]).netWorth).toBe(24);
  });

  it('reflects edits and removal without carrying cached holding values', () => {
    const accounts = [{ balance: 5 }];
    expect(calculateNetWorth(accounts, [], [{ shares: 2, currentPrice: 12 }]).netWorth).toBe(29);
    expect(calculateNetWorth(accounts, [], [{ shares: 2, currentPrice: 13 }]).netWorth).toBe(31);
    expect(calculateNetWorth(accounts, [], []).netWorth).toBe(5);
  });

  it('rounds fractional units at the total and handles empty profiles', () => {
    expect(calculateNetWorth([], [], [{ shares: 0.3, currentPrice: 1.11 }]).netWorth).toBe(0.33);
    expect(calculateNetWorth([], [], [])).toEqual({ totalAssets: 0, totalLoanBalance: 0, totalDebt: 0, netWorth: 0 });
  });
});
