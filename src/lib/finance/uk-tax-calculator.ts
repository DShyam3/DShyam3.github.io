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
 * The base personal allowance is an argument (a tax code can carry less than
 * the statutory £12,570); the £100,000 taper is applied on top of whatever the
 * caller states. NI and student loan thresholds are statutory and do not move
 * with the tax code.
 *
 * Pure, like everything here: no clock, no Supabase, no model output anywhere
 * near the arithmetic.
 */

export type UkTaxRegion = 'rUK' | 'scotland';
export type UkIncomeKind = 'employed' | 'self-employed';
export type UkPensionMethod = 'salary-sacrifice' | 'net-pay' | 'relief-at-source';
/** What a pension share is a share of: all of `income`, or the auto-enrolment qualifying earnings in it. */
export type UkPensionBasis = 'salary' | 'qualifying';
export type UkUndergradPlan = 'none' | 'plan1' | 'plan2' | 'plan4' | 'plan5';

export interface UkTaxInput {
  /** £/yr: gross salary (employed) or taxable profit (self-employed). */
  income: number;
  kind: UkIncomeKind;
  region: UkTaxRegion;
  /** Taxable benefit-in-kind value, £/yr. Employed only; ignored otherwise. */
  benefitsInKind: number;
  /**
   * GROSS £/yr, whatever the method: a fixed sum, held in pounds at every
   * income a curve visits. With `pensionShare`, the whole contribution is
   * clamped to [0, income].
   */
  pensionContribution: number;
  /**
   * GROSS share of `pensionBasis` paid in on top of `pensionContribution`,
   * 0.05 for 5%. Unlike the fixed sum it moves with income, so a curve takes
   * it afresh at every income. Omitted, negative or non-finite is 0; above 1
   * is 1.
   */
  pensionShare?: number;
  /** What `pensionShare` is a share of. Omitted or unknown is `salary`. */
  pensionBasis?: UkPensionBasis;
  pensionMethod: UkPensionMethod;
  undergradPlan: UkUndergradPlan;
  postgradLoan: boolean;
  /** Children child benefit is claimed for. */
  children: number;
  /** £/yr of childcare support lost in full once adjusted net income passes £100,000. */
  childcareSupport: number;
  /** Receives a transferred marriage allowance. */
  marriageAllowance: boolean;
  /**
   * £/yr base personal allowance, before the £100,000 taper: what the tax code
   * carries. Omitted, negative or non-finite means the statutory
   * `UK_STATUTORY_PERSONAL_ALLOWANCE`; 0 is a real value (a BR or 0T code).
   */
  personalAllowance?: number;
}

