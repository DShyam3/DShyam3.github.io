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

/**
 * Whether a confirmed payment date belongs to today's period. Monthly uses
 * calendar months; quarterly uses three-month buckets anchored to dueMonth.
 * Both also accept the seven days before that period's clamped scheduled date.
 * Annual cycles start on the most recent clamped due date and allow seven days
 * before that start; weekly uses the last seven calendar dates. Earlier payments
 * cannot be assigned to a later period without an explicit period field.
 */
export const isRecurringPaidForPeriod = (bill: RecurringBill, today: string): boolean => {
  const todayDay = calendarDay(today);
  const paidDay = bill.lastPaidDate ? calendarDay(bill.lastPaidDate) : undefined;
  if (todayDay === undefined || paidDay === undefined || paidDay > todayDay) return false;
  if (bill.frequency === 'weekly') return todayDay - paidDay <= 6;
  const paidDate = bill.lastPaidDate!;
  const currentYear = Number(today.slice(0, 4));
  const currentMonth = Number(today.slice(5, 7));
  if (!Number.isInteger(bill.dueDate) || bill.dueDate < 1 || bill.dueDate > 31) return false;
  const scheduledDay = (year: number, month: number): number => {
    // setUTCFullYear preserves years 0000–0099, unlike Date.UTC.
    const date = new Date(0);
    date.setUTCFullYear(year, month, 0);
    date.setUTCDate(Math.min(bill.dueDate, date.getUTCDate()));
    return date.getTime() / DAY;
  };
  const isEarlyFor = (dueDay: number): boolean => paidDay >= dueDay - 7 && paidDay < dueDay;
  if (bill.frequency === 'monthly') {
    return paidDate.slice(0, 7) === today.slice(0, 7) || isEarlyFor(scheduledDay(currentYear, currentMonth));
  }
  const dueMonth = bill.dueMonth ?? 1;
  if (!Number.isInteger(dueMonth) || dueMonth < 1 || dueMonth > 12) return false;
  if (bill.frequency === 'quarterly') {
    const monthBucket = (date: string): number => Math.floor(
      (Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7)) - dueMonth) / 3,
    );
    const bucket = monthBucket(today);
    const firstMonthIndex = bucket * 3 + dueMonth - 1;
    const dueDay = scheduledDay(Math.floor(firstMonthIndex / 12), firstMonthIndex % 12 + 1);
    return monthBucket(paidDate) === bucket || isEarlyFor(dueDay);
  }
  const thisYearStart = scheduledDay(currentYear, dueMonth);
  const cycleStart = thisYearStart <= todayDay ? thisYearStart : scheduledDay(currentYear - 1, dueMonth);
  return paidDay >= cycleStart - 7;
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
