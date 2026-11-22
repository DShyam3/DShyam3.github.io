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

import { epochDay, toISODate } from './dates';
import type { StudentLoanPlanKey } from './debt';

import {
  assumptionsFor,
  monthStart,
  parseISODate,
  pence,
  rateRowInForce,
  round2,
  studentLoanInterestRate,
  studentLoanMonthlyRepayment,
  taxYearOf,
  type StudentLoanAssumptions,
  type StudentLoanMonth,
  type StudentLoanPhase,
  type StudentLoanRateRow,
  type StudentLoanSimResult,
} from './student-loan-assumptions';

const addMonths = (date: Date, delta: number): Date =>
  new Date(date.getFullYear(), date.getMonth() + delta, 1);

const monthsBetween = (a: Date, b: Date): number =>
  (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());

/**
 * The month `lagMonths` after the April that ends tax year `taxYear` (i.e.
 * April of `taxYear + 1`) — where SLC's confirmed income-linked top-up for
 * that tax year lands.
 */
const topUpLandingMonth = (taxYear: number, lagMonths: number): Date => addMonths(new Date(taxYear + 1, 3, 1), lagMonths);

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
 * the same calendar year. Invalid dates and non-finite amounts are excluded;
 * `undefined` with no usable draws to infer from.
 */
export const inferCourseEnd = (draws: StudentLoanDraw[]): string | undefined => {
  const datedDraws = draws.filter(d => epochDay(d.date) !== undefined && Number.isFinite(d.amount));
  if (datedDraws.length === 0) return undefined;
  const lastDate = datedDraws.reduce((latest, d) => (d.date > latest ? d.date : latest), datedDraws[0].date);
  const parsed = parseISODate(lastDate);
  const month = parsed.getMonth() + 1;
  const endYear = month >= 8 ? parsed.getFullYear() + 1 : parsed.getFullYear();
  return toISODate(new Date(endYear, 5, 30));
};

export interface StudentLoanBorrowed {
  /** What was borrowed, before any interest or repayment. 0 when unknown. */
  total: number;
  /** `draws` when summed from recorded borrowing, `entered` when typed as one figure. */
  source: 'draws' | 'entered' | 'none';
  /** Borrowing payments counted; 0 unless `source` is `draws`. */
  count: number;
  /** Earliest and latest borrowing dates; set only when `source` is `draws`. */
  first?: string;
  last?: string;
}

/** Classifies the row only; the borrowed total validates its amount and date. */
export const isBorrowing = (draw: { kind?: 'borrowing' | 'refund' | 'payment' }): boolean =>
  !draw.kind || draw.kind === 'borrowing';

/**
 * What you borrowed yourself. Recorded borrowing wins, summed payment by
 * payment; refunds and payments outside payroll move the balance but are not
 * borrowing, so neither counts. A row whose amount is zero, negative or not
 * finite is not a borrowing payment either, and neither is one whose date is
 * not a real `YYYY-MM-DD` day (`draws` is unchecked jsonb, so '' and
 * '2026-13-40' arrive): it is left out of the total, the count and the span
 * alike. With no valid borrowing row left, the one figure
 * typed for the loan stands in, so a table of bad rows cannot hide it.
 */
export const studentLoanBorrowed = (debt: {
  originalAmount?: number;
  draws?: { date: string; amount: number; kind?: 'borrowing' | 'refund' | 'payment' }[];
}): StudentLoanBorrowed => {
  const borrowing = (debt.draws ?? []).filter(
    d =>
      isBorrowing(d) &&
      Number.isFinite(d.amount) &&
      d.amount > 0 &&
      epochDay(d.date) !== undefined,
  );
  if (borrowing.length > 0) {
    const dates = borrowing.map(d => d.date).sort();
    const total = borrowing.reduce((sum, d) => sum + d.amount, 0);
    return { total: round2(total), source: 'draws', count: borrowing.length, first: dates[0], last: dates[dates.length - 1] };
  }
  const entered = debt.originalAmount ?? 0;
  return Number.isFinite(entered) && entered > 0
    ? { total: round2(entered), source: 'entered', count: 0 }
    : { total: 0, source: 'none', count: 0 };
};

