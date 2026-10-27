/**
 * A "what if" UK take-home and marginal-rate calculator for tax year 2026/27.
 *
 * Answers questions like "what do I keep of the next £1k?" and "where are the
 * cliffs?" for a hypothetical income, not for anyone's recorded payslips. The
 * statutory constants sit in one typed rule set below so next year's update is
 * a single edit, and nothing is read from anywhere: every assumption is an
 * argument the caller states and the UI can show.
 *
 * Figures are returned **unrounded**. The UI formats; rounding here would make
 * the marginal rate (a difference of two totals) jitter by pence.
 *
 * Deliberately simplified, and worth stating on the page that shows it: annual
 * basis (no monthly cumulative PAYE), no Class 2 NI, no dividends or savings
 * income, no Gift Aid, no pension annual-allowance or tapering, and student
 * loan repayments are not rounded down to whole pounds.
 *
 * Pure, like everything here: no clock, no Supabase, no model output anywhere
 * near the arithmetic.
 */

export type UkTaxRegion = 'rUK' | 'scotland';
export type UkIncomeKind = 'employed' | 'self-employed';
export type UkPensionMethod = 'salary-sacrifice' | 'net-pay' | 'relief-at-source';
export type UkUndergradPlan = 'none' | 'plan1' | 'plan2' | 'plan4' | 'plan5';

export interface UkTaxInput {
  /** £/yr: gross salary (employed) or taxable profit (self-employed). */
  income: number;
  kind: UkIncomeKind;
  region: UkTaxRegion;
  /** Taxable benefit-in-kind value, £/yr. Employed only; ignored otherwise. */
  benefitsInKind: number;
  /** GROSS £/yr, whatever the method. Clamped to [0, income]. */
  pensionContribution: number;
  pensionMethod: UkPensionMethod;
  undergradPlan: UkUndergradPlan;
  postgradLoan: boolean;
  /** Children child benefit is claimed for. */
  children: number;
  /** £/yr of childcare support lost in full once adjusted net income passes £100,000. */
  childcareSupport: number;
  /** Receives a transferred marriage allowance. */
  marriageAllowance: boolean;
}

export interface UkTaxBreakdown {
  /** Income plus benefits in kind (BIK only when employed). */
  grossIncome: number;
  adjustedNetIncome: number;
  personalAllowance: number;
  taxableIncome: number;
  /** After the marriage allowance reduction. */
  incomeTax: number;
  marriageAllowanceRelief: number;
  /** Class 1 employee, or Class 4 when self-employed. */
  nationalInsurance: number;
  /** Undergraduate plan. */
  studentLoan: number;
  postgradLoan: number;
  /** Annual amount claimed. */
  childBenefit: number;
  /** The High Income Child Benefit Charge. */
  childBenefitCharge: number;
  /** `childcareSupport`, or 0 once it has been lost. */
  childcareSupportKept: number;
  /** Cash that leaves pay for the pension (80% of gross under relief at source). */
  pensionFromPay: number;
  takeHome: number;
  /** `takeHome` plus the childcare support still kept. */
  netWithSupport: number;
  /** (tax + NI + student loans + HICBC) / gross income; 0 when gross is 0. */
  effectiveRate: number;
  /** Adjusted net income less £100,000: negative is headroom. */
  aboveTaperStart: number;
  /** Adjusted net income less £60,000: negative is headroom. */
  aboveChildBenefitStart: number;
}

export interface UkTaxCliff {
  kind: 'childcare' | 'marriage-allowance';
  /** The `income` value at which the benefit is last held; one pound more loses it. */
  atIncome: number;
  /** What is lost by crossing it. */
  cost: number;
}

export interface UkTaxCurvePoint {
  income: number;
  takeHome: number;
  netWithSupport: number;
  /** Fraction of the next £1 of `income` lost to tax, NI, loans and HICBC. */
  marginalRate: number;
}

/** The tax year the rule set below describes. */
export const UK_TAX_YEAR_LABEL = '2026/27';

