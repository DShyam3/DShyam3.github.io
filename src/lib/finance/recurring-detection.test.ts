import { describe, expect, it } from 'vitest';
import type { MockTransaction, RecurringBill } from '@/features/finance/finance-types';
import {
  assignPaidPeriod, candidateMatchesBill, detectRecurringPayments, isActiveRecurring, isRecurringPaidForPeriod,
  recurringPaymentEvidence, recurringPaymentKey, recurringPeriodDue, shiftPeriodDue,
} from './recurring-detection';

const tx = (date: string, overrides: Partial<MockTransaction> = {}): MockTransaction => ({
  id: date, name: 'Example Plus', category: 'Subscriptions', amount: 9.99,
  date, isReviewed: false, accountId: 'current', ...overrides,
});
const monthly = () => ['2026-01-31', '2026-02-28', '2026-03-31'].map(date => tx(date));
const bill = (overrides: Partial<RecurringBill> = {}): RecurringBill => ({
  id: 'bill', name: 'Example Plus', amount: 9.99, dueDate: 31, isPaid: false, frequency: 'monthly', ...overrides,
});
const detect = (rows: MockTransaction[]) => detectRecurringPayments(rows, '2026-04-06');

describe('detectRecurringPayments', () => {
  it('returns no suggestions for empty input, a single row, or only two monthly payments', () => {
    expect(detect([])).toEqual([]);
    expect(detect([tx('2026-03-31')])).toEqual([]);
    expect(detect(monthly().slice(0, 2))).toEqual([]);
  });
  it('detects monthly ends across February and the tax-year boundary', () => {
    const result = detect(monthly());
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ frequency: 'monthly', amount: 9.99, lastPaidDate: '2026-03-31', stale: false });
  });
  it('allows monthly weekend posting shifts', () => {
    expect(detect(['2026-01-02', '2026-02-02', '2026-03-03'].map(date => tx(date)))[0].frequency).toBe('monthly');
  });
  it('detects weekly cadence through the UK daylight-saving boundary', () => {
    expect(detect(['2026-03-22', '2026-03-29', '2026-04-05'].map(date => tx(date)))[0].frequency).toBe('weekly');
  });
  it('detects quarterly payments over a year boundary', () => {
    expect(detect(['2025-09-30', '2025-12-31', '2026-03-31'].map(date => tx(date)))[0].frequency).toBe('quarterly');
  });
  it('detects annual payments from two observations across a leap year', () => {
    expect(detect(['2024-02-29', '2025-02-28'].map(date => tx(date)))[0]).toMatchObject({ frequency: 'annually', stale: false });
  });
  it('rejects irregular shopping even when every amount is identical', () => {
    expect(detect(['2026-01-01', '2026-01-05', '2026-02-01', '2026-03-01'].map(date => tx(date)))).toEqual([]);
  });
  it('requires at least eighty percent of consecutive gaps to support the cadence', () => {
    const rows = ['2025-10-01', '2025-11-01', '2025-12-01', '2026-01-01', '2026-02-01', '2026-02-10'].map(date => tx(date));
    expect(detect(rows)).toHaveLength(1);
    expect(detect(rows.slice(1))).toEqual([]);
  });
  it('allows variable amounts and uses latest observed positive spend rounded to pence', () => {
    const rows = monthly(); rows[0].amount = 1; rows[2].amount = 15.239;
    expect(detect(rows)[0].amount).toBe(15.24);
  });
  it('excludes refunds, zero, nonfinite and amounts too large for exact pence', () => {
    for (const amount of [-9.99, 0, NaN, Infinity, Number.MAX_VALUE]) {
      expect(detect(monthly().map(row => ({ ...row, amount })))).toEqual([]);
    }
  });
  it('excludes transfer IDs, categories and bank classifications', () => {
    expect(detectRecurringPayments(monthly(), '2026-04-06', new Set(['2026-02-28']))).toEqual([]);
    expect(detect(monthly().map(row => ({ ...row, category: 'Transfers' })))).toEqual([]);
    expect(detect(monthly().map(row => ({ ...row, providerCategory: 'transfer' })))).toEqual([]);
  });
  it('does not inflate support with same-day duplicates and selects ties deterministically', () => {
    const rows = monthly().slice(0, 2);
    expect(detect([...rows, { ...rows[1], id: 'duplicate' }])).toEqual([]);
    const full = [...monthly(), tx('2026-03-31', { id: 'z', amount: 20 })];
    expect(detect(full)).toEqual(detect([...full].reverse()));
    expect(detect(full)[0].payments).toHaveLength(3);
    expect(detect(full)[0].amount).toBe(9.99);
  });
  it('separates accounts and preserves distinct merchant words and numbers', () => {
    const rows = monthly();
    const other = rows.map(row => ({ ...row, bankAccountId: 'other', id: `other-${row.id}` }));
    expect(detect([...rows, ...other])).toHaveLength(2);
    expect(detect(rows.map((row, index) => ({ ...row, merchant: `Shop ${index}` })))).toEqual([]);
  });
  it('uses bank merchant before edited names and normalizes punctuation, whitespace and case', () => {
    const rows = monthly().map((row, index) => ({ ...row, name: `edited ${index}`, merchant: ['EXAMPLE-PLUS', 'example  plus', 'Example Plus'][index] }));
    expect(detect(rows)).toHaveLength(1);
    expect(recurringPaymentKey(' EXAMPLE-Plus ', 'current')).toBe(recurringPaymentKey('example plus', 'current'));
  });
  it('keeps old patterns explicitly stale', () => {
    expect(detectRecurringPayments(monthly(), '2026-05-17')[0].stale).toBe(true);
    expect(detectRecurringPayments(monthly(), '2026-05-16')[0].stale).toBe(false);
  });
  it('rejects invalid calendar dates, timestamps, future rows and invalid today', () => {
    for (const date of ['2026-02-30', '2026-13-01', '2026-03-31T23:00:00Z', '2026-05-01', 'not a date']) {
      const rows = monthly(); rows[2].date = date;
      expect(detect(rows)).toEqual([]);
    }
    expect(detectRecurringPayments(monthly(), '2026-02-30')).toEqual([]);
  });
  it('returns stable candidate order independently of input order without mutating rows', () => {
    const rows = [...monthly(), ...monthly().map(row => ({ ...row, name: 'Another vendor', id: `a-${row.id}` }))];
    const before = [...rows];
    expect(detect(rows)).toEqual(detect([...rows].reverse()));
    expect(rows).toEqual(before);
  });
});

