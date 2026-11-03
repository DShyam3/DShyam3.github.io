/**
 * Reverse-engineers the interest rate SLC actually charged between two
 * verified balances, so the owner can see whether SLC's rate matches the
 * model's, and whether a gap is only a payslip deduction SLC has not been
 * passed yet.
 *
 * Pure; no `new Date()`. Every date is a `YYYY-MM-DD` string read from its own
 * parts (`calendarParts`), never `new Date('YYYY-MM-DD')`, which parses as UTC
 * and drifts a day either side of midnight with the caller's timezone.
 *
 * The replay uses exactly the monthly convention `simulateStudentLoan` does: a
 * month's interest is `balance * (annualRate / 100 / 12)`, scaled by the share
 * of that month the interval covers (the same pro-rata the simulator applies
 * to an anchor's own month), charged on the balance after that month's
 * adjustments and before its payments. A reading that agrees with the model
 * therefore solves to the model's rate. Nothing is rounded between months,
 * only the figure returned, as the simulator does.
 *
 * `studentLoanReadingCheck` is the whole check for one pair of readings, given
 * a simulation run anchored at the first: the expected rate and balance, SLC's
 * implied rate, and whether a landed top-up or a late payslip deduction would
 * explain a gap. The UI only phrases what it returns.
 *
 * Nothing here is invented to fill a gap (AGENTS.md rule 4): a payment or
 * adjustment with a non-finite amount or an unreal date is left out, a month
 * with no charged rate makes the expected rate unknown, and an unsolvable
 * interval is `undefined` rather than a clamped rate.
 */

import { calendarParts, getDaysInMonth } from './dates';

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** A signed amount on a date (`YYYY-MM-DD`). Named for the lib: `DatedAmount` is spend-history's. */
export interface StudentLoanDatedAmount {
  date: string;
  amount: number;
}

/** A verified balance on a date (`YYYY-MM-DD`). */
export interface BalanceReading {
  date: string;
  balance: number;
}

type Day = NonNullable<ReturnType<typeof calendarParts>>;

/** Months since year 0, a single number that sorts and steps by calendar month. */
const monthKey = (day: { year: number; month: number }): number => day.year * 12 + day.month - 1;

/**
 * Sums of finite amounts dated in `(from, to]`, by calendar month. A date that
 * is not a real day, or an amount that is not finite, is skipped rather than
 * counted as zero.
 */
const totalsByMonth = (
  entries: readonly StudentLoanDatedAmount[],
  from: Day,
  to: Day,
): Map<number, number> => {
  const totals = new Map<number, number>();
  for (const entry of entries) {
    if (!Number.isFinite(entry.amount)) continue;
    const day = calendarParts(entry.date);
    if (!day || day.epoch <= from.epoch || day.epoch > to.epoch) continue;
    const key = monthKey(day);
    totals.set(key, (totals.get(key) ?? 0) + entry.amount);
  }
  return totals;
};

const sum = (totals: Map<number, number>): number => {
  let total = 0;
  for (const value of totals.values()) total += value;
  return total;
};

/** Days of the month `key` that fall in `(from, to]`; `daysInMonth` is returned alongside. */
const daysInside = (key: number, from: Day, to: Day): { days: number; daysInMonth: number } => {
  const year = Math.floor(key / 12);
  const month = key % 12;
  const dim = getDaysInMonth(year, month);
  const startDay = key === monthKey(from) ? from.day : 0;
  const endDay = key === monthKey(to) ? to.day : dim;
  return { days: endDay - startDay, daysInMonth: dim };
};

/** The walk shared by the replay and the solver. May return a non-finite number; callers decide. */
const replay = (
  fromBalance: number,
  from: Day,
  to: Day,
  annualRate: number,
  adjustments: Map<number, number>,
  payments: Map<number, number>,
): number => {
  let balance = fromBalance;
  for (let key = monthKey(from); key <= monthKey(to); key++) {
    const { days, daysInMonth } = daysInside(key, from, to);
    balance += adjustments.get(key) ?? 0;
    balance += balance * (annualRate / 100 / 12) * (days / daysInMonth);
    balance -= payments.get(key) ?? 0;
  }
  return balance;
};

