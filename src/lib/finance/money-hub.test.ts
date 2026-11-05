import { describe, expect, it } from 'vitest';
import {
  calculateMoneyHubCity,
  calculateMoneyHubHousingSensitivity,
  calculateMoneyHubRelocation,
  classifyPersonalBudgetEntry,
  compareMoneyHubCity,
  emptyMoneyHubBudget,
  emptyMoneyHubRelocation,
  mapPersonalBudgetToMoneyHub,
  MONEY_HUB_COSTS,
  MONEY_HUB_ELIGIBILITY_LABELS,
  MONEY_HUB_EQUIVALENT_SALARY_TOLERANCE,
  MONEY_HUB_HOUSING_DELTAS,
  MONEY_HUB_MAX_EQUIVALENT_SALARY,
  MONEY_HUB_PROVISION_KINDS,
  MONEY_HUB_PROVISIONS,
  MONEY_HUB_RELOCATION_ITEMS,
  evaluateMoneyHubBudget,
  moneyHubProvisionsFor,
  solveMoneyHubEquivalentSalary,
  type MoneyHubBudget,
  type MoneyHubCityResult,
  type MoneyHubRelocationInputs,
} from './money-hub';
import type { MoneyHubUkOptions } from './money-hub-payroll';
import { MONEY_HUB_JURISDICTIONS } from './money-hub-catalogue';
import { convertMoneyHubAmount, moneyHubFxSnapshot } from './money-hub-fx';
import { calculateUkTax, UK_STANDARD_TAX_INPUT, UK_TAX_YEAR_LABEL } from './uk-tax-calculator';

const zeroBudget = (): MoneyHubBudget => ({
  housing: 0, utilities: 0, groceries: 0, transport: 0,
  healthcare: 0, leisure: 0, localCharges: 0, commitments: 0,
});

/** An English city through the UK payroll calculator. */
const uk = (income: number | null, budget: MoneyHubBudget, options?: MoneyHubUkOptions): MoneyHubCityResult =>
  calculateMoneyHubCity('GB-ENG', income, budget, { uk: options });

const solve = (budget: MoneyHubBudget, baseline: MoneyHubCityResult, options?: MoneyHubUkOptions) =>
  solveMoneyHubEquivalentSalary('GB-ENG', budget, baseline.monthlySurplus, { uk: options });

const sameCurrency = (result: MoneyHubCityResult, baseline: MoneyHubCityResult) =>
  compareMoneyHubCity(result, 'GBP', baseline, 'GBP', 'GBP', null);

/** One monthly deduction by id; null when deductions are unknown. */
const deduction = (result: MoneyHubCityResult, id: string): number | null =>
  result.monthlyDeductions === null ? null : result.monthlyDeductions.find(line => line.id === id)?.amount ?? null;

describe('calculateMoneyHubCity', () => {
  it('keeps an empty budget unknown and returns independent empty budgets', () => {
    const budget = emptyMoneyHubBudget();
    budget.housing = 1;
    expect(emptyMoneyHubBudget().housing).toBeNull();
    const result = uk(null, emptyMoneyHubBudget());
    expect(result).toEqual({
      monthlyTakeHome: null, monthlyDeductions: null,
      monthlyCosts: null, monthlySurplus: null,
      housingShareOfTakeHome: null, largestCost: null,
      missingCosts: MONEY_HUB_COSTS.map(({ id }) => id), invalid: false, unsupported: null,
    });
  });

  it('does not treat a single entered category as a complete budget', () => {
    const result = uk(50_000, { ...emptyMoneyHubBudget(), housing: 1_000 });
    expect(result.monthlyTakeHome).not.toBeNull();
    expect(result.monthlyCosts).toBeNull();
    expect(result.monthlySurplus).toBeNull();
    expect(result.housingShareOfTakeHome).toBeNull();
    expect(result.largestCost).toBeNull();
    expect(result.missingCosts).toHaveLength(7);
  });

  it('matches the 2026/27 tax engine at £50,000 with no pension', () => {
    expect(UK_TAX_YEAR_LABEL).toBe('2026/27');
    const annual = calculateUkTax({ ...UK_STANDARD_TAX_INPUT, income: 50_000, pensionShare: 0 });
    const result = uk(50_000, zeroBudget());
    expect(result.monthlyTakeHome).toBe(annual.takeHome / 12);
    expect(deduction(result, 'income-tax')).toBe(annual.incomeTax / 12);
    expect(deduction(result, 'national-insurance')).toBe(annual.nationalInsurance / 12);
    expect(deduction(result, 'pension')).toBe(0);
    expect(deduction(result, 'student-loan')).toBe(0);
    expect(result.monthlyTakeHome).toBeCloseTo(39_519.6 / 12, 6);
  });

  it('accepts explicit zero salary and costs', () => {
    expect(uk(0, zeroBudget())).toEqual({
      monthlyTakeHome: 0,
      monthlyDeductions: [
        { id: 'income-tax', label: 'Income tax', amount: 0 },
        { id: 'national-insurance', label: 'National Insurance', amount: 0 },
        { id: 'pension', label: 'Pension from pay', amount: 0 },
        { id: 'student-loan', label: 'Student loan', amount: 0 },
      ],
      monthlyCosts: 0, monthlySurplus: 0,
      housingShareOfTakeHome: null, largestCost: null,
      missingCosts: [], invalid: false, unsupported: null,
    });
  });

  it('keeps all figures unknown when salary is missing', () => {
    const result = uk(null, { ...zeroBudget(), housing: 500 });
    expect(result.monthlyTakeHome).toBeNull();
    expect(result.monthlyCosts).toBeNull();
    expect(result.monthlySurplus).toBeNull();
    expect(result.housingShareOfTakeHome).toBeNull();
    expect(result.largestCost).toBeNull();
    expect(result.invalid).toBe(false);
  });

  it.each([-1, NaN, Infinity, -Infinity])('rejects invalid salary %s without counting it as zero', income => {
    const result = uk(income, zeroBudget());
    expect(result.invalid).toBe(true);
    expect(result.monthlyTakeHome).toBeNull();
    expect(deduction(result, 'income-tax')).toBeNull();
    expect(deduction(result, 'national-insurance')).toBeNull();
    expect(result.monthlyCosts).toBeNull();
    expect(result.monthlySurplus).toBeNull();
    expect(result.housingShareOfTakeHome).toBeNull();
    expect(result.largestCost).toBeNull();
  });

  it.each([-1, NaN, Infinity, -Infinity])('rejects invalid costs %s without losing valid salary', housing => {
    const result = uk(50_000, { ...zeroBudget(), housing });
    expect(result.invalid).toBe(true);
    expect(result.monthlyTakeHome).not.toBeNull();
    expect(result.monthlyCosts).toBeNull();
    expect(result.monthlySurplus).toBeNull();
    expect(result.housingShareOfTakeHome).toBeNull();
    expect(result.largestCost).toBeNull();
  });

  it('rejects a cost total that overflows', () => {
    const result = uk(0, {
      ...zeroBudget(), housing: Number.MAX_VALUE, utilities: Number.MAX_VALUE,
    });
    expect(result.invalid).toBe(true);
    expect(result.monthlyCosts).toBeNull();
    expect(result.housingShareOfTakeHome).toBeNull();
    expect(result.largestCost).toBeNull();
  });

  it('preserves a deficit and sums all monthly categories', () => {
    const result = uk(0, {
      housing: 1_000, utilities: 100, groceries: 200, transport: 50,
      healthcare: 20, leisure: 30, localCharges: 150, commitments: 40,
    });
    expect(result.monthlyCosts).toBe(1_590);
    expect(result.monthlySurplus).toBe(-1_590);
    expect(result.housingShareOfTakeHome).toBeNull();
    expect(result.largestCost).toEqual({ id: 'housing', label: 'Housing', amount: 1_000 });
  });

  it('uses one twelfth of annual tax at the allowance boundary, without monthly PAYE rounding', () => {
    const at = uk(12_570, zeroBudget());
    const above = uk(12_571, zeroBudget());
    expect(deduction(at, 'income-tax')).toBe(0);
    expect(deduction(at, 'national-insurance')).toBe(0);
    expect(deduction(above, 'income-tax')).toBeCloseTo(0.2 / 12, 10);
    expect(deduction(above, 'national-insurance')).toBeCloseTo(0.08 / 12, 10);
    expect(above.monthlyTakeHome).toBeCloseTo(at.monthlyTakeHome! + 0.72 / 12, 10);
  });

  it('computes housingShareOfTakeHome as an exact fraction and 0 when housing is 0', () => {
    const withHousing = uk(50_000, { ...zeroBudget(), housing: 1_200 });
    expect(withHousing.housingShareOfTakeHome).toBe(1_200 / withHousing.monthlyTakeHome!);

    const zeroHousing = uk(50_000, { ...zeroBudget(), housing: 0, groceries: 300 });
    expect(zeroHousing.housingShareOfTakeHome).toBe(0);

    const zeroSalary = uk(0, { ...zeroBudget(), housing: 1_200 });
    expect(zeroSalary.housingShareOfTakeHome).toBeNull();
  });

  it('identifies largestCost and breaks ties in MONEY_HUB_COSTS order, returning null when all costs are 0', () => {
    const allZero = uk(50_000, zeroBudget());
    expect(allZero.largestCost).toBeNull();

    const distinctMax = uk(50_000, {
      ...zeroBudget(),
      utilities: 150,
      groceries: 400,
      transport: 220,
    });
    expect(distinctMax.largestCost).toEqual({
      id: 'groceries',
      label: 'Groceries & household goods',
      amount: 400,
    });

    const tiedMax = uk(50_000, {
      ...zeroBudget(),
      utilities: 500,
      leisure: 500,
      commitments: 500,
    });
    expect(tiedMax.largestCost).toEqual({
      id: 'utilities',
      label: 'Utilities & connectivity',
      amount: 500,
    });
  });
});