export interface StudentLoanBorrowedGap {
  /** Always at least £1, in pounds and pence. */
  amount: number;
  /** `more` when the balance sits above what was borrowed, `less` when below. */
  direction: 'more' | 'less';
}

/**
 * How far the balance sits above or below what was borrowed; null when nothing
 * was borrowed on record, either figure is not finite, or the gap rounds to
 * under £1.
 */
export const studentLoanBorrowedGap = (
  balance: number,
  borrowed: StudentLoanBorrowed,
): StudentLoanBorrowedGap | null => {
  if (borrowed.source === 'none' || !Number.isFinite(balance) || !Number.isFinite(borrowed.total)) return null;
  const gap = round2(balance - borrowed.total);
  if (Math.abs(gap) < 1) return null;
  return { amount: Math.abs(gap), direction: gap > 0 ? 'more' : 'less' };
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
  /**
   * Annual gross in the tax year containing `salaryFrom`; modelled
   * repayments are charged on it (grown by `salaryGrowth`) from that tax year.
   */
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
   * present it replaces the salary-growth model for that tax year's Plan 2
   * rate, which SLC sets on the year's income; other tax years keep growing
   * from `salary` as before.
   *
   * Modelled repayments use it only for tax years before the one containing
   * `salaryFrom`. From that tax year on they follow the salary model instead:
   * payroll deducts each month on that month's pay, and a year's income total
   * carries its low-paid early months, which would pull every later
   * deduction down.
   */
  incomeByTaxYear?: Record<number, number>;
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
 * - **A top-up landing in the anchor's own month is in SLC's figure.** With
 *   `slcTiming`, any tax year's pending top-up whose landing month is the
 *   anchor's month is dropped at the reset rather than landed on top of it,
 *   whether the grid began earlier (draws) or at the anchor. This matches the
 *   anchor-only seed, which leaves such a tax year out. `anchorCheck`'s
 *   `rebuiltBalance` adds the dropped amount, after the rest is rebuilt, so
 *   `gap` compares like with like rather than carrying that top-up.
 * - **The anchor tax year's pending top-up depends on whether there are
 *   draws.** The pending top-up survives the reset, but what it holds for the
 *   anchor's tax year does not start from the same figure. With draws it
 *   accrued month by month on the rebuilt balance up to the reset, which can
 *   sit well away from SLC's; without draws it is seeded on SLC's own balance
 *   (`anchor.balance`) for the months before the anchor. The same anchor can
 *   therefore show different pending top-up with and without borrowing on
 *   record. A known approximation, not corrected.
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
 * to the modelled figure, same as an omitted one) — for the Plan 2 rate,
 * which SLC sets on a year's income. A modelled repayment is charged on
 * something else: payroll deducts each month on that month's pay, so from
 * the tax year containing `salaryFrom` it follows the salary model, not the
 * year's income total, whose low-paid early months would pull every later
 * deduction down. Tax years before that have no current pay to follow and
 * keep the income entry. A tax year with no entry keeps growing from
 * `salary` as before; `StudentLoanMonth.salary` always reports the income
 * figure.
 *
 * `anchorCheck` on the result compares the simulation with the anchor on its
 * own date, when the grid began before it (see `StudentLoanSimResult`).
 * `chargedRate` and `topUpAccrued` on each month expose the split that
 * `slcTiming` makes, for `studentLoanLedger` to account for it.
 */