export interface StudentLoanReplayInput {
  from: BalanceReading;
  /** `YYYY-MM-DD`; the balance is returned as at the end of this day. */
  toDate: string;
  /** % a year. */
  annualRate: number;
  /** Payroll deductions: positive amounts that lower the balance. */
  payments: readonly StudentLoanDatedAmount[];
  /** Signed: positive raises the balance (a refund, a draw, a landed top-up), negative lowers it (a voluntary payment). */
  adjustments: readonly StudentLoanDatedAmount[];
}

/**
 * The balance on `toDate`, replayed from the verified balance `from` at a
 * constant `annualRate`, month by month.
 *
 * Only entries dated in `(from.date, toDate]` count: the reading already
 * reflects anything on or before its own date. In each calendar month, in
 * order: that month's adjustments, then interest on the result for the share
 * of the month inside the interval, then that month's payments. The share is
 * `(dim - fromDay) / dim` for the first month of a longer interval,
 * `toDay / dim` for the last, `(toDay - fromDay) / dim` when both are the same
 * month, and 1 for a month in between.
 *
 * Neither balance nor payments are clamped at zero: this replays a loan that
 * is still standing, and clamping would make the solver's function flat.
 *
 * `undefined` when `toDate` is before `from.date`, a date is not a real
 * `YYYY-MM-DD` day, `from.balance` or `annualRate` is not finite, or the
 * arithmetic overflows. A payment or adjustment with a non-finite amount or
 * unreal date is skipped, not read as zero.
 */
export const replayStudentLoanBalance = ({
  from,
  toDate,
  annualRate,
  payments,
  adjustments,
}: StudentLoanReplayInput): number | undefined => {
  if (!Number.isFinite(from.balance) || !Number.isFinite(annualRate)) return undefined;
  const start = calendarParts(from.date);
  const end = calendarParts(toDate);
  if (!start || !end || end.epoch < start.epoch) return undefined;

  const result = replay(
    from.balance,
    start,
    end,
    annualRate,
    totalsByMonth(adjustments, start, end),
    totalsByMonth(payments, start, end),
  );
  return Number.isFinite(result) ? round2(result) : undefined;
};

/**
 * Days apart two readings must be for a rate to be worth solving: shorter and a
 * month's pro-rata and a pay date swamp the rate. Below this,
 * `impliedStudentLoanRate` is `undefined` and `studentLoanReadingCheck` is
 * `'too_close'`.
 */
export const MIN_RATE_CHECK_DAYS = 28;
const RATE_LOW = -20;
const RATE_HIGH = 40;
/** Bisection stops when the bracket is this narrow (well inside the 1e-6 asked for). */
const BRACKET_WIDTH = 1e-9;
/** Returned rates are rounded to 1e-6, the precision the solve promises. */
const RATE_SCALE = 1e6;
/** Absorbs float noise on a comparison that sits exactly on the tolerance. */
const TOLERANCE_EPSILON = 1e-9;

export interface StudentLoanImpliedRateInput {
  from: BalanceReading;
  to: BalanceReading;
  payments: readonly StudentLoanDatedAmount[];
  adjustments: readonly StudentLoanDatedAmount[];
}

export interface StudentLoanImpliedRate {
  /** % a year, to 1e-6. Negative when the balance fell more than the payments explain. */
  annualRate: number;
  /** The interest the two readings imply, to the penny. */
  interest: number;
}

/**
 * The annual rate at which `replayStudentLoanBalance` from `from` lands on
 * `to.balance`, found by bisection on [-20, 40] (the replay rises with the
 * rate while the balance is positive), plus the interest the two readings
 * imply: `to.balance - from.balance` less the adjustments in range, plus the
 * payments in range.
 *
 * The solve runs on the unrounded replay, so a reading that agrees with the
 * model solves to the model's rate rather than to the nearest rate that
 * survives pennies.
 *
 * `undefined` when the readings are under `MIN_RATE_CHECK_DAYS` apart (too short to tell), the
 * interval is backwards, `from.balance` is not positive, any input is not
 * finite or not a real date, or no rate in the bracket reaches `to.balance`.
 */