describe('compareMoneyHubCity', () => {
  it('returns positive, negative and zero differences, including deficits', () => {
    const baseline = uk(0, { ...zeroBudget(), housing: 1_000 });
    const cheaper = uk(0, { ...zeroBudget(), housing: 800 });
    expect(sameCurrency(cheaper, baseline)).toBe(200);
    expect(sameCurrency(baseline, cheaper)).toBe(-200);
    expect(sameCurrency(baseline, baseline)).toBe(0);
  });

  it('withholds comparisons for missing salary, missing costs or invalid values on either side', () => {
    const complete = uk(0, zeroBudget());
    for (const incomplete of [
      uk(null, zeroBudget()),
      uk(0, emptyMoneyHubBudget()),
      uk(-1, zeroBudget()),
      uk(0, { ...zeroBudget(), housing: -1 }),
    ]) {
      expect(sameCurrency(incomplete, complete)).toBeNull();
      expect(sameCurrency(complete, incomplete)).toBeNull();
    }
  });
});

describe('solveMoneyHubEquivalentSalary', () => {
  it.each([0, 12_570, 50_000, 50_270, 110_001, 150_000])(
    'recovers exact baseline salary £%d when destination budget equals baseline budget',
    salary => {
      const budget: MoneyHubBudget = {
        housing: 1_200,
        utilities: 180,
        groceries: 300,
        transport: 150,
        healthcare: 40,
        leisure: 200,
        localCharges: 160,
        commitments: 100,
      };
      const baseline = uk(salary, budget);
      const solved = solve(budget, baseline);
      expect(solved.status).toBe('complete');
      expect(solved.annualGross).not.toBeNull();
      expect(solved.annualGross!).toBeCloseTo(salary, 6);
      expect(solved.targetMonthlySurplus).toBeCloseTo(baseline.monthlySurplus!, 6);
    },
  );

  it('matches exact monthly surplus at £110,000 inside the stepped personal allowance taper', () => {
    const budget: MoneyHubBudget = { ...zeroBudget(), housing: 1_200 };
    const baseline = uk(110_000, budget);
    const solved = solve(budget, baseline);
    expect(solved.status).toBe('complete');
    expect(solved.annualGross).toBeCloseTo(110_000 - 0.4 / 0.58, 6);
    const verified = uk(solved.annualGross, budget);
    expect(verified.monthlySurplus).toBeCloseTo(baseline.monthlySurplus!, 9);
  });

  it('solves for a lower gross salary when destination basket is cheaper than baseline', () => {
    const londonBudget: MoneyHubBudget = {
      ...zeroBudget(),
      housing: 1_800,
      utilities: 200,
      groceries: 320,
      transport: 180,
      localCharges: 160,
    };
    const manchesterBudget: MoneyHubBudget = {
      ...londonBudget,
      housing: 1_100,
      transport: 100,
    };
    const baseline = uk(50_000, londonBudget);
    const solved = solve(manchesterBudget, baseline);
    expect(solved.status).toBe('complete');
    expect(solved.annualGross).not.toBeNull();
    expect(solved.annualGross!).toBeLessThan(50_000);

    const verified = uk(solved.annualGross, manchesterBudget);
    expect(Math.abs(verified.monthlySurplus! - baseline.monthlySurplus!)).toBeLessThanOrEqual(
      MONEY_HUB_EQUIVALENT_SALARY_TOLERANCE,
    );
  });

  it('solves for a higher gross salary across the £50,270 higher-rate threshold and £100,000 personal allowance taper', () => {
    const cheapBudget: MoneyHubBudget = { ...zeroBudget(), housing: 900 };
    const expensiveHigherRateBudget: MoneyHubBudget = { ...zeroBudget(), housing: 1_900 };
    const baselineBasic = uk(45_000, cheapBudget);
    const solvedHigher = solve(expensiveHigherRateBudget, baselineBasic);
    expect(solvedHigher.status).toBe('complete');
    expect(solvedHigher.annualGross!).toBeGreaterThan(50_270);
    const verifiedHigher = uk(solvedHigher.annualGross, expensiveHigherRateBudget);
    expect(Math.abs(verifiedHigher.monthlySurplus! - baselineBasic.monthlySurplus!)).toBeLessThanOrEqual(
      MONEY_HUB_EQUIVALENT_SALARY_TOLERANCE,
    );

    const baselineNearTaper = uk(95_000, cheapBudget);
    const expensiveTaperBudget: MoneyHubBudget = { ...zeroBudget(), housing: 1_500 };
    const solvedTaper = solve(expensiveTaperBudget, baselineNearTaper);
    expect(solvedTaper.status).toBe('complete');
    expect(solvedTaper.annualGross!).toBeGreaterThan(100_000);
    expect(solvedTaper.annualGross!).toBeLessThan(125_140);
    const verifiedTaper = uk(solvedTaper.annualGross, expensiveTaperBudget);
    expect(Math.abs(verifiedTaper.monthlySurplus! - baselineNearTaper.monthlySurplus!)).toBeLessThanOrEqual(
      MONEY_HUB_EQUIVALENT_SALARY_TOLERANCE,
    );
  });

  it('preserves an attainable baseline deficit and returns unattainable-below-zero when target take-home is negative', () => {
    const baselineWithDeficit = uk(12_000, { ...zeroBudget(), housing: 1_500 });
    expect(baselineWithDeficit.monthlySurplus).toBe(-500);

    const destinationAttainable = solve(
      { ...zeroBudget(), housing: 1_200 },
      baselineWithDeficit,
    );
    expect(destinationAttainable.status).toBe('complete');
    expect(destinationAttainable.targetMonthlyTakeHome).toBeCloseTo(700, 6);
    const verified = uk(destinationAttainable.annualGross, {
      ...zeroBudget(),
      housing: 1_200,
    });
    expect(Math.abs(verified.monthlySurplus! - baselineWithDeficit.monthlySurplus!)).toBeLessThanOrEqual(
      MONEY_HUB_EQUIVALENT_SALARY_TOLERANCE,
    );

    const destinationBelowZero = solve(
      { ...zeroBudget(), housing: 300 },
      baselineWithDeficit,
    );
    expect(destinationBelowZero).toEqual({
      status: 'unattainable-below-zero',
      annualGross: null,
      targetMonthlyTakeHome: -200,
      targetMonthlySurplus: -500,
    });
  });

  it('returns unattainable-above-bound when required take-home exceeds MONEY_HUB_MAX_EQUIVALENT_SALARY', () => {
    const baselineAtMax = uk(MONEY_HUB_MAX_EQUIVALENT_SALARY, zeroBudget());
    const expensiveDestination = { ...zeroBudget(), housing: 50_000 };
    const solved = solve(expensiveDestination, baselineAtMax);
    expect(solved.status).toBe('unattainable-above-bound');
    expect(solved.annualGross).toBeNull();
    expect(solved.targetMonthlySurplus).toBe(baselineAtMax.monthlySurplus);
  });

  it('returns incomplete when baseline or destination has missing costs, missing salary, or invalid inputs', () => {
    const validBaseline = uk(50_000, zeroBudget());
    expect(solve(emptyMoneyHubBudget(), validBaseline)).toEqual({
      status: 'incomplete',
      annualGross: null,
      targetMonthlyTakeHome: null,
      targetMonthlySurplus: null,
    });
    expect(solve({ ...zeroBudget(), housing: -1 }, validBaseline)).toEqual({
      status: 'incomplete',
      annualGross: null,
      targetMonthlyTakeHome: null,
      targetMonthlySurplus: null,
    });
    expect(solve(zeroBudget(), uk(null, zeroBudget()))).toEqual({
      status: 'incomplete',
      annualGross: null,
      targetMonthlyTakeHome: null,
      targetMonthlySurplus: null,
    });
    expect(solve(zeroBudget(), uk(-1, zeroBudget()))).toEqual({
      status: 'incomplete',
      annualGross: null,
      targetMonthlyTakeHome: null,
      targetMonthlySurplus: null,
    });
  });

  it('solves accurately when pension and student/postgrad loans are active', () => {
    const londonBudget: MoneyHubBudget = {
      ...zeroBudget(),
      housing: 1_850,
      utilities: 210,
      groceries: 340,
      transport: 190,
      localCharges: 165,
    };
    const manchesterBudget: MoneyHubBudget = {
      ...londonBudget,
      housing: 1_150,
      transport: 110,
    };

    for (const options of [
      {
        pensionPercent: 5,
        pensionMethod: 'salary-sacrifice',
        pensionBasis: 'salary',
        undergradPlan: 'plan2',
        postgradLoan: true,
      },
      {
        pensionPercent: 5,
        pensionMethod: 'relief-at-source',
        pensionBasis: 'qualifying',
        undergradPlan: 'plan5',
        postgradLoan: false,
      },
    ] satisfies MoneyHubUkOptions[]) {
      const baseline = uk(60_000, londonBudget, options);
      const solved = solve(manchesterBudget, baseline, options);
      expect(solved.status).toBe('complete');
      expect(solved.annualGross).not.toBeNull();
      const verified = uk(solved.annualGross, manchesterBudget, options);
      expect(Math.abs(verified.monthlySurplus! - baseline.monthlySurplus!)).toBeLessThanOrEqual(
        MONEY_HUB_EQUIVALENT_SALARY_TOLERANCE,
      );
    }
  });

  it('returns unattainable-above-bound when pensionPercent is 100 and target take-home is positive', () => {
    const budget: MoneyHubBudget = { ...zeroBudget(), housing: 1_000 };
    const baseline = uk(50_000, budget);
    const solved = solve(budget, baseline, {
      pensionPercent: 100,
      pensionMethod: 'salary-sacrifice',
      pensionBasis: 'salary',
    });
    expect(solved.status).toBe('unattainable-above-bound');
    expect(solved.annualGross).toBeNull();
    expect(solved.targetMonthlySurplus).toBe(baseline.monthlySurplus);
  });
});