export interface UkTaxBreakdown {
  /** Income plus benefits in kind (BIK only when employed). */
  grossIncome: number;
  adjustedNetIncome: number;
  /** After the £100,000 taper. */
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

/** Fraction of the next £1 of `income` each deduction takes. */
export interface UkMarginalRates {
  incomeTax: number;
  nationalInsurance: number;
  /** Undergraduate plan. */
  studentLoan: number;
  postgradLoan: number;
  childBenefitCharge: number;
  /** All of the above; the same number `ukMarginalRate` returns. */
  total: number;
}

/** The income tax bands of either region: rUK has basic, higher and additional; Scotland the other four as well. */
export type UkIncomeTaxBandName =
  | 'starter'
  | 'basic'
  | 'intermediate'
  | 'higher'
  | 'advanced'
  | 'top'
  | 'additional';

/** A range of `income` over which every marginal rate is constant. */
export interface UkMarginalBand extends UkMarginalRates {
  /** £/yr where this band starts. */
  from: number;
  /** £/yr where the next band starts; `maxIncome` for the last one. */
  to: number;
  /** The income tax band the next pound of taxable income falls in here; null when that pound pays no income tax (inside the allowance, or while marriage allowance relief still absorbs it). */
  incomeTaxBand: UkIncomeTaxBandName | null;
  /** True while the £100,000 taper is withdrawing personal allowance here, so the band rate is stretched by 1 + taper rate (before any pension share's effect). */
  allowanceTapering: boolean;
}

/** A range of `income`, in £/yr, for shading a chart: `from` up to `to`. */
export interface UkIncomeBand {
  from: number;
  to: number;
}

export type UkPaySliceKind = 'income' | 'pension' | 'benefit-in-kind';

export interface UkPaySlice {
  kind: UkPaySliceKind;
  /** Lower bound of this slice in £/yr. */
  from: number;
  /** Upper bound of this slice in £/yr (`to > from`). */
  to: number;
  /** Width of this slice in £/yr (`to - from`). */
  gross: number;
  /** Income tax on this slice, £/yr. */
  incomeTax: number;
  /** National Insurance (Class 1 or Class 4) on this slice, £/yr. */
  nationalInsurance: number;
  /** Combined undergraduate + postgraduate student loan on this slice, £/yr. */
  studentLoan: number;
  /**
   * High Income Child Benefit Charge on this slice, £/yr. The exact calculation
   * takes 1% of the child benefit per complete £200 of adjusted net income
   * above £60,000, so a slice inside £60,000-£80,000 carries a stepped total
   * (a slice narrower than £200 that straddles a step carries the whole step):
   * the rate below is a slice average, not a marginal rate.
   */
  childBenefitCharge: number;
  /** Cash leaving pay into the pension on this slice, £/yr (`0.8 * gross` under relief at source). */
  pension: number;
  /**
   * Change in cash take-home from this slice, £/yr; negative when pension
   * deductions, BIK tax or the child benefit charge reduce cash. The child
   * benefit itself is constant in income, so it cancels out of this.
   */
  kept: number;
  /** Cash take-home change divided by `gross`; may be negative. */
  keptRate: number;
  /** Marginal rates on this slice, each clamped to `[0, 1]`. */
  incomeTaxRate: number;
  nationalInsuranceRate: number;
  studentLoanRate: number;
  childBenefitChargeRate: number;
  pensionRate: number;
}

export interface UkTakeHomeShares {
  /** Each share is in `[0, 1]` (`amount / income`, or `0` when `income <= 0`), with `takeHome` clamped to `[0, 1]`. */
  takeHome: number;
  pension: number;
  incomeTax: number;
  nationalInsurance: number;
  studentLoan: number;
  childBenefitCharge: number;
}

export interface UkTakeHomeSummary {
  /** Sanitised gross cash pay (`income`), £/yr. */
  income: number;
  /** Sanitised taxable benefits in kind included in this calculation, £/yr (`0` when excluded or self-employed). */
  benefitsInKind: number;
  /** Gross pension contribution included in this calculation, £/yr (`0` when excluded). */
  pensionContribution: number;
  /** Total cash leaving pay for the pension (`pensionFromPay`), £/yr. */
  pensionFromPay: number;
  /** Total income tax (including BIK tax when included), £/yr. */
  incomeTax: number;
  /** Total National Insurance, £/yr. */
  nationalInsurance: number;
  /** Total student loan (undergrad + postgrad), £/yr. */
  studentLoan: number;
  /** Total High Income Child Benefit Charge, £/yr (`0` when no child benefit is claimed). */
  childBenefitCharge: number;
  /**
   * Total deductions from cash pay
   * (`pensionFromPay + incomeTax + nationalInsurance + studentLoan + childBenefitCharge`), £/yr.
   */
  totalDeductions: number;
  /** Cash pay left after `totalDeductions`, clamped at `0` (`Math.max(0, income - totalDeductions)`), £/yr. */
  takeHome: number;
  /**
   * Unclamped cash pay left (`income - totalDeductions`), £/yr. Equals
   * `calculateUkTax(input).takeHome` less the child benefit itself: the charge
   * is a tax on income and is included, the benefit is not pay and is not.
   */
  rawTakeHome: number;
  /** Annual child benefit claimed, £/yr (`0` when `children` is `0`). Reported beside pay, not in `income`, `takeHome` or `rawTakeHome`. */
  childBenefit: number;
  /** Fraction of `income` kept (`takeHome / income`, clamped to `[0, 1]`; `0` when `income <= 0`). */
  takeHomeRate: number;
  /** Per-category shares of `income` (`[0, 1]`) for the stacked bar and legend. */
  shares: UkTakeHomeShares;
  /** Ordered slices from £0 up through salary, pension and benefits in kind. */
  slices: UkPaySlice[];
}

export interface UkTakeHomeSharePoint {
  /** The income the shares are of, sanitised as `calculateUkTax` does. */
  income: number;
  /**
   * Each a share of `income`, clamped to [0, 1], as `ukTakeHomeBySlice` shares
   * are. Clamping each one separately means the six can sum to more than 1:
   * see `ukTakeHomeShareAt`.
   */
  takeHome: number;
  pension: number;
  incomeTax: number;
  nationalInsurance: number;
  /** Undergraduate + postgraduate. */
  studentLoan: number;
  childBenefitCharge: number;
}

/** The tax year the rule set below describes. */
export const UK_TAX_YEAR_LABEL = '2026/27';

/** Class 1 employee National Insurance for 2026/27, annual thresholds. */
export const UK_EMPLOYEE_NI = {
  lowerThreshold: 12_570,
  upperThreshold: 50_270,
  mainRate: 0.08,
  upperRate: 0.02,
} as const;

/** The standard personal allowance (tax code 1257L), £/yr, before the £100,000 taper. */
export const UK_STATUTORY_PERSONAL_ALLOWANCE = 12_570;

/** 6 Apr 2026 and 5 Apr 2027 are both Mondays, so the tax year holds 53 benefit weeks (as 2020/21 did). */
export const UK_CHILD_BENEFIT_WEEKS = 53;

/** Adjusted net income where the High Income Child Benefit Charge starts. */
export const UK_CHILD_BENEFIT_CHARGE_START = 60_000;

/** Adjusted net income where the charge takes 100% of the child benefit. */
export const UK_CHILD_BENEFIT_CHARGE_END = 80_000;

/** The charge is 1% of the child benefit for every complete £200 above the start. */
export const UK_CHILD_BENEFIT_CHARGE_STEP = 200;

/** Adjusted net income above which childcare support is lost in full. */
export const UK_CHILDCARE_CUTOFF = 100_000;

/** Adjusted net income above which the personal allowance starts to be withdrawn. */
export const UK_ALLOWANCE_TAPER_START = 100_000;

/** Pounds of personal allowance withdrawn for each pound of adjusted net income over the start. */
export const UK_ALLOWANCE_TAPER_RATE = 0.5;

/**
 * Automatic enrolment for 2026/27, held at the 2025/26 figures: the earnings
 * above which an employer must enrol a worker, the qualifying earnings band a
 * minimum contribution is a share of, and the employee's minimum gross share
 * of it (the employer adds at least 3%). The trigger is not modelled, so a
 * pension on qualifying earnings is paid at every income, as if opted into.
 */
export const UK_AUTO_ENROLMENT = {
  earningsTrigger: 10_000,
  lowerQualifyingEarnings: 6_240,
  upperQualifyingEarnings: 50_270,
  minimumEmployeeShare: 0.05,
} as const;

/**
 * The standard case, for someone with nothing unusual about their pay: an
 * employee outside Scotland on the statutory allowance (tax code 1257L),
 * paying the auto-enrolment minimum by relief at source, with no student
 * loan, benefits in kind, children or marriage allowance. `income` is 0, for
 * the caller to set.
 */
export const UK_STANDARD_TAX_INPUT: UkTaxInput = {
  income: 0,
  kind: 'employed',
  region: 'rUK',
  benefitsInKind: 0,
  pensionContribution: 0,
  pensionShare: UK_AUTO_ENROLMENT.minimumEmployeeShare,
  pensionBasis: 'qualifying',
  pensionMethod: 'relief-at-source',
  undergradPlan: 'none',
  postgradLoan: false,
  children: 0,
  childcareSupport: 0,
  marriageAllowance: false,
};

/** What `ukWhatIfs` adds to the pension share for `more-pension`. */
const WHAT_IF_EXTRA_PENSION_SHARE = 0.05;

interface Band {
  name: UkIncomeTaxBandName;
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
  qualifyingEarnings: { lower: number; upper: number };
  maxChildren: number;
  maxCurvePoints: number;
  maxMarginalBands: number;
}

const RULES: UkTaxRules = {
  personalAllowance: UK_STATUTORY_PERSONAL_ALLOWANCE,
  taperStart: UK_ALLOWANCE_TAPER_START,
  taperRate: UK_ALLOWANCE_TAPER_RATE,
  bands: {
    rUK: [
      { name: 'basic', limit: 37700, rate: 0.2 },
      { name: 'higher', limit: 125140, rate: 0.4 },
      { name: 'additional', limit: Infinity, rate: 0.45 },
    ],
    scotland: [
      { name: 'starter', limit: 3967, rate: 0.19 },
      { name: 'basic', limit: 16956, rate: 0.2 },
      { name: 'intermediate', limit: 31092, rate: 0.21 },
      { name: 'higher', limit: 62430, rate: 0.42 },
      { name: 'advanced', limit: 125140, rate: 0.45 },
      { name: 'top', limit: Infinity, rate: 0.48 },
    ],
  },
  firstExtendedBand: { rUK: 0, scotland: 1 },
  marriageAllowanceBand: { rUK: 0, scotland: 2 },
  marriageAllowanceReduction: 0.2 * 1260,
  niLower: UK_EMPLOYEE_NI.lowerThreshold,
  niUpper: UK_EMPLOYEE_NI.upperThreshold,
  class1: { main: UK_EMPLOYEE_NI.mainRate, upper: UK_EMPLOYEE_NI.upperRate },
  class4: { main: 0.06, upper: 0.02 },
  undergradThreshold: { none: Infinity, plan1: 26900, plan2: 29385, plan4: 33795, plan5: 25000 },
  studentLoanRate: 0.09,
  postgradThreshold: 21000,
  postgradRate: 0.06,
  weeksPerYear: UK_CHILD_BENEFIT_WEEKS,
  childBenefitWeekly: { first: 27.05, further: 17.9 },
  hicbcStart: UK_CHILD_BENEFIT_CHARGE_START,
  hicbcStepSize: UK_CHILD_BENEFIT_CHARGE_STEP,
  hicbcFullAt: UK_CHILD_BENEFIT_CHARGE_END,
  childcareCutoff: UK_CHILDCARE_CUTOFF,
  qualifyingEarnings: {
    lower: UK_AUTO_ENROLMENT.lowerQualifyingEarnings,
    upper: UK_AUTO_ENROLMENT.upperQualifyingEarnings,
  },
  maxChildren: 20,
  maxCurvePoints: 2000,
  maxMarginalBands: 200,
};

const UNDERGRAD_PLANS: readonly UkUndergradPlan[] = ['none', 'plan1', 'plan2', 'plan4', 'plan5'];

/** A finite, non-negative number, or 0 — never NaN into the arithmetic. */
const nonNegative = (n: number): number => (Number.isFinite(n) && n > 0 ? n : 0);

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));

/**
 * The base personal allowance a calculation will use for a stated one: the
 * statutory allowance when it is omitted, negative or not a finite number, and
 * the stated figure otherwise, 0 included. Exported so a caller deciding
 * something from "is the allowance below the standard one" reads the same
 * sanitised value the engine does, not the raw field.
 */
export const ukBasePersonalAllowance = (stated: number | undefined): number =>
  typeof stated === 'number' && Number.isFinite(stated) && stated >= 0 ? stated : RULES.personalAllowance;

