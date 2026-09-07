import { describe, expect, it } from 'vitest';
import { calculateFinance } from './finance-calcs';
import type { FinanceSettings, TaxConfig } from './finance-types';

const sampleSettings: FinanceSettings = {
  grossSalary: 55000,
  pensionType: 'salary_sacrifice',
  personalPensionPercent: 5,
  employerPensionPercent: 5,
  studentLoanPlan: 'plan2',
  taxCode: '1257L',
  personalAllowance: 12570,
  weekends: 104,
  bankHolidays: 8,
  workHolidays: 26,
  workingHoursPerDay: 8,
  taxYear: 2026,
  ukRegion: 'england-and-wales',
};

const sampleTaxConfig: TaxConfig = {
  studentLoanThresholds: { none: Infinity, plan1: 24990, plan2: 27295, plan4: 31395, plan5: 25000, postgrad: 21000 },
  studentLoanRates: { none: 0, plan1: 0.09, plan2: 0.09, plan4: 0.09, plan5: 0.09, postgrad: 0.06 },
  incomeTaxBands: {
    basicRateLimit: 37700,
    higherRateLimit: 125140,
    basicRatePercent: 20,
    higherRatePercent: 40,
    additionalRatePercent: 45,
  },
  nationalInsuranceBands: {
    lowerThreshold: 12570,
    upperThreshold: 50270,
    mainRatePercent: 8,
    upperRatePercent: 2,
  },
};

describe('calculateFinance breakdown modes', () => {
  it('computes correct working days for all 3 modes', () => {
    const results = calculateFinance(sampleSettings, sampleTaxConfig);

    // Standard: (365 / 7) * 5 = 260.71428... (52.1429 weeks)
    expect(results.workingDaysStandard).toBeCloseTo((365 / 7) * 5, 4);

    // Including leave: 260 days (bank holidays and paid leave included)
    expect(results.workingDaysIncludingLeave).toBe(260);

    // Excluding leave: 260 - 8 bank holidays - 26 paid holidays = 226
    expect(results.workingDaysExcludingLeave).toBe(226);
  });

  it('computes expected rates for £55,000 gross salary across all 3 modes', () => {
    const results = calculateFinance(sampleSettings, sampleTaxConfig);
    const actualWeeks = 365 / 7;

    // Standard / Normal: based on 52.1429 weeks (365 / 7)
    expect(results.breakdown.standard.preTax.weekly).toBeCloseTo(55000 / actualWeeks, 4);
    expect(results.breakdown.standard.preTax.daily).toBeCloseTo(55000 / (actualWeeks * 5), 4);
    expect(results.breakdown.standard.preTax.hourly).toBeCloseTo(55000 / (actualWeeks * 5) / 8, 4);

    // Including leave: based on 52 weeks and 260 paid days (£211.54 / £26.44)
    expect(results.breakdown.includingLeave.preTax.weekly).toBeCloseTo(55000 / 52, 4);
    expect(results.breakdown.includingLeave.preTax.daily).toBeCloseTo(55000 / 260, 4);
    expect(results.breakdown.includingLeave.preTax.hourly).toBeCloseTo(55000 / 260 / 8, 4);

    // Excluding leave: based on 52 weeks and 226 working days (£243.36 / £30.42)
    expect(results.breakdown.excludingLeave.preTax.weekly).toBeCloseTo(55000 / 52, 4);
    expect(results.breakdown.excludingLeave.preTax.daily).toBeCloseTo(55000 / 226, 4);
    expect(results.breakdown.excludingLeave.preTax.hourly).toBeCloseTo(55000 / 226 / 8, 4);
  });

  it('provides all breakdown categories in standard mode', () => {
    const results = calculateFinance(sampleSettings, sampleTaxConfig);
    const standard = results.breakdown.standard;

    expect(standard.totalPackage.annual).toBeGreaterThan(standard.preTax.annual);
    expect(standard.postTax.annual).toBe(results.netTakeHome);
    expect(standard.tax.annual).toBe(results.incomeTax);
    expect(standard.ni.annual).toBe(results.nationalInsurance);
    expect(standard.deductions.annual).toBe(results.totalDeductions);

    // Verify daily is weekly / 5
    expect(standard.postTax.daily).toBeCloseTo(standard.postTax.weekly / 5, 4);
    expect(standard.postTax.hourly).toBeCloseTo(standard.postTax.daily / 8, 4);
  });
});
