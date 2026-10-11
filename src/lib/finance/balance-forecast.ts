/**
 * A day-by-day forecast of the cash in the current accounts: today's balance,
 * plus each payday, minus each bill still to be paid. Rules over rows, no
 * model: every figure is the sum of stored amounts, in whole pence.
 *
 * What it does not do: it knows nothing about spending that is not a recurring
 * bill, and a bill paid from a credit account is left out (its cash leaves
 * later, on a card repayment this module does not model). `excluded`,
 * `unplaced`, `overdue` and `payModelled` say what was left out, so the caller
 * can show it instead of presenting a partial figure as a complete one.
 */
import type { BankAccount, FinanceSettings, MockTransaction, RecurringBill } from '@/features/finance/finance-types';
import { scheduleBills, type BillOccurrence } from './bill-schedule';
import { epochDay, isoOfEpochDay } from './dates';
import { paydaysBetween, paydaysPerYear, type PaydayOptions } from './payday';
import { isActiveRecurring, isTransferLike } from './recurring-detection';

export interface ForecastPoint {
  date: string;
  /** Pounds, the exact sum of whole pence. */
  balance: number;
}

export interface ForecastEvent {
  date: string;
  /** Which way the money moves: a payday adds `amount`, a bill takes it away. Always the positive figure. */
  kind: 'pay' | 'bill';
  amount: number;
  label: string;
  billId?: string;
}

export interface BalanceForecastInput {
  /** The first day of the forecast, YYYY-MM-DD. */
  today: string;
  /** How many days to forecast, today included. Defaults to 60; a whole number from 1 to 3660. */
  days?: number;
  accounts: readonly BankAccount[];
  bills: readonly RecurringBill[];
  /** Bill id to the date of its latest matching bank payment; see scheduleBills. */
  evidence?: ReadonlyMap<string, string>;
  payday: {
    schedule: FinanceSettings['paydaySchedule'];
    opts: PaydayOptions;
    bankHolidays: readonly string[];
    /** Take-home pay for a year; each payday is an equal share of it. */
    annualNetPay: number;
  };
  /**
   * The ledger, with confirmed transfers already removed. Pay that has landed
   * a few days early is already in the balances, and is read from here so it
   * is not added again.
   */
  transactions: readonly MockTransaction[];
}

interface ForecastLists {
  points: ForecastPoint[];
  /** Pay before bills on the same day, then by label and bill id. */
  events: ForecastEvent[];
  /** Unpaid, unseen bills dated before today in the current period: listed, never subtracted. */
  overdue: BillOccurrence[];
  /** Active bills whose schedule or amount cannot be placed: left out, not guessed. */
  unplaced: RecurringBill[];
  /** Bills linked to an account that is not a current account, in the window: left out of the cash forecast. */
  excluded: BillOccurrence[];
}

export type ForecastUnavailableReason = 'no_cash_account' | 'unknown_balance' | 'invalid_window';

/**
 * Check `available` with `=== false` (or `=== true`) to narrow: this project
 * compiles without strictNullChecks, where `!forecast.available` does not.
 */
export type BalanceForecast =
  | (ForecastLists & { available: false; reason: ForecastUnavailableReason })
  | (ForecastLists & {
    available: true;
    /** The summed balance of the current accounts, signed (an overdraft is negative). */
    startBalance: number;
    /** The lowest balance in the window; the earliest day on a tie. */
    lowest: ForecastPoint;
    /** The first day the balance is below zero, or null if it never is. */
    firstBelowZero: string | null;
    endBalance: number;
    /** False when no pay was added: annual net pay missing, zero, negative or unusable, or a schedule that places no date. */
    payModelled: boolean;
    /** Each payday's share of annual net pay, to the penny; 0 when pay is not modelled. */
    payPerPayday: number;
  });

const DEFAULT_DAYS = 60;
const MAX_DAYS = 3660;
/**
 * How far back overdue bills are looked for: a whole month, so a monthly bill
 * missed earlier this period is listed. Older arrears (a quarterly or annual
 * bill missed long ago) are not.
 */
