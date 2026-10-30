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

/** What a slice of pay is: salary taxed as pay, the pension taken from the top of it, or benefits in kind taxed on top. */
export type UkPaySliceKind = 'salary' | 'pension' | 'benefits-in-kind';

/** A slice's deductions, `taken` and `kept`, each over the slice's width. */
export interface UkPaySliceRates {
  incomeTax: number;
  nationalInsurance: number;
  studentLoan: number;
  childBenefitCharge: number;
  taken: number;
  kept: number;
}

/** One slice of pay, `from` to `to` in £/yr, and what each of the four deductions takes out of it. */
export interface UkPaySlice {
  kind: UkPaySliceKind;
  /** £/yr. Salary and pension slices are ranges of `income`; benefits-in-kind slices run on from `income`, up to `income` plus the benefits. */
  from: number;
  to: number;
  /** `to - from`. */
  width: number;
  /** Index into `UK_TAX_BAND_NAMES[region]` of the income tax band the slice's taxable income sits in; null inside the personal allowance, and on pension slices. */
  taxBand: number | null;
  /** True when the personal allowance is being withdrawn across the slice (adjusted net income over £100,000, allowance not yet gone). Always false on pension slices. */
  allowanceTaper: boolean;
  /** Income tax at the slice's own rate: without `marriageAllowanceLost`, which is a step, not a rate. */
  incomeTax: number;
  nationalInsurance: number;
  /** Undergraduate plan plus postgraduate loan. */
  studentLoan: number;
  childBenefitCharge: number;
  /** incomeTax + nationalInsurance + studentLoan + childBenefitCharge. */
  taken: number;
  /**
   * Marriage allowance relief lost inside this slice, where taxable income
   * passes the limit for it: one step of up to £252, not a rate, so it is kept
   * out of `incomeTax`, `taken`, `kept` and `rates`. 0 on every other slice.
   */
  marriageAllowanceLost: number;
  /**
   * Cash the slice leaves you: its width less `taken` for salary; `-taken` for
   * a pension slice (its width goes to the pension, and any NI or loan on it
   * comes out of other pay) and for benefits in kind (never paid).
   */
  kept: number;
  /** Each deduction, `taken` and `kept` over the slice's width; all 0 for a zero-width slice. */
  rates: UkPaySliceRates;
}

/** Names of the income tax bands, lowest first, matching the rule set's bands per region. */
export const UK_TAX_BAND_NAMES: Readonly<Record<UkTaxRegion, readonly string[]>> = {
  rUK: ['Basic rate', 'Higher rate', 'Additional rate'],
  scotland: ['Starter rate', 'Basic rate', 'Intermediate rate', 'Higher rate', 'Advanced rate', 'Top rate'],
};

/** The four deductions a slice reports, before they are summed into `taken`. */
interface Takings {
  incomeTax: number;
  nationalInsurance: number;
  studentLoan: number;
  childBenefitCharge: number;
}

const takingsOf = (b: UkTaxBreakdown): Takings => ({
  incomeTax: b.incomeTax,
  nationalInsurance: b.nationalInsurance,
  studentLoan: b.studentLoan + b.postgradLoan,
  childBenefitCharge: b.childBenefitCharge,
});

/**
 * Down to the penny, so an edge stays on the side of a crossing where its
 * condition still holds and a cliff just past it falls in the slice above. The
 * millionth of a pound absorbs bisection's error, so a crossing found at
 * £12,569.9999999 is still £12,570.
 */
const floorPenny = (n: number): number => Math.floor(n * 100 + 1e-4) / 100;

/** Slices narrower than this fold into their neighbour: a sliver is noise, and its rate is meaningless. */
const MIN_SLICE = 1;

/**
 * The largest `x` in [0, top] at which `holds` is still true, for a predicate
 * that is true at 0, false at `top`, and changes once, from true to false. Found
 * by bisection to better than a ten-millionth of a pound, which the caller then
 * floors to the penny. The bound of 1,100 halvings covers the whole range of a
 * double; any real pay stops after about forty.
 */
const lastWhere = (holds: (x: number) => boolean, top: number): number => {
  let lo = 0;
  let hi = top;
  for (let i = 0; i < 1100 && hi - lo > 1e-7; i++) {
    const mid = lo + (hi - lo) / 2;
    if (mid <= lo || mid >= hi) break;
    if (holds(mid)) lo = mid;
    else hi = mid;
  }
  return lo + (hi - lo) / 2;
};