describe('candidateMatchesBill', () => {
  const candidate = detect(monthly())[0];
  it('matches exact saved detection keys and rejects different keys', () => {
    expect(candidateMatchesBill(candidate, bill({ name: 'renamed', detectionKey: candidate.key }))).toBe(true);
    expect(candidateMatchesBill(candidate, bill({ detectionKey: 'different' }))).toBe(false);
  });
  it('matches manual names or providers conservatively with account scoping', () => {
    expect(candidateMatchesBill(candidate, bill())).toBe(true);
    expect(candidateMatchesBill(candidate, bill({ name: 'Broadband', provider: 'Example Plus' }))).toBe(true);
    expect(candidateMatchesBill(candidate, bill({ linkedAccountId: 'other' }))).toBe(false);
    expect(candidateMatchesBill(candidate, bill({ name: 'Example' }))).toBe(false);
  });
});

describe('recurringPaymentEvidence', () => {
  it('finds the latest valid outgoing even without enough rows for a cadence', () => {
    expect(recurringPaymentEvidence(monthly().slice(2), bill(), '2026-04-06')?.date).toBe('2026-03-31');
    expect(recurringPaymentEvidence([], bill(), '2026-04-06')).toBeUndefined();
  });
  it('does not replace manual confirmation dates with invented bank evidence', () => {
    expect(recurringPaymentEvidence([], bill({ lastPaidDate: '2026-03-31' }), '2026-04-06')).toBeUndefined();
  });
  it('honors detection keys, account, exclusions, invalid dates and refund signs', () => {
    expect(recurringPaymentEvidence(monthly(), bill({ detectionKey: 'other' }), '2026-04-06')).toBeUndefined();
    expect(recurringPaymentEvidence(monthly(), bill({ linkedAccountId: 'other' }), '2026-04-06')).toBeUndefined();
    expect(recurringPaymentEvidence(monthly(), bill(), '2026-04-06', new Set(monthly().map(row => row.id)))).toBeUndefined();
    expect(recurringPaymentEvidence([tx('2026-03-31', { amount: -9.99 })], bill(), '2026-04-06')).toBeUndefined();
    expect(recurringPaymentEvidence(monthly(), bill(), 'bad')).toBeUndefined();
  });
});