/** Input after sanitising and after the self-employed substitutions. */
interface Resolved {
  income: number;
  kind: UkIncomeKind;
  region: UkTaxRegion;
  bik: number;
  /** Gross £/yr paid in at `income`: the pension as entered, capped at `income`. */
  contribution: number;
  /**
   * The pension as entered, for working at other incomes: a fixed sum in full
   * pounds, uncapped, and a share of `pensionBasis`. For solving an income (a
   * cliff, a band) the cap at the current income does not bind at the income
   * being solved for.
   */
  pensionFixed: number;
  pensionShare: number;
  pensionBasis: UkPensionBasis;
  method: UkPensionMethod;
  plan: UkUndergradPlan;
  postgrad: boolean;
  children: number;
  childcareSupport: number;
  marriageAllowance: boolean;
  /** Base personal allowance before the taper. */
  allowance: number;
}

/**
 * The pounds of `income` a pension share is a share of: all of it, or the
 * qualifying earnings, the part of it between the lower and upper limits.
 */
const pensionBasisOf = (basis: UkPensionBasis, income: number): number =>
  basis === 'qualifying'
    ? clamp(income - RULES.qualifyingEarnings.lower, 0, RULES.qualifyingEarnings.upper - RULES.qualifyingEarnings.lower)
    : income;

/** `pensionBasisOf` in linear pieces: from each `from` to the next, the basis grows by `slope` per pound of income. */
const PENSION_BASIS_PIECES: Record<UkPensionBasis, readonly { from: number; slope: number }[]> = {
  salary: [{ from: 0, slope: 1 }],
  qualifying: [
    { from: 0, slope: 0 },
    { from: RULES.qualifyingEarnings.lower, slope: 1 },
    { from: RULES.qualifyingEarnings.upper, slope: 0 },
  ],
};

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
  const pensionFixed = nonNegative(input.pensionContribution);
  const pensionShare = Math.min(1, nonNegative(input.pensionShare ?? 0));
  const pensionBasis: UkPensionBasis = input.pensionBasis === 'qualifying' ? 'qualifying' : 'salary';
  return {
    income,
    kind,
    region,
    bik: employed ? nonNegative(input.benefitsInKind) : 0,
    contribution: Math.min(pensionFixed + pensionShare * pensionBasisOf(pensionBasis, income), income),
    pensionFixed,
    pensionShare,
    pensionBasis,
    method: employed ? requested : 'relief-at-source',
    plan,
    postgrad: input.postgradLoan === true,
    children: clamp(Math.floor(nonNegative(input.children)), 0, RULES.maxChildren),
    childcareSupport: nonNegative(input.childcareSupport),
    marriageAllowance: input.marriageAllowance === true,
    allowance: ukBasePersonalAllowance(input.personalAllowance),
  };
};

/** What the pension as entered comes to at `income`, before the cap at income. */
const uncappedContributionAt = (r: Resolved, income: number): number =>
  r.pensionFixed + r.pensionShare * pensionBasisOf(r.pensionBasis, income);

/** `r` at another income, with the contribution taken there as `resolve` takes it. */
const resolvedAt = (r: Resolved, income: number): Resolved => ({
  ...r,
  income,
  contribution: Math.min(uncappedContributionAt(r, income), income),
});

/**
 * `r` a pound further up, for a one-pound difference: the pension's share is
 * taken of the extra pound too, while the fixed sum is held at the pounds it
 * came to, as a marginal rate has always held it.
 */
const onePoundMore = (r: Resolved): Resolved => {
  const income = r.income + 1;
  const growth = uncappedContributionAt(r, income) - uncappedContributionAt(r, r.income);
  return { ...r, income, contribution: Math.min(r.contribution + growth, income) };
};

/**
 * The income at which income less the pension as entered reaches `net`. That
 * difference is pay under salary sacrifice or net pay, and adjusted net income
 * less the benefits in kind under every method (relief at source takes its
 * gross off there instead), so this is how a threshold on either is moved back
 * onto income. With a fixed sum alone it is `net` plus the sum.
 *
 * The difference is continuous and never falls as income rises, so it is
 * solved one linear piece of the basis at a time. A result below 0 is
 * returned as it is, for the caller to judge; Infinity means no income
 * reaches `net`, as when a share of 1 of the salary leaves nothing at any.
 */