/** NI and student loans are charged on pay less a salary sacrifice, not on benefits in kind. */
const contributionBaseOf = (s: Resolved): number => s.income - sacrificeOf(s);

/**
 * The edges of the slices along a path from `at(0)` to `at(top)`: 0, every
 * point inside where a rate changes, and `top`. Each crossing is of a quantity
 * that never falls as the path goes on (the NI and loan base, adjusted net
 * income, taxable income, income tax), measured in smooth mode so the taper and
 * the child benefit charge are continuous: the NI and loan thresholds, the
 * taper's start and end, the charge's start and end, each income tax band limit
 * as taxable income reaches it, and where income tax first appears after a
 * marriage allowance. Floored to the penny of `offset + v`, where the path is
 * shown; a break under £1 from the edge before it, or from `top`, is dropped,
 * so no slice is narrower than £1 unless the whole path is.
 */
const edgesAlong = (r: Resolved, at: (v: number) => Resolved, top: number, offset: number): number[] => {
  const smoothAt = (v: number): Resolved & { b: UkTaxBreakdown } => {
    const s = at(v);
    return { ...s, b: compute(s, { smooth: true }).breakdown };
  };
  const start = smoothAt(0);
  const end = smoothAt(top);
  const crossings: number[] = [];
  const cross = (value: (p: Resolved & { b: UkTaxBreakdown }) => number, targets: number[]) => {
    const from = value(start);
    const to = value(end);
    for (const target of targets) {
      if (from <= target && target < to) crossings.push(lastWhere(v => value(smoothAt(v)) <= target, top));
    }
  };

  cross(contributionBaseOf, [
    RULES.niLower,
    RULES.niUpper,
    ...(r.plan !== 'none' ? [RULES.undergradThreshold[r.plan]] : []),
    ...(r.postgrad ? [RULES.postgradThreshold] : []),
  ]);
  cross(p => p.b.adjustedNetIncome, [
    // With no allowance there is nothing for the taper to withdraw.
    ...(r.allowance > 0 ? [RULES.taperStart, RULES.taperStart + r.allowance / RULES.taperRate] : []),
    ...(r.children > 0 ? [RULES.hicbcStart, RULES.hicbcFullAt] : []),
  ]);
  const ras = rasGrossOf(r);
  cross(p => p.b.taxableIncome, [0, ...bandsFor(r.region, ras).map(band => band.limit).filter(Number.isFinite)]);
  if (r.marriageAllowance) cross(p => p.b.incomeTax, [0]);

  // Floored where the slice is shown, as `offset + v`, so a pension that starts
  // at £48,672.832 still breaks at £50,270 and not a penny under it.
  const edges = [0];
  for (const b of [...new Set(crossings.map(c => floorPenny(offset + c) - offset))].sort((x, y) => x - y)) {
    if (b - edges[edges.length - 1] >= MIN_SLICE && top - b >= MIN_SLICE) edges.push(b);
  }
  edges.push(top);
  return edges;
};

/**
 * Your pay, slice by slice: each range of `income` over which the income tax
 * band, the National Insurance rate, the student loan rates and the child
 * benefit charge are all constant, and how much each takes out of that slice.
 *
 * The model: a pension through salary sacrifice or net pay comes off the TOP of
 * salary, so it is the pay just under the benefits in kind. Under salary
 * sacrifice it takes nothing at all; under net pay it escapes income tax but
 * not National Insurance or loans. Benefits in kind sit on top of everything,
 * taxed but carrying no NI or loan. Relief at source is not a slice, because it
 * leaves pay untouched; it stretches the tax bands and lowers adjusted net
 * income for every pound, so the breakpoints move with it instead.
 *
 * Salary, pension and benefits are each split wherever a rate changes along
 * them (see `edgesAlong`), so a net-pay pension across the NI upper limit, or
 * benefits across the higher-rate limit, are two slices rather than one at a
 * blended rate. Every amount is the difference of two exact `calculateUkTax`
 * evaluations at the slice's ends, so the slices telescope: summed,
 * `incomeTax` plus `marriageAllowanceLost`, `nationalInsurance`, `studentLoan`
 * (undergraduate plus postgraduate) and `childBenefitCharge` equal
 * `calculateUkTax(input)`'s own figures, to float tolerance, and the benefits
 * slices' income tax (with any marriage allowance they lose) is
 * `ukBenefitInKindTax` with the input's own benefits taken out. Where the
 * taper or the charge steps in pounds or £200s, a slice holds the stepped
 * total rather than a smoothed rate; the marriage allowance's one £252 step is
 * reported apart, so it never reads as a rate.
 *
 * Ordered salary slices low to high, then the pension's, then the benefits'.
 * `[]` when there is nothing to show: no income (negative or not a number
 * counts as none) and no benefits in kind. Unrounded, never NaN.
 */
