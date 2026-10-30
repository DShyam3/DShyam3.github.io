import { describe, expect, it } from 'vitest';
import {
  calculateUkTax,
  ukBasePersonalAllowance,
  ukBenefitInKindTax,
  ukCashAfterTax,
  ukChildBenefitBand,
  ukMarginalRate,
  ukPaySlices,
  ukTakeHomeBySlice,
  ukTaxCliffs,
  ukTaxCurve,
  UK_CHILDCARE_CUTOFF,
  UK_CHILD_BENEFIT_CHARGE_END,
  UK_CHILD_BENEFIT_CHARGE_START,
  UK_CHILD_BENEFIT_CHARGE_STEP,
  UK_CHILD_BENEFIT_WEEKS,
  UK_STATUTORY_PERSONAL_ALLOWANCE,
  UK_TAX_BAND_NAMES,
  UK_TAX_YEAR_LABEL,
  type UkIncomeBand,
  type UkPaySlice,
  type UkPensionMethod,
  type UkTaxBreakdown,
  type UkTaxInput,
  type UkTaxRegion,
  type UkUndergradPlan,
} from './uk-tax-calculator';

const base: UkTaxInput = {
  income: 0,
  kind: 'employed',
  region: 'rUK',
  benefitsInKind: 0,
  pensionContribution: 0,
  pensionMethod: 'salary-sacrifice',
  undergradPlan: 'none',
  postgradLoan: false,
  children: 0,
  childcareSupport: 0,
  marriageAllowance: false,
};

const input = (over: Partial<UkTaxInput>): UkTaxInput => ({ ...base, ...over });

/** Exact to a tenth of a penny: these are sums of a handful of products. */
const money = 3;

describe('UK_TAX_YEAR_LABEL', () => {
  it('names the tax year the rule set describes', () => {
    expect(UK_TAX_YEAR_LABEL).toBe('2026/27');
  });
});

describe('UK_CHILD_BENEFIT_WEEKS', () => {
  it('is 53: 2026/27 runs from a Monday to a Monday', () => {
    expect(UK_CHILD_BENEFIT_WEEKS).toBe(53);
    // 6 Apr 2026 and 5 Apr 2027 are both Mondays (getUTCDay 1).
    expect(new Date(Date.UTC(2026, 3, 6)).getUTCDay()).toBe(1);
    expect(new Date(Date.UTC(2027, 3, 5)).getUTCDay()).toBe(1);
  });

  it('is the multiplier behind the annual child benefit', () => {
    expect(calculateUkTax(input({ income: 30000, children: 1 })).childBenefit).toBeCloseTo(
      27.05 * UK_CHILD_BENEFIT_WEEKS,
      money,
    );
  });
});

describe('the HICBC and childcare constants', () => {
  it('states the thresholds the rule set is built from', () => {
    expect(UK_CHILD_BENEFIT_CHARGE_START).toBe(60_000);
    expect(UK_CHILD_BENEFIT_CHARGE_END).toBe(80_000);
    expect(UK_CHILD_BENEFIT_CHARGE_STEP).toBe(200);
    expect(UK_CHILDCARE_CUTOFF).toBe(100_000);
  });

  it('make 1% per complete step reach 100% exactly at the end of the range', () => {
    expect((UK_CHILD_BENEFIT_CHARGE_END - UK_CHILD_BENEFIT_CHARGE_START) / UK_CHILD_BENEFIT_CHARGE_STEP).toBe(100);
  });

  it('drive the calculation: the charge is 0, 1%, 50% and 100% at the matching adjusted net incomes', () => {
    const benefit = 27.05 * UK_CHILD_BENEFIT_WEEKS;
    const charge = (income: number): number => calculateUkTax(input({ income, children: 1 })).childBenefitCharge;
    expect(charge(UK_CHILD_BENEFIT_CHARGE_START)).toBe(0);
    expect(charge(UK_CHILD_BENEFIT_CHARGE_START + UK_CHILD_BENEFIT_CHARGE_STEP - 1)).toBe(0);
    expect(charge(UK_CHILD_BENEFIT_CHARGE_START + UK_CHILD_BENEFIT_CHARGE_STEP)).toBeCloseTo(benefit * 0.01, money);
    expect(charge(70_000)).toBeCloseTo(benefit * 0.5, money);
    expect(charge(UK_CHILD_BENEFIT_CHARGE_END - 1)).toBeCloseTo(benefit * 0.99, money);
    expect(charge(UK_CHILD_BENEFIT_CHARGE_END)).toBeCloseTo(benefit, money);
  });

  it('drive childcare support: held at the cutoff, lost a pound above', () => {
    const kept = (income: number): number =>
      calculateUkTax(input({ income, childcareSupport: 5000 })).childcareSupportKept;
    expect(kept(UK_CHILDCARE_CUTOFF)).toBe(5000);
    expect(kept(UK_CHILDCARE_CUTOFF + 1)).toBe(0);
    expect(ukTaxCliffs(input({ income: 50_000, childcareSupport: 5000 }))[0].atIncome).toBe(UK_CHILDCARE_CUTOFF);
  });
});

describe('calculateUkTax: the basic case', () => {
  it('works £50,000 through income tax, NI and take-home', () => {
    const b = calculateUkTax(input({ income: 50000 }));
    expect(b.grossIncome).toBe(50000);
    expect(b.adjustedNetIncome).toBe(50000);
    expect(b.personalAllowance).toBe(12570);
    expect(b.taxableIncome).toBe(37430);
    expect(b.incomeTax).toBeCloseTo(7486, money);
    expect(b.nationalInsurance).toBeCloseTo(2994.4, money);
    expect(b.takeHome).toBeCloseTo(39519.6, money);
    expect(b.netWithSupport).toBeCloseTo(39519.6, money);
    expect(b.effectiveRate).toBeCloseTo(0.2096, 4);
  });

  it('charges the 2% NI rate only on the slice above £50,270', () => {
    const b = calculateUkTax(input({ income: 60000 }));
    // 37,700 x 8% + 9,730 x 2%
    expect(b.nationalInsurance).toBeCloseTo(3210.6, money);
  });

  it('charges nothing at or below the personal allowance', () => {
    const b = calculateUkTax(input({ income: 12570 }));
    expect(b.incomeTax).toBe(0);
    expect(b.nationalInsurance).toBe(0);
    expect(b.takeHome).toBe(12570);
  });

  it('reports headroom to the taper and child benefit thresholds as negative', () => {
    const b = calculateUkTax(input({ income: 50000 }));
    expect(b.aboveTaperStart).toBe(-50000);
    expect(b.aboveChildBenefitStart).toBe(-10000);
  });

  it('gives the same answer twice', () => {
    const i = input({ income: 87654, region: 'scotland', undergradPlan: 'plan2', children: 2 });
    expect(calculateUkTax(i)).toEqual(calculateUkTax(i));
  });
});

describe('calculateUkTax: personal allowance taper', () => {
  it('removes £1 of allowance per £2 above £100,000', () => {
    expect(calculateUkTax(input({ income: 110000 })).personalAllowance).toBe(7570);
  });

  it('has no allowance left at £125,140', () => {
    expect(calculateUkTax(input({ income: 125140 })).personalAllowance).toBe(0);
  });

  it('stays at zero above £125,140 rather than going negative', () => {
    expect(calculateUkTax(input({ income: 200000 })).personalAllowance).toBe(0);
  });

  it('floors the reduction in the exact calculation', () => {
    // £1 over: 0.5 of reduction floors to nothing; £3 over: 1.5 floors to 1.
    expect(calculateUkTax(input({ income: 100001 })).personalAllowance).toBe(12570);
    expect(calculateUkTax(input({ income: 100003 })).personalAllowance).toBe(12569);
  });

  it('applies the 45% additional rate above £125,140 of taxable income', () => {
    const b = calculateUkTax(input({ income: 200000 }));
    // 37,700 x 20% + (125,140 - 37,700) x 40% + (200,000 - 125,140) x 45%
    expect(b.incomeTax).toBeCloseTo(7540 + 34976 + 33687, money);
  });
});

describe('calculateUkTax: Scotland', () => {
  it('works £50,000 through the six Scottish bands', () => {
    const b = calculateUkTax(input({ income: 50000, region: 'scotland' }));
    expect(b.incomeTax).toBeCloseTo(8982.05, money);
    // NI is UK-wide.
    expect(b.nationalInsurance).toBeCloseTo(2994.4, money);
  });

  it('uses the 48% top rate above £125,140 of taxable income', () => {
    const b = calculateUkTax(input({ income: 200000, region: 'scotland' }));
    const toAdvancedLimit =
      3967 * 0.19 + (16956 - 3967) * 0.2 + (31092 - 16956) * 0.21 + (62430 - 31092) * 0.42 + (125140 - 62430) * 0.45;
    expect(b.incomeTax).toBeCloseTo(toAdvancedLimit + (200000 - 125140) * 0.48, money);
  });
});

describe('calculateUkTax: student loans', () => {
  it('takes 9% above each undergraduate plan threshold', () => {
    const at = (undergradPlan: UkTaxInput['undergradPlan']) =>
      calculateUkTax(input({ income: 50000, undergradPlan })).studentLoan;
    expect(at('none')).toBe(0);
    expect(at('plan1')).toBeCloseTo((50000 - 26900) * 0.09, money);
    expect(at('plan2')).toBeCloseTo((50000 - 29385) * 0.09, money);
    expect(at('plan4')).toBeCloseTo((50000 - 33795) * 0.09, money);
    expect(at('plan5')).toBeCloseTo((50000 - 25000) * 0.09, money);
  });

  it('takes 6% above £21,000 for a postgraduate loan, on top of the undergraduate one', () => {
    const b = calculateUkTax(input({ income: 50000, undergradPlan: 'plan2', postgradLoan: true }));
    expect(b.studentLoan).toBeCloseTo((50000 - 29385) * 0.09, money);
    expect(b.postgradLoan).toBeCloseTo((50000 - 21000) * 0.06, money);
    expect(b.takeHome).toBeCloseTo(
      50000 - b.incomeTax - b.nationalInsurance - b.studentLoan - b.postgradLoan,
      money,
    );
  });

  it('takes nothing below the threshold', () => {
    const b = calculateUkTax(input({ income: 25000, undergradPlan: 'plan2', postgradLoan: true }));
    expect(b.studentLoan).toBe(0);
    expect(b.postgradLoan).toBeCloseTo(4000 * 0.06, money);
  });
});

describe('calculateUkTax: child benefit and the HICBC', () => {
  it('pays the first child at the higher weekly rate and the rest at the lower', () => {
    // 53 benefit weeks: 27.05 x 53 = 1,433.65; 62.85 x 53 = 3,331.05.
    expect(calculateUkTax(input({ income: 30000, children: 1 })).childBenefit).toBeCloseTo(1433.65, money);
    expect(calculateUkTax(input({ income: 30000, children: 3 })).childBenefit).toBeCloseTo(3331.05, money);
  });

  it('charges half of it at £70,000 and adds the rest to take-home', () => {
    const b = calculateUkTax(input({ income: 70000, children: 3, undergradPlan: 'plan2' }));
    expect(b.childBenefit).toBeCloseTo(3331.05, money);
    expect(b.childBenefitCharge).toBeCloseTo(1665.525, money);
    expect(b.takeHome).toBeCloseTo(
      70000 - b.incomeTax - b.nationalInsurance - b.studentLoan - 1665.525 + 3331.05,
      money,
    );
  });

  it('charges nothing until a complete £200 above £60,000', () => {
    expect(calculateUkTax(input({ income: 60199, children: 1 })).childBenefitCharge).toBe(0);
    const at200 = calculateUkTax(input({ income: 60200, children: 1 }));
    expect(at200.childBenefitCharge).toBeCloseTo(27.05 * 53 * 0.01, money);
  });

  it('charges all of it from £80,000 and no more above', () => {
    const full = 27.05 * 53;
    expect(calculateUkTax(input({ income: 80000, children: 1 })).childBenefitCharge).toBeCloseTo(full, money);
    expect(calculateUkTax(input({ income: 150000, children: 1 })).childBenefitCharge).toBeCloseTo(full, money);
  });

  it('measures the charge against adjusted net income, so a pension can bring it down', () => {
    const noPension = calculateUkTax(input({ income: 70000, children: 1 }));
    const pension = calculateUkTax(
      input({ income: 70000, children: 1, pensionContribution: 10000, pensionMethod: 'salary-sacrifice' }),
    );
    expect(pension.childBenefitCharge).toBe(0);
    expect(noPension.childBenefitCharge).toBeGreaterThan(0);
  });

  it('floors and clamps the number of children', () => {
    expect(calculateUkTax(input({ income: 30000, children: 2.9 })).childBenefit).toBeCloseTo(
      (27.05 + 17.9) * 53,
      money,
    );
    expect(calculateUkTax(input({ income: 30000, children: 500 })).childBenefit).toBeCloseTo(
      (27.05 + 19 * 17.9) * 53,
      money,
    );
    expect(calculateUkTax(input({ income: 30000, children: -3 })).childBenefit).toBe(0);
  });
});

describe('calculateUkTax: pensions', () => {
  const take = (over: Partial<UkTaxInput>): UkTaxBreakdown => calculateUkTax(input(over));

  it('salary sacrifice costs £3,800 net of tax and NI at £115,000, for £10,000 in', () => {
    const without = take({ income: 115000 });
    const sacrificed = take({ income: 115000, pensionContribution: 10000, pensionMethod: 'salary-sacrifice' });
    expect(sacrificed.pensionFromPay).toBe(10000);
    expect(without.takeHome - sacrificed.takeHome).toBeCloseTo(3800, money);
    // It restores allowance: 105,000 of adjusted net income.
    expect(sacrificed.personalAllowance).toBe(10070);
  });

  it('relief at source costs £4,000 net at £115,000 and only £8,000 leaves pay', () => {
    const without = take({ income: 115000 });
    const ras = take({ income: 115000, pensionContribution: 10000, pensionMethod: 'relief-at-source' });
    expect(ras.pensionFromPay).toBe(8000);
    expect(without.takeHome - ras.takeHome).toBeCloseTo(4000, money);
  });

  it('extends the basic band by the gross contribution under relief at source', () => {
    const b = take({ income: 60000, pensionContribution: 10000, pensionMethod: 'relief-at-source' });
    expect(b.incomeTax).toBeCloseTo(9486, money);
    expect(b.nationalInsurance).toBeCloseTo(3210.6, money);
    expect(b.takeHome).toBeCloseTo(39303.4, money);
  });

  it('extends the Scottish bands except the 19% starter band', () => {
    const b = take({
      income: 50000,
      region: 'scotland',
      pensionContribution: 4000,
      pensionMethod: 'relief-at-source',
    });
    // Taxable 37,430: starter 3,967; then 20% to 20,956; 21% to 35,092; 42% above.
    const expected =
      3967 * 0.19 + (20956 - 3967) * 0.2 + (35092 - 20956) * 0.21 + (37430 - 35092) * 0.42;
    expect(b.incomeTax).toBeCloseTo(expected, money);
  });

  it('net pay deducts before income tax but leaves NI and loans on full pay', () => {
    const b = take({
      income: 60000,
      pensionContribution: 5000,
      pensionMethod: 'net-pay',
      undergradPlan: 'plan2',
    });
    const taxed = take({ income: 55000 });
    expect(b.taxableIncome).toBe(55000 - 12570);
    expect(b.incomeTax).toBeCloseTo(taxed.incomeTax, money);
    expect(b.nationalInsurance).toBeCloseTo(take({ income: 60000 }).nationalInsurance, money);
    expect(b.studentLoan).toBeCloseTo((60000 - 29385) * 0.09, money);
    expect(b.pensionFromPay).toBe(5000);
  });

  it('salary sacrifice lowers NI and loans as well as tax', () => {
    const b = take({
      income: 60000,
      pensionContribution: 5000,
      pensionMethod: 'salary-sacrifice',
      undergradPlan: 'plan2',
    });
    expect(b.nationalInsurance).toBeCloseTo(take({ income: 55000 }).nationalInsurance, money);
    expect(b.studentLoan).toBeCloseTo((55000 - 29385) * 0.09, money);
  });

  it('clamps the contribution to the income and to zero', () => {
    const over = take({ income: 20000, pensionContribution: 50000, pensionMethod: 'salary-sacrifice' });
    expect(over.pensionFromPay).toBe(20000);
    expect(over.takeHome).toBe(0);
    expect(take({ income: 20000, pensionContribution: -500 }).pensionFromPay).toBe(0);
  });
});

