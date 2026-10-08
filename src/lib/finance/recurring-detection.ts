/** Recurring-payment suggestions from ledger rows; a person confirms every suggestion. */
import type { MockTransaction, RecurringBill } from '@/features/finance/finance-types';

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

const DAY = 86_400_000;
const normalizeName = (name: string): string => name.toLowerCase()
  .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const compare = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;

const calendarDay = (value: string): number | undefined => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const time = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== value) return undefined;
  return time / DAY;
};

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
  const day = calendarDay(date);
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
  return thisYear !== undefined && calendarDay(thisYear)! <= day
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
  if (calendarDay(due) === undefined || !schedule || !Number.isInteger(periods)) return undefined;
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
  const paymentDay = calendarDay(paymentDate);
  const current = recurringPeriodDue(bill, paymentDate);
  if (paymentDay === undefined || current === undefined) return undefined;
  const next = shiftPeriodDue(bill, current, 1);
  const previousDay = previousPaidFor ? calendarDay(previousPaidFor) : undefined;
  const nextDay = next === undefined ? undefined : calendarDay(next);
  const isEarlyForNext = nextDay !== undefined && previousDay !== undefined
    && paymentDay >= nextDay - 7 && paymentDay < nextDay && previousDay >= calendarDay(current)!;
  const assigned = isEarlyForNext ? next! : current;
  return previousDay !== undefined && previousDay > calendarDay(assigned)! ? previousPaidFor : assigned;
};

/**
 * Whether today's period is paid. Weekly uses the last seven calendar dates.
 * Monthly, quarterly and annual bills compare the period the payment covers
 * against today's period: coverage is the stored paidForDueDate, or for rows
 * confirmed before that field existed, the period containing lastPaidDate with
 * no early credit. Paid when coverage is not before today's scheduled due date.
 * A late payment for last period therefore never reads as paid for this one.
 */
export const isRecurringPaidForPeriod = (bill: RecurringBill, today: string): boolean => {
  const todayDay = calendarDay(today);
  const paidDay = bill.lastPaidDate ? calendarDay(bill.lastPaidDate) : undefined;
  if (todayDay === undefined || paidDay === undefined || paidDay > todayDay) return false;
  if (bill.frequency === 'weekly') return todayDay - paidDay <= 6;
  const coverage = bill.paidForDueDate && calendarDay(bill.paidForDueDate) !== undefined
    ? bill.paidForDueDate
    : assignPaidPeriod(bill, bill.lastPaidDate!, undefined);
  const due = recurringPeriodDue(bill, today);
  if (coverage === undefined || due === undefined) return false;
  return calendarDay(coverage)! >= calendarDay(due)!;
};

const isEligiblePayment = (row: MockTransaction, todayDay: number, excludedIds: ReadonlySet<string>): boolean => {
  const day = calendarDay(row.date);
  return day !== undefined && day <= todayDay && !excludedIds.has(row.id)
    && Number.isFinite(row.amount) && row.amount > 0
    && Number.isSafeInteger(Math.round(row.amount * 100)) && Math.round(row.amount * 100) > 0
    && !/\b(transfers?|xfer)\b/i.test(`${row.category} ${row.providerCategory ?? ''}`);
};

/** Latest observed matching outflow, even when too few rows remain to infer cadence. */
export const recurringPaymentEvidence = (
  transactions: readonly MockTransaction[],
  bill: RecurringBill,
  today: string,
  excludedIds: ReadonlySet<string> = new Set(),
): MockTransaction | undefined => {
  const todayDay = calendarDay(today);
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
  const todayDay = calendarDay(today);
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
    const days = payments.map(row => calendarDay(row.date)!);
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
