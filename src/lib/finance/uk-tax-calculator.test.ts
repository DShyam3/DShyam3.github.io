import { describe, expect, it } from 'vitest';
import {
  calculateUkTax,
  ukBasePersonalAllowance,
  ukBenefitInKindTax,
  ukCashAfterTax,
  ukChildBenefitBand,
  ukMarginalBands,
  ukMarginalRate,
  ukMarginalRates,
  ukTakeHomeBySlice,
  ukTakeHomeShareAt,
  ukTakeHomeShareCurve,
  ukTaxCliffs,
  ukTaxCurve,
  ukWhatIfs,
  UK_ALLOWANCE_TAPER_RATE,
  UK_ALLOWANCE_TAPER_START,
  UK_CHILDCARE_CUTOFF,
  UK_CHILD_BENEFIT_CHARGE_END,
  UK_CHILD_BENEFIT_CHARGE_START,
  UK_CHILD_BENEFIT_CHARGE_STEP,
  UK_CHILD_BENEFIT_WEEKS,
  UK_STATUTORY_PERSONAL_ALLOWANCE,
  UK_TAX_YEAR_LABEL,
  type UkIncomeBand,
  type UkIncomeTaxBandName,
  type UkMarginalBand,
  type UkMarginalRates,
  type UkPaySlice,
  type UkTaxBreakdown,
  type UkTaxInput,
  type UkUndergradPlan,
  type UkWhatIf,
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

describe('the allowance taper constants', () => {
  it('state the £100,000 start and the £1-for-£2 rate the rule set is built from', () => {
    expect(UK_ALLOWANCE_TAPER_START).toBe(100_000);
    expect(UK_ALLOWANCE_TAPER_RATE).toBe(0.5);
  });

  it('drive the calculation: no allowance lost at the start, half a pound per pound above it, none left at the end', () => {
    const allowance = (income: number): number => calculateUkTax(input({ income })).personalAllowance;
    expect(allowance(UK_ALLOWANCE_TAPER_START)).toBe(UK_STATUTORY_PERSONAL_ALLOWANCE);
    expect(allowance(UK_ALLOWANCE_TAPER_START + 10_000)).toBe(
      UK_STATUTORY_PERSONAL_ALLOWANCE - UK_ALLOWANCE_TAPER_RATE * 10_000,
    );
    const end = UK_ALLOWANCE_TAPER_START + UK_STATUTORY_PERSONAL_ALLOWANCE / UK_ALLOWANCE_TAPER_RATE;
    expect(allowance(end)).toBe(0);
    expect(allowance(end - 2)).toBe(1);
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

describe('ukMarginalRates', () => {
  const rates = (over: Partial<UkTaxInput>) => ukMarginalRates(input(over));

  it('splits a basic-rate employee at £50,000 into 20% income tax and 8% NI', () => {
    const r = rates({ income: 50000 });
    expect(r.incomeTax).toBeCloseTo(0.2, 6);
    expect(r.nationalInsurance).toBeCloseTo(0.08, 6);
    expect(r.studentLoan).toBe(0);
    expect(r.postgradLoan).toBe(0);
    expect(r.childBenefitCharge).toBe(0);
    expect(r.total).toBeCloseTo(0.28, 6);
  });

  it('puts the allowance taper in income tax: 60% inside £100,000-£125,140, with NI 2% beside it', () => {
    const r = rates({ income: 110000 });
    expect(r.incomeTax).toBeCloseTo(0.6, 6);
    expect(r.nationalInsurance).toBeCloseTo(0.02, 6);
    expect(r.total).toBeCloseTo(0.62, 6);
  });

  it('keeps the undergraduate and postgraduate loans apart: 9% and 6% at £60,000', () => {
    const r = rates({ income: 60000, undergradPlan: 'plan2', postgradLoan: true });
    expect(r.studentLoan).toBeCloseTo(0.09, 6);
    expect(r.postgradLoan).toBeCloseTo(0.06, 6);
    expect(r.incomeTax).toBeCloseTo(0.4, 6);
    expect(r.nationalInsurance).toBeCloseTo(0.02, 6);
    expect(r.total).toBeCloseTo(0.57, 6);
  });

  it('reports the child benefit charge as its own steady slope across £60,000-£80,000', () => {
    const r = rates({ income: 70000, children: 3, undergradPlan: 'plan2' });
    expect(r.childBenefitCharge).toBeCloseTo(3331.05 / 20000, 6);
    expect(r.incomeTax).toBeCloseTo(0.4, 6);
    expect(r.total).toBeCloseTo(0.6765525, 6);
    expect(rates({ income: 50000, children: 3 }).childBenefitCharge).toBe(0);
    expect(rates({ income: 90000, children: 3 }).childBenefitCharge).toBe(0);
  });

  it('returns exactly the number ukMarginalRate returns as its total', () => {
    const cases: Array<Partial<UkTaxInput>> = [
      { income: 50000 },
      { income: 110000, region: 'scotland' },
      { income: 70000, children: 3, undergradPlan: 'plan2', postgradLoan: true },
      { income: 55000, pensionContribution: 2750, pensionMethod: 'net-pay' },
      { income: 20000, pensionContribution: 60000, pensionMethod: 'relief-at-source' },
      { income: 50270, marriageAllowance: true },
      { income: 0 },
      { income: Number.NaN },
    ];
    for (const over of cases) {
      expect(rates(over).total).toBe(ukMarginalRate(input(over)));
    }
  });

  it('has five parts that add up to the total', () => {
    for (const income of [5000, 20000, 40000, 55000, 70000, 110000, 150000]) {
      const r = rates({ income, children: 2, undergradPlan: 'plan1', postgradLoan: true });
      const parts = r.incomeTax + r.nationalInsurance + r.studentLoan + r.postgradLoan + r.childBenefitCharge;
      expect(parts).toBeCloseTo(r.total, 9);
    }
  });

  it('holds marriage allowance eligibility at the base income, as ukMarginalRate does', () => {
    const r = rates({ income: 50270, marriageAllowance: true });
    expect(r.incomeTax).toBeCloseTo(0.4, 6);
    expect(r.nationalInsurance).toBeCloseTo(0.02, 6);
  });

  it('holds the pension at its capped pounds: pay is nil below the contribution, so no tax but NI still bites', () => {
    // A £60,000 net-pay contribution at £20,000 income is capped at £20,000, so
    // pay is nil. The next pound is pay again with the contribution unchanged:
    // well inside the allowance, so untaxed, but NI is on `income` and net pay
    // does not reduce it.
    const r = rates({ income: 20000, pensionContribution: 60000, pensionMethod: 'net-pay' });
    expect(r.incomeTax).toBe(0);
    expect(r.nationalInsurance).toBeCloseTo(0.08, 6);
  });

  it('is zero in every part for no income and inside the allowance', () => {
    const zero: UkMarginalRates = {
      incomeTax: 0,
      nationalInsurance: 0,
      studentLoan: 0,
      postgradLoan: 0,
      childBenefitCharge: 0,
      total: 0,
    };
    expect(rates({ income: 0 })).toEqual(zero);
    expect(rates({ income: 5000, children: 2, undergradPlan: 'plan2', postgradLoan: true })).toEqual(zero);
  });

  it('is finite in every part for negative, non-finite and hostile input', () => {
    const hostile: Array<Partial<UkTaxInput>> = [
      { income: -10 },
      { income: Number.NaN },
      { income: Number.POSITIVE_INFINITY },
      { income: 60000, pensionContribution: Number.NaN, benefitsInKind: Number.NEGATIVE_INFINITY, children: Number.NaN },
      { income: 60000, children: Number.POSITIVE_INFINITY, personalAllowance: Number.NaN },
    ];
    for (const over of hostile) {
      for (const value of Object.values(rates(over))) {
        expect(Number.isFinite(value)).toBe(true);
      }
    }
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

describe('ukTakeHomeBySlice', () => {
  const sumField = (slices: UkPaySlice[], pick: (s: UkPaySlice) => number): number =>
    slices.reduce((acc, s) => acc + pick(s), 0);

  const assertSliceInvariants = (i: UkTaxInput, opts?: { includePensionAndBenefits?: boolean }) => {
    const summary = ukTakeHomeBySlice(i, opts);
    const include = opts?.includePensionAndBenefits ?? true;
    // Children stay in: the charge is a tax on income. Childcare support is
    // not pay and does not move take-home either way.
    const expectedCalc = calculateUkTax({
      ...i,
      childcareSupport: 0,
      pensionContribution: include ? i.pensionContribution : 0,
      benefitsInKind: include ? i.benefitsInKind : 0,
    });

    expect(summary.incomeTax).toBeCloseTo(expectedCalc.incomeTax, money);
    expect(summary.nationalInsurance).toBeCloseTo(expectedCalc.nationalInsurance, money);
    expect(summary.studentLoan).toBeCloseTo(expectedCalc.studentLoan + expectedCalc.postgradLoan, money);
    expect(summary.childBenefitCharge).toBeCloseTo(expectedCalc.childBenefitCharge, money);
    expect(summary.childBenefit).toBeCloseTo(expectedCalc.childBenefit, money);
    expect(summary.pensionFromPay).toBeCloseTo(expectedCalc.pensionFromPay, money);
    expect(summary.totalDeductions).toBeCloseTo(
      expectedCalc.pensionFromPay +
        expectedCalc.incomeTax +
        expectedCalc.nationalInsurance +
        expectedCalc.studentLoan +
        expectedCalc.postgradLoan +
        expectedCalc.childBenefitCharge,
      money,
    );
    // The charge is in, the benefit is not: cash pay is take-home less the benefit.
    expect(summary.rawTakeHome).toBeCloseTo(expectedCalc.takeHome - expectedCalc.childBenefit, money);
    expect(summary.takeHome).toBeCloseTo(Math.max(0, expectedCalc.takeHome - expectedCalc.childBenefit), money);
    expect(summary.shares.childBenefitCharge).toBeCloseTo(
      summary.income > 0 ? Math.min(1, Math.max(0, summary.childBenefitCharge / summary.income)) : 0,
      9,
    );

    expect(sumField(summary.slices, s => s.incomeTax)).toBeCloseTo(summary.incomeTax, money);
    expect(sumField(summary.slices, s => s.nationalInsurance)).toBeCloseTo(summary.nationalInsurance, money);
    expect(sumField(summary.slices, s => s.studentLoan)).toBeCloseTo(summary.studentLoan, money);
    expect(sumField(summary.slices, s => s.childBenefitCharge)).toBeCloseTo(summary.childBenefitCharge, money);
    expect(sumField(summary.slices, s => s.pension)).toBeCloseTo(summary.pensionFromPay, money);
    expect(sumField(summary.slices, s => s.kept)).toBeCloseTo(summary.rawTakeHome, money);

    for (let idx = 0; idx < summary.slices.length; idx++) {
      const s = summary.slices[idx];
      expect(s.to).toBeGreaterThan(s.from);
      expect(s.gross).toBeCloseTo(s.to - s.from, 6);
      if (idx > 0) {
        expect(s.from).toBeCloseTo(summary.slices[idx - 1].to, 6);
      }
      expect(Number.isFinite(s.keptRate)).toBe(true);
      expect(s.keptRate).toBeCloseTo(s.kept / s.gross, 9);
      for (const r of [
        s.incomeTaxRate,
        s.nationalInsuranceRate,
        s.studentLoanRate,
        s.childBenefitChargeRate,
        s.pensionRate,
      ]) {
        expect(Number.isFinite(r)).toBe(true);
        expect(r).toBeGreaterThanOrEqual(0);
        expect(r).toBeLessThanOrEqual(1);
      }
      expect(s.childBenefitCharge).toBeGreaterThanOrEqual(0);
      expect(s.childBenefitChargeRate).toBeCloseTo(Math.min(1, Math.max(0, s.childBenefitCharge / s.gross)), 9);
    }
    return summary;
  };

  it('splits a basic rUK salary (£50,000, £60,000, £150,000) across exact thresholds and rates', () => {
    const s50 = assertSliceInvariants(input({ income: 50_000 }));
    expect(s50.slices.map(s => [s.from, s.to, s.kind])).toEqual([
      [0, 12_570, 'income'],
      [12_570, 50_000, 'income'],
    ]);
    expect(s50.slices[0].keptRate).toBe(1);
    expect(s50.slices[1].incomeTaxRate).toBeCloseTo(0.2, 6);
    expect(s50.slices[1].nationalInsuranceRate).toBeCloseTo(0.08, 6);
    expect(s50.slices[1].keptRate).toBeCloseTo(0.72, 6);

    const s60 = assertSliceInvariants(input({ income: 60_000 }));
    expect(s60.slices.map(s => [s.from, s.to])).toEqual([
      [0, 12_570],
      [12_570, 50_270],
      [50_270, 60_000],
    ]);
    expect(s60.slices[2].incomeTaxRate).toBeCloseTo(0.4, 6);
    expect(s60.slices[2].nationalInsuranceRate).toBeCloseTo(0.02, 6);
    expect(s60.slices[2].keptRate).toBeCloseTo(0.58, 6);

    const s150 = assertSliceInvariants(input({ income: 150_000 }));
    expect(s150.slices.map(s => [s.from, s.to])).toEqual([
      [0, 12_570],
      [12_570, 50_270],
      [50_270, 100_000],
      [100_000, 125_140],
      [125_140, 150_000],
    ]);
    expect(s150.slices[3].incomeTaxRate).toBeCloseTo(0.6, 6);
    expect(s150.slices[3].nationalInsuranceRate).toBeCloseTo(0.02, 6);
    expect(s150.slices[3].keptRate).toBeCloseTo(0.38, 6);
    expect(s150.slices[4].incomeTaxRate).toBeCloseTo(0.45, 6);
    expect(s150.slices[4].nationalInsuranceRate).toBeCloseTo(0.02, 6);
    expect(s150.slices[4].keptRate).toBeCloseTo(0.53, 6);
  });

  it('returns a single row when income stays within the personal allowance', () => {
    const s = assertSliceInvariants(input({ income: 10_000 }));
    expect(s.slices).toHaveLength(1);
    expect(s.slices[0].from).toBe(0);
    expect(s.slices[0].to).toBe(10_000);
    expect(s.slices[0].kept).toBe(10_000);
    expect(s.slices[0].keptRate).toBe(1);
  });

  it('splits across all six Scottish bands and NI thresholds', () => {
    const s = assertSliceInvariants(input({ income: 150_000, region: 'scotland' }));
    // Thresholds: 12,570 (PA + NI lower), 16,537 (19%->20%), 29,526 (20%->21%),
    // 43,662 (21%->42%), 50,270 (NI upper), 75,000 (42%->45%), 100,000 (taper start),
    // 125,140 (taper end & 45%->48%), 150,000.
    expect(s.slices.map(row => [row.from, row.to])).toEqual([
      [0, 12_570],
      [12_570, 16_537],
      [16_537, 29_526],
      [29_526, 43_662],
      [43_662, 50_270],
      [50_270, 75_000],
      [75_000, 100_000],
      [100_000, 125_140],
      [125_140, 150_000],
    ]);
    expect(s.slices[1].incomeTaxRate).toBeCloseTo(0.19, 6);
    expect(s.slices[2].incomeTaxRate).toBeCloseTo(0.2, 6);
    expect(s.slices[3].incomeTaxRate).toBeCloseTo(0.21, 6);
    expect(s.slices[4].incomeTaxRate).toBeCloseTo(0.42, 6);
    expect(s.slices[4].nationalInsuranceRate).toBeCloseTo(0.08, 6);
    expect(s.slices[5].incomeTaxRate).toBeCloseTo(0.42, 6);
    expect(s.slices[5].nationalInsuranceRate).toBeCloseTo(0.02, 6);
    expect(s.slices[6].incomeTaxRate).toBeCloseTo(0.45, 6);
    expect(s.slices[7].incomeTaxRate).toBeCloseTo(0.675, 6);
    expect(s.slices[8].incomeTaxRate).toBeCloseTo(0.48, 6);
  });

  it('splits at undergraduate (Plan 1/2/4/5) and postgraduate (£21,000) student loan thresholds', () => {
    const s = assertSliceInvariants(
      input({ income: 40_000, undergradPlan: 'plan2', postgradLoan: true }),
    );
    expect(s.slices.map(row => [row.from, row.to])).toEqual([
      [0, 12_570],
      [12_570, 21_000],
      [21_000, 29_385],
      [29_385, 40_000],
    ]);
    expect(s.slices[1].studentLoanRate).toBe(0);
    expect(s.slices[2].studentLoanRate).toBeCloseTo(0.06, 6);
    expect(s.slices[3].studentLoanRate).toBeCloseTo(0.15, 6);

    for (const [plan, threshold] of [
      ['plan1', 26_900],
      ['plan4', 33_795],
      ['plan5', 25_000],
    ] as const) {
      const res = assertSliceInvariants(input({ income: 40_000, undergradPlan: plan }));
      expect(res.slices.map(row => [row.from, row.to])).toEqual([
        [0, 12_570],
        [12_570, threshold],
        [threshold, 40_000],
      ]);
      expect(res.slices[2].studentLoanRate).toBeCloseTo(0.09, 6);
    }
  });

  it('handles pensions under salary-sacrifice, net-pay and relief-at-source, splitting pension across NI thresholds without blending', () => {
    // 1. Salary sacrifice: £60,000 with £15,000 sacrificed -> payEnd = £45,000, pension [45k, 60k] has 0 tax/NI/loan
    const sac = assertSliceInvariants(
      input({ income: 60_000, pensionContribution: 15_000, pensionMethod: 'salary-sacrifice' }),
    );
    expect(sac.slices.map(row => [row.from, row.to, row.kind])).toEqual([
      [0, 12_570, 'income'],
      [12_570, 45_000, 'income'],
      [45_000, 60_000, 'pension'],
    ]);
    expect(sac.slices[2].pensionRate).toBe(1);
    expect(sac.slices[2].incomeTaxRate).toBe(0);
    expect(sac.slices[2].nationalInsuranceRate).toBe(0);
    expect(sac.slices[2].kept).toBe(0);

    // 2. Net pay spanning £50,270 NI threshold: £60,000 with £15,000 pension -> pension splits at £50,270 into 8% and 2% NI
    const netPay = assertSliceInvariants(
      input({ income: 60_000, pensionContribution: 15_000, pensionMethod: 'net-pay' }),
    );
    expect(netPay.slices.map(row => [row.from, row.to, row.kind])).toEqual([
      [0, 12_570, 'income'],
      [12_570, 45_000, 'income'],
      [45_000, 50_270, 'pension'],
      [50_270, 60_000, 'pension'],
    ]);
    expect(netPay.slices[2].nationalInsuranceRate).toBeCloseTo(0.08, 6);
    expect(netPay.slices[3].nationalInsuranceRate).toBeCloseTo(0.02, 6);
    expect(netPay.slices[2].incomeTaxRate).toBe(0);
    expect(netPay.slices[3].incomeTaxRate).toBe(0);

    // 3. Relief at source spanning £50,270 NI threshold: £60,000 with £15,000 pension -> splits at £50,270 with 20% tax, 80% pensionFromPay, and 8% vs 2% NI
    const ras = assertSliceInvariants(
      input({ income: 60_000, pensionContribution: 15_000, pensionMethod: 'relief-at-source' }),
    );
    expect(ras.slices.map(row => [row.from, row.to, row.kind])).toEqual([
      [0, 12_570, 'income'],
      [12_570, 45_000, 'income'],
      [45_000, 50_270, 'pension'],
      [50_270, 60_000, 'pension'],
    ]);
    expect(ras.slices[2].pensionRate).toBeCloseTo(0.8, 6);
    expect(ras.slices[2].incomeTaxRate).toBeCloseTo(0.2, 6);
    expect(ras.slices[2].nationalInsuranceRate).toBeCloseTo(0.08, 6);
    expect(ras.slices[3].pensionRate).toBeCloseTo(0.8, 6);
    expect(ras.slices[3].incomeTaxRate).toBeCloseTo(0.2, 6);
    expect(ras.slices[3].nationalInsuranceRate).toBeCloseTo(0.02, 6);

    // 4. Relief at source in Scotland spanning the unextended 19% starter band ceiling (£12,570 + £3,967 = £16,537)
    const rasScot = assertSliceInvariants(
      input({ income: 20_000, region: 'scotland', pensionContribution: 6_000, pensionMethod: 'relief-at-source' }),
    );
    expect(rasScot.slices.map(row => [row.from, row.to, row.kind])).toEqual([
      [0, 12_570, 'income'],
      [12_570, 14_000, 'income'],
      [14_000, 16_537, 'pension'],
      [16_537, 20_000, 'pension'],
    ]);
    expect(rasScot.slices[2].incomeTaxRate).toBeCloseTo(0.19, 6);
    expect(rasScot.slices[3].incomeTaxRate).toBeCloseTo(0.2, 6);
  });

  it('splits benefits in kind across tax thresholds without blending rates', () => {
    // £50,000 salary + £1,000 BIK straddles £50,270 -> £270 at 20% and £730 at 40%
    const s = assertSliceInvariants(input({ income: 50_000, benefitsInKind: 1_000 }));
    expect(s.slices.map(row => [row.from, row.to, row.kind])).toEqual([
      [0, 12_570, 'income'],
      [12_570, 50_000, 'income'],
      [50_000, 50_270, 'benefit-in-kind'],
      [50_270, 51_000, 'benefit-in-kind'],
    ]);
    expect(s.slices[2].incomeTaxRate).toBeCloseTo(0.2, 6);
    expect(s.slices[2].incomeTax).toBeCloseTo(270 * 0.2, money);
    expect(s.slices[2].kept).toBeCloseTo(-54, money);
    expect(s.slices[2].keptRate).toBeCloseTo(-0.2, 6);
    expect(s.slices[3].incomeTaxRate).toBeCloseTo(0.4, 6);
    expect(s.slices[3].incomeTax).toBeCloseTo(730 * 0.4, money);
    expect(s.slices[3].kept).toBeCloseTo(-292, money);
    expect(s.slices[3].keptRate).toBeCloseTo(-0.4, 6);
  });

  it('retains negative pension cash impacts from NI and both student loans', () => {
    for (const pensionMethod of ['net-pay', 'relief-at-source'] as const) {
      const s = assertSliceInvariants(input({
        income: 60_000, pensionContribution: 15_000, pensionMethod,
        undergradPlan: 'plan2', postgradLoan: true,
      }));
      const pensionSlices = s.slices.filter(row => row.kind === 'pension');
      expect(pensionSlices[0].keptRate).toBeCloseTo(-0.23, 6);
      expect(pensionSlices[1].keptRate).toBeCloseTo(-0.17, 6);
      expect(sumField(pensionSlices, row => row.kept)).toBeCloseTo(-2866.2, money);
    }
  });

  it('reconciles cash and every deduction across regions, employment, pension methods, loans and custom allowances', () => {
    for (const region of ['rUK', 'scotland'] as const) {
      for (const kind of ['employed', 'self-employed'] as const) {
        for (const pensionMethod of ['salary-sacrifice', 'net-pay', 'relief-at-source'] as const) {
          for (const undergradPlan of ['none', 'plan1', 'plan2', 'plan4', 'plan5'] as const) {
            for (const personalAllowance of [0, 1000, 12_570, 20_000]) {
              for (const income of [0, 12_570.5, 50_270, 100_000, 125_140, 160_000]) {
                assertSliceInvariants(input({
                  region, kind, pensionMethod, undergradPlan, personalAllowance, income,
                  pensionContribution: income * 0.3, benefitsInKind: 12_000,
                  postgradLoan: true, marriageAllowance: true, children: 2, childcareSupport: 5000,
                }));
              }
            }
          }
        }
      }
    }
  });

  it('respects includePensionAndBenefits: false vs true', () => {
    const fullInput = input({
      income: 60_000,
      pensionContribution: 10_000,
      pensionMethod: 'salary-sacrifice',
      benefitsInKind: 5_000,
    });
    const withBoth = assertSliceInvariants(fullInput, { includePensionAndBenefits: true });
    const salaryOnly = assertSliceInvariants(fullInput, { includePensionAndBenefits: false });
    const plainSalary = assertSliceInvariants(input({ income: 60_000 }));

    expect(withBoth.pensionContribution).toBe(10_000);
    expect(withBoth.benefitsInKind).toBe(5_000);
    expect(withBoth.slices.some(s => s.kind === 'pension')).toBe(true);
    expect(withBoth.slices.some(s => s.kind === 'benefit-in-kind')).toBe(true);

    expect(salaryOnly.pensionContribution).toBe(0);
    expect(salaryOnly.benefitsInKind).toBe(0);
    expect(salaryOnly.slices.every(s => s.kind === 'income')).toBe(true);
    expect(salaryOnly).toEqual(plainSalary);
  });

  it('pins marriage allowance eligibility so no phantom £252 cliff or >100% rate appears on any slice', () => {
    // Eligible in rUK (£30,000 and £50,270): zero-tax zone up to £12,570 + £1,260 = £13,830
    const s30 = assertSliceInvariants(input({ income: 30_000, marriageAllowance: true }));
    expect(s30.slices.map(row => [row.from, row.to])).toEqual([
      [0, 12_570],
      [12_570, 13_830],
      [13_830, 30_000],
    ]);
    expect(s30.slices[1].incomeTaxRate).toBe(0);
    expect(s30.slices[1].nationalInsuranceRate).toBeCloseTo(0.08, 6);
    expect(s30.slices[2].incomeTaxRate).toBeCloseTo(0.2, 6);

    const s50270 = assertSliceInvariants(input({ income: 50_270, marriageAllowance: true }));
    expect(s50270.slices.map(row => [row.from, row.to])).toEqual([
      [0, 12_570],
      [12_570, 13_830],
      [13_830, 50_270],
    ]);

    // Ineligible above the cliff (£50,271 and £60,000 in rUK; £43,663 in Scotland)
    const s50271 = assertSliceInvariants(input({ income: 50_271, marriageAllowance: true }));
    // Sliver-row hardening merges the £1 slice [50,270, 50,271] cleanly, and pinned eligibility avoids a £252 spike
    for (const row of s50271.slices) {
      expect(row.incomeTaxRate).toBeLessThanOrEqual(0.45);
    }

    const s60 = assertSliceInvariants(input({ income: 60_000, marriageAllowance: true }));
    expect(s60.slices.map(row => [row.from, row.to])).toEqual([
      [0, 12_570],
      [12_570, 50_270],
      [50_270, 60_000],
    ]);
    expect(s60.slices[1].incomeTaxRate).toBeCloseTo(0.2, 6);
    expect(s60.slices[2].incomeTaxRate).toBeCloseTo(0.4, 6);

    const scotEligible = assertSliceInvariants(
      input({ income: 43_662, region: 'scotland', marriageAllowance: true }),
    );
    expect(scotEligible.slices[1].incomeTaxRate).toBe(0);
    expect(scotEligible.slices[2].incomeTaxRate).toBeCloseTo(0.19, 6);

    const scotIneligible = assertSliceInvariants(
      input({ income: 43_663, region: 'scotland', marriageAllowance: true }),
    );
    for (const row of scotIneligible.slices) {
      expect(row.incomeTaxRate).toBeLessThanOrEqual(0.45);
    }
  });

  it('hardens against sub-£1 sliver rows when an income or custom allowance lands within £1 of a threshold', () => {
    for (const probe of [
      input({ income: 12_570.4 }),
      input({ income: 50_270.2 }),
      input({ income: 100_000.5 }),
      input({ income: 50_000, personalAllowance: 12_569.5 }),
    ]) {
      const s = assertSliceInvariants(probe);
      for (const row of s.slices) {
        expect(row.gross).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('clamps takeHome, takeHomeRate and shares.takeHome to 0 when BIK tax exceeds cash pay, while preserving negative rawTakeHome', () => {
    const s = assertSliceInvariants(input({ income: 15_000, benefitsInKind: 100_000 }));
    expect(s.rawTakeHome).toBeLessThan(0);
    expect(s.takeHome).toBe(0);
    expect(s.takeHomeRate).toBe(0);
    expect(s.shares.takeHome).toBe(0);
    expect(s.shares.incomeTax).toBe(1);
  });

  it('returns empty slices and zero totals/shares without NaN for zero, negative and non-finite inputs', () => {
    for (const bad of [
      input({ income: 0 }),
      input({ income: -25_000, benefitsInKind: -1_000, pensionContribution: -500 }),
      input({
        income: Number.NaN,
        benefitsInKind: Number.POSITIVE_INFINITY,
        pensionContribution: Number.NEGATIVE_INFINITY,
      }),
    ]) {
      const s = assertSliceInvariants(bad);
      expect(s.income).toBe(0);
      expect(s.slices).toEqual([]);
      expect(s.takeHome).toBe(0);
      expect(s.rawTakeHome).toBe(0);
      expect(s.takeHomeRate).toBe(0);
      expect(s.totalDeductions).toBe(0);
      expect(s.shares).toEqual({
        takeHome: 0,
        pension: 0,
        incomeTax: 0,
        nationalInsurance: 0,
        studentLoan: 0,
        childBenefitCharge: 0,
      });
      expect(s.childBenefitCharge).toBe(0);
      expect(s.childBenefit).toBe(0);
    }
  });

  describe('the High Income Child Benefit Charge', () => {
    // 1 child: 27.05 x 53 = 1,433.65. 2 children: (27.05 + 17.9) x 53 = 2,382.35.
    const oneChild = 1_433.65;
    const twoChildren = 2_382.35;
    const slicesOf = (s: ReturnType<typeof ukTakeHomeBySlice>, kind: UkPaySlice['kind']) =>
      s.slices.filter(row => row.kind === kind);

    it('charges £72,000, 2 children, plan 2 and £3,600 net pay 42% of the benefit, in the slice from £60,000', () => {
      const s = assertSliceInvariants(
        input({
          income: 72_000,
          children: 2,
          undergradPlan: 'plan2',
          pensionContribution: 3_600,
          pensionMethod: 'net-pay',
        }),
      );
      // Adjusted net income is £68,400: 42 complete £200 steps above £60,000.
      expect(s.childBenefit).toBeCloseTo(twoChildren, money);
      expect(s.childBenefitCharge).toBeCloseTo(twoChildren * 0.42, money);
      expect(s.childBenefitCharge).toBeCloseTo(1_000.587, money);
      expect(s.rawTakeHome).toBeCloseTo(45_321.46, 2);
      expect(s.totalDeductions).toBeCloseTo(72_000 - s.rawTakeHome, money);

      expect(s.slices.map(row => [row.from, row.to, row.kind])).toEqual([
        [0, 12_570, 'income'],
        [12_570, 29_385, 'income'],
        [29_385, 50_270, 'income'],
        [50_270, 60_000, 'income'],
        [60_000, 68_400, 'income'],
        [68_400, 72_000, 'pension'],
      ]);
      const above = s.slices[4];
      expect(above.childBenefitCharge).toBeCloseTo(1_000.587, money);
      expect(above.childBenefitChargeRate).toBeCloseTo(1_000.587 / 8_400, 6);
      // 40% tax + 2% NI + 9% loan + the charge, averaged over the slice.
      expect(above.keptRate).toBeCloseTo(1 - 0.4 - 0.02 - 0.09 - 1_000.587 / 8_400, 6);

      for (const row of [...s.slices.slice(0, 4), ...slicesOf(s, 'pension')]) {
        expect(row.childBenefitCharge).toBe(0);
        expect(row.childBenefitChargeRate).toBe(0);
      }
      expect(s.shares.childBenefitCharge).toBeCloseTo(1_000.587 / 72_000, 9);
      const shareTotal =
        s.shares.takeHome +
        s.shares.pension +
        s.shares.incomeTax +
        s.shares.nationalInsurance +
        s.shares.studentLoan +
        s.shares.childBenefitCharge;
      expect(shareTotal).toBeCloseTo(1, 9);
    });

    it('matches the figure the old card was missing: kept is calculateUkTax take-home less the benefit', () => {
      const i = input({
        income: 72_000,
        children: 2,
        undergradPlan: 'plan2',
        pensionContribution: 3_600,
        pensionMethod: 'net-pay',
      });
      const s = ukTakeHomeBySlice(i);
      const withoutChildren = calculateUkTax({ ...i, children: 0 });
      // The old card read £46,322.05: the charge was the whole difference.
      expect(withoutChildren.takeHome).toBeCloseTo(46_322.05, 2);
      expect(s.rawTakeHome).toBeCloseTo(withoutChildren.takeHome - s.childBenefitCharge, money);
      expect(s.rawTakeHome).toBeCloseTo(calculateUkTax(i).takeHome - s.childBenefit, money);
    });

    it('keeps the charge when pension and benefits are excluded', () => {
      const s = assertSliceInvariants(
        input({
          income: 72_000,
          children: 2,
          pensionContribution: 3_600,
          pensionMethod: 'net-pay',
          benefitsInKind: 2_000,
        }),
        { includePensionAndBenefits: false },
      );
      // Adjusted net income is the £72,000 salary: 60 steps, 60% of the benefit.
      expect(s.childBenefitCharge).toBeCloseTo(twoChildren * 0.6, money);
      expect(s.childBenefit).toBeCloseTo(twoChildren, money);
      expect(s.slices.every(row => row.kind === 'income')).toBe(true);
      expect(s.slices.map(row => [row.from, row.to])).toContainEqual([60_000, 72_000]);
    });

    it('splits at £60,000 and £80,000 and puts the whole benefit in the slice between them', () => {
      const s = assertSliceInvariants(input({ income: 90_000, children: 2 }));
      expect(s.slices.map(row => [row.from, row.to])).toEqual([
        [0, 12_570],
        [12_570, 50_270],
        [50_270, 60_000],
        [60_000, 80_000],
        [80_000, 90_000],
      ]);
      expect(s.slices[3].childBenefitCharge).toBeCloseTo(twoChildren, money);
      expect(s.slices[3].childBenefitChargeRate).toBeCloseTo(twoChildren / 20_000, 6);
      expect(s.slices[4].childBenefitCharge).toBe(0);
      expect(s.childBenefitCharge).toBeCloseTo(twoChildren, money);
      // Past £80,000 the benefit is repaid in full: pay is down by all of it, and the
      // benefit received beside pay brings the household back to the childless figure.
      expect(s.rawTakeHome).toBeCloseTo(calculateUkTax(input({ income: 90_000 })).takeHome - twoChildren, money);
      expect(s.rawTakeHome + s.childBenefit).toBeCloseTo(calculateUkTax(input({ income: 90_000 })).takeHome, money);
    });

    it('splits benefits in kind at £60,000 of total income, and the upper slice carries the steps', () => {
      const s = assertSliceInvariants(input({ income: 59_000, benefitsInKind: 3_000, children: 1 }));
      const bik = slicesOf(s, 'benefit-in-kind');
      expect(bik.map(row => [row.from, row.to])).toEqual([
        [59_000, 60_000],
        [60_000, 62_000],
      ]);
      // Adjusted net income reaches £62,000: 10 complete £200 steps, 10% of £1,433.65.
      expect(bik[0].childBenefitCharge).toBe(0);
      expect(bik[1].childBenefitCharge).toBeCloseTo(0.1 * oneChild, money);
      expect(bik[1].childBenefitCharge).toBeCloseTo(143.365, money);
      expect(s.childBenefitCharge).toBeCloseTo(143.365, money);
      expect(s.childBenefit).toBeCloseTo(oneChild, money);
      // 40% BIK tax plus the charge, on £2,000.
      expect(bik[1].keptRate).toBeCloseTo(-0.4 - 143.365 / 2_000, 6);
    });

    it('places the benefit-in-kind split under relief at source at £60,000 of adjusted net income', () => {
      // Relief at source does not reduce pay, so pay is £54,000 and adjusted
      // net income is 54,000 + b - 4,000 = 50,000 + b. The £60,000 line is
      // b = 10,000, a slice boundary at 54,000 + 10,000 = £64,000.
      const s = assertSliceInvariants(
        input({
          income: 54_000,
          benefitsInKind: 16_000,
          children: 1,
          pensionContribution: 4_000,
          pensionMethod: 'relief-at-source',
        }),
      );
      const bik = slicesOf(s, 'benefit-in-kind');
      expect(bik.map(row => [row.from, row.to])).toEqual([
        [54_000, 54_270],
        [54_270, 64_000],
        [64_000, 70_000],
      ]);
      expect(bik[0].childBenefitCharge).toBe(0);
      expect(bik[1].childBenefitCharge).toBe(0);
      // Adjusted net income reaches £66,000: 30 complete £200 steps, 30% of £1,433.65.
      expect(bik[2].childBenefitCharge).toBeCloseTo(0.3 * oneChild, money);
      expect(s.childBenefitCharge).toBeCloseTo(0.3 * oneChild, money);
    });

    it('charges £70,000 with £6,000 relief at source on adjusted net income of £64,000, in the salary slice', () => {
      const s = assertSliceInvariants(
        input({
          income: 70_000,
          children: 1,
          pensionContribution: 6_000,
          pensionMethod: 'relief-at-source',
        }),
      );
      // 20 complete £200 steps above £60,000: 20% of £1,433.65.
      expect(s.childBenefitCharge).toBeCloseTo(0.2 * oneChild, money);
      expect(s.childBenefitCharge).toBeCloseTo(286.73, money);
      const salary = s.slices.find(row => row.from === 60_000);
      expect(salary).toBeDefined();
      expect(salary?.to).toBe(64_000);
      expect(salary?.kind).toBe('income');
      expect(salary?.childBenefitCharge).toBeCloseTo(286.73, money);
      for (const row of slicesOf(s, 'pension')) {
        expect(row.childBenefitCharge).toBe(0);
        expect(row.childBenefitChargeRate).toBe(0);
      }
      expect(slicesOf(s, 'pension').length).toBeGreaterThan(0);
    });

    it('holds adjusted net income flat across the pension slices for every method', () => {
      for (const pensionMethod of ['salary-sacrifice', 'net-pay', 'relief-at-source'] as const) {
        const s = assertSliceInvariants(
          input({ income: 75_000, children: 3, pensionContribution: 12_000, pensionMethod }),
        );
        // Adjusted net income is £63,000 whatever the method, so all of the charge is on salary.
        expect(s.childBenefitCharge).toBeCloseTo(calculateUkTax(input({
          income: 75_000, children: 3, pensionContribution: 12_000, pensionMethod,
        })).childBenefitCharge, money);
        expect(sumField(slicesOf(s, 'pension'), row => row.childBenefitCharge)).toBe(0);
        expect(sumField(slicesOf(s, 'income'), row => row.childBenefitCharge)).toBeCloseTo(s.childBenefitCharge, money);
      }
    });

    it('lets a slice narrower than a £200 step carry the whole step while its rate clamps to 1', () => {
      // Adjusted net income crosses £60,200 inside a £10 benefit slice: 1% of £1,433.65 is £14.34 on £10.
      const s = assertSliceInvariants(input({ income: 60_195, benefitsInKind: 10, children: 1 }));
      const bik = slicesOf(s, 'benefit-in-kind');
      expect(bik).toHaveLength(1);
      expect(bik[0].gross).toBe(10);
      expect(bik[0].childBenefitCharge).toBeCloseTo(0.01 * oneChild, money);
      expect(bik[0].childBenefitCharge).toBeGreaterThan(bik[0].gross);
      expect(bik[0].childBenefitChargeRate).toBe(1);
      expect(bik[0].kept).toBeCloseTo(-(10 * 0.4 + 0.01 * oneChild), money);
    });

    it('reports the benefit and no charge below £60,000, and does not split there', () => {
      const s = assertSliceInvariants(input({ income: 50_000, children: 2 }));
      expect(s.childBenefit).toBeCloseTo(twoChildren, money);
      expect(s.childBenefitCharge).toBe(0);
      expect(s.shares.childBenefitCharge).toBe(0);
      expect(s.slices.map(row => [row.from, row.to])).toEqual([
        [0, 12_570],
        [12_570, 50_000],
      ]);
      expect(s.rawTakeHome).toBeCloseTo(calculateUkTax(input({ income: 50_000 })).takeHome, money);
    });

    it('is exactly at the threshold, not over it, at £60,000 adjusted net income', () => {
      const s = assertSliceInvariants(input({ income: 60_000, children: 2 }));
      expect(s.childBenefitCharge).toBe(0);
      expect(s.slices.map(row => [row.from, row.to])).toEqual([
        [0, 12_570],
        [12_570, 50_270],
        [50_270, 60_000],
      ]);
    });

    it('never reports a negative charge on a slice, including a BIK slice that stops just short of a step', () => {
      const s = assertSliceInvariants(input({ income: 60_199, benefitsInKind: 2, children: 1 }));
      expect(s.childBenefitCharge).toBeCloseTo(0.01 * oneChild, money);
      for (const row of s.slices) {
        expect(row.childBenefitCharge).toBeGreaterThanOrEqual(0);
      }
    });

    it('sanitises the number of children as calculateUkTax does', () => {
      for (const children of [-3, Number.NaN, 0.9]) {
        const s = assertSliceInvariants(input({ income: 72_000, children }));
        expect(s.childBenefit).toBe(0);
        expect(s.childBenefitCharge).toBe(0);
        expect(s.slices.map(row => row.from)).not.toContain(60_000);
      }
      const frac = assertSliceInvariants(input({ income: 72_000, children: 2.9 }));
      expect(frac.childBenefit).toBeCloseTo(twoChildren, money);
    });

    it('ignores childcare support entirely', () => {
      const without = ukTakeHomeBySlice(input({ income: 110_000, children: 2 }));
      const withSupport = ukTakeHomeBySlice(input({ income: 110_000, children: 2, childcareSupport: 8_000 }));
      expect(withSupport).toEqual(without);
    });

    it('with no children, every charge and rate is 0 and every other figure is unchanged', () => {
      for (const income of [60_000, 72_000, 150_000]) {
        const s = assertSliceInvariants(input({ income, undergradPlan: 'plan2' }));
        expect(s.childBenefitCharge).toBe(0);
        expect(s.childBenefit).toBe(0);
        expect(s.shares.childBenefitCharge).toBe(0);
        for (const row of s.slices) {
          expect(row.childBenefitCharge).toBe(0);
          expect(row.childBenefitChargeRate).toBe(0);
        }
        expect(s.rawTakeHome).toBeCloseTo(calculateUkTax(input({ income, undergradPlan: 'plan2' })).takeHome, money);
      }

      // Two of the pre-existing expectations, re-asserted: no £60,000 or £80,000 split appears.
      const s60 = ukTakeHomeBySlice(input({ income: 60_000 }));
      expect(s60.slices.map(row => [row.from, row.to])).toEqual([
        [0, 12_570],
        [12_570, 50_270],
        [50_270, 60_000],
      ]);
      expect(s60.slices[2].keptRate).toBeCloseTo(0.58, 6);

      const s150 = ukTakeHomeBySlice(input({ income: 150_000 }));
      expect(s150.slices.map(row => [row.from, row.to])).toEqual([
        [0, 12_570],
        [12_570, 50_270],
        [50_270, 100_000],
        [100_000, 125_140],
        [125_140, 150_000],
      ]);
      expect(s150.slices[3].keptRate).toBeCloseTo(0.38, 6);

      // The summary totals equal calculateUkTax's, with nothing added for the charge.
      expect(s150.totalDeductions).toBeCloseTo(
        s150.pensionFromPay + s150.incomeTax + s150.nationalInsurance + s150.studentLoan,
        money,
      );
    });
  });
});

describe('ukMarginalBands', () => {
  const maxIncome = 200_000;
  const scenario = input({
    income: 55000,
    pensionContribution: 2750,
    pensionMethod: 'net-pay',
    undergradPlan: 'plan2',
  });
  const bands = (over: Partial<UkTaxInput>, max = maxIncome): UkMarginalBand[] =>
    ukMarginalBands(input(over), { maxIncome: max });
  const edges = (list: UkMarginalBand[]): number[] => [...list.map(b => b.from), list[list.length - 1].to];
  const expectEdges = (list: UkMarginalBand[], expected: number[]): void => {
    expect(list).toHaveLength(expected.length - 1);
    edges(list).forEach((edge, i) => expect(edge).toBeCloseTo(expected[i], 6));
  };
  const expectRates = (
    band: UkMarginalBand,
    expected: Partial<Omit<UkMarginalRates, 'total'>>,
  ): void => {
    const full = {
      incomeTax: 0,
      nationalInsurance: 0,
      studentLoan: 0,
      postgradLoan: 0,
      childBenefitCharge: 0,
      ...expected,
    };
    expect(band.incomeTax).toBeCloseTo(full.incomeTax, 9);
    expect(band.nationalInsurance).toBeCloseTo(full.nationalInsurance, 9);
    expect(band.studentLoan).toBeCloseTo(full.studentLoan, 9);
    expect(band.postgradLoan).toBeCloseTo(full.postgradLoan, 9);
    expect(band.childBenefitCharge).toBeCloseTo(full.childBenefitCharge, 9);
    expect(band.total).toBeCloseTo(
      full.incomeTax + full.nationalInsurance + full.studentLoan + full.postgradLoan + full.childBenefitCharge,
      9,
    );
  };

  describe('the worked scenario', () => {
    // rUK employee, £2,750 net pay, plan 2, nothing else, up to £200,000.
    const list = ukMarginalBands(scenario, { maxIncome });

    it('has exactly the eight bands, at the right edges', () => {
      expectEdges(list, [0, 12570, 15320, 29385, 50270, 53020, 102750, 127890, 200000]);
    });

    it('has the right rates in each', () => {
      expectRates(list[0], {});
      expectRates(list[1], { nationalInsurance: 0.08 });
      expectRates(list[2], { incomeTax: 0.2, nationalInsurance: 0.08 });
      expectRates(list[3], { incomeTax: 0.2, nationalInsurance: 0.08, studentLoan: 0.09 });
      expectRates(list[4], { incomeTax: 0.2, nationalInsurance: 0.02, studentLoan: 0.09 });
      expectRates(list[5], { incomeTax: 0.4, nationalInsurance: 0.02, studentLoan: 0.09 });
      expectRates(list[6], { incomeTax: 0.6, nationalInsurance: 0.02, studentLoan: 0.09 });
      expectRates(list[7], { incomeTax: 0.45, nationalInsurance: 0.02, studentLoan: 0.09 });
      expect(list[0].total).toBeCloseTo(0, 9);
      expect(list[3].total).toBeCloseTo(0.37, 9);
      expect(list[4].total).toBeCloseTo(0.31, 9);
    });

    it('names the income tax band of each, and none where no income tax is paid', () => {
      expect(list.map(b => b.incomeTaxBand)).toEqual([
        null,
        null,
        'basic',
        'basic',
        'basic',
        'higher',
        'higher',
        'additional',
      ]);
    });

    it('flags the allowance taper only from £102,750 to £127,890, where the 40% band reads 60%', () => {
      expect(list.map(b => b.allowanceTapering)).toEqual([false, false, false, false, false, false, true, false]);
      expect(list[6].from).toBeCloseTo(102750, 6);
      expect(list[6].to).toBeCloseTo(127890, 6);
      expect(list[6].incomeTax).toBeCloseTo(0.4 * (1 + UK_ALLOWANCE_TAPER_RATE), 9);
    });

    it('does not depend on the income the input happens to carry', () => {
      expect(ukMarginalBands({ ...scenario, income: 0 }, { maxIncome })).toEqual(list);
      expect(ukMarginalBands({ ...scenario, income: 180000 }, { maxIncome })).toEqual(list);
    });

    it('explains the line ukTaxCurve draws', () => {
      const curve = ukTaxCurve(scenario, { maxIncome, step: 500 });
      for (const point of curve) {
        const band = list.find(b => b.from <= point.income && point.income < b.to);
        if (band === undefined || band.to - point.income <= 1.01) continue;
        expect(point.marginalRate).toBeCloseTo(band.total, 9);
      }
    });
  });

  describe('where the edges come from', () => {
    it('keeps a small pension\'s narrow band: net pay of £300 holds the 2% NI dip from £50,270 to £50,570', () => {
      const list = bands({ income: 55000, pensionContribution: 300, pensionMethod: 'net-pay' });
      expectEdges(list, [0, 12570, 12870, 50270, 50570, 100300, 125440, 200000]);
      expectRates(list[3], { incomeTax: 0.2, nationalInsurance: 0.02 });
      expectRates(list[4], { incomeTax: 0.4, nationalInsurance: 0.02 });
    });

    it('moves NI, loan and tax thresholds up by a salary sacrifice, which is off pay for NI too', () => {
      const list = bands({ pensionContribution: 5000, pensionMethod: 'salary-sacrifice', undergradPlan: 'plan2' });
      expectEdges(list, [0, 17570, 34385, 55270, 105000, 130140, 200000]);
      expectRates(list[1], { incomeTax: 0.2, nationalInsurance: 0.08 });
      expectRates(list[2], { incomeTax: 0.2, nationalInsurance: 0.08, studentLoan: 0.09 });
    });

    it('moves only the tax thresholds under net pay: NI and loans are still on the full income', () => {
      const list = bands({ pensionContribution: 5000, pensionMethod: 'net-pay', undergradPlan: 'plan2' });
      expectEdges(list, [0, 12570, 17570, 29385, 50270, 55270, 105000, 130140, 200000]);
      expectRates(list[1], { nationalInsurance: 0.08 });
    });

    it('stretches the bands and the taper start under relief at source, and leaves NI alone', () => {
      const list = bands({ pensionContribution: 4000, pensionMethod: 'relief-at-source' });
      expectEdges(list, [0, 12570, 50270, 54270, 104000, 129140, 200000]);
      expectRates(list[2], { incomeTax: 0.2, nationalInsurance: 0.02 });
      expectRates(list[3], { incomeTax: 0.4, nationalInsurance: 0.02 });
    });

    it('moves tax down by benefits in kind and leaves NI where it is', () => {
      const list = bands({ benefitsInKind: 10000 });
      expectEdges(list, [0, 2570, 12570, 40270, 50270, 90000, 115140, 200000]);
      expectRates(list[1], { incomeTax: 0.2 });
      expectRates(list[2], { incomeTax: 0.2, nationalInsurance: 0.08 });
    });

    it('uses Class 4 for a sole trader, who has no benefits in kind and cannot sacrifice', () => {
      const plain = bands({ kind: 'self-employed' });
      expectEdges(plain, [0, 12570, 50270, 100000, 125140, 200000]);
      expectRates(plain[1], { incomeTax: 0.2, nationalInsurance: 0.06 });
      expectRates(plain[2], { incomeTax: 0.4, nationalInsurance: 0.02 });
      const ignored = bands({ kind: 'self-employed', benefitsInKind: 10000, pensionMethod: 'salary-sacrifice' });
      expect(ignored).toEqual(plain);
    });

    it('follows the Scottish bands, with the 19% starter and the 42% and 45% steps', () => {
      const list = bands({ region: 'scotland' });
      expectEdges(list, [0, 12570, 16537, 29526, 43662, 50270, 75000, 100000, 125140, 200000]);
      expect(list.map(b => b.incomeTax)).toEqual([
        expect.closeTo(0, 9),
        expect.closeTo(0.19, 9),
        expect.closeTo(0.2, 9),
        expect.closeTo(0.21, 9),
        expect.closeTo(0.42, 9),
        expect.closeTo(0.42, 9),
        expect.closeTo(0.45, 9),
        expect.closeTo(0.675, 9),
        expect.closeTo(0.48, 9),
      ]);
    });

    it('puts the child benefit charge in the same £60,000-£80,000 as ukChildBenefitBand', () => {
      const i = input({ children: 2 });
      const list = ukMarginalBands(i, { maxIncome });
      const charged = list.filter(b => b.childBenefitCharge > 0);
      const band = ukChildBenefitBand(i);
      expect(band).not.toBeNull();
      expect(charged).toHaveLength(1);
      expect(charged[0].from).toBeCloseTo(band!.from, 6);
      expect(charged[0].to).toBeCloseTo(band!.to, 6);
      // £27.05 + £17.90 a week over 53 weeks, spread over the £20,000 range.
      expect(charged[0].childBenefitCharge).toBeCloseTo(((27.05 + 17.9) * 53) / 20000, 9);
    });

    it('moves the child benefit band with the pension and benefits in kind, as ukChildBenefitBand does', () => {
      for (const over of [
        { pensionContribution: 5000, pensionMethod: 'salary-sacrifice' as const },
        { pensionContribution: 5000, pensionMethod: 'relief-at-source' as const },
        { benefitsInKind: 8000 },
      ]) {
        const i = input({ children: 2, ...over });
        const charged = ukMarginalBands(i, { maxIncome }).filter(b => b.childBenefitCharge > 0);
        const band = ukChildBenefitBand(i)!;
        expect(charged[0].from).toBeCloseTo(band.from, 6);
        expect(charged[charged.length - 1].to).toBeCloseTo(band.to, 6);
      }
    });

    it('ends marriage allowance\'s absorbing of tax where tax before relief reaches £252', () => {
      const list = bands({ marriageAllowance: true }, 40000);
      expectEdges(list, [0, 12570, 13830, 40000]);
      expectRates(list[1], { nationalInsurance: 0.08 });
      expectRates(list[2], { incomeTax: 0.2, nationalInsurance: 0.08 });
    });

    it('starts tax at zero income for a stated allowance of nil', () => {
      const list = bands({ personalAllowance: 0 }, 40000);
      expectEdges(list, [0, 12570, 37700, 40000]);
      expectRates(list[0], { incomeTax: 0.2 });
      expectRates(list[2], { incomeTax: 0.4, nationalInsurance: 0.08 });
    });

    it('adds both loans at their own thresholds', () => {
      const list = bands({ undergradPlan: 'plan1', postgradLoan: true }, 40000);
      expectEdges(list, [0, 12570, 21000, 26900, 40000]);
      expectRates(list[2], { incomeTax: 0.2, nationalInsurance: 0.08, postgradLoan: 0.06 });
      expectRates(list[3], { incomeTax: 0.2, nationalInsurance: 0.08, studentLoan: 0.09, postgradLoan: 0.06 });
    });

    it('finds the Scottish starter band crossing under relief at source when a very large stated allowance is tapered by benefits in kind', () => {
      // Adjusted net income is the benefits in kind (£101,000) for as long as the
      // pension is still being made, so the allowance in force is the tapered
      // £98,500, not the £99,000 stated: a case the totals-based thresholds miss.
      const i = input({
        region: 'scotland',
        benefitsInKind: 101000,
        pensionContribution: 200000,
        pensionMethod: 'relief-at-source',
        personalAllowance: 99000,
      });
      const list = ukMarginalBands(i, { maxIncome: 20000 });
      expect(list.map(b => b.from)).toContain(1467);
      expect(bandMismatches(i, list, steppedIncomes(7.7))).toEqual([]);
    });
  });

  describe('the income tax band and the allowance taper of each band', () => {
    const names = (list: UkMarginalBand[]): Array<UkIncomeTaxBandName | null> => list.map(b => b.incomeTaxBand);
    const tapering = (list: UkMarginalBand[]): boolean[] => list.map(b => b.allowanceTapering);

    it('walks the rUK bands for a plain input, with the taper inside the 40% band', () => {
      const list = bands({});
      expectEdges(list, [0, 12570, 50270, 100000, 125140, 200000]);
      expect(names(list)).toEqual([null, 'basic', 'higher', 'higher', 'additional']);
      expect(tapering(list)).toEqual([false, false, false, true, false]);
    });

    it('names the Scottish bands in order, and shows the starter band that rUK does not have', () => {
      const list = bands({ region: 'scotland' });
      expect(names(list)).toEqual([
        null,
        'starter',
        'basic',
        'intermediate',
        'higher',
        'higher',
        'advanced',
        'advanced',
        'top',
      ]);
      const inOrder = names(list).filter((name, n, all) => name !== null && all.indexOf(name) === n);
      expect(inOrder).toEqual(['starter', 'basic', 'intermediate', 'higher', 'advanced', 'top']);
      expect(list[1].from).toBeCloseTo(12570, 6);
      expect(list[1].to).toBeCloseTo(16537, 6);
      expect(list[1].incomeTax).toBeCloseTo(0.19, 9);
      // The taper falls in the advanced band and stops where the top band starts.
      expect(tapering(list)).toEqual([false, false, false, false, false, false, false, true, false]);
      expect(list[7].incomeTax).toBeCloseTo(0.45 * (1 + UK_ALLOWANCE_TAPER_RATE), 9);
    });

    it('never names a Scottish-only band for rUK, nor the additional band for Scotland', () => {
      const uk = new Set(names(bands({})));
      const scot = new Set(names(bands({ region: 'scotland' })));
      for (const name of ['starter', 'intermediate', 'advanced', 'top'] as const) expect(uk.has(name)).toBe(false);
      expect(scot.has('additional')).toBe(false);
    });

    it('has no band while marriage allowance relief still absorbs the tax, then names basic', () => {
      const list = bands({ marriageAllowance: true }, 40000);
      expectEdges(list, [0, 12570, 13830, 40000]);
      expect(names(list)).toEqual([null, null, 'basic']);
      expect(list[1].incomeTax).toBeCloseTo(0, 9);
      // Without it there is no second null band.
      expect(names(bands({}, 40000))).toEqual([null, 'basic']);
    });

    it('has the relief absorbed inside the Scottish starter band, so the band after it is the starter', () => {
      const list = bands({ region: 'scotland', marriageAllowance: true }, 20000);
      expect(names(list).slice(0, 3)).toEqual([null, null, 'starter']);
      // £252 of relief at 19% is gone after £1,326.32 of taxable income.
      expect(list[2].from).toBeCloseTo(12570 + 252 / 0.19, 6);
    });

    it('reads the band whose extended range holds the taxable income under relief at source', () => {
      const list = bands({ pensionContribution: 4000, pensionMethod: 'relief-at-source' });
      expectEdges(list, [0, 12570, 50270, 54270, 104000, 129140, 200000]);
      // The £50,270 NI edge is still inside the 20% band, which now runs to £54,270.
      expect(names(list)).toEqual([null, 'basic', 'basic', 'higher', 'higher', 'additional']);
      expect(tapering(list)).toEqual([false, false, false, false, true, false]);
    });

    it('stretches Scotland\'s basic band under relief at source, and not its starter band', () => {
      const list = bands({ region: 'scotland', pensionContribution: 4000, pensionMethod: 'relief-at-source' });
      const startOf = (name: UkIncomeTaxBandName): number => list.find(b => b.incomeTaxBand === name)!.from;
      expect(startOf('starter')).toBeCloseTo(12570, 6);
      expect(startOf('basic')).toBeCloseTo(12570 + 3967, 6);
      expect(startOf('intermediate')).toBeCloseTo(12570 + 16956 + 4000, 6);
    });

    it('puts additional-rate income inside the taper when a stated allowance of £15,000 pushes it there', () => {
      const list = bands({ personalAllowance: 15000 });
      expectEdges(list, [0, 12570, 15000, 50270, 52700, 100000, 126760, 130000, 200000]);
      const inTaper = list.filter(b => b.allowanceTapering);
      expect(inTaper.map(b => b.incomeTaxBand)).toEqual(['higher', 'additional']);
      expect(inTaper[1].from).toBeCloseTo(126760, 6);
      expect(inTaper[1].to).toBeCloseTo(130000, 6);
      expect(inTaper[1].incomeTax).toBeCloseTo(0.45 * (1 + UK_ALLOWANCE_TAPER_RATE), 9);
      // Once the allowance has all gone the 45% is no longer stretched.
      expect(list[list.length - 1].incomeTaxBand).toBe('additional');
      expect(list[list.length - 1].allowanceTapering).toBe(false);
      expect(list[list.length - 1].incomeTax).toBeCloseTo(0.45, 9);
    });

    it('starts the basic band at £0 and never tapers for a stated allowance of nil', () => {
      const list = bands({ personalAllowance: 0 });
      expect(names(list)[0]).toBe('basic');
      expect(list[0].from).toBe(0);
      expect(list.some(b => b.allowanceTapering)).toBe(false);
      expect(names(bands({ personalAllowance: 0 }, 40000))).toEqual(['basic', 'basic', 'higher']);
    });

    it('moves the taper and the bands with benefits in kind, which are taxed as income', () => {
      const list = bands({ benefitsInKind: 10000 });
      expectEdges(list, [0, 2570, 12570, 40270, 50270, 90000, 115140, 200000]);
      expect(names(list)).toEqual([null, 'basic', 'basic', 'higher', 'higher', 'higher', 'additional']);
      expect(tapering(list)).toEqual([false, false, false, false, false, true, false]);
    });

    it('is the same for a sole trader as for an employee with the same income tax position', () => {
      expect(names(bands({ kind: 'self-employed' }))).toEqual(names(bands({})));
      expect(tapering(bands({ kind: 'self-employed' }))).toEqual(tapering(bands({})));
    });

    it('explains every band: a tapering one reads its band rate times 1.5, any other its band rate', () => {
      const statutory: Record<string, Record<string, number>> = {
        rUK: { basic: 0.2, higher: 0.4, additional: 0.45 },
        scotland: { starter: 0.19, basic: 0.2, intermediate: 0.21, higher: 0.42, advanced: 0.45, top: 0.48 },
      };
      for (const region of ['rUK', 'scotland'] as const) {
        for (const over of [{}, { personalAllowance: 15000 }, { pensionContribution: 4000, pensionMethod: 'relief-at-source' as const }]) {
          for (const b of bands({ region, ...over })) {
            if (b.incomeTaxBand === null) {
              expect(b.incomeTax).toBeCloseTo(0, 9);
            } else {
              const stretch = b.allowanceTapering ? 1 + UK_ALLOWANCE_TAPER_RATE : 1;
              expect(b.incomeTax).toBeCloseTo(statutory[region][b.incomeTaxBand] * stretch, 9);
            }
          }
        }
      }
    });
  });

  describe('the shape of the answer', () => {
    it('returns nothing for a zero, negative or non-finite maximum', () => {
      for (const max of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
        expect(ukMarginalBands(scenario, { maxIncome: max })).toEqual([]);
      }
    });

    it('is a single band when nothing changes before the maximum', () => {
      const list = bands({}, 10000);
      expect(list).toEqual([
        {
          from: 0,
          to: 10000,
          ...ukMarginalRates(input({ income: 5000 })),
          incomeTaxBand: null,
          allowanceTapering: false,
        },
      ]);
    });

    it('is a single band when the maximum is smaller than a pound', () => {
      const list = bands({}, 0.5);
      expect(list).toHaveLength(1);
      expect(list[0].from).toBe(0);
      expect(list[0].to).toBe(0.5);
    });

    it('ends exactly at the maximum, whichever it is', () => {
      for (const max of [1, 12570, 12570.4, 50000, 60000.5, 200000, 1_000_000]) {
        const list = bands({ undergradPlan: 'plan2', pensionContribution: 3000, pensionMethod: 'net-pay' }, max);
        expect(list[0].from).toBe(0);
        expect(list[list.length - 1].to).toBe(max);
      }
    });

    it('cuts short at the maximum: no band, and no edge, lies beyond it', () => {
      const list = bands({ undergradPlan: 'plan2' }, 20000);
      expectEdges(list, [0, 12570, 20000]);
    });

    it('never has a negative, NaN or non-finite number in it, whatever the input', () => {
      const hostile: Array<Partial<UkTaxInput>> = [
        {},
        { pensionContribution: Number.NaN, benefitsInKind: Number.POSITIVE_INFINITY, children: Number.NaN },
        { pensionContribution: -5000, benefitsInKind: -1, children: -3, personalAllowance: -100 },
        { income: Number.NaN, pensionContribution: Number.POSITIVE_INFINITY },
        { personalAllowance: Number.POSITIVE_INFINITY, children: 1e9 },
        { pensionContribution: 1e15, pensionMethod: 'relief-at-source', region: 'scotland', children: 3 },
      ];
      for (const over of hostile) {
        const list = bands(over);
        expect(list.length).toBeGreaterThan(0);
        for (const b of list) {
          for (const value of Object.values(b)) {
            if (typeof value === 'number') expect(Number.isFinite(value)).toBe(true);
          }
          expect(b.incomeTaxBand === null || typeof b.incomeTaxBand === 'string').toBe(true);
          expect(typeof b.allowanceTapering).toBe('boolean');
        }
      }
    });
  });

  describe('across a grid of inputs', () => {
    const methods = ['salary-sacrifice', 'net-pay', 'relief-at-source'] as const;
    const loans = [
      { undergradPlan: 'none', postgradLoan: false },
      { undergradPlan: 'none', postgradLoan: true },
      { undergradPlan: 'plan1', postgradLoan: false },
      { undergradPlan: 'plan1', postgradLoan: true },
      { undergradPlan: 'plan5', postgradLoan: false },
      { undergradPlan: 'plan5', postgradLoan: true },
    ] as const;

    const grid = (): UkTaxInput[] => {
      const out: UkTaxInput[] = [];
      for (const kind of ['employed', 'self-employed'] as const) {
        const employed = kind === 'employed';
        for (const region of ['rUK', 'scotland'] as const) {
          // A sole trader has no payroll and no benefits in kind: those fields would only repeat a case.
          for (const pensionMethod of employed ? methods : (['relief-at-source'] as const)) {
            for (const pensionContribution of [0, 300, 2750, 60000]) {
              for (const loan of loans) {
                for (const children of [0, 2]) {
                  for (const benefitsInKind of employed ? [0, 15000] : [0]) {
                    for (const marriageAllowance of [true, false]) {
                      for (const personalAllowance of [undefined, 0]) {
                        out.push(
                          input({
                            kind,
                            region,
                            pensionMethod,
                            pensionContribution,
                            ...loan,
                            children,
                            benefitsInKind,
                            marriageAllowance,
                            personalAllowance,
                          }),
                        );
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
      return out;
    };

    const describeInput = (i: UkTaxInput): string =>
      `${i.kind}/${i.region}/${i.pensionMethod}/pension ${i.pensionContribution}/${i.undergradPlan}` +
      `${i.postgradLoan ? '+pg' : ''}/children ${i.children}/bik ${i.benefitsInKind}` +
      `/ma ${i.marriageAllowance}/pa ${String(i.personalAllowance)}`;

    it('has, in the band containing every sampled income, the rates ukMarginalRates reports there', () => {
      const failures: string[] = [];
      const inputs = grid();
      for (const i of inputs) {
        const list = ukMarginalBands(i, { maxIncome });
        // Every ~£997, and just inside both edges of every band, where a misplaced edge shows.
        const incomes = steppedIncomes(997);
        for (const b of list) incomes.push(b.from + 0.25, b.to - 1.5);
        for (const mismatch of bandMismatches(i, list, incomes)) {
          failures.push(`${describeInput(i)}: ${mismatch}`);
        }
      }
      expect(inputs.length).toBeGreaterThan(2000);
      expect(failures.slice(0, 5)).toEqual([]);
    });

    it('has contiguous, increasing, finite bands from 0 to the maximum, and never two alike side by side', () => {
      const failures: string[] = [];
      for (const i of grid()) {
        const list = ukMarginalBands(i, { maxIncome });
        const fail = (why: string): number => failures.push(`${describeInput(i)}: ${why}`);
        if (list.length === 0 || list.length > 200) fail(`${list.length} bands`);
        if (list[0].from !== 0) fail(`starts at ${list[0].from}`);
        if (list[list.length - 1].to !== maxIncome) fail(`ends at ${list[list.length - 1].to}`);
        list.forEach((b, n) => {
          if (!(b.from < b.to)) fail(`band ${n} is [${b.from}, ${b.to}]`);
          const numbers = Object.values(b).filter((v): v is number => typeof v === 'number');
          if (!numbers.every(Number.isFinite)) fail(`band ${n} has a non-finite number`);
          if (typeof b.allowanceTapering !== 'boolean') fail(`band ${n} has no taper flag`);
          const prev = list[n - 1];
          if (prev === undefined) return;
          if (prev.to !== b.from) fail(`gap between bands ${n - 1} and ${n}`);
          if (
            Math.abs(prev.incomeTax - b.incomeTax) <= 1e-9 &&
            Math.abs(prev.nationalInsurance - b.nationalInsurance) <= 1e-9 &&
            Math.abs(prev.studentLoan - b.studentLoan) <= 1e-9 &&
            Math.abs(prev.postgradLoan - b.postgradLoan) <= 1e-9 &&
            Math.abs(prev.childBenefitCharge - b.childBenefitCharge) <= 1e-9
          ) {
            fail(`bands ${n - 1} and ${n} have the same rates`);
          }
        });
      }
      expect(failures.slice(0, 5)).toEqual([]);
    });
  });
});

/** Incomes every `step` from a fractional start, so they land on no round-number threshold. */
function steppedIncomes(step: number): number[] {
  const out: number[] = [];
  for (let x = 0.37; x < 199_000; x += step) out.push(x);
  return out;
}

/**
 * Where the band containing an income disagrees with `ukMarginalRates` there.
 * Incomes within £1.01 below a band's end are skipped: the rate is a one-pound
 * difference, so there it straddles the next band and belongs to neither.
 */
function bandMismatches(i: UkTaxInput, list: UkMarginalBand[], incomes: number[]): string[] {
  const mismatches: string[] = [];
  const parts = ['incomeTax', 'nationalInsurance', 'studentLoan', 'postgradLoan', 'childBenefitCharge', 'total'] as const;
  for (const income of incomes) {
    const band = list.find(b => b.from <= income && income < b.to);
    if (band === undefined || band.to - income <= 1.01) continue;
    const actual = ukMarginalRates({ ...i, income });
    for (const part of parts) {
      if (Math.abs(actual[part] - band[part]) > 1e-9) {
        mismatches.push(
          `${part} at ${income.toFixed(2)} is ${actual[part]} but the band [${band.from}, ${band.to}] has ${band[part]}`,
        );
      }
    }
    const flags = expectedBandFlags(i, income, actual.incomeTax);
    if (flags.incomeTaxBand !== band.incomeTaxBand) {
      mismatches.push(
        `incomeTaxBand at ${income.toFixed(2)} is ${String(flags.incomeTaxBand)} but the band [${band.from}, ${band.to}] has ${String(band.incomeTaxBand)}`,
      );
    }
    if (flags.allowanceTapering !== band.allowanceTapering) {
      mismatches.push(
        `allowanceTapering at ${income.toFixed(2)} is ${flags.allowanceTapering} but the band [${band.from}, ${band.to}] has ${band.allowanceTapering}`,
      );
    }
  }
  return mismatches;
}

/** The statutory rate of each income tax band, lowest first, by region. */
const STATUTORY_BAND_RATES: Record<UkTaxInput['region'], Array<[UkIncomeTaxBandName, number]>> = {
  rUK: [
    ['basic', 0.2],
    ['higher', 0.4],
    ['additional', 0.45],
  ],
  scotland: [
    ['starter', 0.19],
    ['basic', 0.2],
    ['intermediate', 0.21],
    ['higher', 0.42],
    ['advanced', 0.45],
    ['top', 0.48],
  ],
};

/**
 * What a band's two flags should be at an income, worked out from the exported
 * API alone and without ever looking at the band list. The taper is running
 * when adjusted net income is over its start with allowance left, both read off
 * `calculateUkTax`. The band is the one whose statutory rate, once un-stretched
 * by the taper, is the income tax rate `ukMarginalRates` reports there: no rate
 * is none, and no two bands of a region share one.
 */
function expectedBandFlags(
  i: UkTaxInput,
  income: number,
  incomeTaxRate: number,
): { incomeTaxBand: UkIncomeTaxBandName | null; allowanceTapering: boolean } {
  const exact = calculateUkTax({ ...i, income });
  const allowanceTapering = exact.adjustedNetIncome > UK_ALLOWANCE_TAPER_START && exact.personalAllowance > 0;
  if (Math.abs(incomeTaxRate) <= 1e-9) return { incomeTaxBand: null, allowanceTapering };
  const statutory = incomeTaxRate / (allowanceTapering ? 1 + UK_ALLOWANCE_TAPER_RATE : 1);
  const match = STATUTORY_BAND_RATES[i.region].find(([, rate]) => Math.abs(rate - statutory) <= 1e-9);
  return { incomeTaxBand: match === undefined ? null : match[0], allowanceTapering };
}

describe('ukTakeHomeShareCurve', () => {
  const scenario = input({
    income: 55000,
    pensionContribution: 2750,
    pensionMethod: 'net-pay',
    undergradPlan: 'plan2',
  });
  const curve = (over: Partial<UkTaxInput>, maxIncome: number, step: number) =>
    ukTakeHomeShareCurve(input(over), { maxIncome, step });

  it('starts at one step rather than at zero and runs to the maximum inclusive', () => {
    expect(curve({}, 1000, 250).map(p => p.income)).toEqual([250, 500, 750, 1000]);
  });

  it('stops at the last multiple not past the maximum', () => {
    expect(curve({}, 1100, 250).map(p => p.income)).toEqual([250, 500, 750, 1000]);
  });

  it('is a single point when the maximum is one step', () => {
    const points = curve({ pensionContribution: 0 }, 500, 500);
    expect(points).toHaveLength(1);
    expect(points[0].income).toBe(500);
  });

  it('is empty when the maximum is zero or below the first step', () => {
    expect(curve({}, 0, 100)).toEqual([]);
    expect(curve({}, 99, 100)).toEqual([]);
  });

  it('returns nothing for a zero, negative or non-finite step', () => {
    expect(curve({}, 1000, 0)).toEqual([]);
    expect(curve({}, 1000, -5)).toEqual([]);
    expect(curve({}, 1000, Number.NaN)).toEqual([]);
    expect(curve({}, 1000, Number.POSITIVE_INFINITY)).toEqual([]);
  });

  it('returns nothing for a negative or non-finite maximum', () => {
    expect(curve({}, -1, 100)).toEqual([]);
    expect(curve({}, Number.NaN, 100)).toEqual([]);
    expect(curve({}, Number.POSITIVE_INFINITY, 100)).toEqual([]);
  });

  it('caps the number of points at 2,000, as ukTaxCurve does', () => {
    const points = curve({}, 1_000_000, 1);
    expect(points).toHaveLength(2000);
    expect(points[0].income).toBe(1);
    expect(points[1999].income).toBe(2000);
  });

  it('does not lose the last point to floating-point division', () => {
    expect(curve({}, 0.3, 0.1)).toHaveLength(3);
  });

  it('agrees with ukTakeHomeBySlice at £55,000 with no children', () => {
    const point = ukTakeHomeShareCurve(scenario, { maxIncome: 60000, step: 500 }).find(p => p.income === 55000);
    const summary = ukTakeHomeBySlice(scenario);
    expect(point).toBeDefined();
    expect(point!.takeHome).toBeCloseTo(summary.takeHomeRate, 12);
    expect(point!.takeHome).toBeCloseTo(0.70004, 4);
    expect(point!.pension).toBeCloseTo(summary.shares.pension, 12);
    expect(point!.incomeTax).toBeCloseTo(summary.shares.incomeTax, 12);
    expect(point!.nationalInsurance).toBeCloseTo(summary.shares.nationalInsurance, 12);
    expect(point!.studentLoan).toBeCloseTo(summary.shares.studentLoan, 12);
    expect(point!.childBenefitCharge).toBe(0);
  });

  it('agrees with ukTakeHomeBySlice at every point for a mix of methods and loans', () => {
    for (const over of [
      { pensionContribution: 5000, pensionMethod: 'salary-sacrifice' as const, postgradLoan: true },
      { pensionContribution: 8000, pensionMethod: 'relief-at-source' as const, region: 'scotland' as const },
      { pensionContribution: 3000, pensionMethod: 'net-pay' as const, undergradPlan: 'plan1' as const },
      { kind: 'self-employed' as const, undergradPlan: 'plan5' as const },
    ]) {
      for (const point of curve(over, 150000, 7500)) {
        const summary = ukTakeHomeBySlice(input({ ...over, income: point.income }));
        expect(point.takeHome).toBeCloseTo(summary.shares.takeHome, 12);
        expect(point.pension).toBeCloseTo(summary.shares.pension, 12);
        expect(point.incomeTax).toBeCloseTo(summary.shares.incomeTax, 12);
        expect(point.nationalInsurance).toBeCloseTo(summary.shares.nationalInsurance, 12);
        expect(point.studentLoan).toBeCloseTo(summary.shares.studentLoan, 12);
      }
    }
  });

  it('sends all of an income below the contribution to the pension and keeps none', () => {
    const [first, second, third] = ukTakeHomeShareCurve(scenario, { maxIncome: 3000, step: 1000 });
    expect(first.income).toBe(1000);
    for (const p of [first, second]) {
      expect(p.pension).toBe(1);
      expect(p.takeHome).toBe(0);
      expect(p.incomeTax).toBe(0);
    }
    // £3,000 is past the £2,750 contribution, so some of it is kept.
    expect(third.pension).toBeCloseTo(2750 / 3000, 12);
    expect(third.takeHome).toBeCloseTo(250 / 3000, 12);
  });

  it('takes 80p in the pound to the pension under relief at source for incomes below the contribution', () => {
    const [point] = curve({ pensionContribution: 5000, pensionMethod: 'relief-at-source' }, 1000, 1000);
    expect(point.pension).toBeCloseTo(0.8, 12);
    expect(point.takeHome).toBeCloseTo(0.2, 12);
  });

  it('charges the child benefit charge with two children at about £70,000, as a share of income', () => {
    const [point] = curve({ children: 2 }, 70000, 70000);
    // Half the charge at £70,000: (£27.05 + £17.90) x 53 weeks x 50%.
    expect(point.childBenefitCharge).toBeGreaterThan(0);
    expect(point.childBenefitCharge).toBeCloseTo((((27.05 + 17.9) * 53) / 2) / 70000, 4);
    const without = curve({ children: 0 }, 70000, 70000)[0];
    expect(point.takeHome).toBeCloseTo(without.takeHome - point.childBenefitCharge, 12);
  });

  it('shows no charge up to £60,000 or with no children, and all of the child benefit from £80,000', () => {
    for (const p of curve({ children: 2 }, 60000, 10000)) expect(p.childBenefitCharge).toBe(0);
    for (const p of curve({ children: 0 }, 100000, 10000)) expect(p.childBenefitCharge).toBe(0);
    const [full] = curve({ children: 2 }, 100000, 100000);
    expect(full.childBenefitCharge).toBeCloseTo(((27.05 + 17.9) * 53) / 100000, 12);
  });

  it('leaves child benefit received and childcare support out: they are not pay', () => {
    const plain = curve({}, 40000, 10000);
    const claiming = curve({ children: 2, childcareSupport: 9000 }, 40000, 10000);
    expect(claiming).toEqual(plain);
  });

  it('has shares in [0, 1] that sum to 1 once the income covers the contribution', () => {
    for (const p of ukTakeHomeShareCurve({ ...scenario, children: 2 }, { maxIncome: 200000, step: 2500 })) {
      for (const share of [p.takeHome, p.pension, p.incomeTax, p.nationalInsurance, p.studentLoan, p.childBenefitCharge]) {
        expect(share).toBeGreaterThanOrEqual(0);
        expect(share).toBeLessThanOrEqual(1);
      }
      if (p.income >= 2750) {
        const sum = p.takeHome + p.pension + p.incomeTax + p.nationalInsurance + p.studentLoan + p.childBenefitCharge;
        expect(sum).toBeCloseTo(1, 12);
      }
    }
  });

  it('takes each point from calculateUkTax with only income replaced', () => {
    const i = input({ region: 'scotland', undergradPlan: 'plan2', postgradLoan: true, children: 2 });
    for (const p of ukTakeHomeShareCurve(i, { maxIncome: 120000, step: 20000 })) {
      const r = calculateUkTax({ ...i, income: p.income });
      expect(p.incomeTax).toBe(r.incomeTax / p.income);
      expect(p.nationalInsurance).toBe(r.nationalInsurance / p.income);
      expect(p.studentLoan).toBe((r.studentLoan + r.postgradLoan) / p.income);
      expect(p.childBenefitCharge).toBe(r.childBenefitCharge / p.income);
    }
  });

  it('keeps every share finite and clamped for a contribution far beyond the income and for hostile input', () => {
    const hostile: Array<Partial<UkTaxInput>> = [
      { pensionContribution: 1e12, pensionMethod: 'net-pay' },
      { pensionContribution: Number.NaN, benefitsInKind: Number.POSITIVE_INFINITY, children: Number.NaN },
      { pensionContribution: -100, benefitsInKind: -100, children: -1, personalAllowance: -1 },
    ];
    for (const over of hostile) {
      const points = curve(over, 100000, 25000);
      expect(points).toHaveLength(4);
      for (const p of points) {
        for (const value of Object.values(p)) {
          expect(Number.isFinite(value)).toBe(true);
        }
        for (const share of [p.takeHome, p.pension, p.incomeTax, p.nationalInsurance, p.studentLoan, p.childBenefitCharge]) {
          expect(share).toBeGreaterThanOrEqual(0);
          expect(share).toBeLessThanOrEqual(1);
        }
      }
    }
  });
});

describe('ukTakeHomeShareAt', () => {
  const scenario = input({
    income: 55000,
    pensionContribution: 2750,
    pensionMethod: 'net-pay',
    undergradPlan: 'plan2',
  });
  const zeros = {
    income: 0,
    takeHome: 0,
    pension: 0,
    incomeTax: 0,
    nationalInsurance: 0,
    studentLoan: 0,
    childBenefitCharge: 0,
  };
  const shares = (p: ReturnType<typeof ukTakeHomeShareAt>): number[] => [
    p.takeHome,
    p.pension,
    p.incomeTax,
    p.nationalInsurance,
    p.studentLoan,
    p.childBenefitCharge,
  ];

  it('is all zeros at an income of 0, whatever else is entered', () => {
    expect(ukTakeHomeShareAt(input({ income: 0 }))).toEqual(zeros);
    expect(
      ukTakeHomeShareAt(
        input({
          income: 0,
          pensionContribution: 5000,
          benefitsInKind: 20000,
          children: 2,
          undergradPlan: 'plan2',
          postgradLoan: true,
        }),
      ),
    ).toEqual(zeros);
  });

  it('is all zeros, income included, for a negative, NaN or infinite income, which count as 0', () => {
    for (const income of [-1, -50000, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(ukTakeHomeShareAt({ ...scenario, income })).toEqual(zeros);
    }
  });

  it('equals the point ukTakeHomeShareCurve gives at that income, for every point and a mix of inputs', () => {
    for (const over of [
      { pensionContribution: 2750, pensionMethod: 'net-pay' as const, undergradPlan: 'plan2' as const },
      { pensionContribution: 8000, pensionMethod: 'relief-at-source' as const, region: 'scotland' as const, children: 2 },
      { pensionContribution: 5000, pensionMethod: 'salary-sacrifice' as const, postgradLoan: true, benefitsInKind: 4000 },
      { kind: 'self-employed' as const, undergradPlan: 'plan5' as const, marriageAllowance: true },
      {},
    ]) {
      const points = ukTakeHomeShareCurve(input(over), { maxIncome: 150000, step: 7500 });
      expect(points).toHaveLength(20);
      for (const point of points) {
        expect(ukTakeHomeShareAt(input({ ...over, income: point.income }))).toEqual(point);
      }
    }
  });

  it('takes the income from the curve rather than from the input the curve is given', () => {
    const [point] = ukTakeHomeShareCurve({ ...scenario, income: 12345 }, { maxIncome: 55000, step: 55000 });
    expect(point).toEqual(ukTakeHomeShareAt(scenario));
  });

  it('reports the income it is of', () => {
    expect(ukTakeHomeShareAt(scenario).income).toBe(55000);
  });

  it('agrees with ukTakeHomeBySlice at £55,000 with no children', () => {
    const point = ukTakeHomeShareAt(scenario);
    const summary = ukTakeHomeBySlice(scenario);
    expect(point.takeHome).toBeCloseTo(summary.shares.takeHome, 12);
    expect(point.takeHome).toBeCloseTo(0.70004, 4);
    expect(point.pension).toBe(summary.shares.pension);
    expect(point.incomeTax).toBe(summary.shares.incomeTax);
    expect(point.nationalInsurance).toBe(summary.shares.nationalInsurance);
    expect(point.studentLoan).toBe(summary.shares.studentLoan);
    expect(point.childBenefitCharge).toBe(0);
  });

  it('takes the deductions from calculateUkTax with only the income replaced', () => {
    const i = input({ income: 90000, region: 'scotland', undergradPlan: 'plan2', postgradLoan: true, children: 2 });
    const r = calculateUkTax(i);
    const p = ukTakeHomeShareAt(i);
    expect(p.pension).toBe(r.pensionFromPay / 90000);
    expect(p.incomeTax).toBe(r.incomeTax / 90000);
    expect(p.nationalInsurance).toBe(r.nationalInsurance / 90000);
    expect(p.studentLoan).toBe((r.studentLoan + r.postgradLoan) / 90000);
    expect(p.childBenefitCharge).toBe(r.childBenefitCharge / 90000);
  });

  it('treats a negative or NaN pension as no pension', () => {
    const none = ukTakeHomeShareAt(input({ income: 30000 }));
    expect(ukTakeHomeShareAt(input({ income: 30000, pensionContribution: -500 }))).toEqual(none);
    expect(ukTakeHomeShareAt(input({ income: 30000, pensionContribution: Number.NaN }))).toEqual(none);
  });

  it('keeps every share finite and in [0, 1] for hostile input', () => {
    const hostile: Array<Partial<UkTaxInput>> = [
      { pensionContribution: 1e12, pensionMethod: 'net-pay' },
      { pensionContribution: Number.NaN, benefitsInKind: Number.POSITIVE_INFINITY, children: Number.NaN },
      { pensionContribution: -100, benefitsInKind: -100, children: -1, personalAllowance: -1 },
      { benefitsInKind: 1e9 },
    ];
    for (const over of hostile) {
      for (const income of [0, 1, 20000, 250000]) {
        const p = ukTakeHomeShareAt(input({ ...over, income }));
        for (const value of Object.values(p)) expect(Number.isFinite(value)).toBe(true);
        for (const share of shares(p)) {
          expect(share).toBeGreaterThanOrEqual(0);
          expect(share).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  describe('where the shares sum to more than 1', () => {
    it('sums to 1 whenever the deductions fit in the income, children or not', () => {
      for (const income of [20000, 55000, 70000, 140000]) {
        const p = ukTakeHomeShareAt({ ...scenario, children: 2, income });
        expect(shares(p).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
      }
    });

    it('does so below a net-pay contribution: NI on full pay comes on top of a pension share of 1', () => {
      const p = ukTakeHomeShareAt(input({ income: 20000, pensionContribution: 20000, pensionMethod: 'net-pay' }));
      expect(p.pension).toBe(1);
      expect(p.nationalInsurance).toBeCloseTo(((20000 - 12570) * 0.08) / 20000, 12);
      expect(p.takeHome).toBe(0);
      expect(shares(p).reduce((a, b) => a + b, 0)).toBeCloseTo(1 + p.nationalInsurance, 12);
    });

    it('does not below a salary-sacrifice contribution, which takes the NI with it', () => {
      const p = ukTakeHomeShareAt(input({ income: 20000, pensionContribution: 20000, pensionMethod: 'salary-sacrifice' }));
      expect(p.pension).toBe(1);
      expect(p.nationalInsurance).toBe(0);
      expect(shares(p).reduce((a, b) => a + b, 0)).toBe(1);
    });

    it('does so when benefits in kind are taxed more than the cash pay can cover', () => {
      const p = ukTakeHomeShareAt(input({ income: 15000, benefitsInKind: 60000 }));
      expect(p.incomeTax).toBe(1);
      expect(p.nationalInsurance).toBeCloseTo(((15000 - 12570) * 0.08) / 15000, 12);
      expect(p.takeHome).toBe(0);
      expect(shares(p).reduce((a, b) => a + b, 0)).toBeGreaterThan(1);
    });
  });
});

describe('ukWhatIfs', () => {
  // Every field carries a value of its own, so a field a what-if disturbs shows.
  const rich: UkTaxInput = {
    income: 55000,
    kind: 'employed',
    region: 'scotland',
    benefitsInKind: 1234,
    pensionContribution: 2750,
    pensionMethod: 'net-pay',
    undergradPlan: 'plan2',
    postgradLoan: true,
    children: 2,
    childcareSupport: 3000,
    marriageAllowance: true,
    personalAllowance: 11000,
  };
  const keys = (over: Partial<UkTaxInput>): string[] => ukWhatIfs(input(over)).map(w => w.key);
  const find = (list: UkWhatIf[], key: UkWhatIf['key']): UkWhatIf => {
    const found = list.find(w => w.key === key);
    if (found === undefined) throw new Error(`no ${key} what-if`);
    return found;
  };

  it('offers all four, in order, to an employee on a net-pay pension with a loan', () => {
    expect(ukWhatIfs(rich).map(w => w.key)).toEqual(['no-loan', 'no-pension', 'more-pension', 'salary-sacrifice']);
  });

  it('is empty for an empty input: nothing to remove, no income to add a pension to', () => {
    expect(ukWhatIfs(input({}))).toEqual([]);
  });

  it('offers only more pension to a single row with an income and nothing else', () => {
    expect(keys({ income: 30000 })).toEqual(['more-pension']);
  });

  it('adds 5% of £55,000, £2,750, to the entered £2,750, and no pension to any other what-if', () => {
    const list = ukWhatIfs(rich);
    expect(list.map(w => w.extraPension)).toEqual([0, 0, 2750, 0]);
    expect(find(list, 'more-pension').input.pensionContribution).toBe(5500);
  });

  it('rounds the extra pension to the nearest pound', () => {
    const extra = (income: number): number => find(ukWhatIfs(input({ income })), 'more-pension').extraPension;
    expect(extra(12345)).toBe(617); // 617.25
    expect(extra(12355)).toBe(618); // 617.75
    expect(extra(10)).toBe(1); // 0.5
    expect(extra(1_000_000)).toBe(50000);
  });

  it('makes only its own change in each what-if and leaves every other field as it was', () => {
    const list = ukWhatIfs(rich);
    const restore: Record<UkWhatIf['key'], Partial<UkTaxInput>> = {
      'no-loan': { undergradPlan: rich.undergradPlan, postgradLoan: rich.postgradLoan },
      'no-pension': { pensionContribution: rich.pensionContribution },
      'more-pension': { pensionContribution: rich.pensionContribution },
      'salary-sacrifice': { pensionMethod: rich.pensionMethod },
    };
    expect(list).toHaveLength(4);
    for (const w of list) {
      expect({ ...w.input, ...restore[w.key] }).toEqual(rich);
    }
    expect(find(list, 'no-loan').input).toMatchObject({ undergradPlan: 'none', postgradLoan: false });
    expect(find(list, 'no-pension').input.pensionContribution).toBe(0);
    expect(find(list, 'salary-sacrifice').input.pensionMethod).toBe('salary-sacrifice');
  });

  it('does not change the input it is given', () => {
    const frozen = Object.freeze({ ...rich });
    const list = ukWhatIfs(frozen);
    expect(frozen).toEqual(rich);
    for (const w of list) expect(w.input).not.toBe(frozen);
  });

  it('changes the result of the calculation for every what-if it offers', () => {
    const before = calculateUkTax(rich).takeHome;
    for (const w of ukWhatIfs(rich)) {
      expect(calculateUkTax(w.input).takeHome).not.toBeCloseTo(before, 6);
    }
  });

  describe('no-loan', () => {
    it('is offered for an undergraduate plan alone, and sets plan none and postgrad false', () => {
      const [w] = ukWhatIfs(input({ income: 40000, undergradPlan: 'plan1' }));
      expect(w.key).toBe('no-loan');
      expect(w.input).toEqual(input({ income: 40000, undergradPlan: 'none', postgradLoan: false }));
    });

    it('is offered for a postgraduate loan alone', () => {
      const [w] = ukWhatIfs(input({ income: 40000, postgradLoan: true }));
      expect(w.key).toBe('no-loan');
      expect(w.input.postgradLoan).toBe(false);
      expect(w.input.undergradPlan).toBe('none');
    });

    it('is not offered with no loan, or with an unknown plan, which counts as none', () => {
      expect(keys({ income: 40000 })).not.toContain('no-loan');
      expect(keys({ income: 40000, undergradPlan: 'plan9' as UkUndergradPlan })).not.toContain('no-loan');
    });
  });

  describe('no-pension', () => {
    it('is offered for any positive contribution and sets it to 0', () => {
      const w = find(ukWhatIfs(input({ income: 40000, pensionContribution: 0.01 })), 'no-pension');
      expect(w.input.pensionContribution).toBe(0);
    });

    it('is not offered for 0, a negative, NaN or infinite contribution, which count as 0', () => {
      for (const pensionContribution of [0, -500, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
        expect(keys({ income: 40000, pensionContribution })).not.toContain('no-pension');
      }
    });

    it('is offered when the contribution is more than the income, which the curve holds in pounds at higher incomes', () => {
      expect(keys({ income: 40000, pensionContribution: 60000 })).toContain('no-pension');
      expect(keys({ income: 0, pensionContribution: 5000 })).toContain('no-pension');
    });
  });

  describe('more-pension', () => {
    it('is not offered for an income of 0, a negative one, NaN or infinity', () => {
      for (const income of [0, -1000, Number.NaN, Number.POSITIVE_INFINITY]) {
        expect(keys({ income })).not.toContain('more-pension');
      }
    });

    it('is not offered when 5% of the income rounds to nothing, because it would change nothing', () => {
      expect(keys({ income: 9 })).toEqual([]);
      expect(keys({ income: 0.5 })).toEqual([]);
    });

    it('adds to the contribution as sanitised: a negative or NaN one starts from 0', () => {
      for (const pensionContribution of [-800, Number.NaN]) {
        const w = find(ukWhatIfs(input({ income: 40000, pensionContribution })), 'more-pension');
        expect(w.extraPension).toBe(2000);
        expect(w.input.pensionContribution).toBe(2000);
      }
    });

    it('adds to the contribution in full pounds, not as capped at the income', () => {
      const w = find(ukWhatIfs(input({ income: 40000, pensionContribution: 60000 })), 'more-pension');
      expect(w.input.pensionContribution).toBe(62000);
    });

    it('is offered to a sole trader, whose method is left as entered', () => {
      const w = find(ukWhatIfs(input({ income: 40000, kind: 'self-employed', pensionMethod: 'relief-at-source' })), 'more-pension');
      expect(w.input.kind).toBe('self-employed');
      expect(w.input.pensionMethod).toBe('relief-at-source');
    });
  });

  describe('salary-sacrifice', () => {
    it('is offered to an employee with a contribution by net pay or by relief at source', () => {
      for (const pensionMethod of ['net-pay', 'relief-at-source'] as const) {
        expect(keys({ income: 40000, pensionContribution: 3000, pensionMethod })).toContain('salary-sacrifice');
      }
    });

    it('is offered when the method is not one we know, which counts as relief at source', () => {
      const pensionMethod = 'cash' as UkTaxInput['pensionMethod'];
      expect(keys({ income: 40000, pensionContribution: 3000, pensionMethod })).toContain('salary-sacrifice');
    });

    it('is not offered when the pension is already by salary sacrifice, or there is no pension', () => {
      expect(keys({ income: 40000, pensionContribution: 3000, pensionMethod: 'salary-sacrifice' })).not.toContain(
        'salary-sacrifice',
      );
      expect(keys({ income: 40000, pensionContribution: 0, pensionMethod: 'net-pay' })).not.toContain('salary-sacrifice');
      expect(keys({ income: 40000, pensionContribution: -3000, pensionMethod: 'net-pay' })).not.toContain(
        'salary-sacrifice',
      );
    });

    it('is never offered to a sole trader, whatever method was left on the input', () => {
      for (const pensionMethod of ['salary-sacrifice', 'net-pay', 'relief-at-source'] as const) {
        const list = ukWhatIfs(input({ income: 40000, kind: 'self-employed', pensionContribution: 3000, pensionMethod }));
        expect(list.map(w => w.key)).toEqual(['no-pension', 'more-pension']);
      }
    });
  });

  it('never returns a NaN or an infinity, whatever the input', () => {
    const hostile: Array<Partial<UkTaxInput>> = [
      { income: Number.NaN, pensionContribution: Number.NaN, undergradPlan: 'plan9' as UkUndergradPlan },
      { income: Number.POSITIVE_INFINITY, pensionContribution: Number.POSITIVE_INFINITY },
      { income: -1, pensionContribution: -1, children: Number.NaN },
      { income: 1e15, pensionContribution: 1e15, pensionMethod: 'net-pay' },
    ];
    for (const over of hostile) {
      for (const w of ukWhatIfs(input(over))) {
        expect(Number.isFinite(w.extraPension)).toBe(true);
        expect(w.extraPension).toBeGreaterThanOrEqual(0);
        // The two what-ifs that set the contribution set it to a sanitised number;
        // the others pass the entered one through untouched, hostile or not.
        if (w.key === 'no-pension' || w.key === 'more-pension') {
          expect(Number.isFinite(w.input.pensionContribution)).toBe(true);
        }
      }
    }
  });
});