export const impliedStudentLoanRate = ({
  from,
  to,
  payments,
  adjustments,
}: StudentLoanImpliedRateInput): StudentLoanImpliedRate | undefined => {
  if (!Number.isFinite(from.balance) || !Number.isFinite(to.balance) || from.balance <= 0) return undefined;
  const start = calendarParts(from.date);
  const end = calendarParts(to.date);
  if (!start || !end || end.epoch - start.epoch < MIN_RATE_CHECK_DAYS) return undefined;

  const adjustmentTotals = totalsByMonth(adjustments, start, end);
  const paymentTotals = totalsByMonth(payments, start, end);
  const gap = (rate: number): number =>
    replay(from.balance, start, end, rate, adjustmentTotals, paymentTotals) - to.balance;

  const interest = round2(to.balance - from.balance - sum(adjustmentTotals) + sum(paymentTotals));

  let low = RATE_LOW;
  let high = RATE_HIGH;
  const gapLow = gap(low);
  const gapHigh = gap(high);
  if (Number.isNaN(gapLow) || Number.isNaN(gapHigh) || gapLow > 0 || gapHigh < 0) return undefined;

  const solved = (rate: number): StudentLoanImpliedRate => {
    const rounded = Math.round(rate * RATE_SCALE) / RATE_SCALE;
    return { annualRate: rounded === 0 ? 0 : rounded, interest };
  };
  if (gapLow === 0) return solved(low);
  if (gapHigh === 0) return solved(high);

  while (high - low > BRACKET_WIDTH) {
    const mid = (low + high) / 2;
    const gapMid = gap(mid);
    if (Number.isNaN(gapMid)) return undefined;
    if (gapMid === 0) return solved(mid);
    if (gapMid < 0) low = mid;
    else high = mid;
  }
  return solved((low + high) / 2);
};

/** One month of SLC's published charged rate. */
export interface StudentLoanChargedMonth {
  /** `YYYY-MM-01`. */
  date: string;
  /** % a year. */
  chargedRate: number;
}

/**
 * The mean of `chargedRate` over the days in `(fromDate, toDate]`, each day
 * weighted equally, so a month with more days in the interval counts for more.
 *
 * `undefined` when the interval is empty or backwards, a date is not a real
 * day, or any month with a day in the interval has no finite `chargedRate` in
 * `months` (an unreal row, or a non-finite rate, is skipped and so counts as
 * missing). A month listed twice with different rates is ambiguous and also
 * counts as missing. Months outside the interval are ignored, and `months`
 * need not be sorted.
 */
export const expectedChargedRate = (
  months: readonly StudentLoanChargedMonth[],
  fromDate: string,
  toDate: string,
): number | undefined => {
  const start = calendarParts(fromDate);
  const end = calendarParts(toDate);
  if (!start || !end || end.epoch <= start.epoch) return undefined;

  const rateByMonth = new Map<number, number>();
  for (const month of months) {
    const day = calendarParts(month.date);
    if (!day || !Number.isFinite(month.chargedRate)) continue;
    const key = monthKey(day);
    const known = rateByMonth.get(key);
    // NaN marks a conflict: a later lookup reads it as no usable rate.
    if (known === undefined) rateByMonth.set(key, month.chargedRate);
    else if (known !== month.chargedRate) rateByMonth.set(key, NaN);
  }

  let weighted = 0;
  for (let key = monthKey(start); key <= monthKey(end); key++) {
    const { days } = daysInside(key, start, end);
    if (days === 0) continue;
    const rate = rateByMonth.get(key);
    if (rate === undefined || !Number.isFinite(rate)) return undefined;
    weighted += rate * days;
  }
  return weighted / (end.epoch - start.epoch);
};

/** Default distance, in percentage points, within which two rates are called the same. */
const DEFAULT_TOLERANCE = 0.25;

export interface StudentLoanRateCheckInput extends StudentLoanImpliedRateInput {
  /** % a year: what the model (or SLC's published schedule) says should have been charged. */
  expectedRate: number;
  /** Percentage points. Defaults to 0.25. */
  tolerance?: number;
}

export interface StudentLoanRateCheck {
  /** % a year SLC's two balances imply. */
  impliedRate: number;
  expectedRate: number;
  /** The interest the two readings imply, to the penny. */
  interest: number;
  verdict: 'matches' | 'higher' | 'lower';
  /**
   * Set only for a `'higher'` verdict that dropping the most recent payment(s)
   * explains: SLC's balance is above the model's because a deduction has not
   * reached it yet. `count` is the fewest payments (1 or 2) that bring the
   * implied rate within tolerance, `amount` their sum and `impliedRate` the
   * rate re-solved without them.
   */
  withoutLatest?: { count: number; amount: number; impliedRate: number };
}

