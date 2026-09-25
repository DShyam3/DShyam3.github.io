import { describe, expect, it } from 'vitest';
import {
  deriveAlerts,
  COSTLY_DEBT_APR_PERCENT,
  CREDIT_UTILISATION_THRESHOLD_PERCENT,
  MIN_ANNUAL_INTEREST_WORTH_NOTING,
  type AlertInput,
  type AlertDebt,
  type AlertCreditCard,
  type FinanceAlert,
} from './alerts';

const base: AlertInput = {
  hasBudget: true,
  totalBudget: 2000,
  totalSpent: 1200,
  liquidAssets: 9000,
  emergencyFundTarget: 8000,
  unreviewedCount: 0,
  bills: [],
  goals: [],
  debts: [],
  creditCards: [],
};

const codes = (a: FinanceAlert[]) => a.map(x => x.code);
const bill = (o: Partial<AlertInput['bills'][number]> = {}) => ({
  id: 'b', name: 'Bill', amount: 100, dueDate: 10, isPaid: false, dueThisMonth: true, ...o,
});
const debt = (o: Partial<AlertDebt> = {}): AlertDebt => ({
  id: 'd', name: 'Debt', type: 'credit', repaymentType: 'amortising', balance: 1000, aprPercent: 20, ...o,
});
const card = (o: Partial<AlertCreditCard> = {}): AlertCreditCard => ({
  id: 'c', name: 'Card', balance: -100, creditLimit: 1000, ...o,
});

describe('a healthy position', () => {
  it('raises nothing', () => {
    expect(deriveAlerts(base, '2026-09-15')).toEqual([]);
  });
});

describe('emergency fund', () => {
  it('is critical when cash is below target', () => {
    const a = deriveAlerts({ ...base, liquidAssets: 7500 }, '2026-09-15');
    expect(a).toEqual([
      { code: 'emergency_fund_short', severity: 'critical', shortfall: 500, target: 8000 },
    ]);
  });

  it('says nothing when no emergency fund is set', () => {
    expect(deriveAlerts({ ...base, emergencyFundTarget: 0, liquidAssets: 0 }, '2026-09-15')).toEqual([]);
  });
});

describe('bills', () => {
  it('treats an unpaid bill whose day has passed as overdue', () => {
    const a = deriveAlerts({ ...base, bills: [bill({ dueDate: 5, amount: 150 })] }, '2026-09-15');
    expect(a[0]).toMatchObject({ code: 'bills_overdue', count: 1, total: 150 });
  });

  it('warns about bills falling due within the week', () => {
    const a = deriveAlerts({ ...base, bills: [bill({ dueDate: 18 })] }, '2026-09-15');
    expect(a[0]).toMatchObject({ code: 'bills_due_soon', count: 1, withinDays: 7 });
  });

  it('ignores one due later in the month', () => {
    expect(codes(deriveAlerts({ ...base, bills: [bill({ dueDate: 28 })] }, '2026-09-15'))).toEqual([]);
  });

  it('ignores paid bills entirely', () => {
    const bills = [bill({ dueDate: 2, isPaid: true }), bill({ dueDate: 17, isPaid: true })];
    expect(codes(deriveAlerts({ ...base, bills }, '2026-09-15'))).toEqual([]);
  });

  it('ignores bills not due this month', () => {
    const bills = [bill({ dueDate: 2, dueThisMonth: false })];
    expect(codes(deriveAlerts({ ...base, bills }, '2026-09-15'))).toEqual([]);
  });

  it('sums each group rather than reporting one alert per bill', () => {
    const bills = [bill({ id: 'a', dueDate: 3, amount: 100 }), bill({ id: 'b', dueDate: 4, amount: 50 })];
    const a = deriveAlerts({ ...base, bills }, '2026-09-15');
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ count: 2, total: 150 });
  });
});

describe('budget', () => {
  it('warns once spending passes the budget', () => {
    const a = deriveAlerts({ ...base, totalSpent: 2300 }, '2026-09-15');
    expect(a[0]).toMatchObject({ code: 'over_budget', overBy: 300 });
  });

  it('reports the missing budget rather than claiming an overspend against zero', () => {
    const a = deriveAlerts({ ...base, hasBudget: false, totalBudget: 0, totalSpent: 1200 }, '2026-09-15');
    expect(codes(a)).toEqual(['no_budget']);
  });
});

describe('goals', () => {
  const goal = { id: 'g1', name: 'Japan', targetAmount: 4000, currentAmount: 1000, targetDate: '2026-12-01' };

  it('flags a goal that cannot reach its date at the current rate', () => {
    // 3,000 left at 500 a month is 6 months, but only 3 remain.
    const a = deriveAlerts({ ...base, goals: [{ ...goal, monthlyContribution: 500 }] }, '2026-09-15');
    expect(a[0]).toMatchObject({ code: 'goal_off_track', monthsNeeded: 6, monthsAvailable: 3 });
  });

  it('says nothing when the rate is enough', () => {
    const a = deriveAlerts({ ...base, goals: [{ ...goal, monthlyContribution: 1200 }] }, '2026-09-15');
    expect(codes(a)).toEqual([]);
  });

  it('says nothing about an unfunded goal, which has no rate to be behind', () => {
    const a = deriveAlerts({ ...base, goals: [{ ...goal, monthlyContribution: 0 }] }, '2026-09-15');
    expect(codes(a)).toEqual([]);
  });

  it('says nothing about a goal already met', () => {
    const met = { ...goal, currentAmount: 4000, monthlyContribution: 100 };
    expect(codes(deriveAlerts({ ...base, goals: [met] }, '2026-09-15'))).toEqual([]);
  });

  it('says nothing about a goal with no deadline', () => {
    const open = { ...goal, targetDate: '', monthlyContribution: 10 };
    expect(codes(deriveAlerts({ ...base, goals: [open] }, '2026-09-15'))).toEqual([]);
  });
});

