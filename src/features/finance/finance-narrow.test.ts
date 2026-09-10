import { describe, expect, it } from 'vitest';
import { asInvestmentCategory } from './finance-narrow';

describe('asInvestmentCategory', () => {
  it('round-trips every category the investment-holdings table permits', () => {
    const categories = ['Stock', 'ETF', 'Crypto', 'Mutual Fund', 'Real Estate', 'Cash', 'Other'];

    expect(categories.map(asInvestmentCategory)).toEqual(categories);
  });

  it('degrades an unexpected stored category to Other', () => {
    expect(asInvestmentCategory('Leveraged token')).toBe('Other');
    expect(asInvestmentCategory(null)).toBe('Other');
  });
});