const within = (rate: number, expected: number, tolerance: number): boolean =>
  Math.abs(rate - expected) <= tolerance + TOLERANCE_EPSILON;

/**
 * Whether SLC's rate between two verified balances matches `expectedRate`.
 *
 * 'matches' when the implied rate is within `tolerance` of the expected one,
 * otherwise 'higher' or 'lower'. When it is 'higher', SLC's balance is above
 * the model and the usual cause is a deduction SLC has not received yet, so
 * the implied rate is re-solved with the most recent payment in the interval
 * dropped, then the two most recent; the fewest drops that land within
 * tolerance are reported as `withoutLatest`. "Most recent" is by date among
 * payments inside `(from.date, to.date]`, whatever order they are passed in.
 *
 * `undefined` when the implied rate is undefined (see `impliedStudentLoanRate`),
 * or `expectedRate` or `tolerance` is not finite, or `tolerance` is negative.
 */
export const checkStudentLoanRate = ({
  from,
  to,
  payments,
  adjustments,
  expectedRate,
  tolerance = DEFAULT_TOLERANCE,
}: StudentLoanRateCheckInput): StudentLoanRateCheck | undefined => {
  if (!Number.isFinite(expectedRate) || !Number.isFinite(tolerance) || tolerance < 0) return undefined;
  const implied = impliedStudentLoanRate({ from, to, payments, adjustments });
  if (!implied) return undefined;

  const verdict: StudentLoanRateCheck['verdict'] = within(implied.annualRate, expectedRate, tolerance)
    ? 'matches'
    : implied.annualRate > expectedRate
      ? 'higher'
      : 'lower';
  const check: StudentLoanRateCheck = {
    impliedRate: implied.annualRate,
    expectedRate,
    interest: implied.interest,
    verdict,
  };
  if (verdict !== 'higher') return check;

  // impliedStudentLoanRate succeeded, so both dates are real days.
  const start = calendarParts(from.date)!;
  const end = calendarParts(to.date)!;
  const inRange = payments
    .flatMap((payment, index) => {
      const day = calendarParts(payment.date);
      return day && Number.isFinite(payment.amount) && day.epoch > start.epoch && day.epoch <= end.epoch
        ? [{ index, epoch: day.epoch, amount: payment.amount }]
        : [];
    })
    .sort((a, b) => a.epoch - b.epoch || a.index - b.index);

  for (const count of [1, 2]) {
    if (inRange.length < count) break;
    const dropped = inRange.slice(-count);
    const droppedIndexes = new Set(dropped.map(d => d.index));
    const resolved = impliedStudentLoanRate({
      from,
      to,
      payments: payments.filter((_, index) => !droppedIndexes.has(index)),
      adjustments,
    });
    if (resolved && within(resolved.annualRate, expectedRate, tolerance)) {
      check.withoutLatest = {
        count,
        amount: round2(dropped.reduce((total, d) => total + d.amount, 0)),
        impliedRate: resolved.annualRate,
      };
      break;
    }
  }
  return check;
};

/** One month of a simulation run, as far as a reading check needs it: `StudentLoanMonth` fits. */
export interface StudentLoanCheckMonth extends StudentLoanChargedMonth {
  /** The income-linked top-up SLC adds on the first of this month; 0 when none lands. */
  topUpApplied: number;
}

/** Pence, with a -0 from rounding a tiny negative turned back into 0. */
const pence = (n: number): number => round2(n) + 0;

/**
 * The top-ups `months` land in `(from, to]`, as positive adjustments dated the
 * first of their month. A top-up is a lump SLC adds on the 1st, which a
 * constant-rate replay would otherwise miss. A month dated on or before `from`
 * is left out: the reading already holds it. An unreal date or non-finite
 * amount is skipped, and a month listed twice is counted once if the rows
 * agree; if they disagree the month is ambiguous and the whole answer is
 * `undefined`, as `expectedChargedRate` treats a conflicting rate.
 */
