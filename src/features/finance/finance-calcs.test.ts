import { describe, expect, it } from 'vitest';
import { calculateFinance } from './finance-calcs';
import type { FinanceSettings } from './finance-types';

const baseSettings = (overrides: Partial<FinanceSettings> = {}): FinanceSettings => ({
  grossSalary: 0,
  pensionType: 'net_pay',
  personalPensionPercent: 0,
  employerPensionPercent: 0,
  studentLoanPlan: 'none',
  taxCode: '1257L',
  personalAllowance: 12570,
  weekends: 104,
  bankHolidays: 8,
  workHolidays: 25,
  workingHoursPerDay: 7.5,
  taxYear: 2026,
  ukRegion: 'england-and-wales',
  holidaysByUser: {},
  activeSavingsTypes: [],
  birthdayLeaveEnabled: false,
  birthdayLeaveRule: 'within_week',
  birthdayMonth: null,
  birthdayDay: null,
  packageBenefits: [],
  ...overrides,
});

describe('calculateFinance', () => {
  it('stacks multiple cash benefits and BIK across the £100k personal allowance taper', () => {
    // £96k salary + £4k BIK = £100k adjusted net income, so any cash benefit
    // enters the 60% taper zone rather than being taxed at 40%.
    const withBikAndCash = calculateFinance(baseSettings({
      grossSalary: 96000,
      packageBenefits: [
        { id: 'bik-1', name: 'Private medical', type: 'monetary', amount: 4000, kind: 'benefit-in-kind' },
        { id: 'cash-1', name: 'Bonus A', type: 'monetary', amount: 5000, kind: 'cash' },
        { id: 'cash-2', name: 'Bonus B', type: 'monetary', amount: 5000, kind: 'cash' },
      ],
    }));

    // Both bonuses fall entirely inside £100k-£125,140, so each pays 60% income tax (£3,000).
    expect(withBikAndCash.cashBenefits).toHaveLength(2);
    expect(withBikAndCash.cashBenefits[0].incomeTax).toBeCloseTo(3000, 2);
    expect(withBikAndCash.cashBenefits[1].incomeTax).toBeCloseTo(3000, 2);

    // Without BIK, £95k + £5k Bonus A sits below £100k (40% = £2,000), while
    // Bonus B stacks on top and enters the £100k taper (60% = £3,000).
    const stackedCashOnly = calculateFinance(baseSettings({
      grossSalary: 95000,
      packageBenefits: [
        { id: 'cash-1', name: 'Bonus A', type: 'monetary', amount: 5000, kind: 'cash' },
        { id: 'cash-2', name: 'Bonus B', type: 'monetary', amount: 5000, kind: 'cash' },
      ],
    }));

    expect(stackedCashOnly.cashBenefits[0].incomeTax).toBeCloseTo(2000, 2);
    expect(stackedCashOnly.cashBenefits[1].incomeTax).toBeCloseTo(3000, 2);
  });

  it('guards against division by zero when workingHoursPerDay is 0', () => {
    const result = calculateFinance(baseSettings({
      grossSalary: 50000,
      workingHoursPerDay: 0,
    }));

    expect(Number.isFinite(result.breakdown.standard.preTax.hourly)).toBe(true);
    expect(Number.isFinite(result.breakdown.excludingLeave.postTax.hourly)).toBe(true);
  });
});
