/** Recurring-payment suggestions from ledger rows; a person confirms every suggestion. */
import type { MockTransaction, RecurringBill } from '@/features/finance/finance-types';
import { epochDay } from './dates';

export interface RecurringCandidate {
  key: string;
  name: string;
  accountId?: string;
  /** Latest observed outflow, in GBP, following the ledger's positive-spend convention. */
  amount: number;
  frequency: RecurringBill['frequency'];
  lastPaidDate: string;
  /** One deterministic representative per payment date, oldest first. */
  payments: MockTransaction[];
  stale: boolean;
}

const normalizeName = (name: string): string => name.toLowerCase()
  .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const compare = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;

export const recurringPaymentKey = (name: string, accountId?: string): string =>
  JSON.stringify([normalizeName(name), accountId || null]);

export const candidateMatchesBill = (candidate: RecurringCandidate, bill: RecurringBill): boolean => {
  if (bill.detectionKey) return bill.detectionKey === candidate.key;
  if (bill.linkedAccountId && bill.linkedAccountId !== candidate.accountId) return false;
  return [bill.name, bill.provider].some(name => !!name && normalizeName(name) === normalizeName(candidate.name));
};

export const isActiveRecurring = (bill: RecurringBill): boolean => !bill.status || bill.status === 'active';

const MONTHS_PER_PERIOD: Partial<Record<RecurringBill['frequency'], number>> = { monthly: 1, quarterly: 3, annually: 12 };

/** Undefined for weekly bills and for schedules whose fields cannot place a due date. */
const periodSchedule = (bill: RecurringBill): { dueDate: number; dueMonth: number; months: number } | undefined => {
  const months = MONTHS_PER_PERIOD[bill.frequency];
  if (months === undefined) return undefined;
  const { dueDate } = bill;
  if (!Number.isInteger(dueDate) || dueDate < 1 || dueDate > 31) return undefined;
  const dueMonth = bill.dueMonth ?? 1;
  // Monthly bills never read dueMonth, so a stray value there cannot invalidate them.
  if (months > 1 && (!Number.isInteger(dueMonth) || dueMonth < 1 || dueMonth > 12)) return undefined;
  return { dueDate, dueMonth, months };
};

/** Due date in the month at `monthIndex` (year * 12 + zero-based month), clamped to month length. */
const scheduledIso = (monthIndex: number, dueDate: number): string | undefined => {
  const year = Math.floor(monthIndex / 12);
  if (year < 0 || year > 9999) return undefined;
  // setUTCFullYear preserves years 0000-0099, unlike Date.UTC. Day 0 of the next month is this month's last day.
  const date = new Date(0);
  date.setUTCFullYear(year, monthIndex - year * 12 + 1, 0);
  date.setUTCDate(Math.min(dueDate, date.getUTCDate()));
  return date.toISOString().slice(0, 10);
};

/**
 * The scheduled due date (ISO) of the period containing `date`. Monthly uses
 * calendar months; quarterly uses three-month buckets anchored to dueMonth and
 * is due in the bucket's first month; annual cycles start on the most recent
 * clamped due date on or before `date`, else the previous year's. Due days
 * clamp to month length. Weekly bills, invalid dates and invalid schedule
 * fields return undefined.
 */
export const recurringPeriodDue = (bill: RecurringBill, date: string): string | undefined => {
  const day = epochDay(date);
  const schedule = periodSchedule(bill);
  if (day === undefined || !schedule) return undefined;
  const { dueDate, dueMonth, months } = schedule;
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  if (months === 1) return scheduledIso(year * 12 + month - 1, dueDate);
  if (months === 3) {
    const bucket = Math.floor((year * 12 + month - dueMonth) / 3);
    return scheduledIso(bucket * 3 + dueMonth - 1, dueDate);
  }
  const thisYear = scheduledIso(year * 12 + dueMonth - 1, dueDate);
  return thisYear !== undefined && epochDay(thisYear)! <= day
    ? thisYear
    : scheduledIso((year - 1) * 12 + dueMonth - 1, dueDate);
};