export const simulateStudentLoan = (input: StudentLoanSimInput): StudentLoanSimResult => {
  const {
    plan, courseEnd, salary, salaryFrom, salaryGrowth, threshold, thresholdFrom, repaymentRate, writeOffYears,
    assumptions, anchor, today, knownPayments, knownPaymentsFrom, knownPaymentsUntil, rateSchedule, extraPayments,
    slcTiming, incomeByTaxYear: incomeByTaxYearInput,
  } = input;

  // Reject unusable rows before choosing a start month or doing arithmetic.
  // Keep finite signed amounts, including negative and zero draws.
  const draws = input.draws.filter(d => epochDay(d.date) !== undefined && Number.isFinite(d.amount));

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
  let anchorCheck: StudentLoanSimResult['anchorCheck'];

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
    const hasIncomeOverride = incomeOverride !== undefined && Number.isFinite(incomeOverride);
    const salaryTy = hasIncomeOverride ? incomeOverride : modelledSalaryTy;
    // What a modelled repayment is charged on. Payroll deducts each month on
    // that month's pay, so a tax year's income total -- which carries its
    // low-paid early months -- would understate every later deduction. From
    // the tax year of `salaryFrom` the repayment therefore follows the
    // salary model; earlier tax years have no "current pay" to follow, so
    // they keep the income override where there is one.
    const repaymentPayTy = taxYear >= salaryBaseTaxYear || !hasIncomeOverride ? modelledSalaryTy : incomeOverride;
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
    return { phase, rateRow, monthAssumptions, salaryTy, repaymentPayTy, thresholdTy, upperTy, rate };
  };

  // slcTiming: each tax year's accrued-but-not-yet-landed top-up, keyed by
  // the tax year it belongs to. Untouched by an anchor reset — see the doc
  // comment above — so it survives across it unlike `balance`.
  const pendingTopUpByTaxYear = new Map<number, number>();

  // An anchor is the balance SLC shows, which leaves out every top-up of its
  // tax year so far -- and of the year before, when the anchor falls between
  // April and the month that year's top-up lands. When the grid starts at the
  // anchor, those months were never simulated, so their top-up is seeded here
  // on the anchor balance. A grid that starts earlier accrues it as it goes.
  if (slcTiming && plan === 'plan2' && anchor && anchorDate) {
    const anchorMonth = monthStart(anchorDate);
    const anchorTaxYear = taxYearOf(anchorMonth);
    const priorLandsAfter = topUpLandingMonth(anchorTaxYear - 1, slcTiming.confirmationLagMonths) > anchorMonth;
    const seedStart = new Date(priorLandsAfter ? anchorTaxYear - 1 : anchorTaxYear, 3, 1);
    for (let at = new Date(seedStart); at < anchorMonth && at < startDate; at = addMonths(at, 1)) {
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
    const balanceCarried = balance;

    // 1. Draws dated this month.
    let drawn = 0;
    const bucket = drawsByMonth.get(monthKey);
    if (bucket) for (const d of bucket) drawn += d.amount;
    balance += drawn;
    cumulativeDrawn += drawn;

    // 2. Anchor.
    const anchored = anchorMonthKey !== undefined && monthKey === anchorMonthKey;
    if (anchored) balance = anchor!.balance;

    // SLC's figure already includes a top-up that lands in the anchor's own
    // month (the prior-year seed above leaves such a year out for the same
    // reason), so one accrued by earlier simulated months is dropped here
    // rather than landed on top of it in step 3. The amount is kept for the
    // anchor check below, which compares like with like.
    let landedAtAnchor = 0;
    if (anchored && slcTiming && plan === 'plan2') {
      for (const [ty, amount] of pendingTopUpByTaxYear) {
        if (toISODate(topUpLandingMonth(ty, slcTiming.confirmationLagMonths)) === monthKey) {
          landedAtAnchor += amount;
          pendingTopUpByTaxYear.delete(ty);
        }
      }
    }

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

    const { phase, rateRow, monthAssumptions, salaryTy, repaymentPayTy, thresholdTy, upperTy, rate } = monthRates(cursor);
    const rateSource: StudentLoanMonth['rateSource'] = rateRow ? 'published' : 'assumed';
    const isWriteOffMonth = cursor.getTime() === writeOffMonth.getTime();

    // The rate actually added to the balance this month: slcTiming splits a
    // Plan 2 repayment month into the provisional (RPI, capped) rate charged
    // now and the rest accruing as a pending top-up; every other month is
    // charged `rate` in full, and the write-off month nothing at all.
    const splitMonth = slcTiming !== undefined && plan === 'plan2' && phase === 'repayment';
    const provisionalRate = splitMonth
      ? studentLoanInterestRate(plan, phase, thresholdTy, thresholdTy, upperTy, monthAssumptions)
      : rate;
    const chargedRate = isWriteOffMonth ? 0 : provisionalRate;

    const inKnownWindow =
      phase === 'repayment' &&
      hasKnownPayments &&
      knownPaymentsUntilMonth !== undefined &&
      cursor.getTime() >= knownPaymentsFromMonth.getTime() &&
      cursor.getTime() <= knownPaymentsUntilMonth.getTime();

    // 2c. Anchor check: what the simulation had reached on the anchor's date,
    // just before the reset above replaced it with SLC's figure. Same
    // conventions as the rest of the loop -- the balance carried in, plus
    // draws and extra payments dated on or before the anchor, plus interest
    // for the days up to and including it, less known payments dated on or
    // before it. Only meaningful when the grid began earlier than the anchor's
    // month; a grid that starts at the anchor has nothing to disagree with.
    // A top-up landing in this month is added once the rest is rebuilt, because
    // SLC's figure includes it (the reset above dropped it from the pending
    // amounts), so the two balances are compared like with like.
    if (anchored && anchor && anchorDate && cursor.getTime() > startDate.getTime()) {
      let rebuilt = balanceCarried;
      for (const d of bucket ?? []) if (d.date <= anchor.date) rebuilt += d.amount;
      for (const e of extraEntries) {
        if (e.date > anchor.date) continue;
        rebuilt -= e.amount > 0 ? Math.min(e.amount, Math.max(rebuilt, 0)) : e.amount;
      }
      rebuilt += rebuilt * (chargedRate / 100 / 12) * (anchorDate.getDate() / daysInMonth(cursor));
      if (inKnownWindow && !isWriteOffMonth) {
        const sum = (knownPaymentsByMonth.get(monthKey) ?? [])
          .filter(e => e.date <= anchor.date)
          .reduce((s, e) => s + e.amount, 0);
        rebuilt -= Math.max(0, Math.min(sum, rebuilt));
      }
      rebuilt += landedAtAnchor;
      const rebuiltBalance = round2(rebuilt);
      anchorCheck = {
        date: anchor.date,
        slcBalance: anchor.balance,
        rebuiltBalance,
        gap: pence(anchor.balance - rebuiltBalance),
      };
    }

    // 5. Write-off: no interest, no payment; the balance carried in is what
    // is written off, and a final zero-balance month closes the loan.
    if (isWriteOffMonth) {
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
        chargedRate: 0,
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
        pendingByTaxYear: [],
        topUpApplied: 0,
        topUpAccrued: 0,
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
    let topUpAccrued = 0;
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
        const provisionalInterest = balance * (provisionalRate / 100 / 12) * anchorShare;
        // The whole month's top-up accrues even in the anchor month: the
        // anchor is SLC's balance, which excludes every top-up so far.
        const topUpAccrual = balance * ((rate - provisionalRate) / 100 / 12);
        topUpAccrued = topUpAccrual;
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
    // The same pending top-up, by tax year. The map only ever holds entries
    // under slcTiming on Plan 2; one that rounds to nothing is left out.
    const pendingByTaxYear: StudentLoanMonth['pendingByTaxYear'] = slcTiming
      ? Array.from(pendingTopUpByTaxYear, ([ty, amount]) => ({
          taxYear: ty,
          amount: round2(amount),
          landsOn: toISODate(topUpLandingMonth(ty, slcTiming.confirmationLagMonths)),
        }))
          .filter(p => p.amount !== 0)
          .sort((a, b) => a.taxYear - b.taxYear)
      : [];

    // 4. Repayment, in the repayment phase only. A known-payments window
    // (see doc comment above) replaces the salary-modelled figure with what
    // was actually deducted, month by month.
    let payment = 0;
    let paymentSource: StudentLoanMonth['paymentSource'] = 'none';
    if (phase === 'repayment') {
      if (inKnownWindow) {
        paymentSource = 'known';
        const entries = knownPaymentsByMonth.get(monthKey) ?? [];
        const relevant = anchored ? entries.filter(e => e.date > anchor!.date) : entries;
        const sum = relevant.reduce((s, e) => s + e.amount, 0);
        payment = Math.max(0, Math.min(sum, balance));
      } else {
        paymentSource = 'modelled';
        const raw = (Math.max(repaymentPayTy - thresholdTy, 0) * (repaymentRate / 100)) / 12;
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
      chargedRate,
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
      pendingByTaxYear,
      topUpApplied: round2(topUpApplied),
      topUpAccrued: round2(topUpAccrued),
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
    ...(anchorCheck ? { anchorCheck } : {}),
  };
};
