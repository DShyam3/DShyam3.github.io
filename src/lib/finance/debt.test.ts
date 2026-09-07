import { describe, expect, it } from 'vitest';
import { projectDebtBalance, rateInForce, STUDENT_LOAN_WRITE_OFF_YEARS } from './debt';

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

describe('rateInForce', () => {
  const periods = [
    { effectiveFrom: '2027-01-01', rate: 8 },
    { effectiveFrom: '2025-01-01', rate: 4 },
  ];

  it('falls back when there is no schedule at all', () => {
    expect(rateInForce(undefined, 6, new Date(2025, 5, 1))).toBe(6);
    expect(rateInForce([], 6, new Date(2025, 5, 1))).toBe(6);
  });

  it('picks the latest period that has already begun, unsorted input included', () => {
    expect(rateInForce(periods, 6, new Date(2026, 0, 1))).toBe(4);
    expect(rateInForce(periods, 6, new Date(2028, 0, 1))).toBe(8);
  });

  it('takes effect on the day itself, not the day after', () => {
    expect(rateInForce(periods, 6, new Date('2027-01-01'))).toBe(8);
  });

  it('falls back while every period is still in the future', () => {
    expect(rateInForce(periods, 6, new Date(2024, 0, 1))).toBe(6);
  });

  it('ignores a period with an unparseable date rather than throwing', () => {
    expect(rateInForce([{ effectiveFrom: 'nonsense', rate: 99 }], 6, new Date(2026, 0, 1))).toBe(6);
  });
});

describe('projectDebtBalance with a rate schedule', () => {
  const scheduleOpts = { ...opts, today: new Date(2025, 0, 1) };

  it('leaves a debt without periods exactly as it was', () => {
    const debt = { balance: 10000, interestRate: 5, minPayment: 200 };
    expect(projectDebtBalance({ ...debt, ratePeriods: [] }, scheduleOpts))
      .toEqual(projectDebtBalance(debt, scheduleOpts));
  });

  it('charges more interest once a fix reverts to a higher rate', () => {
    const fixThenRevert = projectDebtBalance(
      {
        balance: 200000,
        interestRate: 3,
        minPayment: 1200,
        ratePeriods: [
          { effectiveFrom: '2025-01-01', rate: 3 },
          { effectiveFrom: '2027-01-01', rate: 8 },
        ],
      },
      scheduleOpts,
    );
    const fixedThroughout = projectDebtBalance(
      { balance: 200000, interestRate: 3, minPayment: 1200 },
      scheduleOpts,
    );
    const after = (points: typeof fixThenRevert) =>
      points.find(p => p.year === 2030)!;
    expect(after(fixThenRevert).interest).toBeGreaterThan(after(fixedThroughout).interest);
    expect(after(fixThenRevert).balance).toBeGreaterThan(after(fixedThroughout).balance);
  });

  it('uses the debt rate for months before any period starts', () => {
    // The schedule opens two years in, so the first two years run at 10%.
    const scheduled = projectDebtBalance(
      {
        balance: 10000,
        interestRate: 10,
        minPayment: 300,
        ratePeriods: [{ effectiveFrom: '2027-01-01', rate: 0 }],
      },
      scheduleOpts,
    );
    const flat = projectDebtBalance(
      { balance: 10000, interestRate: 10, minPayment: 300 },
      scheduleOpts,
    );
    expect(scheduled.find(p => p.year === 2026)!.interest)
      .toBeCloseTo(flat.find(p => p.year === 2026)!.interest, 6);
  });
});

describe('projectDebtBalance for PCP', () => {
  it('settles at the balloon instead of clearing', () => {
    const points = projectDebtBalance(
      { balance: 20000, interestRate: 0, minPayment: 500, repaymentType: 'pcp', finalPayment: 8000 },
      opts,
    );
    const last = points[points.length - 1];
    expect(last.balance).toBe(8000);
    // 12000 of depreciation at 500 a month, and the balloon is not paid.
    expect(last.paid).toBe(12000);
  });

  it('does not count the balloon as paid', () => {
    const withBalloon = projectDebtBalance(
      { balance: 20000, interestRate: 0, minPayment: 500, repaymentType: 'pcp', finalPayment: 8000 },
      opts,
    );
    const asHirePurchase = projectDebtBalance(
      { balance: 20000, interestRate: 0, minPayment: 500 },
      opts,
    );
    expect(withBalloon[withBalloon.length - 1].paid).toBeLessThan(
      asHirePurchase[asHirePurchase.length - 1].paid,
    );
  });

  it('reaches the balloon sooner than it would reach zero', () => {
    const pcp = projectDebtBalance(
      { balance: 20000, interestRate: 0, minPayment: 500, repaymentType: 'pcp', finalPayment: 8000 },
      opts,
    );
    const hp = projectDebtBalance({ balance: 20000, interestRate: 0, minPayment: 500 }, opts);
    expect(pcp[pcp.length - 1].year).toBeLessThan(hp[hp.length - 1].year);
  });

  it('does nothing when the balloon already covers the balance', () => {
    const points = projectDebtBalance(
      { balance: 5000, interestRate: 5, minPayment: 300, repaymentType: 'pcp', finalPayment: 8000 },
      opts,
    );
    expect(points).toHaveLength(1);
    expect(points[0].balance).toBe(5000);
  });

  it('treats a pcp without a final payment as ordinary amortisation', () => {
    const noBalloon = projectDebtBalance(
      { balance: 6000, interestRate: 0, minPayment: 500, repaymentType: 'pcp' },
      opts,
    );
    expect(noBalloon[noBalloon.length - 1].balance).toBe(0);
  });
});
