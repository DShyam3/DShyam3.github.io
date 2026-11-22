/**
 * Student loan simulation ledger, anchor-to-date balance walk, and payslip
 * deduction helpers.
 *
 * Pure; see REHAUL_PLAN.md 7.I. Re-exported from `./student-loan`.
 */

import { epochDay, toISODate } from './dates';
import {
  monthStart,
  parseISODate,
  pence,
  round2,
  taxYearOf,
  type StudentLoanMonth,
  type StudentLoanPhase,
  type StudentLoanSimResult,
} from './student-loan-assumptions';

/**
 * The row for `date`'s month (`YYYY-MM-01`), for a UI that wants "the
 * balance as of a given date" without re-deriving the month key itself.
 * `undefined` if that month isn't in the grid.
 */
export const balanceOnMonth = (result: StudentLoanSimResult, date: string): StudentLoanMonth | undefined => {
  const key = toISODate(monthStart(parseISODate(date)));
  return result.months.find(m => m.date === key);
};

export interface StudentLoanLedgerMonth {
  /** `YYYY-MM-01`. */
  date: string;
  /** `taxYearOf`'s numbering, as in the simulation. */
  taxYear: number;
  phase: StudentLoanPhase;
  anchored: boolean;
  paymentSource: StudentLoanMonth['paymentSource'];
  /** Balance after the month, as SLC would show it: pending top-up not in it. */
  balance: number;
  /** Accrued top-up not yet added to the balance, after the month. */
  pendingTopUp: number;
  drawn: number;
  /** Refunds SLC paid back, added to the balance. Positive. */
  refunded: number;
  /** Voluntary payments outside payroll. Positive. */
  paidExtra: number;
  /** Payroll repayment. Positive. */
  repaid: number;
  /** Interest added to the balance this month, a landing top-up not included. */
  interestCharged: number;
  /** A tax year's pending top-up landing this month. */
  topUpLanded: number;
  /** Interest accrued towards the pending top-up this month, not yet added. */
  topUpAccrued: number;
  /** Interest the month has cost, added or not: `interestCharged + topUpAccrued`. */
  interestAccrued: number;
  /**
   * The change in what is owed, including interest SLC has yet to add --
   * which is why it counts the top-up accrued, not the top-up landed. The
   * anchor month's reset and a write-off are not in it.
   */
  owedChange: number;
  /** The amount written off, in the write-off month only; 0 otherwise. */
  writtenOff: number;
}

export interface StudentLoanLedgerYear {
  taxYear: number;
  /** `YYYY-MM-01` of the first and last simulated month in the tax year. */
  firstMonth: string;
  lastMonth: string;
  monthCount: number;
  drawn: number;
  refunded: number;
  paidExtra: number;
  repaid: number;
  /** `repaid` from months where payroll's actual deductions replaced the model. */
  repaidKnown: number;
  /** `repaid` from months where the salary model produced the payment. */
  repaidModelled: number;
  interestCharged: number;
  topUpLanded: number;
  topUpAccrued: number;
  interestAccrued: number;
  owedChange: number;
  /** From the year's last month. */
  closingBalance: number;
  closingPending: number;
  /** Whether the anchor reset falls in this tax year. */
  containsAnchor: boolean;
}

/**
 * The simulation's months as a ledger: what moved the balance each month,
 * and each tax year's totals. A pure transform of `result.months`; nothing is
 * recomputed, so every figure is one the simulation already reported.
 *
 * Amounts that the simulation signs (`extra`: positive a payment, negative a
 * refund) are split into two positive columns, and the interest in `interest`
 * (which includes a landing top-up) into the part charged and the part
 * landed. For an ordinary month, `balance - previous balance` is
 * `drawn + refunded - paidExtra - repaid + interestCharged + topUpLanded`, to
 * within the pence each reported figure was rounded to. The anchor month
 * (the reset replaces the balance) and the write-off month (the balance goes
 * to 0) are the exceptions.
 */