describe('calculateMoneyHubCity with UK payroll options', () => {
  it.each([
    { pensionMethod: 'salary-sacrifice' as const, pensionBasis: 'salary' as const },
    { pensionMethod: 'net-pay' as const, pensionBasis: 'salary' as const },
    { pensionMethod: 'relief-at-source' as const, pensionBasis: 'salary' as const },
    { pensionMethod: 'salary-sacrifice' as const, pensionBasis: 'qualifying' as const },
    { pensionMethod: 'relief-at-source' as const, pensionBasis: 'qualifying' as const },
  ])(
    'matches 1/12th of calculateUkTax for 5% pension ($pensionMethod, $pensionBasis)',
    ({ pensionMethod, pensionBasis }) => {
      const options: MoneyHubUkOptions = {
        pensionPercent: 5,
        pensionMethod,
        pensionBasis,
      };
      const result = uk(55_000, zeroBudget(), options);
      const annual = calculateUkTax({
        ...UK_STANDARD_TAX_INPUT,
        income: 55_000,
        pensionContribution: 0,
        pensionShare: 0.05,
        pensionMethod,
        pensionBasis,
      });
      expect(result.invalid).toBe(false);
      expect(result.monthlyTakeHome).toBe(annual.takeHome / 12);
      expect(deduction(result, 'income-tax')).toBe(annual.incomeTax / 12);
      expect(deduction(result, 'national-insurance')).toBe(annual.nationalInsurance / 12);
      expect(deduction(result, 'pension')).toBe(annual.pensionFromPay / 12);
      expect(deduction(result, 'pension')).toBeGreaterThan(0);
    },
  );

  it.each(['plan1', 'plan2', 'plan4', 'plan5'] as const)(
    'populates monthlyStudentLoan for %s with and without postgradLoan',
    undergradPlan => {
      const withUndergradOnly = uk(60_000, zeroBudget(), {
        undergradPlan,
        postgradLoan: false,
      });
      const annualUndergrad = calculateUkTax({
        ...UK_STANDARD_TAX_INPUT,
        income: 60_000,
        pensionShare: 0,
        undergradPlan,
        postgradLoan: false,
      });
      expect(deduction(withUndergradOnly, 'student-loan')).toBe(annualUndergrad.studentLoan / 12);
      expect(deduction(withUndergradOnly, 'student-loan')).toBeGreaterThan(0);

      const withBoth = uk(60_000, zeroBudget(), {
        undergradPlan,
        postgradLoan: true,
      });
      const annualBoth = calculateUkTax({
        ...UK_STANDARD_TAX_INPUT,
        income: 60_000,
        pensionShare: 0,
        undergradPlan,
        postgradLoan: true,
      });
      expect(deduction(withBoth, 'student-loan')).toBe((annualBoth.studentLoan + annualBoth.postgradLoan) / 12);
      expect(deduction(withBoth, 'student-loan')!).toBeGreaterThan(deduction(withUndergradOnly, 'student-loan')!);
    },
  );

  it('respects custom personalAllowance including 0 (BR/0T code) and default 12,570', () => {
    const standard = uk(50_000, zeroBudget(), { personalAllowance: 12_570 });
    const omitted = uk(50_000, zeroBudget(), { personalAllowance: null });
    expect(standard.monthlyTakeHome).toBe(omitted.monthlyTakeHome);

    const zeroAllowance = uk(50_000, zeroBudget(), { personalAllowance: 0 });
    const annualZeroAllowance = calculateUkTax({
      ...UK_STANDARD_TAX_INPUT,
      income: 50_000,
      pensionShare: 0,
      personalAllowance: 0,
    });
    expect(zeroAllowance.invalid).toBe(false);
    expect(zeroAllowance.monthlyTakeHome).toBe(annualZeroAllowance.takeHome / 12);
    expect(deduction(zeroAllowance, 'income-tax')).toBe(annualZeroAllowance.incomeTax / 12);
    expect(zeroAllowance.monthlyTakeHome!).toBeLessThan(standard.monthlyTakeHome!);
  });

  it.each([
    { pensionPercent: -1 },
    { pensionPercent: 101 },
    { pensionPercent: NaN },
    { pensionPercent: Infinity },
    { personalAllowance: -1 },
    { personalAllowance: NaN },
  ])('sets invalid: true and withholds take-home and surplus for invalid option %o', options => {
    const result = uk(50_000, { ...zeroBudget(), housing: 1_000 }, options);
    expect(result.invalid).toBe(true);
    expect(result.monthlyTakeHome).toBeNull();
    expect(deduction(result, 'income-tax')).toBeNull();
    expect(deduction(result, 'national-insurance')).toBeNull();
    expect(deduction(result, 'pension')).toBeNull();
    expect(deduction(result, 'student-loan')).toBeNull();
    expect(result.monthlyCosts).toBeNull();
    expect(result.monthlySurplus).toBeNull();
  });
});

