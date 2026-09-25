/**
 * Month-by-month UK student loan simulator: draws down during study, then
 * repays (or doesn't) against salary, to clearance or write-off.
 *
 * Pure; see REHAUL_PLAN.md 7.I. No `new Date()` — every date, including
 * "today" for the today's-money figures, is an argument. All dates are
 * `YYYY-MM-DD` strings parsed from their parts (`new Date(y, m - 1, d)`),
 * never `new Date('YYYY-MM-DD')`, which parses as UTC and drifts a day either
 * side of midnight depending on the caller's timezone.
 */

import { toISODate } from './dates';
import type { StudentLoanPlanKey } from './debt';

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Parses `YYYY-MM-DD` into a local-time `Date`, sidestepping UTC parsing. */
const parseISODate = (iso: string): Date => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};

const monthStart = (date: Date): Date => new Date(date.getFullYear(), date.getMonth(), 1);

const addMonths = (date: Date, delta: number): Date =>
  new Date(date.getFullYear(), date.getMonth() + delta, 1);

const monthsBetween = (a: Date, b: Date): number =>
  (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());

/** April–December of year Y is tax year Y; January–March is tax year Y-1. */
const taxYearOf = (date: Date): number => (date.getMonth() + 1 >= 4 ? date.getFullYear() : date.getFullYear() - 1);

/**
 * Exact UK tax year of a date: on or after 6 April of year Y is tax year Y,
 * before it is Y-1. Used only by `incomeByTaxYear`, which buckets payslips
 * by their exact pay date; `taxYearOf` above (April 1, not 6) is what the
 * simulator itself uses, and the two never need to agree because the
 * simulator only ever evaluates it on the 1st of a month.
 */
export const exactTaxYearOf = (date: Date): number => {
  const aprilSixth = new Date(date.getFullYear(), 3, 6);
  return date >= aprilSixth ? date.getFullYear() : date.getFullYear() - 1;
};

/** Position of a calendar month (1-12) within the UK tax year cycle: April is 1, March is 12. */
const taxYearMonthPosition = (calendarMonth: number): number => (calendarMonth >= 4 ? calendarMonth - 3 : calendarMonth + 9);

/**
 * The month `lagMonths` after the April that ends tax year `taxYear` (i.e.
 * April of `taxYear + 1`) — where SLC's confirmed income-linked top-up for
 * that tax year lands.
 */
const topUpLandingMonth = (taxYear: number, lagMonths: number): Date => addMonths(new Date(taxYear + 1, 3, 1), lagMonths);

/**
 * 9% of income above the threshold, per month, rounded to pence.
 *
 * Zero whenever there is nothing to collect: salary at or below the
 * threshold, or a non-positive salary or rate.
 */
export const studentLoanMonthlyRepayment = (
  annualSalary: number,
  threshold: number,
  ratePercent: number,
): number => {
  if (annualSalary <= 0 || ratePercent <= 0 || annualSalary <= threshold) return 0;
  return round2(((annualSalary - threshold) * (ratePercent / 100)) / 12);
};

export interface TaxYearIncome {
  taxYear: number;
  income: number;
  basis: 'actual' | 'annualised' | 'projected';
  /** Count of payslips that fed `income` (0 for a projected year with none yet). */
  payslips: number;
}

/**
 * Income per UK tax year (6 April–5 April) from payslips, assuming monthly pay.
 *
 * - A past tax year (not the one containing `today`) with 12 or more
 *   payslips: sum of gross, `'actual'`.
 * - A past tax year with fewer: sum ÷ count × 12, `'annualised'` — a partial
 *   year's sum would understate income.
 * - The tax year containing `today`: sum of gross so far + `currentAnnualSalary`
 *   ÷ 12 × the number of monthly pay dates still to come in that tax year
 *   after the latest payslip's month, up to March — `'projected'`. Always
 *   present in the result, even with zero payslips this year, in which case
 *   it is `currentAnnualSalary` outright.
 *
 * Ignores payslips with a non-finite or negative gross — excluded, not
 * counted as zero (AGENTS.md rule 4). Sorted by `taxYear`. A tax year other
 * than the one containing `today` is treated as "past" (actual/annualised)
 * regardless of whether it is actually before or after it; the brief this
 * was built from only specifies those two cases, and a payslip dated after
 * `today` is left to fall into whichever bucket its date lands in rather
 * than inventing a fourth basis.
 */
export const incomeByTaxYear = (
  payslips: { payDate: string; gross: number }[],
  currentAnnualSalary: number,
  today: string,
): TaxYearIncome[] => {
  const currentTaxYear = exactTaxYearOf(parseISODate(today));

  const byYear = new Map<number, { sum: number; count: number; latestDate?: string; latestMonth?: number }>();
  for (const p of payslips) {
    if (!Number.isFinite(p.gross) || p.gross < 0) continue;
    const date = parseISODate(p.payDate);
    const ty = exactTaxYearOf(date);
    const entry = byYear.get(ty) ?? { sum: 0, count: 0 };
    entry.sum += p.gross;
    entry.count += 1;
    if (entry.latestDate === undefined || p.payDate > entry.latestDate) {
      entry.latestDate = p.payDate;
      entry.latestMonth = date.getMonth() + 1;
    }
    byYear.set(ty, entry);
  }

  const results: TaxYearIncome[] = [];
  for (const [ty, entry] of byYear) {
    if (ty === currentTaxYear) continue;
    const income = entry.count >= 12 ? entry.sum : (entry.sum / entry.count) * 12;
    results.push({
      taxYear: ty,
      income: round2(income),
      basis: entry.count >= 12 ? 'actual' : 'annualised',
      payslips: entry.count,
    });
  }

  const currentEntry = byYear.get(currentTaxYear);
  if (currentEntry) {
    const remainingMonths = 12 - taxYearMonthPosition(currentEntry.latestMonth!);
    const income = currentEntry.sum + (currentAnnualSalary / 12) * remainingMonths;
    results.push({ taxYear: currentTaxYear, income: round2(income), basis: 'projected', payslips: currentEntry.count });
  } else {
    results.push({ taxYear: currentTaxYear, income: round2(currentAnnualSalary), basis: 'projected', payslips: 0 });
  }

  return results.sort((a, b) => a.taxYear - b.taxYear);
};