describe('isActiveRecurring', () => {
  it('treats legacy bills and active bills as active, excluding dismissed and inactive bills', () => {
    expect(isActiveRecurring(bill())).toBe(true);
    expect(isActiveRecurring(bill({ status: 'active' }))).toBe(true);
    expect(isActiveRecurring(bill({ status: 'inactive' }))).toBe(false);
    expect(isActiveRecurring(bill({ status: 'dismissed' }))).toBe(false);
  });
});


describe('isRecurringPaidForPeriod', () => {
  it('rejects missing, invalid and future payment dates and invalid today', () => {
    expect(isRecurringPaidForPeriod(bill(), '2026-04-06')).toBe(false);
    for (const lastPaidDate of ['2026-02-30', '2026-04-07', '2026-04-06T00:00:00Z']) {
      expect(isRecurringPaidForPeriod(bill({ lastPaidDate }), '2026-04-06')).toBe(false);
    }
    expect(isRecurringPaidForPeriod(bill({ lastPaidDate: '2026-04-06' }), 'bad')).toBe(false);
  });
  it('rolls monthly confirmations over at the calendar month and year boundary', () => {
    const paid = bill({ lastPaidDate: '2025-12-31' });
    expect(isRecurringPaidForPeriod(paid, '2025-12-31')).toBe(true);
    expect(isRecurringPaidForPeriod(paid, '2026-01-01')).toBe(false);
    expect(isRecurringPaidForPeriod(bill({ lastPaidDate: '2026-04-01' }), '2026-04-30')).toBe(true);
  });
  it('uses six elapsed UTC days for weekly payments through daylight-saving changes', () => {
    const paid = bill({ frequency: 'weekly', lastPaidDate: '2026-03-29' });
    expect(isRecurringPaidForPeriod(paid, '2026-04-04')).toBe(true);
    expect(isRecurringPaidForPeriod(paid, '2026-04-05')).toBe(false);
  });
  it('anchors quarterly month buckets to dueMonth across December and January', () => {
    const paid = bill({ frequency: 'quarterly', dueMonth: 11, lastPaidDate: '2025-11-30' });
    expect(isRecurringPaidForPeriod(paid, '2026-01-31')).toBe(true);
    expect(isRecurringPaidForPeriod(paid, '2026-02-01')).toBe(false);
    expect(isRecurringPaidForPeriod(bill({ frequency: 'quarterly', lastPaidDate: '2026-03-31' }), '2026-04-01')).toBe(false);
  });
  it('keeps annual confirmation until the next scheduled anniversary across calendar years', () => {
    const paid = bill({ frequency: 'annually', dueMonth: 6, dueDate: 15, lastPaidDate: '2025-06-15' });
    expect(isRecurringPaidForPeriod(paid, '2026-01-01')).toBe(true);
    expect(isRecurringPaidForPeriod(paid, '2026-06-14')).toBe(true);
    expect(isRecurringPaidForPeriod(paid, '2026-06-15')).toBe(false);
    expect(isRecurringPaidForPeriod({ ...paid, lastPaidDate: '2026-06-15' }, '2026-06-15')).toBe(true);
  });
  it('clamps annual scheduled dates to month end including February leap years', () => {
    const paid = bill({ frequency: 'annually', dueMonth: 2, dueDate: 29, lastPaidDate: '2024-02-29' });
    expect(isRecurringPaidForPeriod(paid, '2025-02-27')).toBe(true);
    expect(isRecurringPaidForPeriod(paid, '2025-02-28')).toBe(false);
    expect(isRecurringPaidForPeriod({ ...paid, lastPaidDate: '2025-02-28' }, '2025-02-28')).toBe(true);
  });
  it('credits a payment up to seven days early into a January monthly period only when its period is stored', () => {
    const early = bill({ dueDate: 1, lastPaidDate: '2025-12-31', paidForDueDate: '2026-01-01' });
    expect(isRecurringPaidForPeriod(early, '2026-01-01')).toBe(true);
    expect(isRecurringPaidForPeriod(early, '2026-01-31')).toBe(true);
    expect(isRecurringPaidForPeriod(early, '2026-02-01')).toBe(false);
    // Legacy rows have no stored period, so the same dates earn no early credit.
    const legacy = bill({ dueDate: 1, lastPaidDate: '2025-12-31' });
    expect(isRecurringPaidForPeriod(legacy, '2025-12-31')).toBe(true);
    expect(isRecurringPaidForPeriod(legacy, '2026-01-01')).toBe(false);
    expect(isRecurringPaidForPeriod({ ...legacy, lastPaidDate: '2025-12-25' }, '2026-01-01')).toBe(false);
    expect(isRecurringPaidForPeriod({ ...legacy, lastPaidDate: '2025-12-24' }, '2026-01-01')).toBe(false);
  });
  it('carries early annual payments across the anniversary when the covered period is stored', () => {
    const paid = bill({ frequency: 'annually', dueMonth: 6, dueDate: 15, lastPaidDate: '2026-06-14', paidForDueDate: '2026-06-15' });
    expect(isRecurringPaidForPeriod(paid, '2026-06-14')).toBe(true);
    expect(isRecurringPaidForPeriod(paid, '2026-06-15')).toBe(true);
    expect(isRecurringPaidForPeriod(paid, '2027-06-14')).toBe(true);
    expect(isRecurringPaidForPeriod(paid, '2027-06-15')).toBe(false);
    const legacy = { ...paid, paidForDueDate: undefined };
    expect(isRecurringPaidForPeriod(legacy, '2026-06-15')).toBe(false);
    expect(isRecurringPaidForPeriod({ ...legacy, lastPaidDate: '2026-06-08' }, '2026-06-15')).toBe(false);
    expect(isRecurringPaidForPeriod({ ...legacy, lastPaidDate: '2026-06-07' }, '2026-06-15')).toBe(false);
  });
  it('carries early quarterly payments across the anchored quarter boundary when the covered period is stored', () => {
    const paid = bill({ frequency: 'quarterly', dueMonth: 2, dueDate: 1, lastPaidDate: '2026-01-31', paidForDueDate: '2026-02-01' });
    expect(isRecurringPaidForPeriod(paid, '2026-02-01')).toBe(true);
    expect(isRecurringPaidForPeriod(paid, '2026-04-30')).toBe(true);
    expect(isRecurringPaidForPeriod(paid, '2026-05-01')).toBe(false);
    const legacy = { ...paid, paidForDueDate: undefined };
    expect(isRecurringPaidForPeriod(legacy, '2026-02-01')).toBe(false);
    expect(isRecurringPaidForPeriod(legacy, '2026-04-30')).toBe(false);
    expect(isRecurringPaidForPeriod({ ...legacy, lastPaidDate: '2026-01-24' }, '2026-02-01')).toBe(false);
  });
  it('defaults annual dueMonth to January and rejects invalid schedule fields', () => {
    expect(isRecurringPaidForPeriod(bill({ frequency: 'annually', dueDate: 1, lastPaidDate: '2026-01-01' }), '2026-12-31')).toBe(true);
    for (const dueMonth of [0, 13, 1.5, NaN]) {
      expect(isRecurringPaidForPeriod(bill({ frequency: 'quarterly', dueMonth, lastPaidDate: '2026-04-01' }), '2026-04-06')).toBe(false);
    }
    expect(isRecurringPaidForPeriod(bill({ frequency: 'annually', dueDate: -1, lastPaidDate: '2026-01-01' }), '2026-04-06')).toBe(false);
  });
});

