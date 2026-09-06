import { describe, expect, it } from 'vitest';
import { projectDebtBalance, STUDENT_LOAN_WRITE_OFF_YEARS } from './debt';

const opts = { grossSalary: 0, repaymentRate: 9, threshold: 27295, currentYear: 2025 };

describe('projectDebtBalance', () => {
  it('opens at the present balance', () => {
    const points = projectDebtBalance({ balance: 1000, interestRate: 0, minPayment: 100 }, opts);
    expect(points[0]).toEqual({ year: 2025, balance: 1000, paid: 0, interest: 0, writtenOff: 0 });
  });

  it('clears an interest-free amortising debt in the expected time', () => {
    const points = projectDebtBalance({ balance: 1000, interestRate: 0, minPayment: 100 }, opts);
    const last = points[points.length - 1];
    expect(last.balance).toBe(0);
    expect(last.paid).toBeCloseTo(1000);
    expect(last.year).toBeCloseTo(2025 + 10 / 12);
  });

  it('accrues interest before applying the payment', () => {
    const points = projectDebtBalance({ balance: 1000, interestRate: 12, minPayment: 100 }, opts);
    const last = points[points.length - 1];
    expect(last.interest).toBeGreaterThan(0);
    expect(last.paid).toBeGreaterThan(1000);
  });

  it('is stable across runs for a given currentYear', () => {
    const debt = { balance: 5000, interestRate: 6, minPayment: 100 };
    expect(projectDebtBalance(debt, opts)).toEqual(projectDebtBalance(debt, opts));
  });

  it('writes off an income-contingent balance at the end of the plan term', () => {
    const points = projectDebtBalance(
      {
        balance: 50000,
        interestRate: 6,
        minPayment: 0,
        repaymentType: 'income_contingent',
        studentLoanPlan: 'plan2',
        startDate: '2000-01-01',
      },
      { ...opts, grossSalary: 30000 },
    );

    const last = points[points.length - 1];
    expect(last.balance).toBe(0);
    expect(last.writtenOff).toBeGreaterThan(0);
    // Plan 2 writes off 30 years after 2000, so five years past currentYear.
    expect(STUDENT_LOAN_WRITE_OFF_YEARS.plan2).toBe(30);
    expect(last.year).toBe(2030);
  });

  it('repays nothing income-contingent below the threshold', () => {
    const points = projectDebtBalance(
      {
        balance: 20000,
        interestRate: 0,
        minPayment: 500,
        repaymentType: 'income_contingent',
        writeOffYears: 5,
        startDate: '2025-01-01',
      },
      { ...opts, grossSalary: 20000 },
    );
    const last = points[points.length - 1];
    expect(last.paid).toBe(0);
    expect(last.writtenOff).toBe(20000);
  });

  it('an explicit writeOffYears overrides the plan default', () => {
    const points = projectDebtBalance(
      {
        balance: 10000,
        interestRate: 5,
        minPayment: 0,
        repaymentType: 'income_contingent',
        studentLoanPlan: 'plan2',
        writeOffYears: 2,
        startDate: '2025-01-01',
      },
      { ...opts, grossSalary: 30000 },
    );
    expect(points[points.length - 1].year).toBe(2027);
  });

  it('stops projecting a balance the payment can never cover', () => {
    const points = projectDebtBalance({ balance: 10000, interestRate: 20, minPayment: 10 }, opts);
    const last = points[points.length - 1];
    expect(last.balance).toBeGreaterThan(10000);
    expect(last.year).toBeCloseTo(2025 + 120 / 12);
    expect(last.writtenOff).toBe(0);
  });

  it('returns only the opening point for a cleared debt', () => {
    expect(projectDebtBalance({ balance: 0, interestRate: 5, minPayment: 100 }, opts)).toHaveLength(1);
  });
});