/**
 * Tax config stores repayment rates inconsistently — 0.09 in some rows, 9 in
 * others. A value in (0, 1] is read as a fraction and scaled up; anything
 * else, including 0, `null`, `undefined` and `NaN`, falls back.
 */
export const normaliseRatePercent = (raw: number | null | undefined, fallback: number): number => {
  if (raw === null || raw === undefined || Number.isNaN(raw) || raw === 0) return fallback;
  if (raw > 0 && raw <= 1) return raw * 100;
  return raw;
};

export interface StudentLoanAssumptions {
  /** RPI, % a year. */
  rpi: number;
  /** Prevailing-market cap applied to every plan's rate, % a year. <= 0 means no cap. */
  rateCap: number;
  /** Bank of England base rate, % a year. Plan 1 / Plan 4 only. */
  baseRate: number;
  /** Plan 2 sliding-scale top, in the tax year containing `thresholdFrom`. */
  upperInterestThreshold: number;
  /** CPI, % a year — used only to deflate figures into today's money. */
  inflation: number;
  /** % a year uprating applied each April to `threshold` AND `upperInterestThreshold`. */
  thresholdGrowth: number;
}

/**
 * Published figures as at September 2026 (gov.uk "what you pay"): RPI 4.1%,
 * cap 6%, Plan 2 upper threshold £52,885.
 *
 * `baseRate`, `inflation` and `thresholdGrowth` are not published figures —
 * they are planning assumptions a caller should let a user override.
 */
export const STUDENT_LOAN_DEFAULT_ASSUMPTIONS: StudentLoanAssumptions = {
  rpi: 4.1,
  rateCap: 6,
  baseRate: 3.75,
  upperInterestThreshold: 52885,
  inflation: 2.5,
  thresholdGrowth: 2.5,
};

/** SLC published interest parameters from a date (stored as rows in finance_student_loan_rates). */
export interface StudentLoanRateRow {
  /** `YYYY-MM-DD`. */
  effectiveFrom: string;
  /** %. */
  rpi: number;
  /** %; `null` means no cap. */
  rateCap: number | null;
  plan2UpperThreshold: number | null;
  /**
   * Plan 2 repayment threshold in force, which is also where its interest
   * starts sliding up from RPI. Optional so rows without it still type.
   */
  plan2LowerThreshold?: number | null;
  /** %. */
  bankRate: number | null;
}

/**
 * The row in force on `date`: the latest `effectiveFrom <= date`, but only
 * while `date` is still inside the academic year that row covers — strictly
 * before `effectiveFrom` + 12 months. Once the latest row has aged out there
 * is no fallback to an earlier one; the published schedule has simply run
 * out for that date. Rows need not be sorted.
 */
export const rateRowInForce = (
  rows: StudentLoanRateRow[] | undefined,
  date: string,
): StudentLoanRateRow | undefined => {
  if (!rows || rows.length === 0) return undefined;

  let best: StudentLoanRateRow | undefined;
  for (const row of rows) {
    if (row.effectiveFrom <= date && (!best || row.effectiveFrom > best.effectiveFrom)) best = row;
  }
  if (!best) return undefined;

  const from = parseISODate(best.effectiveFrom);
  const expiry = new Date(from.getFullYear(), from.getMonth() + 12, from.getDate());
  return parseISODate(date) < expiry ? best : undefined;
};

/**
 * `a` with `rpi` / `rateCap` / `baseRate` / `upperInterestThreshold`
 * replaced by `row`'s values when a row is in force. `rpi` always overrides
 * (a row never leaves it null); `bankRate` and `plan2UpperThreshold`
 * override only when non-null, otherwise `a`'s own value is kept. `rateCap`
 * is the exception: `null` there is itself the published figure for "no
 * cap", so it still overrides — mapped to 0, which `studentLoanInterestRate`
 * already treats as uncapped — rather than being left unset.
 */
export const assumptionsFor = (
  a: StudentLoanAssumptions,
  row: StudentLoanRateRow | undefined,
): StudentLoanAssumptions => {
  if (!row) return a;
  return {
    ...a,
    rpi: row.rpi,
    rateCap: row.rateCap === null ? 0 : row.rateCap,
    baseRate: row.bankRate === null ? a.baseRate : row.bankRate,
    upperInterestThreshold: row.plan2UpperThreshold === null ? a.upperInterestThreshold : row.plan2UpperThreshold,
  };
};

export type StudentLoanPhase = 'study' | 'pre_repayment' | 'repayment';