const OVERDUE_LOOKBACK_DAYS = 31;
/** Longer than any pay cycle; a schedule that places nothing in it places nothing. */
const PAY_PROBE_DAYS = 400;
/**
 * Pay is looked for in the ledger from this many days before the coming
 * payday: employers pay early over weekends and bank holidays, and a payday
 * moved back across a long weekend can land a few days sooner still. For a
 * weekly schedule this is most of the cycle, so last week's pay arriving two
 * days late reads as early for the next one; the cost is a pay left out of the
 * forecast, never one counted twice.
 */
const PAY_EARLY_DAYS = 5;

const compare = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;

/** Whole pence, or undefined when the figure is not a finite amount that fits exactly. */
const toPence = (pounds: number): number | undefined => {
  if (!Number.isFinite(pounds)) return undefined;
  const pence = Math.round(pounds * 100);
  return Number.isSafeInteger(pence) ? pence : undefined;
};

/** `+ 0` turns a -0 from rounding a tiny negative into 0. */
const toPounds = (pence: number): number => pence / 100 + 0;

const unavailable = (reason: ForecastUnavailableReason): BalanceForecast => (
  { available: false, reason, points: [], events: [], overdue: [], unplaced: [], excluded: [] }
);

export const forecastBalance = (input: BalanceForecastInput): BalanceForecast => {
  const days = input.days ?? DEFAULT_DAYS;
  const todayDay = epochDay(input.today);
  if (todayDay === undefined || !Number.isInteger(days) || days < 1 || days > MAX_DAYS) {
    return unavailable('invalid_window');
  }
  const lastDay = todayDay + days - 1;
  const lastDate = isoOfEpochDay(lastDay);

  const cashAccounts = input.accounts.filter(account => account.type === 'checking');
  if (cashAccounts.length === 0) return unavailable('no_cash_account');
  let startPence = 0;
  for (const account of cashAccounts) {
    const pence = toPence(account.balance);
    // A balance we cannot read would be summed as zero; better to say the start is unknown.
    if (pence === undefined) return unavailable('unknown_balance');
    startPence += pence;
  }
  const cashIds = new Set(cashAccounts.map(account => account.id));

  // One pass over the overdue look-back and the window together, so a bank payment
  // settles one date: the late payment for a missed bill, or the early one for the next.
  const active = input.bills.filter(isActiveRecurring);
  const hasAmount = (bill: RecurringBill): boolean => toPence(bill.amount) !== undefined;
  const schedule = scheduleBills(
    active.filter(hasAmount),
    isoOfEpochDay(todayDay - OVERDUE_LOOKBACK_DAYS),
    lastDate,
    input.today,
    input.evidence,
  );
  const cannotPlace = new Set(schedule.unplaced);
  const unplaced = active.filter(bill => !hasAmount(bill) || cannotPlace.has(bill));

  const overdue = schedule.occurrences.filter(occurrence => occurrence.status === 'overdue');
  const excluded: BillOccurrence[] = [];
  const events: ForecastEvent[] = [];
  const deltaByDay = new Map<number, number>();
  const addDelta = (date: string, pence: number): void => {
    const day = epochDay(date)!;
    deltaByDay.set(day, (deltaByDay.get(day) ?? 0) + pence);
  };

  for (const occurrence of schedule.occurrences) {
    if (occurrence.status !== 'due') continue;
    if (occurrence.linkedAccountId && !cashIds.has(occurrence.linkedAccountId)) {
      excluded.push(occurrence);
      continue;
    }
    const pence = toPence(occurrence.amount)!;
    events.push({ date: occurrence.date, kind: 'bill', amount: toPounds(pence), label: occurrence.name, billId: occurrence.billId });
    addDelta(occurrence.date, -pence);
  }

  const { schedule: paySchedule, opts, bankHolidays, annualNetPay } = input.payday;
  const paysSomewhere = paydaysBetween(paySchedule, opts, input.today, isoOfEpochDay(todayDay + PAY_PROBE_DAYS), bankHolidays).length > 0;
  // A share of pay that rounds to nothing is a pay we cannot model, not a pay of zero.
  const share = Number.isFinite(annualNetPay) && annualNetPay > 0 && paysSomewhere
    ? toPence(annualNetPay / paydaysPerYear(paySchedule))
    : undefined;
  const payModelled = share !== undefined && share > 0;
  const payPence = payModelled ? share : 0;
  if (payModelled) {
    const paydays = paydaysBetween(paySchedule, opts, input.today, lastDate, bankHolidays);
    // If a pay-sized credit has arrived since PAY_EARLY_DAYS before the coming payday, that pay is in the
    // balances already. The range is empty until the payday is that close. Only the first payday is checked:
    // a credit can only be early for it.
    const firstDay = paydays.length > 0 ? epochDay(paydays[0]) : undefined;
    const alreadyLanded = firstDay !== undefined
      && payLandedBetween(input.transactions, cashIds, isoOfEpochDay(firstDay - PAY_EARLY_DAYS), input.today, toPounds(payPence));
    for (const date of paydays) {
      if (alreadyLanded && date === paydays[0]) continue;
      events.push({ date, kind: 'pay', amount: toPounds(payPence), label: 'Pay' });
      addDelta(date, payPence);
    }
  }

  events.sort((a, b) => compare(a.date, b.date)
    || (a.kind === b.kind ? 0 : a.kind === 'pay' ? -1 : 1)
    || compare(a.label, b.label) || compare(a.billId ?? '', b.billId ?? ''));

  const points: ForecastPoint[] = [];
  let runningPence = startPence;
  let lowest: ForecastPoint | undefined;
  let firstBelowZero: string | null = null;
  for (let day = todayDay; day <= lastDay; day += 1) {
    runningPence += deltaByDay.get(day) ?? 0;
    const point = { date: isoOfEpochDay(day), balance: toPounds(runningPence) };
    points.push(point);
    // Strictly lower, so a tie keeps the earliest day.
    if (lowest === undefined || point.balance < lowest.balance) lowest = point;
    if (firstBelowZero === null && runningPence < 0) firstBelowZero = point.date;
  }

  return {
    available: true,
    startBalance: toPounds(startPence),
    points,
    events,
    lowest: lowest!,
    firstBelowZero,
    endBalance: points[points.length - 1].balance,
    overdue,
    unplaced,
    excluded,
    payModelled,
    payPerPayday: toPounds(payPence),
  };
};

