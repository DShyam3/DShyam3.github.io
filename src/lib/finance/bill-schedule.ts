/**
 * Where recurring bills fall on the calendar, and what state each date is in.
 * Pure: rows in, dates out. The balance forecast (balance-forecast.ts) and the
 * upcoming-bills calendar both read this, so they cannot disagree about whether
 * a bill is still to be paid.
 */
import type { RecurringBill } from '@/features/finance/finance-types';
import { epochDay, isoOfEpochDay } from './dates';
import { isActiveRecurring, recurringCoverage, recurringPeriodDue, shiftPeriodDue } from './recurring-detection';

export type BillOccurrenceStatus = 'paid' | 'seen' | 'overdue' | 'due';

export interface BillOccurrence {
  billId: string;
  name: string;
  /** The bill's amount as stored, in GBP: positive is money out. */
  amount: number;
  /** The scheduled due date, YYYY-MM-DD. */
  date: string;
  /**
   * paid: the owner has confirmed this period paid. seen: a matching bank
   * payment settles it. overdue: unpaid and before today. due: unpaid, today or later.
   */
  status: BillOccurrenceStatus;
  linkedAccountId?: string;
  emoji?: string;
  provider?: string;
  category?: string;
}

/** Nothing earlier than 0000-01-01 is a valid YYYY-MM-DD. */
const FIRST_DAY = epochDay('0000-01-01')!;
/**
 * A payment settles the date it is up to this many days before, and the dates
 * after it up to the next date's window: seven for a monthly, quarterly or
 * annual bill (the early-payment window in assignPaidPeriod), three for a
 * weekly one, since seven would swallow the whole period.
 */
const earlyDays = (bill: RecurringBill): number => bill.frequency === 'weekly' ? 3 : 7;
/** Long enough to reach back one annual period from any date. */
const LOOK_BACK_DAYS = 400;

const compare = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;

/** The day a weekly bill's seven-day cycle counts from: the latest bank payment, else the owner's last tick. */
const weeklyAnchor = (bill: RecurringBill, latestPayment?: string): number | undefined =>
  (latestPayment ? epochDay(latestPayment) : undefined) ?? (bill.lastPaidDate ? epochDay(bill.lastPaidDate) : undefined);

/**
 * The bill's scheduled due dates within [from, to], inclusive and ascending.
 * Monthly, quarterly and annual bills use their period due dates, which clamp
 * to month length (a 31st falls on 28 or 29 February, and on the 30th in
 * 30-day months). Weekly bills repeat every seven days, in both directions,
 * from `latestPayment` when one is given and valid, else from lastPaidDate:
 * a tick records the day it was made, a bank payment the day it was taken, and
 * the bank's day is the one the next debit falls on. The caller checks that
 * `latestPayment` is not in the future. Invalid dates, a reversed range and
 * schedule fields that cannot place a date give [].
 */
export const billOccurrences = (bill: RecurringBill, from: string, to: string, latestPayment?: string): string[] => {
  const fromDay = epochDay(from);
  const toDay = epochDay(to);
  if (fromDay === undefined || toDay === undefined || fromDay > toDay) return [];

  if (bill.frequency === 'weekly') {
    const anchor = weeklyAnchor(bill, latestPayment);
    if (anchor === undefined) return [];
    const dates: string[] = [];
    for (let day = anchor + Math.ceil((fromDay - anchor) / 7) * 7; day <= toDay; day += 7) dates.push(isoOfEpochDay(day));
    return dates;
  }

  const base = recurringPeriodDue(bill, from);
  if (base === undefined) return [];
  const dates: string[] = [];
  // shiftPeriodDue returns undefined past year 9999, which ends the loop.
  for (let periods = 0; ; periods += 1) {
    const due = shiftPeriodDue(bill, base, periods);
    if (due === undefined || due > to) break;
    // The period containing `from` can be due before it.
    if (due >= from) dates.push(due);
  }
  return dates;
};

/** Whether the schedule can place any date at all, given the weekly anchor `latestPayment` would give. */
const isPlaceable = (bill: RecurringBill, from: string, latestPayment?: string): boolean =>
  bill.frequency === 'weekly' ? weeklyAnchor(bill, latestPayment) !== undefined : recurringPeriodDue(bill, from) !== undefined;

const toOccurrence = (bill: RecurringBill, date: string, status: BillOccurrenceStatus): BillOccurrence => {
  const occurrence: BillOccurrence = { billId: bill.id, name: bill.name, amount: bill.amount, date, status };
  if (bill.linkedAccountId) occurrence.linkedAccountId = bill.linkedAccountId;
  if (bill.emoji) occurrence.emoji = bill.emoji;
  if (bill.provider) occurrence.provider = bill.provider;
  if (bill.category) occurrence.category = bill.category;
  return occurrence;
};