/**
 * The annual interest rate in force, as a percentage.
 *
 * Plan 2 is the only plan that varies by phase and by income: RPI + 3% until
 * repayment starts, then a slide from flat RPI at the threshold up to
 * RPI + 3% at the upper threshold (or above). A degenerate upper threshold
 * (at or below the ordinary threshold) collapses the slide: anyone earning
 * above the threshold simply pays RPI + 3%. Every other plan is flat in
 * every phase. The result is then capped (when `rateCap > 0`) and floored
 * at zero.
 */
export const studentLoanInterestRate = (
  plan: StudentLoanPlanKey,
  phase: StudentLoanPhase,
  salary: number,
  threshold: number,
  upperThreshold: number,
  a: StudentLoanAssumptions,
): number => {
  let rate: number;

  switch (plan) {
    case 'plan5':
      rate = a.rpi;
      break;
    case 'plan1':
    case 'plan4':
      rate = Math.min(a.rpi, a.baseRate + 1);
      break;
    case 'postgrad':
      rate = a.rpi + 3;
      break;
    case 'plan2':
    default:
      if (phase !== 'repayment') {
        rate = a.rpi + 3;
      } else if (salary <= threshold) {
        rate = a.rpi;
      } else if (upperThreshold <= threshold || salary >= upperThreshold) {
        rate = a.rpi + 3;
      } else {
        rate = a.rpi + 3 * ((salary - threshold) / (upperThreshold - threshold));
      }
      break;
  }

  if (a.rateCap > 0) rate = Math.min(rate, a.rateCap);
  return Math.max(rate, 0);
};

export interface StudentLoanDraw {
  date: string;
  amount: number;
  label?: string;
}

const TERM_OFFSET_MONTHS = [0, 4, 7];
const TUITION_SHARE = [0.25, 0.25, 0.5];

/**
 * Builds termly draws for a course.
 *
 * Year `k` (0-based) starts at `courseStart + k` years. Within a year,
 * tuition is drawn 25% / 25% / 50% at +0, +4, +7 months, and maintenance in
 * equal thirds at the same three dates — so tuition and maintenance always
 * land on the same date and merge into a single draw per term. A term whose
 * combined amount is exactly zero is skipped rather than recorded as an
 * empty draw.
 *
 * Day-of-month overflow (a course starting on the 31st, landing a term in a
 * 30-day month) rolls forward via native `Date` arithmetic, the same
 * convention `debt.ts` uses for its rate schedules.
 */
export const academicYearDraws = (
  courseStart: string,
  years: { tuition: number; maintenance: number }[],
): StudentLoanDraw[] => {
  const start = parseISODate(courseStart);
  const draws: StudentLoanDraw[] = [];

  years.forEach((yr, k) => {
    const yearBase = new Date(start.getFullYear() + k, start.getMonth(), start.getDate());

    TERM_OFFSET_MONTHS.forEach((offset, termIdx) => {
      const drawDate = new Date(yearBase.getFullYear(), yearBase.getMonth() + offset, yearBase.getDate());
      const amount = round2(yr.tuition * TUITION_SHARE[termIdx] + yr.maintenance / 3);
      if (amount === 0) return;
      draws.push({
        date: toISODate(drawDate),
        amount,
        label: `Year ${k + 1} · term ${termIdx + 1}`,
      });
    });
  });

  return draws;
};

/**
 * Infers a course's last day of study from its latest draw: an Aug–Dec draw
 * belongs to the academic year running into the following June; a Jan–Jul
 * draw belongs to the academic year that already started, ending in June of
 * the same calendar year. `undefined` with no draws to infer from.
 */
export const inferCourseEnd = (draws: StudentLoanDraw[]): string | undefined => {
  if (draws.length === 0) return undefined;
  const lastDate = draws.reduce((latest, d) => (d.date > latest ? d.date : latest), draws[0].date);
  const parsed = parseISODate(lastDate);
  const month = parsed.getMonth() + 1;
  const endYear = month >= 8 ? parsed.getFullYear() + 1 : parsed.getFullYear();
  return toISODate(new Date(endYear, 5, 30));
};

/**
 * The first 6 April after `courseEnd`: the same calendar year's 6 April if
 * `courseEnd` falls before it, otherwise the following year's.
 */
export const firstRepaymentDue = (courseEnd: string): string => {
  const end = parseISODate(courseEnd);
  const aprilThisYear = new Date(end.getFullYear(), 3, 6);
  const due = end < aprilThisYear ? aprilThisYear : new Date(end.getFullYear() + 1, 3, 6);
  return toISODate(due);
};