describe('late payment for the previous period (monthly, due the 3rd)', () => {
  const due3 = (overrides: Partial<RecurringBill> = {}) => bill({ dueDate: 3, ...overrides });
  it('assigns a late September payment to September, not October', () => {
    expect(assignPaidPeriod(due3(), '2026-09-28', '2026-08-03')).toBe('2026-09-03');
    const paid = due3({ lastPaidDate: '2026-09-28', paidForDueDate: '2026-09-03' });
    expect(isRecurringPaidForPeriod(paid, '2026-09-30')).toBe(true);
    expect(isRecurringPaidForPeriod(paid, '2026-10-01')).toBe(false);
    expect(isRecurringPaidForPeriod(paid, '2026-10-15')).toBe(false);
  });
  it('gives a legacy row without paidForDueDate no early credit, so the same late payment is not paid in October', () => {
    const legacy = due3({ lastPaidDate: '2026-09-28' });
    expect(isRecurringPaidForPeriod(legacy, '2026-09-30')).toBe(true);
    expect(isRecurringPaidForPeriod(legacy, '2026-10-01')).toBe(false);
    expect(isRecurringPaidForPeriod(legacy, '2026-10-15')).toBe(false);
  });
  it('assigns the next period only to an early payment when the current period is already covered', () => {
    expect(assignPaidPeriod(due3(), '2026-09-28', '2026-09-03')).toBe('2026-10-03');
    const paid = due3({ lastPaidDate: '2026-09-28', paidForDueDate: '2026-10-03' });
    expect(isRecurringPaidForPeriod(paid, '2026-09-28')).toBe(true);
    expect(isRecurringPaidForPeriod(paid, '2026-10-02')).toBe(true);
    expect(isRecurringPaidForPeriod(paid, '2026-10-15')).toBe(true);
    expect(isRecurringPaidForPeriod(paid, '2026-11-05')).toBe(false);
  });
  it('keeps a second payment outside the seven-day window in the current period', () => {
    expect(assignPaidPeriod(due3(), '2026-09-20', '2026-09-03')).toBe('2026-09-03');
    expect(assignPaidPeriod(due3(), '2026-09-25', '2026-09-03')).toBe('2026-09-03');
    expect(assignPaidPeriod(due3(), '2026-09-26', '2026-09-03')).toBe('2026-10-03');
    expect(assignPaidPeriod(due3(), '2026-10-02', '2026-09-03')).toBe('2026-10-03');
  });
  it('treats a payment on the due date itself as that period and never as early', () => {
    expect(assignPaidPeriod(due3(), '2026-10-03', '2026-09-03')).toBe('2026-10-03');
    expect(assignPaidPeriod(due3(), '2026-10-03')).toBe('2026-10-03');
  });
  it('gives no early credit without a previous coverage', () => {
    expect(assignPaidPeriod(due3(), '2026-09-28')).toBe('2026-09-03');
    expect(assignPaidPeriod(due3(), '2026-09-28', undefined)).toBe('2026-09-03');
  });
  it('counts an early payment across the UK tax-year and daylight-saving boundaries', () => {
    expect(assignPaidPeriod(bill({ dueDate: 5 }), '2026-03-30', '2026-03-05')).toBe('2026-04-05');
    expect(assignPaidPeriod(bill({ dueDate: 1 }), '2026-03-25', '2026-03-01')).toBe('2026-04-01');
    expect(assignPaidPeriod(bill({ dueDate: 1 }), '2026-03-24', '2026-03-01')).toBe('2026-03-01');
  });
});

