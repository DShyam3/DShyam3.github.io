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
  /** Cash leaving pay into the pension on this slice, £/yr (`0.8 * gross` under relief at source). */
  pension: number;
  /** Change in cash take-home from this slice, £/yr; negative when pension deductions or BIK tax reduce cash. */
  kept: number;
  /** Cash take-home change divided by `gross`; may be negative. */
  keptRate: number;
  /** Marginal rates on this slice, each clamped to `[0, 1]`. */
  incomeTaxRate: number;
  nationalInsuranceRate: number;
  studentLoanRate: number;
  pensionRate: number;
}

export interface UkTakeHomeShares {
  /** Each share is in `[0, 1]` (`amount / income`, or `0` when `income <= 0`), with `takeHome` clamped to `[0, 1]`. */
  takeHome: number;
  pension: number;
  incomeTax: number;
  nationalInsurance: number;
  studentLoan: number;
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
  /** Total deductions from cash pay (`pensionFromPay + incomeTax + nationalInsurance + studentLoan`), £/yr. */
  totalDeductions: number;
  /** Cash pay left after `totalDeductions`, clamped at `0` (`Math.max(0, income - totalDeductions)`), £/yr. */
  takeHome: number;
  /** Unclamped cash pay left (`income - totalDeductions`), £/yr — matches `calculateUkTax` (with `children: 0`). */
  rawTakeHome: number;
  /** Fraction of `income` kept (`takeHome / income`, clamped to `[0, 1]`; `0` when `income <= 0`). */
  takeHomeRate: number;
  /** Per-category shares of `income` (`[0, 1]`) for the stacked bar and legend. */
  shares: UkTakeHomeShares;
  /** Ordered slices from £0 up through salary, pension and benefits in kind. */
  slices: UkPaySlice[];
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
  personalAllowance: UK_STATUTORY_PERSONAL_ALLOWANCE,
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
  maxChildren: 20,
  maxCurvePoints: 2000,
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
  contribution: number;
  method: UkPensionMethod;
  plan: UkUndergradPlan;
  postgrad: boolean;
  children: number;
  childcareSupport: number;
  marriageAllowance: boolean;
  /** Base personal allowance before the taper. */
  allowance: number;
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
    allowance: ukBasePersonalAllowance(input.personalAllowance),
  };
};

/**
 * `resolve` with the pension contribution in full pounds rather than capped at
 * the income given. For solving an income (a cliff, a band) the cap at the
 * current income does not bind at the income being solved for.
 */
const resolveUncapped = (input: UkTaxInput): Resolved => ({
  ...resolve(input),
  contribution: nonNegative(input.pensionContribution),
});

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
 * The pension contribution is held at its sanitised pounds on both sides rather
 * than recapped at the larger income, so the bonus is not itself pensioned.
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
  const r = resolveUncapped(input);
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
    // The personal allowance is still whole at these incomes (true while the
    // stated allowance plus the band ceiling is under the £100,000 taper
    // start, which holds for any allowance up to about £62,000), so taxable
    // income of `limit` is total income of `limit` plus the stated allowance.
    cliffs.push({
      kind: 'marriage-allowance',
      atIncome: incomeFor(limit + r.allowance),
      cost: Math.min(RULES.marriageAllowanceReduction, taxOnBands(limit, bandsFor(r.region, rasGrossOf(r)))),
    });
  }

  // Below the contribution the cap binds and adjusted net income is just the
  // benefits in kind, so a solved income under it means the benefit is lost
  // at every income. With no contribution this is the same as `>= 0`.
  return cliffs.filter(c => c.atIncome >= r.contribution).sort((a, b) => a.atIncome - b.atIncome);
};

/**
 * The range of `income`, every other input fixed, over which adjusted net
 * income runs from £60,000 to £80,000: where the High Income Child Benefit
 * Charge climbs from nothing to all of it. For shading a chart of `ukTaxCurve`.
 *
 * Adjusted net income as a function of income is flat at the benefits in kind
 * while income is below the pension contribution (pay is nil under salary
 * sacrifice or net pay, and relief at source is capped at income), then rises
 * pound for pound. So each end is the threshold less the benefits in kind plus
 * the contribution, or 0 where the benefits alone already reach the threshold.
 * As with `ukTaxCliffs` the contribution is taken in full pounds, because the
 * curve recomputes each point and the cap at the current income does not bind
 * where the band sits; the result therefore ignores `income` altogether.
 *
 * `null` when no child benefit is claimed (the children count is sanitised as
 * in `calculateUkTax`), or when benefits in kind alone reach £80,000 so that
 * the charge is total at every income and there is no band to shade.
 */
