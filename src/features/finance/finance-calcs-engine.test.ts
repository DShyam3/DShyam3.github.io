import { describe, expect, it } from 'vitest';
import { calculateUkTax, ukBenefitInKindTax, ukCashAfterTax, ukTakeHomeBySlice, type UkTaxInput } from '@/lib/finance';
import { calculateFinance } from './finance-calcs';
import { asPackageBenefits } from './finance-narrow';
import type { FinanceSettings, PackageBenefit } from './finance-types';

/**
 * calculateFinance runs income tax, NI and student loans through the same
 * engine as the Tax Calculator. These tests pin that agreement and the
 * package-benefit rules on top of it.
 */

const settings = (over: Partial<FinanceSettings> = {}): FinanceSettings => ({
  grossSalary: 50000,
  pensionType: 'net_pay',
  personalPensionPercent: 0,
  employerPensionPercent: 0,
  studentLoanPlan: 'none',
  taxCode: '1257L',
  personalAllowance: 12570,
  weekends: 104,
  bankHolidays: 8,
  workHolidays: 26,
  workingHoursPerDay: 8,
  taxYear: 2026,
  ukRegion: 'england-and-wales',
  ...over,
});

const run = (s: FinanceSettings) => calculateFinance(s);

/** The engine input written out by hand, so the test does not reuse the code under test. */
const engineInput = (over: Partial<UkTaxInput>): UkTaxInput => ({
  income: 50000,
  kind: 'employed',
  region: 'rUK',
  benefitsInKind: 0,
  pensionContribution: 0,
  pensionMethod: 'net-pay',
  undergradPlan: 'none',
  postgradLoan: false,
  children: 0,
  childcareSupport: 0,
  marriageAllowance: false,
  ...over,
});

const benefit = (over: Partial<PackageBenefit>): PackageBenefit => ({
  id: 'b1',
  name: 'Benefit',
  amount: 1000,
  type: 'monetary',
  ...over,
});

const cents = 6;