/**
 * The due date `periods` periods after `due` (negative = earlier): one month
 * per monthly period, three per quarterly, twelve per annual. The day is
 * re-clamped from bill.dueDate each time, so Jan 31 + 1 is the last day of
 * February and Jan 31 + 2 is Mar 31. Weekly bills and invalid inputs return
 * undefined.
 */
export const shiftPeriodDue = (bill: RecurringBill, due: string, periods: number): string | undefined => {
  const schedule = periodSchedule(bill);
  if (epochDay(due) === undefined || !schedule || !Number.isInteger(periods)) return undefined;
  const index = Number(due.slice(0, 4)) * 12 + Number(due.slice(5, 7)) - 1;
  return scheduledIso(index + schedule.months * periods, schedule.dueDate);
};

/**
 * Which period a payment covers, as that period's scheduled due date. Decided
 * once, when the payment is confirmed, and stored as RecurringBill.paidForDueDate.
 * A payment belongs to the period containing it, late payments included. The
 * one exception is a payment in the seven days before the next period's due
 * date when the current period is already covered by `previousPaidFor`: that
 * is an early payment for the next period. Coverage never moves backwards, so
 * a later `previousPaidFor` wins. An invalid `previousPaidFor` counts as
 * missing. Weekly bills and invalid inputs return undefined.
 */
export const assignPaidPeriod = (
  bill: RecurringBill,
  paymentDate: string,
  previousPaidFor?: string,
): string | undefined => {
  const paymentDay = epochDay(paymentDate);
  const current = recurringPeriodDue(bill, paymentDate);
  if (paymentDay === undefined || current === undefined) return undefined;
  const next = shiftPeriodDue(bill, current, 1);
  const previousDay = previousPaidFor ? epochDay(previousPaidFor) : undefined;
  const nextDay = next === undefined ? undefined : epochDay(next);
  const isEarlyForNext = nextDay !== undefined && previousDay !== undefined
    && paymentDay >= nextDay - 7 && paymentDay < nextDay && previousDay >= epochDay(current)!;
  const assigned = isEarlyForNext ? next! : current;
  return previousDay !== undefined && previousDay > epochDay(assigned)! ? previousPaidFor : assigned;
};

/**
 * The due date of the latest period the owner has confirmed this bill paid
 * for, or undefined when nothing usable is recorded. Monthly, quarterly and
 * annual bills read the stored paidForDueDate; for rows confirmed before that
 * field existed it is the period containing lastPaidDate, with no early
 * credit. Weekly bills have no periods, so coverage is lastPaidDate itself.
 * Invalid dates count as missing.
 */
export const recurringCoverage = (bill: RecurringBill): string | undefined => {
  if (bill.frequency === 'weekly') {
    return bill.lastPaidDate && epochDay(bill.lastPaidDate) !== undefined ? bill.lastPaidDate : undefined;
  }
  if (bill.paidForDueDate && epochDay(bill.paidForDueDate) !== undefined) return bill.paidForDueDate;
  return bill.lastPaidDate ? assignPaidPeriod(bill, bill.lastPaidDate, undefined) : undefined;
};

/**
 * Whether today's period is paid. Weekly uses the last seven calendar dates.
 * Monthly, quarterly and annual bills compare the period the payment covers
 * against today's period (see recurringCoverage). Paid when coverage is not
 * before today's scheduled due date. A late payment for last period therefore
 * never reads as paid for this one.
 */
export const isRecurringPaidForPeriod = (bill: RecurringBill, today: string): boolean => {
  const todayDay = epochDay(today);
  const paidDay = bill.lastPaidDate ? epochDay(bill.lastPaidDate) : undefined;
  if (todayDay === undefined || paidDay === undefined || paidDay > todayDay) return false;
  if (bill.frequency === 'weekly') return todayDay - paidDay <= 6;
  const coverage = recurringCoverage(bill);
  const due = recurringPeriodDue(bill, today);
  if (coverage === undefined || due === undefined) return false;
  return epochDay(coverage)! >= epochDay(due)!;
};