describe('costly debt beside idle cash', () => {
  it('fires when a costly debt sits beside cash beyond the emergency fund', () => {
    const a = deriveAlerts(
      {
        ...base,
        liquidAssets: 11000,
        emergencyFundTarget: 8000,
        debts: [debt({ id: 'd1', name: 'Store card', aprPercent: 24.9, balance: 2400 })],
      },
      '2026-09-15',
    );
    expect(a).toContainEqual({
      code: 'costly_debt_beside_cash',
      severity: 'warning',
      spareCash: 3000,
      costlyDebtTotal: 2400,
      coverable: 2400,
      annualInterestCovered: 597.6,
      highestAprDebtName: 'Store card',
      highestAprPercent: 24.9,
      aprThresholdPercent: COSTLY_DEBT_APR_PERCENT,
    });
  });

  it('allocates spare cash highest APR first across debts', () => {
    const a = deriveAlerts(
      {
        ...base,
        liquidAssets: 11000,
        emergencyFundTarget: 8000,
        debts: [
          debt({ id: 'd1', name: 'Store card', aprPercent: 24.9, balance: 2400 }),
          debt({ id: 'd2', name: 'Personal loan', aprPercent: 12, balance: 5000 }),
        ],
      },
      '2026-09-15',
    );
    const alert = a.find(x => x.code === 'costly_debt_beside_cash');
    expect(alert).toMatchObject({
      spareCash: 3000,
      costlyDebtTotal: 7400,
      coverable: 3000,
      annualInterestCovered: 669.6,
      highestAprDebtName: 'Store card',
      highestAprPercent: 24.9,
    });
  });

  it('says nothing when no emergency fund target is set', () => {
    const a = deriveAlerts(
      { ...base, liquidAssets: 11000, emergencyFundTarget: 0, debts: [debt({ aprPercent: 24.9, balance: 2400 })] },
      '2026-09-15',
    );
    expect(codes(a)).not.toContain('costly_debt_beside_cash');
  });

  it('says nothing when cash does not exceed the target', () => {
    const a = deriveAlerts(
      { ...base, liquidAssets: 8000, emergencyFundTarget: 8000, debts: [debt({ aprPercent: 24.9, balance: 2400 })] },
      '2026-09-15',
    );
    expect(codes(a)).not.toContain('costly_debt_beside_cash');
  });

  it('ignores student debt by type, income-contingent repayment, mortgage debt, and a sub-threshold loan', () => {
    const a = deriveAlerts(
      {
        ...base,
        liquidAssets: 20000,
        emergencyFundTarget: 8000,
        debts: [
          debt({ id: 'd1', type: 'student', aprPercent: 30, balance: 5000 }),
          debt({ id: 'd2', type: 'personal', repaymentType: 'income_contingent', aprPercent: 30, balance: 5000 }),
          debt({ id: 'd3', type: 'mortgage', aprPercent: 30, balance: 5000 }),
          debt({ id: 'd4', type: 'personal', aprPercent: 9.9, balance: 5000 }),
        ],
      },
      '2026-09-15',
    );
    expect(codes(a)).not.toContain('costly_debt_beside_cash');
  });

  it('includes a debt at exactly the APR threshold', () => {
    const a = deriveAlerts(
      {
        ...base,
        liquidAssets: 20000,
        emergencyFundTarget: 8000,
        debts: [debt({ aprPercent: COSTLY_DEBT_APR_PERCENT, balance: 1000 })],
      },
      '2026-09-15',
    );
    const alert = a.find(x => x.code === 'costly_debt_beside_cash');
    expect(alert).toMatchObject({ annualInterestCovered: 100 });
  });

  it('says nothing when the interest covered is below the noise floor', () => {
    // Spare £50 on a 24.9% card is 12.45 -- true, but not worth an alert.
    const a = deriveAlerts(
      { ...base, liquidAssets: 8050, emergencyFundTarget: 8000, debts: [debt({ aprPercent: 24.9, balance: 2400 })] },
      '2026-09-15',
    );
    expect(codes(a)).not.toContain('costly_debt_beside_cash');
  });

  it('breaks ties deterministically by id', () => {
    const a = deriveAlerts(
      {
        ...base,
        liquidAssets: 20000,
        emergencyFundTarget: 8000,
        debts: [
          debt({ id: 'zeta', name: 'Zeta card', aprPercent: 20, balance: 1000 }),
          debt({ id: 'alpha', name: 'Alpha card', aprPercent: 20, balance: 1000 }),
        ],
      },
      '2026-09-15',
    );
    const alert = a.find(x => x.code === 'costly_debt_beside_cash');
    expect(alert).toMatchObject({ highestAprDebtName: 'Alpha card', highestAprPercent: 20 });
  });

  it('ignores a debt with a zero balance', () => {
    const a = deriveAlerts(
      { ...base, liquidAssets: 20000, emergencyFundTarget: 8000, debts: [debt({ aprPercent: 24.9, balance: 0 })] },
      '2026-09-15',
    );
    expect(codes(a)).not.toContain('costly_debt_beside_cash');
  });
});