/**
 * Every active bill's occurrences in [from, to], each with a status, sorted by
 * date, then name, then bill id. Inactive and dismissed bills are ignored.
 * Bills that cannot be placed (a weekly bill with neither a bank payment nor a
 * tick to count from, or schedule fields that give no date) are returned once
 * each in `unplaced` instead.
 *
 * Status, in this order:
 *  - paid: the date is not after the bill's confirmed coverage (recurringCoverage).
 *  - seen: bank evidence settles it. `evidence` maps bill id to the date of the
 *    latest matching bank payment (the caller builds it from
 *    recurringPaymentEvidence). A payment settles the one date whose window
 *    holds it: from `early` days before that date up to `early` days before the
 *    next one (`early` is seven days, three for a weekly bill). If coverage
 *    already pays that date, the payment settles nothing. Which date that is
 *    depends only on the bill, its coverage and the payment, never on `from`,
 *    so a calendar and a forecast looking at different ranges agree. A payment
 *    dated after `today`, or on or before the bill's lastPaidDate (the payment
 *    the owner already ticked), settles nothing. Known limit: a payment for a
 *    missed date that arrives within `early` days of the next date reads as
 *    that next date paid early, so the next date is not subtracted and the
 *    missed one is listed as not confirmed. Settling the older date instead
 *    would double-count every bill debited a day before its due date while
 *    the previous one is unticked, which is the common case.
 *  - overdue: before today.
 *  - due: today or later.
 * Invalid `from`, `to` or `today`, or from after to, give no results.
 */
export const scheduleBills = (
  bills: readonly RecurringBill[],
  from: string,
  to: string,
  today: string,
  evidence: ReadonlyMap<string, string> = new Map(),
): { occurrences: BillOccurrence[]; unplaced: RecurringBill[] } => {
  const fromDay = epochDay(from);
  const todayDay = epochDay(today);
  const toDay = epochDay(to);
  const occurrences: BillOccurrence[] = [];
  const unplaced: RecurringBill[] = [];
  if (fromDay === undefined || toDay === undefined || todayDay === undefined || fromDay > toDay) {
    return { occurrences, unplaced };
  }

  for (const bill of bills) {
    if (!isActiveRecurring(bill)) continue;

    // The latest bank payment that has happened. A weekly bill's dates count from it.
    const rawPayment = evidence.get(bill.id);
    const paymentDay = rawPayment === undefined ? undefined : epochDay(rawPayment);
    const payment = paymentDay !== undefined && paymentDay <= todayDay ? rawPayment : undefined;
    if (!isPlaceable(bill, from, payment)) { unplaced.push(bill); continue; }

    const coverage = recurringCoverage(bill);
    const coverageDay = coverage === undefined ? undefined : epochDay(coverage);
    const isPaid = (date: string): boolean => coverageDay !== undefined && epochDay(date)! <= coverageDay;

    // The payment the owner ticked is already in the coverage; counting it again would settle the next date too.
    const confirmedDay = bill.lastPaidDate ? epochDay(bill.lastPaidDate) : undefined;
    let settled: string | undefined;
    if (payment !== undefined && (confirmedDay === undefined || paymentDay! > confirmedDay)) {
      const reach = paymentDay! + earlyDays(bill);
      const candidates = billOccurrences(
        bill, isoOfEpochDay(Math.max(FIRST_DAY, reach - LOOK_BACK_DAYS)), isoOfEpochDay(reach), payment,
      );
      // A date coverage already pays stays paid (checked first below), so a payment that belongs to one settles nothing.
      settled = candidates[candidates.length - 1];
    }

    for (const date of billOccurrences(bill, from, to, payment)) {
      const status: BillOccurrenceStatus = isPaid(date) ? 'paid'
        : date === settled ? 'seen'
        : epochDay(date)! < todayDay ? 'overdue'
        : 'due';
      occurrences.push(toOccurrence(bill, date, status));
    }
  }

  occurrences.sort((a, b) => compare(a.date, b.date) || compare(a.name, b.name) || compare(a.billId, b.billId));
  return { occurrences, unplaced };
};

/**
 * What a set of occurrences adds up to: `scheduled` is all of them, `outstanding`
 * the part not yet settled (due or overdue). Summed in whole pence so 0.1 + 0.2
 * is exactly 0.3; an amount that is not a usable figure is left out of both.
 */
export const occurrenceTotals = (occurrences: readonly BillOccurrence[]): { scheduled: number; outstanding: number } => {
  let scheduled = 0;
  let outstanding = 0;
  for (const occurrence of occurrences) {
    const pence = Math.round(occurrence.amount * 100);
    if (!Number.isSafeInteger(pence)) continue;
    scheduled += pence;
    if (occurrence.status === 'due' || occurrence.status === 'overdue') outstanding += pence;
  }
  // `+ 0` turns a -0 into 0.
  return { scheduled: scheduled / 100 + 0, outstanding: outstanding / 100 + 0 };
};