/** The fields a tick, untick or early payment writes; the caller spreads them onto the bill. */
export type PaidFields = Pick<RecurringBill, 'isPaid' | 'lastPaidDate' | 'paidForDueDate'>;

/**
 * Ticking a bill Paid on `today`, starting from a row shown Unpaid. The payment
 * covers the period containing today (a late payment for it included); paying
 * ahead for next period goes through payRecurringEarly, never through a tick.
 * Coverage never moves backwards: a valid stored paidForDueDate that is later
 * than that period is kept. Weekly bills have no periods, so paidForDueDate is
 * undefined.
 */
export const tickRecurring = (bill: RecurringBill, today: string): PaidFields => {
  if (bill.frequency === 'weekly') return { isPaid: true, lastPaidDate: today, paidForDueDate: undefined };
  const own = assignPaidPeriod(bill, today);
  const stored = bill.paidForDueDate && epochDay(bill.paidForDueDate) !== undefined ? bill.paidForDueDate : undefined;
  const keepsStored = own !== undefined && stored !== undefined && epochDay(stored)! > epochDay(own)!;
  return { isPaid: true, lastPaidDate: today, paidForDueDate: keepsStored ? stored : own ?? stored };
};

/**
 * Clearing a tick hands one period of coverage back, counted from
 * recurringCoverage so a row confirmed before paidForDueDate existed is handed
 * back too. lastPaidDate stays, as bank evidence and history are separate from
 * the tick, and the bill remains Paid only when the period before is still
 * enough for `today`: an early payment for next period unticks back to the
 * current one, a normal tick unticks to Unpaid. With no coverage to hand back
 * (no lastPaidDate, or a schedule that cannot place the period) only isPaid
 * clears. Weekly bills have no periods, so only isPaid clears and coverage
 * stays at lastPaidDate: a calendar that reads coverage can still show that
 * week paid. That is a known limit; no weekly bills exist in the live data.
 */
export const untickRecurring = (bill: RecurringBill, today: string): PaidFields => {
  const coverage = bill.frequency === 'weekly' ? undefined : recurringCoverage(bill);
  const handedBack = coverage === undefined ? undefined : shiftPeriodDue(bill, coverage, -1);
  if (handedBack === undefined) {
    return { isPaid: false, lastPaidDate: bill.lastPaidDate, paidForDueDate: bill.paidForDueDate };
  }
  return {
    isPaid: isRecurringPaidForPeriod({ ...bill, paidForDueDate: handedBack }, today),
    lastPaidDate: bill.lastPaidDate,
    paidForDueDate: handedBack,
  };
};

/**
 * The next period's due date when the owner can record paying it early today,
 * else undefined. Needs a non-weekly bill shown Paid (isPaid, as the owner sees
 * it), whose current period coverage reaches, and a today inside the seven-day
 * window assignPaidPeriod already defines. A bill already covered for next
 * period has nothing left to pay early.
 */
export const earlyPaymentTarget = (bill: RecurringBill, today: string): string | undefined => {
  if (bill.frequency === 'weekly' || !bill.isPaid || !isRecurringPaidForPeriod(bill, today)) return undefined;
  const coverage = recurringCoverage(bill);
  const target = coverage === undefined ? undefined : assignPaidPeriod(bill, today, coverage);
  return coverage !== undefined && target !== undefined && epochDay(target)! > epochDay(coverage)!
    ? target
    : undefined;
};

/** Recording today's payment as an early one for next period; undefined when earlyPaymentTarget is. */
export const payRecurringEarly = (bill: RecurringBill, today: string): PaidFields | undefined => {
  const target = earlyPaymentTarget(bill, today);
  return target === undefined ? undefined : { isPaid: true, lastPaidDate: today, paidForDueDate: target };
};

