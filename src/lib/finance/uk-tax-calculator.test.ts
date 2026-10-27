import { describe, expect, it } from 'vitest';
import {
  calculateUkTax,
  ukMarginalRate,
  ukTaxCliffs,
  ukTaxCurve,
  UK_CHILD_BENEFIT_WEEKS,
  UK_TAX_YEAR_LABEL,
  type UkTaxBreakdown,
  type UkTaxInput,
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