describe('calculateFinance agrees with the Tax Calculator engine', () => {
  it('matches calculateUkTax exactly for a Scottish profile', () => {
    const results = run(
      settings({ ukRegion: 'scotland', pensionType: 'net_pay', personalPensionPercent: 5, studentLoanPlan: 'plan1' }),
    );
    const engine = calculateUkTax(
      engineInput({ region: 'scotland', pensionContribution: 2500, pensionMethod: 'net-pay', undergradPlan: 'plan1' }),
    );

    expect(results.incomeTax).toBe(engine.incomeTax);
    expect(results.nationalInsurance).toBe(engine.nationalInsurance);
    expect(results.studentLoan).toBe(engine.studentLoan + engine.postgradLoan);
    expect(results.personalAllowance).toBe(engine.personalAllowance);
    expect(results.personalPensionRate).toBe(engine.pensionFromPay);
    expect(results.netTakeHome).toBe(engine.takeHome);

    // 3,967 at 19%, 12,989 at 20%, 14,136 at 21% and 3,838 at 42%, not 20% to £37,700.
    expect(results.incomeTax).toBeCloseTo(7932.05, 3);
    const england = run(settings({ pensionType: 'net_pay', personalPensionPercent: 5, studentLoanPlan: 'plan1' }));
    expect(england.incomeTax).toBeCloseTo(6986, 3);
    expect(results.incomeTax).toBeGreaterThan(england.incomeTax);
  });

  it('matches calculateUkTax exactly for a relief-at-source profile, where only 80% leaves pay', () => {
    const results = run(settings({ pensionType: 'relief_at_source', personalPensionPercent: 10 }));
    const engine = calculateUkTax(
      engineInput({ pensionContribution: 5000, pensionMethod: 'relief-at-source' }),
    );

    expect(results.incomeTax).toBe(engine.incomeTax);
    expect(results.nationalInsurance).toBe(engine.nationalInsurance);
    expect(results.personalPensionRate).toBe(engine.pensionFromPay);
    expect(results.netTakeHome).toBe(engine.takeHome);

    // The £5,000 gross costs £4,000 from pay and extends the basic band to £42,700.
    expect(results.personalPensionRate).toBe(4000);
    expect(results.incomeTax).toBeCloseTo(37430 * 0.2, 3);
    expect(results.netTakeHome).toBeCloseTo(50000 - 4000 - 7486 - 2994.4, 3);
    expect(50000 - results.totalDeductions).toBeCloseTo(results.netTakeHome, cents);
  });

  it('matches for Scotland and relief at source together', () => {
    const results = run(
      settings({ ukRegion: 'scotland', pensionType: 'relief_at_source', personalPensionPercent: 8, grossSalary: 80000 }),
    );
    const engine = calculateUkTax(
      engineInput({ income: 80000, region: 'scotland', pensionContribution: 6400, pensionMethod: 'relief-at-source' }),
    );
    expect(results.incomeTax).toBe(engine.incomeTax);
    expect(results.netTakeHome).toBe(engine.takeHome);
  });

  it('matches for salary sacrifice, which lowers NI and loans as well as tax', () => {
    const results = run(
      settings({ pensionType: 'salary_sacrifice', personalPensionPercent: 10, studentLoanPlan: 'plan2' }),
    );
    const engine = calculateUkTax(
      engineInput({ pensionContribution: 5000, pensionMethod: 'salary-sacrifice', undergradPlan: 'plan2' }),
    );
    expect(results.incomeTax).toBe(engine.incomeTax);
    expect(results.nationalInsurance).toBe(engine.nationalInsurance);
    expect(results.studentLoan).toBe(engine.studentLoan);
    expect(results.netTakeHome).toBe(engine.takeHome);
  });

  it('treats Northern Ireland as rest of UK', () => {
    expect(run(settings({ ukRegion: 'northern-ireland' })).incomeTax).toBe(run(settings()).incomeTax);
  });

  it('keeps gross less total deductions equal to take-home across every profile', () => {
    const pensionTypes: FinanceSettings['pensionType'][] = ['net_pay', 'salary_sacrifice', 'relief_at_source'];
    const regions: FinanceSettings['ukRegion'][] = ['england-and-wales', 'scotland'];
    const plans: FinanceSettings['studentLoanPlan'][] = ['none', 'plan2', 'postgrad'];
    for (const pensionType of pensionTypes) {
      for (const ukRegion of regions) {
        for (const studentLoanPlan of plans) {
          for (const grossSalary of [0, 20000, 50000, 110000, 130000]) {
            const results = run(
              settings({ pensionType, ukRegion, studentLoanPlan, grossSalary, personalPensionPercent: 7 }),
            );
            expect(grossSalary - results.totalDeductions).toBeCloseTo(results.netTakeHome, cents);
          }
        }
      }
    }
  });
});