export interface StudentLoanSimInput {
  plan: StudentLoanPlanKey;
  draws: StudentLoanDraw[];
  /** Last day of study, `YYYY-MM-DD`. */
  courseEnd: string;
  /** Annual gross in the tax year containing `salaryFrom`. */
  salary: number;
  salaryFrom: string;
  /** % a year, applied each April. */
  salaryGrowth: number;
  /** Repayment threshold in the tax year containing `thresholdFrom`. */
  threshold: number;
  thresholdFrom: string;
  /** Percent, e.g. 9. */
  repaymentRate: number;
  /** Years from the April first due until write-off. */
  writeOffYears: number;
  assumptions: StudentLoanAssumptions;
  /** A verified balance on a date, anchoring the projection to reality. */
  anchor?: { date: string; balance: number };
  /** Reference date for the today's-money figures. */
  today: string;
  /**
   * Deductions actually taken (e.g. from payslips). In any repayment-phase
   * month on or after `knownPaymentsFrom`'s month and on or before
   * `knownPaymentsUntil`'s month, the month's payment is the sum of known
   * payments dated in that month (0 if none) instead of the salary-modelled
   * figure.
   */
  knownPayments?: { date: string; amount: number }[];
  /**
   * `YYYY-MM-DD`. Defaults to the anchor date when omitted; if no anchor
   * either, to the first month of the grid.
   */
  knownPaymentsFrom?: string;
  /**
   * `YYYY-MM-DD`. Last date the known payments cover (e.g. today). Months
   * after it are modelled again. Defaults to the date of the latest known
   * payment.
   */
  knownPaymentsUntil?: string;
  /**
   * SLC's published interest parameters, superseding `assumptions` for
   * whichever month a row is in force for (see `rateRowInForce`). Rows need
   * not be sorted or cover every month; a month with no row in force keeps
   * today's behaviour of modelling from `assumptions`.
   */
  rateSchedule?: StudentLoanRateRow[];
  /**
   * One-off amounts dated outside the salary model, applied in whichever
   * month they fall in, in any phase. A positive amount is a voluntary
   * payment (capped so the balance can't go below 0); a negative amount is a
   * refund SLC paid back (added back in full, uncapped). In the anchor's own
   * month only entries dated strictly after `anchor.date` count — the anchor
   * balance already reflects anything on or before it.
   */
  extraPayments?: { date: string; amount: number }[];
  /**
   * Model SLC's own timing: in a Plan 2 repayment-phase month interest is
   * added at the provisional rate (RPI, capped, i.e. `studentLoanInterestRate`
   * at salary <= threshold); the difference between the full income-linked
   * rate and the provisional rate accrues as a pending top-up for that tax
   * year, and is added to the balance in the month `confirmationLagMonths`
   * after the April that ends the tax year (e.g. lag 6: the 2026-27 top-up
   * lands in October 2027). Omitted: interest is charged at the full rate as
   * it goes (today's behaviour). Only Plan 2 and only repayment-phase months
   * split this way — study/pre_repayment and every other plan are unaffected.
   */
  slcTiming?: { confirmationLagMonths: number };
  /**
   * Actual or projected income by tax year (key = year the tax year starts,
   * e.g. 2026 for 2026-27, matching `taxYearOf`'s numbering — see
   * `incomeByTaxYear`, the helper that derives this from payslips). Where
   * present it replaces the salary-growth model for that tax year, for both
   * the Plan 2 rate and modelled repayments; other tax years keep growing
   * from `salary` as before.
   */
  incomeByTaxYear?: Record<number, number>;
}

export interface StudentLoanMonth {
  /** `YYYY-MM-01`. */
  date: string;
  phase: StudentLoanPhase;
  /** Balance after this month's draws, interest and repayment. */
  balance: number;
  drawn: number;
  interest: number;
  payment: number;
  /**
   * `'none'` outside the repayment phase or in the write-off month;
   * `'known'` when the known-payments window replaced the modelled figure
   * for this month, even if the sum it replaced it with is 0; `'modelled'`
   * otherwise.
   */
  paymentSource: 'modelled' | 'known' | 'none';
  /**
   * Net of `extraPayments` applied this month (signed, as applied): positive
   * for a voluntary payment, negative for a refund, 0 with nothing dated
   * here. Already reflected in `balance`, `cumulativePaid` and the real-terms
   * figures.
   */
  extra: number;
  /** % in force this month. */
  annualRate: number;
  /** Whether `annualRate` came from a published `rateSchedule` row or from `assumptions`. */
  rateSource: 'published' | 'assumed';
  /** Annual salary for this month's tax year. */
  salary: number;
  cumulativeDrawn: number;
  cumulativeInterest: number;
  cumulativePaid: number;
  balanceReal: number;
  cumulativePaidReal: number;
  /** True only in the anchor month. */
  anchored: boolean;
  /**
   * All accrued, not-yet-landed SLC income-linked top-up, across every tax
   * year, after this month (`slcTiming` only; 0 otherwise). Survives an
   * anchor reset — the anchor is what SLC shows mid-year, before that tax
   * year's top-up is confirmed.
   */
  pendingTopUp: number;
  /** A tax year's pending top-up landing this month, if any (`slcTiming` only; 0 otherwise). Included in `interest`. */
  topUpApplied: number;
}

export interface StudentLoanSimResult {
  months: StudentLoanMonth[];
  firstDue: string;
  outcome: 'cleared' | 'written_off' | 'horizon';
  /** `YYYY-MM-01` of the clearing month, or of the write-off month. */
  endDate: string;
  totalDrawn: number;
  totalPaid: number;
  totalPaidReal: number;
  totalInterest: number;
  writtenOff: number;
  writtenOffReal: number;
  peakBalance: number;
  peakDate: string;
  monthsRepaying: number;
  /**
   * Total pending top-up, across every tax year, dropped because the loan
   * cleared or was written off before it landed (`slcTiming` only; 0
   * otherwise, including when the run simply hits the 60-year horizon with
   * top-up still pending — that is not settled by the brief, so it is left
   * pending rather than reported as forgone).
   */
  forgoneTopUp: number;
}

/** Days in the month that `date` falls in. */
const daysInMonth = (date: Date): number => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();

/** Stop after this many months even if the loan is still standing. */
const MAX_MONTHS = 60 * 12;

