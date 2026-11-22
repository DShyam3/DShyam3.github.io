/**
 * UK student loan assumptions, published rate schedules, interest rate
 * calculation, and tax-year income helpers.
 *
 * Pure; see REHAUL_PLAN.md 7.I. Re-exported from `./student-loan`.
 */

import type { StudentLoanPlanKey } from './debt';

/** @internal Shared with `./student-loan-simulation` and `./student-loan-ledger`. */
export const round2 = (n: number): number => Math.round(n * 100) / 100;

/** @internal Pence, with a -0 from rounding a tiny negative turned back into 0. */
export const pence = (n: number): number => round2(n) + 0;

/** @internal Parses `YYYY-MM-DD` into a local-time `Date`, sidestepping UTC parsing. */
export const parseISODate = (iso: string): Date => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};

/** @internal First day of the month containing `date`. */
export const monthStart = (date: Date): Date => new Date(date.getFullYear(), date.getMonth(), 1);

/** @internal April–December of year Y is tax year Y; January–March is tax year Y-1. */
export const taxYearOf = (date: Date): number => (date.getMonth() + 1 >= 4 ? date.getFullYear() : date.getFullYear() - 1);

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
  /**
   * The % a year actually added to the balance this month: the provisional
   * rate where `slcTiming` splits a Plan 2 repayment month, `annualRate`
   * otherwise, and 0 in the write-off month. The anchor month's pro-rata
   * share of the days is not in it.
   */
  chargedRate: number;
  /** Whether `annualRate` came from a published `rateSchedule` row or from `assumptions`. */
  rateSource: 'published' | 'assumed';
  /**
   * Annual income for this month's tax year, the figure the Plan 2 rate
   * slides on (the `incomeByTaxYear` entry, else the salary model). A modelled
   * repayment may be charged on a different figure; see `incomeByTaxYear`.
   */
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
  /**
   * `pendingTopUp` split by the tax year it belongs to, oldest first (`taxYear`
   * numbered as in `taxYearOf`). `landsOn` is the `YYYY-MM-01` that tax year's
   * top-up lands, from `slcTiming.confirmationLagMonths`. Amounts are to the
   * penny, so they sum to `pendingTopUp` within a penny or two. Empty when
   * nothing is pending, `slcTiming` is off, or for a non-Plan-2 loan.
   */
  pendingByTaxYear: { taxYear: number; amount: number; landsOn: string }[];
  /** A tax year's pending top-up landing this month, if any (`slcTiming` only; 0 otherwise). Included in `interest`. */
  topUpApplied: number;
  /**
   * This month's addition to the pending top-up: the interest above the
   * provisional rate that SLC has yet to add (`slcTiming` only; 0 when the
   * month is not split).
   */
  topUpAccrued: number;
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
  /**
   * The simulation against SLC's own figure on the anchor's date. Present
   * only with an anchor and a grid that began in an earlier month (borrowing
   * draws before it); absent when the grid starts at the anchor. `rebuiltBalance`
   * is what the simulation had reached on `anchor.date`, just before the
   * reset: the balance carried into that month, plus its draws and extra
   * payments dated on or before the anchor, plus interest at that month's
   * charged rate for the days up to and including it, less known payments
   * dated on or before it (inside the known window, repayment phase only).
   * A top-up landing in that month is added to it, as the last step, because
   * SLC's figure includes it (see `simulateStudentLoan`). `slcBalance` is
   * `anchor.balance`; `gap` is `slcBalance - rebuiltBalance`, to the penny,
   * positive when SLC's figure is the higher.
   */
  anchorCheck?: { date: string; slcBalance: number; rebuiltBalance: number; gap: number };
}