describe('recurringPeriodDue and shiftPeriodDue', () => {
  const due31 = bill({ dueDate: 31 });
  it('clamps a monthly 31st to the month length through leap and non-leap February', () => {
    expect(recurringPeriodDue(due31, '2026-01-10')).toBe('2026-01-31');
    expect(recurringPeriodDue(due31, '2026-02-10')).toBe('2026-02-28');
    expect(recurringPeriodDue(due31, '2028-02-10')).toBe('2028-02-29');
    expect(recurringPeriodDue(due31, '2100-02-10')).toBe('2100-02-28');
    expect(recurringPeriodDue(due31, '2026-03-05')).toBe('2026-03-31');
    expect(recurringPeriodDue(due31, '2026-04-30')).toBe('2026-04-30');
  });
  it('re-clamps from dueDate on every shift, forward and back', () => {
    expect(shiftPeriodDue(due31, '2026-01-31', 1)).toBe('2026-02-28');
    expect(shiftPeriodDue(due31, '2026-01-31', 2)).toBe('2026-03-31');
    expect(shiftPeriodDue(due31, '2028-01-31', 1)).toBe('2028-02-29');
    expect(shiftPeriodDue(due31, '2026-02-28', 1)).toBe('2026-03-31');
    expect(shiftPeriodDue(due31, '2026-03-31', -1)).toBe('2026-02-28');
    expect(shiftPeriodDue(due31, '2026-03-31', -2)).toBe('2026-01-31');
    expect(shiftPeriodDue(due31, '2026-02-28', 0)).toBe('2026-02-28');
    expect(shiftPeriodDue(due31, '2026-01-31', 12)).toBe('2027-01-31');
  });
  it('moves monthly Dec to Jan and back across the year boundary', () => {
    const due3 = bill({ dueDate: 3 });
    expect(recurringPeriodDue(due3, '2026-12-31')).toBe('2026-12-03');
    expect(recurringPeriodDue(due3, '2027-01-01')).toBe('2027-01-03');
    expect(shiftPeriodDue(due3, '2026-12-03', 1)).toBe('2027-01-03');
    expect(shiftPeriodDue(due3, '2027-01-03', -1)).toBe('2026-12-03');
    expect(assignPaidPeriod(due3, '2026-12-28', '2026-12-03')).toBe('2027-01-03');
    expect(assignPaidPeriod(due3, '2027-01-01', '2026-12-03')).toBe('2027-01-03');
  });
  it('anchors quarterly buckets to dueMonth across the year boundary', () => {
    const quarterly = bill({ frequency: 'quarterly', dueMonth: 11, dueDate: 3 });
    expect(recurringPeriodDue(quarterly, '2025-11-03')).toBe('2025-11-03');
    expect(recurringPeriodDue(quarterly, '2025-12-31')).toBe('2025-11-03');
    expect(recurringPeriodDue(quarterly, '2026-01-20')).toBe('2025-11-03');
    expect(recurringPeriodDue(quarterly, '2026-02-01')).toBe('2026-02-03');
    expect(recurringPeriodDue(quarterly, '2026-10-31')).toBe('2026-08-03');
    expect(recurringPeriodDue(quarterly, '2026-11-01')).toBe('2026-11-03');
    expect(shiftPeriodDue(quarterly, '2025-11-03', 1)).toBe('2026-02-03');
    expect(shiftPeriodDue(quarterly, '2026-02-03', 3)).toBe('2026-11-03');
    expect(shiftPeriodDue(quarterly, '2025-11-03', -1)).toBe('2025-08-03');
    expect(shiftPeriodDue(quarterly, '2026-02-03', -1)).toBe('2025-11-03');
  });
  it('credits an early quarterly payment made in the last week of a bucket that crosses the year', () => {
    const quarterly = bill({ frequency: 'quarterly', dueMonth: 11, dueDate: 3 });
    expect(assignPaidPeriod(quarterly, '2026-01-28', '2025-11-03')).toBe('2026-02-03');
    expect(assignPaidPeriod(quarterly, '2026-01-26', '2025-11-03')).toBe('2025-11-03');
    const paid = { ...quarterly, lastPaidDate: '2026-01-28', paidForDueDate: '2026-02-03' };
    expect(isRecurringPaidForPeriod(paid, '2026-01-31')).toBe(true);
    expect(isRecurringPaidForPeriod(paid, '2026-04-30')).toBe(true);
    expect(isRecurringPaidForPeriod(paid, '2026-05-02')).toBe(false);
  });
  it('clamps a 29 February annual schedule in a non-leap year and re-clamps in a leap year', () => {
    const annual = bill({ frequency: 'annually', dueMonth: 2, dueDate: 29 });
    expect(recurringPeriodDue(annual, '2026-02-27')).toBe('2025-02-28');
    expect(recurringPeriodDue(annual, '2026-02-28')).toBe('2026-02-28');
    expect(recurringPeriodDue(annual, '2026-03-01')).toBe('2026-02-28');
    expect(recurringPeriodDue(annual, '2028-02-28')).toBe('2027-02-28');
    expect(recurringPeriodDue(annual, '2028-02-29')).toBe('2028-02-29');
    expect(shiftPeriodDue(annual, '2025-02-28', 1)).toBe('2026-02-28');
    expect(shiftPeriodDue(annual, '2027-02-28', 1)).toBe('2028-02-29');
    expect(shiftPeriodDue(annual, '2028-02-29', 1)).toBe('2029-02-28');
    expect(shiftPeriodDue(annual, '2028-02-29', -1)).toBe('2027-02-28');
    expect(assignPaidPeriod(annual, '2026-02-24', '2025-02-28')).toBe('2026-02-28');
  });
  it('defaults a missing dueMonth to January for quarterly and annual bills', () => {
    expect(recurringPeriodDue(bill({ frequency: 'annually', dueDate: 15 }), '2026-06-01')).toBe('2026-01-15');
    expect(recurringPeriodDue(bill({ frequency: 'quarterly', dueDate: 15 }), '2026-05-01')).toBe('2026-04-15');
  });
  it('credits an annual payment up to seven days before the anniversary', () => {
    const annual = bill({ frequency: 'annually', dueMonth: 3, dueDate: 10 });
    expect(assignPaidPeriod(annual, '2026-03-05', '2025-03-10')).toBe('2026-03-10');
    expect(assignPaidPeriod(annual, '2026-03-03', '2025-03-10')).toBe('2026-03-10');
    expect(assignPaidPeriod(annual, '2026-03-02', '2025-03-10')).toBe('2025-03-10');
    expect(assignPaidPeriod(annual, '2026-03-05')).toBe('2025-03-10');
    const paid = { ...annual, lastPaidDate: '2026-03-05', paidForDueDate: '2026-03-10' };
    expect(isRecurringPaidForPeriod(paid, '2026-03-05')).toBe(true);
    expect(isRecurringPaidForPeriod(paid, '2027-03-09')).toBe(true);
    expect(isRecurringPaidForPeriod(paid, '2027-03-10')).toBe(false);
  });
  it('ignores a stray dueMonth on a monthly bill, which never reads it', () => {
    expect(recurringPeriodDue(bill({ dueDate: 3, dueMonth: 0 }), '2026-09-28')).toBe('2026-09-03');
  });
});