describe('mapPersonalBudgetToMoneyHub', () => {
  it('returns an empty unknown budget when input is empty, only zero/negative items exist, or only savings exist', () => {
    expect(mapPersonalBudgetToMoneyHub([])).toEqual({
      budget: emptyMoneyHubBudget(),
      copiedCategories: [],
      totalMonthlyCopied: 0,
    });

    expect(
      mapPersonalBudgetToMoneyHub([
        { name: 'Home', group: 'needs', items: [{ name: 'Rent', budgeted: 0 }, { name: 'Water', budgeted: -10 }] },
        { name: 'Savings', group: 'savings', budgeted: 500, items: [{ name: 'ISA', budgeted: 500 }] },
        { name: ' savings ', items: [{ name: 'Emergency Fund', budgeted: 300 }] },
      ]),
    ).toEqual({
      budget: emptyMoneyHubBudget(),
      copiedCategories: [],
      totalMonthlyCopied: 0,
    });
  });

  it('maps a single row cleanly and zero-fills untouched categories', () => {
    const mapped = mapPersonalBudgetToMoneyHub([
      { name: 'Home', group: 'needs', items: [{ name: 'Rent', budgeted: 1_250 }] },
    ]);
    expect(mapped).toEqual({
      budget: {
        ...zeroBudget(),
        housing: 1_250,
      },
      copiedCategories: ['housing'],
      totalMonthlyCopied: 1_250,
    });
  });

  it('maps standard UK default categories into the 8 MoneyHubCostId buckets and excludes Savings', () => {
    const mapped = mapPersonalBudgetToMoneyHub([
      {
        name: 'Home',
        group: 'needs',
        items: [
          { name: 'Rent', budgeted: 1_400 },
          { name: 'Council Tax', budgeted: 165 },
          { name: 'Energy', budgeted: 120 },
          { name: 'Water', budgeted: 35 },
          { name: 'Internet', budgeted: 30 },
          { name: 'Phone', budgeted: 15 },
        ],
      },
      {
        name: 'Food & Drink',
        group: 'needs',
        items: [
          { name: 'Groceries', budgeted: 320 },
          { name: 'Restaurants', budgeted: 150 },
        ],
      },
      {
        name: 'Transportation',
        group: 'needs',
        items: [{ name: 'Public Transport', budgeted: 160 }],
      },
      {
        name: 'Self Care',
        group: 'wants',
        items: [{ name: 'Gym', budgeted: 45 }],
      },
      {
        name: 'Debt & Subscriptions',
        group: 'needs',
        items: [
          { name: 'Loans', budgeted: 200 },
          { name: 'Subscriptions', budgeted: 25 },
        ],
      },
      {
        name: 'Savings',
        group: 'savings',
        items: [{ name: 'Emergency Fund', budgeted: 400 }],
      },
    ]);

    expect(mapped.budget).toEqual({
      housing: 1_400,
      utilities: 120 + 35 + 30 + 15,
      groceries: 320,
      transport: 160,
      healthcare: 0,
      leisure: 150 + 45,
      localCharges: 165,
      commitments: 200 + 25,
    });
    expect(mapped.copiedCategories).toEqual([
      'housing',
      'utilities',
      'groceries',
      'transport',
      'leisure',
      'localCharges',
      'commitments',
    ]);
    expect(mapped.totalMonthlyCopied).toBe(2_665);
  });

  it('adds unallocated category-level budgeted remainder when item budgets sum to less than cat.budgeted', () => {
    const mapped = mapPersonalBudgetToMoneyHub([
      {
        name: 'Home',
        group: 'needs',
        budgeted: 1_600,
        items: [
          { name: 'Rent', budgeted: 1_200 },
          { name: 'Council Tax', budgeted: 150 },
        ],
      },
      {
        name: 'Healthcare',
        group: 'needs',
        budgeted: 60,
      },
    ]);

    expect(mapped.budget.housing).toBe(1_200 + 250);
    expect(mapped.budget.localCharges).toBe(150);
    expect(mapped.budget.healthcare).toBe(60);
    expect(mapped.totalMonthlyCopied).toBe(1_660);
    expect(classifyPersonalBudgetEntry('Misc Wants', 'Cinema', 'wants')).toBe('leisure');
    expect(classifyPersonalBudgetEntry('Misc Wants', 'Credit card repayment', 'wants')).toBe('commitments');
  });
});