/** 6 Apr 2026 and 5 Apr 2027 are both Mondays, so the tax year holds 53 benefit weeks (as 2020/21 did). */
export const UK_CHILD_BENEFIT_WEEKS = 53;

interface Band {
  /** Cumulative upper limit on taxable income. */
  limit: number;
  rate: number;
}

interface UkTaxRules {
  personalAllowance: number;
  taperStart: number;
  taperRate: number;
  /** Bands on taxable income, lowest first; the last limit is Infinity. */
  bands: Record<UkTaxRegion, Band[]>;
  /**
   * Bands before this index keep their limit under relief at source: Scotland's
   * 19% starter band does not stretch, because the extension is of the 20% band
   * onward.
   */
  firstExtendedBand: Record<UkTaxRegion, number>;
  /** Index of the band whose (extended) limit marriage allowance eligibility tests against. */
  marriageAllowanceBand: Record<UkTaxRegion, number>;
  marriageAllowanceReduction: number;
  niLower: number;
  niUpper: number;
  class1: { main: number; upper: number };
  class4: { main: number; upper: number };
  undergradThreshold: Record<UkUndergradPlan, number>;
  studentLoanRate: number;
  postgradThreshold: number;
  postgradRate: number;
  weeksPerYear: number;
  childBenefitWeekly: { first: number; further: number };
  hicbcStart: number;
  hicbcStepSize: number;
  hicbcFullAt: number;
  childcareCutoff: number;
  maxChildren: number;
  maxCurvePoints: number;
}

const RULES: UkTaxRules = {
  personalAllowance: 12570,
  taperStart: 100000,
  taperRate: 0.5,
  bands: {
    rUK: [
      { limit: 37700, rate: 0.2 },
      { limit: 125140, rate: 0.4 },
      { limit: Infinity, rate: 0.45 },
    ],
    scotland: [
      { limit: 3967, rate: 0.19 },
      { limit: 16956, rate: 0.2 },
      { limit: 31092, rate: 0.21 },
      { limit: 62430, rate: 0.42 },
      { limit: 125140, rate: 0.45 },
      { limit: Infinity, rate: 0.48 },
    ],
  },
  firstExtendedBand: { rUK: 0, scotland: 1 },
  marriageAllowanceBand: { rUK: 0, scotland: 2 },
  marriageAllowanceReduction: 0.2 * 1260,
  niLower: 12570,
  niUpper: 50270,
  class1: { main: 0.08, upper: 0.02 },
  class4: { main: 0.06, upper: 0.02 },
  undergradThreshold: { none: Infinity, plan1: 26900, plan2: 29385, plan4: 33795, plan5: 25000 },
  studentLoanRate: 0.09,
  postgradThreshold: 21000,
  postgradRate: 0.06,
  weeksPerYear: UK_CHILD_BENEFIT_WEEKS,
  childBenefitWeekly: { first: 27.05, further: 17.9 },
  hicbcStart: 60000,
  hicbcStepSize: 200,
  hicbcFullAt: 80000,
  childcareCutoff: 100000,
  maxChildren: 20,
  maxCurvePoints: 2000,
};

const UNDERGRAD_PLANS: readonly UkUndergradPlan[] = ['none', 'plan1', 'plan2', 'plan4', 'plan5'];

/** A finite, non-negative number, or 0 — never NaN into the arithmetic. */
const nonNegative = (n: number): number => (Number.isFinite(n) && n > 0 ? n : 0);

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));

/** Input after sanitising and after the self-employed substitutions. */
interface Resolved {
  income: number;
  kind: UkIncomeKind;
  region: UkTaxRegion;
  bik: number;
  contribution: number;
  method: UkPensionMethod;
  plan: UkUndergradPlan;
  postgrad: boolean;
  children: number;
  childcareSupport: number;
  marriageAllowance: boolean;
}

