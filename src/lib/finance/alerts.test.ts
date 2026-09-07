import { describe, expect, it } from 'vitest';
import { deriveAlerts, type AlertInput, type FinanceAlert } from './alerts';

const base: AlertInput = {
  hasBudget: true,
  totalBudget: 2000,
  totalSpent: 1200,
  liquidAssets: 9000,
  emergencyFundTarget: 8000,
  unreviewedCount: 0,
  bills: [],
  goals: [],
};

const codes = (a: FinanceAlert[]) => a.map(x => x.code);
const bill = (o: Partial<AlertInput['bills'][number]> = {}) => ({
  id: 'b', name: 'Bill', amount: 100, dueDate: 10, isPaid: false, dueThisMonth: true, ...o,
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
