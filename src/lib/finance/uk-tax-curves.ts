/**
 * UK tax curves, take-home share breakdowns, pay slices, marginal bands, and
 * what-if comparison scenarios.
 *
 * Pure; see REHAUL_PLAN.md 7.I. Re-exported from `./uk-tax-calculator`.
 */

import {
  _ukTaxInternals,
  calculateUkTax,
  ukMarginalRate,
  type _UkTaxBand,
  type _UkTaxMarginalReading,
  type _UkTaxMode,
  type _UkTaxResolved,
  type UkIncomeTaxBandName,
  type UkMarginalRates,
  type UkTaxBreakdown,
  type UkTaxInput,
  type UkTaxRegion,
} from './uk-tax-core';

const WHAT_IF_EXTRA_PENSION_SHARE = 0.05;

export interface UkTaxCurvePoint {
  income: number;
  takeHome: number;
  netWithSupport: number;
  /** Fraction of the next £1 of `income` lost to tax, NI, loans and HICBC. */
  marginalRate: number;
}

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
  const count = Math.min(Math.floor(maxIncome / step + 1e-9) + 1, _ukTaxInternals.RULES.maxCurvePoints);
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
const shareOfIncome = (amount: number, income: number): number => (income > 0 ? _ukTaxInternals.clamp(amount / income, 0, 1) : 0);

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
  const income = _ukTaxInternals.nonNegative(input.income);
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
  const count = Math.min(Math.floor(maxIncome / step + 1e-9), _ukTaxInternals.RULES.maxCurvePoints);
  const points: UkTakeHomeSharePoint[] = [];
  for (let i = 1; i <= count; i++) {
    points.push(ukTakeHomeShareAt({ ...input, income: i * step }));
  }
  return points;
};

const MIN_SLICE_WIDTH = 1;