const resolve = (input: UkTaxInput): Resolved => {
  const income = nonNegative(input.income);
  const kind: UkIncomeKind = input.kind === 'self-employed' ? 'self-employed' : 'employed';
  const region: UkTaxRegion = input.region === 'scotland' ? 'scotland' : 'rUK';
  const employed = kind === 'employed';
  // A sole trader has no payroll to sacrifice from or deduct pre-tax, so the
  // only mechanism left is paying net and claiming the relief.
  const requested: UkPensionMethod =
    input.pensionMethod === 'salary-sacrifice' || input.pensionMethod === 'net-pay'
      ? input.pensionMethod
      : 'relief-at-source';
  const plan: UkUndergradPlan = UNDERGRAD_PLANS.includes(input.undergradPlan) ? input.undergradPlan : 'none';
  return {
    income,
    kind,
    region,
    bik: employed ? nonNegative(input.benefitsInKind) : 0,
    contribution: Math.min(nonNegative(input.pensionContribution), income),
    method: employed ? requested : 'relief-at-source',
    plan,
    postgrad: input.postgradLoan === true,
    children: clamp(Math.floor(nonNegative(input.children)), 0, RULES.maxChildren),
    childcareSupport: nonNegative(input.childcareSupport),
    marriageAllowance: input.marriageAllowance === true,
  };
};

/** Amount that comes off pay before tax (and, for sacrifice only, before NI). */
const sacrificeOf = (r: Resolved): number => (r.method === 'salary-sacrifice' ? r.contribution : 0);
const preTaxDeductionOf = (r: Resolved): number =>
  r.method === 'salary-sacrifice' || r.method === 'net-pay' ? r.contribution : 0;
const rasGrossOf = (r: Resolved): number => (r.method === 'relief-at-source' ? r.contribution : 0);

/** The region's bands with relief at source's extension applied to the 20% band onward. */
const bandsFor = (region: UkTaxRegion, rasGross: number): Band[] =>
  RULES.bands[region].map((band, i) =>
    i >= RULES.firstExtendedBand[region] && Number.isFinite(band.limit)
      ? { ...band, limit: band.limit + rasGross }
      : band,
  );

const taxOnBands = (taxable: number, bands: Band[]): number => {
  let tax = 0;
  let lower = 0;
  for (const band of bands) {
    if (taxable <= lower) break;
    tax += (Math.min(taxable, band.limit) - lower) * band.rate;
    lower = band.limit;
  }
  return tax;
};

/** The taxable-income ceiling that marriage allowance eligibility tests against. */
const marriageAllowanceLimit = (r: Resolved): number =>
  bandsFor(r.region, rasGrossOf(r))[RULES.marriageAllowanceBand[r.region]].limit;

const aboveThreshold = (base: number, threshold: number, rate: number): number =>
  Math.max(0, base - threshold) * rate;

const childBenefitFor = (children: number): number =>
  children <= 0
    ? 0
    : (RULES.childBenefitWeekly.first + (children - 1) * RULES.childBenefitWeekly.further) * RULES.weeksPerYear;

interface Mode {
  /**
   * Smooth: the personal allowance taper and the child benefit charge are
   * continuous rather than stepped, so a one-pound difference measures the
   * slope instead of landing on a floor or a £200 step.
   */
  smooth: boolean;
  /** Pin marriage allowance eligibility instead of testing it at this income. */
  marriageAllowanceEligible?: boolean;
}

interface Computed {
  breakdown: UkTaxBreakdown;
  /** Whether marriage allowance applied at this income, for `ukMarginalRate` to pin. */
  marriageAllowanceEligible: boolean;
}