describe('calculateFinance edge cases', () => {
  it('takes a postgraduate-only plan as 6% above £21,000 with no undergraduate loan', () => {
    const results = run(settings({ grossSalary: 40000, studentLoanPlan: 'postgrad' }));
    expect(results.studentLoan).toBeCloseTo((40000 - 21000) * 0.06, cents);
    expect(results.studentLoan).toBeCloseTo(1140, 3);
    const engine = calculateUkTax(engineInput({ income: 40000, postgradLoan: true }));
    expect(results.studentLoan).toBe(engine.postgradLoan);
    expect(engine.studentLoan).toBe(0);
  });

  it('returns zeros, a full allowance and no NaN for a zero salary', () => {
    const results = run(settings({ grossSalary: 0, personalPensionPercent: 5, studentLoanPlan: 'plan2' }));
    expect(results.incomeTax).toBe(0);
    expect(results.nationalInsurance).toBe(0);
    expect(results.studentLoan).toBe(0);
    expect(results.personalPensionRate).toBe(0);
    expect(results.netTakeHome).toBe(0);
    expect(results.totalDeductions).toBe(0);
    expect(results.personalAllowance).toBe(12570);
    expect(results.cashBenefits).toEqual([]);
    expect(Object.values(results.breakdown.standard).every(r => Object.values(r).every(Number.isFinite))).toBe(true);
  });

  it('removes the personal allowance and taxes the additional rate from £125,140', () => {
    const results = run(settings({ grossSalary: 130000 }));
    expect(results.personalAllowance).toBe(0);
    // 37,700 at 20%, 87,440 at 40%, 4,860 at 45%
    expect(results.incomeTax).toBeCloseTo(7540 + 34976 + 2187, 3);
    expect(results.nationalInsurance).toBeCloseTo(37700 * 0.08 + 79730 * 0.02, 3);
    expect(results.netTakeHome).toBeCloseTo(130000 - 44703 - 4610.6, 3);
  });

  it('reports the tapered allowance between £100,000 and £125,140', () => {
    expect(run(settings({ grossSalary: 110000 })).personalAllowance).toBe(7570);
  });

  it('clamps a salary-sacrifice contribution above the salary to the salary', () => {
    const results = run(
      settings({ grossSalary: 40000, pensionType: 'salary_sacrifice', personalPensionPercent: 150, studentLoanPlan: 'plan2' }),
    );
    expect(results.personalPensionRate).toBe(40000);
    expect(results.incomeTax).toBe(0);
    expect(results.nationalInsurance).toBe(0);
    expect(results.studentLoan).toBe(0);
    expect(results.netTakeHome).toBe(0);
    expect(results.totalDeductions).toBe(40000);
  });

  it('treats a negative pension percentage as no pension', () => {
    const results = run(settings({ personalPensionPercent: -5 }));
    expect(results.personalPensionRate).toBe(0);
    expect(results.netTakeHome).toBe(run(settings()).netTakeHome);
  });

  it('taxes from the first pound with a personal allowance of zero (a BR-style code)', () => {
    const results = run(settings({ grossSalary: 30000, personalAllowance: 0 }));
    expect(results.personalAllowance).toBe(0);
    expect(results.incomeTax).toBeCloseTo(6000, 3);
    // NI has its own statutory threshold.
    expect(results.nationalInsurance).toBeCloseTo(1394.4, 3);
    expect(results.netTakeHome).toBeCloseTo(30000 - 6000 - 1394.4, 3);
  });

  it('taxes from the stated allowance, such as 1107L', () => {
    const results = run(settings({ grossSalary: 30000, personalAllowance: 11070 }));
    expect(results.personalAllowance).toBe(11070);
    expect(results.incomeTax).toBeCloseTo(3786, 3);
  });

  it('reads an invalid stored allowance as the statutory one', () => {
    const statutory = run(settings({ grossSalary: 30000 }));
    expect(run(settings({ grossSalary: 30000, personalAllowance: Number.NaN })).incomeTax).toBe(statutory.incomeTax);
    expect(run(settings({ grossSalary: 30000, personalAllowance: -100 })).incomeTax).toBe(statutory.incomeTax);
  });

  it('leaves the package totals and breakdown periods in the shape they had', () => {
    const results = run(settings({ employerPensionPercent: 4, packageBenefits: [benefit({ amount: 1000 })] }));
    expect(results.employerPensionRate).toBe(2000);
    expect(results.totalBenefitsValue).toBe(1000);
    expect(results.totalPackage).toBe(53000);
    expect(Object.keys(results.breakdown.standard).sort()).toEqual(
      [
        'benefitTax',
        'benefits',
        'deductions',
        'employerPension',
        'ni',
        'pension',
        'postTax',
        'preTax',
        'studentLoan',
        'tax',
        'totalPackage',
      ].sort(),
    );
    expect(results.breakdown.standard.tax.annual).toBe(results.incomeTax);
    expect(results.breakdown.standard.postTax.annual).toBe(results.netTakeHome);
  });
});