describe('calculateUkTax: benefits in kind', () => {
  it('taxes a benefit in kind but excludes it from NI, loans and cash', () => {
    const b = calculateUkTax(input({ income: 40000, benefitsInKind: 10000, undergradPlan: 'plan2' }));
    expect(b.grossIncome).toBe(50000);
    expect(b.taxableIncome).toBe(50000 - 12570);
    expect(b.incomeTax).toBeCloseTo(7486, money);
    expect(b.nationalInsurance).toBeCloseTo((40000 - 12570) * 0.08, money);
    expect(b.studentLoan).toBeCloseTo((40000 - 29385) * 0.09, money);
    // Cash is the £40,000 pay less deductions, not £50,000.
    expect(b.takeHome).toBeCloseTo(40000 - b.incomeTax - b.nationalInsurance - b.studentLoan, money);
  });

  it('counts a benefit in kind towards adjusted net income', () => {
    expect(calculateUkTax(input({ income: 95000, benefitsInKind: 10000 })).adjustedNetIncome).toBe(105000);
  });
});

describe('calculateUkTax: self-employed', () => {
  it('pays Class 4 at 6% rather than Class 1 at 8%', () => {
    const b = calculateUkTax(input({ income: 50000, kind: 'self-employed' }));
    expect(b.incomeTax).toBeCloseTo(7486, money);
    // 2,262 is the Class 4 main-rate maximum, reached at £50,270; at £50,000
    // the slice is 37,430 wide, not 37,700.
    expect(b.nationalInsurance).toBeCloseTo(2245.8, money);
  });

  it('reaches the £2,262 Class 4 main-rate maximum at £50,270 and adds 2% above', () => {
    expect(calculateUkTax(input({ income: 50270, kind: 'self-employed' })).nationalInsurance).toBeCloseTo(
      2262,
      money,
    );
    expect(calculateUkTax(input({ income: 60270, kind: 'self-employed' })).nationalInsurance).toBeCloseTo(
      2262 + 200,
      money,
    );
  });

  it('ignores benefits in kind', () => {
    const plain = calculateUkTax(input({ income: 50000, kind: 'self-employed' }));
    const withBik = calculateUkTax(input({ income: 50000, kind: 'self-employed', benefitsInKind: 20000 }));
    expect(withBik).toEqual(plain);
    expect(withBik.grossIncome).toBe(50000);
  });

  it('treats salary sacrifice and net pay as relief at source', () => {
    const ras = calculateUkTax(
      input({ income: 60000, kind: 'self-employed', pensionContribution: 10000, pensionMethod: 'relief-at-source' }),
    );
    for (const pensionMethod of ['salary-sacrifice', 'net-pay'] as const) {
      const b = calculateUkTax(
        input({ income: 60000, kind: 'self-employed', pensionContribution: 10000, pensionMethod }),
      );
      expect(b).toEqual(ras);
    }
    expect(ras.pensionFromPay).toBe(8000);
  });

  it('leaves NI on the full profit whatever the pension', () => {
    const b = calculateUkTax(
      input({ income: 60000, kind: 'self-employed', pensionContribution: 10000, pensionMethod: 'relief-at-source' }),
    );
    expect(b.nationalInsurance).toBeCloseTo(37700 * 0.06 + 9730 * 0.02, money);
  });
});

describe('calculateUkTax: childcare support', () => {
  const kept = (income: number, over: Partial<UkTaxInput> = {}) =>
    calculateUkTax(input({ income, childcareSupport: 20000, ...over }));

  it('keeps it at exactly £100,000 and loses it at £100,001', () => {
    expect(kept(100000).childcareSupportKept).toBe(20000);
    expect(kept(100001).childcareSupportKept).toBe(0);
  });

  it('adds what is kept to take-home to give net with support', () => {
    const b = kept(50000);
    expect(b.netWithSupport).toBeCloseTo(b.takeHome + 20000, money);
    expect(kept(150000).netWithSupport).toBeCloseTo(kept(150000).takeHome, money);
  });

  it('tests adjusted net income, so salary sacrifice keeps it further up the scale', () => {
    const sacrificed = { pensionContribution: 5000, pensionMethod: 'salary-sacrifice' as const };
    expect(kept(105000, sacrificed).childcareSupportKept).toBe(20000);
    expect(kept(105001, sacrificed).childcareSupportKept).toBe(0);
  });
});

describe('calculateUkTax: marriage allowance', () => {
  it('cuts the tax bill by £252 for a basic-rate taxpayer', () => {
    const b = calculateUkTax(input({ income: 30000, marriageAllowance: true }));
    expect(b.marriageAllowanceRelief).toBeCloseTo(252, money);
    expect(b.incomeTax).toBeCloseTo(3234, money);
  });

  it('is not available once any income is taxed above the basic rate', () => {
    const b = calculateUkTax(input({ income: 60000, marriageAllowance: true }));
    expect(b.marriageAllowanceRelief).toBe(0);
    expect(b.incomeTax).toBeCloseTo(calculateUkTax(input({ income: 60000 })).incomeTax, money);
  });

  it('is still available when taxable income is exactly the basic band limit', () => {
    const b = calculateUkTax(input({ income: 50270, marriageAllowance: true }));
    expect(b.marriageAllowanceRelief).toBeCloseTo(252, money);
  });

  it('cannot take the tax bill below zero', () => {
    const b = calculateUkTax(input({ income: 13000, marriageAllowance: true }));
    expect(b.marriageAllowanceRelief).toBeCloseTo(86, money);
    expect(b.incomeTax).toBe(0);
  });

  it('gives nothing to someone who pays no tax', () => {
    const b = calculateUkTax(input({ income: 10000, marriageAllowance: true }));
    expect(b.marriageAllowanceRelief).toBe(0);
    expect(b.incomeTax).toBe(0);
  });

  it('uses the intermediate band as the ceiling in Scotland', () => {
    // Taxable 31,092 is the ceiling; income 43,662 sits exactly on it.
    expect(
      calculateUkTax(input({ income: 43662, region: 'scotland', marriageAllowance: true })).marriageAllowanceRelief,
    ).toBeCloseTo(252, money);
    expect(
      calculateUkTax(input({ income: 43663, region: 'scotland', marriageAllowance: true })).marriageAllowanceRelief,
    ).toBe(0);
  });
});

describe('calculateUkTax: empty, degenerate and hostile input', () => {
  const allZero = (b: UkTaxBreakdown): boolean =>
    Object.entries(b)
      .filter(([k]) => k !== 'aboveTaperStart' && k !== 'aboveChildBenefitStart' && k !== 'personalAllowance')
      .every(([, v]) => v === 0);

  it('returns zeros, a full allowance and no NaN for zero income', () => {
    const b = calculateUkTax(input({ income: 0 }));
    expect(allZero(b)).toBe(true);
    expect(b.personalAllowance).toBe(12570);
    expect(b.effectiveRate).toBe(0);
    expect(Object.values(b).every(Number.isFinite)).toBe(true);
  });

  it('returns a zero effective rate rather than dividing by zero', () => {
    expect(calculateUkTax(input({ income: 0, benefitsInKind: 0 })).effectiveRate).toBe(0);
  });

  it('treats negative and non-finite numbers as zero', () => {
    const hostile = input({
      income: -50000,
      benefitsInKind: Number.NaN,
      pensionContribution: Number.POSITIVE_INFINITY,
      childcareSupport: -1,
      children: Number.NaN,
    });
    const b = calculateUkTax(hostile);
    expect(Object.values(b).every(Number.isFinite)).toBe(true);
    expect(b).toEqual(calculateUkTax(input({ income: 0 })));
  });

  it('treats a non-finite income as zero', () => {
    expect(calculateUkTax(input({ income: Number.NaN })).takeHome).toBe(0);
    expect(calculateUkTax(input({ income: Number.POSITIVE_INFINITY })).takeHome).toBe(0);
  });

  it('does not mistake an inherited object key for a loan plan', () => {
    const b = calculateUkTax({ ...base, income: 50000, undergradPlan: 'constructor' as never });
    expect(b.studentLoan).toBe(0);
  });

  it('copes with a single pound', () => {
    const b = calculateUkTax(input({ income: 1 }));
    expect(b.takeHome).toBe(1);
    expect(b.effectiveRate).toBe(0);
  });
});

describe('ukMarginalRate', () => {
  const rate = (over: Partial<UkTaxInput>) => ukMarginalRate(input(over));

  it('is 28% for a basic-rate employee at £50,000 (20% tax + 8% NI)', () => {
    expect(rate({ income: 50000 })).toBeCloseTo(0.28, 6);
  });

  it('is 62% inside the allowance taper (40% x 1.5 + 2% NI)', () => {
    expect(rate({ income: 110000 })).toBeCloseTo(0.62, 6);
  });

  it('drops back to 47% above the taper (45% + 2% NI)', () => {
    expect(rate({ income: 200000 })).toBeCloseTo(0.47, 6);
  });

  it('adds both loans: 40% + 2% + 9% + 6% at £60,000', () => {
    expect(rate({ income: 60000, undergradPlan: 'plan2', postgradLoan: true })).toBeCloseTo(0.57, 6);
  });

  it('adds the child benefit charge as a steady slope across £60,000-£80,000', () => {
    const cb = 3331.05;
    expect(rate({ income: 70000, children: 3, undergradPlan: 'plan2' })).toBeCloseTo(0.51 + cb / 20000, 6);
    // 40% + 2% + 9% + 3,331.05 / 20,000
    expect(rate({ income: 70000, children: 3, undergradPlan: 'plan2' })).toBeCloseTo(0.6765525, 6);
    expect(rate({ income: 70000, children: 3, undergradPlan: 'plan2', postgradLoan: true })).toBeCloseTo(
      0.7365525,
      6,
    );
  });

  it('shows no HICBC slope before £60,000 or after £80,000', () => {
    expect(rate({ income: 50000, children: 3 })).toBeCloseTo(0.28, 6);
    expect(rate({ income: 90000, children: 3 })).toBeCloseTo(0.42, 6);
  });

  it('matches the Scottish bands', () => {
    expect(rate({ income: 50000, region: 'scotland' })).toBeCloseTo(0.5, 6);
    expect(rate({ income: 110000, region: 'scotland' })).toBeCloseTo(0.695, 6);
    expect(rate({ income: 124700, region: 'scotland', undergradPlan: 'plan2', postgradLoan: true })).toBeCloseTo(
      0.845,
      6,
    );
    // 42% + 2% + 9% + 6% + (116.55 x 53 = 6,177.15) / 20,000
    expect(rate({ income: 70000, region: 'scotland', children: 6, undergradPlan: 'plan2', postgradLoan: true })).toBeCloseTo(
      0.8988575,
      6,
    );
  });

  it('never shows the childcare cliff', () => {
    const i = input({ income: 100000, childcareSupport: 20000 });
    expect(ukMarginalRate(i)).toBeCloseTo(0.62, 6);
    expect(ukMarginalRate({ ...i, childcareSupport: 0 })).toBeCloseTo(ukMarginalRate(i), 12);
  });

  it('holds marriage allowance eligibility at the base income', () => {
    // At £50,270 the allowance is still held and the next pound is the first
    // taxed at 40%, so the rate is 40% + 2% NI. Losing the allowance on that
    // pound would otherwise add £252 and read as a rate of 25,000%.
    const i = input({ income: 50270, marriageAllowance: true });
    expect(ukMarginalRate(i)).toBeCloseTo(0.42, 6);
    expect(ukMarginalRate(i)).toBeCloseTo(ukMarginalRate({ ...i, marriageAllowance: false }), 12);
  });

  it('leaves the slope unchanged by salary sacrifice when both sides stay in the same bands', () => {
    // £75,000 after sacrifice is still above the NI upper limit and in the 40%
    // band, so the next pound is 40% + 2% either way.
    expect(rate({ income: 80000, pensionContribution: 5000, pensionMethod: 'salary-sacrifice' })).toBeCloseTo(0.42, 6);
  });

  it('is a finite rate for zero and hostile input', () => {
    expect(ukMarginalRate(input({ income: 0 }))).toBe(0);
    expect(Number.isFinite(ukMarginalRate(input({ income: Number.NaN })))).toBe(true);
    expect(Number.isFinite(ukMarginalRate(input({ income: -10 })))).toBe(true);
  });

  it('is 0 inside the personal allowance', () => {
    expect(rate({ income: 5000 })).toBe(0);
  });

  it('adds a plan 5 loan above £25,000 to basic-rate tax and NI', () => {
    // 20% tax + 8% NI above £12,570, plus 9% plan 5 above £25,000.
    expect(rate({ income: 30000, undergradPlan: 'plan5' })).toBeCloseTo(0.37, 6);
  });
});

