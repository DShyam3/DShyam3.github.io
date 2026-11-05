import { describe, expect, it } from 'vitest';
import { calculateMoneyHubPay, type MoneyHubAnnualPay, type MoneyHubPayrollOptions } from './money-hub-payroll';
import type { MoneyHubJurisdictionId } from './money-hub-catalogue';
import { calculateUkTax, UK_STANDARD_TAX_INPUT } from './uk-tax-calculator';
import { calculateDeTax } from './de-tax-calculator';
import { calculateNlTax } from './nl-tax-calculator';

const pay = (jurisdiction: MoneyHubJurisdictionId, income: number, options?: MoneyHubPayrollOptions): MoneyHubAnnualPay => {
  const result = calculateMoneyHubPay(jurisdiction, income, options);
  if (result.status !== 'calculated') throw new Error(`expected a calculation, got ${result.status}`);
  return result.pay;
};

const deduction = (annual: MoneyHubAnnualPay, id: string): number =>
  annual.deductions.find(line => line.id === id)!.annual;

describe('calculateMoneyHubPay', () => {
  it.each(['GB-ENG', 'GB-SCT', 'GB-WLS', 'GB-NIR', 'DE', 'NL'] as const)(
    '%s deductions reconcile gross to take-home across incomes',
    jurisdiction => {
      for (const income of [0, 12_570, 25_000, 50_000, 80_000, 125_140, 250_000]) {
        const annual = pay(jurisdiction, income);
        if (annual.unsupported !== null) continue;
        const deducted = annual.deductions.reduce((sum, line) => sum + line.annual, 0);
        expect(annual.annualTakeHome + deducted).toBeCloseTo(income, 6);
      }
    },
  );

  it('uses England bands in Wales and Northern Ireland and Scottish bands in Scotland', () => {
    const england = pay('GB-ENG', 50_000);
    expect(pay('GB-WLS', 50_000)).toEqual(england);
    expect(pay('GB-NIR', 50_000)).toEqual(england);
    const scotland = pay('GB-SCT', 50_000);
    const annualScottish = calculateUkTax({ ...UK_STANDARD_TAX_INPUT, region: 'scotland', income: 50_000, pensionShare: 0 });
    expect(scotland.annualTakeHome).toBe(annualScottish.takeHome);
    expect(deduction(scotland, 'income-tax')).toBeGreaterThan(deduction(england, 'income-tax'));
    expect(deduction(scotland, 'national-insurance')).toBe(deduction(england, 'national-insurance'));
  });

  it('maps the German calculator line by line, aged 23 or over by default', () => {
    const annual = pay('DE', 50_000);
    const reference = calculateDeTax({ income: 50_000, childless: true });
    expect(annual.annualTakeHome).toBe(reference.takeHome);
    expect(annual.annualTakeHome).toBeCloseTo(32_329, 6);
    expect(deduction(annual, 'income-tax')).toBe(6_796);
    expect(deduction(annual, 'solidarity-surcharge')).toBe(0);
    expect(deduction(annual, 'pension-insurance')).toBeCloseTo(4_650, 6);
    expect(deduction(annual, 'unemployment-insurance')).toBeCloseTo(650, 6);
    expect(deduction(annual, 'health-insurance')).toBeCloseTo(4_375, 6);
    expect(deduction(annual, 'care-insurance')).toBeCloseTo(1_200, 6);
    expect(annual.unsupported).toBeNull();
  });

  it('applies the German options: under 23 there is no care surcharge, the fund rate moves health only', () => {
    const under23 = pay('DE', 50_000, { de: { aged23OrOver: false } });
    expect(deduction(under23, 'care-insurance')).toBeCloseTo(900, 6);
    const cheaperFund = pay('DE', 50_000, { de: { healthAdditionalPercent: 2.5 } });
    expect(deduction(cheaperFund, 'health-insurance')).toBeCloseTo(50_000 * (0.146 + 0.025) / 2, 6);
    expect(deduction(cheaperFund, 'pension-insurance')).toBeCloseTo(4_650, 6);
  });

  it('flags the German Minijob and Midijob band rather than giving a confident figure', () => {
    expect(pay('DE', 24_000).unsupported).toMatch(/Midijob/);
    expect(pay('DE', 24_001).unsupported).toBeNull();
  });

  it('maps the Dutch calculator to one deduction after tax credits', () => {
    const annual = pay('NL', 50_000);
    expect(annual.annualTakeHome).toBe(calculateNlTax({ income: 50_000 }).takeHome);
    expect(annual.annualTakeHome).toBeCloseTo(39_140.33078, 4);
    expect(annual.deductions).toHaveLength(1);
  });

  it.each([
    { uk: { pensionPercent: -1 } },
    { uk: { pensionPercent: 101 } },
    { uk: { personalAllowance: NaN } },
  ] satisfies MoneyHubPayrollOptions[])('rejects invalid UK options %o', options => {
    expect(calculateMoneyHubPay('GB-ENG', 50_000, options).status).toBe('invalid-options');
    expect(calculateMoneyHubPay('DE', 50_000, options).status).toBe('calculated');
  });

  it.each([-0.1, 10.1, NaN, Infinity])('rejects a German health additional rate of %s%%', healthAdditionalPercent => {
    expect(calculateMoneyHubPay('DE', 50_000, { de: { healthAdditionalPercent } }).status).toBe('invalid-options');
    expect(calculateMoneyHubPay('GB-ENG', 50_000, { de: { healthAdditionalPercent } }).status).toBe('calculated');
  });

  it.each(['US-NY', 'FR', 'JP', 'AE'] as const)('does not calculate %s', jurisdiction => {
    expect(calculateMoneyHubPay(jurisdiction, 50_000)).toEqual({ status: 'not-calculated' });
  });
});
