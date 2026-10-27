import { describe, expect, it } from 'vitest';
import { calculateFinance, selectTaxConfigForDate } from './finance-calcs';
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
  effectiveFrom: '2026-04-06',
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
    const results = calculateFinance(sampleSettings, [sampleTaxConfig], '2026-09-10');

    // Standard: (365 / 7) * 5 = 260.71428... (52.1429 weeks)
    expect(results.workingDaysStandard).toBeCloseTo((365 / 7) * 5, 4);

    // Including leave: 260 days (bank holidays and paid leave included)
    expect(results.workingDaysIncludingLeave).toBe(260);

    // Excluding leave: 260 - 8 bank holidays - 26 paid holidays = 226
    expect(results.workingDaysExcludingLeave).toBe(226);
  });

  it('computes expected rates for £55,000 gross salary across all 3 modes', () => {
    const results = calculateFinance(sampleSettings, [sampleTaxConfig], '2026-09-10');
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
    const results = calculateFinance(sampleSettings, [sampleTaxConfig], '2026-09-10');
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

describe('effective-dated tax configuration', () => {
  const previousConfig: TaxConfig = {
    ...sampleTaxConfig,
    effectiveFrom: '2025-04-06',
    nationalInsuranceBands: {
      ...sampleTaxConfig.nationalInsuranceBands,
      mainRatePercent: 12,
    },
  };

  it('uses the most recent rate set at or before the requested date', () => {
    expect(selectTaxConfigForDate([previousConfig, sampleTaxConfig], '2026-03-31'))
      .toBe(previousConfig);
    expect(selectTaxConfigForDate([previousConfig, sampleTaxConfig], '2026-04-06'))
      .toBe(sampleTaxConfig);
  });

  it('does not apply a future configuration to an earlier figure', () => {
    expect(() => selectTaxConfigForDate([sampleTaxConfig], '2026-04-05'))
      .toThrow('No tax configuration is available for 2026-04-05.');
  });

  it('no longer lets the stored rate rows or the date move a figure', () => {
    // Income tax, NI and student loans come from the Tax Calculator engine now;
    // the rows only feed selectTaxConfigForDate. Rows that disagree wildly with
    // the engine, an empty list and a date before any row all give one answer.
    const absurdConfig: TaxConfig = {
      ...sampleTaxConfig,
      incomeTaxBands: { ...sampleTaxConfig.incomeTaxBands, basicRateLimit: 1, basicRatePercent: 99 },
      nationalInsuranceBands: { ...sampleTaxConfig.nationalInsuranceBands, mainRatePercent: 50 },
    };
    const reference = calculateFinance(sampleSettings, [sampleTaxConfig], '2026-09-10');
    expect(calculateFinance(sampleSettings, [previousConfig, sampleTaxConfig], '2026-03-31')).toEqual(reference);
    expect(calculateFinance(sampleSettings, [previousConfig, sampleTaxConfig], '2026-04-06')).toEqual(reference);
    expect(calculateFinance(sampleSettings, [absurdConfig], '2026-09-10')).toEqual(reference);
    expect(calculateFinance(sampleSettings, [], '2026-09-10')).toEqual(reference);
    expect(calculateFinance(sampleSettings, [sampleTaxConfig], '2020-01-01')).toEqual(reference);
  });

  it('does not throw when no tax configuration exists for the date', () => {
    expect(() => calculateFinance(sampleSettings, [], '2026-09-10')).not.toThrow();
    expect(() => calculateFinance(sampleSettings, [sampleTaxConfig], '2026-04-05')).not.toThrow();
  });
});

describe('calculateFinance figures for the £55,000 fixture', () => {
  // £55,000, 5% salary sacrifice (£2,750), plan 2, 1257L, England. Pay for tax,
  // NI and the loan is £52,250.
  const results = calculateFinance(sampleSettings, [sampleTaxConfig], '2026-09-10');

  it('takes income tax from the engine bands: 37,700 at 20% and the rest at 40%', () => {
    expect(results.incomeTax).toBeCloseTo(37700 * 0.2 + (52250 - 12570 - 37700) * 0.4, 3);
    expect(results.incomeTax).toBeCloseTo(8332, 3);
  });

  it('takes NI from the engine: 37,700 at 8% and 1,980 at 2%', () => {
    expect(results.nationalInsurance).toBeCloseTo(3055.6, 3);
  });

  it('takes the plan 2 loan from the engine threshold of £29,385, not the stored row (old: £2,245.95)', () => {
    expect(results.studentLoan).toBeCloseTo((52250 - 29385) * 0.09, 3);
    expect(results.studentLoan).toBeCloseTo(2057.85, 3);
  });

  it('keeps gross less deductions equal to take-home (old: £38,616.45; now £38,804.55)', () => {
    expect(results.personalPensionRate).toBe(2750);
    expect(results.totalDeductions).toBeCloseTo(8332 + 3055.6 + 2057.85 + 2750, 3);
    expect(results.netTakeHome).toBeCloseTo(38804.55, 3);
    expect(55000 - results.totalDeductions).toBeCloseTo(results.netTakeHome, 6);
  });
});