describe('ukTaxCliffs', () => {
  it('returns nothing when there is nothing to lose', () => {
    expect(ukTaxCliffs(input({ income: 50000 }))).toEqual([]);
  });

  it('puts the childcare cliff at £100,000 of adjusted net income', () => {
    expect(ukTaxCliffs(input({ income: 60000, childcareSupport: 20000 }))).toEqual([
      { kind: 'childcare', atIncome: 100000, cost: 20000 },
    ]);
  });

  it('moves the childcare cliff up by a salary-sacrifice or net-pay contribution', () => {
    expect(
      ukTaxCliffs(input({ income: 60000, childcareSupport: 20000, pensionContribution: 5000 }))[0].atIncome,
    ).toBe(105000);
    expect(
      ukTaxCliffs(
        input({ income: 60000, childcareSupport: 20000, pensionContribution: 5000, pensionMethod: 'net-pay' }),
      )[0].atIncome,
    ).toBe(105000);
  });

  it('moves the childcare cliff up by the gross contribution under relief at source', () => {
    expect(
      ukTaxCliffs(
        input({
          income: 60000,
          childcareSupport: 20000,
          pensionContribution: 5000,
          pensionMethod: 'relief-at-source',
        }),
      )[0].atIncome,
    ).toBe(105000);
  });

  it('moves the childcare cliff down by a benefit in kind', () => {
    expect(ukTaxCliffs(input({ income: 60000, childcareSupport: 20000, benefitsInKind: 4000 }))[0].atIncome).toBe(
      96000,
    );
  });

  it('agrees with calculateUkTax about where the childcare support is lost', () => {
    const i = input({ income: 60000, childcareSupport: 20000, pensionContribution: 5000 });
    const [cliff] = ukTaxCliffs(i);
    expect(calculateUkTax({ ...i, income: cliff.atIncome }).childcareSupportKept).toBe(20000);
    expect(calculateUkTax({ ...i, income: cliff.atIncome + 1 }).childcareSupportKept).toBe(0);
  });

  it('puts the marriage allowance cliff at £50,270 in rUK', () => {
    expect(ukTaxCliffs(input({ income: 30000, marriageAllowance: true }))).toEqual([
      { kind: 'marriage-allowance', atIncome: 50270, cost: 252 },
    ]);
  });

  it('agrees with calculateUkTax about where marriage allowance is lost', () => {
    const i = input({ income: 30000, marriageAllowance: true });
    const [cliff] = ukTaxCliffs(i);
    expect(calculateUkTax({ ...i, income: cliff.atIncome }).marriageAllowanceRelief).toBeCloseTo(252, money);
    expect(calculateUkTax({ ...i, income: cliff.atIncome + 1 }).marriageAllowanceRelief).toBe(0);
  });

  it('puts the Scottish marriage allowance cliff at the intermediate band ceiling', () => {
    expect(ukTaxCliffs(input({ income: 30000, region: 'scotland', marriageAllowance: true }))[0].atIncome).toBe(43662);
  });

  it('moves the marriage allowance cliff with the band under relief at source', () => {
    expect(
      ukTaxCliffs(
        input({ income: 30000, marriageAllowance: true, pensionContribution: 2000, pensionMethod: 'relief-at-source' }),
      )[0].atIncome,
    ).toBe(52270);
  });

  it('lists both, in income order', () => {
    const cliffs = ukTaxCliffs(input({ income: 30000, marriageAllowance: true, childcareSupport: 5000 }));
    expect(cliffs.map(c => c.kind)).toEqual(['marriage-allowance', 'childcare']);
    expect(cliffs.map(c => c.atIncome)).toEqual([50270, 100000]);
  });

  it('omits a cliff that falls below zero income', () => {
    // Benefits in kind alone put total income past the cliff before any pay.
    expect(ukTaxCliffs(input({ income: 10000, benefitsInKind: 120000, childcareSupport: 5000 }))).toEqual([]);
    expect(ukTaxCliffs(input({ income: 10000, benefitsInKind: 60000, marriageAllowance: true }))).toEqual([]);
  });

  it('ignores a zero or negative childcare amount', () => {
    expect(ukTaxCliffs(input({ income: 50000, childcareSupport: 0 }))).toEqual([]);
    expect(ukTaxCliffs(input({ income: 50000, childcareSupport: -100 }))).toEqual([]);
  });

  describe('with a contribution larger than the income', () => {
    it('solves the childcare cliff with the whole contribution, not one capped at the current income', () => {
      // £200,000 sacrificed from £5,000 today; the cap stops binding once income
      // reaches £200,000, so adjusted net income hits £100,000 at £300,000.
      const i = input({
        income: 5000,
        pensionContribution: 200000,
        pensionMethod: 'salary-sacrifice',
        childcareSupport: 5000,
      });
      const [cliff] = ukTaxCliffs(i);
      expect(cliff).toEqual({ kind: 'childcare', atIncome: 300000, cost: 5000 });
      expect(calculateUkTax({ ...i, income: cliff.atIncome }).childcareSupportKept).toBe(5000);
      expect(calculateUkTax({ ...i, income: cliff.atIncome + 1 }).childcareSupportKept).toBe(0);
    });

    it('solves the marriage allowance cliff with the whole contribution', () => {
      // £40,000 sacrificed from £30,000 today; taxable income is £37,700 at £90,270.
      const i = input({ income: 30000, marriageAllowance: true, pensionContribution: 40000 });
      const [cliff] = ukTaxCliffs(i);
      expect(cliff).toEqual({ kind: 'marriage-allowance', atIncome: 90270, cost: 252 });
      expect(calculateUkTax({ ...i, income: cliff.atIncome }).marriageAllowanceRelief).toBeCloseTo(252, money);
      expect(calculateUkTax({ ...i, income: cliff.atIncome + 1 }).marriageAllowanceRelief).toBe(0);
    });

    it('does not move with the income it is asked about', () => {
      const i = input({ pensionContribution: 200000, childcareSupport: 5000, marriageAllowance: true });
      const expected = ukTaxCliffs({ ...i, income: 5000 });
      for (const income of [0, 5000, 199999, 200000, 300000, 1_000_000]) {
        expect(ukTaxCliffs({ ...i, income })).toEqual(expected);
      }
    });

    it('omits a cliff that benefits in kind have already passed, whatever the contribution', () => {
      // £120,000 of benefits alone puts adjusted net income past £100,000 at
      // every income, so the solved £30,000 (below the £50,000 contribution)
      // is not a real cliff.
      const i = input({ income: 10000, benefitsInKind: 120000, pensionContribution: 50000, childcareSupport: 5000 });
      expect(ukTaxCliffs(i)).toEqual([]);
      expect(calculateUkTax({ ...i, income: 30000 }).childcareSupportKept).toBe(0);
      expect(
        ukTaxCliffs(
          input({ income: 10000, benefitsInKind: 60000, pensionContribution: 40000, marriageAllowance: true }),
        ),
      ).toEqual([]);
    });

    it('keeps a cliff that benefits in kind land exactly on the contribution', () => {
      // £100,000 of benefits, £50,000 sacrificed: adjusted net income is
      // £100,000 until pay starts, so the last held income is £50,000.
      const i = input({ income: 10000, benefitsInKind: 100000, pensionContribution: 50000, childcareSupport: 5000 });
      const [cliff] = ukTaxCliffs(i);
      expect(cliff.atIncome).toBe(50000);
      expect(calculateUkTax({ ...i, income: 50000 }).childcareSupportKept).toBe(5000);
      expect(calculateUkTax({ ...i, income: 50001 }).childcareSupportKept).toBe(0);
    });
  });

  describe('agrees with calculateUkTax to the pound', () => {
    const cases: Array<[string, Partial<UkTaxInput>]> = [
      ['no pension', { income: 30000 }],
      ['benefit in kind', { income: 30000, benefitsInKind: 4000 }],
      ['salary sacrifice below income', { income: 60000, pensionContribution: 5000 }],
      ['salary sacrifice above income', { income: 5000, pensionContribution: 200000 }],
      ['net pay below income', { income: 60000, pensionContribution: 5000, pensionMethod: 'net-pay' }],
      ['net pay above income', { income: 10000, pensionContribution: 15000, pensionMethod: 'net-pay' }],
      ['relief at source below income', { income: 60000, pensionContribution: 5000, pensionMethod: 'relief-at-source' }],
      ['relief at source above income', { income: 20000, pensionContribution: 30000, pensionMethod: 'relief-at-source' }],
      [
        'Scotland, sacrifice above income, with a benefit in kind',
        { income: 10000, region: 'scotland', pensionContribution: 50000, benefitsInKind: 5000 },
      ],
      [
        'Scotland, relief at source above income',
        { income: 10000, region: 'scotland', pensionContribution: 50000, pensionMethod: 'relief-at-source' },
      ],
      ['self-employed, contribution above profit', { income: 5000, kind: 'self-employed', pensionContribution: 200000 }],
    ];

    it.each(cases)('flips exactly between atIncome and atIncome + 1: %s', (_name, over) => {
      const i = input({ ...over, childcareSupport: 5000, marriageAllowance: true });
      const cliffs = ukTaxCliffs(i);
      expect(cliffs.map(c => c.kind).sort()).toEqual(['childcare', 'marriage-allowance']);
      for (const cliff of cliffs) {
        const held = (income: number): boolean => {
          const b = calculateUkTax({ ...i, income });
          return cliff.kind === 'childcare' ? b.childcareSupportKept > 0 : b.marriageAllowanceRelief > 0;
        };
        expect(held(cliff.atIncome)).toBe(true);
        expect(held(cliff.atIncome + 1)).toBe(false);
      }
    });
  });
});

describe('ukChildBenefitBand', () => {
  const kids = (over: Partial<UkTaxInput>): UkTaxInput => input({ children: 2, ...over });

  const cases: Array<[string, Partial<UkTaxInput>, UkIncomeBand]> = [
    ['plain employed', {}, { from: 60_000, to: 80_000 }],
    [
      'salary sacrifice of £10,000',
      { pensionContribution: 10_000, pensionMethod: 'salary-sacrifice' },
      { from: 70_000, to: 90_000 },
    ],
    [
      'relief at source of £10,000',
      { pensionContribution: 10_000, pensionMethod: 'relief-at-source' },
      { from: 70_000, to: 90_000 },
    ],
    [
      'net pay of £10,000',
      { pensionContribution: 10_000, pensionMethod: 'net-pay' },
      { from: 70_000, to: 90_000 },
    ],
    ['benefits in kind of £15,000', { benefitsInKind: 15_000 }, { from: 45_000, to: 65_000 }],
    ['benefits in kind of £70,000, already past the start', { benefitsInKind: 70_000 }, { from: 0, to: 10_000 }],
    [
      'benefits in kind of £15,000 and salary sacrifice of £10,000',
      { benefitsInKind: 15_000, pensionContribution: 10_000 },
      { from: 55_000, to: 75_000 },
    ],
    [
      'Scotland, which has no bearing on adjusted net income',
      { region: 'scotland', pensionContribution: 10_000 },
      { from: 70_000, to: 90_000 },
    ],
    [
      'self-employed, relief at source of £10,000',
      { kind: 'self-employed', pensionContribution: 10_000 },
      { from: 70_000, to: 90_000 },
    ],
  ];

  it.each(cases)('finds the band for %s', (_name, over, expected) => {
    expect(ukChildBenefitBand(kids(over))).toEqual(expected);
  });

  it('is null with no children', () => {
    expect(ukChildBenefitBand(input({ children: 0 }))).toBeNull();
    expect(ukChildBenefitBand(input({ children: 0, pensionContribution: 10_000, benefitsInKind: 15_000 }))).toBeNull();
  });

  it('is null when the children count sanitises to none', () => {
    // A non-finite count is treated as none, as everywhere else in the module.
    for (const children of [-3, 0.9, Number.NaN, Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY]) {
      expect(ukChildBenefitBand(input({ children }))).toBeNull();
    }
  });

  it('is the same band for one child as for many, however large the count', () => {
    for (const children of [1, 2.9, 20, 500]) {
      expect(ukChildBenefitBand(input({ children }))).toEqual({ from: 60_000, to: 80_000 });
    }
  });

  it('is null when benefits in kind alone reach £80,000: the charge is total at every income', () => {
    expect(ukChildBenefitBand(kids({ benefitsInKind: 90_000 }))).toBeNull();
    expect(ukChildBenefitBand(kids({ benefitsInKind: 80_000 }))).toBeNull();
    // Whatever the pension: the contribution cannot bring adjusted net income
    // below the benefits while income is under it, so the band is still empty.
    expect(ukChildBenefitBand(kids({ benefitsInKind: 90_000, pensionContribution: 50_000 }))).toBeNull();
    const atZero = calculateUkTax(kids({ income: 0, benefitsInKind: 90_000 }));
    expect(atZero.childBenefitCharge).toBeCloseTo(atZero.childBenefit, money);
  });

  it('starts the band at 0 where benefits alone sit between the start and the end', () => {
    const band = ukChildBenefitBand(kids({ benefitsInKind: 60_000 }));
    expect(band).toEqual({ from: 0, to: 20_000 });
    expect(ukChildBenefitBand(kids({ benefitsInKind: 79_999 }))).toEqual({ from: 0, to: 1 });
  });

  it('ignores benefits in kind for the self-employed, as the calculation does', () => {
    expect(ukChildBenefitBand(kids({ kind: 'self-employed', benefitsInKind: 90_000 }))).toEqual({
      from: 60_000,
      to: 80_000,
    });
  });

  it('treats a negative or non-finite pension contribution or benefit as nil', () => {
    for (const bad of [-5000, Number.NaN, Number.NEGATIVE_INFINITY]) {
      expect(ukChildBenefitBand(kids({ pensionContribution: bad, benefitsInKind: bad }))).toEqual({
        from: 60_000,
        to: 80_000,
      });
    }
  });

  it('takes the contribution in full: the review probe of £5,000 income and £10,000 sacrificed', () => {
    // The cap at £5,000 would put the band at 65,000 / 85,000. At the incomes
    // where the band sits the cap no longer binds, so it is 70,000 / 90,000.
    const probe = kids({ income: 5_000, pensionContribution: 10_000, pensionMethod: 'salary-sacrifice' });
    expect(ukChildBenefitBand(probe)).toEqual({ from: 70_000, to: 90_000 });
    expect(calculateUkTax({ ...probe, income: 70_000 }).adjustedNetIncome).toBe(60_000);
    expect(calculateUkTax({ ...probe, income: 90_000 }).adjustedNetIncome).toBe(80_000);
    expect(calculateUkTax({ ...probe, income: 65_000 }).adjustedNetIncome).toBe(55_000);
  });

  it('does not move with the income it is asked about', () => {
    for (const method of ['salary-sacrifice', 'net-pay', 'relief-at-source'] as const) {
      const i = kids({ pensionContribution: 10_000, pensionMethod: method, benefitsInKind: 3_000 });
      const expected = ukChildBenefitBand({ ...i, income: 5_000 });
      expect(expected).toEqual({ from: 67_000, to: 87_000 });
      for (const income of [0, 5_000, 9_999, 10_000, 67_000, 1_000_000, -1, Number.NaN]) {
        expect(ukChildBenefitBand({ ...i, income })).toEqual(expected);
      }
    }
  });

  it('does not change its answer when asked twice, nor alter its input', () => {
    const i = kids({ pensionContribution: 10_000 });
    const before = { ...i };
    expect(ukChildBenefitBand(i)).toEqual(ukChildBenefitBand(i));
    expect(i).toEqual(before);
  });

  describe('agrees with calculateUkTax to the pound', () => {
    // Cases chosen with whole-pound figures, where the adjusted net income is
    // exact. `income` is deliberately below the contribution in several, since
    // the band must not depend on it.
    const agreeing: Array<[string, Partial<UkTaxInput>]> = [
      ['plain employed', { income: 40_000 }],
      ['salary sacrifice', { income: 5_000, pensionContribution: 10_000, pensionMethod: 'salary-sacrifice' }],
      ['relief at source', { income: 5_000, pensionContribution: 10_000, pensionMethod: 'relief-at-source' }],
      ['net pay', { income: 5_000, pensionContribution: 10_000, pensionMethod: 'net-pay' }],
      ['benefits in kind', { income: 30_000, benefitsInKind: 15_000 }],
      ['benefits in kind past the start', { income: 30_000, benefitsInKind: 70_000 }],
      ['benefits in kind and a pension', { income: 2_000, benefitsInKind: 15_000, pensionContribution: 120_000 }],
      ['Scotland', { income: 30_000, region: 'scotland', pensionContribution: 12_345 }],
      ['self-employed', { income: 1_000, kind: 'self-employed', pensionContribution: 25_000 }],
    ];

    it.each(agreeing)('reproduces the thresholds at the ends of the band: %s', (_name, over) => {
      const i = kids(over);
      const band = ukChildBenefitBand(i);
      expect(band).not.toBeNull();
      if (!band) return;

      const at = (income: number) => calculateUkTax({ ...i, income });

      // The far end always lands on the full charge.
      expect(at(band.to).adjustedNetIncome).toBe(UK_CHILD_BENEFIT_CHARGE_END);
      expect(at(band.to).childBenefitCharge).toBeCloseTo(at(band.to).childBenefit, money);
      expect(at(band.to - 1).childBenefitCharge).toBeLessThan(at(band.to).childBenefit);

      if (band.from > 0) {
        // The near end is where adjusted net income is last short of a charge.
        expect(at(band.from).adjustedNetIncome).toBe(UK_CHILD_BENEFIT_CHARGE_START);
        expect(at(band.from).childBenefitCharge).toBe(0);
        expect(at(band.from + UK_CHILD_BENEFIT_CHARGE_STEP).childBenefitCharge).toBeGreaterThan(0);
        expect(at(band.from - 1).adjustedNetIncome).toBe(UK_CHILD_BENEFIT_CHARGE_START - 1);
      } else {
        // Benefits in kind alone are at or past the start at every income.
        expect(at(0).adjustedNetIncome).toBeGreaterThanOrEqual(UK_CHILD_BENEFIT_CHARGE_START);
      }
    });

    it('spans exactly the incomes where the curve carries the charge as marginal rate', () => {
      const i = kids({ pensionContribution: 10_000, pensionMethod: 'salary-sacrifice' });
      const band = ukChildBenefitBand(i);
      if (!band) throw new Error('expected a band');
      expect(band).toEqual({ from: 70_000, to: 90_000 });

      // Children change nothing but the charge, so the difference in marginal
      // rate with and without them is the charge's own slope.
      const slopeAt = (income: number): number =>
        ukMarginalRate({ ...i, income }) - ukMarginalRate({ ...i, income, children: 0 });
      const wholeSlope = calculateUkTax({ ...i, income: band.to }).childBenefit / (band.to - band.from);

      for (const income of [band.from, 75_000, 80_000, band.to - 1]) {
        expect(slopeAt(income)).toBeCloseTo(wholeSlope, money);
      }
      for (const income of [0, 40_000, band.from - 1, band.to, 100_000, 150_000]) {
        expect(slopeAt(income)).toBeCloseTo(0, money);
      }
    });
  });
});

