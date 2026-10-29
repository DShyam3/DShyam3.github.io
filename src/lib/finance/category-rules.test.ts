import { describe, expect, it } from 'vitest';
import {
  applyCategoryRules,
  calculateRuleImpact,
  matchesCategoryRule,
  normalizeMerchantPattern,
  type CategoryRule,
} from './category-rules';

describe('normalizeMerchantPattern', () => {
  it('lowercases strings', () => {
    expect(normalizeMerchantPattern('TESCO')).toBe('tesco');
    expect(normalizeMerchantPattern('SaInSbUrY')).toBe('sainsbury');
  });

  it('trims leading and trailing whitespace', () => {
    expect(normalizeMerchantPattern('  Tesco  ')).toBe('tesco');
    expect(normalizeMerchantPattern('\t\n Marks & Spencer \n')).toBe('marks & spencer');
  });

  it('collapses multiple inner spaces, tabs, and newlines into a single space', () => {
    expect(normalizeMerchantPattern('Tesco   Stores   Express')).toBe('tesco stores express');
    expect(normalizeMerchantPattern('Boots\t\tChemist\n\nBranch')).toBe('boots chemist branch');
  });

  it('returns an empty string for empty or whitespace-only inputs', () => {
    expect(normalizeMerchantPattern('')).toBe('');
    expect(normalizeMerchantPattern('   ')).toBe('');
    expect(normalizeMerchantPattern('\t\n ')).toBe('');
  });

  it('preserves symbols, punctuation, and numbers while normalizing case and spaces', () => {
    expect(normalizeMerchantPattern('M&S Simply Food #123')).toBe('m&s simply food #123');
    expect(normalizeMerchantPattern("McDonald's - Drive Thru")).toBe("mcdonald's - drive thru");
  });
});

describe('matchesCategoryRule', () => {
  const sampleRule: CategoryRule = {
    id: 'rule-1',
    merchant_pattern: 'tesco',
    category: 'Groceries',
  };

  it('matches substring on tx.merchant_name', () => {
    expect(matchesCategoryRule({ merchant_name: 'Tesco Stores' }, sampleRule)).toBe(true);
  });

  it('matches substring on tx.name', () => {
    expect(matchesCategoryRule({ name: 'TESCO EXPRESS 2841' }, sampleRule)).toBe(true);
  });

  it('matches substring on tx.description', () => {
    expect(
      matchesCategoryRule(
        { description: 'Card purchase at TESCO STORES 991 on 2026-10-15' },
        sampleRule,
      ),
    ).toBe(true);
  });

  it('matches substring on tx.merchant', () => {
    expect(
      matchesCategoryRule(
        { merchant: 'Tesco Extra' },
        sampleRule,
      ),
    ).toBe(true);
  });

  it('matches exact strings ignoring case and surrounding whitespace', () => {
    expect(matchesCategoryRule({ name: '  TESCO  ' }, sampleRule)).toBe(true);
    expect(matchesCategoryRule({ name: 'tesco' }, sampleRule)).toBe(true);
  });

  it('matches multi-word patterns with varied internal spacing', () => {
    const multiWordRule: CategoryRule = {
      id: 'rule-2',
      merchant_pattern: '  marks   and   spencer  ',
      category: 'Shopping',
    };

    expect(
      matchesCategoryRule({ name: 'Marks and Spencer Food Hall' }, multiWordRule),
    ).toBe(true);
    expect(
      matchesCategoryRule({ merchant_name: 'MARKS   AND   SPENCER' }, multiWordRule),
    ).toBe(true);
  });

  it('returns false when none of the fields contain the pattern', () => {
    expect(
      matchesCategoryRule(
        {
          name: 'Sainsbury Local',
          merchant_name: 'Sainsbury',
          description: 'Weekly grocery run',
        },
        sampleRule,
      ),
    ).toBe(false);
  });

  it('returns false for partial non-matches where pattern is longer than candidate', () => {
    const specificRule: CategoryRule = {
      id: 'rule-3',
      merchant_pattern: 'tesco express london',
      category: 'Groceries',
    };
    expect(matchesCategoryRule({ name: 'Tesco Express' }, specificRule)).toBe(false);
  });

  it('returns false when rule merchant_pattern is empty or whitespace-only', () => {
    const emptyRule: CategoryRule = {
      id: 'rule-empty',
      merchant_pattern: '   ',
      category: 'General',
    };
    expect(matchesCategoryRule({ name: 'Tesco' }, emptyRule)).toBe(false);
  });

  it('returns false when transaction fields are undefined, null, or empty', () => {
    expect(matchesCategoryRule({}, sampleRule)).toBe(false);
    expect(
      matchesCategoryRule(
        { name: null, description: null, merchant_name: null },
        sampleRule,
      ),
    ).toBe(false);
    expect(
      matchesCategoryRule(
        { name: '', description: '   ', merchant_name: undefined },
        sampleRule,
      ),
    ).toBe(false);
  });
});