describe('assignPaidPeriod guards', () => {
  const due3 = bill({ dueDate: 3 });
  it('never moves coverage backwards', () => {
    expect(assignPaidPeriod(due3, '2026-09-28', '2026-11-03')).toBe('2026-11-03');
    expect(assignPaidPeriod(due3, '2026-09-10', '2026-10-03')).toBe('2026-10-03');
    expect(assignPaidPeriod(due3, '2026-09-10', '2026-09-03')).toBe('2026-09-03');
    expect(assignPaidPeriod(bill({ frequency: 'annually', dueMonth: 3, dueDate: 10 }), '2026-03-20', '2028-03-10')).toBe('2028-03-10');
  });
  it('treats an invalid previousPaidFor as missing', () => {
    for (const previous of ['2026-02-30', 'garbage', '', '2026-09-03T00:00:00Z', '2026-9-3']) {
      expect(assignPaidPeriod(due3, '2026-09-28', previous)).toBe('2026-09-03');
    }
  });
  it('returns undefined for weekly bills', () => {
    const weekly = bill({ frequency: 'weekly' });
    expect(recurringPeriodDue(weekly, '2026-09-28')).toBeUndefined();
    expect(shiftPeriodDue(weekly, '2026-09-03', 1)).toBeUndefined();
    expect(assignPaidPeriod(weekly, '2026-09-28', '2026-09-03')).toBeUndefined();
  });
  it('returns undefined for invalid dates, due days and due months', () => {
    for (const date of ['', 'bad', '2026-02-30', '2026-13-01', '2026-04-06T00:00:00Z']) {
      expect(recurringPeriodDue(due3, date)).toBeUndefined();
      expect(assignPaidPeriod(due3, date, '2026-09-03')).toBeUndefined();
      expect(shiftPeriodDue(due3, date, 1)).toBeUndefined();
    }
    for (const dueDate of [0, 32, -1, 1.5, NaN]) {
      expect(recurringPeriodDue(bill({ dueDate }), '2026-09-28')).toBeUndefined();
      expect(shiftPeriodDue(bill({ dueDate }), '2026-09-03', 1)).toBeUndefined();
      expect(assignPaidPeriod(bill({ dueDate }), '2026-09-28')).toBeUndefined();
    }
    for (const frequency of ['quarterly', 'annually'] as const) {
      for (const dueMonth of [0, 13, 1.5, NaN]) {
        const invalid = bill({ frequency, dueMonth });
        expect(recurringPeriodDue(invalid, '2026-09-28')).toBeUndefined();
        expect(shiftPeriodDue(invalid, '2026-09-03', 1)).toBeUndefined();
        expect(assignPaidPeriod(invalid, '2026-09-28')).toBeUndefined();
      }
    }
    expect(shiftPeriodDue(due3, '2026-09-03', 1.5)).toBeUndefined();
    expect(shiftPeriodDue(due3, '2026-09-03', NaN)).toBeUndefined();
  });
  it('returns undefined rather than a date outside years 0000 to 9999', () => {
    expect(shiftPeriodDue(due3, '9999-12-03', 1)).toBeUndefined();
    expect(shiftPeriodDue(due3, '0000-01-03', -1)).toBeUndefined();
  });
});