describe('ukTaxCurve', () => {
  it('returns multiples of the step from zero up to the maximum inclusive', () => {
    const curve = ukTaxCurve(input({}), { maxIncome: 1000, step: 250 });
    expect(curve.map(p => p.income)).toEqual([0, 250, 500, 750, 1000]);
  });

  it('stops at the last multiple not past the maximum', () => {
    const curve = ukTaxCurve(input({}), { maxIncome: 1100, step: 250 });
    expect(curve.map(p => p.income)).toEqual([0, 250, 500, 750, 1000]);
  });

  it('returns just the origin when the maximum is zero', () => {
    expect(ukTaxCurve(input({}), { maxIncome: 0, step: 100 }).map(p => p.income)).toEqual([0]);
  });

  it('returns nothing for a zero, negative or non-finite step', () => {
    expect(ukTaxCurve(input({}), { maxIncome: 1000, step: 0 })).toEqual([]);
    expect(ukTaxCurve(input({}), { maxIncome: 1000, step: -5 })).toEqual([]);
    expect(ukTaxCurve(input({}), { maxIncome: 1000, step: Number.NaN })).toEqual([]);
  });

  it('returns nothing for a negative or non-finite maximum', () => {
    expect(ukTaxCurve(input({}), { maxIncome: -1, step: 100 })).toEqual([]);
    expect(ukTaxCurve(input({}), { maxIncome: Number.POSITIVE_INFINITY, step: 100 })).toEqual([]);
  });

  it('caps the number of points at 2,000', () => {
    const curve = ukTaxCurve(input({}), { maxIncome: 1_000_000, step: 1 });
    expect(curve).toHaveLength(2000);
    expect(curve[1999].income).toBe(1999);
  });

  it('does not lose the last point to floating-point division', () => {
    const curve = ukTaxCurve(input({}), { maxIncome: 0.3, step: 0.1 });
    expect(curve).toHaveLength(4);
  });

  it('takes each point from calculateUkTax and ukMarginalRate with only income replaced', () => {
    const i = input({ region: 'scotland', undergradPlan: 'plan2', children: 2, childcareSupport: 8000 });
    const curve = ukTaxCurve(i, { maxIncome: 120000, step: 20000 });
    expect(curve.map(p => p.income)).toEqual([0, 20000, 40000, 60000, 80000, 100000, 120000]);
    for (const p of curve) {
      const at = { ...i, income: p.income };
      expect(p.takeHome).toBe(calculateUkTax(at).takeHome);
      expect(p.netWithSupport).toBe(calculateUkTax(at).netWithSupport);
      expect(p.marginalRate).toBe(ukMarginalRate(at));
    }
  });

  it('shows the childcare cliff in net-with-support but not in take-home', () => {
    const i = input({ childcareSupport: 20000 });
    const [, at100k, past] = ukTaxCurve(i, { maxIncome: 200000, step: 100000 });
    expect(at100k.income).toBe(100000);
    expect(past.income).toBe(200000);
    expect(at100k.netWithSupport - at100k.takeHome).toBe(20000);
    expect(past.netWithSupport - past.takeHome).toBe(0);
  });

  it('leaves zero income at zero everything with a zero marginal rate', () => {
    const [origin] = ukTaxCurve(input({}), { maxIncome: 1000, step: 250 });
    expect(origin).toEqual({ income: 0, takeHome: 0, netWithSupport: 0, marginalRate: 0 });
  });
});

describe('UK_STATUTORY_PERSONAL_ALLOWANCE', () => {
  it('is the standard 1257L allowance, which is what an omitted allowance means', () => {
    expect(UK_STATUTORY_PERSONAL_ALLOWANCE).toBe(12_570);
    const omitted = calculateUkTax(input({ income: 30000 }));
    expect(omitted.personalAllowance).toBe(UK_STATUTORY_PERSONAL_ALLOWANCE);
    expect(calculateUkTax(input({ income: 30000, personalAllowance: UK_STATUTORY_PERSONAL_ALLOWANCE }))).toEqual(
      omitted,
    );
  });
});

describe('ukBasePersonalAllowance', () => {
  it('passes a stated allowance through, zero included', () => {
    expect(ukBasePersonalAllowance(11070)).toBe(11070);
    expect(ukBasePersonalAllowance(0)).toBe(0);
    expect(ukBasePersonalAllowance(15000)).toBe(15000);
  });

  it('falls back to the statutory allowance when omitted, negative or not a finite number', () => {
    expect(ukBasePersonalAllowance(undefined)).toBe(12570);
    expect(ukBasePersonalAllowance(-1)).toBe(12570);
    expect(ukBasePersonalAllowance(Number.NaN)).toBe(12570);
    expect(ukBasePersonalAllowance(Number.POSITIVE_INFINITY)).toBe(12570);
    expect(ukBasePersonalAllowance('11070' as never)).toBe(12570);
  });
});