const landedTopUps = (
  months: readonly StudentLoanCheckMonth[],
  from: Day,
  to: Day,
): StudentLoanDatedAmount[] | undefined => {
  const byMonth = new Map<number, number>();
  for (const month of months) {
    const day = calendarParts(month.date);
    if (!day || !Number.isFinite(month.topUpApplied)) continue;
    const landed = day.epoch - (day.day - 1);
    if (landed <= from.epoch || landed > to.epoch) continue;
    const key = monthKey(day);
    const known = byMonth.get(key);
    if (known === undefined) byMonth.set(key, month.topUpApplied);
    else if (known !== month.topUpApplied) return undefined;
  }
  const topUps: StudentLoanDatedAmount[] = [];
  for (const [key, amount] of byMonth) {
    if (amount <= 0) continue;
    const month = String((key % 12) + 1).padStart(2, '0');
    topUps.push({ date: `${String(Math.floor(key / 12)).padStart(4, '0')}-${month}-01`, amount });
  }
  return topUps;
};

/**
 * What the model says should have happened from `from` to `toDate`: the rate
 * it should have charged and the top-ups that should have landed, with
 * `adjustments` and the top-ups together as the replay's adjustments.
 * `undefined` when the model has no rate for part of the interval, or a
 * month's top-up is ambiguous.
 */
const modelledInterval = (
  from: BalanceReading,
  toDate: string,
  adjustments: readonly StudentLoanDatedAmount[],
  months: readonly StudentLoanCheckMonth[],
): { rate: number; topUps: StudentLoanDatedAmount[]; adjustments: StudentLoanDatedAmount[] } | undefined => {
  const start = calendarParts(from.date);
  const end = calendarParts(toDate);
  if (!start || !end) return undefined;
  const rate = expectedChargedRate(months, from.date, toDate);
  const topUps = landedTopUps(months, start, end);
  if (rate === undefined || topUps === undefined) return undefined;
  return { rate, topUps, adjustments: [...adjustments, ...topUps] };
};

export interface StudentLoanExpectedBalanceInput {
  /** A verified balance: the simulation in `months` is anchored here. */
  from: BalanceReading;
  /** `YYYY-MM-DD`; the balance is returned as at the end of this day. */
  toDate: string;
  /** Payroll deductions: positive amounts that lower the balance. */
  payments: readonly StudentLoanDatedAmount[];
  /** Signed, as `StudentLoanReplayInput.adjustments`. Landed top-ups are added to these. */
  adjustments: readonly StudentLoanDatedAmount[];
  /** A simulation run anchored at `from`, one row per calendar month. */
  months: readonly StudentLoanCheckMonth[];
}

/**
 * The balance the model expects on `toDate`, given SLC's verified balance on
 * `from.date`: a replay at the mean rate the model charged over `(from.date,
 * toDate]` (`expectedChargedRate`), with every top-up the model lands in that
 * range added on the first of its month.
 *
 * `undefined` when the model has no rate for part of the interval, `toDate` is
 * not after `from.date`, a date is not a real day, or the replay is
 * `undefined` (see `replayStudentLoanBalance`).
 */
export const expectedStudentLoanBalanceOn = ({
  from,
  toDate,
  payments,
  adjustments,
  months,
}: StudentLoanExpectedBalanceInput): number | undefined => {
  const modelled = modelledInterval(from, toDate, adjustments, months);
  if (!modelled) return undefined;
  return replayStudentLoanBalance({
    from,
    toDate,
    annualRate: modelled.rate,
    payments,
    adjustments: modelled.adjustments,
  });
};

export interface StudentLoanReadingCheckInput {
  from: BalanceReading;
  to: BalanceReading;
  payments: readonly StudentLoanDatedAmount[];
  adjustments: readonly StudentLoanDatedAmount[];
  /** A simulation run anchored at `from`, one row per calendar month. */
  months: readonly StudentLoanCheckMonth[];
  /** Percentage points. Defaults to 0.25. */
  tolerance?: number;
}