const incomeLeaving = (net: number, r: Resolved): number => {
  const pieces = PENSION_BASIS_PIECES[r.pensionBasis];
  for (let i = 0; i < pieces.length; i++) {
    const { from, slope } = pieces[i];
    const to = i + 1 < pieces.length ? pieces[i + 1].from : Infinity;
    const rise = 1 - r.pensionShare * slope;
    if (rise > 0) {
      const income = from + (net - (from - uncappedContributionAt(r, from))) / rise;
      if (income <= to) return income;
    }
  }
  return Infinity;
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
  const personalAllowance = Math.max(0, r.allowance - (mode.smooth ? taperLoss : Math.floor(taperLoss)));
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
 * The extra income tax a taxable benefit in kind of `bikValue` £/yr adds on top
 * of the input as it stands (its own `benefitsInKind` stay in): income tax with
 * the benefit counted, less income tax without it. Both sides are the exact
 * calculation, so the benefit is taxed at the bands it actually lands in,
 * counts towards the allowance taper and can cost a marriage allowance. A
 * benefit in kind carries no NI or student loan for the employee, so income tax
 * is the whole of it.
 *
 * Employed only: a sole trader has no benefits in kind (the same rule as
 * `calculateUkTax`), so the answer is 0. A zero, negative or non-finite value
 * is 0 too. Never negative, never NaN.
 */
export const ukBenefitInKindTax = (input: UkTaxInput, bikValue: number): number => {
  const bik = nonNegative(bikValue);
  const base = resolve(input);
  if (base.kind !== 'employed' || bik === 0) return 0;
  const exact: Mode = { smooth: false };
  const without = compute(base, exact).breakdown.incomeTax;
  const withBenefit = compute({ ...base, bik: base.bik + bik }, exact).breakdown.incomeTax;
  return Math.max(0, withBenefit - without);
};

/** What `ukCashAfterTax` reports; all £/yr and unrounded. */
export interface UkCashAfterTax {
  /** The cash, sanitised: 0 for a negative or non-finite amount. */
  gross: number;
  incomeTax: number;
  nationalInsurance: number;
  /** Undergraduate plan and postgraduate loan together. */
  studentLoan: number;
  /** `gross` less the three deductions above. */
  net: number;
}

/**
 * What a one-off or annual cash payment of `cash` £/yr keeps once it is paid
 * through payroll on top of the input's `income`: the extra income tax, NI and
 * student loan that `income + cash` costs over `income`, each the difference of
 * two exact calculations. So it lands in the bands the salary leaves it in (a
 * bonus that straddles the higher-rate threshold is taxed part at 20% and part
 * at 40%), through the allowance taper at an effective 60% between £100,000 and
 * £125,140, and past the NI upper limit at 2%.
 *
 * The pension contribution is held at the pounds it comes to at `income` on
 * both sides rather than recapped or re-shared at the larger income, so the
 * bonus is not itself pensioned.
 * Not counted: the High Income Child Benefit Charge and the childcare-support
 * cliff, which the other inputs can trigger; `net` is cash less tax, NI and
 * loans only.
 *
 * A zero, negative or non-finite `cash` is all zeros. Never NaN.
 */
export const ukCashAfterTax = (input: UkTaxInput, cash: number): UkCashAfterTax => {
  const gross = nonNegative(cash);
  const base = resolve(input);
  const exact: Mode = { smooth: false };
  const before = compute(base, exact).breakdown;
  const after = compute({ ...base, income: base.income + gross }, exact).breakdown;
  const extra = (now: number, then: number): number => Math.max(0, now - then);
  const incomeTax = extra(after.incomeTax, before.incomeTax);
  const nationalInsurance = extra(after.nationalInsurance, before.nationalInsurance);
  const studentLoan =
    extra(after.studentLoan, before.studentLoan) + extra(after.postgradLoan, before.postgradLoan);
  return { gross, incomeTax, nationalInsurance, studentLoan, net: gross - incomeTax - nationalInsurance - studentLoan };
};

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
 * A fixed pension contribution is held at its sanitised pounds for both
 * evaluations; a pension share is taken of the extra pound as well, so under
 * salary sacrifice or net pay the next pound is taxed only on what the
 * pension leaves of it. Never NaN.
 *
 * This is the total of `ukMarginalRates`, which splits the same difference by
 * deduction; the one function computes both so the headline rate and its parts
 * can never disagree.
 */
export const ukMarginalRate = (input: UkTaxInput): number => ukMarginalRates(input).total;

/**
 * What each deduction takes of the next £1 of `income`, and all of them
 * together. The method is `ukMarginalRate`'s, once: two smooth-mode
 * calculations a pound apart, with marriage allowance eligibility pinned at the
 * base income and the pension taken as `ukMarginalRate` takes it, and every rate the
 * difference of that deduction between the two. So the allowance taper reads as
 * 60% of tax inside £100,000-£125,140 and the child benefit charge as a steady
 * slope across £60,000-£80,000, in `incomeTax` and `childBenefitCharge`
 * respectively, rather than flickering with floors and £200 steps.
 *
 * `total` is the difference of the summed deductions rather than the sum of the
 * five rates, exactly as `ukMarginalRate` has always taken it, so the two agree
 * to the bit. A rate that is not a finite number is 0. Never NaN.
 */
export const ukMarginalRates = (input: UkTaxInput): UkMarginalRates => readMarginal(input).rates;

/** What `ukNextPound` reports, each a fraction of the next £1 of `income`. */
export interface UkNextPound {
  /** Left as cash: the pound less `ukMarginalRate` and less `pension`. May be negative. */
  kept: number;
  /** Paid from pay into the pension: a pension share's cut of the pound, 80% of it under relief at source. */
  pension: number;
}

/**
 * Where the next £1 of `income` goes, as cash: what is kept, and what leaves
 * pay for the pension. Read from the same one-pound difference as
 * `ukMarginalRates`, so `kept + pension + ukMarginalRate` is 1 to the bit
 * (save for rounding). A fixed pension contribution is held, so it takes
 * nothing of the next pound; a pension share takes its share. Never NaN.
 */
export const ukNextPound = (input: UkTaxInput): UkNextPound => {
  const { rates, pensionFromPay } = readMarginal(input);
  return { kept: 1 - rates.total - pensionFromPay, pension: pensionFromPay };
};

/** Two marginal rates are the same rate when they differ by no more than floating-point noise. */
const RATE_TOLERANCE = 1e-9;

/** What `ukMarginalRates` finds at one income, and which band and taper state it found it in. */
interface MarginalReading {
  rates: UkMarginalRates;
  /** What leaves pay for the pension of the same pound; not a deduction, so not in `rates`. */
  pensionFromPay: number;
  incomeTaxBand: UkIncomeTaxBandName | null;
  allowanceTapering: boolean;
}

/**
 * The one reading of the margin at an income. The rates are `ukMarginalRates`'
 * and the two flags are taken from the same smooth-mode state at that income
 * (the pinned marriage allowance eligibility included), so a band's rates and
 * its explanation of them can never come from different points.
 *
 * `incomeTaxBand` is null when the income tax rate is nil. Otherwise it is the
 * band, relief at source's extension applied, that holds the taxable income
 * here: the first whose limit is above it, so taxable income exactly on a limit
 * is already in the next band, the one the next pound falls in.
 *
 * `allowanceTapering` is adjusted net income over the taper start with some
 * allowance still left to withdraw. Past the point where it has all gone the
 * band rate is no longer stretched.
 */
const readMarginal = (input: UkTaxInput): MarginalReading => {
  const base = resolve(input);
  const eligible = compute(base, { smooth: false }).marriageAllowanceEligible;
  const mode: Mode = { smooth: true, marriageAllowanceEligible: eligible };
  const now = compute(base, mode).breakdown;
  const next = compute(onePoundMore(base), mode).breakdown;
  const slope = (after: number, before: number): number => {
    const rate = after - before;
    return Number.isFinite(rate) ? rate : 0;
  };
  const rates: UkMarginalRates = {
    incomeTax: slope(next.incomeTax, now.incomeTax),
    nationalInsurance: slope(next.nationalInsurance, now.nationalInsurance),
    studentLoan: slope(next.studentLoan, now.studentLoan),
    postgradLoan: slope(next.postgradLoan, now.postgradLoan),
    childBenefitCharge: slope(next.childBenefitCharge, now.childBenefitCharge),
    total: slope(deductionsOf(next), deductionsOf(now)),
  };
  const bands = bandsFor(base.region, rasGrossOf(base));
  const holding = bands.find(band => now.taxableIncome < band.limit) ?? bands[bands.length - 1];
  return {
    rates,
    pensionFromPay: slope(next.pensionFromPay, now.pensionFromPay),
    incomeTaxBand: Math.abs(rates.incomeTax) <= RATE_TOLERANCE ? null : holding.name,
    allowanceTapering: now.adjustedNetIncome > RULES.taperStart && now.personalAllowance > 0,
  };
};

/**
 * The step changes that a smooth curve hides: where a benefit is lost outright.
 *
 * `atIncome` is the last `income` at which the benefit is still held, solved
 * with every other input fixed. The pension is taken as entered at the income
 * solved for, a fixed sum in full pounds and a share of that income, not
 * capped at the income being modelled: `calculateUkTax` caps it at the income
 * it is given, but at the cliff income that cap no longer binds, so capping at
 * the current income would place the cliff too low whenever the contribution
 * exceeds it. Sorted by `atIncome`; a cliff the input can never hold (benefits
 * in kind alone already lose the benefit, so the solved income would sit below
 * where the pension is paid in full, or below zero) is omitted, as is one no
 * income reaches.
 */
export const ukTaxCliffs = (input: UkTaxInput): UkTaxCliff[] => {
  const r = resolve(input);
  const cliffs: UkTaxCliff[] = [];

  // Both cliffs are on adjusted net income, or on taxable income while the
  // allowance is whole, and each is income less the pension plus the benefits
  // in kind under every method: relief at source stretches the bands by the
  // gross it would otherwise have taken off pay.
  if (r.childcareSupport > 0) {
    cliffs.push({
      kind: 'childcare',
      atIncome: incomeLeaving(RULES.childcareCutoff - r.bik, r),
      cost: r.childcareSupport,
    });
  }

  if (r.marriageAllowance) {
    // The personal allowance is still whole at these incomes (true while the
    // stated allowance plus the band ceiling is under the £100,000 taper
    // start, which holds for any allowance up to about £62,000), so taxable
    // income of the ceiling is total income of the ceiling plus the stated
    // allowance.
    const ceiling = RULES.bands[r.region][RULES.marriageAllowanceBand[r.region]].limit;
    const atIncome = incomeLeaving(ceiling + r.allowance - r.bik, r);
    const there = resolvedAt(r, atIncome);
    cliffs.push({
      kind: 'marriage-allowance',
      atIncome,
      cost: Math.min(
        RULES.marriageAllowanceReduction,
        taxOnBands(marriageAllowanceLimit(there), bandsFor(r.region, rasGrossOf(there))),
      ),
    });
  }

  // Until the pension is paid in full the cap binds and adjusted net income
  // is just the benefits in kind, so a solved income under that point means
  // the benefit is lost at every income. With no fixed sum this is `>= 0`.
  const paidInFull = incomeLeaving(0, r);
  return cliffs
    .filter(c => Number.isFinite(c.atIncome) && c.atIncome >= paidInFull)
    .sort((a, b) => a.atIncome - b.atIncome);
};

/**
 * The range of `income`, every other input fixed, over which adjusted net
 * income runs from £60,000 to £80,000: where the High Income Child Benefit
 * Charge climbs from nothing to all of it. For shading a chart of `ukTaxCurve`.
 *
 * Adjusted net income as a function of income is flat at the benefits in kind
 * while a fixed pension contribution still takes all of income (pay is nil
 * under salary sacrifice or net pay, and relief at source is capped at
 * income), then rises by what the pension leaves of each pound. So each end is
 * where income less the pension reaches the threshold less the benefits in
 * kind, or 0 where the benefits alone already reach the threshold. As with
 * `ukTaxCliffs` the pension is taken as entered at the income solved for,
 * because the curve recomputes each point and the cap at the current income
 * does not bind where the band sits; the result therefore ignores `income`
 * altogether.
 *
 * `null` when no child benefit is claimed (the children count is sanitised as
 * in `calculateUkTax`), when benefits in kind alone reach £80,000 so that the
 * charge is total at every income and there is no band to shade, or when the
 * pension takes the whole of every pound so that no income reaches £80,000.
 */
export const ukChildBenefitBand = (input: UkTaxInput): UkIncomeBand | null => {
  const r = resolve(input);
  if (r.children === 0) return null;

  const incomeAt = (adjustedNetIncome: number): number =>
    r.bik >= adjustedNetIncome ? 0 : incomeLeaving(adjustedNetIncome - r.bik, r);

  const to = incomeAt(RULES.hicbcFullAt);
  if (!Number.isFinite(to) || to <= 0) return null;
  return { from: incomeAt(RULES.hicbcStart), to };
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

/** `amount` as a share of `income`, clamped to [0, 1]; 0 when there is no income to share. */
const shareOfIncome = (amount: number, income: number): number => (income > 0 ? clamp(amount / income, 0, 1) : 0);

/**
 * The shares of `income` that the pension, income tax, National Insurance and
 * both student loans take, which `ukTakeHomeShareAt` and `ukTakeHomeBySlice`
 * count identically. What is left, and the child benefit charge, are theirs to
 * add.
 */
const deductionSharesOf = (
  b: UkTaxBreakdown,
  income: number,
): Pick<UkTakeHomeShares, 'pension' | 'incomeTax' | 'nationalInsurance' | 'studentLoan'> => ({
  pension: shareOfIncome(b.pensionFromPay, income),
  incomeTax: shareOfIncome(b.incomeTax, income),
  nationalInsurance: shareOfIncome(b.nationalInsurance, income),
  studentLoan: shareOfIncome(b.studentLoan + b.postgradLoan, income),
});

/**
 * Where each pound of `income` goes at exactly this income, as shares of it:
 * the one point of `ukTakeHomeShareCurve`, and the exact calculation, so the
 * shares are the ones `ukTakeHomeBySlice` would report here with no children.
 * `income` is sanitised as `calculateUkTax` does, and returned as sanitised.
 * All zeros when it is 0, because a share of nothing is undefined, not a
 * share, and the chart that draws these has nothing to draw there.
 *
 * The five amounts are the cash that leaves pay for the pension, income tax,
 * National Insurance, both student loans together, and the High Income Child
 * Benefit Charge. Child benefit received and childcare support are not pay and
 * are left out, so with children the shares of what is deducted can fall short
 * of the claim; `takeHome` is what remains of `income` after the five.
 *
 * Every share is clamped to [0, 1] on its own, which is why they do not always
 * sum to 1. Where the deductions come to more than the income they sum to more
 * than 1, and `takeHome` is 0 rather than negative. Two cases:
 *
 * - Below a net-pay contribution the whole income goes to the pension, a share
 *   of 1, while National Insurance is still due on full pay (only salary
 *   sacrifice lowers it), so the NI share comes on top of that 1.
 * - Benefits in kind are taxed but are not cash: the tax comes out of pay, so a
 *   large benefit on a small salary can take more tax than the salary pays,
 *   with National Insurance, a loan or the pension share on top of it.
 *
 * A caller drawing the shares as a stack should let its axis run past 1.
 */
export const ukTakeHomeShareAt = (input: UkTaxInput): UkTakeHomeSharePoint => {
  const income = nonNegative(input.income);
  const result = calculateUkTax({ ...input, income });
  const studentLoan = result.studentLoan + result.postgradLoan;
  const kept =
    income -
    result.pensionFromPay -
    result.incomeTax -
    result.nationalInsurance -
    studentLoan -
    result.childBenefitCharge;
  return {
    income,
    takeHome: shareOfIncome(kept, income),
    ...deductionSharesOf(result, income),
    childBenefitCharge: shareOfIncome(result.childBenefitCharge, income),
  };
};

/**
 * Where each pound of `income` goes, as shares of that income, at incomes
 * step, 2·step … up to `maxIncome` inclusive, with only `income` varied: the
 * stacked-area counterpart of `ukTaxCurve`, drawn against income rather than
 * for the one income `ukTakeHomeBySlice` summarises. Each point is
 * `ukTakeHomeShareAt` at that income, so everything it says about what the
 * shares count, and about their sum passing 1, holds here.
 *
 * Income 0 is omitted, because a share of nothing is undefined and not 0. The
 * guards, the epsilon and the 2,000-point cap are `ukTaxCurve`'s: empty for a
 * non-positive or non-finite step or a negative or non-finite `maxIncome`.
 * Below the pension contribution the whole of the income goes to the pension
 * under net pay or salary sacrifice, so that share is 1 and `takeHome` is 0.
 */
export const ukTakeHomeShareCurve = (
  input: UkTaxInput,
  opts: { maxIncome: number; step: number },
): UkTakeHomeSharePoint[] => {
  const { maxIncome, step } = opts;
  if (!Number.isFinite(step) || step <= 0 || !Number.isFinite(maxIncome) || maxIncome < 0) return [];

  // The epsilon keeps 0.3 / 0.1 from landing on 2.9999999999999996.
  const count = Math.min(Math.floor(maxIncome / step + 1e-9), RULES.maxCurvePoints);
  const points: UkTakeHomeSharePoint[] = [];
  for (let i = 1; i <= count; i++) {
    points.push(ukTakeHomeShareAt({ ...input, income: i * step }));
  }
  return points;
};

const MIN_SLICE_WIDTH = 1;

/** Taxable income at which `taxOnBands(taxable, bands)` reaches `targetTax`. */
const taxableAtTax = (targetTax: number, bands: Band[]): number => {
  if (targetTax <= 0) return 0;
  let remaining = targetTax;
  let lower = 0;
  for (const band of bands) {
    const width = band.limit - lower;
    const maxTax = width * band.rate;
    if (remaining <= maxTax) {
      return band.rate > 0 ? lower + remaining / band.rate : lower;
    }
    remaining -= maxTax;
    lower = band.limit;
  }
  return lower;
};

/**
 * Total-income (`pay + bik`) points where marginal income tax changes, given a
 * fixed `allowance` and fixed `rasGross`.
 */
const totalIncomeTaxThresholds = (
  allowance: number,
  rasGross: number,
  region: UkTaxRegion,
  marriageAllowanceEligible: boolean,
): number[] => {
  const bands = bandsFor(region, rasGross);
  const taperStartTotal = RULES.taperStart + rasGross;
  const taperEndTotal = taperStartTotal + allowance / RULES.taperRate;
  const thresholds: number[] = [];

  if (allowance > 0) {
    thresholds.push(taperStartTotal, taperEndTotal);
  }

  const taxableTargets: number[] = [];
  if (allowance > 0) {
    taxableTargets.push(0);
  }
  if (marriageAllowanceEligible) {
    taxableTargets.push(taxableAtTax(RULES.marriageAllowanceReduction, bands));
  }
  for (const band of bands) {
    if (Number.isFinite(band.limit)) {
      taxableTargets.push(band.limit);
    }
  }

  for (const target of taxableTargets) {
    const preTaper = allowance + target;
    if (preTaper <= taperStartTotal) {
      thresholds.push(preTaper);
    }
    if (allowance > 0) {
      const inTaper = (target + allowance + RULES.taperRate * taperStartTotal) / (1 + RULES.taperRate);
      if (inTaper > taperStartTotal && inTaper < taperEndTotal) {
        thresholds.push(inTaper);
      }
    }
    if (target >= taperEndTotal) {
      thresholds.push(target);
    }
  }

  return thresholds;
};

/** NI and active student-loan thresholds on `contributionBase`. */
const niAndLoanThresholds = (r: Resolved): number[] => {
  const out: number[] = [RULES.niLower, RULES.niUpper];
  if (r.plan !== 'none') {
    out.push(RULES.undergradThreshold[r.plan]);
  }
  if (r.postgrad) {
    out.push(RULES.postgradThreshold);
  }
  return out;
};

/**
 * Splits `[start, end]` at sorted interior thresholds, dropping any interior
 * split that would leave a slice narrower than `MIN_SLICE_WIDTH` (£1).
 */
const partitionStage = (start: number, end: number, rawThresholds: number[]): Array<[number, number]> => {
  if (end <= start) return [];
  const sorted = rawThresholds
    .filter(t => Number.isFinite(t) && t > start && t < end)
    .sort((a, b) => a - b);
  const points: number[] = [start];
  for (const t of sorted) {
    const prev = points[points.length - 1];
    if (t - prev >= MIN_SLICE_WIDTH && end - t >= MIN_SLICE_WIDTH) {
      points.push(t);
    }
  }
  points.push(end);
  const pairs: Array<[number, number]> = [];
  for (let i = 0; i < points.length - 1; i++) {
    pairs.push([points[i], points[i + 1]]);
  }
  return pairs;
};

const buildSlice = (
  kind: UkPaySliceKind,
  from: number,
  to: number,
  before: UkTaxBreakdown,
  after: UkTaxBreakdown,
): UkPaySlice => {
  const gross = to - from;
  const incomeTax = Math.max(0, after.incomeTax - before.incomeTax);
  const nationalInsurance = Math.max(0, after.nationalInsurance - before.nationalInsurance);
  const studentLoan = Math.max(0, after.studentLoan + after.postgradLoan - (before.studentLoan + before.postgradLoan));
  const childBenefitCharge = Math.max(0, after.childBenefitCharge - before.childBenefitCharge);
  const pension = Math.max(0, after.pensionFromPay - before.pensionFromPay);
  // The child benefit is constant in income, so it cancels here and only the
  // charge on it moves `kept`.
  const kept = after.takeHome - before.takeHome;
  const rateOf = (amount: number): number => (gross > 0 ? clamp(amount / gross, 0, 1) : 0);
  return {
    kind,
    from,
    to,
    gross,
    incomeTax,
    nationalInsurance,
    studentLoan,
    childBenefitCharge,
    pension,
    kept,
    keptRate: gross > 0 ? kept / gross : 0,
    incomeTaxRate: rateOf(incomeTax),
    nationalInsuranceRate: rateOf(nationalInsurance),
    studentLoanRate: rateOf(studentLoan),
    childBenefitChargeRate: rateOf(childBenefitCharge),
    pensionRate: rateOf(pension),
  };
};

/**
 * Breaks `input` down into contiguous slices across every income tax, National
 * Insurance, student loan and (when child benefit is claimed) High Income Child
 * Benefit Charge threshold, followed by the pension slice and any taxable
 * benefit-in-kind slices, plus the summary totals and shares of cash pay.
 *
 * The totals match `calculateUkTax` on the same input, less the child benefit
 * itself: the charge is a tax on income and is counted, the benefit is not pay
 * and is reported apart (`childBenefit`). `rawTakeHome` is therefore
 * `calculateUkTax(input).takeHome - childBenefit`. Childcare support is not
 * pay either and is ignored.
 *
 * The exact calculation takes the charge 1% per complete £200 of adjusted net
 * income above £60,000, so a slice inside £60,000-£80,000 carries a stepped
 * total. That is fine for a slice average, but a slice's charge is not its
 * marginal rate times its width.
 *
 * When `opts.includePensionAndBenefits` is `false`, the pension (its fixed sum
 * and its share) and `benefitsInKind` are zeroed before computing so the
 * caller can toggle between salary-only and full-package views without doing
 * arithmetic in a component.
 */
export const ukTakeHomeBySlice = (
  input: UkTaxInput,
  opts?: { includePensionAndBenefits?: boolean },
): UkTakeHomeSummary => {
  const include = opts?.includePensionAndBenefits ?? true;
  const effectiveInput: UkTaxInput = include
    ? input
    : { ...input, pensionContribution: 0, pensionShare: 0, benefitsInKind: 0 };
  // Children stay in: the charge is a tax on income. Childcare support is a
  // cliff in what the household keeps, not pay, so it is dropped.
  const r = resolve({ ...effectiveInput, childcareSupport: 0 });
  const full = compute(r, { smooth: false });
  const mode: Mode = { smooth: false, marriageAllowanceEligible: full.marriageAllowanceEligible };

  const slices: UkPaySlice[] = [];
  const payEnd = r.income - r.contribution;

  // Stage 1: cash salary after pension (`0` -> `payEnd`), with `contribution = 0, bik = 0`,
  // so adjusted net income is `x`.
  if (payEnd > 0) {
    const thresholds = [
      ...totalIncomeTaxThresholds(r.allowance, 0, r.region, full.marriageAllowanceEligible),
      ...niAndLoanThresholds(r),
    ];
    if (r.children > 0) {
      thresholds.push(RULES.hicbcStart, RULES.hicbcFullAt);
    }
    const stateAt = (x: number): Resolved => ({ ...r, income: x, contribution: 0, bik: 0 });
    for (const [a, b] of partitionStage(0, payEnd, thresholds)) {
      slices.push(
        buildSlice('income', a, b, compute(stateAt(a), mode).breakdown, compute(stateAt(b), mode).breakdown),
      );
    }
  }

  // Stage 2: pension slice (`payEnd` -> `r.income`), with `contribution = x - payEnd, bik = 0`.
  // Adjusted net income is `payEnd` all the way along, whatever the method, so
  // the charge has no threshold here and the slices carry none of it:
  //   salary sacrifice / net pay: pay = x - (x - payEnd) = payEnd, no relief at source;
  //   relief at source:           pay = x, less the grossed-up (x - payEnd) = payEnd.
  if (r.contribution > 0) {
    const thresholds: number[] = [];
    if (r.method === 'net-pay') {
      thresholds.push(...niAndLoanThresholds(r));
    } else if (r.method === 'relief-at-source') {
      thresholds.push(...niAndLoanThresholds(r));
      const paAtPayEnd = compute({ ...r, income: payEnd, contribution: 0, bik: 0 }, mode).breakdown.personalAllowance;
      thresholds.push(paAtPayEnd);
      if (full.marriageAllowanceEligible) {
        thresholds.push(paAtPayEnd + taxableAtTax(RULES.marriageAllowanceReduction, RULES.bands[r.region]));
      }
      const unextendedCount = RULES.firstExtendedBand[r.region];
      for (let i = 0; i < unextendedCount; i++) {
        const limit = RULES.bands[r.region][i].limit;
        if (Number.isFinite(limit)) {
          thresholds.push(paAtPayEnd + limit);
        }
      }
    }
    const stateAt = (x: number): Resolved => ({ ...r, income: x, contribution: x - payEnd, bik: 0 });
    for (const [a, b] of partitionStage(payEnd, r.income, thresholds)) {
      slices.push(
        buildSlice('pension', a, b, compute(stateAt(a), mode).breakdown, compute(stateAt(b), mode).breakdown),
      );
    }
  }

  // Stage 3: taxable benefits in kind (`0` -> `r.bik`), reported on top of `r.income`.
  if (r.bik > 0) {
    const pay = r.income - preTaxDeductionOf(r);
    const rasGross = rasGrossOf(r);
    const bikThresholds = totalIncomeTaxThresholds(
      r.allowance,
      rasGross,
      r.region,
      full.marriageAllowanceEligible,
    ).map(total => total - pay);
    if (r.children > 0) {
      // Adjusted net income is `pay + b - rasGross`, so a threshold `t` on it
      // falls at `b = t + rasGross - pay`.
      bikThresholds.push(RULES.hicbcStart + rasGross - pay, RULES.hicbcFullAt + rasGross - pay);
    }
    const stateAt = (b: number): Resolved => ({ ...r, income: r.income, contribution: r.contribution, bik: b });
    for (const [bFrom, bTo] of partitionStage(0, r.bik, bikThresholds)) {
      slices.push(
        buildSlice(
          'benefit-in-kind',
          r.income + bFrom,
          r.income + bTo,
          compute(stateAt(bFrom), mode).breakdown,
          compute(stateAt(bTo), mode).breakdown,
        ),
      );
    }
  }

  const b = full.breakdown;
  const incomeTax = b.incomeTax;
  const nationalInsurance = b.nationalInsurance;
  const studentLoan = b.studentLoan + b.postgradLoan;
  const childBenefitCharge = b.childBenefitCharge;
  const pensionFromPay = b.pensionFromPay;
  const totalDeductions = pensionFromPay + incomeTax + nationalInsurance + studentLoan + childBenefitCharge;
  const rawTakeHome = r.income - totalDeductions;
  const takeHome = Math.max(0, rawTakeHome);

  return {
    income: r.income,
    benefitsInKind: r.bik,
    pensionContribution: r.contribution,
    pensionFromPay,
    incomeTax,
    nationalInsurance,
    studentLoan,
    childBenefitCharge,
    totalDeductions,
    takeHome,
    rawTakeHome,
    childBenefit: b.childBenefit,
    takeHomeRate: shareOfIncome(takeHome, r.income),
    shares: {
      takeHome: shareOfIncome(takeHome, r.income),
      ...deductionSharesOf(b, r.income),
      childBenefitCharge: shareOfIncome(childBenefitCharge, r.income),
    },
    slices,
  };
};

/** Two candidate breakpoints closer than this (£) are the same breakpoint, as is one this close to either end. */
const BREAKPOINT_TOLERANCE = 1e-6;

const sameMarginalRates = (a: UkMarginalRates, b: UkMarginalRates): boolean =>
  Math.abs(a.incomeTax - b.incomeTax) <= RATE_TOLERANCE &&
  Math.abs(a.nationalInsurance - b.nationalInsurance) <= RATE_TOLERANCE &&
  Math.abs(a.studentLoan - b.studentLoan) <= RATE_TOLERANCE &&
  Math.abs(a.postgradLoan - b.postgradLoan) <= RATE_TOLERANCE &&
  Math.abs(a.childBenefitCharge - b.childBenefitCharge) <= RATE_TOLERANCE;

/** Whether a reading is the one the band before it already describes: the same rates, band and taper state. */
const sameReading = (band: UkMarginalBand, reading: MarginalReading): boolean =>
  sameMarginalRates(band, reading.rates) &&
  band.incomeTaxBand === reading.incomeTaxBand &&
  band.allowanceTapering === reading.allowanceTapering;

/**
 * The ranges of `income`, from 0 up to `maxIncome`, across which every marginal
 * rate of `ukMarginalRates` is constant: the steps of the line `ukTaxCurve`
 * draws, said once instead of read back off a thousand sampled points. Only
 * `income` varies, and a pension share with it; everything else is held as
 * entered, as the curve does.
 * Bands are contiguous, the first starts at 0 and the last ends at
 * `maxIncome`; adjacent bands never match in all five component rates, income
 * tax band and taper state together.
 *
 * Each band also says which income tax band it sits in (`incomeTaxBand`, null
 * where the next pound pays no income tax) and whether the £100,000 allowance
 * taper is running (`allowanceTapering`). Both are read at the very point the
 * rates are, by the same `readMarginal`, so a band cannot show a rate its flags
 * do not explain: with no pension share, a tapering band's income tax rate is
 * its band's rate times `1 + UK_ALLOWANCE_TAPER_RATE`. A share under salary
 * sacrifice or net pay lowers every rate it reaches by the part of the pound
 * it takes, and under relief at source moves that part of a higher-rate pound
 * into the basic band. Both are part of what makes two adjacent
 * intervals one band.
 *
 * The breakpoints are found analytically, in income space, and the rates are
 * then read from `ukMarginalRates` itself at the middle of each interval
 * between them, so the bands cannot disagree with the rate the curve shows.
 * Intervals whose rates match are merged, which is what makes generating too
 * many breakpoints harmless and generating too few the bug to avoid. A
 * breakpoint is a threshold on income itself or on income less the pension
 * (which `incomeLeaving` moves back onto income, a fixed sum by adding it and
 * a share by undoing the share), so each is shifted from the quantity it is a
 * threshold on back to `income`:
 *
 * - Income tax thresholds are on total income (pay plus benefits in kind), and
 *   pay is `income` less the pension under salary sacrifice and net pay, so
 *   each is on income less the pension once the benefits in kind are taken
 *   off. Under relief at source the contribution does not come off pay but
 *   stretches the bands and moves the taper start by exactly as much, which
 *   `totalIncomeTaxThresholds` takes as its gross argument for a fixed sum, so
 *   the same holds less that stretch. The exceptions are the thresholds below
 *   the first stretched band (the allowance, marriage allowance's reach and
 *   Scotland's starter band), which relief at source leaves on income itself;
 *   with a share they are added again, unshifted before the taper and, for a
 *   stated allowance large enough to reach them inside it, solved there with
 *   the allowance falling as the pension lowers adjusted net income. Marriage
 *   allowance eligibility is pinned
 *   per income and can be either, so both sets are used.
 * - National Insurance and student loan thresholds are on pay for contributions,
 *   which only salary sacrifice reduces: on income less the pension under
 *   sacrifice, and on income itself otherwise.
 * - The child benefit charge thresholds are on adjusted net income, which is
 *   income less the pension plus the benefits in kind under every method.
 * - A pension share on qualifying earnings changes how much of each pound it
 *   takes at the lower and upper limits, so both are breakpoints too.
 * - Below the fixed sum it is capped at `income`, so the pension is not the
 *   one the thresholds above assume (the whole of it already made) and a second
 *   set is added: where the pension is first paid in full, the tax thresholds with nothing
 *   shifted but the benefits in kind, and the NI and loan thresholds on income
 *   as it stands. The rate is continuous across the contribution, so these
 *   mostly repeat a threshold already found and the merge discards them. The
 *   exception is relief at source: there adjusted net income is the benefits in
 *   kind alone, so the allowance in force is the one tapered at that figure and
 *   not the stated one, and the unstretched Scottish starter band is crossed at
 *   the income that adds up to it. That only differs when benefits in kind
 *   taper the allowance, and the crossing is only above zero for a stated
 *   allowance of about £96,000 or more, but there the totals-based thresholds
 *   miss it.
 *
 * Each rate is a one-pound difference, so one read within £1 below a breakpoint
 * straddles it and is a blend of two bands. An interval narrower than £2 is
 * therefore read as far right in it as lets the pound end at its edge, rather
 * than at its middle. One narrower than £1 (two breakpoints a few pence apart,
 * say) has no such place and is read at its start, where its rate is the blend
 * `ukMarginalRates` itself reports there, not the pure slope.
 *
 * Empty for a non-finite or non-positive `maxIncome`. The number of bands is
 * capped at 200 so a pathological input cannot lock the page. Never NaN.
 */
export const ukMarginalBands = (input: UkTaxInput, opts: { maxIncome: number }): UkMarginalBand[] => {
  const { maxIncome } = opts;
  if (!Number.isFinite(maxIncome) || maxIncome <= 0) return [];

  const r = resolve(input);
  const fixed = r.pensionFixed;
  const ras = r.method === 'relief-at-source';
  const rasFixed = ras ? fixed : 0;

  const taxThresholds = (gross: number): number[] =>
    [true, false].flatMap(eligible => totalIncomeTaxThresholds(r.allowance, gross, r.region, eligible));

  // Once the whole contribution is being made. The tax thresholds come back
  // on total income for the fixed sum alone, which under relief at source
  // stretches the bands and the taper start by it; less that stretch, each
  // is on income less the pension.
  const tax = taxThresholds(rasFixed).map(total => total - rasFixed - r.bik);
  const candidates: number[] = [
    ...tax.map(net => incomeLeaving(net, r)),
    ...niAndLoanThresholds(r).map(threshold => (r.method === 'salary-sacrifice' ? incomeLeaving(threshold, r) : threshold)),
  ];
  if (r.children > 0) {
    for (const adjustedNetIncome of [RULES.hicbcStart, RULES.hicbcFullAt]) {
      candidates.push(incomeLeaving(adjustedNetIncome - r.bik, r));
    }
  }
  if (r.pensionShare > 0) {
    // Where the share's basis bends, the share of each pound changes.
    candidates.push(...PENSION_BASIS_PIECES[r.pensionBasis].map(piece => piece.from));
    // Under relief at source the allowance, marriage allowance's reach and
    // Scotland's unstretched starter band are on income itself, which a share
    // separates from income less the pension. Before the taper each is the
    // allowance plus its target, less the benefits in kind. Inside it the
    // allowance falls by the taper rate of adjusted net income, which the
    // pension lowers, so income less that rate's share of the pension, over
    // one plus the rate, is what reaches the target: `incomeLeaving` with the
    // pension scaled by rate / (1 + rate).
    if (ras) {
      const targets = [
        0,
        taxableAtTax(RULES.marriageAllowanceReduction, bandsFor(r.region, 0)),
        ...RULES.bands[r.region].slice(0, RULES.firstExtendedBand[r.region]).map(band => band.limit),
      ];
      const k = RULES.taperRate / (1 + RULES.taperRate);
      const scaled: Resolved = { ...r, pensionFixed: r.pensionFixed * k, pensionShare: r.pensionShare * k };
      candidates.push(...targets.map(target => r.allowance + target - r.bik));
      candidates.push(
        ...targets.map(target =>
          incomeLeaving((target + r.allowance + RULES.taperRate * RULES.taperStart) / (1 + RULES.taperRate) - r.bik, scaled),
        ),
      );
    }
  }

  // While it is still being made, and where it is complete.
  if (fixed > 0) {
    candidates.push(incomeLeaving(0, r));
    candidates.push(...taxThresholds(0).map(total => total - r.bik));
    candidates.push(...niAndLoanThresholds(r));
    if (r.method === 'relief-at-source') {
      const allowance = compute({ ...r, income: 0, contribution: 0 }, { smooth: true }).breakdown.personalAllowance;
      const targets = [
        0,
        taxableAtTax(RULES.marriageAllowanceReduction, bandsFor(r.region, 0)),
        ...RULES.bands[r.region].map(band => band.limit).filter(Number.isFinite),
      ];
      candidates.push(...targets.map(target => allowance + target - r.bik));
    }
  }

  const cuts = candidates
    .filter(t => Number.isFinite(t) && t > BREAKPOINT_TOLERANCE && t < maxIncome - BREAKPOINT_TOLERANCE)
    .sort((a, b) => a - b);
  const points: number[] = [0];
  for (const t of cuts) {
    if (t - points[points.length - 1] > BREAKPOINT_TOLERANCE) points.push(t);
  }
  points.length = Math.min(points.length, RULES.maxMarginalBands);
  points.push(maxIncome);

  const bands: UkMarginalBand[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const from = points[i];
    const to = points[i + 1];
    const width = to - from;
    const reading = readMarginal({ ...input, income: from + Math.max(0, Math.min(width / 2, width - 1)) });
    const last = bands[bands.length - 1];
    if (last !== undefined && sameReading(last, reading)) {
      last.to = to;
    } else {
      bands.push({
        from,
        to,
        ...reading.rates,
        incomeTaxBand: reading.incomeTaxBand,
        allowanceTapering: reading.allowanceTapering,
      });
    }
  }
  return bands;
};

export type UkWhatIfKey = 'no-loan' | 'no-pension' | 'more-pension' | 'salary-sacrifice';

export interface UkWhatIf {
  key: UkWhatIfKey;
  /** The input with only this change made. */
  input: UkTaxInput;
  /** Share of the pension's basis the what-if adds to `pensionShare`; 0 unless `more-pension`. */
  extraPensionShare: number;
}

/**
 * Alternatives worth comparing against `input`, in this order, each only when
 * it changes something. Each `input` is the one given with only that change
 * made, every other field passed through exactly as it came:
 *
 * - `no-loan`: no undergraduate plan and no postgraduate loan; offered when
 *   either is set.
 * - `no-pension`: no fixed sum and no share; offered when there is either.
 * - `more-pension`: a pension share 5 points higher (`extraPensionShare`), of
 *   the same basis, with any fixed sum left as it is. Being a share it moves
 *   with income across the curve, as a raised percentage would. Offered while
 *   the share can rise that far without passing all of the basis.
 * - `salary-sacrifice`: the pension paid by salary sacrifice; offered to an
 *   employee with a pension who is not already using it. A sole trader has no
 *   payroll to sacrifice from, so is never offered it.
 *
 * Sanitised as `resolve` does, so an unknown plan counts as none, an unknown
 * method as relief at source, and a negative or non-finite contribution or
 * share as 0. The fixed sum is taken in full pounds rather than capped at the
 * income given, as `ukTaxCliffs` and `ukMarginalBands` take it: the what-ifs
 * are compared across a curve of incomes, and the cap at this one does not
 * bind at the others. Nothing is computed from the tax rules here: this says
 * which inputs to compare, and the calculator does the rest.
 */
export const ukWhatIfs = (input: UkTaxInput): UkWhatIf[] => {
  const r = resolve(input);
  const hasPension = r.pensionFixed > 0 || r.pensionShare > 0;
  const whatIfs: UkWhatIf[] = [];

  if (r.plan !== 'none' || r.postgrad) {
    whatIfs.push({
      key: 'no-loan',
      input: { ...input, undergradPlan: 'none', postgradLoan: false },
      extraPensionShare: 0,
    });
  }

  if (hasPension) {
    whatIfs.push({
      key: 'no-pension',
      input: { ...input, pensionContribution: 0, pensionShare: 0 },
      extraPensionShare: 0,
    });
  }

  if (r.pensionShare + WHAT_IF_EXTRA_PENSION_SHARE <= 1) {
    whatIfs.push({
      key: 'more-pension',
      input: { ...input, pensionShare: r.pensionShare + WHAT_IF_EXTRA_PENSION_SHARE },
      extraPensionShare: WHAT_IF_EXTRA_PENSION_SHARE,
    });
  }

  if (r.kind === 'employed' && hasPension && r.method !== 'salary-sacrifice') {
    whatIfs.push({
      key: 'salary-sacrifice',
      input: { ...input, pensionMethod: 'salary-sacrifice' },
      extraPensionShare: 0,
    });
  }

  return whatIfs;
};