const emptyResult = (today: string): StudentLoanSimResult => {
  const iso = toISODate(monthStart(parseISODate(today)));
  return {
    months: [],
    firstDue: iso,
    outcome: 'horizon',
    endDate: iso,
    totalDrawn: 0,
    totalPaid: 0,
    totalPaidReal: 0,
    totalInterest: 0,
    writtenOff: 0,
    writtenOffReal: 0,
    peakBalance: 0,
    peakDate: iso,
    monthsRepaying: 0,
    forgoneTopUp: 0,
  };
};

/**
 * Simulates a student loan month by month from the earliest draw (or the
 * anchor, if there are no draws) out to clearance, write-off, or a 60-year
 * cap.
 *
 * Two edge cases the brief's ordered steps leave to this implementation,
 * flagged rather than resolved silently:
 *
 * - **The anchor's own month accrues interest for the days after it.** An
 *   anchor is a verified balance *as of* its date, so charging that month a
 *   full month of interest would count the days before it twice, and
 *   charging none (the first version) dropped up to a month of interest from
 *   a real loan -- about £230 on £51k at 5.5%. The month is charged
 *   `(daysInMonth - anchorDay) / daysInMonth` of a month's interest, on the
 *   balance after anything applied that month. A repayment in the anchor's
 *   own month still applies.
 * - **The write-off month's `annualRate`.** "No interest, no payment" in the
 *   write-off month is read as "not applied to the balance", not "not
 *   computed" — the rate that would have been in force is still reported for
 *   that row, only `interest` and `payment` are zero.
 *
 * `knownPayments` overrides the modelled repayment-phase payment with what
 * payroll actually deducted, for months inside a window: from the month of
 * `knownPaymentsFrom` (anchor's month, else the grid's first month, when
 * omitted) to the month of `knownPaymentsUntil` (the latest known payment's
 * date, when omitted), inclusive. Inside that window a repayment-phase month
 * takes the sum of known payments dated in it — 0 if none dated there — in
 * place of the salary-modelled figure; a study or pre_repayment month is
 * never overridden, since payroll does not deduct before the April first
 * due. The anchor's own month is a special case: because the anchor balance
 * already reflects whatever was deducted up to and including that date, only
 * known payments dated strictly after `anchor.date` are summed there.
 *
 * `rateSchedule` supersedes `assumptions.rpi` / `rateCap` / `baseRate` /
 * `upperInterestThreshold` for whichever month has a row in force (see
 * `rateRowInForce`, `assumptionsFor`); a month's `rateSource` records which
 * one actually applied. A row's `plan2UpperThreshold`, when present, is used
 * as-is for that month — it is already the published figure, so unlike the
 * assumption it supersedes it is never grown by `thresholdGrowth`. On Plan 2
 * the same goes for `plan2LowerThreshold`, which replaces the grown
 * repayment threshold for both repayments and the interest slide.
 *
 * `extraPayments` applies one-off amounts dated outside the salary model, in
 * whichever month and phase they fall in — including the write-off month,
 * the same as a draw. They run right after the anchor reset (so, like
 * `knownPayments`, only entries dated strictly after `anchor.date` count in
 * the anchor's own month) and before interest, so a voluntary payment or
 * refund in a month changes the balance interest accrues on that same month.
 *
 * `slcTiming` reproduces SLC's own account-page behaviour for Plan 2: a
 * repayment-phase month is charged interest at the provisional (RPI, capped)
 * rate only; the shortfall against the full income-linked rate accrues per
 * tax year and lands as a lump `confirmationLagMonths` after the April that
 * ends it, added to the balance (and `interest`/`cumulativeInterest`) before
 * that month's own interest. It survives an anchor reset — an anchor is what
 * SLC shows mid-year, before the tax year's top-up is confirmed — since it is
 * tracked independently of `balance`. If the loan clears or is written off
 * before a tax year's top-up lands, that amount is dropped and reported in
 * `forgoneTopUp` rather than silently added or silently lost. Every other
 * plan, and Plan 2 outside the repayment phase, is unaffected.
 *
 * `incomeByTaxYear` replaces the salary-growth model's figure for whichever
 * tax year it has an entry for (a non-finite entry is skipped, falling back
 * to the modelled figure, same as an omitted one) — both for the Plan 2 rate
 * and for a modelled repayment; a tax year with no entry keeps growing from
 * `salary` as before.
 */