/**
 * Whether pay has already landed: some ledger row dated within [from, to],
 * inclusive, in one of the cash accounts, is money in of at least half of
 * `expectedPay`. Half, because pay can be split or part-paid, and because a
 * credit that size is hard to mistake for a refund. One row has to reach it;
 * several small credits are not added together. Ledger convention (see
 * cash-flow.ts): amount > 0 is money out, amount < 0 is money in. The caller
 * passes a ledger with confirmed transfers already removed. False when
 * `expectedPay` is zero, negative or not finite (with no pay to expect, nothing
 * has landed), or when the dates are invalid or reversed. Compared in whole pence.
 */
export const payLandedBetween = (
  transactions: readonly MockTransaction[],
  cashAccountIds: ReadonlySet<string>,
  from: string,
  to: string,
  expectedPay: number,
): boolean => {
  const expectedPence = toPence(expectedPay);
  const fromDay = epochDay(from);
  const toDay = epochDay(to);
  if (expectedPence === undefined || expectedPence <= 0 || fromDay === undefined || toDay === undefined) return false;
  return transactions.some(row => {
    const day = epochDay(row.date);
    if (day === undefined || day < fromDay || day > toDay) return false;
    const accountId = row.bankAccountId || row.accountId;
    if (!accountId || !cashAccountIds.has(accountId)) return false;
    // Money moved in from savings before payday is not pay, confirmed or not.
    if (isTransferLike(row)) return false;
    const inPence = toPence(-row.amount);
    // Twice the inflow against the whole figure, so an odd penny rounds up exactly.
    return inPence !== undefined && inPence * 2 >= expectedPence;
  });
};