describe('mapPersonalBudgetToMoneyHub category totals', () => {
  it('uses the category budget as the total, scaling over-allocated items down to it', () => {
    const mapped = mapPersonalBudgetToMoneyHub([
      { name: 'Home', group: 'needs', budgeted: 1_000, items: [{ name: 'Rent', budgeted: 900 }, { name: 'Energy', budgeted: 300 }] },
    ]);
    expect(mapped.totalMonthlyCopied).toBeCloseTo(1_000, 10);
    expect(mapped.budget.housing).toBeCloseTo(750, 10);
    expect(mapped.budget.utilities).toBeCloseTo(250, 10);
  });

  it('copies nothing from a category budgeted at zero, as the Budget screen shows it', () => {
    const mapped = mapPersonalBudgetToMoneyHub([
      { name: 'Home', group: 'needs', budgeted: 0, items: [{ name: 'Rent', budgeted: 900 }] },
    ]);
    expect(mapped.totalMonthlyCopied).toBe(0);
  });

  it('keeps unmatched items in a Home category out of housing', () => {
    expect(classifyPersonalBudgetEntry('Home', 'Childcare', 'needs')).toBe('commitments');
    expect(classifyPersonalBudgetEntry('Home', 'Pet insurance', 'needs')).toBe('commitments');
    expect(classifyPersonalBudgetEntry('Home', 'Repairs', 'needs')).toBe('housing');
    expect(classifyPersonalBudgetEntry('Transport', 'Car repairs', 'needs')).toBe('transport');
    expect(classifyPersonalBudgetEntry('Car', 'Maintenance', 'needs')).toBe('transport');
    expect(classifyPersonalBudgetEntry('Home', '', 'needs')).toBe('housing');
  });
});