export const simulateStudentLoan = (input: StudentLoanSimInput): StudentLoanSimResult => {
  const {
    plan, draws, courseEnd, salary, salaryFrom, salaryGrowth, threshold, thresholdFrom, repaymentRate, writeOffYears,
    assumptions, anchor, today, knownPayments, knownPaymentsFrom, knownPaymentsUntil, rateSchedule, extraPayments,
    slcTiming, incomeByTaxYear: incomeByTaxYearInput,
  } = input;

  const courseEndDate = parseISODate(courseEnd);
  const firstDue = firstRepaymentDue(courseEnd);
  const firstDueDate = parseISODate(firstDue);
  const repaymentStartMonth = new Date(firstDueDate.getFullYear(), 3, 1);
  const writeOffMonth = new Date(firstDueDate.getFullYear() + writeOffYears, 3, 1);

  const anchorDate = anchor ? parseISODate(anchor.date) : undefined;
  const anchorMonthKey = anchorDate ? toISODate(monthStart(anchorDate)) : undefined;

  let startDate: Date;
  if (draws.length > 0) {
    const earliest = draws.reduce((min, d) => (d.date < min ? d.date : min), draws[0].date);
    startDate = monthStart(parseISODate(earliest));
  } else if (anchorDate) {
    startDate = monthStart(anchorDate);
  } else {
    return emptyResult(today);
  }

  const drawsByMonth = new Map<string, StudentLoanDraw[]>();
  for (const d of draws) {
    const key = toISODate(monthStart(parseISODate(d.date)));
    const bucket = drawsByMonth.get(key);
    if (bucket) bucket.push(d);
    else drawsByMonth.set(key, [d]);
  }

  // Known payments: bucketed by month, keeping each entry's own date so the
  // anchor month can filter by it. A non-finite amount is dropped entry by
  // entry rather than defaulted to zero and counted (AGENTS.md rule 4) — the
  // difference only shows up inside an otherwise-empty month, which still
  // correctly reports 0 for the window as a whole.
  const hasKnownPayments = (knownPayments?.length ?? 0) > 0;
  const knownPaymentsByMonth = new Map<string, { date: string; amount: number }[]>();
  let latestKnownPaymentDate: string | undefined;
  for (const p of knownPayments ?? []) {
    if (latestKnownPaymentDate === undefined || p.date > latestKnownPaymentDate) latestKnownPaymentDate = p.date;
    if (!Number.isFinite(p.amount)) continue;
    const key = toISODate(monthStart(parseISODate(p.date)));
    const entry = { date: p.date, amount: Math.abs(p.amount) };
    const bucket = knownPaymentsByMonth.get(key);
    if (bucket) bucket.push(entry);
    else knownPaymentsByMonth.set(key, [entry]);
  }

  const knownPaymentsFromMonth = monthStart(
    knownPaymentsFrom ? parseISODate(knownPaymentsFrom) : (anchorDate ?? startDate),
  );
  const knownPaymentsUntilMonth = hasKnownPayments
    ? monthStart(knownPaymentsUntil ? parseISODate(knownPaymentsUntil) : parseISODate(latestKnownPaymentDate!))
    : undefined;

  // Extra payments and refunds: bucketed by month, keeping each entry's own
  // date so the anchor month can filter by it, same convention as known
  // payments above. Sign is kept (not abs'd) since it carries the
  // payment-vs-refund meaning. A non-finite amount is dropped entry by entry
  // rather than defaulted to zero and counted (AGENTS.md rule 4).
  const extraPaymentsByMonth = new Map<string, { date: string; amount: number }[]>();
  for (const p of extraPayments ?? []) {
    if (!Number.isFinite(p.amount)) continue;
    const key = toISODate(monthStart(parseISODate(p.date)));
    const entry = { date: p.date, amount: p.amount };
    const bucket = extraPaymentsByMonth.get(key);
    if (bucket) bucket.push(entry);
    else extraPaymentsByMonth.set(key, [entry]);
  }

  const salaryBaseTaxYear = taxYearOf(parseISODate(salaryFrom));
  const thresholdBaseTaxYear = taxYearOf(parseISODate(thresholdFrom));
  const todayMonth = monthStart(parseISODate(today));

  const months: StudentLoanMonth[] = [];
  let balance = 0;
  let cumulativeDrawn = 0;
  let cumulativeInterest = 0;
  let cumulativePaid = 0;
  let cumulativePaidRealAcc = 0;
  let peakBalance = -Infinity;
  let peakDate = toISODate(startDate);
  let monthsRepaying = 0;
  let outcome: StudentLoanSimResult['outcome'] = 'horizon';
  let endDate = toISODate(startDate);
  let writtenOff = 0;
  let writtenOffReal = 0;

  /** Phase, rates and thresholds for a month; shared by the loop and the pre-grid seed below. */
  const monthRates = (at: Date) => {
    const taxYear = taxYearOf(at);
    // Phase: study while this month opens on or before courseEnd; repayment
    // from April of firstDue's year; pre_repayment in between.
    const phase: StudentLoanPhase =
      at <= courseEndDate ? 'study' : at < repaymentStartMonth ? 'pre_repayment' : 'repayment';

    // Published rate row in force this month, if any (see doc comment above).
    // Read at the month's last day, so a row from partway through a month --
    // the Plan 2 thresholds change on 6 April -- applies to that month.
    const rateRow = rateRowInForce(rateSchedule, toISODate(new Date(at.getFullYear(), at.getMonth() + 1, 0)));
    const monthAssumptions = assumptionsFor(assumptions, rateRow);

    // incomeByTaxYear (see doc comment above) replaces the modelled figure
    // for whichever tax year it has a finite entry for; a missing or
    // non-finite entry falls back to the salary-growth model rather than
    // being treated as a known zero (AGENTS.md rule 4).
    const modelledSalaryTy = salary * Math.pow(1 + salaryGrowth / 100, taxYear - salaryBaseTaxYear);
    const incomeOverride = incomeByTaxYearInput?.[taxYear];
    const salaryTy = incomeOverride !== undefined && Number.isFinite(incomeOverride) ? incomeOverride : modelledSalaryTy;
    // A published Plan 2 threshold is used as-is, like the upper one below,
    // for both repayments and the interest slide; other plans keep the
    // tax-config threshold, since the rows only carry Plan 2's.
    const thresholdTy = plan === 'plan2' && rateRow && rateRow.plan2LowerThreshold != null
      ? rateRow.plan2LowerThreshold
      : threshold * Math.pow(1 + assumptions.thresholdGrowth / 100, taxYear - thresholdBaseTaxYear);
    const upperTy =
      rateRow && rateRow.plan2UpperThreshold !== null
        ? rateRow.plan2UpperThreshold
        : assumptions.upperInterestThreshold * Math.pow(1 + assumptions.thresholdGrowth / 100, taxYear - thresholdBaseTaxYear);
    const rate = studentLoanInterestRate(plan, phase, salaryTy, thresholdTy, upperTy, monthAssumptions);
    return { phase, rateRow, monthAssumptions, salaryTy, thresholdTy, upperTy, rate };
  };

  // slcTiming: each tax year's accrued-but-not-yet-landed top-up, keyed by
  // the tax year it belongs to. Untouched by an anchor reset — see the doc
  // comment above — so it survives across it unlike `balance`.
  const pendingTopUpByTaxYear = new Map<number, number>();

  // An anchor is the balance SLC shows, which leaves out every top-up of its
  // tax year so far. When the grid starts at the anchor, the months of that
  // tax year before it were never simulated, so their top-up is seeded here
  // on the anchor balance. A grid that starts earlier accrues it as it goes.
  if (slcTiming && plan === 'plan2' && anchor && anchorDate) {
    const anchorMonth = monthStart(anchorDate);
    const taxYearStart = new Date(taxYearOf(anchorMonth), 3, 1);
    for (let at = new Date(taxYearStart); at < anchorMonth && at < startDate; at = addMonths(at, 1)) {
      const r = monthRates(at);
      if (r.phase !== 'repayment') continue;
      const provisional = studentLoanInterestRate(plan, r.phase, r.thresholdTy, r.thresholdTy, r.upperTy, r.monthAssumptions);
      const accrual = anchor.balance * ((r.rate - provisional) / 100 / 12);
      const ty = taxYearOf(at);
      if (accrual !== 0) pendingTopUpByTaxYear.set(ty, (pendingTopUpByTaxYear.get(ty) ?? 0) + accrual);
    }
  }

  let cursor = new Date(startDate);
  for (let i = 0; i < MAX_MONTHS; i++) {
    const monthKey = toISODate(cursor);
    const taxYear = taxYearOf(cursor);
    const deflator = Math.pow(1 + assumptions.inflation / 100, -monthsBetween(todayMonth, cursor) / 12);

    // 1. Draws dated this month.
    let drawn = 0;
    const bucket = drawsByMonth.get(monthKey);
    if (bucket) for (const d of bucket) drawn += d.amount;
    balance += drawn;
    cumulativeDrawn += drawn;

    // 2. Anchor.
    const anchored = anchorMonthKey !== undefined && monthKey === anchorMonthKey;
    if (anchored) balance = anchor!.balance;

    // 2b. Extra payments and refunds dated this month (see doc comment
    // above). A positive entry is a voluntary payment, capped so balance
    // can't go below 0; a negative entry is a refund, added back in full.
    let extra = 0;
    const extraEntries = extraPaymentsByMonth.get(monthKey) ?? [];
    const relevantExtra = anchored ? extraEntries.filter(e => e.date > anchor!.date) : extraEntries;
    for (const e of relevantExtra) {
      const applied = e.amount > 0 ? Math.min(e.amount, Math.max(balance, 0)) : e.amount;
      balance -= applied;
      extra += applied;
    }
    cumulativePaid += extra;
    cumulativePaidRealAcc += extra * deflator;

    const { phase, rateRow, monthAssumptions, salaryTy, thresholdTy, upperTy, rate } = monthRates(cursor);
    const rateSource: StudentLoanMonth['rateSource'] = rateRow ? 'published' : 'assumed';

    // 5. Write-off: no interest, no payment; the balance carried in is what
    // is written off, and a final zero-balance month closes the loan.
    if (cursor.getTime() === writeOffMonth.getTime()) {
      writtenOff = balance;
      writtenOffReal = round2(writtenOff * deflator);
      months.push({
        date: monthKey,
        phase: 'repayment',
        balance: 0,
        drawn: round2(drawn),
        interest: 0,
        payment: 0,
        extra: round2(extra),
        annualRate: rate,
        rateSource,
        salary: round2(salaryTy),
        cumulativeDrawn: round2(cumulativeDrawn),
        cumulativeInterest: round2(cumulativeInterest),
        cumulativePaid: round2(cumulativePaid),
        balanceReal: 0,
        cumulativePaidReal: round2(cumulativePaidRealAcc),
        anchored,
        paymentSource: 'none',
        // Written off this month, so any tax year's still-pending top-up
        // never lands — it's dropped, and reported in forgoneTopUp below.
        pendingTopUp: 0,
        topUpApplied: 0,
      });
      outcome = 'written_off';
      endDate = monthKey;
      break;
    }

    // 3. Interest — pro-rata in the anchor's own month; see doc comment
    // above. slcTiming (Plan 2, repayment phase only) splits this into the
    // provisional-rate interest actually charged plus whichever tax year's
    // top-up lands this month, landing before this month's own interest;
    // the full-rate/provisional-rate difference accrues into
    // pendingTopUpByTaxYear instead of the balance, until it lands.
    const anchorShare = anchored && anchorDate
      ? (daysInMonth(cursor) - anchorDate.getDate()) / daysInMonth(cursor)
      : 1;

    let interest: number;
    let topUpApplied = 0;
    if (slcTiming && plan === 'plan2') {
      for (const [ty, amount] of pendingTopUpByTaxYear) {
        if (toISODate(topUpLandingMonth(ty, slcTiming.confirmationLagMonths)) === monthKey) {
          topUpApplied += amount;
          pendingTopUpByTaxYear.delete(ty);
        }
      }
      if (topUpApplied !== 0) {
        balance += topUpApplied;
        cumulativeInterest += topUpApplied;
      }

      if (phase === 'repayment') {
        const provisionalRate = studentLoanInterestRate(plan, phase, thresholdTy, thresholdTy, upperTy, monthAssumptions);
        const provisionalInterest = balance * (provisionalRate / 100 / 12) * anchorShare;
        // The whole month's top-up accrues even in the anchor month: the
        // anchor is SLC's balance, which excludes every top-up so far.
        const topUpAccrual = balance * ((rate - provisionalRate) / 100 / 12);
        if (topUpAccrual !== 0) {
          pendingTopUpByTaxYear.set(taxYear, (pendingTopUpByTaxYear.get(taxYear) ?? 0) + topUpAccrual);
        }
        balance += provisionalInterest;
        cumulativeInterest += provisionalInterest;
        interest = provisionalInterest + topUpApplied;
      } else {
        // Study/pre_repayment: unaffected by slcTiming, full rate as normal.
        const flat = balance * (rate / 100 / 12) * anchorShare;
        balance += flat;
        cumulativeInterest += flat;
        interest = flat + topUpApplied;
      }
    } else {
      interest = balance * (rate / 100 / 12) * anchorShare;
      balance += interest;
      cumulativeInterest += interest;
    }

    const pendingTopUp = round2(Array.from(pendingTopUpByTaxYear.values()).reduce((s, v) => s + v, 0));

    // 4. Repayment, in the repayment phase only. A known-payments window
    // (see doc comment above) replaces the salary-modelled figure with what
    // was actually deducted, month by month.
    let payment = 0;
    let paymentSource: StudentLoanMonth['paymentSource'] = 'none';
    if (phase === 'repayment') {
      const inKnownWindow =
        hasKnownPayments &&
        knownPaymentsUntilMonth !== undefined &&
        cursor.getTime() >= knownPaymentsFromMonth.getTime() &&
        cursor.getTime() <= knownPaymentsUntilMonth.getTime();

      if (inKnownWindow) {
        paymentSource = 'known';
        const entries = knownPaymentsByMonth.get(monthKey) ?? [];
        const relevant = anchored ? entries.filter(e => e.date > anchor!.date) : entries;
        const sum = relevant.reduce((s, e) => s + e.amount, 0);
        payment = Math.max(0, Math.min(sum, balance));
      } else {
        paymentSource = 'modelled';
        const raw = (Math.max(salaryTy - thresholdTy, 0) * (repaymentRate / 100)) / 12;
        payment = Math.min(Math.max(raw, 0), balance);
      }
      balance -= payment;
      cumulativePaid += payment;
    }

    cumulativePaidRealAcc += payment * deflator;
    const balanceReal = balance * deflator;

    const month: StudentLoanMonth = {
      date: monthKey,
      phase,
      balance: round2(balance),
      drawn: round2(drawn),
      interest: round2(interest),
      payment: round2(payment),
      extra: round2(extra),
      annualRate: rate,
      rateSource,
      salary: round2(salaryTy),
      cumulativeDrawn: round2(cumulativeDrawn),
      cumulativeInterest: round2(cumulativeInterest),
      cumulativePaid: round2(cumulativePaid),
      balanceReal: round2(balanceReal),
      cumulativePaidReal: round2(cumulativePaidRealAcc),
      anchored,
      paymentSource,
      pendingTopUp,
      topUpApplied: round2(topUpApplied),
    };
    months.push(month);

    if (balance > peakBalance) {
      peakBalance = balance;
      peakDate = monthKey;
    }
    if (payment > 0) monthsRepaying++;

    endDate = monthKey;

    // 6. Cleared.
    if (phase === 'repayment' && balance <= 0.005) {
      balance = 0;
      month.balance = 0;
      month.balanceReal = 0;
      outcome = 'cleared';
      break;
    }

    cursor = addMonths(cursor, 1);
  }

  // Whatever's still sitting unlanded once the loan is gone (cleared or
  // written off) never will land — dropped, not silently added or lost.
  const forgoneTopUp = outcome === 'written_off' || outcome === 'cleared'
    ? round2(Array.from(pendingTopUpByTaxYear.values()).reduce((s, v) => s + v, 0))
    : 0;

  return {
    months,
    firstDue,
    outcome,
    endDate,
    totalDrawn: round2(cumulativeDrawn),
    totalPaid: round2(cumulativePaid),
    totalPaidReal: round2(cumulativePaidRealAcc),
    totalInterest: round2(cumulativeInterest),
    writtenOff: round2(writtenOff),
    writtenOffReal: round2(writtenOffReal),
    peakBalance: round2(peakBalance === -Infinity ? 0 : peakBalance),
    peakDate,
    monthsRepaying,
    forgoneTopUp,
  };
};

/**
 * The row for `date`'s month (`YYYY-MM-01`), for a UI that wants "the
 * balance as of a given date" without re-deriving the month key itself.
 * `undefined` if that month isn't in the grid.
 */
export const balanceOnMonth = (result: StudentLoanSimResult, date: string): StudentLoanMonth | undefined => {
  const key = toISODate(monthStart(parseISODate(date)));
  return result.months.find(m => m.date === key);
};