export const ukPaySlices = (input: UkTaxInput): UkPaySlice[] => {
  const r = resolve(input);
  const exact: Mode = { smooth: false };

  const preTax = preTaxDeductionOf(r);
  const salaryTop = r.income - preTax;

  const slices: UkPaySlice[] = [];
  /**
   * The slices of one path, shown from `offset` to `end`. `end` is passed
   * rather than added up, so the last slice ends exactly on income (or income
   * plus benefits) however the path was split.
   */
  const along = (
    kind: UkPaySliceKind,
    at: (v: number) => Resolved,
    top: number,
    offset: number,
    end: number,
  ) => {
    if (!(top > 0)) return;
    const edges = edgesAlong(r, at, top, offset);
    let startBreakdown = compute(at(0), exact).breakdown;
    for (let i = 1; i < edges.length; i++) {
      const from = offset + edges[i - 1];
      const to = i === edges.length - 1 ? end : offset + edges[i];
      const endBreakdown = compute(at(edges[i]), exact).breakdown;
      const start = takingsOf(startBreakdown);
      const stop = takingsOf(endBreakdown);
      const width = to - from;
      // Relief only falls where eligibility ends: everywhere else it holds or
      // rises with the tax it relieves.
      const marriageAllowanceLost = Math.max(
        0,
        startBreakdown.marriageAllowanceRelief - endBreakdown.marriageAllowanceRelief,
      );
      const incomeTax = stop.incomeTax - start.incomeTax - marriageAllowanceLost;
      const nationalInsurance = stop.nationalInsurance - start.nationalInsurance;
      const studentLoan = stop.studentLoan - start.studentLoan;
      const childBenefitCharge = stop.childBenefitCharge - start.childBenefitCharge;
      const taken = incomeTax + nationalInsurance + studentLoan + childBenefitCharge;
      const kept = kind === 'salary' ? width - taken : -taken;
      const middle = compute(at(edges[i - 1] + (edges[i] - edges[i - 1]) / 2), { smooth: true }).breakdown;
      const bands = bandsFor(r.region, rasGrossOf(r));
      const taxed = kind !== 'pension' && middle.taxableIncome > 0;
      const over = (n: number): number => (width > 0 ? n / width : 0);
      slices.push({
        kind,
        from,
        to,
        width,
        taxBand: taxed ? bands.findIndex(band => band.limit >= middle.taxableIncome) : null,
        allowanceTaper:
          kind !== 'pension' && middle.adjustedNetIncome > RULES.taperStart && middle.personalAllowance > 0,
        incomeTax,
        nationalInsurance,
        studentLoan,
        childBenefitCharge,
        taken,
        marriageAllowanceLost,
        kept,
        rates: {
          incomeTax: over(incomeTax),
          nationalInsurance: over(nationalInsurance),
          studentLoan: over(studentLoan),
          childBenefitCharge: over(childBenefitCharge),
          taken: over(taken),
          kept: over(kept),
        },
      });
      startBreakdown = endBreakdown;
    }
  };

  // Salary alone at `x`: no benefits in kind and no pension that leaves pay
  // (that is the next path), but relief at source stays, since it never leaves
  // pay and so shapes the bands and adjusted net income at every pound.
  along('salary', x => ({
    ...r,
    income: x,
    bik: 0,
    contribution: r.method === 'relief-at-source' ? r.contribution : 0,
  }), salaryTop, 0, salaryTop);
  // The pension taken from the top: pay rises by `v` and all of it is
  // contributed, so taxed pay holds still and only an NI or loan base can move.
  along('pension', v => ({ ...r, income: salaryTop + v, contribution: v, bik: 0 }), preTax, salaryTop, r.income);
  // Benefits in kind on top of everything else.
  along('benefits-in-kind', v => ({ ...r, bik: v }), r.bik, r.income, r.income + r.bik);

  return slices;
};