describe('applyCategoryRules', () => {
  interface TestTx {
    id: string;
    name: string;
    category?: string | null;
    user_modified?: boolean;
    merchant_name?: string | null;
    description?: string | null;
    amount?: number;
    date?: string;
  }

  const rules: CategoryRule[] = [
    {
      id: 'rule-1',
      merchant_pattern: 'tesco express',
      category: 'Convenience',
      rename_to: 'Tesco Express',
    },
    {
      id: 'rule-2',
      merchant_pattern: 'tesco',
      category: 'Groceries',
      rename_to: 'Tesco Superstore',
    },
    {
      id: 'rule-3',
      merchant_pattern: 'pret',
      category: 'Dining Out',
      rename_to: 'Pret A Manger',
    },
  ];

  it('returns an empty array when transactions array is empty', () => {
    expect(applyCategoryRules([], rules)).toEqual([]);
  });

  it('returns shallow copies of transactions when rules array is empty', () => {
    const original: TestTx[] = [
      { id: 'tx-1', name: 'Tesco', category: 'Shopping', amount: 15.5 },
    ];
    const result = applyCategoryRules(original, []);

    expect(result).toEqual(original);
    expect(result).not.toBe(original);
    expect(result[0]).not.toBe(original[0]);
  });

  it('applies matching rule category and rename_to on unmodified transactions', () => {
    const transactions: TestTx[] = [
      { id: 'tx-1', name: 'TESCO STORES 1234', category: 'General' },
    ];

    const result = applyCategoryRules(transactions, rules);

    expect(result[0].category).toBe('Groceries');
    expect(result[0].name).toBe('Tesco Superstore');
  });

  it('preserves user_modified transactions even if a rule matches', () => {
    const transactions: (TestTx & { userModified?: boolean; isReviewed?: boolean })[] = [
      {
        id: 'tx-1',
        name: 'Tesco Stationery',
        category: 'Work Supplies',
        user_modified: true,
      },
      {
        id: 'tx-2',
        name: 'Tesco Gift Card',
        category: 'Gifts',
        userModified: true,
      },
      {
        id: 'tx-3',
        name: 'Tesco Confirmed',
        category: 'Special Event',
        isReviewed: true,
      },
    ];

    const result = applyCategoryRules(transactions, rules);

    expect(result[0].category).toBe('Work Supplies');
    expect(result[0].name).toBe('Tesco Stationery');
    expect(result[1].category).toBe('Gifts');
    expect(result[1].name).toBe('Tesco Gift Card');
    expect(result[2].category).toBe('Special Event');
    expect(result[2].name).toBe('Tesco Confirmed');
  });

  it('first matching rule wins when multiple rules could match', () => {
    // "Tesco Express 4912" matches both 'tesco express' and 'tesco'
    const transactions: TestTx[] = [
      { id: 'tx-1', name: 'TESCO EXPRESS 4912', category: 'General' },
    ];

    const result = applyCategoryRules(transactions, rules);

    expect(result[0].category).toBe('Convenience');
    expect(result[0].name).toBe('Tesco Express');
  });

  it('keeps original category and name when no rule matches', () => {
    const transactions: TestTx[] = [
      { id: 'tx-1', name: 'Waterstones Books', category: 'Entertainment' },
    ];

    const result = applyCategoryRules(transactions, rules);

    expect(result[0].category).toBe('Entertainment');
    expect(result[0].name).toBe('Waterstones Books');
  });

  it('leaves name untouched when rule rename_to is missing, null, or whitespace', () => {
    const noRenameRules: CategoryRule[] = [
      { id: 'r1', merchant_pattern: 'uber', category: 'Transport', rename_to: null },
      { id: 'r2', merchant_pattern: 'bolt', category: 'Transport', rename_to: '   ' },
      { id: 'r3', merchant_pattern: 'lyft', category: 'Transport' },
    ];

    const transactions: TestTx[] = [
      { id: 'tx-1', name: 'UBER *TRIP 1', category: 'Other' },
      { id: 'tx-2', name: 'BOLT RIDE 2', category: 'Other' },
      { id: 'tx-3', name: 'LYFT *RIDE 3', category: 'Other' },
    ];

    const result = applyCategoryRules(transactions, noRenameRules);

    expect(result[0].name).toBe('UBER *TRIP 1');
    expect(result[0].category).toBe('Transport');

    expect(result[1].name).toBe('BOLT RIDE 2');
    expect(result[1].category).toBe('Transport');

    expect(result[2].name).toBe('LYFT *RIDE 3');
    expect(result[2].category).toBe('Transport');
  });

  it('trims leading/trailing whitespace when applying rename_to', () => {
    const renameRule: CategoryRule[] = [
      { id: 'r1', merchant_pattern: 'spotify', category: 'Subscriptions', rename_to: '  Spotify  ' },
    ];

    const transactions: TestTx[] = [
      { id: 'tx-1', name: 'SPOTIFY P123', category: 'Bills' },
    ];

    const result = applyCategoryRules(transactions, renameRule);
    expect(result[0].name).toBe('Spotify');
    expect(result[0].category).toBe('Subscriptions');
  });

  it('does not mutate original transactions or rules (pure function)', () => {
    const originalTx: TestTx = {
      id: 'tx-1',
      name: 'Tesco Stores',
      category: 'Old Category',
      amount: 42.5,
      date: '2026-10-25',
    };
    const txCopy = { ...originalTx };
    const ruleCopy = { ...rules[1] };

    const result = applyCategoryRules([originalTx], rules);

    expect(originalTx).toEqual(txCopy);
    expect(rules[1]).toEqual(ruleCopy);
    expect(result[0].amount).toBe(42.5);
    expect(result[0].date).toBe('2026-10-25');
  });
});