describe('MONEY_HUB_PROVISIONS', () => {
  it('covers all three provision kinds across all 19 provisions, has dated official sources, and never alters cash outputs', () => {
    expect(MONEY_HUB_PROVISIONS).toHaveLength(19);
    const kinds = new Set(MONEY_HUB_PROVISIONS.map(p => p.kind));
    expect(kinds).toEqual(new Set(MONEY_HUB_PROVISION_KINDS.map(k => k.id)));

    for (const provision of MONEY_HUB_PROVISIONS) {
      expect(provision.reviewedDate).toMatch(/^2026-11-0[45]$/);
      expect(provision.sourceUrl).toMatch(/^https:\/\//);
      expect(MONEY_HUB_ELIGIBILITY_LABELS[provision.eligibilityState]).toBeTruthy();
      expect(provision.statutoryEntitlement.length).toBeGreaterThan(0);
      expect(provision.employerPackageNote.length).toBeGreaterThan(0);
      expect(provision.separateChargesAndLimits.length).toBeGreaterThan(0);
      expect(provision.cityComparisonNote.length).toBeGreaterThan(0);
    }

    const result = uk(50_000, { ...zeroBudget(), localCharges: 150 });
    const annual = calculateUkTax({ ...UK_STANDARD_TAX_INPUT, income: 50_000, pensionShare: 0 });
    expect(result.monthlyTakeHome).toBe(annual.takeHome / 12);
    expect(result.monthlySurplus).toBe(annual.takeHome / 12 - 150);
  });
});

describe('evaluateMoneyHubBudget (user-supplied take-home)', () => {
  it('keeps empty input unknown without inventing deductions', () => {
    expect(evaluateMoneyHubBudget(null, emptyMoneyHubBudget())).toEqual({
      monthlyTakeHome: null, monthlyDeductions: null, monthlyCosts: null,
      monthlySurplus: null, housingShareOfTakeHome: null, largestCost: null,
      missingCosts: MONEY_HUB_COSTS.map(cost => cost.id), invalid: false, unsupported: null,
    });
  });

  it('withholds a total when only one category is entered', () => {
    const result = evaluateMoneyHubBudget(3_000, { ...emptyMoneyHubBudget(), housing: 1_000 });
    expect(result.monthlyTakeHome).toBe(3_000);
    expect(result.missingCosts).toHaveLength(7);
    expect(result.monthlyCosts).toBeNull();
    expect(result.monthlySurplus).toBeNull();
  });

  it('accepts zero net and explicit zero costs while deductions stay unknown', () => {
    const result = evaluateMoneyHubBudget(0, zeroBudget());
    expect(result.monthlySurplus).toBe(0);
    expect(result.housingShareOfTakeHome).toBeNull();
    expect(result.monthlyDeductions).toBeNull();
    expect(result.invalid).toBe(false);
  });

  it.each([-1, NaN, Infinity, -Infinity])('rejects invalid net %s', net => {
    const result = evaluateMoneyHubBudget(net, zeroBudget());
    expect(result.invalid).toBe(true);
    expect(result.monthlyTakeHome).toBeNull();
    expect(result.monthlyCosts).toBeNull();
  });

  it('preserves deficits, housing share and first-category tie order', () => {
    const result = evaluateMoneyHubBudget(1_000, { ...zeroBudget(), housing: 800, utilities: 800 });
    expect(result.monthlyCosts).toBe(1_600);
    expect(result.monthlySurplus).toBe(-600);
    expect(result.housingShareOfTakeHome).toBe(0.8);
    expect(result.largestCost).toEqual({ id: 'housing', label: 'Housing', amount: 800 });
  });

  it('withholds an overflowing housing share', () => {
    expect(evaluateMoneyHubBudget(Number.MIN_VALUE, { ...zeroBudget(), housing: 1 }).housingShareOfTakeHome).toBeNull();
  });
});

describe('calculateMoneyHubCity outside England', () => {
  it('calculates Berlin and Amsterdam in euros with their own deductions', () => {
    const berlin = calculateMoneyHubCity('DE', 50_000, { ...zeroBudget(), housing: 1_200 });
    expect(berlin.monthlyTakeHome).toBeCloseTo(32_329 / 12, 6);
    expect(berlin.monthlyDeductions!.map(line => line.id)).toEqual([
      'income-tax', 'solidarity-surcharge', 'pension-insurance', 'unemployment-insurance', 'health-insurance', 'care-insurance',
    ]);
    expect(berlin.monthlySurplus).toBeCloseTo(32_329 / 12 - 1_200, 6);

    const amsterdam = calculateMoneyHubCity('NL', 50_000, zeroBudget());
    expect(amsterdam.monthlyTakeHome).toBeCloseTo(39_140.33078 / 12, 6);
  });

  it('withholds take-home for an income the calculator does not model, and says why', () => {
    const result = calculateMoneyHubCity('DE', 18_000, zeroBudget());
    expect(result.monthlyTakeHome).toBeNull();
    expect(result.monthlySurplus).toBeNull();
    expect(result.invalid).toBe(false);
    expect(result.unsupported).toMatch(/Midijob/);
  });

  it('has no calculated take-home where payroll is user-supplied', () => {
    const result = calculateMoneyHubCity('US-NY', 100_000, zeroBudget());
    expect(result.monthlyTakeHome).toBeNull();
    expect(result.unsupported).toMatch(/New York State/);
  });

  it('flags invalid German options', () => {
    const result = calculateMoneyHubCity('DE', 50_000, zeroBudget(), { de: { healthAdditionalPercent: -1 } });
    expect(result.invalid).toBe(true);
    expect(result.monthlyTakeHome).toBeNull();
  });
});

describe('compareMoneyHubCity across currencies', () => {
  const fx = moneyHubFxSnapshot('2026-11-05', 'GBP', { EUR: 1.25, USD: 1.5 });
  const baseline = evaluateMoneyHubBudget(0, { ...zeroBudget(), housing: 100 });
  const destination = evaluateMoneyHubBudget(0, { ...zeroBudget(), housing: 150 });

  it('compares deficits in one display currency and preserves the sign', () => {
    expect(compareMoneyHubCity(destination, 'EUR', baseline, 'GBP', 'GBP', fx)).toBe(-20);
    expect(compareMoneyHubCity(destination, 'EUR', baseline, 'GBP', 'EUR', fx)).toBe(-25);
    expect(compareMoneyHubCity(baseline, 'GBP', destination, 'EUR', 'GBP', fx)).toBe(20);
    expect(compareMoneyHubCity(destination, 'EUR', baseline, 'USD', 'GBP', fx)).toBeCloseTo(-150 / 1.25 - -100 / 1.5, 10);
  });

  it('allows same-currency comparison without FX and withholds cross-currency comparison without it', () => {
    expect(compareMoneyHubCity(destination, 'EUR', baseline, 'EUR', 'EUR', null)).toBe(-50);
    expect(compareMoneyHubCity(destination, 'EUR', baseline, 'GBP', 'EUR', null)).toBeNull();
    expect(compareMoneyHubCity(destination, 'CHF', baseline, 'GBP', 'GBP', fx)).toBeNull();
  });

  it('withholds comparisons when either side is incomplete or invalid', () => {
    for (const result of [
      evaluateMoneyHubBudget(null, zeroBudget()),
      evaluateMoneyHubBudget(0, emptyMoneyHubBudget()),
      evaluateMoneyHubBudget(-1, zeroBudget()),
      evaluateMoneyHubBudget(0, { ...zeroBudget(), housing: -1 }),
    ]) {
      expect(compareMoneyHubCity(result, 'EUR', baseline, 'GBP', 'EUR', fx)).toBeNull();
      expect(compareMoneyHubCity(baseline, 'GBP', result, 'EUR', 'EUR', fx)).toBeNull();
    }
  });

  it('rejects overflow in the subtraction', () => {
    const high = evaluateMoneyHubBudget(Number.MAX_VALUE, zeroBudget());
    const low = evaluateMoneyHubBudget(0, { ...zeroBudget(), housing: Number.MAX_VALUE });
    expect(compareMoneyHubCity(high, 'EUR', low, 'EUR', 'EUR', null)).toBeNull();
  });
});

describe('solveMoneyHubEquivalentSalary outside England', () => {
  const londonBudget: MoneyHubBudget = { ...zeroBudget(), housing: 1_800, groceries: 320, transport: 180, localCharges: 160 };
  const berlinBudget: MoneyHubBudget = { ...zeroBudget(), housing: 1_300, groceries: 300, transport: 58, localCharges: 20 };

  it('solves a Berlin gross that keeps a London surplus at a dated rate', () => {
    const fx = moneyHubFxSnapshot('2026-11-05', 'GBP', { EUR: 1.15 });
    const london = uk(60_000, londonBudget);
    const target = convertMoneyHubAmount(london.monthlySurplus, 'GBP', 'EUR', fx);
    const solved = solveMoneyHubEquivalentSalary('DE', berlinBudget, target);
    expect(solved.status).toBe('complete');
    const verified = calculateMoneyHubCity('DE', solved.annualGross, berlinBudget);
    expect(Math.abs(verified.monthlySurplus! - target!)).toBeLessThanOrEqual(MONEY_HUB_EQUIVALENT_SALARY_TOLERANCE);
    expect(compareMoneyHubCity(verified, 'EUR', london, 'GBP', 'GBP', fx)).toBeCloseTo(0, 2);
  });

  it('recovers the Dutch gross for the same Dutch budget, verifying across the official credit steps', () => {
    for (const income of [20_000, 45_592, 78_426, 140_000]) {
      const baseline = calculateMoneyHubCity('NL', income, berlinBudget);
      const solved = solveMoneyHubEquivalentSalary('NL', berlinBudget, baseline.monthlySurplus);
      expect(solved.status).toBe('complete');
      // The labour credit's published bases leave a cent-level step at 45,592, so
      // two grosses a few cents apart can share a surplus; the surplus is what counts.
      expect(Math.abs(solved.annualGross! - income)).toBeLessThan(1);
      const verified = calculateMoneyHubCity('NL', solved.annualGross, berlinBudget);
      expect(Math.abs(verified.monthlySurplus! - baseline.monthlySurplus!)).toBeLessThanOrEqual(
        MONEY_HUB_EQUIVALENT_SALARY_TOLERANCE,
      );
    }
  });

  it('reports a target that only a German Midijob income could meet as unsupported', () => {
    const solved = solveMoneyHubEquivalentSalary('DE', { ...zeroBudget(), housing: 500 }, 200);
    expect(solved.status).toBe('unsupported');
    expect(solved.annualGross).toBeNull();
    expect(solveMoneyHubEquivalentSalary('DE', zeroBudget(), 0).status).toBe('unsupported');
  });

  it('does not solve where payroll is user-supplied, and needs a target', () => {
    expect(solveMoneyHubEquivalentSalary('US-CA', zeroBudget(), 1_000).status).toBe('not-calculated');
    expect(solveMoneyHubEquivalentSalary('DE', zeroBudget(), null).status).toBe('incomplete');
    expect(solveMoneyHubEquivalentSalary('DE', zeroBudget(), 1_000, { de: { healthAdditionalPercent: 50 } }).status).toBe('incomplete');
  });
});

describe('moneyHubProvisionsFor', () => {
  it('covers all three provision kinds for every calculated jurisdiction and returns empty for user-supplied jurisdictions', () => {
    const allKinds = new Set(MONEY_HUB_PROVISION_KINDS.map(k => k.id));
    for (const jurisdiction of MONEY_HUB_JURISDICTIONS) {
      const provisions = moneyHubProvisionsFor(jurisdiction.id);
      if (jurisdiction.payroll === 'calculated') {
        expect(provisions.length).toBeGreaterThan(0);
        expect(new Set(provisions.map(p => p.kind))).toEqual(allKinds);
      } else {
        expect(provisions).toEqual([]);
      }
    }
  });

  it('distinguishes England vs devolved UK healthcare and Great Britain Council Tax vs Northern Ireland domestic rates', () => {
    const engIds = moneyHubProvisionsFor('GB-ENG').map(p => p.id);
    const sctIds = moneyHubProvisionsFor('GB-SCT').map(p => p.id);
    const wlsIds = moneyHubProvisionsFor('GB-WLS').map(p => p.id);
    const nirIds = moneyHubProvisionsFor('GB-NIR').map(p => p.id);

    expect(engIds).toContain('nhs-healthcare');
    expect(engIds).not.toContain('nhs-scotland-healthcare');
    expect(sctIds).toContain('nhs-scotland-healthcare');
    for (const ids of [sctIds, wlsIds, nirIds]) expect(ids).not.toContain('nhs-healthcare');
    // Each provision is scoped to the nations its source covers.
    for (const ids of [wlsIds, nirIds]) expect(ids).not.toContain('nhs-scotland-healthcare');

    for (const ids of [engIds, wlsIds]) expect(ids).toContain('local-council-services');
    expect(sctIds).toContain('scotland-council-tax');
    expect(sctIds).not.toContain('local-council-services');
    expect(nirIds).toContain('ni-domestic-rates');
    for (const id of ['local-council-services', 'scotland-council-tax', 'sick-and-parental-protections']) {
      expect(nirIds).not.toContain(id);
    }
  });

  it('scopes German and Dutch statutory provisions to their respective jurisdictions', () => {
    expect(moneyHubProvisionsFor('DE').map(p => p.id)).toEqual([
      'de-occupational-pension',
      'de-statutory-healthcare',
      'de-statutory-pension-unemployment',
      'de-leave-and-sick-pay',
    ]);
    expect(moneyHubProvisionsFor('NL').map(p => p.id)).toEqual([
      'nl-holiday-allowance',
      'nl-occupational-pension',
      'nl-zorgverzekering',
      'nl-aow-national-insurance',
      'nl-leave-and-sick-pay',
    ]);
    for (const jurisdiction of ['US-NY', 'CH-ZH', 'FR'] as const) {
      expect(moneyHubProvisionsFor(jurisdiction)).toEqual([]);
    }
  });
});

describe('calculateMoneyHubHousingSensitivity', () => {
  it('returns null when city result is incomplete, invalid, missing take-home, or housing is missing/negative', () => {
    const validBudget: MoneyHubBudget = { ...zeroBudget(), housing: 1_000, groceries: 300 };
    const validResult = evaluateMoneyHubBudget(3_000, validBudget);

    expect(calculateMoneyHubHousingSensitivity(evaluateMoneyHubBudget(null, validBudget), validBudget)).toBeNull();
    expect(calculateMoneyHubHousingSensitivity(evaluateMoneyHubBudget(3_000, emptyMoneyHubBudget()), emptyMoneyHubBudget())).toBeNull();
    expect(
      calculateMoneyHubHousingSensitivity(
        evaluateMoneyHubBudget(3_000, { ...emptyMoneyHubBudget(), housing: 1_000 }),
        { ...emptyMoneyHubBudget(), housing: 1_000 },
      ),
    ).toBeNull();
    expect(calculateMoneyHubHousingSensitivity(evaluateMoneyHubBudget(-1, validBudget), validBudget)).toBeNull();
    expect(calculateMoneyHubHousingSensitivity(validResult, { ...validBudget, housing: null })).toBeNull();
    expect(calculateMoneyHubHousingSensitivity(validResult, { ...validBudget, housing: -100 })).toBeNull();
  });

  it('computes -20%, -10%, 0%, +10%, +20% housing points and preserves deficits when higher rent pushes surplus below zero', () => {
    const budget: MoneyHubBudget = { ...zeroBudget(), housing: 1_500, utilities: 200, groceries: 300 };
    const result = evaluateMoneyHubBudget(1_900, budget);
    const sensitivity = calculateMoneyHubHousingSensitivity(result, budget, 200);

    expect(sensitivity).not.toBeNull();
    expect(sensitivity!.points.map(p => p.delta)).toEqual(MONEY_HUB_HOUSING_DELTAS);
    const expected = [
      { delta: -0.2, housingCost: 1_200, monthlyCosts: 1_700, monthlySurplus: 200, housingShareOfTakeHome: 1_200 / 1_900 },
      { delta: -0.1, housingCost: 1_350, monthlyCosts: 1_850, monthlySurplus: 50, housingShareOfTakeHome: 1_350 / 1_900 },
      { delta: 0, housingCost: 1_500, monthlyCosts: 2_000, monthlySurplus: -100, housingShareOfTakeHome: 1_500 / 1_900 },
      { delta: 0.1, housingCost: 1_650, monthlyCosts: 2_150, monthlySurplus: -250, housingShareOfTakeHome: 1_650 / 1_900 },
      { delta: 0.2, housingCost: 1_800, monthlyCosts: 2_300, monthlySurplus: -400, housingShareOfTakeHome: 1_800 / 1_900 },
    ];
    for (let i = 0; i < expected.length; i += 1) {
      const point = sensitivity!.points[i];
      const exp = expected[i];
      expect(point.delta).toBe(exp.delta);
      expect(point.housingCost).toBeCloseTo(exp.housingCost, 10);
      expect(point.monthlyCosts).toBeCloseTo(exp.monthlyCosts, 10);
      expect(point.monthlySurplus).toBeCloseTo(exp.monthlySurplus, 10);
      expect(point.housingShareOfTakeHome).toBeCloseTo(exp.housingShareOfTakeHome, 10);
    }
  });

  it('computes breakEvenHousing and returns null when non-housing costs alone exceed monthlyTakeHome', () => {
    const attainableBudget: MoneyHubBudget = { ...zeroBudget(), housing: 1_200, utilities: 200, groceries: 400 };
    const attainableResult = evaluateMoneyHubBudget(2_500, attainableBudget);
    const attainable = calculateMoneyHubHousingSensitivity(attainableResult, attainableBudget);
    expect(attainable!.breakEvenHousing).toBe(1_900);

    const zeroTakeHomeResult = evaluateMoneyHubBudget(0, { ...zeroBudget(), housing: 500 });
    const exactZeroBreakEven = calculateMoneyHubHousingSensitivity(zeroTakeHomeResult, { ...zeroBudget(), housing: 500 });
    expect(exactZeroBreakEven!.breakEvenHousing).toBe(0);
    expect(exactZeroBreakEven!.points.every(p => p.housingShareOfTakeHome === null)).toBe(true);

    const overwhelmedBudget: MoneyHubBudget = { ...zeroBudget(), housing: 800, utilities: 600, groceries: 700 };
    const overwhelmedResult = evaluateMoneyHubBudget(1_000, overwhelmedBudget);
    const overwhelmed = calculateMoneyHubHousingSensitivity(overwhelmedResult, overwhelmedBudget);
    expect(overwhelmed!.breakEvenHousing).toBeNull();
  });

  it('computes housingToMatchBaselineSurplus and returns null when target is null, non-finite, or requires negative housing cost', () => {
    const budget: MoneyHubBudget = { ...zeroBudget(), housing: 1_200, utilities: 200, groceries: 300 };
    const result = evaluateMoneyHubBudget(3_000, budget);

    expect(calculateMoneyHubHousingSensitivity(result, budget, null)!.housingToMatchBaselineSurplus).toBeNull();
    expect(calculateMoneyHubHousingSensitivity(result, budget, NaN)!.housingToMatchBaselineSurplus).toBeNull();
    expect(calculateMoneyHubHousingSensitivity(result, budget, 1_000)!.housingToMatchBaselineSurplus).toBe(1_500);
    expect(calculateMoneyHubHousingSensitivity(result, budget, 2_500)!.housingToMatchBaselineSurplus).toBe(0);
    expect(calculateMoneyHubHousingSensitivity(result, budget, 2_501)!.housingToMatchBaselineSurplus).toBeNull();
    // Baseline deficit allows a higher housing cost to match that deficit
    expect(calculateMoneyHubHousingSensitivity(result, budget, -200)!.housingToMatchBaselineSurplus).toBe(2_700);
  });
});

describe('calculateMoneyHubRelocation', () => {
  const zeroRelocation = (): MoneyHubRelocationInputs => ({
    tenancyDeposit: 0,
    otherDeposits: 0,
    visaAndLegal: 0,
    travelAndShipping: 0,
    agencyAndAdmin: 0,
    setupAndFurnishing: 0,
  });

  it('returns independent empty objects from emptyMoneyHubRelocation() and keeps totals null when any field is missing', () => {
    const first = emptyMoneyHubRelocation();
    first.tenancyDeposit = 1_500;
    expect(emptyMoneyHubRelocation().tenancyDeposit).toBeNull();

    const emptyResult = calculateMoneyHubRelocation(emptyMoneyHubRelocation(), 1_000, 400);
    expect(emptyResult).toEqual({
      depositsTiedUp: null,
      consumedExpenses: null,
      totalUpfrontCash: null,
      monthsOfSurplusToRecoverConsumed: null,
      monthsOfGainToRecoverConsumed: null,
      missingItems: MONEY_HUB_RELOCATION_ITEMS.map(item => item.id),
      invalid: false,
    });

    const singleItem = calculateMoneyHubRelocation({ ...emptyMoneyHubRelocation(), tenancyDeposit: 2_000 }, 1_000, 400);
    expect(singleItem.depositsTiedUp).toBeNull();
    expect(singleItem.consumedExpenses).toBeNull();
    expect(singleItem.totalUpfrontCash).toBeNull();
    expect(singleItem.missingItems).toHaveLength(5);
    expect(singleItem.invalid).toBe(false);
  });

  it('separates refundable deposits from consumed expenses and sums totalUpfrontCash', () => {
    const result = calculateMoneyHubRelocation(
      {
        tenancyDeposit: 2_400,
        otherDeposits: 300,
        visaAndLegal: 800,
        travelAndShipping: 1_200,
        agencyAndAdmin: 150,
        setupAndFurnishing: 850,
      },
      1_500,
      500,
    );

    expect(result).toEqual({
      depositsTiedUp: 2_700,
      consumedExpenses: 3_000,
      totalUpfrontCash: 5_700,
      monthsOfSurplusToRecoverConsumed: 2,
      monthsOfGainToRecoverConsumed: 6,
      missingItems: [],
      invalid: false,
    });
  });

  it('computes recovery months from consumedExpenses only, returns 0 when consumedExpenses === 0, and returns null when surplus/gain <= 0 for positive consumed expenses', () => {
    const depositsOnly = calculateMoneyHubRelocation(
      {
        ...zeroRelocation(),
        tenancyDeposit: 3_000,
        otherDeposits: 500,
      },
      -200,
      0,
    );
    expect(depositsOnly.depositsTiedUp).toBe(3_500);
    expect(depositsOnly.consumedExpenses).toBe(0);
    expect(depositsOnly.totalUpfrontCash).toBe(3_500);
    expect(depositsOnly.monthsOfSurplusToRecoverConsumed).toBe(0);
    expect(depositsOnly.monthsOfGainToRecoverConsumed).toBe(0);

    const depositsOnlyNullSurplus = calculateMoneyHubRelocation(zeroRelocation(), null, null);
    expect(depositsOnlyNullSurplus.monthsOfSurplusToRecoverConsumed).toBeNull();
    expect(depositsOnlyNullSurplus.monthsOfGainToRecoverConsumed).toBeNull();

    const positiveConsumed = {
      ...zeroRelocation(),
      tenancyDeposit: 2_000,
      travelAndShipping: 1_200,
    };
    expect(calculateMoneyHubRelocation(positiveConsumed, 0, -100)).toEqual({
      depositsTiedUp: 2_000,
      consumedExpenses: 1_200,
      totalUpfrontCash: 3_200,
      monthsOfSurplusToRecoverConsumed: null,
      monthsOfGainToRecoverConsumed: null,
      missingItems: [],
      invalid: false,
    });
    expect(calculateMoneyHubRelocation(positiveConsumed, -400, 300)).toEqual({
      depositsTiedUp: 2_000,
      consumedExpenses: 1_200,
      totalUpfrontCash: 3_200,
      monthsOfSurplusToRecoverConsumed: null,
      monthsOfGainToRecoverConsumed: 4,
      missingItems: [],
      invalid: false,
    });
  });

  it.each([-1, NaN, Infinity, -Infinity])('rejects invalid relocation amount %s with invalid: true', badValue => {
    const result = calculateMoneyHubRelocation(
      {
        ...zeroRelocation(),
        visaAndLegal: badValue,
      },
      1_000,
      500,
    );
    expect(result).toEqual({
      depositsTiedUp: null,
      consumedExpenses: null,
      totalUpfrontCash: null,
      monthsOfSurplusToRecoverConsumed: null,
      monthsOfGainToRecoverConsumed: null,
      missingItems: [],
      invalid: true,
    });
  });

  it('rejects overflowing relocation totals with invalid: true', () => {
    const overflow = calculateMoneyHubRelocation(
      {
        ...zeroRelocation(),
        tenancyDeposit: Number.MAX_VALUE,
        setupAndFurnishing: Number.MAX_VALUE,
      },
      1_000,
      500,
    );
    expect(overflow.invalid).toBe(true);
    expect(overflow.totalUpfrontCash).toBeNull();
    expect(overflow.depositsTiedUp).toBeNull();
    expect(overflow.consumedExpenses).toBeNull();
  });
});