describe('isRecurringPaidForPeriod with a stored period', () => {
  it('prefers a valid paidForDueDate over lastPaidDate and falls back when it is invalid', () => {
    const stored = bill({ dueDate: 3, lastPaidDate: '2026-09-28', paidForDueDate: '2026-10-03' });
    expect(isRecurringPaidForPeriod(stored, '2026-10-15')).toBe(true);
    for (const paidForDueDate of ['2026-02-30', 'garbage', '']) {
      expect(isRecurringPaidForPeriod({ ...stored, paidForDueDate }, '2026-10-15')).toBe(false);
      expect(isRecurringPaidForPeriod({ ...stored, paidForDueDate }, '2026-09-30')).toBe(true);
    }
  });
  it('still returns false for a missing, future or invalid lastPaidDate and invalid today', () => {
    const stored = bill({ dueDate: 3, paidForDueDate: '2026-10-03' });
    expect(isRecurringPaidForPeriod(stored, '2026-10-15')).toBe(false);
    expect(isRecurringPaidForPeriod({ ...stored, lastPaidDate: '2026-10-16' }, '2026-10-15')).toBe(false);
    expect(isRecurringPaidForPeriod({ ...stored, lastPaidDate: '2026-02-30' }, '2026-10-15')).toBe(false);
    expect(isRecurringPaidForPeriod({ ...stored, lastPaidDate: '2026-09-28' }, 'bad')).toBe(false);
  });
  it('does not read paidForDueDate for weekly bills', () => {
    const weekly = bill({ frequency: 'weekly', lastPaidDate: '2026-03-29', paidForDueDate: '2027-01-01' });
    expect(isRecurringPaidForPeriod(weekly, '2026-04-04')).toBe(true);
    expect(isRecurringPaidForPeriod(weekly, '2026-04-05')).toBe(false);
  });
});