describe('calculateRuleImpact', () => {
  interface TestTx {
    id: string;
    name: string;
    category?: string | null;
    user_modified?: boolean;
    merchant_name?: string | null;
    description?: string | null;
  }

  const rule: CategoryRule = {
    id: 'rule-test',
    merchant_pattern: 'tesco',
    category: 'Groceries',
    rename_to: 'Tesco',
  };

  it('returns zeros and an empty diff list for empty transactions', () => {
    const impact = calculateRuleImpact([], rule);

    expect(impact).toEqual({
      matchingCount: 0,
      unmodifiedCount: 0,
      affectedTransactions: [],
    });
  });

  it('returns zeros when rule merchant_pattern is empty or whitespace', () => {
    const emptyRule = { merchant_pattern: '   ', category: 'Groceries' };
    const transactions: TestTx[] = [
      { id: '1', name: 'Tesco Extra', category: 'Shopping' },
    ];

    const impact = calculateRuleImpact(transactions, emptyRule);

    expect(impact).toEqual({
      matchingCount: 0,
      unmodifiedCount: 0,
      affectedTransactions: [],
    });
  });

  it('accurately counts matching transactions and separates unmodified from user_modified', () => {
    const transactions: TestTx[] = [
      { id: 'tx-1', name: 'Tesco Stores 1', category: 'General', user_modified: false },
      { id: 'tx-2', name: 'Tesco Stores 2', category: 'General' }, // user_modified undefined -> unmodified
      { id: 'tx-3', name: 'Tesco Petrol', category: 'Fuel', user_modified: true }, // user_modified true -> protected
      { id: 'tx-4', name: 'Sainsbury', category: 'Groceries' }, // does not match
    ];

    const impact = calculateRuleImpact(transactions, rule);

    expect(impact.matchingCount).toBe(3);
    expect(impact.unmodifiedCount).toBe(2);
    expect(impact.affectedTransactions).toHaveLength(2);
    expect(impact.affectedTransactions.map(t => t.id)).toEqual(['tx-1', 'tx-2']);
  });

  it('populates diff list with before and after category and name', () => {
    const transactions: TestTx[] = [
      { id: 'tx-1', name: 'TESCO STORE #482', category: 'Miscellaneous' },
    ];

    const impact = calculateRuleImpact(transactions, rule);

    expect(impact.affectedTransactions[0]).toEqual({
      id: 'tx-1',
      originalName: 'TESCO STORE #482',
      newName: 'Tesco',
      originalCategory: 'Miscellaneous',
      newCategory: 'Groceries',
    });
  });

  it('omits newName when rule has no rename_to or it is whitespace', () => {
    const ruleWithoutRename = {
      merchant_pattern: 'tesco',
      category: 'Groceries',
    };
    const transactions: TestTx[] = [
      { id: 'tx-1', name: 'Tesco Metro', category: 'Old' },
    ];

    const impact = calculateRuleImpact(transactions, ruleWithoutRename);

    expect(impact.affectedTransactions[0].newName).toBeUndefined();
    expect(impact.affectedTransactions[0]).toEqual({
      id: 'tx-1',
      originalName: 'Tesco Metro',
      originalCategory: 'Old',
      newCategory: 'Groceries',
    });
  });

  it('omits originalCategory when transaction had no category', () => {
    const transactions: TestTx[] = [
      { id: 'tx-1', name: 'Tesco Express', category: null },
      { id: 'tx-2', name: 'Tesco Extra', category: undefined },
      { id: 'tx-3', name: 'Tesco Superstore', category: '   ' },
    ];

    const impact = calculateRuleImpact(transactions, rule);

    expect(impact.affectedTransactions[0].originalCategory).toBeUndefined();
    expect(impact.affectedTransactions[1].originalCategory).toBeUndefined();
    expect(impact.affectedTransactions[2].originalCategory).toBeUndefined();
    expect(impact.affectedTransactions[0].newCategory).toBe('Groceries');
  });

  it('handles single row inputs correctly', () => {
    const singleTx: TestTx[] = [
      { id: 'only-1', name: 'Tesco', category: 'Food' },
    ];

    const impact = calculateRuleImpact(singleTx, rule);

    expect(impact.matchingCount).toBe(1);
    expect(impact.unmodifiedCount).toBe(1);
    expect(impact.affectedTransactions).toHaveLength(1);
    expect(impact.affectedTransactions[0].id).toBe('only-1');
  });

  it('accepts Omit<CategoryRule, "id"> as rule input', () => {
    const draftRule: Omit<CategoryRule, 'id'> = {
      merchant_pattern: 'tesco',
      category: 'Groceries',
      rename_to: 'Tesco UK',
    };

    const impact = calculateRuleImpact(
      [{ id: 'tx-1', name: 'Tesco Express' }],
      draftRule,
    );

    expect(impact.matchingCount).toBe(1);
    expect(impact.unmodifiedCount).toBe(1);
    expect(impact.affectedTransactions[0].newName).toBe('Tesco UK');
  });

  it('correctly handles transactions whose category already equals rule category', () => {
    const transactions: TestTx[] = [
      { id: 'tx-1', name: 'Tesco Superstore', category: 'Groceries' },
    ];

    const impact = calculateRuleImpact(transactions, rule);

    expect(impact.matchingCount).toBe(1);
    expect(impact.unmodifiedCount).toBe(1);
    expect(impact.affectedTransactions[0]).toEqual({
      id: 'tx-1',
      originalName: 'Tesco Superstore',
      newName: 'Tesco',
      originalCategory: 'Groceries',
      newCategory: 'Groceries',
    });
  });

  it('preserves exact negative, zero, and fractional monetary amounts across boundary dates', () => {
    interface RichTx extends TestTx {
      amount: number;
      date: string;
    }

    const richTx: RichTx[] = [
      {
        id: 'refund-1',
        name: 'Tesco Refund',
        category: 'Old',
        amount: -12.99,
        date: '2028-02-29', // Leap day boundary
      },
      {
        id: 'zero-1',
        name: 'Tesco Free Sample',
        category: null,
        amount: 0,
        date: '2026-12-31T23:59:59Z', // Year/tax-year boundary
      },
    ];

    const applied = applyCategoryRules(richTx, [rule]);
    expect(applied[0].amount).toBe(-12.99);
    expect(applied[0].date).toBe('2028-02-29');
    expect(applied[0].category).toBe('Groceries');
    expect(applied[0].name).toBe('Tesco');

    expect(applied[1].amount).toBe(0);
    expect(applied[1].date).toBe('2026-12-31T23:59:59Z');
    expect(applied[1].category).toBe('Groceries');
  });
});