describe('calculateFinance: benefits in kind', () => {
  const gym = benefit({ id: 'gym', name: 'Gym', amount: 1000, kind: 'benefit-in-kind' });
  const noBenefits = run(settings());

  it('derives the tax from the value: £1,000 at £50,000 is 270 at 20% and 730 at 40%', () => {
    const results = run(settings({ packageBenefits: [gym] }));
    expect(results.benefitInKindValue).toBe(1000);
    expect(results.benefitTax).toBeCloseTo(346, 3);
    expect(results.benefitTax).toBe(ukBenefitInKindTax(engineInput({}), 1000));
    expect(results.benefitTaxCollectedByCode).toBe(false);
    expect(results.benefitTaxDeduction).toBeCloseTo(346, 3);
  });

  it('takes the tax from take-home and counts it in the deductions', () => {
    const results = run(settings({ packageBenefits: [gym] }));
    expect(results.netTakeHome).toBeCloseTo(noBenefits.netTakeHome - 346, 3);
    expect(results.totalDeductions).toBeCloseTo(noBenefits.totalDeductions + 346, 3);
    expect(50000 - results.totalDeductions).toBeCloseTo(results.netTakeHome, cents);
    expect(results.breakdown.standard.benefitTax.annual).toBeCloseTo(346, 3);
    expect(results.breakdown.standard.deductions.annual).toBe(results.totalDeductions);
  });

  it('keeps the benefit out of income tax, NI and the loan lines', () => {
    const results = run(settings({ packageBenefits: [gym], studentLoanPlan: 'plan2' }));
    const without = run(settings({ studentLoanPlan: 'plan2' }));
    expect(results.incomeTax).toBe(without.incomeTax);
    expect(results.nationalInsurance).toBe(without.nationalInsurance);
    expect(results.studentLoan).toBe(without.studentLoan);
  });

  it('adds the value to the package but not to salary', () => {
    const results = run(settings({ packageBenefits: [gym] }));
    expect(results.totalBenefitsValue).toBe(1000);
    expect(results.totalPackage).toBe(51000);
  });

  it('values a percentage benefit against the salary', () => {
    const results = run(settings({ packageBenefits: [benefit({ type: 'percentage', amount: 2 })] }));
    expect(results.benefitInKindValue).toBe(1000);
    expect(results.benefitTax).toBeCloseTo(346, 3);
  });

  it('sums every benefit in kind before taxing, so a band is crossed once', () => {
    const results = run(
      settings({ packageBenefits: [benefit({ id: 'a', amount: 600 }), benefit({ id: 'b', amount: 400 })] }),
    );
    expect(results.benefitInKindValue).toBe(1000);
    expect(results.benefitTax).toBeCloseTo(346, 3);
  });

  it('uses the Scottish bands', () => {
    const results = run(settings({ grossSalary: 30000, ukRegion: 'scotland', packageBenefits: [benefit({ amount: 2000 })] }));
    expect(results.benefitTax).toBeCloseTo(420, 3);
  });

  it('reads an item with no kind as a benefit in kind and ignores the legacy hand-typed tax', () => {
    const legacy = benefit({ id: 'old', annualTaxCost: 9999 });
    expect(legacy.kind).toBeUndefined();
    const results = run(settings({ packageBenefits: [legacy] }));
    expect(results.benefitInKindValue).toBe(1000);
    expect(results.benefitTax).toBeCloseTo(346, 3);
    expect(results.benefitTaxDeduction).toBeCloseTo(346, 3);
  });

  it('has no benefit tax with no benefits', () => {
    expect(noBenefits.benefitInKindValue).toBe(0);
    expect(noBenefits.benefitTax).toBe(0);
    expect(noBenefits.benefitTaxDeduction).toBe(0);
    expect(noBenefits.benefitTaxCollectedByCode).toBe(false);
    expect(noBenefits.cashBenefits).toEqual([]);
  });

  it('ignores a negative benefit when working out tax', () => {
    const results = run(settings({ packageBenefits: [gym, benefit({ id: 'neg', amount: -500 })] }));
    expect(results.benefitInKindValue).toBe(1000);
    expect(results.benefitTax).toBeCloseTo(346, 3);
  });

  describe('under a tax code below the statutory £12,570', () => {
    const coded = settings({ personalAllowance: 11070, packageBenefits: [gym] });

    it('reports the tax the engine finds but does not take it from take-home: the code collects it', () => {
      const results = run(coded);
      // From the stated allowance: taxable 38,930 -> 39,930, all at 40%.
      expect(results.benefitTax).toBeCloseTo(400, 3);
      expect(results.benefitTaxCollectedByCode).toBe(true);
      expect(results.benefitTaxDeduction).toBe(0);
      expect(results.breakdown.standard.benefitTax.annual).toBe(0);
    });

    it('leaves take-home and total deductions as they are without the benefit', () => {
      const results = run(coded);
      const without = run(settings({ personalAllowance: 11070 }));
      expect(results.netTakeHome).toBe(without.netTakeHome);
      expect(results.totalDeductions).toBe(without.totalDeductions);
      expect(50000 - results.totalDeductions).toBeCloseTo(results.netTakeHome, cents);
    });

    it('is decided at the statutory line: 12,569 is collected by code, 12,570 is not', () => {
      expect(run(settings({ personalAllowance: 12569, packageBenefits: [gym] })).benefitTaxCollectedByCode).toBe(true);
      const atLine = run(settings({ personalAllowance: 12570, packageBenefits: [gym] }));
      expect(atLine.benefitTaxCollectedByCode).toBe(false);
      expect(atLine.benefitTaxDeduction).toBeGreaterThan(0);
    });

    it('treats a zero allowance as below the line', () => {
      const results = run(settings({ personalAllowance: 0, packageBenefits: [gym] }));
      expect(results.benefitTaxCollectedByCode).toBe(true);
      expect(results.benefitTaxDeduction).toBe(0);
    });

    it('reads an invalid allowance as the statutory one, so the tax is not skipped', () => {
      for (const personalAllowance of [Number.NaN, -1]) {
        const results = run(settings({ personalAllowance, packageBenefits: [gym] }));
        expect(results.benefitTaxCollectedByCode).toBe(false);
        expect(results.benefitTaxDeduction).toBeCloseTo(346, 3);
      }
    });

    it('is not "collected by code" when there are no benefits in kind to collect', () => {
      const results = run(settings({ personalAllowance: 11070 }));
      expect(results.benefitTaxCollectedByCode).toBe(false);
      const cashOnly = run(
        settings({ personalAllowance: 11070, packageBenefits: [benefit({ kind: 'cash', amount: 3000 })] }),
      );
      expect(cashOnly.benefitTaxCollectedByCode).toBe(false);
    });
  });

  describe('results.taxInput reproduces the Tax & Income figures in calculateUkTax and ukTakeHomeBySlice', () => {
    it('reproduces netTakeHome, pension, NI, loan and total tax when benefitTaxCollectedByCode is false', () => {
      const results = run(
        settings({
          grossSalary: 60000,
          pensionType: 'net_pay',
          personalPensionPercent: 5,
          studentLoanPlan: 'plan2',
          packageBenefits: [gym],
        }),
      );
      expect(results.benefitTaxCollectedByCode).toBe(false);
      expect(results.taxInput.benefitsInKind).toBe(1000);

      const engine = calculateUkTax(results.taxInput);
      expect(engine.takeHome).toBeCloseTo(results.netTakeHome, cents);
      expect(engine.pensionFromPay).toBeCloseTo(results.personalPensionRate, cents);
      expect(engine.nationalInsurance).toBeCloseTo(results.nationalInsurance, cents);
      expect(engine.studentLoan + engine.postgradLoan).toBeCloseTo(results.studentLoan, cents);
      expect(engine.incomeTax).toBeCloseTo(results.incomeTax + results.benefitTaxDeduction, cents);

      const sliced = ukTakeHomeBySlice(results.taxInput);
      expect(sliced.rawTakeHome).toBeCloseTo(results.netTakeHome, cents);
      expect(sliced.pensionFromPay).toBeCloseTo(results.personalPensionRate, cents);
      expect(sliced.nationalInsurance).toBeCloseTo(results.nationalInsurance, cents);
      expect(sliced.studentLoan).toBeCloseTo(results.studentLoan, cents);
      expect(sliced.incomeTax).toBeCloseTo(results.incomeTax + results.benefitTaxDeduction, cents);
    });

    it('reproduces netTakeHome, pension, NI, loan and total tax when benefitTaxCollectedByCode is true', () => {
      const results = run(
        settings({
          grossSalary: 60000,
          personalAllowance: 11070,
          pensionType: 'relief_at_source',
          personalPensionPercent: 8,
          studentLoanPlan: 'postgrad',
          packageBenefits: [gym],
        }),
      );
      expect(results.benefitTaxCollectedByCode).toBe(true);
      expect(results.taxInput.benefitsInKind).toBe(0);

      const engine = calculateUkTax(results.taxInput);
      expect(engine.takeHome).toBeCloseTo(results.netTakeHome, cents);
      expect(engine.pensionFromPay).toBeCloseTo(results.personalPensionRate, cents);
      expect(engine.nationalInsurance).toBeCloseTo(results.nationalInsurance, cents);
      expect(engine.studentLoan + engine.postgradLoan).toBeCloseTo(results.studentLoan, cents);
      expect(engine.incomeTax).toBeCloseTo(results.incomeTax + results.benefitTaxDeduction, cents);

      const sliced = ukTakeHomeBySlice(results.taxInput);
      expect(sliced.rawTakeHome).toBeCloseTo(results.netTakeHome, cents);
      expect(sliced.pensionFromPay).toBeCloseTo(results.personalPensionRate, cents);
      expect(sliced.nationalInsurance).toBeCloseTo(results.nationalInsurance, cents);
      expect(sliced.studentLoan).toBeCloseTo(results.studentLoan, cents);
      expect(sliced.incomeTax).toBeCloseTo(results.incomeTax + results.benefitTaxDeduction, cents);
    });
  });
});