/** Period length order, so a change of frequency can tell whether the new period is longer. */
const PERIOD_RANK: Record<RecurringBill['frequency'], number> = { weekly: 0, monthly: 1, quarterly: 2, annually: 3 };

/**
 * Whether the bill's coverage still includes the period its own last payment
 * falls in, judged from the stored dates alone so it does not change with the
 * day it is asked. False once the tick was cleared (coverage was handed back),
 * and false when no coverage or no period can be placed. A weekly bill has no
 * periods, so the tick itself stands in: its isPaid.
 */
const coversOwnPayment = (bill: RecurringBill): boolean => {
  if (bill.frequency === 'weekly') return bill.isPaid;
  const coverage = recurringCoverage(bill);
  const own = bill.lastPaidDate ? assignPaidPeriod(bill, bill.lastPaidDate) : undefined;
  return coverage !== undefined && own !== undefined && epochDay(coverage)! >= epochDay(own)!;
};

/**
 * The paidForDueDate to store after the schedule or last-paid date is edited.
 * Coverage is the single truth, so what the owner has already confirmed is
 * mapped across rather than re-derived from lastPaidDate, which an untick
 * deliberately leaves in place.
 * - Frequency and lastPaidDate unchanged: the current coverage moves onto the
 *   new schedule as it is. An early payment for next month survives a due-day
 *   change, and an unticked bill stays unpaid.
 * - Same frequency, lastPaidDate corrected: the coverage before this payment is
 *   mapped onto the new schedule and the corrected date is assigned against
 *   it, so it earns exactly the credit it would have earned when paid. That
 *   coverage is one period back while coverage still includes the old payment
 *   (coversOwnPayment), and the coverage itself once the tick was cleared.
 * - Frequency changed: the payment's own period under the new schedule, one
 *   period back (so the bill reads Unpaid) when the new period is longer, or
 *   when the old coverage did not include its own payment. A monthly payment
 *   must not become a whole annual period, and an unticked payment must not
 *   come back. A shorter period keeps the payment's own period.
 * Undefined with no lastPaidDate, for weekly bills and for invalid schedules.
 */
export const coverageAfterEdit = (previous: RecurringBill, next: RecurringBill): string | undefined => {
  if (!next.lastPaidDate || next.frequency === 'weekly') return undefined;
  const own = assignPaidPeriod(next, next.lastPaidDate);
  if (next.frequency !== previous.frequency) {
    const longer = PERIOD_RANK[next.frequency] > PERIOD_RANK[previous.frequency];
    return own !== undefined && (longer || !coversOwnPayment(previous)) ? shiftPeriodDue(next, own, -1) : own;
  }
  const coverage = recurringCoverage(previous);
  if (coverage === undefined) return own;
  if (next.lastPaidDate === previous.lastPaidDate) return recurringPeriodDue(next, coverage);
  const before = coversOwnPayment(previous) ? shiftPeriodDue(previous, coverage, -1) : coverage;
  const mapped = before === undefined ? undefined : recurringPeriodDue(next, before);
  return assignPaidPeriod(next, next.lastPaidDate, mapped);
};

/**
 * A row the app's category or the bank's own label calls a transfer. Neither a
 * bill payment nor pay, even before the owner confirms it as a transfer.
 */
export const isTransferLike = (row: Pick<MockTransaction, 'category' | 'providerCategory'>): boolean =>
  /\b(transfers?|xfer)\b/i.test(`${row.category} ${row.providerCategory ?? ''}`);

const isEligiblePayment = (row: MockTransaction, todayDay: number, excludedIds: ReadonlySet<string>): boolean => {
  const day = epochDay(row.date);
  return day !== undefined && day <= todayDay && !excludedIds.has(row.id)
    && Number.isFinite(row.amount) && row.amount > 0
    && Number.isSafeInteger(Math.round(row.amount * 100)) && Math.round(row.amount * 100) > 0
    && !isTransferLike(row);
};