export const studentLoanLedger = (
  result: StudentLoanSimResult,
): { months: StudentLoanLedgerMonth[]; taxYears: StudentLoanLedgerYear[] } => {
  const months: StudentLoanLedgerMonth[] = result.months.map(m => {
    const refunded = Math.max(-m.extra, 0);
    const paidExtra = Math.max(m.extra, 0);
    const interestCharged = pence(m.interest - m.topUpApplied);
    const interestAccrued = pence(interestCharged + m.topUpAccrued);
    return {
      date: m.date,
      taxYear: taxYearOf(parseISODate(m.date)),
      phase: m.phase,
      anchored: m.anchored,
      paymentSource: m.paymentSource,
      balance: m.balance,
      pendingTopUp: m.pendingTopUp,
      drawn: m.drawn,
      refunded,
      paidExtra,
      repaid: m.payment,
      interestCharged,
      topUpLanded: m.topUpApplied,
      topUpAccrued: m.topUpAccrued,
      interestAccrued,
      owedChange: pence(m.drawn + refunded - paidExtra - m.payment + interestAccrued),
      writtenOff: result.outcome === 'written_off' && m.date === result.endDate ? result.writtenOff : 0,
    };
  });

  // Months run in date order, so a tax year's months are contiguous.
  const byTaxYear = new Map<number, StudentLoanLedgerMonth[]>();
  for (const m of months) {
    const bucket = byTaxYear.get(m.taxYear);
    if (bucket) bucket.push(m);
    else byTaxYear.set(m.taxYear, [m]);
  }

  const taxYears: StudentLoanLedgerYear[] = Array.from(byTaxYear, ([taxYear, rows]) => {
    const sum = (pick: (m: StudentLoanLedgerMonth) => number): number =>
      pence(rows.reduce((total, m) => total + pick(m), 0));
    const last = rows[rows.length - 1];
    return {
      taxYear,
      firstMonth: rows[0].date,
      lastMonth: last.date,
      monthCount: rows.length,
      drawn: sum(m => m.drawn),
      refunded: sum(m => m.refunded),
      paidExtra: sum(m => m.paidExtra),
      repaid: sum(m => m.repaid),
      repaidKnown: sum(m => (m.paymentSource === 'known' ? m.repaid : 0)),
      repaidModelled: sum(m => (m.paymentSource === 'modelled' ? m.repaid : 0)),
      interestCharged: sum(m => m.interestCharged),
      topUpLanded: sum(m => m.topUpLanded),
      topUpAccrued: sum(m => m.topUpAccrued),
      interestAccrued: sum(m => m.interestAccrued),
      owedChange: sum(m => m.owedChange),
      closingBalance: last.balance,
      closingPending: last.pendingTopUp,
      containsAnchor: rows.some(m => m.anchored),
    };
  });

  return { months, taxYears };
};

export interface StudentLoanWalk {
  /** The anchor's balance and date: what SLC showed. */
  start: number;
  startDate: string;
  /** `YYYY-MM-01` of the month `end` is the balance of. */
  endMonth: string;
  /** Borrowing after the anchor month; the anchor month's own is already in `start`. */
  drawn: number;
  refunded: number;
  paidExtra: number;
  /** Payroll deductions actually taken, from `knownPayments`. */
  repaidKnown: number;
  /** `YYYY-MM-01` of the last month whose deduction is known; null if none are. */
  knownThrough: string | null;
  /** Payroll deductions the salary model supplies for the months after. */
  repaidModelled: number;
  /** `YYYY-MM-01` of each month counted in `repaidModelled`. */
  modelledMonths: string[];
  /** Pending top-up that lands in the range. */
  topUpLanded: number;
  /** Interest added to the balance: the balancing figure; see `studentLoanWalk`. */
  interestCharged: number;
  /**
   * The `chargedRate` (% a year) every month in the range was charged at, or
   * null when the range spans a change of rate. The anchored month's
   * pro-rata share of the days is not in it, as in `StudentLoanMonth`.
   */
  chargedRate: number | null;
  end: number;
}

/**
 * From the anchor, month by month to the end of `toDate`'s month: the sum
 * that takes the balance SLC showed on the anchor to the balance it should
 * show then. The parts add up exactly --
 * `start + drawn + refunded - paidExtra - repaidKnown - repaidModelled +
 * topUpLanded + interestCharged = end`, to the penny.
 *
 * To make that so, `interestCharged` is the balancing figure, `end - start -
 * drawn - refunded + paidExtra + repaidKnown + repaidModelled - topUpLanded`,
 * rather than the sum of the months' reported interest. The two differ only
 * by the pence each month's figures were rounded to (a few at most over a
 * handful of months); the balancing figure is the one that cannot leave a
 * visible gap in the sentence it feeds.
 *
 * `chargedRate` lets a sentence about the interest name its rate without
 * reading one month's: it is the months' `chargedRate` when every month in the
 * range has the same one, and null when they differ (a new published rate row
 * partway through, say).
 *
 * The range is the anchored month through `toDate`'s month inclusive. The
 * anchored month's `drawn` is left out, since the anchor balance already
 * holds it; its extra payments and known deductions are only those dated
 * after the anchor, as the simulation applies them.
 *
 * `undefined` when there is nothing honest to report: no anchored month, an
 * `anchor` whose month is not the anchored one, `toDate` before the anchored
 * month or in a month the simulation never reached (the loan cleared first,
 * or the grid ends), or a range that runs into the write-off month, where the
 * balance falls to 0 by an amount the parts do not explain.
 */