describe('calculateFinance: cash package items', () => {
  const bonus = benefit({ id: 'bonus', name: 'Bonus', amount: 5000, kind: 'cash' });

  it('shows a £5,000 bonus at £50,000 after tax: 1,946 tax, 116.20 NI, 2,937.80 kept', () => {
    const results = run(settings({ packageBenefits: [bonus] }));
    expect(results.cashBenefits).toHaveLength(1);
    const [item] = results.cashBenefits;
    expect(item.id).toBe('bonus');
    expect(item.name).toBe('Bonus');
    expect(item.gross).toBe(5000);
    expect(item.incomeTax).toBeCloseTo(1946, 3);
    expect(item.nationalInsurance).toBeCloseTo(116.2, 3);
    expect(item.studentLoan).toBe(0);
    expect(item.net).toBeCloseTo(2937.8, 3);
    expect(item).toEqual({ id: 'bonus', name: 'Bonus', ...ukCashAfterTax(engineInput({}), 5000) });
  });

  it('keeps cash out of salary take-home, the deductions and the benefit-in-kind tax', () => {
    const without = run(settings());
    const results = run(settings({ packageBenefits: [bonus] }));
    expect(results.netTakeHome).toBe(without.netTakeHome);
    expect(results.totalDeductions).toBe(without.totalDeductions);
    expect(results.incomeTax).toBe(without.incomeTax);
    expect(results.benefitInKindValue).toBe(0);
    expect(results.benefitTax).toBe(0);
    expect(results.benefitTaxDeduction).toBe(0);
  });

  it('still counts the cash in the package value', () => {
    const results = run(settings({ packageBenefits: [bonus] }));
    expect(results.totalBenefitsValue).toBe(5000);
    expect(results.totalPackage).toBe(55000);
  });

  it('values a percentage item against the salary', () => {
    const results = run(settings({ packageBenefits: [benefit({ kind: 'cash', type: 'percentage', amount: 10 })] }));
    expect(results.cashBenefits[0].gross).toBe(5000);
    expect(results.cashBenefits[0].net).toBeCloseTo(2937.8, 3);
  });

  it('taxes each cash item on its own, not one on top of the other', () => {
    const results = run(
      settings({ packageBenefits: [bonus, benefit({ id: 'second', name: 'Second', amount: 5000, kind: 'cash' })] }),
    );
    expect(results.cashBenefits.map(c => c.id)).toEqual(['bonus', 'second']);
    expect(results.cashBenefits[1].incomeTax).toBe(results.cashBenefits[0].incomeTax);
    expect(results.cashBenefits[1].net).toBe(results.cashBenefits[0].net);
  });

  it('adds the loans that apply to the payment', () => {
    const results = run(settings({ studentLoanPlan: 'plan2', packageBenefits: [bonus] }));
    expect(results.cashBenefits[0].studentLoan).toBeCloseTo(450, 3);
    const postgrad = run(settings({ studentLoanPlan: 'postgrad', packageBenefits: [bonus] }));
    expect(postgrad.cashBenefits[0].studentLoan).toBeCloseTo(300, 3);
  });

  it('is taxed on top of the salary after the pension, per the profile', () => {
    const results = run(
      settings({ pensionType: 'salary_sacrifice', personalPensionPercent: 10, packageBenefits: [bonus] }),
    );
    // Pay £45,000 -> £50,000: all 20% and 8% NI.
    expect(results.cashBenefits[0].incomeTax).toBeCloseTo(1000, 3);
    expect(results.cashBenefits[0].nationalInsurance).toBeCloseTo(400, 3);
    expect(results.cashBenefits[0].net).toBeCloseTo(3600, 3);
  });

  it('uses the Scottish bands', () => {
    const results = run(settings({ ukRegion: 'scotland', packageBenefits: [bonus] }));
    expect(results.cashBenefits[0].incomeTax).toBeCloseTo(2100, 3);
  });

  it('reads the stated allowance', () => {
    const results = run(settings({ personalAllowance: 11070, packageBenefits: [bonus] }));
    expect(results.cashBenefits[0].incomeTax).toBeCloseTo(2000, 3);
  });

  it('lists a zero-value cash item with zeros rather than dropping it', () => {
    const results = run(settings({ packageBenefits: [benefit({ id: 'nil', name: 'Nil', amount: 0, kind: 'cash' })] }));
    expect(results.cashBenefits).toEqual([
      { id: 'nil', name: 'Nil', gross: 0, incomeTax: 0, nationalInsurance: 0, studentLoan: 0, net: 0 },
    ]);
  });

  it('treats a negative cash item as no cash', () => {
    const results = run(settings({ packageBenefits: [benefit({ kind: 'cash', amount: -2000 })] }));
    expect(results.cashBenefits[0].gross).toBe(0);
    expect(results.cashBenefits[0].net).toBe(0);
  });

  it('keeps cash and benefits in kind apart when both are present', () => {
    const results = run(settings({ packageBenefits: [bonus, benefit({ id: 'gym', amount: 1000 })] }));
    expect(results.cashBenefits).toHaveLength(1);
    expect(results.benefitInKindValue).toBe(1000);
    expect(results.benefitTax).toBeCloseTo(346, 3);
    expect(results.totalBenefitsValue).toBe(6000);
  });
});