const compute = (r: Resolved, mode: Mode): Computed => {
  const sacrifice = sacrificeOf(r);
  const rasGross = rasGrossOf(r);

  const pay = r.income - preTaxDeductionOf(r);
  const totalIncome = pay + r.bik;
  const adjustedNetIncome = totalIncome - rasGross;

  const excess = Math.max(0, adjustedNetIncome - RULES.taperStart);
  const taperLoss = RULES.taperRate * excess;
  const personalAllowance = Math.max(
    0,
    RULES.personalAllowance - (mode.smooth ? taperLoss : Math.floor(taperLoss)),
  );
  const taxableIncome = Math.max(0, totalIncome - personalAllowance);

  const taxBeforeRelief = taxOnBands(taxableIncome, bandsFor(r.region, rasGross));
  const marriageAllowanceEligible =
    mode.marriageAllowanceEligible ?? (r.marriageAllowance && taxableIncome <= marriageAllowanceLimit(r));
  const marriageAllowanceRelief = marriageAllowanceEligible
    ? Math.min(RULES.marriageAllowanceReduction, taxBeforeRelief)
    : 0;
  const incomeTax = taxBeforeRelief - marriageAllowanceRelief;

  // NI and loans are on pay, not on benefits in kind, and a net-pay pension
  // does not reduce them. Only salary sacrifice does.
  const contributionBase = r.income - sacrifice;
  const niRates = r.kind === 'self-employed' ? RULES.class4 : RULES.class1;
  const nationalInsurance =
    aboveThreshold(Math.min(contributionBase, RULES.niUpper), RULES.niLower, niRates.main) +
    aboveThreshold(contributionBase, RULES.niUpper, niRates.upper);
  const studentLoan = aboveThreshold(contributionBase, RULES.undergradThreshold[r.plan], RULES.studentLoanRate);
  const postgradLoan = r.postgrad
    ? aboveThreshold(contributionBase, RULES.postgradThreshold, RULES.postgradRate)
    : 0;

  const childBenefit = childBenefitFor(r.children);
  const hicbcShare = mode.smooth
    ? clamp((adjustedNetIncome - RULES.hicbcStart) / (RULES.hicbcFullAt - RULES.hicbcStart), 0, 1)
    : adjustedNetIncome > RULES.hicbcStart
      ? Math.min(
          100,
          Math.floor((adjustedNetIncome - RULES.hicbcStart) / RULES.hicbcStepSize),
        ) / 100
      : 0;
  const childBenefitCharge = childBenefit * hicbcShare;

  const childcareSupportKept = adjustedNetIncome > RULES.childcareCutoff ? 0 : r.childcareSupport;

  const pensionFromPay = r.method === 'relief-at-source' ? 0.8 * r.contribution : r.contribution;
  const takeHome =
    r.income -
    pensionFromPay -
    incomeTax -
    nationalInsurance -
    studentLoan -
    postgradLoan -
    childBenefitCharge +
    childBenefit;

  const grossIncome = r.income + r.bik;
  const deductions = incomeTax + nationalInsurance + studentLoan + postgradLoan + childBenefitCharge;

  return {
    breakdown: {
      grossIncome,
      adjustedNetIncome,
      personalAllowance,
      taxableIncome,
      incomeTax,
      marriageAllowanceRelief,
      nationalInsurance,
      studentLoan,
      postgradLoan,
      childBenefit,
      childBenefitCharge,
      childcareSupportKept,
      pensionFromPay,
      takeHome,
      netWithSupport: takeHome + childcareSupportKept,
      effectiveRate: grossIncome > 0 ? deductions / grossIncome : 0,
      aboveTaperStart: adjustedNetIncome - RULES.taperStart,
      aboveChildBenefitStart: adjustedNetIncome - RULES.hicbcStart,
    },
    marriageAllowanceEligible,
  };
};

const deductionsOf = (b: UkTaxBreakdown): number =>
  b.incomeTax + b.nationalInsurance + b.studentLoan + b.postgradLoan + b.childBenefitCharge;

/** The full 2026/27 calculation for one hypothetical income. */
export const calculateUkTax = (input: UkTaxInput): UkTaxBreakdown =>
  compute(resolve(input), { smooth: false }).breakdown;

/**
 * The fraction of the next £1 of `income` that goes in tax, NI, student loans
 * and the child benefit charge: D(income + 1) - D(income).
 *
 * Measured in smooth mode so the personal allowance taper reads as its true
 * 1.5x slope (60% inside £100,000-£125,140) and the child benefit charge as a
 * steady slope across £60,000-£80,000, rather than flickering between 0 and a
 * £200 step. The cliffs (childcare support, marriage allowance eligibility) are
 * held at the base income's state for both evaluations so they never distort
 * the rate; `ukTaxCliffs` reports them instead.
 *
 * The pension contribution is held at its sanitised pounds for both
 * evaluations. Never NaN.
 */