export const studentLoanWalk = (
  result: StudentLoanSimResult,
  anchor: { date: string; balance: number },
  toDate: string,
): StudentLoanWalk | undefined => {
  if (epochDay(anchor.date) === undefined || epochDay(toDate) === undefined || !Number.isFinite(anchor.balance)) {
    return undefined;
  }
  const anchoredIndex = result.months.findIndex(m => m.anchored);
  if (anchoredIndex < 0) return undefined;
  if (result.months[anchoredIndex].date !== toISODate(monthStart(parseISODate(anchor.date)))) return undefined;

  const endMonth = toISODate(monthStart(parseISODate(toDate)));
  const endIndex = result.months.findIndex(m => m.date === endMonth);
  if (endIndex < anchoredIndex) return undefined;

  const range = result.months.slice(anchoredIndex, endIndex + 1);
  if (result.outcome === 'written_off' && range.some(m => m.date === result.endDate)) return undefined;

  const sum = (pick: (m: StudentLoanMonth) => number): number => pence(range.reduce((total, m) => total + pick(m), 0));
  const start = pence(anchor.balance);
  const end = range[range.length - 1].balance;
  // The anchored month's balance is reset to the anchor, so its draws are in `start`.
  const drawn = pence(range.slice(1).reduce((total, m) => total + m.drawn, 0));
  const refunded = sum(m => Math.max(-m.extra, 0));
  const paidExtra = sum(m => Math.max(m.extra, 0));
  const repaidKnown = sum(m => (m.paymentSource === 'known' ? m.payment : 0));
  const repaidModelled = sum(m => (m.paymentSource === 'modelled' ? m.payment : 0));
  const topUpLanded = sum(m => m.topUpApplied);
  const knownMonths = range.filter(m => m.paymentSource === 'known');
  const chargedRate = range.every(m => m.chargedRate === range[0].chargedRate) ? range[0].chargedRate : null;

  return {
    start,
    startDate: anchor.date,
    endMonth,
    drawn,
    refunded,
    paidExtra,
    repaidKnown,
    knownThrough: knownMonths.length > 0 ? knownMonths[knownMonths.length - 1].date : null,
    repaidModelled,
    modelledMonths: range.filter(m => m.paymentSource === 'modelled' && m.payment > 0).map(m => m.date),
    topUpLanded,
    interestCharged: pence(end - start - drawn - refunded + paidExtra + repaidKnown + repaidModelled - topUpLanded),
    chargedRate,
    end,
  };
};

/** How a pension contribution is taken from pay: before tax and NI, or after. */
export type StudentLoanPensionType = 'net_pay' | 'salary_sacrifice' | 'relief_at_source';

/**
 * The annual pay a student loan is charged on. Salary sacrifice comes off
 * before payroll works out the deduction, so it is gross less the sacrificed
 * share; net pay and relief at source leave it at gross. A percent that is
 * not finite or outside 0..100 is not a usable share, so gross stands rather
 * than a guess.
 */
export const studentLoanPay = (
  annualGross: number,
  pensionType: StudentLoanPensionType,
  personalPensionPercent: number,
): number => {
  if (pensionType !== 'salary_sacrifice') return annualGross;
  if (!Number.isFinite(personalPensionPercent) || personalPensionPercent < 0 || personalPensionPercent > 100) {
    return annualGross;
  }
  return round2(annualGross * (1 - personalPensionPercent / 100));
};

/**
 * The same, from one payslip: gross less the employee's pension for salary
 * sacrifice, gross otherwise. A payslip whose `pensionEmployee` is not a
 * number gives NaN under salary sacrifice rather than a pay figure that
 * quietly treats it as 0.
 */
export const payslipLoanPay = (
  p: { gross: number; pensionEmployee: number },
  pensionType: StudentLoanPensionType,
): number => (pensionType === 'salary_sacrifice' ? round2(p.gross - p.pensionEmployee) : p.gross);

/**
 * What payroll deducts from one month's pay: the plan's share of pay over a
 * month's threshold, rounded down to whole pounds as HMRC's tables do. Each
 * employer works this out per pay period on that period's pay alone, so two
 * part-month payslips can each fall under the threshold.
 */
export const studentLoanPayslipDeduction = (monthlyPay: number, annualThreshold: number, ratePercent: number): number =>
  Math.max(0, Math.floor((monthlyPay - annualThreshold / 12) * (ratePercent / 100)));

/**
 * Which pay a monthly payslip's student loan deduction was worked out on, read
 * back from the deduction itself: `'after_pension'` when it is the share of
 * gross less the employee pension (salary sacrifice), `'gross'` when it is the
 * share of gross (net pay, relief at source). Payroll rounds the deduction
 * down to whole pounds, so each basis is allowed £1 either way. Undefined when
 * there is no deduction, no pension to tell the two apart, or the figure fits
 * both or neither -- a guess here would steer someone's settings.
 */
export const payslipLoanBasis = (
  p: { gross: number; pensionEmployee: number; studentLoan: number },
  annualThreshold: number,
  ratePercent: number,
): 'after_pension' | 'gross' | undefined => {
  const inputs = [p.gross, p.pensionEmployee, p.studentLoan, annualThreshold, ratePercent];
  if (!inputs.every(Number.isFinite) || p.studentLoan <= 0 || p.pensionEmployee <= 0) return undefined;
  const deduction = (pay: number) => studentLoanPayslipDeduction(pay, annualThreshold, ratePercent);
  const fitsAfter = Math.abs(p.studentLoan - deduction(p.gross - p.pensionEmployee)) <= 1;
  const fitsGross = Math.abs(p.studentLoan - deduction(p.gross)) <= 1;
  if (fitsAfter === fitsGross) return undefined;
  return fitsAfter ? 'after_pension' : 'gross';
};