describe('asPackageBenefits: kind', () => {
  const narrow = (kind: unknown) => asPackageBenefits([{ id: 'x', name: 'X', amount: 10, type: 'monetary', kind }])[0];

  it('keeps cash and benefit-in-kind', () => {
    expect(narrow('cash').kind).toBe('cash');
    expect(narrow('benefit-in-kind').kind).toBe('benefit-in-kind');
  });

  // Before the field, an item cost only the tax typed against it, so an old
  // item keeps its old effect on take-home: none without typed tax (cash),
  // taxed with it (benefit in kind).
  it('reads a missing or unrecognised kind as cash when no tax was typed', () => {
    expect(narrow(undefined).kind).toBe('cash');
    expect(narrow(null).kind).toBe('cash');
    expect(narrow('Cash').kind).toBe('cash');
    expect(narrow('bonus').kind).toBe('cash');
    expect(narrow(5).kind).toBe('cash');
    expect(asPackageBenefits([{ id: 'old', name: 'Old', amount: 5 }])[0].kind).toBe('cash');
  });

  it('reads a missing kind as benefit-in-kind when tax was typed against it', () => {
    expect(asPackageBenefits([{ id: 'old', name: 'Medical', amount: 1500, annualTaxCost: 300 }])[0].kind)
      .toBe('benefit-in-kind');
    expect(asPackageBenefits([{ id: 'old', name: 'Gym', amount: 600, annualTaxCost: 0 }])[0].kind).toBe('cash');
  });

  it('still carries the legacy hand-typed tax figure, which no calculation reads', () => {
    expect(asPackageBenefits([{ id: 'x', amount: 1, annualTaxCost: 120 }])[0].annualTaxCost).toBe(120);
  });

  it('returns nothing for a value that is not a list', () => {
    expect(asPackageBenefits(null)).toEqual([]);
    expect(asPackageBenefits({})).toEqual([]);
    expect(asPackageBenefits([])).toEqual([]);
  });
});