export const ukChildBenefitBand = (input: UkTaxInput): UkIncomeBand | null => {
  const r = resolveUncapped(input);
  if (r.children === 0) return null;

  const incomeAt = (adjustedNetIncome: number): number =>
    r.bik >= adjustedNetIncome ? 0 : adjustedNetIncome - r.bik + r.contribution;

  const to = incomeAt(RULES.hicbcFullAt);
  if (to <= 0) return null;
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
  const pension = Math.max(0, after.pensionFromPay - before.pensionFromPay);
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
    pension,
    kept,
    keptRate: gross > 0 ? kept / gross : 0,
    incomeTaxRate: rateOf(incomeTax),
    nationalInsuranceRate: rateOf(nationalInsurance),
    studentLoanRate: rateOf(studentLoan),
    pensionRate: rateOf(pension),
  };
};

/**
 * Breaks `input` down into contiguous slices across every income tax, National
 * Insurance, and student loan threshold, followed by the pension slice and any
 * taxable benefit-in-kind slices, plus the summary totals and shares of cash
 * pay.
 *
 * When `opts.includePensionAndBenefits` is `false`, `pensionContribution` and
 * `benefitsInKind` are zeroed before computing so the caller can toggle between
 * salary-only and full-package views without doing arithmetic in a component.
 */
export const ukTakeHomeBySlice = (
  input: UkTaxInput,
  opts?: { includePensionAndBenefits?: boolean },
): UkTakeHomeSummary => {
  const include = opts?.includePensionAndBenefits ?? true;
  const effectiveInput: UkTaxInput = include
    ? input
    : { ...input, pensionContribution: 0, benefitsInKind: 0 };
  const r = resolve({ ...effectiveInput, children: 0, childcareSupport: 0 });
  const full = compute(r, { smooth: false });
  const mode: Mode = { smooth: false, marriageAllowanceEligible: full.marriageAllowanceEligible };

  const slices: UkPaySlice[] = [];
  const payEnd = r.income - r.contribution;

  // Stage 1: cash salary after pension (`0` -> `payEnd`), with `contribution = 0, bik = 0`.
  if (payEnd > 0) {
    const thresholds = [
      ...totalIncomeTaxThresholds(r.allowance, 0, r.region, full.marriageAllowanceEligible),
      ...niAndLoanThresholds(r),
    ];
    const stateAt = (x: number): Resolved => ({ ...r, income: x, contribution: 0, bik: 0 });
    for (const [a, b] of partitionStage(0, payEnd, thresholds)) {
      slices.push(
        buildSlice('income', a, b, compute(stateAt(a), mode).breakdown, compute(stateAt(b), mode).breakdown),
      );
    }
  }

  // Stage 2: pension slice (`payEnd` -> `r.income`), with `contribution = x - payEnd, bik = 0`.
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
  const pensionFromPay = b.pensionFromPay;
  const totalDeductions = pensionFromPay + incomeTax + nationalInsurance + studentLoan;
  const rawTakeHome = r.income - totalDeductions;
  const takeHome = Math.max(0, rawTakeHome);
  const shareOf = (n: number): number => (r.income > 0 ? clamp(n / r.income, 0, 1) : 0);

  return {
    income: r.income,
    benefitsInKind: r.bik,
    pensionContribution: r.contribution,
    pensionFromPay,
    incomeTax,
    nationalInsurance,
    studentLoan,
    totalDeductions,
    takeHome,
    rawTakeHome,
    takeHomeRate: shareOf(takeHome),
    shares: {
      takeHome: shareOf(takeHome),
      pension: shareOf(pensionFromPay),
      incomeTax: shareOf(incomeTax),
      nationalInsurance: shareOf(nationalInsurance),
      studentLoan: shareOf(studentLoan),
    },
    slices,
  };
};