describe('credit utilisation', () => {
  it('fires at 68% overall and identifies the highest card', () => {
    const a = deriveAlerts(
      {
        ...base,
        creditCards: [
          card({ id: 'c1', name: 'Card One', balance: -800, creditLimit: 1000 }),
          card({ id: 'c2', name: 'Card Two', balance: -560, creditLimit: 1000 }),
        ],
      },
      '2026-09-15',
    );
    expect(a).toContainEqual({
      code: 'credit_utilisation_high',
      severity: 'warning',
      utilisationPercent: 68,
      totalOwed: 1360,
      totalLimit: 2000,
      thresholdPercent: CREDIT_UTILISATION_THRESHOLD_PERCENT,
      highestCardName: 'Card One',
      highestCardPercent: 80,
    });
  });

  it('says nothing at 30.4%, which rounds down to the threshold', () => {
    const a = deriveAlerts(
      { ...base, creditCards: [card({ balance: -304, creditLimit: 1000 })] },
      '2026-09-15',
    );
    expect(codes(a)).not.toContain('credit_utilisation_high');
  });

  it('fires at 30.5%, which rounds up past the threshold', () => {
    const a = deriveAlerts(
      { ...base, creditCards: [card({ balance: -305, creditLimit: 1000 })] },
      '2026-09-15',
    );
    const alert = a.find(x => x.code === 'credit_utilisation_high');
    expect(alert).toMatchObject({ utilisationPercent: 31 });
  });

  it('ignores cards with a null or zero credit limit, even when maxed', () => {
    const a = deriveAlerts(
      {
        ...base,
        creditCards: [
          card({ id: 'maxed', creditLimit: null, balance: -5000 }),
          card({ id: 'zero-limit', creditLimit: 0, balance: -50 }),
          card({ id: 'ok', creditLimit: 1000, balance: -100 }),
        ],
      },
      '2026-09-15',
    );
    expect(codes(a)).not.toContain('credit_utilisation_high');
  });

  it('counts an in-credit balance as zero owed, not negative', () => {
    const a = deriveAlerts(
      { ...base, creditCards: [card({ balance: 50, creditLimit: 1000 })] },
      '2026-09-15',
    );
    expect(codes(a)).not.toContain('credit_utilisation_high');
  });

  it('says nothing with no cards', () => {
    expect(codes(deriveAlerts({ ...base, creditCards: [] }, '2026-09-15'))).not.toContain(
      'credit_utilisation_high',
    );
  });
});

describe('guidance alerts alongside existing ones', () => {
  it('keeps severity ordering with an overdue bill, costly debt and high utilisation together', () => {
    const a = deriveAlerts(
      {
        ...base,
        liquidAssets: 11000,
        emergencyFundTarget: 8000,
        bills: [bill({ dueDate: 5, amount: 150 })],
        debts: [debt({ id: 'd1', name: 'Store card', aprPercent: 24.9, balance: 2400 })],
        creditCards: [
          card({ id: 'c1', name: 'Card One', balance: -800, creditLimit: 1000 }),
          card({ id: 'c2', name: 'Card Two', balance: -560, creditLimit: 1000 }),
        ],
      },
      '2026-09-15',
    );
    expect(codes(a)).toEqual(['bills_overdue', 'costly_debt_beside_cash', 'credit_utilisation_high']);
    expect(a.map(x => x.severity)).toEqual(['critical', 'warning', 'warning']);
  });
});

describe('ordering and determinism', () => {
  it('puts the most serious first', () => {
    const a = deriveAlerts({
      ...base,
      liquidAssets: 100,
      totalSpent: 5000,
      unreviewedCount: 4,
      bills: [bill({ dueDate: 1 })],
    }, '2026-09-15');
    expect(a.map(x => x.severity)).toEqual(['critical', 'critical', 'warning', 'info']);
  });

  it('gives the same answer for the same day', () => {
    const input = { ...base, liquidAssets: 100, unreviewedCount: 2 };
    expect(deriveAlerts(input, '2026-09-15')).toEqual(deriveAlerts(input, '2026-09-15'));
  });

  it('depends on the date it is given, not on the clock', () => {
    const input = { ...base, bills: [bill({ dueDate: 10 })] };
    expect(codes(deriveAlerts(input, '2026-09-05'))).toEqual(['bills_due_soon']);
    expect(codes(deriveAlerts(input, '2026-09-15'))).toEqual(['bills_overdue']);
  });
});