export const ukMarginalRate = (input: UkTaxInput): number => {
  const base = resolve(input);
  const eligible = compute(base, { smooth: false }).marriageAllowanceEligible;
  const mode: Mode = { smooth: true, marriageAllowanceEligible: eligible };
  const now = deductionsOf(compute(base, mode).breakdown);
  const next = deductionsOf(compute({ ...base, income: base.income + 1 }, mode).breakdown);
  const rate = next - now;
  return Number.isFinite(rate) ? rate : 0;
};

/**
 * The step changes that a smooth curve hides: where a benefit is lost outright.
 *
 * `atIncome` is the last `income` at which the benefit is still held, solved
 * with every other input fixed. The pension contribution is taken in full
 * pounds, not capped at the income being modelled: `calculateUkTax` caps it at
 * the income it is given, but at the cliff income that cap no longer binds, so
 * capping at the current income would place the cliff too low whenever the
 * contribution exceeds it. Sorted by `atIncome`; a cliff the input can never
 * hold (benefits in kind alone already lose the benefit, so the solved income
 * would sit below the contribution or below zero) is omitted.
 */
export const ukTaxCliffs = (input: UkTaxInput): UkTaxCliff[] => {
  const r: Resolved = { ...resolve(input), contribution: nonNegative(input.pensionContribution) };
  // Income that leaves the given total income: undo the pre-tax deduction and
  // the benefits in kind, which are in total income but not in `income`.
  const incomeFor = (totalIncome: number): number => totalIncome + preTaxDeductionOf(r) - r.bik;
  const cliffs: UkTaxCliff[] = [];

  if (r.childcareSupport > 0) {
    cliffs.push({
      kind: 'childcare',
      atIncome: incomeFor(RULES.childcareCutoff + rasGrossOf(r)),
      cost: r.childcareSupport,
    });
  }

  if (r.marriageAllowance) {
    const limit = marriageAllowanceLimit(r);
    // The personal allowance is still whole at these incomes, so taxable
    // income of `limit` is total income of `limit` plus the allowance.
    cliffs.push({
      kind: 'marriage-allowance',
      atIncome: incomeFor(limit + RULES.personalAllowance),
      cost: Math.min(RULES.marriageAllowanceReduction, taxOnBands(limit, bandsFor(r.region, rasGrossOf(r)))),
    });
  }

  // Below the contribution the cap binds and adjusted net income is just the
  // benefits in kind, so a solved income under it means the benefit is lost
  // at every income. With no contribution this is the same as `>= 0`.
  return cliffs.filter(c => c.atIncome >= r.contribution).sort((a, b) => a.atIncome - b.atIncome);
};

/**
 * Take-home and marginal rate at incomes 0, step, 2·step … up to `maxIncome`
 * inclusive, with only `income` varied. Empty for a non-positive or non-finite
 * step or a negative or non-finite `maxIncome`; capped at 2,000 points so a
 * tiny step cannot lock the page.
 */
export const ukTaxCurve = (input: UkTaxInput, opts: { maxIncome: number; step: number }): UkTaxCurvePoint[] => {
  const { maxIncome, step } = opts;
  if (!Number.isFinite(step) || step <= 0 || !Number.isFinite(maxIncome) || maxIncome < 0) return [];

  // The epsilon keeps 0.3 / 0.1 from landing on 2.9999999999999996.
  const count = Math.min(Math.floor(maxIncome / step + 1e-9) + 1, RULES.maxCurvePoints);
  const points: UkTaxCurvePoint[] = [];
  for (let i = 0; i < count; i++) {
    const at = { ...input, income: i * step };
    const result = calculateUkTax(at);
    points.push({
      income: at.income,
      takeHome: result.takeHome,
      netWithSupport: result.netWithSupport,
      marginalRate: ukMarginalRate(at),
    });
  }
  return points;
};