/** Taxable income at which `taxOnBands(taxable, bands)` reaches `targetTax`. */
const taxableAtTax = (targetTax: number, bands: _UkTaxBand[]): number => {
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
  const bands = _ukTaxInternals.bandsFor(region, rasGross);
  const taperStartTotal = _ukTaxInternals.RULES.taperStart + rasGross;
  const taperEndTotal = taperStartTotal + allowance / _ukTaxInternals.RULES.taperRate;
  const thresholds: number[] = [];

  if (allowance > 0) {
    thresholds.push(taperStartTotal, taperEndTotal);
  }

  const taxableTargets: number[] = [];
  if (allowance > 0) {
    taxableTargets.push(0);
  }
  if (marriageAllowanceEligible) {
    taxableTargets.push(taxableAtTax(_ukTaxInternals.RULES.marriageAllowanceReduction, bands));
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
      const inTaper = (target + allowance + _ukTaxInternals.RULES.taperRate * taperStartTotal) / (1 + _ukTaxInternals.RULES.taperRate);
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
const niAndLoanThresholds = (r: _UkTaxResolved): number[] => {
  const out: number[] = [_ukTaxInternals.RULES.niLower, _ukTaxInternals.RULES.niUpper];
  if (r.plan !== 'none') {
    out.push(_ukTaxInternals.RULES.undergradThreshold[r.plan]);
  }
  if (r.postgrad) {
    out.push(_ukTaxInternals.RULES.postgradThreshold);
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
  const rateOf = (amount: number): number => (gross > 0 ? _ukTaxInternals.clamp(amount / gross, 0, 1) : 0);
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
  const r = _ukTaxInternals.resolve({ ...effectiveInput, childcareSupport: 0 });
  const full = _ukTaxInternals.compute(r, { smooth: false });
  const mode: _UkTaxMode = { smooth: false, marriageAllowanceEligible: full.marriageAllowanceEligible };

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
      thresholds.push(_ukTaxInternals.RULES.hicbcStart, _ukTaxInternals.RULES.hicbcFullAt);
    }
    const stateAt = (x: number): _UkTaxResolved => ({ ...r, income: x, contribution: 0, bik: 0 });
    for (const [a, b] of partitionStage(0, payEnd, thresholds)) {
      slices.push(
        buildSlice('income', a, b, _ukTaxInternals.compute(stateAt(a), mode).breakdown, _ukTaxInternals.compute(stateAt(b), mode).breakdown),
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
      const paAtPayEnd = _ukTaxInternals.compute({ ...r, income: payEnd, contribution: 0, bik: 0 }, mode).breakdown.personalAllowance;
      thresholds.push(paAtPayEnd);
      if (full.marriageAllowanceEligible) {
        thresholds.push(paAtPayEnd + taxableAtTax(_ukTaxInternals.RULES.marriageAllowanceReduction, _ukTaxInternals.RULES.bands[r.region]));
      }
      const unextendedCount = _ukTaxInternals.RULES.firstExtendedBand[r.region];
      for (let i = 0; i < unextendedCount; i++) {
        const limit = _ukTaxInternals.RULES.bands[r.region][i].limit;
        if (Number.isFinite(limit)) {
          thresholds.push(paAtPayEnd + limit);
        }
      }
    }
    const stateAt = (x: number): _UkTaxResolved => ({ ...r, income: x, contribution: x - payEnd, bik: 0 });
    for (const [a, b] of partitionStage(payEnd, r.income, thresholds)) {
      slices.push(
        buildSlice('pension', a, b, _ukTaxInternals.compute(stateAt(a), mode).breakdown, _ukTaxInternals.compute(stateAt(b), mode).breakdown),
      );
    }
  }

  // Stage 3: taxable benefits in kind (`0` -> `r.bik`), reported on top of `r.income`.
  if (r.bik > 0) {
    const pay = r.income - _ukTaxInternals.preTaxDeductionOf(r);
    const rasGross = _ukTaxInternals.rasGrossOf(r);
    const bikThresholds = totalIncomeTaxThresholds(
      r.allowance,
      rasGross,
      r.region,
      full.marriageAllowanceEligible,
    ).map(total => total - pay);
    if (r.children > 0) {
      // Adjusted net income is `pay + b - rasGross`, so a threshold `t` on it
      // falls at `b = t + rasGross - pay`.
      bikThresholds.push(_ukTaxInternals.RULES.hicbcStart + rasGross - pay, _ukTaxInternals.RULES.hicbcFullAt + rasGross - pay);
    }
    const stateAt = (b: number): _UkTaxResolved => ({ ...r, income: r.income, contribution: r.contribution, bik: b });
    for (const [bFrom, bTo] of partitionStage(0, r.bik, bikThresholds)) {
      slices.push(
        buildSlice(
          'benefit-in-kind',
          r.income + bFrom,
          r.income + bTo,
          _ukTaxInternals.compute(stateAt(bFrom), mode).breakdown,
          _ukTaxInternals.compute(stateAt(bTo), mode).breakdown,
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
  Math.abs(a.incomeTax - b.incomeTax) <= _ukTaxInternals.RATE_TOLERANCE &&
  Math.abs(a.nationalInsurance - b.nationalInsurance) <= _ukTaxInternals.RATE_TOLERANCE &&
  Math.abs(a.studentLoan - b.studentLoan) <= _ukTaxInternals.RATE_TOLERANCE &&
  Math.abs(a.postgradLoan - b.postgradLoan) <= _ukTaxInternals.RATE_TOLERANCE &&
  Math.abs(a.childBenefitCharge - b.childBenefitCharge) <= _ukTaxInternals.RATE_TOLERANCE;

/** Whether a reading is the one the band before it already describes: the same rates, band and taper state. */
const sameReading = (band: UkMarginalBand, reading: _UkTaxMarginalReading): boolean =>
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

  const r = _ukTaxInternals.resolve(input);
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
    ...tax.map(net => _ukTaxInternals.incomeLeaving(net, r)),
    ...niAndLoanThresholds(r).map(threshold => (r.method === 'salary-sacrifice' ? _ukTaxInternals.incomeLeaving(threshold, r) : threshold)),
  ];
  if (r.children > 0) {
    for (const adjustedNetIncome of [_ukTaxInternals.RULES.hicbcStart, _ukTaxInternals.RULES.hicbcFullAt]) {
      candidates.push(_ukTaxInternals.incomeLeaving(adjustedNetIncome - r.bik, r));
    }
  }
  if (r.pensionShare > 0) {
    // Where the share's basis bends, the share of each pound changes.
    candidates.push(..._ukTaxInternals.PENSION_BASIS_PIECES[r.pensionBasis].map(piece => piece.from));
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
        taxableAtTax(_ukTaxInternals.RULES.marriageAllowanceReduction, _ukTaxInternals.bandsFor(r.region, 0)),
        ..._ukTaxInternals.RULES.bands[r.region].slice(0, _ukTaxInternals.RULES.firstExtendedBand[r.region]).map(band => band.limit),
      ];
      const k = _ukTaxInternals.RULES.taperRate / (1 + _ukTaxInternals.RULES.taperRate);
      const scaled: _UkTaxResolved = { ...r, pensionFixed: r.pensionFixed * k, pensionShare: r.pensionShare * k };
      candidates.push(...targets.map(target => r.allowance + target - r.bik));
      candidates.push(
        ...targets.map(target =>
          _ukTaxInternals.incomeLeaving((target + r.allowance + _ukTaxInternals.RULES.taperRate * _ukTaxInternals.RULES.taperStart) / (1 + _ukTaxInternals.RULES.taperRate) - r.bik, scaled),
        ),
      );
    }
  }

  // While it is still being made, and where it is complete.
  if (fixed > 0) {
    candidates.push(_ukTaxInternals.incomeLeaving(0, r));
    candidates.push(...taxThresholds(0).map(total => total - r.bik));
    candidates.push(...niAndLoanThresholds(r));
    if (r.method === 'relief-at-source') {
      const allowance = _ukTaxInternals.compute({ ...r, income: 0, contribution: 0 }, { smooth: true }).breakdown.personalAllowance;
      const targets = [
        0,
        taxableAtTax(_ukTaxInternals.RULES.marriageAllowanceReduction, _ukTaxInternals.bandsFor(r.region, 0)),
        ..._ukTaxInternals.RULES.bands[r.region].map(band => band.limit).filter(Number.isFinite),
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
  points.length = Math.min(points.length, _ukTaxInternals.RULES.maxMarginalBands);
  points.push(maxIncome);

  const bands: UkMarginalBand[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const from = points[i];
    const to = points[i + 1];
    const width = to - from;
    const reading = _ukTaxInternals.readMarginal({ ...input, income: from + Math.max(0, Math.min(width / 2, width - 1)) });
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
  const r = _ukTaxInternals.resolve(input);
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