/** Latest observed matching outflow, even when too few rows remain to infer cadence. */
export const recurringPaymentEvidence = (
  transactions: readonly MockTransaction[],
  bill: RecurringBill,
  today: string,
  excludedIds: ReadonlySet<string> = new Set(),
): MockTransaction | undefined => {
  const todayDay = epochDay(today);
  if (todayDay === undefined) return undefined;
  return transactions.filter(row => {
    if (!isEligiblePayment(row, todayDay, excludedIds)) return false;
    const name = row.merchant?.trim() || row.name.trim();
    if (!normalizeName(name)) return false;
    const accountId = row.bankAccountId || row.accountId;
    if (bill.detectionKey) return bill.detectionKey === recurringPaymentKey(name, accountId);
    if (bill.linkedAccountId && bill.linkedAccountId !== accountId) return false;
    return [bill.name, bill.provider].some(value => !!value && normalizeName(value) === normalizeName(name));
  }).sort((a, b) => compare(b.date, a.date) || compare(a.id, b.id)
    || a.amount - b.amount || compare(a.merchant ?? '', b.merchant ?? '') || compare(a.name, b.name))[0];
};

const cadences: { frequency: RecurringBill['frequency']; min: number; max: number; days: number; support: number }[] = [
  { frequency: 'weekly', min: 5, max: 9, days: 7, support: 3 },
  { frequency: 'monthly', min: 25, max: 35, days: 31, support: 3 },
  { frequency: 'quarterly', min: 80, max: 100, days: 92, support: 3 },
  { frequency: 'annually', min: 350, max: 380, days: 366, support: 2 },
];

/**
 * The caller supplies the GBP ledger (which has no currency field) and transfer
 * exclusions. No amounts are estimated: varying bills use the latest payment.
 * At least 80% of consecutive date gaps must support a cadence. Same-day rows
 * count once; ties use transaction ID, then amount/name to remain input-order independent.
 */
export const detectRecurringPayments = (
  transactions: readonly MockTransaction[],
  today: string,
  excludedIds: ReadonlySet<string> = new Set(),
): RecurringCandidate[] => {
  const todayDay = epochDay(today);
  if (todayDay === undefined) return [];
  const groups = new Map<string, MockTransaction[]>();
  for (const row of transactions) {
    if (!isEligiblePayment(row, todayDay, excludedIds)) continue;
    const name = row.merchant?.trim() || row.name.trim();
    if (!normalizeName(name)) continue;
    const key = recurringPaymentKey(name, row.bankAccountId || row.accountId);
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }

  const candidates: RecurringCandidate[] = [];
  for (const [key, rows] of groups) {
    rows.sort((a, b) => compare(a.date, b.date) || compare(a.id, b.id)
      || a.amount - b.amount || compare(a.merchant ?? '', b.merchant ?? '') || compare(a.name, b.name));
    const payments = rows.filter((row, index) => index === 0 || row.date !== rows[index - 1].date);
    if (payments.length < 2) continue;
    const days = payments.map(row => epochDay(row.date)!);
    const gaps = days.slice(1).map((day, index) => day - days[index]);
    const cadence = cadences.find(({ min, max, support }) => payments.length >= support
      && gaps.filter(gap => gap >= min && gap <= max).length / gaps.length >= 0.8);
    if (!cadence) continue;
    const latest = payments[payments.length - 1];
    candidates.push({
      key,
      name: latest.merchant?.trim() || latest.name.trim(),
      accountId: latest.bankAccountId || latest.accountId,
      amount: Math.round(latest.amount * 100) / 100,
      frequency: cadence.frequency,
      lastPaidDate: latest.date,
      payments,
      stale: todayDay - days[days.length - 1] > cadence.days * 1.5,
    });
  }
  return candidates.sort((a, b) => compare(a.key, b.key));
};
