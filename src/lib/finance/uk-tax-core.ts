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

/** A range of `income`, in £/yr, for shading a chart: `from` up to `to`. */
export interface UkIncomeBand {
  from: number;
  to: number;
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


/** @internal Shared with `./uk-tax-curves`. */
export type {
  Band as _UkTaxBand,
  MarginalReading as _UkTaxMarginalReading,
  Mode as _UkTaxMode,
  Resolved as _UkTaxResolved,
};

/** @internal Shared with `./uk-tax-curves`. */
export const _ukTaxInternals = {
  RULES,
  clamp,
  nonNegative,
  bandsFor,
  resolve,
  compute,
  preTaxDeductionOf,
  rasGrossOf,
  RATE_TOLERANCE,
  readMarginal,
  incomeLeaving,
  PENSION_BASIS_PIECES,
};