describe('calculateUkTax: a stated personal allowance', () => {
  it('taxes from a lower allowance such as 1107L', () => {
    const b = calculateUkTax(input({ income: 30000, personalAllowance: 11070 }));
    expect(b.personalAllowance).toBe(11070);
    expect(b.taxableIncome).toBe(18930);
    expect(b.incomeTax).toBeCloseTo(3786, money);
    // NI has its own statutory threshold; the tax code does not move it.
    expect(b.nationalInsurance).toBeCloseTo((30000 - 12570) * 0.08, money);
  });

  it('allows an allowance of zero: every pound is taxable, NI and loans unchanged', () => {
    const b = calculateUkTax(input({ income: 30000, personalAllowance: 0, undergradPlan: 'plan2' }));
    expect(b.personalAllowance).toBe(0);
    expect(b.taxableIncome).toBe(30000);
    expect(b.incomeTax).toBeCloseTo(6000, money);
    expect(b.nationalInsurance).toBeCloseTo(1394.4, money);
    expect(b.studentLoan).toBeCloseTo((30000 - 29385) * 0.09, money);
    expect(b.takeHome).toBeCloseTo(30000 - 6000 - 1394.4 - b.studentLoan, money);
  });

  it('takes a higher allowance too', () => {
    const b = calculateUkTax(input({ income: 30000, personalAllowance: 15000 }));
    expect(b.taxableIncome).toBe(15000);
    expect(b.incomeTax).toBeCloseTo(3000, money);
  });

  it('treats a negative or non-finite allowance as the statutory one, not as zero', () => {
    const statutory = calculateUkTax(input({ income: 30000 }));
    for (const personalAllowance of [-1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(calculateUkTax(input({ income: 30000, personalAllowance }))).toEqual(statutory);
    }
  });

  it('still tapers £1 per £2 above £100,000, from the stated allowance', () => {
    // 11,070 - (110,000 - 100,000) / 2
    const b = calculateUkTax(input({ income: 110000, personalAllowance: 11070 }));
    expect(b.personalAllowance).toBe(6070);
    expect(b.taxableIncome).toBe(103930);
    expect(b.incomeTax).toBeCloseTo(7540 + 66230 * 0.4, money);
  });

  it('has none left once the taper has used the stated allowance up', () => {
    expect(calculateUkTax(input({ income: 122140, personalAllowance: 11070 })).personalAllowance).toBe(0);
    expect(calculateUkTax(input({ income: 130000, personalAllowance: 11070 })).personalAllowance).toBe(0);
  });

  it('floors the reduction in the exact calculation, as for the statutory allowance', () => {
    expect(calculateUkTax(input({ income: 100003, personalAllowance: 11070 })).personalAllowance).toBe(11069);
  });

  it('has nothing to taper with a zero allowance, so no 60% trap', () => {
    const b = calculateUkTax(input({ income: 110000, personalAllowance: 0 }));
    expect(b.personalAllowance).toBe(0);
    expect(b.incomeTax).toBeCloseTo(7540 + 72300 * 0.4, money);
    expect(calculateUkTax(input({ income: 200000, personalAllowance: 0 })).personalAllowance).toBe(0);
  });

  it('applies to the Scottish bands and to relief at source', () => {
    const scot = calculateUkTax(input({ income: 50000, region: 'scotland', personalAllowance: 0 }));
    expect(scot.taxableIncome).toBe(50000);
    expect(scot.incomeTax).toBeCloseTo(
      3967 * 0.19 + (16956 - 3967) * 0.2 + (31092 - 16956) * 0.21 + (50000 - 31092) * 0.42,
      money,
    );
    // Relief at source extends the 20% band onward by the gross contribution.
    const ras = calculateUkTax(
      input({ income: 50000, personalAllowance: 11070, pensionContribution: 5000, pensionMethod: 'relief-at-source' }),
    );
    expect(ras.taxableIncome).toBe(38930);
    expect(ras.incomeTax).toBeCloseTo(38930 * 0.2, money);
  });

  it('does not alter the input it is given', () => {
    const i = input({ income: 110000, personalAllowance: 11070 });
    const copy = { ...i };
    calculateUkTax(i);
    ukMarginalRate(i);
    ukTaxCliffs(i);
    expect(i).toEqual(copy);
  });
});

describe('a stated personal allowance: marginal rate, cliffs, bands and curve', () => {
  it('moves where the 60% taper trap ends: 62% inside it, 42% once the allowance is gone', () => {
    const at = (income: number) => ukMarginalRate(input({ income, personalAllowance: 11070 }));
    expect(at(121000)).toBeCloseTo(0.62, money);
    expect(at(123000)).toBeCloseTo(0.42, money);
  });

  it('has no taper trap with a zero allowance', () => {
    expect(ukMarginalRate(input({ income: 110000, personalAllowance: 0 }))).toBeCloseTo(0.42, money);
  });

  it('starts taxing at the first pound with a zero allowance', () => {
    expect(ukMarginalRate(input({ income: 10000, personalAllowance: 0 }))).toBeCloseTo(0.2, money);
    expect(ukMarginalRate(input({ income: 10000 }))).toBe(0);
  });

  it('puts the marriage allowance cliff at the band ceiling plus the stated allowance', () => {
    const i = input({ income: 30000, marriageAllowance: true, personalAllowance: 11070 });
    const [cliff] = ukTaxCliffs(i);
    expect(cliff).toEqual({ kind: 'marriage-allowance', atIncome: 48770, cost: 252 });
    expect(calculateUkTax({ ...i, income: cliff.atIncome }).marriageAllowanceRelief).toBeCloseTo(252, money);
    expect(calculateUkTax({ ...i, income: cliff.atIncome + 1 }).marriageAllowanceRelief).toBe(0);
  });

  it('puts the marriage allowance cliff at the band ceiling with a zero allowance', () => {
    const i = input({ income: 20000, marriageAllowance: true, personalAllowance: 0 });
    const [cliff] = ukTaxCliffs(i);
    expect(cliff.atIncome).toBe(37700);
    expect(calculateUkTax({ ...i, income: 37700 }).marriageAllowanceRelief).toBeCloseTo(252, money);
    expect(calculateUkTax({ ...i, income: 37701 }).marriageAllowanceRelief).toBe(0);
  });

  it('follows the stated allowance in Scotland and under relief at source', () => {
    const scot = input({ income: 20000, region: 'scotland', marriageAllowance: true, personalAllowance: 11070 });
    expect(ukTaxCliffs(scot)[0].atIncome).toBe(31092 + 11070);
    expect(calculateUkTax({ ...scot, income: 31092 + 11070 }).marriageAllowanceRelief).toBeCloseTo(252, money);
    expect(calculateUkTax({ ...scot, income: 31092 + 11070 + 1 }).marriageAllowanceRelief).toBe(0);

    const ras = input({
      income: 30000,
      marriageAllowance: true,
      personalAllowance: 11070,
      pensionContribution: 2000,
      pensionMethod: 'relief-at-source',
    });
    expect(ukTaxCliffs(ras)[0].atIncome).toBe(37700 + 2000 + 11070);
  });

  it('leaves the childcare cliff and the child benefit band to adjusted net income, not the allowance', () => {
    const withAllowance = input({ income: 50000, childcareSupport: 5000, children: 2, personalAllowance: 0 });
    const without = input({ income: 50000, childcareSupport: 5000, children: 2 });
    expect(ukTaxCliffs(withAllowance)).toEqual(ukTaxCliffs(without));
    expect(ukChildBenefitBand(withAllowance)).toEqual(ukChildBenefitBand(without));
  });

  it('carries the allowance through every point of the curve', () => {
    const i = input({ personalAllowance: 0 });
    const curve = ukTaxCurve(i, { maxIncome: 120000, step: 40000 });
    for (const p of curve) {
      const at = { ...i, income: p.income };
      expect(p.takeHome).toBe(calculateUkTax(at).takeHome);
      expect(p.marginalRate).toBe(ukMarginalRate(at));
    }
    expect(curve[1].takeHome).toBeLessThan(calculateUkTax({ ...i, personalAllowance: undefined, income: 40000 }).takeHome);
  });
});

describe('ukBenefitInKindTax', () => {
  it('taxes a benefit at the rate it lands in: £1,000 at £50,000 straddles the basic band', () => {
    // 270 of headroom at 20%, 730 at 40%.
    expect(ukBenefitInKindTax(input({ income: 50000 }), 1000)).toBeCloseTo(270 * 0.2 + 730 * 0.4, money);
  });

  it('is 20% of the value for a basic-rate employee well inside the band', () => {
    expect(ukBenefitInKindTax(input({ income: 30000 }), 2000)).toBeCloseTo(400, money);
  });

  it('is the difference of calculateUkTax with and without the benefit', () => {
    const i = input({ income: 62000, undergradPlan: 'plan2', pensionContribution: 3000, pensionMethod: 'net-pay' });
    expect(ukBenefitInKindTax(i, 4500)).toBeCloseTo(
      calculateUkTax({ ...i, benefitsInKind: 4500 }).incomeTax - calculateUkTax(i).incomeTax,
      money,
    );
  });

  it('uses the Scottish bands', () => {
    // £30,000 sits in the 21% band, which has room for £2,000 more.
    expect(ukBenefitInKindTax(input({ income: 30000, region: 'scotland' }), 2000)).toBeCloseTo(420, money);
  });

  it('costs 60% inside the allowance taper, because the benefit also removes allowance', () => {
    expect(ukBenefitInKindTax(input({ income: 110000 }), 1000)).toBeCloseTo(600, money);
  });

  it('has nothing to pay while the benefit stays inside the allowance', () => {
    expect(ukBenefitInKindTax(input({ income: 10000 }), 1000)).toBe(0);
    // £12,000 + £2,000 = £14,000: only £1,430 is over the allowance.
    expect(ukBenefitInKindTax(input({ income: 12000 }), 2000)).toBeCloseTo(1430 * 0.2, money);
  });

  it('keeps benefits already on the input and adds the new value on top', () => {
    // 40,000 total income -> 51,000: crosses the basic band limit.
    const taxed = ukBenefitInKindTax(input({ income: 30000, benefitsInKind: 10000 }), 11000);
    expect(taxed).toBeCloseTo(2346, money);
    expect(taxed).not.toBeCloseTo(ukBenefitInKindTax(input({ income: 30000 }), 11000), 1);
  });

  it('reads the stated personal allowance', () => {
    expect(ukBenefitInKindTax(input({ income: 37000, personalAllowance: 0 }), 1000)).toBeCloseTo(700 * 0.2 + 300 * 0.4, money);
  });

  it('sits inside the extended basic band under relief at source', () => {
    const ras = input({ income: 50000, pensionContribution: 5000, pensionMethod: 'relief-at-source' });
    expect(ukBenefitInKindTax(ras, 3000)).toBeCloseTo(600, money);
    expect(ukBenefitInKindTax(input({ income: 50000 }), 3000)).toBeCloseTo(270 * 0.2 + 2730 * 0.4, money);
  });

  it('is 0 for a zero, negative or non-finite value', () => {
    for (const value of [0, -500, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(ukBenefitInKindTax(input({ income: 50000 }), value)).toBe(0);
    }
  });

  it('is 0 for the self-employed, who have no benefits in kind', () => {
    expect(ukBenefitInKindTax(input({ income: 50000, kind: 'self-employed' }), 1000)).toBe(0);
  });

  it('is 0 for zero income and finite for hostile income', () => {
    expect(ukBenefitInKindTax(input({ income: 0 }), 1000)).toBe(0);
    expect(Number.isFinite(ukBenefitInKindTax(input({ income: Number.NaN }), 1000))).toBe(true);
  });

  it('does not alter its input', () => {
    const i = input({ income: 50000, benefitsInKind: 200 });
    const copy = { ...i };
    ukBenefitInKindTax(i, 1000);
    expect(i).toEqual(copy);
  });
});

describe('ukCashAfterTax', () => {
  it('works a £5,000 bonus at £50,000: 270 at 20% and 4,730 at 40%, NI 270 at 8% and 4,730 at 2%', () => {
    const r = ukCashAfterTax(input({ income: 50000 }), 5000);
    expect(r.gross).toBe(5000);
    expect(r.incomeTax).toBeCloseTo(270 * 0.2 + 4730 * 0.4, money);
    expect(r.incomeTax).toBeCloseTo(1946, money);
    expect(r.nationalInsurance).toBeCloseTo(270 * 0.08 + 4730 * 0.02, money);
    expect(r.nationalInsurance).toBeCloseTo(116.2, money);
    expect(r.studentLoan).toBe(0);
    expect(r.net).toBeCloseTo(5000 - 1946 - 116.2, money);
    expect(r.net).toBeCloseTo(2937.8, money);
  });

  it('keeps 38% of a bonus inside the allowance taper: 60% tax and 2% NI', () => {
    const small = ukCashAfterTax(input({ income: 110000 }), 1000);
    expect(small.incomeTax).toBeCloseTo(600, money);
    expect(small.nationalInsurance).toBeCloseTo(20, money);
    expect(small.net).toBeCloseTo(380, money);
    const large = ukCashAfterTax(input({ income: 110000 }), 5000);
    expect(large.incomeTax).toBeCloseTo(3000, money);
    expect(large.nationalInsurance).toBeCloseTo(100, money);
    expect(large.net).toBeCloseTo(1900, money);
  });

  it('uses the Scottish bands: all of a £5,000 bonus at £50,000 is in the 42% band', () => {
    const r = ukCashAfterTax(input({ income: 50000, region: 'scotland' }), 5000);
    expect(r.incomeTax).toBeCloseTo(2100, money);
    expect(r.nationalInsurance).toBeCloseTo(116.2, money);
    expect(r.net).toBeCloseTo(2783.8, money);
  });

  it('adds undergraduate and postgraduate loans together', () => {
    const r = ukCashAfterTax(input({ income: 50000, undergradPlan: 'plan2', postgradLoan: true }), 5000);
    expect(r.studentLoan).toBeCloseTo(5000 * 0.09 + 5000 * 0.06, money);
    expect(r.net).toBeCloseTo(5000 - 1946 - 116.2 - 750, money);
  });

  it('charges a loan only on the part of the bonus above the threshold', () => {
    // £28,000 is under the plan 2 threshold of £29,385; £33,000 is over it by £3,615.
    const r = ukCashAfterTax(input({ income: 28000, undergradPlan: 'plan2' }), 5000);
    expect(r.studentLoan).toBeCloseTo(3615 * 0.09, money);
  });

  it('charges the part inside the allowance nothing', () => {
    // £10,000 + £5,000: £2,430 is over the allowance and the NI threshold.
    const r = ukCashAfterTax(input({ income: 10000 }), 5000);
    expect(r.incomeTax).toBeCloseTo(2430 * 0.2, money);
    expect(r.nationalInsurance).toBeCloseTo(2430 * 0.08, money);
    expect(r.net).toBeCloseTo(5000 - 486 - 194.4, money);
  });

  it('holds the pension contribution in pounds: the bonus is not itself pensioned', () => {
    const r = ukCashAfterTax(input({ income: 50000, pensionContribution: 5000, pensionMethod: 'salary-sacrifice' }), 5000);
    // Pay goes £45,000 -> £50,000: all 20% (taxable ends at 37,430) and 8% NI.
    expect(r.incomeTax).toBeCloseTo(1000, money);
    expect(r.nationalInsurance).toBeCloseTo(400, money);
    expect(r.net).toBeCloseTo(3600, money);
  });

  it('does not re-cap the contribution at the larger income', () => {
    // £8,000 sacrificed from £5,000 is clamped to £5,000 today; it stays £5,000 with the bonus,
    // so pay goes £0 -> £20,000 (not £17,000, which re-capping at £25,000 would give).
    const r = ukCashAfterTax(input({ income: 5000, pensionContribution: 8000, pensionMethod: 'salary-sacrifice' }), 20000);
    expect(r.incomeTax).toBeCloseTo(7430 * 0.2, money);
    expect(r.nationalInsurance).toBeCloseTo(7430 * 0.08, money);
  });

  it('sits inside the extended basic band under relief at source', () => {
    const r = ukCashAfterTax(input({ income: 50000, pensionContribution: 5000, pensionMethod: 'relief-at-source' }), 5000);
    expect(r.incomeTax).toBeCloseTo(1000, money);
  });

  it('reads the stated personal allowance', () => {
    // Allowance 11,070: taxable 38,930 -> 43,930, all above the 37,700 basic limit.
    const r = ukCashAfterTax(input({ income: 50000, personalAllowance: 11070 }), 5000);
    expect(r.incomeTax).toBeCloseTo(2000, money);
  });

  it('includes a lost marriage allowance in the tax, as the exact calculation does', () => {
    // Taxable 35,430 -> 40,430 crosses 37,700: the £252 relief goes too.
    const i = input({ income: 48000, marriageAllowance: true });
    const r = ukCashAfterTax(i, 5000);
    expect(r.incomeTax).toBeCloseTo(7540 + 2730 * 0.4 - (35430 * 0.2 - 252), money);
    expect(r.incomeTax).toBeCloseTo(1798, money);
  });

  it('is the difference of calculateUkTax with and without the cash', () => {
    const i = input({ income: 71000, region: 'scotland', undergradPlan: 'plan1', postgradLoan: true });
    const before = calculateUkTax(i);
    const after = calculateUkTax({ ...i, income: 71000 + 7500 });
    const r = ukCashAfterTax(i, 7500);
    expect(r.incomeTax).toBeCloseTo(after.incomeTax - before.incomeTax, money);
    expect(r.nationalInsurance).toBeCloseTo(after.nationalInsurance - before.nationalInsurance, money);
    expect(r.studentLoan).toBeCloseTo(
      after.studentLoan + after.postgradLoan - before.studentLoan - before.postgradLoan,
      money,
    );
    expect(r.net).toBeCloseTo(after.takeHome - before.takeHome, money);
  });

  it('charges Class 4 on a self-employed payment: 270 at 6% and 4,730 at 2%', () => {
    const r = ukCashAfterTax(input({ income: 50000, kind: 'self-employed' }), 5000);
    expect(r.nationalInsurance).toBeCloseTo(270 * 0.06 + 4730 * 0.02, money);
    expect(r.incomeTax).toBeCloseTo(1946, money);
  });

  it('is all zeros for no cash, and a negative or non-finite amount reads as none', () => {
    const none = { gross: 0, incomeTax: 0, nationalInsurance: 0, studentLoan: 0, net: 0 };
    for (const cash of [0, -1000, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(ukCashAfterTax(input({ income: 50000, undergradPlan: 'plan2' }), cash)).toEqual(none);
    }
  });

  it('works from zero income and never returns NaN', () => {
    const r = ukCashAfterTax(input({ income: 0 }), 20000);
    expect(r.incomeTax).toBeCloseTo((20000 - 12570) * 0.2, money);
    expect(Object.values(r).every(Number.isFinite)).toBe(true);
    expect(Object.values(ukCashAfterTax(input({ income: Number.NaN }), 1000)).every(Number.isFinite)).toBe(true);
  });

  it('does not alter its input', () => {
    const i = input({ income: 50000, pensionContribution: 2000 });
    const copy = { ...i };
    ukCashAfterTax(i, 5000);
    expect(i).toEqual(copy);
  });
});

type SliceField = 'incomeTax' | 'nationalInsurance' | 'studentLoan' | 'childBenefitCharge';

const SLICE_FIELDS: readonly SliceField[] = ['incomeTax', 'nationalInsurance', 'studentLoan', 'childBenefitCharge'];

/** Where each slice starts, then where the last one ends. */
const sliceEdges = (slices: UkPaySlice[]): number[] =>
  slices.length === 0 ? [] : [...slices.map(s => s.from), slices[slices.length - 1].to];

/** The share of a slice's width that one of its deductions (or all four) takes. */
const sliceRate = (s: UkPaySlice, field: SliceField | 'taken'): number => s[field] / (s.to - s.from);

/** The slices of `base` with these fields changed. */
const slicesOf = (over: Partial<UkTaxInput>): UkPaySlice[] => ukPaySlices(input(over));

const sumSlices = (slices: UkPaySlice[]): Record<SliceField, number> => {
  const total = { incomeTax: 0, nationalInsurance: 0, studentLoan: 0, childBenefitCharge: 0 };
  for (const s of slices) for (const f of SLICE_FIELDS) total[f] += s[f];
  return total;
};

const KIND_ORDER = { salary: 0, pension: 1, 'benefits-in-kind': 2 } as const;

/**
 * Everything that must hold of the slices of any one input, as a list of what
 * went wrong (empty when nothing did): well formed, in order, reconciled with
 * `calculateUkTax`, and the pension and benefits slices where they should be.
 * A list rather than an `expect` per check so a grid of thousands stays fast and
 * names the input that failed.
 */
const sliceProblems = (i: UkTaxInput): string[] => {
  const problems: string[] = [];
  const fail = (what: string): number => problems.push(`${what} for ${JSON.stringify(i)}`);
  const slices = ukPaySlices(i);
  const bandCount = UK_TAX_BAND_NAMES[i.region].length;
  const employed = i.kind === 'employed';

  slices.forEach((s, n) => {
    if (n === 0 ? s.from !== 0 : s.from !== slices[n - 1].to) fail(`slice ${n} does not start where the last ended`);
    if (!(s.to > s.from)) fail(`slice ${n} has no width`);
    if (n > 0 && KIND_ORDER[s.kind] < KIND_ORDER[slices[n - 1].kind]) fail(`slice ${n} is out of order`);
    for (const f of SLICE_FIELDS) {
      if (!Number.isFinite(s[f]) || s[f] < -1e-9) fail(`slice ${n} ${f} is ${s[f]}`);
    }
    if (Math.abs(s.taken - (s.incomeTax + s.nationalInsurance + s.studentLoan + s.childBenefitCharge)) > 1e-9) {
      fail(`slice ${n} taken is not the sum of its four`);
    }
    if (s.taxBand !== null && !(Number.isInteger(s.taxBand) && s.taxBand >= 0 && s.taxBand < bandCount)) {
      fail(`slice ${n} taxBand ${s.taxBand} is not a band`);
    }
    if (s.kind === 'pension' && (s.taxBand !== null || s.allowanceTaper)) fail(`slice ${n} is a pension but has a band`);
    const width = s.to - s.from;
    const kept = s.kind === 'salary' ? width - s.taken : -s.taken;
    if (Math.abs(s.kept - kept) > 1e-9) fail(`slice ${n} kept is ${s.kept}, not ${kept}`);
    for (const f of [...SLICE_FIELDS, 'taken', 'kept'] as const) {
      if (Math.abs(s.rates[f] - s[f] / width) > 1e-9) fail(`slice ${n} rates.${f} is not ${f} over the width`);
    }
    if (width < 1 && slices.filter(o => o.kind === s.kind).length > 1) fail(`slice ${n} is a sliver of ${width}`);
  });

  const total = sumSlices(slices);
  const exact = calculateUkTax(i);
  const expected: Record<SliceField, number> = {
    incomeTax: exact.incomeTax,
    nationalInsurance: exact.nationalInsurance,
    studentLoan: exact.studentLoan + exact.postgradLoan,
    childBenefitCharge: exact.childBenefitCharge,
  };
  for (const f of SLICE_FIELDS) {
    if (!(Math.abs(total[f] - expected[f]) < 0.5 * 10 ** -money)) fail(`${f} sums to ${total[f]}, not ${expected[f]}`);
  }

  const income = Math.max(0, i.income);
  const contribution = Math.min(Math.max(0, i.pensionContribution), income);
  const preTax = employed && i.pensionMethod !== 'relief-at-source' ? contribution : 0;
  const pension = slices.filter(s => s.kind === 'pension');
  const benefits = slices.filter(s => s.kind === 'benefits-in-kind');
  const salary = slices.filter(s => s.kind === 'salary');

  if (preTax > 0 ? pension.length === 0 : pension.length > 0) fail(`${pension.length} pension slices`);
  else if (pension.length > 0) {
    if (pension[0].from !== income - preTax || pension[pension.length - 1].to !== income) {
      fail('the pension slices are not the top of pay');
    }
    if (pension.some(p => p.incomeTax > 1e-9 || p.childBenefitCharge > 1e-9)) fail('a pension slice pays tax or HICBC');
    if (i.pensionMethod === 'salary-sacrifice' && (pension.length !== 1 || pension[0].taken > 1e-9)) {
      fail('a sacrificed pension is split or takes something');
    }
  }
  if (salary.length > 0 && salary[salary.length - 1].to !== income - preTax) fail('salary does not end under the pension');
  if (salary.length === 0 && income - preTax > 0) fail('no salary slice for a salary');

  const bik = employed ? Math.max(0, i.benefitsInKind) : 0;
  if (bik > 0 ? benefits.length === 0 : benefits.length > 0) fail(`${benefits.length} benefits slices`);
  else if (benefits.length > 0) {
    if (benefits[0].from !== income || benefits[benefits.length - 1].to !== income + bik) {
      fail('the benefits slices are not on top of pay');
    }
    const tax = benefits.reduce((sum, b) => sum + b.incomeTax, 0);
    const alone = ukBenefitInKindTax({ ...i, benefitsInKind: 0 }, bik);
    if (Math.abs(tax - alone) > 1e-6) fail(`benefits tax ${tax}, not ${alone}`);
    if (benefits.some(b => b.nationalInsurance !== 0 || b.studentLoan !== 0)) fail('benefits in kind carry NI or a loan');
  }

  const summary = ukTakeHomeBySlice(i);
  const near = (a: number, b: number) => Math.abs(a - b) < 0.5 * 10 ** -money;
  if (!near(summary.pay, summary.kept + summary.taken + summary.pension)) fail('pay is not kept + taken + pension');
  if (!near(summary.kept + summary.childBenefit, exact.takeHome)) fail('kept + child benefit is not take-home');
  const keptBySlice = slices.reduce((sum, s) => sum + s.kept, 0) - (summary.reliefAtSource > 0 ? summary.pension : 0);
  if (!near(keptBySlice, summary.kept)) fail(`the slices keep ${keptBySlice}, not ${summary.kept}`);
  for (const f of SLICE_FIELDS) if (!near(summary[f], expected[f])) fail(`summary ${f} is ${summary[f]}`);
  if (summary.pay > 0) {
    if (Math.abs(summary.keptShare + summary.takenShare + summary.pensionShare - 1) > 1e-9) fail('shares do not add to 1');
    const parts = summary.incomeTaxShare + summary.nationalInsuranceShare + summary.studentLoanShare
      + summary.childBenefitChargeShare;
    if (Math.abs(parts - summary.takenShare) > 1e-9) fail('deduction shares do not add to takenShare');
  }
  if (summary.shortfall !== (summary.kept < 0 ? -summary.kept : 0)) fail('shortfall is not the negative of kept');
  return problems;
};

describe('UK_TAX_BAND_NAMES', () => {
  it('names the bands lowest first: three for the rest of the UK, six for Scotland', () => {
    expect(UK_TAX_BAND_NAMES.rUK).toEqual(['Basic rate', 'Higher rate', 'Additional rate']);
    expect(UK_TAX_BAND_NAMES.scotland).toEqual([
      'Starter rate',
      'Basic rate',
      'Intermediate rate',
      'Higher rate',
      'Advanced rate',
      'Top rate',
    ]);
  });

  it('has one name for each band the engine taxes in, and no more', () => {
    for (const region of ['rUK', 'scotland'] as const) {
      const bands = Array.from(new Set(ukPaySlices(input({ income: 1_000_000, region })).map(s => s.taxBand)));
      const names = UK_TAX_BAND_NAMES[region];
      expect(bands).toEqual([null, ...names.map((_, n) => n)]);
    }
  });
});

describe('ukPaySlices: the basic case', () => {
  it('slices £60,000 at the allowance, the NI upper limit and the end of pay', () => {
    const slices = slicesOf({ income: 60000 });
    expect(slices.map(s => [s.kind, s.from, s.to, s.taxBand])).toEqual([
      ['salary', 0, 12570, null],
      ['salary', 12570, 50270, 0],
      ['salary', 50270, 60000, 1],
    ]);
    expect(slices[0].taken).toBeCloseTo(0, money);
    expect(slices[1].incomeTax).toBeCloseTo(37700 * 0.2, money);
    expect(slices[1].incomeTax).toBeCloseTo(7540, money);
    expect(slices[1].nationalInsurance).toBeCloseTo(3016, money);
    expect(slices[1].taken).toBeCloseTo(10556, money);
    expect(slices[2].incomeTax).toBeCloseTo(9730 * 0.4, money);
    expect(slices[2].incomeTax).toBeCloseTo(3892, money);
    expect(slices[2].nationalInsurance).toBeCloseTo(194.6, money);
    expect(slices[2].taken).toBeCloseTo(4086.6, money);
    for (const s of slices) {
      expect(s.allowanceTaper).toBe(false);
      expect(s.studentLoan).toBe(0);
      expect(s.childBenefitCharge).toBe(0);
    }
  });

  it('adds up to the figures calculateUkTax gives for the same £60,000', () => {
    const slices = slicesOf({ income: 60000 });
    const b = calculateUkTax(input({ income: 60000 }));
    expect(sumSlices(slices).incomeTax).toBeCloseTo(b.incomeTax, money);
    expect(sumSlices(slices).nationalInsurance).toBeCloseTo(b.nationalInsurance, money);
    expect(sumSlices(slices).incomeTax).toBeCloseTo(11432, money);
  });

  it('starts student loan repayments at the plan 2 threshold of £29,385, at 9% and no earlier', () => {
    const slices = slicesOf({ income: 60000, undergradPlan: 'plan2' });
    expect(sliceEdges(slices)).toEqual([0, 12570, 29385, 50270, 60000]);
    expect(slices[1].studentLoan).toBe(0);
    expect(slices[2].studentLoan).toBeCloseTo((50270 - 29385) * 0.09, money);
    expect(slices[3].studentLoan).toBeCloseTo(9730 * 0.09, money);
    expect(sliceRate(slices[2], 'studentLoan')).toBeCloseTo(0.09, 9);
    // The band is the same either side of the threshold: only the loan moves.
    expect(slices[1].taxBand).toBe(0);
    expect(slices[2].taxBand).toBe(0);
  });

  it('adds the postgraduate loan at £21,000 and 6% to the student loan figure', () => {
    const slices = slicesOf({ income: 60000, undergradPlan: 'plan2', postgradLoan: true });
    expect(sliceEdges(slices)).toEqual([0, 12570, 21000, 29385, 50270, 60000]);
    expect(slices[1].studentLoan).toBe(0);
    expect(sliceRate(slices[2], 'studentLoan')).toBeCloseTo(0.06, 9);
    expect(sliceRate(slices[3], 'studentLoan')).toBeCloseTo(0.15, 9);
    expect(sliceRate(slices[4], 'studentLoan')).toBeCloseTo(0.15, 9);
  });

  it('takes 60% of the slice where the allowance is withdrawn, £100,000 to £110,000', () => {
    const slices = slicesOf({ income: 110000 });
    expect(sliceEdges(slices)).toEqual([0, 12570, 50270, 100000, 110000]);
    const taper = slices[slices.length - 1];
    expect(taper.allowanceTaper).toBe(true);
    expect(taper.taxBand).toBe(1);
    expect(taper.incomeTax).toBeCloseTo(6000, money);
    expect(taper.nationalInsurance).toBeCloseTo(200, money);
    expect(sliceRate(taper, 'incomeTax')).toBeCloseTo(0.6, 9);
    expect(slices[2].allowanceTaper).toBe(false);
    expect(slices[2].taxBand).toBe(1);
  });

  it('runs the taper to £125,140 and the 45% rate after it, with no empty slice where they meet', () => {
    const slices = slicesOf({ income: 150000 });
    // The allowance is gone at £125,140, which is also where the additional rate starts.
    expect(sliceEdges(slices)).toEqual([0, 12570, 50270, 100000, 125140, 150000]);
    const [, , , taper, additional] = slices;
    expect(taper.allowanceTaper).toBe(true);
    expect(taper.taxBand).toBe(1);
    expect(taper.incomeTax).toBeCloseTo(25140 * 0.6, money);
    expect(taper.nationalInsurance).toBeCloseTo(25140 * 0.02, money);
    expect(additional.allowanceTaper).toBe(false);
    expect(additional.taxBand).toBe(2);
    expect(additional.incomeTax).toBeCloseTo(24860 * 0.45, money);
    expect(slices.every(s => s.to > s.from)).toBe(true);
  });

  it('stops the taper where a smaller stated allowance runs out, £102,200 for £1,100', () => {
    const slices = slicesOf({ income: 130000, personalAllowance: 1100 });
    expect(sliceEdges(slices)).toEqual([0, 1100, 12570, 38800, 50270, 100000, 102200, 125140, 130000]);
    const taper = slices[5];
    expect(taper.allowanceTaper).toBe(true);
    expect(taper.incomeTax).toBeCloseTo(2200 * 0.6, money);
    expect(slices[4].allowanceTaper).toBe(false);
    expect(slices[6].allowanceTaper).toBe(false);
    expect(slices[6].taxBand).toBe(1);
    expect(slices[7].taxBand).toBe(2);
    // The higher rate starts at £38,800 here: £37,700 of taxable income after £1,100.
    expect(slices[2].taxBand).toBe(0);
    expect(slices[3].taxBand).toBe(1);
  });

  it('uses the Scottish bands: breaks at £16,537, £29,526 and £43,662, then the NI limit', () => {
    const slices = slicesOf({ income: 60000, region: 'scotland' });
    expect(sliceEdges(slices)).toEqual([0, 12570, 16537, 29526, 43662, 50270, 60000]);
    expect(slices.map(s => s.taxBand)).toEqual([null, 0, 1, 2, 3, 3]);
    expect(slices.slice(1).map(s => sliceRate(s, 'incomeTax'))).toEqual(
      [0.19, 0.2, 0.21, 0.42, 0.42].map(rate => expect.closeTo(rate, 9)),
    );
    expect(slices.slice(1).map(s => sliceRate(s, 'nationalInsurance'))).toEqual(
      [0.08, 0.08, 0.08, 0.08, 0.02].map(rate => expect.closeTo(rate, 9)),
    );
    expect(UK_TAX_BAND_NAMES.scotland[slices[2].taxBand ?? -1]).toBe('Basic rate');
  });

  it('reads a band limit of relief at source as it is stretched: the higher rate starts £6,000 later', () => {
    const slices = slicesOf({ income: 60000, pensionContribution: 6000, pensionMethod: 'relief-at-source' });
    expect(slices.map(s => s.kind)).toEqual(['salary', 'salary', 'salary', 'salary']);
    expect(sliceEdges(slices)).toEqual([0, 12570, 50270, 56270, 60000]);
    expect(slices.map(s => s.taxBand)).toEqual([null, 0, 0, 1]);
    expect(slices[2].incomeTax).toBeCloseTo(6000 * 0.2, money);
    expect(slices[2].nationalInsurance).toBeCloseTo(6000 * 0.02, money);
    expect(slices[3].incomeTax).toBeCloseTo(3730 * 0.4, money);
    expect(slices[3].to).toBe(60000);
  });

  it('moves the taper start up by the gross relief-at-source contribution: £106,000 for £6,000', () => {
    const slices = slicesOf({ income: 110000, pensionContribution: 6000, pensionMethod: 'relief-at-source' });
    expect(sliceEdges(slices)).toEqual([0, 12570, 50270, 56270, 106000, 110000]);
    expect(slices[3].allowanceTaper).toBe(false);
    expect(slices[4].allowanceTaper).toBe(true);
    expect(slices[4].incomeTax).toBeCloseTo(4000 * 0.6, money);
  });
});

describe('ukPaySlices: salary sacrifice and net pay take the pension from the top of salary', () => {
  it('ends salary at £54,000 under salary sacrifice, and the pension slice takes nothing at all', () => {
    const slices = slicesOf({ income: 60000, pensionContribution: 6000, pensionMethod: 'salary-sacrifice' });
    expect(slices.map(s => [s.kind, s.from, s.to])).toEqual([
      ['salary', 0, 12570],
      ['salary', 12570, 50270],
      ['salary', 50270, 54000],
      ['pension', 54000, 60000],
    ]);
    const pension = slices[3];
    expect(pension.taxBand).toBeNull();
    expect(pension.allowanceTaper).toBe(false);
    expect(pension.incomeTax).toBeCloseTo(0, money);
    expect(pension.nationalInsurance).toBeCloseTo(0, money);
    expect(pension.studentLoan).toBeCloseTo(0, money);
    expect(pension.childBenefitCharge).toBeCloseTo(0, money);
    expect(pension.taken).toBeCloseTo(0, money);
    // What salary alone is taxed on: the top £6,000 of the 40% slice is not pay.
    expect(slices[2].incomeTax).toBeCloseTo(3730 * 0.4, money);
  });

  it('takes no income tax from the pension slice under net pay, but its 2% NI', () => {
    const slices = slicesOf({ income: 60000, pensionContribution: 6000, pensionMethod: 'net-pay' });
    expect(slices.map(s => [s.kind, s.from, s.to])).toEqual([
      ['salary', 0, 12570],
      ['salary', 12570, 50270],
      ['salary', 50270, 54000],
      ['pension', 54000, 60000],
    ]);
    const pension = slices[3];
    expect(pension.incomeTax).toBeCloseTo(0, money);
    expect(pension.nationalInsurance).toBeCloseTo(120, money);
    expect(pension.studentLoan).toBeCloseTo(0, money);
    expect(pension.taken).toBeCloseTo(120, money);
  });

  it('keeps the student loan on net pay but not on salary sacrifice', () => {
    const netPay = slicesOf({ income: 60000, pensionContribution: 6000, pensionMethod: 'net-pay', undergradPlan: 'plan2' });
    const sacrifice = slicesOf({ income: 60000, pensionContribution: 6000, undergradPlan: 'plan2' });
    expect(netPay[netPay.length - 1].kind).toBe('pension');
    expect(netPay[netPay.length - 1].studentLoan).toBeCloseTo(6000 * 0.09, money);
    expect(sacrifice[sacrifice.length - 1].studentLoan).toBeCloseTo(0, money);
  });

  it('makes the whole of pay the pension slice when the contribution is more than the income', () => {
    const sacrifice = slicesOf({ income: 10000, pensionContribution: 20000, pensionMethod: 'salary-sacrifice' });
    expect(sacrifice).toHaveLength(1);
    expect(sacrifice[0]).toMatchObject({ kind: 'pension', from: 0, to: 10000, taxBand: null, allowanceTaper: false });
    expect(sacrifice[0].taken).toBeCloseTo(0, money);

    // Net pay at £30,000: salary is nil, and the NI on all of it is the pension's,
    // split where NI starts.
    const netPay = slicesOf({ income: 30000, pensionContribution: 40000, pensionMethod: 'net-pay' });
    expect(netPay.map(s => [s.kind, s.from, s.to])).toEqual([['pension', 0, 12570], ['pension', 12570, 30000]]);
    expect(netPay.every(s => s.incomeTax === 0)).toBe(true);
    expect(netPay[0].nationalInsurance).toBeCloseTo(0, money);
    expect(netPay[1].nationalInsurance).toBeCloseTo((30000 - 12570) * 0.08, money);
  });

  it('is the whole income when the contribution is exactly the income', () => {
    const slices = slicesOf({ income: 20000, pensionContribution: 20000, pensionMethod: 'net-pay' });
    expect(slices.map(s => [s.kind, s.from, s.to])).toEqual([['pension', 0, 12570], ['pension', 12570, 20000]]);
    expect(slices[1].nationalInsurance).toBeCloseTo((20000 - 12570) * 0.08, money);
  });

  it('splits a £15,000 net-pay pension on £60,000 at the NI upper limit: 8% below it, 2% above', () => {
    const pension = slicesOf({ income: 60000, pensionContribution: 15000, pensionMethod: 'net-pay' })
      .filter(s => s.kind === 'pension');
    expect(pension.map(s => [s.from, s.to])).toEqual([[45000, 50270], [50270, 60000]]);
    expect(pension[0].rates.nationalInsurance).toBeCloseTo(0.08, money);
    expect(pension[1].rates.nationalInsurance).toBeCloseTo(0.02, money);
    expect(pension.every(s => s.incomeTax === 0)).toBe(true);
    expect(pension.map(s => s.kept)).toEqual(pension.map(s => -s.taken));
  });

  it('keeps a salary-sacrifice pension as one slice that takes and keeps nothing', () => {
    const pension = slicesOf({ income: 60000, pensionContribution: 15000, pensionMethod: 'salary-sacrifice' })
      .filter(s => s.kind === 'pension');
    expect(pension).toHaveLength(1);
    expect(pension[0]).toMatchObject({ from: 45000, to: 60000, taken: 0, kept: -0 });
  });

  it('reads a negative or non-finite contribution as none: no pension slice', () => {
    for (const pensionContribution of [-1000, Number.NaN, Number.POSITIVE_INFINITY]) {
      const slices = slicesOf({ income: 60000, pensionContribution, pensionMethod: 'net-pay' });
      expect(slices.every(s => s.kind === 'salary')).toBe(true);
      expect(slices[slices.length - 1].to).toBe(60000);
    }
  });

  it('puts the pension under the benefits in kind, which still sit on top of income', () => {
    const slices = slicesOf({
      income: 60000,
      pensionContribution: 6000,
      pensionMethod: 'salary-sacrifice',
      benefitsInKind: 2000,
    });
    expect(slices.map(s => [s.kind, s.from, s.to])).toEqual([
      ['salary', 0, 12570],
      ['salary', 12570, 50270],
      ['salary', 50270, 54000],
      ['pension', 54000, 60000],
      ['benefits-in-kind', 60000, 62000],
    ]);
    // Pay is £54,000 and the benefits £2,000 more: the benefits are all in the 40% band.
    expect(slices[4].incomeTax).toBeCloseTo(800, money);
  });
});

describe('ukPaySlices: benefits in kind', () => {
  it('puts £2,000 of benefits on top of £60,000: taxed at 40%, no NI', () => {
    const slices = slicesOf({ income: 60000, benefitsInKind: 2000 });
    expect(slices).toHaveLength(4);
    expect(slices[3]).toMatchObject({ kind: 'benefits-in-kind', from: 60000, to: 62000, taxBand: 1 });
    expect(slices[3].allowanceTaper).toBe(false);
    expect(slices[3].kept).toBeCloseTo(-800, money);
    expect(slices[3].rates.incomeTax).toBeCloseTo(0.4, money);
    expect(slices[3].incomeTax).toBeCloseTo(800, money);
    expect(slices[3].nationalInsurance).toBe(0);
    expect(slices[3].studentLoan).toBe(0);
    expect(slices[3].taken).toBeCloseTo(800, money);
    // The salary slices are those of £60,000 without the benefits.
    expect(sliceEdges(slices.slice(0, 3))).toEqual([0, 12570, 50270, 60000]);
  });

  it('splits £3,000 at the basic-rate limit at £49,000: £1,270 at 20%, £1,730 at 40%, as ukBenefitInKindTax', () => {
    const benefits = slicesOf({ income: 49000, benefitsInKind: 3000 }).filter(s => s.kind === 'benefits-in-kind');
    expect(benefits.map(s => [s.from, s.to, s.taxBand])).toEqual([[49000, 50270, 0], [50270, 52000, 1]]);
    expect(benefits[0].incomeTax).toBeCloseTo(1270 * 0.2, money);
    expect(benefits[1].incomeTax).toBeCloseTo(1730 * 0.4, money);
    expect(benefits[0].rates.incomeTax).toBeCloseTo(0.2, money);
    expect(benefits[1].rates.incomeTax).toBeCloseTo(0.4, money);
    const tax = benefits[0].incomeTax + benefits[1].incomeTax;
    expect(tax).toBeCloseTo(946, money);
    expect(tax).toBeCloseTo(ukBenefitInKindTax(input({ income: 49000 }), 3000), money);
    expect(benefits.every(s => s.nationalInsurance === 0)).toBe(true);
  });

  it('carries the child benefit charge the benefits cause by raising adjusted net income', () => {
    // £59,000 plus £3,000 of benefits is £62,000 adjusted: 10% of £1,433.65.
    const slices = slicesOf({ income: 59000, benefitsInKind: 3000, children: 1 });
    const benefits = slices.filter(s => s.kind === 'benefits-in-kind');
    // Split where adjusted net income reaches £60,000.
    expect(benefits.map(s => [s.from, s.to])).toEqual([[59000, 60000], [60000, 62000]]);
    expect(benefits[0].childBenefitCharge).toBe(0);
    expect(benefits[1].childBenefitCharge).toBeCloseTo(0.1 * 27.05 * UK_CHILD_BENEFIT_WEEKS, money);
    expect(slices.filter(s => s.kind === 'salary').every(s => s.childBenefitCharge === 0)).toBe(true);
    expect(benefits[1].taken).toBeCloseTo(benefits[1].incomeTax + benefits[1].childBenefitCharge, money);
  });

  it('carries the allowance withdrawn when the benefits push adjusted net income over £100,000', () => {
    const benefits = slicesOf({ income: 99000, benefitsInKind: 3000 }).filter(s => s.kind === 'benefits-in-kind');
    // Split where adjusted net income passes £100,000: 40%, then 60% as the allowance goes.
    expect(benefits.map(s => [s.from, s.to, s.allowanceTaper])).toEqual([[99000, 100000, false], [100000, 102000, true]]);
    expect(benefits[0].rates.incomeTax).toBeCloseTo(0.4, money);
    expect(benefits[1].rates.incomeTax).toBeCloseTo(0.6, money);
    const tax = benefits[0].incomeTax + benefits[1].incomeTax;
    expect(tax).toBeCloseTo(ukBenefitInKindTax(input({ income: 99000 }), 3000), money);
    // £3,000 at 40%, plus £1,000 of allowance lost at 40% for the £2,000 over.
    expect(tax).toBeCloseTo(3000 * 0.4 + 1000 * 0.4, money);
  });

  it('is the only slice when there is benefits and no income', () => {
    const slices = slicesOf({ income: 0, benefitsInKind: 500 });
    expect(slices.map(s => [s.kind, s.from, s.to])).toEqual([['benefits-in-kind', 0, 500]]);
    expect(slices[0].taken).toBeCloseTo(0, money);
  });

  it('has none for a negative or non-finite benefits figure', () => {
    for (const benefitsInKind of [-2000, Number.NaN, Number.POSITIVE_INFINITY, 0]) {
      expect(slicesOf({ income: 60000, benefitsInKind }).every(s => s.kind === 'salary')).toBe(true);
    }
  });
});

describe('ukPaySlices: allowance, child benefit and marriage allowance', () => {
  it('taxes from the first pound at 20% with a personal allowance of 0, while NI waits for £12,570', () => {
    const slices = slicesOf({ income: 60000, personalAllowance: 0 });
    expect(sliceEdges(slices)).toEqual([0, 12570, 37700, 50270, 60000]);
    expect(slices[0].taxBand).toBe(0);
    expect(slices[0].incomeTax).toBeCloseTo(12570 * 0.2, money);
    expect(slices[0].nationalInsurance).toBe(0);
    expect(slices[1].nationalInsurance).toBeCloseTo((37700 - 12570) * 0.08, money);
    expect(slices[2].taxBand).toBe(1);
  });

  it('has no taper to split a pay of £130,000 with no allowance: nothing to withdraw', () => {
    const slices = slicesOf({ income: 130000, personalAllowance: 0 });
    expect(sliceEdges(slices)).toEqual([0, 12570, 37700, 50270, 125140, 130000]);
    expect(slices.some(s => s.allowanceTaper)).toBe(false);
  });

  it('reads a negative allowance as the statutory one', () => {
    expect(ukPaySlices(input({ income: 60000, personalAllowance: -5 }))).toEqual(ukPaySlices(input({ income: 60000 })));
  });

  it('starts the child benefit charge at £60,000: 50% of £1,433.65 by £70,000', () => {
    const slices = slicesOf({ income: 70000, children: 1 });
    expect(sliceEdges(slices)).toEqual([0, 12570, 50270, 60000, 70000]);
    expect(slices.slice(0, 3).every(s => s.childBenefitCharge === 0)).toBe(true);
    expect(slices[3].childBenefitCharge).toBeCloseTo(0.5 * 27.05 * UK_CHILD_BENEFIT_WEEKS, money);
    expect(slices[3].childBenefitCharge).toBeCloseTo(716.825, money);
    expect(sumSlices(slices).childBenefitCharge).toBeCloseTo(
      calculateUkTax(input({ income: 70000, children: 1 })).childBenefitCharge,
      money,
    );
  });

  it('ends the charge at £80,000, all of it for two children, and nothing after', () => {
    const slices = slicesOf({ income: 90000, children: 2 });
    expect(sliceEdges(slices)).toEqual([0, 12570, 50270, 60000, 80000, 90000]);
    expect(slices[3].childBenefitCharge).toBeCloseTo((27.05 + 17.9) * UK_CHILD_BENEFIT_WEEKS, money);
    expect(slices[4].childBenefitCharge).toBe(0);
  });

  it('moves the charge up by the relief-at-source contribution: £66,000 for £6,000', () => {
    const slices = slicesOf({ income: 70000, children: 1, pensionContribution: 6000, pensionMethod: 'relief-at-source' });
    expect(sliceEdges(slices)).toEqual([0, 12570, 50270, 56270, 66000, 70000]);
    // Adjusted net income £64,000: 20 complete £200 steps.
    expect(slices[4].childBenefitCharge).toBeCloseTo(0.2 * 27.05 * UK_CHILD_BENEFIT_WEEKS, money);
  });

  it('shows no tax up to £13,830 with a marriage allowance, then 20%', () => {
    const slices = slicesOf({ income: 30000, marriageAllowance: true });
    expect(sliceEdges(slices)).toEqual([0, 12570, 13830, 30000]);
    expect(slices[1].incomeTax).toBeCloseTo(0, money);
    expect(slices[1].taxBand).toBe(0);
    expect(slices[2].incomeTax).toBeCloseTo((30000 - 13830) * 0.2, money);
    expect(sumSlices(slices).incomeTax).toBeCloseTo(calculateUkTax(input({ income: 30000, marriageAllowance: true })).incomeTax, money);
  });

  it('shows the marriage allowance lost as extra tax in the slice that crosses the basic-rate limit', () => {
    const slices = slicesOf({ income: 55000, marriageAllowance: true });
    expect(sliceEdges(slices)).toEqual([0, 12570, 13830, 50270, 55000]);
    // £4,730 at 40%, and the £252 relief gone.
    expect(slices[3].incomeTax).toBeCloseTo(4730 * 0.2 + 4730 * 0.2 + 252, money);
    expect(slices[3].incomeTax).toBeCloseTo(2144, money);
  });

  it('puts the first Scottish tax after a marriage allowance at £13,896.31, the penny before it starts', () => {
    const slices = slicesOf({ income: 30000, marriageAllowance: true, region: 'scotland' });
    // 252 / 19% is £1,326.3158 of taxable income: floored, so the slice below takes none.
    expect(slices[2].from).toBe(13896.31);
    expect(slices[1].incomeTax).toBeCloseTo(0, 9);
  });
});

describe('ukPaySlices: self-employed', () => {
  it('has no pension slice for a contribution, which is relief at source whatever method is given', () => {
    for (const pensionMethod of ['salary-sacrifice', 'net-pay', 'relief-at-source'] as const) {
      const slices = slicesOf({ income: 40000, kind: 'self-employed', pensionContribution: 2000, pensionMethod });
      expect(slices.map(s => [s.kind, s.from, s.to])).toEqual([
        ['salary', 0, 12570],
        ['salary', 12570, 40000],
      ]);
      expect(sliceRate(slices[1], 'nationalInsurance')).toBeCloseTo(0.06, 9);
      expect(slices[1].incomeTax).toBeCloseTo(27430 * 0.2, money);
    }
  });

  it('charges Class 4 at 2% above £50,270', () => {
    const slices = slicesOf({ income: 60000, kind: 'self-employed' });
    expect(sliceRate(slices[1], 'nationalInsurance')).toBeCloseTo(0.06, 9);
    expect(sliceRate(slices[2], 'nationalInsurance')).toBeCloseTo(0.02, 9);
  });

  it('has no benefits-in-kind slice, whatever benefits are given', () => {
    const slices = slicesOf({ income: 40000, kind: 'self-employed', benefitsInKind: 5000 });
    expect(slices.every(s => s.kind === 'salary')).toBe(true);
    expect(slices[slices.length - 1].to).toBe(40000);
  });
});

describe('ukPaySlices: empty, degenerate and hostile input', () => {
  it('is empty for no income', () => {
    expect(slicesOf({ income: 0 })).toEqual([]);
    expect(slicesOf({ income: 0, pensionContribution: 5000, pensionMethod: 'net-pay' })).toEqual([]);
  });

  it('is empty for a negative or non-finite income', () => {
    for (const income of [-1, -50000, Number.NaN, Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY]) {
      expect(slicesOf({ income })).toEqual([]);
    }
  });

  it('is one slice for a single row of income inside the allowance', () => {
    const slices = slicesOf({ income: 10000 });
    expect(slices).toHaveLength(1);
    expect(slices[0]).toEqual({
      kind: 'salary',
      from: 0,
      to: 10000,
      taxBand: null,
      allowanceTaper: false,
      incomeTax: 0,
      nationalInsurance: 0,
      studentLoan: 0,
      childBenefitCharge: 0,
      taken: 0,
      kept: 10000,
      rates: { incomeTax: 0, nationalInsurance: 0, studentLoan: 0, childBenefitCharge: 0, taken: 0, kept: 1 },
    });
  });

  it('does not split pay that ends exactly on a threshold', () => {
    expect(sliceEdges(slicesOf({ income: 12570 }))).toEqual([0, 12570]);
    expect(sliceEdges(slicesOf({ income: 50270 }))).toEqual([0, 12570, 50270]);
    expect(sliceEdges(slicesOf({ income: 100000 }))).toEqual([0, 12570, 50270, 100000]);
  });

  it('keeps a pound over a threshold as its own slice, and a fraction of a penny of pay as one slice', () => {
    expect(sliceEdges(slicesOf({ income: 50271 }))).toEqual([0, 12570, 50270, 50271]);
    const tiny = slicesOf({ income: 0.004 });
    expect(tiny).toHaveLength(1);
    expect(tiny[0].to).toBe(0.004);
  });

  it('returns finite figures for hostile fields, not NaN', () => {
    const hostile = input({
      income: 60000,
      benefitsInKind: Number.NaN,
      pensionContribution: Number.NaN,
      children: Number.NaN,
      childcareSupport: Number.NaN,
      personalAllowance: Number.NaN,
    });
    const slices = ukPaySlices(hostile);
    expect(slices).toEqual(ukPaySlices(input({ income: 60000 })));
    for (const s of slices) expect(Object.values(s).every(v => v === null || typeof v !== 'number' || Number.isFinite(v))).toBe(true);
  });

  it('puts every break in the right place for a very large income, and stays finite', () => {
    for (const income of [1e9, 1e15, 1e300]) {
      const slices = slicesOf({ income, children: 1, undergradPlan: 'plan2' });
      expect(sliceEdges(slices).slice(0, 7)).toEqual([0, 12570, 29385, 50270, 60000, 80000, 100000]);
      expect(sliceEdges(slices)[7]).toBe(125140);
      expect(sliceEdges(slices)).toHaveLength(9);
      expect(slices[slices.length - 1].to).toBe(income);
      expect(slices.every(s => SLICE_FIELDS.every(f => Number.isFinite(s[f])))).toBe(true);
    }
  });

  it('does not alter its input', () => {
    const i = input({ income: 60000, pensionContribution: 6000, benefitsInKind: 2000, children: 1 });
    const copy = { ...i };
    ukPaySlices(i);
    expect(i).toEqual(copy);
  });

  it('is the same slices every time it is asked', () => {
    const i = input({ income: 123456.78, region: 'scotland', undergradPlan: 'plan1', marriageAllowance: true });
    expect(ukPaySlices(i)).toEqual(ukPaySlices({ ...i }));
  });
});

describe('ukPaySlices: structure', () => {
  const cases: [string, Partial<UkTaxInput>][] = [
    ['a plain salary', { income: 45000 }],
    ['a high earner in Scotland with loans', { income: 140000, region: 'scotland', undergradPlan: 'plan2', postgradLoan: true }],
    ['salary sacrifice with benefits', { income: 70000, pensionContribution: 8000, benefitsInKind: 3000, children: 2 }],
    ['net pay across the taper', { income: 112000, pensionContribution: 9000, pensionMethod: 'net-pay' }],
    ['relief at source with a marriage allowance', { income: 52000, pensionContribution: 4000, pensionMethod: 'relief-at-source', marriageAllowance: true }],
    ['a sole trader', { income: 90000, kind: 'self-employed', undergradPlan: 'plan5' }],
  ];

  it.each(cases)('is contiguous, positive, non-negative and adds up for %s', (_name, over) => {
    const i = input(over);
    expect(sliceProblems(i)).toEqual([]);
    const slices = ukPaySlices(i);
    expect(slices[0].from).toBe(0);
    slices.forEach((s, n) => {
      if (n > 0) expect(s.from).toBe(slices[n - 1].to);
      expect(s.to).toBeGreaterThan(s.from);
      for (const f of SLICE_FIELDS) expect(s[f]).toBeGreaterThanOrEqual(-1e-9);
      expect(s.taken).toBeCloseTo(s.incomeTax + s.nationalInsurance + s.studentLoan + s.childBenefitCharge, money);
    });
  });

  it('lists salary slices low to high, then the pension, then the benefits in kind', () => {
    const kinds = ukPaySlices(input({ income: 70000, pensionContribution: 8000, benefitsInKind: 3000 })).map(s => s.kind);
    expect(kinds).toEqual(['salary', 'salary', 'salary', 'pension', 'benefits-in-kind']);
  });
});

describe('ukPaySlices: no break is missed inside a slice', () => {
  it('has the same marginal rate in the first pound, the middle and the last pound of every salary slice', () => {
    const problems: string[] = [];
    for (const region of ['rUK', 'scotland'] as const) {
      for (const undergradPlan of ['none', 'plan2'] as const) {
        for (const postgradLoan of [false, true]) {
          for (const children of [0, 2]) {
            for (const marriageAllowance of [false, true]) {
              for (const personalAllowance of [undefined, 0, 1100]) {
                for (const income of [61000, 300000]) {
                  for (const reliefAtSource of [0, 5000]) {
                    const i = input({
                      income,
                      region,
                      undergradPlan,
                      postgradLoan,
                      children,
                      marriageAllowance,
                      personalAllowance,
                      pensionContribution: reliefAtSource,
                      pensionMethod: 'relief-at-source',
                    });
                    for (const s of ukPaySlices(i)) {
                      const width = s.to - s.from;
                      // The first pound, the middle and the last pound, a penny in from each end
                      // since a break is placed to the penny. A kink anywhere between changes the
                      // rate from one end to the other.
                      if (width < 3) continue;
                      const rates = [s.from + 0.01, s.from + width / 2 - 0.5, s.to - 1.01].map(income =>
                        ukMarginalRate({ ...i, income }),
                      );
                      if (rates.some(r => Math.abs(r - rates[0]) > 1e-9)) {
                        problems.push(`${JSON.stringify(i)} [${s.from}, ${s.to}]: ${rates.join(', ')}`);
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
    expect(problems).toEqual([]);
  });
});

describe('ukPaySlices: reconciliation with calculateUkTax', () => {
  const regions: UkTaxRegion[] = ['rUK', 'scotland'];
  const methods: UkPensionMethod[] = ['salary-sacrifice', 'net-pay', 'relief-at-source'];
  const contributions = [0, 5000];
  const plans: UkUndergradPlan[] = ['none', 'plan2'];
  const postgrads = [false, true];
  const benefits = [0, 4000];
  const childCounts = [0, 2];
  const marriage = [false, true];
  const allowances = [undefined, 0, 1100];
  const incomes = [0, 9000, 13000, 30000, 52000, 61000, 99000, 105000, 130000, 300000];

  /** What is wrong with every combination of the other dimensions, for one region, kind and method. */
  const gridProblems = (fixed: Pick<UkTaxInput, 'region' | 'kind' | 'pensionMethod'>): string[] => {
    const problems: string[] = [];
    for (const pensionContribution of contributions) {
      for (const undergradPlan of plans) {
        for (const postgradLoan of postgrads) {
          for (const benefitsInKind of benefits) {
            for (const children of childCounts) {
              for (const marriageAllowance of marriage) {
                for (const personalAllowance of allowances) {
                  for (const income of incomes) {
                    problems.push(
                      ...sliceProblems(
                        input({
                          ...fixed,
                          pensionContribution,
                          undergradPlan,
                          postgradLoan,
                          benefitsInKind,
                          children,
                          marriageAllowance,
                          personalAllowance,
                          income,
                        }),
                      ),
                    );
                  }
                }
              }
            }
          }
        }
      }
    }
    return problems;
  };

  for (const region of regions) {
    for (const pensionMethod of methods) {
      it(`sums to the exact figures and is well formed for every combination: ${region}, employed, ${pensionMethod}`, () => {
        expect(gridProblems({ region, kind: 'employed', pensionMethod })).toEqual([]);
      });
    }

    for (const pensionMethod of methods) {
      it(`sums to the exact figures for every combination: ${region}, self-employed, ${pensionMethod} given`, () => {
        expect(gridProblems({ region, kind: 'self-employed', pensionMethod })).toEqual([]);
      });
    }
  }

  it('sums the income tax of the benefits slice and the salary to the exact tax on both', () => {
    const i = input({ income: 99000, benefitsInKind: 3000, children: 1, marriageAllowance: true });
    const slices = ukPaySlices(i);
    expect(sumSlices(slices).incomeTax).toBeCloseTo(calculateUkTax(i).incomeTax, money);
    expect(sumSlices(slices).childBenefitCharge).toBeCloseTo(calculateUkTax(i).childBenefitCharge, money);
  });
});

describe('ukPaySlices: edges are floored and slivers folded', () => {
  it('keeps the marriage allowance cliff out of a sliver: £60,000 with a £12,570.556 allowance', () => {
    const slices = slicesOf({ income: 60000, personalAllowance: 12570.556, marriageAllowance: true });
    expect(slices.every(s => s.to - s.from >= 1)).toBe(true);
    expect(slices.every(s => s.rates.incomeTax <= 1)).toBe(true);
    // The allowance ends at £12,570.556 and the basic-rate limit at £50,270.556: each under
    // £1 past an NI limit, so each folds into it, and the cliff is in the big slice above.
    expect(sliceEdges(slices)).toEqual([0, 12570, 13830.55, 50270, 60000]);
  });

  it('has no sliver and no rate out of range for fractional allowances and contributions', () => {
    const problems: string[] = [];
    for (const region of ['rUK', 'scotland'] as const) {
      for (const pensionMethod of ['salary-sacrifice', 'net-pay', 'relief-at-source'] as const) {
        for (const personalAllowance of [12570.556, 1100.3, 0.4, undefined]) {
          for (const pensionContribution of [0, 0.5, 1234.567]) {
            for (const marriageAllowance of [false, true]) {
              for (const income of [12570.7, 50270.3, 60000, 100000.5, 125140.4]) {
                const i = input({
                  region, pensionMethod, personalAllowance, pensionContribution, marriageAllowance, income,
                  benefitsInKind: 777.77, undergradPlan: 'plan2', children: 1,
                });
                const slices = ukPaySlices(i);
                problems.push(...sliceProblems(i));
                slices.forEach((s, n) => {
                  const alone = slices.filter(o => o.kind === s.kind).length === 1;
                  if (s.to - s.from < 1 && !alone) problems.push(`sliver ${n} in ${JSON.stringify(i)}`);
                  for (const rate of Object.values(s.rates)) {
                    if (!Number.isFinite(rate)) problems.push(`rate ${rate} in ${JSON.stringify(i)}`);
                  }
                  if (s.rates.incomeTax < -1e-9 || s.rates.incomeTax > 1) {
                    problems.push(`income tax rate ${s.rates.incomeTax} in ${JSON.stringify(i)}`);
                  }
                });
              }
            }
          }
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it('keeps a pension under £1 as its one slice', () => {
    const pension = slicesOf({ income: 60000, pensionContribution: 0.5, pensionMethod: 'net-pay' })
      .filter(s => s.kind === 'pension');
    expect(pension.map(s => [s.from, s.to])).toEqual([[59999.5, 60000]]);
  });

  it('still breaks exactly on whole-pound thresholds found by bisection', () => {
    expect(sliceEdges(slicesOf({ income: 60000, undergradPlan: 'plan2' }))).toEqual([0, 12570, 29385, 50270, 60000]);
  });
});

describe('ukTakeHomeBySlice', () => {
  it('splits £60,000 with a £3,000 sacrifice, £1,500 of benefits and plan 2 into kept, taken and pension', () => {
    const t = ukTakeHomeBySlice(input({
      income: 60000, pensionContribution: 3000, benefitsInKind: 1500, undergradPlan: 'plan2',
    }));
    expect(t.pay).toBe(60000);
    expect(t.incomeTax).toBeCloseTo(10832, money);
    expect(t.nationalInsurance).toBeCloseTo(3150.6, money);
    expect(t.studentLoan).toBeCloseTo(2485.35, money);
    expect(t.taken).toBeCloseTo(16467.95, money);
    expect(t.pension).toBe(3000);
    expect(t.kept).toBeCloseTo(40532.05, money);
    expect(t.shortfall).toBe(0);
    expect(t.keptShare).toBeCloseTo(40532.05 / 60000, 9);
    expect(t.takenShare).toBeCloseTo(16467.95 / 60000, 9);
    expect(t.pensionShare).toBeCloseTo(0.05, 9);
    expect(t.incomeTaxShare + t.nationalInsuranceShare + t.studentLoanShare + t.childBenefitChargeShare)
      .toBeCloseTo(t.takenShare, 9);
    expect(t.reliefAtSource).toBe(0);
  });

  it('reports relief at source as 80% from pay and the gross figure the bands widen by', () => {
    const t = ukTakeHomeBySlice(input({ income: 60000, pensionContribution: 6000, pensionMethod: 'relief-at-source' }));
    expect(t.pension).toBeCloseTo(4800, money);
    expect(t.reliefAtSource).toBe(6000);
    expect(t.slices.some(s => s.kind === 'pension')).toBe(false);
    expect(t.slices.reduce((sum, s) => sum + s.kept, 0) - t.pension).toBeCloseTo(t.kept, money);
  });

  it('caps the relief-at-source figure at pay, as the engine does', () => {
    expect(ukTakeHomeBySlice(input({ income: 5000, pensionContribution: 9000, pensionMethod: 'relief-at-source' }))
      .reliefAtSource).toBe(5000);
  });

  it('names child benefit beside what pay keeps, not in it', () => {
    const i = input({ income: 70000, children: 1 });
    const t = ukTakeHomeBySlice(i);
    expect(t.childBenefit).toBeCloseTo(27.05 * UK_CHILD_BENEFIT_WEEKS, money);
    expect(t.kept + t.childBenefit).toBeCloseTo(calculateUkTax(i).takeHome, money);
    expect(t.childBenefitChargeShare).toBeCloseTo(t.childBenefitCharge / 70000, 9);
  });

  it('reports a shortfall when a net-pay pension takes all of £20,000 and NI is still due', () => {
    const t = ukTakeHomeBySlice(input({ income: 20000, pensionContribution: 20000, pensionMethod: 'net-pay' }));
    expect(t.kept).toBeCloseTo(-594.4, money);
    expect(t.shortfall).toBeCloseTo(594.4, money);
    expect(t.keptShare + t.takenShare + t.pensionShare).toBeCloseTo(1, 9);
  });

  it('reports a shortfall when £90,000 of benefits on £10,000 cost more than the pay', () => {
    const i = input({ income: 10000, benefitsInKind: 90000 });
    const t = ukTakeHomeBySlice(i);
    expect(t.kept).toBeLessThan(0);
    expect(t.shortfall).toBeCloseTo(-t.kept, money);
    expect(t.kept).toBeCloseTo(calculateUkTax(i).takeHome, money);
  });

  it('has every share 0, never NaN, with no pay', () => {
    for (const income of [0, -5, Number.NaN]) {
      const t = ukTakeHomeBySlice(input({ income, benefitsInKind: 500 }));
      expect(t.pay).toBe(0);
      for (const share of [t.keptShare, t.takenShare, t.pensionShare, t.incomeTaxShare,
        t.nationalInsuranceShare, t.studentLoanShare, t.childBenefitChargeShare]) {
        expect(share).toBe(0);
      }
      expect(Number.isNaN(t.kept)).toBe(false);
    }
  });
});