/** What `ukTakeHomeBySlice` reports; all £/yr and unrounded unless a share. */
export interface UkTakeHomeBySlice {
  /** `income` as the engine reads it (sanitised): the salary or profit every share is of. */
  pay: number;
  slices: UkPaySlice[];
  /**
   * Sums over the slices; equal to calculateUkTax(input)'s figures. `incomeTax`
   * includes `marriageAllowanceLost`; `studentLoan` is undergraduate plus
   * postgraduate.
   */
  incomeTax: number;
  nationalInsurance: number;
  studentLoan: number;
  childBenefitCharge: number;
  taken: number;
  /** The marriage allowance relief lost where taxable income passes its limit; a step, shown apart from the slices. */
  marriageAllowanceLost: number;
  /** Cash that leaves pay for the pension: calculateUkTax(input).pensionFromPay (80% of the gross under relief at source). */
  pension: number;
  /** Relief at source only: the gross contribution every band from the basic rate up is widened by. 0 otherwise. Paid from take-home, so it is no slice. */
  reliefAtSource: number;
  childBenefit: number;
  /** pay - taken - pension: what reaches the bank from pay, child benefit not included. Negative when deductions and pension exceed pay. */
  kept: number;
  /** -kept when kept is negative, else 0. */
  shortfall: number;
  /** Each over pay; all 0 when pay is 0. keptShare + takenShare + pensionShare is 1 when pay is above 0. */
  keptShare: number;
  takenShare: number;
  pensionShare: number;
  /** The four deductions over pay; they add up to `takenShare`. */
  incomeTaxShare: number;
  nationalInsuranceShare: number;
  studentLoanShare: number;
  childBenefitChargeShare: number;
}

/**
 * Take-home as the slice-by-slice card shows it: `ukPaySlices`, their totals,
 * the pension and what pay keeps, each also as a share of pay, so the page
 * works out no figure of its own beyond a year's worth as twelve months.
 *
 * `kept` is pay less the deductions and the pension. Child benefit is not pay,
 * so it is reported beside it rather than in it: `kept + childBenefit` is
 * `calculateUkTax(input).takeHome`. The slices' own `kept` add up to it less
 * `marriageAllowanceLost` and, under relief at source, the pension paid from
 * take-home. When benefits in kind or a pension cost more than pay, `kept` is
 * negative and `shortfall` says by how much. Never NaN.
 */
export const ukTakeHomeBySlice = (input: UkTaxInput): UkTakeHomeBySlice => {
  const r = resolve(input);
  const slices = ukPaySlices(input);
  const marriageAllowanceLost = slices.reduce((sum, s) => sum + s.marriageAllowanceLost, 0);
  const totals = slices.reduce<Takings>(
    (sum, s) => ({
      incomeTax: sum.incomeTax + s.incomeTax + s.marriageAllowanceLost,
      nationalInsurance: sum.nationalInsurance + s.nationalInsurance,
      studentLoan: sum.studentLoan + s.studentLoan,
      childBenefitCharge: sum.childBenefitCharge + s.childBenefitCharge,
    }),
    { incomeTax: 0, nationalInsurance: 0, studentLoan: 0, childBenefitCharge: 0 },
  );
  const taken = totals.incomeTax + totals.nationalInsurance + totals.studentLoan + totals.childBenefitCharge;
  const whole = compute(r, { smooth: false }).breakdown;
  const pay = r.income;
  const pension = whole.pensionFromPay;
  const kept = pay - taken - pension;
  const share = (n: number): number => (pay > 0 ? n / pay : 0);
  return {
    pay,
    slices,
    ...totals,
    taken,
    marriageAllowanceLost,
    pension,
    reliefAtSource: rasGrossOf(r),
    childBenefit: whole.childBenefit,
    kept,
    shortfall: kept < 0 ? -kept : 0,
    keptShare: share(kept),
    takenShare: share(taken),
    pensionShare: share(pension),
    incomeTaxShare: share(totals.incomeTax),
    nationalInsuranceShare: share(totals.nationalInsurance),
    studentLoanShare: share(totals.studentLoan),
    childBenefitChargeShare: share(totals.childBenefitCharge),
  };
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