/** The rate check ran: `checkStudentLoanRate`'s result, plus what the model expected the balance to be. */
export interface StudentLoanReadingChecked extends StudentLoanRateCheck {
  status: 'checked';
  /** The model's balance on `to.date`, from `expectedStudentLoanBalanceOn`. */
  expectedBalance: number;
  /** `to.balance - expectedBalance`, to the penny: positive when SLC's balance is the higher. */
  gap: number;
  /** The top-ups the model landed in the interval and the check counted, summed. 0 when none. */
  topUpAssumed: number;
  /**
   * Set only when the verdict is not `'matches'`, top-ups were assumed, and
   * solving again without them lands within tolerance: SLC's income-linked
   * interest had not been added when the model assumed it had. `impliedRate`
   * is the rate re-solved without them.
   */
  withoutTopUp?: { impliedRate: number };
}

export type StudentLoanReadingCheck =
  /** A date is not real, a balance or the tolerance is not usable, or `to` is not after `from`. */
  | { status: 'invalid' }
  /** Under `MIN_RATE_CHECK_DAYS` apart. */
  | { status: 'too_close'; days: number }
  /** The model has no rate for part of the interval (or a month's top-up is ambiguous). */
  | { status: 'no_model' }
  /** No rate reaches `to.balance`, or `from.balance` is not positive. */
  | { status: 'unsolvable' }
  | StudentLoanReadingChecked;

/**
 * Whether SLC charged what the model says between two of its own balances.
 * Everything the UI used to assemble from a simulation, in one place: the
 * expected rate, the top-ups that should have landed (counted as adjustments,
 * since SLC adds them as lumps), `checkStudentLoanRate` on the result, and the
 * balance the model expected, so a sentence can say how far SLC sat from it.
 *
 * Checked in this order, the first that applies deciding the status:
 * `'invalid'`, `'too_close'` (the model is not consulted), `'no_model'`,
 * `'unsolvable'`. A non-finite or negative `tolerance` is `'invalid'`. A
 * `from.balance` that is zero or negative cannot be solved from and is
 * `'unsolvable'`. Should the expected balance fail to replay after the rate
 * was solved (not expected for finite readings), the model produced nothing
 * to compare with and the status is `'no_model'`.
 *
 * `withoutLatest` has `checkStudentLoanRate`'s meaning. `withoutTopUp`, which
 * can be set alongside it, answers a different question: with a verdict other
 * than `'matches'` and a top-up assumed, would the readings agree with the
 * model had that top-up not landed yet? Typically a `'lower'` verdict, SLC
 * short of what the model landed.
 */
export const studentLoanReadingCheck = ({
  from,
  to,
  payments,
  adjustments,
  months,
  tolerance = DEFAULT_TOLERANCE,
}: StudentLoanReadingCheckInput): StudentLoanReadingCheck => {
  const start = calendarParts(from.date);
  const end = calendarParts(to.date);
  if (
    !start ||
    !end ||
    !Number.isFinite(from.balance) ||
    !Number.isFinite(to.balance) ||
    !Number.isFinite(tolerance) ||
    tolerance < 0 ||
    end.epoch <= start.epoch
  ) {
    return { status: 'invalid' };
  }
  const days = end.epoch - start.epoch;
  if (days < MIN_RATE_CHECK_DAYS) return { status: 'too_close', days };

  const modelled = modelledInterval(from, to.date, adjustments, months);
  if (!modelled) return { status: 'no_model' };

  const check = checkStudentLoanRate({
    from,
    to,
    payments,
    adjustments: modelled.adjustments,
    expectedRate: modelled.rate,
    tolerance,
  });
  if (!check) return { status: 'unsolvable' };

  const expectedBalance = replayStudentLoanBalance({
    from,
    toDate: to.date,
    annualRate: modelled.rate,
    payments,
    adjustments: modelled.adjustments,
  });
  if (expectedBalance === undefined) return { status: 'no_model' };

  const topUpAssumed = round2(modelled.topUps.reduce((total, topUp) => total + topUp.amount, 0));
  const checked: StudentLoanReadingChecked = {
    status: 'checked',
    ...check,
    expectedBalance,
    gap: pence(to.balance - expectedBalance),
    topUpAssumed,
  };
  if (check.verdict !== 'matches' && topUpAssumed > 0) {
    const without = impliedStudentLoanRate({ from, to, payments, adjustments });
    if (without && within(without.annualRate, modelled.rate, tolerance)) {
      checked.withoutTopUp = { impliedRate: without.annualRate };
    }
  }
  return checked;
};
