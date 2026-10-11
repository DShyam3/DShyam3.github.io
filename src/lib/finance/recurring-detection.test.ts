import { describe, expect, it } from 'vitest';
import type { MockTransaction, RecurringBill } from '@/features/finance/finance-types';
import {
  assignPaidPeriod, candidateMatchesBill, coverageAfterEdit, detectRecurringPayments, earlyPaymentTarget, isActiveRecurring,
  isRecurringPaidForPeriod, payRecurringEarly, recurringCoverage, recurringPaymentEvidence, recurringPaymentKey,
  recurringPeriodDue, shiftPeriodDue, tickRecurring, untickRecurring,
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

describe('recurringCoverage', () => {
  it('is undefined when nothing has been confirmed, whatever the frequency', () => {
    for (const frequency of ['monthly', 'quarterly', 'annually', 'weekly'] as const) {
      expect(recurringCoverage(bill({ frequency }))).toBeUndefined();
    }
  });
  it('prefers a valid stored period over the one derived from lastPaidDate', () => {
    const stored = bill({ dueDate: 3, lastPaidDate: '2026-09-28', paidForDueDate: '2026-10-03' });
    expect(recurringCoverage(stored)).toBe('2026-10-03');
    expect(recurringCoverage({ ...stored, lastPaidDate: undefined })).toBe('2026-10-03');
  });
  it('derives the period containing lastPaidDate, with no early credit, when none is stored or it is invalid', () => {
    const legacy = bill({ dueDate: 3, lastPaidDate: '2026-09-28' });
    expect(recurringCoverage(legacy)).toBe('2026-09-03');
    for (const paidForDueDate of ['2026-02-30', 'garbage', '']) {
      expect(recurringCoverage({ ...legacy, paidForDueDate })).toBe('2026-09-03');
    }
  });
  it('is undefined for an invalid lastPaidDate or a schedule that cannot place the period', () => {
    expect(recurringCoverage(bill({ lastPaidDate: '2026-02-30' }))).toBeUndefined();
    expect(recurringCoverage(bill({ dueDate: 0, lastPaidDate: '2026-09-28' }))).toBeUndefined();
    expect(recurringCoverage(bill({ frequency: 'quarterly', dueMonth: 13, lastPaidDate: '2026-09-28' }))).toBeUndefined();
  });
  it('follows quarterly and annual period boundaries across the year', () => {
    expect(recurringCoverage(bill({ frequency: 'quarterly', dueMonth: 11, dueDate: 3, lastPaidDate: '2026-01-20' }))).toBe('2025-11-03');
    expect(recurringCoverage(bill({ frequency: 'annually', dueMonth: 6, dueDate: 15, lastPaidDate: '2025-06-15' }))).toBe('2025-06-15');
  });
  it('uses lastPaidDate itself for a weekly bill and ignores any stored period', () => {
    expect(recurringCoverage(bill({ frequency: 'weekly', lastPaidDate: '2026-03-29', paidForDueDate: '2027-01-01' }))).toBe('2026-03-29');
    expect(recurringCoverage(bill({ frequency: 'weekly', lastPaidDate: '2026-02-30' }))).toBeUndefined();
    expect(recurringCoverage(bill({ frequency: 'weekly', paidForDueDate: '2027-01-01' }))).toBeUndefined();
  });
});

describe('tickRecurring', () => {
  const due3 = (overrides: Partial<RecurringBill> = {}) => bill({ dueDate: 3, ...overrides });
  it('covers the period containing today and stamps today as the payment date', () => {
    const unpaid = due3({ lastPaidDate: '2026-08-20', paidForDueDate: '2026-08-03' });
    expect(tickRecurring(unpaid, '2026-09-10')).toEqual({ isPaid: true, lastPaidDate: '2026-09-10', paidForDueDate: '2026-09-03' });
  });
  it('covers the first period when nothing was confirmed before', () => {
    expect(tickRecurring(due3(), '2026-09-10')).toEqual({ isPaid: true, lastPaidDate: '2026-09-10', paidForDueDate: '2026-09-03' });
  });
  it('keeps a late payment in the period it is late for', () => {
    const unpaid = due3({ lastPaidDate: '2026-08-02', paidForDueDate: '2026-08-03' });
    expect(tickRecurring(unpaid, '2026-09-28').paidForDueDate).toBe('2026-09-03');
  });
  it('stays in the current period even inside the seven days before the next, which payRecurringEarly alone claims', () => {
    const covered = due3({ isPaid: true, lastPaidDate: '2026-09-02', paidForDueDate: '2026-09-03' });
    expect(tickRecurring(covered, '2026-09-26')).toEqual({ isPaid: true, lastPaidDate: '2026-09-26', paidForDueDate: '2026-09-03' });
    expect(tickRecurring(covered, '2026-09-25').paidForDueDate).toBe('2026-09-03');
    expect(payRecurringEarly(covered, '2026-09-26')?.paidForDueDate).toBe('2026-10-03');
  });
  it('never moves coverage backwards', () => {
    expect(tickRecurring(due3({ paidForDueDate: '2026-11-03' }), '2026-09-10').paidForDueDate).toBe('2026-11-03');
  });
  it('keeps a stored period that is later than the one the payment falls in, and ignores an invalid one', () => {
    expect(tickRecurring(due3({ paidForDueDate: '2026-10-03' }), '2026-09-10').paidForDueDate).toBe('2026-10-03');
    expect(tickRecurring(due3({ paidForDueDate: '2026-09-03' }), '2026-09-10').paidForDueDate).toBe('2026-09-03');
    for (const paidForDueDate of ['garbage', '2026-02-30', '']) {
      expect(tickRecurring(due3({ paidForDueDate }), '2026-09-10').paidForDueDate).toBe('2026-09-03');
    }
  });
  it('keeps the stored period when the schedule or date cannot place a new one', () => {
    expect(tickRecurring(bill({ dueDate: 0, paidForDueDate: '2026-09-03' }), '2026-09-10').paidForDueDate).toBe('2026-09-03');
    expect(tickRecurring(due3({ paidForDueDate: '2026-09-03' }), 'bad').paidForDueDate).toBe('2026-09-03');
    expect(tickRecurring(bill({ dueDate: 0 }), '2026-09-10').paidForDueDate).toBeUndefined();
  });
  it('leaves paidForDueDate undefined for weekly bills', () => {
    expect(tickRecurring(bill({ frequency: 'weekly', paidForDueDate: '2026-09-03' }), '2026-09-10'))
      .toEqual({ isPaid: true, lastPaidDate: '2026-09-10', paidForDueDate: undefined });
  });
  it('crosses the year boundary and the 31st clamp', () => {
    const december = due3({ lastPaidDate: '2026-11-20', paidForDueDate: '2026-11-03' });
    expect(tickRecurring(december, '2026-12-28').paidForDueDate).toBe('2026-12-03');
    expect(tickRecurring(december, '2027-01-10').paidForDueDate).toBe('2027-01-03');
    const due31 = bill({ dueDate: 31, lastPaidDate: '2027-01-20', paidForDueDate: '2027-01-31' });
    expect(tickRecurring(due31, '2027-02-10').paidForDueDate).toBe('2027-02-28');
  });
  it('does not mutate the bill', () => {
    const original = due3({ lastPaidDate: '2026-08-20', paidForDueDate: '2026-08-03' });
    const before = { ...original };
    tickRecurring(original, '2026-09-10');
    expect(original).toEqual(before);
  });
});

describe('untickRecurring', () => {
  const due3 = (overrides: Partial<RecurringBill> = {}) => bill({ dueDate: 3, ...overrides });
  it('hands the period back and shows Unpaid after a normal tick', () => {
    const ticked = due3({ isPaid: true, lastPaidDate: '2026-09-10', paidForDueDate: '2026-09-03' });
    expect(untickRecurring(ticked, '2026-09-10')).toEqual({ isPaid: false, lastPaidDate: '2026-09-10', paidForDueDate: '2026-08-03' });
  });
  it('stays Paid, with coverage back on the current period, after an early tick is cleared', () => {
    const early = due3({ isPaid: true, lastPaidDate: '2026-09-28', paidForDueDate: '2026-10-03' });
    expect(untickRecurring(early, '2026-09-28')).toEqual({ isPaid: true, lastPaidDate: '2026-09-28', paidForDueDate: '2026-09-03' });
    expect(untickRecurring(early, '2026-10-05')).toMatchObject({ isPaid: false, paidForDueDate: '2026-09-03' });
  });
  it('leaves lastPaidDate alone, so it never claims or erases a payment', () => {
    const ticked = due3({ isPaid: true, lastPaidDate: '2026-09-10', paidForDueDate: '2026-09-03' });
    expect(untickRecurring(ticked, '2026-09-20').lastPaidDate).toBe('2026-09-10');
  });
  it('stays Paid after an early tick for quarterly and annual bills', () => {
    const quarterly = bill({ frequency: 'quarterly', dueMonth: 2, dueDate: 1, isPaid: true, lastPaidDate: '2026-04-28', paidForDueDate: '2026-05-01' });
    expect(untickRecurring(quarterly, '2026-04-28')).toEqual({ isPaid: true, lastPaidDate: '2026-04-28', paidForDueDate: '2026-02-01' });
    const annual = bill({ frequency: 'annually', dueMonth: 6, dueDate: 15, isPaid: true, lastPaidDate: '2026-06-10', paidForDueDate: '2026-06-15' });
    expect(untickRecurring(annual, '2026-06-10')).toEqual({ isPaid: true, lastPaidDate: '2026-06-10', paidForDueDate: '2025-06-15' });
  });
  it('steps back across the year boundary and through the 31st clamp', () => {
    const january = due3({ isPaid: true, lastPaidDate: '2027-01-10', paidForDueDate: '2027-01-03' });
    expect(untickRecurring(january, '2027-01-10')).toMatchObject({ isPaid: false, paidForDueDate: '2026-12-03' });
    const march = bill({ dueDate: 31, isPaid: true, lastPaidDate: '2027-03-10', paidForDueDate: '2027-03-31' });
    expect(untickRecurring(march, '2027-03-10')).toMatchObject({ paidForDueDate: '2027-02-28' });
  });
  it('only clears isPaid for a weekly bill, even with a stray stored period', () => {
    const weekly = bill({ frequency: 'weekly', isPaid: true, lastPaidDate: '2026-09-28' });
    expect(untickRecurring(weekly, '2026-09-29')).toEqual({ isPaid: false, lastPaidDate: '2026-09-28', paidForDueDate: undefined });
    expect(untickRecurring({ ...weekly, paidForDueDate: '2026-10-03' }, '2026-09-29').paidForDueDate).toBe('2026-10-03');
  });
  it('hands back from the coverage derived from lastPaidDate when no usable paidForDueDate is stored', () => {
    const older = due3({ isPaid: true, lastPaidDate: '2026-09-10' });
    expect(untickRecurring(older, '2026-09-10')).toEqual({ isPaid: false, lastPaidDate: '2026-09-10', paidForDueDate: '2026-08-03' });
    for (const paidForDueDate of ['garbage', '2026-02-30', '']) {
      expect(untickRecurring({ ...older, paidForDueDate }, '2026-09-10')).toEqual({ isPaid: false, lastPaidDate: '2026-09-10', paidForDueDate: '2026-08-03' });
    }
  });
  it('leaves coverage unreadable by the display once an older row is unticked', () => {
    const older = due3({ isPaid: true, lastPaidDate: '2026-10-02' });
    expect(isRecurringPaidForPeriod(older, '2026-10-28')).toBe(true);
    const unticked = { ...older, ...untickRecurring(older, '2026-10-28') };
    expect(unticked).toMatchObject({ isPaid: false, lastPaidDate: '2026-10-02', paidForDueDate: '2026-09-03' });
    expect(isRecurringPaidForPeriod(unticked, '2026-10-28')).toBe(false);
  });
  it('only clears isPaid when there is no coverage, or none the schedule can step back from', () => {
    expect(untickRecurring(due3({ isPaid: true, paidForDueDate: 'garbage' }), '2026-09-10'))
      .toEqual({ isPaid: false, lastPaidDate: undefined, paidForDueDate: 'garbage' });
    expect(untickRecurring(due3({ isPaid: true, lastPaidDate: '2026-02-30' }), '2026-09-10'))
      .toEqual({ isPaid: false, lastPaidDate: '2026-02-30', paidForDueDate: undefined });
    const badSchedule = bill({ dueDate: 0, isPaid: true, lastPaidDate: '2026-09-10', paidForDueDate: '2026-09-03' });
    expect(untickRecurring(badSchedule, '2026-09-10')).toEqual({ isPaid: false, lastPaidDate: '2026-09-10', paidForDueDate: '2026-09-03' });
  });
  it('turns a legacy isPaid row with no lastPaidDate into a consistent Unpaid row', () => {
    const legacy = due3({ isPaid: true });
    expect(untickRecurring(legacy, '2026-09-10')).toEqual({ isPaid: false, lastPaidDate: undefined, paidForDueDate: undefined });
    const stored = due3({ isPaid: true, paidForDueDate: '2026-10-03' });
    expect(untickRecurring(stored, '2026-09-10')).toEqual({ isPaid: false, lastPaidDate: undefined, paidForDueDate: '2026-09-03' });
  });
  it('leaves a weekly bill\'s coverage at lastPaidDate, so a calendar reading coverage still shows that week paid', () => {
    const weekly = bill({ frequency: 'weekly', isPaid: true, lastPaidDate: '2026-09-28' });
    const unticked = { ...weekly, ...untickRecurring(weekly, '2026-09-29') };
    expect(unticked.isPaid).toBe(false);
    expect(recurringCoverage(unticked)).toBe('2026-09-28');
  });
  it('does not mutate the bill', () => {
    const original = due3({ isPaid: true, lastPaidDate: '2026-09-28', paidForDueDate: '2026-10-03' });
    const before = { ...original };
    untickRecurring(original, '2026-09-28');
    expect(original).toEqual(before);
  });
});

describe('earlyPaymentTarget', () => {
  // Due on the 1st, so the whole seven-day window lies inside the current calendar month.
  const due1 = (overrides: Partial<RecurringBill> = {}) =>
    bill({ dueDate: 1, isPaid: true, lastPaidDate: '2026-09-02', paidForDueDate: '2026-09-01', ...overrides });
  it('opens seven days before the next due date and stays open to the day before', () => {
    expect(earlyPaymentTarget(due1(), '2026-09-23')).toBeUndefined();
    expect(earlyPaymentTarget(due1(), '2026-09-24')).toBe('2026-10-01');
    expect(earlyPaymentTarget(due1(), '2026-09-30')).toBe('2026-10-01');
  });
  it('is undefined once the next period has begun, because that period is not paid yet', () => {
    expect(earlyPaymentTarget(due1(), '2026-10-01')).toBeUndefined();
    const due3 = bill({ dueDate: 3, isPaid: true, lastPaidDate: '2026-09-02', paidForDueDate: '2026-09-03' });
    expect(earlyPaymentTarget(due3, '2026-09-25')).toBeUndefined();
    expect(earlyPaymentTarget(due3, '2026-09-26')).toBe('2026-10-03');
    expect(earlyPaymentTarget(due3, '2026-10-01')).toBeUndefined();
  });
  it('is undefined unless the bill is shown Paid, even when coverage reaches the current period', () => {
    const shownUnpaid = due1({ isPaid: false });
    expect(isRecurringPaidForPeriod(shownUnpaid, '2026-09-28')).toBe(true);
    expect(earlyPaymentTarget(shownUnpaid, '2026-09-28')).toBeUndefined();
    expect(payRecurringEarly(shownUnpaid, '2026-09-28')).toBeUndefined();
  });
  it('offers nothing to an older row that has been unticked, and no early credit when it is ticked again', () => {
    const older = bill({ dueDate: 3, isPaid: true, lastPaidDate: '2026-10-02' });
    expect(earlyPaymentTarget(older, '2026-10-28')).toBe('2026-11-03');
    const unticked = { ...older, ...untickRecurring(older, '2026-10-28') };
    expect(earlyPaymentTarget(unticked, '2026-10-28')).toBeUndefined();
    expect(payRecurringEarly(unticked, '2026-10-28')).toBeUndefined();
    expect(tickRecurring(unticked, '2026-10-28').paidForDueDate).toBe('2026-10-03');
  });
  it('is undefined while the current period is unpaid, whatever the day', () => {
    const unpaid = due1({ lastPaidDate: '2026-08-05', paidForDueDate: '2026-08-01' });
    expect(earlyPaymentTarget(unpaid, '2026-09-28')).toBeUndefined();
    expect(earlyPaymentTarget(bill({ dueDate: 1 }), '2026-09-28')).toBeUndefined();
  });
  it('is undefined once next period is already covered', () => {
    const early = due1({ lastPaidDate: '2026-09-26', paidForDueDate: '2026-10-01' });
    expect(isRecurringPaidForPeriod(early, '2026-09-28')).toBe(true);
    expect(earlyPaymentTarget(early, '2026-09-28')).toBeUndefined();
  });
  it('derives coverage from lastPaidDate for a legacy row with no stored period', () => {
    expect(earlyPaymentTarget(due1({ paidForDueDate: undefined }), '2026-09-28')).toBe('2026-10-01');
  });
  it('is undefined for a weekly bill', () => {
    const weekly = bill({ frequency: 'weekly', isPaid: true, lastPaidDate: '2026-09-28' });
    expect(earlyPaymentTarget(weekly, '2026-09-29')).toBeUndefined();
  });
  it('applies the same seven-day window to quarterly bills', () => {
    const quarterly = bill({ frequency: 'quarterly', dueMonth: 2, dueDate: 1, isPaid: true, lastPaidDate: '2026-08-02', paidForDueDate: '2026-08-01' });
    expect(earlyPaymentTarget(quarterly, '2026-10-24')).toBeUndefined();
    expect(earlyPaymentTarget(quarterly, '2026-10-25')).toBe('2026-11-01');
    expect(earlyPaymentTarget(quarterly, '2026-10-31')).toBe('2026-11-01');
    expect(earlyPaymentTarget(quarterly, '2026-11-01')).toBeUndefined();
  });
  it('applies the same seven-day window to annual bills', () => {
    const annual = bill({ frequency: 'annually', dueMonth: 6, dueDate: 15, isPaid: true, lastPaidDate: '2025-06-20', paidForDueDate: '2025-06-15' });
    expect(earlyPaymentTarget(annual, '2026-06-07')).toBeUndefined();
    expect(earlyPaymentTarget(annual, '2026-06-08')).toBe('2026-06-15');
    expect(earlyPaymentTarget(annual, '2026-06-14')).toBe('2026-06-15');
    expect(earlyPaymentTarget(annual, '2026-06-15')).toBeUndefined();
    expect(earlyPaymentTarget(annual, '2025-12-01')).toBeUndefined();
  });
  it('crosses the year boundary and the tax-year boundary', () => {
    const december = bill({ dueDate: 1, isPaid: true, lastPaidDate: '2026-12-01', paidForDueDate: '2026-12-01' });
    expect(earlyPaymentTarget(december, '2026-12-25')).toBe('2027-01-01');
    const april = bill({ dueDate: 6, isPaid: true, lastPaidDate: '2026-03-07', paidForDueDate: '2026-03-06' });
    expect(earlyPaymentTarget(april, '2026-03-29')).toBeUndefined();
    expect(earlyPaymentTarget(april, '2026-03-30')).toBe('2026-04-06');
  });
  it('is undefined for invalid dates, a future payment date and an invalid schedule', () => {
    for (const today of ['bad', '', '2026-02-30', '2026-09-28T00:00:00Z']) {
      expect(earlyPaymentTarget(due1(), today)).toBeUndefined();
    }
    expect(earlyPaymentTarget(due1({ lastPaidDate: '2026-09-29', paidForDueDate: undefined }), '2026-09-28')).toBeUndefined();
    expect(earlyPaymentTarget(due1({ lastPaidDate: 'garbage', paidForDueDate: undefined }), '2026-09-28')).toBeUndefined();
    expect(earlyPaymentTarget(due1({ dueDate: 0 }), '2026-09-28')).toBeUndefined();
    expect(earlyPaymentTarget(bill({ frequency: 'quarterly', dueMonth: 13, isPaid: true, lastPaidDate: '2026-09-02' }), '2026-09-28')).toBeUndefined();
  });
});

describe('payRecurringEarly', () => {
  const due1 = (overrides: Partial<RecurringBill> = {}) =>
    bill({ dueDate: 1, isPaid: true, lastPaidDate: '2026-09-02', paidForDueDate: '2026-09-01', ...overrides });
  it('records today as the payment date for next period inside the window', () => {
    expect(payRecurringEarly(due1(), '2026-09-28')).toEqual({ isPaid: true, lastPaidDate: '2026-09-28', paidForDueDate: '2026-10-01' });
  });
  it('is undefined outside the window, while unpaid, for weekly bills and for invalid dates', () => {
    expect(payRecurringEarly(due1(), '2026-09-20')).toBeUndefined();
    expect(payRecurringEarly(due1({ lastPaidDate: '2026-08-05', paidForDueDate: '2026-08-01' }), '2026-09-28')).toBeUndefined();
    expect(payRecurringEarly(bill({ frequency: 'weekly', isPaid: true, lastPaidDate: '2026-09-28' }), '2026-09-29')).toBeUndefined();
    expect(payRecurringEarly(due1(), 'bad')).toBeUndefined();
  });
  it('cannot be recorded twice, so it never runs coverage more than one period ahead', () => {
    const once = { ...due1(), ...payRecurringEarly(due1(), '2026-09-28') };
    expect(payRecurringEarly(once, '2026-09-29')).toBeUndefined();
  });
  it('is the only way to claim next period, where a plain tick on the same day stays in the current one', () => {
    expect(payRecurringEarly(due1(), '2026-09-28')?.paidForDueDate).toBe('2026-10-01');
    expect(tickRecurring(due1(), '2026-09-28').paidForDueDate).toBe('2026-09-01');
  });
  it('is undone by untickRecurring, which leaves the current period covered', () => {
    const early = { ...due1(), ...payRecurringEarly(due1(), '2026-09-28') };
    expect(untickRecurring(early, '2026-09-28')).toEqual({ isPaid: true, lastPaidDate: '2026-09-28', paidForDueDate: '2026-09-01' });
  });
});

describe('coverageAfterEdit', () => {
  const earlyForNovember = (overrides: Partial<RecurringBill> = {}) =>
    bill({ dueDate: 1, isPaid: true, lastPaidDate: '2026-10-28', paidForDueDate: '2026-11-01', ...overrides });
  it('is undefined with no lastPaidDate, whatever the previous coverage', () => {
    const previous = earlyForNovember();
    expect(coverageAfterEdit(previous, { ...previous, lastPaidDate: undefined })).toBeUndefined();
    expect(coverageAfterEdit(previous, { ...previous, lastPaidDate: '' })).toBeUndefined();
    expect(coverageAfterEdit(bill(), bill({ dueDate: 2 }))).toBeUndefined();
  });
  it('keeps early credit for November when the due day moves from the 1st to the 2nd', () => {
    const previous = earlyForNovember();
    const next = { ...previous, dueDate: 2 };
    expect(coverageAfterEdit(previous, next)).toBe('2026-11-02');
    // Recomputing from the payment date alone is what dropped it.
    expect(assignPaidPeriod(next, '2026-10-28')).toBe('2026-10-02');
  });
  it('keeps the calendar month covered when the due day moves later in the month', () => {
    const previous = earlyForNovember();
    expect(coverageAfterEdit(previous, { ...previous, dueDate: 28 })).toBe('2026-11-28');
  });
  it('moves ordinary coverage onto the new schedule without inventing early credit', () => {
    const previous = bill({ dueDate: 1, isPaid: true, lastPaidDate: '2026-10-10', paidForDueDate: '2026-10-01' });
    expect(coverageAfterEdit(previous, { ...previous, dueDate: 2 })).toBe('2026-10-02');
    const legacy = bill({ dueDate: 3, isPaid: true, lastPaidDate: '2026-09-28' });
    expect(coverageAfterEdit(legacy, { ...legacy, dueDate: 5 })).toBe('2026-09-05');
  });
  it('leaves coverage unchanged when nothing about the schedule or date changed', () => {
    const previous = earlyForNovember();
    expect(coverageAfterEdit(previous, { ...previous })).toBe('2026-11-01');
    const ordinary = bill({ dueDate: 3, isPaid: true, lastPaidDate: '2026-09-28', paidForDueDate: '2026-09-03' });
    expect(coverageAfterEdit(ordinary, { ...ordinary })).toBe('2026-09-03');
  });
  it('drops early credit a corrected last-paid date no longer earns', () => {
    // Paid 28 Oct as November's early payment, then corrected to 20 Oct: outside the early window.
    const previous = earlyForNovember();
    expect(coverageAfterEdit(previous, { ...previous, lastPaidDate: '2026-10-20' })).toBe('2026-10-01');
  });
  it('keeps early credit a corrected last-paid date still earns', () => {
    const previous = bill({ dueDate: 3, isPaid: true, lastPaidDate: '2026-10-28', paidForDueDate: '2026-11-03' });
    expect(coverageAfterEdit(previous, { ...previous, lastPaidDate: '2026-10-29' })).toBe('2026-11-03');
    expect(coverageAfterEdit(previous, { ...previous, lastPaidDate: '2026-10-27' })).toBe('2026-11-03');
    expect(coverageAfterEdit(previous, { ...previous, lastPaidDate: '2026-10-26' })).toBe('2026-10-03');
    // The correction can move the due day at the same time.
    expect(coverageAfterEdit(previous, { ...previous, lastPaidDate: '2026-10-29', dueDate: 4 })).toBe('2026-11-04');
  });
  it('earns a corrected date against the coverage before the payment once the bill has been unticked', () => {
    // Coverage 3 September does not include the 2 October payment's own period (3 October), so it is the coverage before the payment.
    const unticked = bill({ dueDate: 3, isPaid: false, lastPaidDate: '2026-10-02', paidForDueDate: '2026-09-03' });
    expect(coverageAfterEdit(unticked, { ...unticked, lastPaidDate: '2026-10-05' })).toBe('2026-10-03');
    expect(coverageAfterEdit(unticked, { ...unticked, lastPaidDate: '2026-09-10' })).toBe('2026-09-03');
    // 30 September falls in the week before 3 October with September already covered, so it would have been early.
    expect(coverageAfterEdit(unticked, { ...unticked, lastPaidDate: '2026-09-30' })).toBe('2026-10-03');
  });
  it('moves an unticked bill\'s coverage onto a new schedule without re-deriving it from lastPaidDate', () => {
    const unticked = bill({ dueDate: 3, isPaid: false, lastPaidDate: '2026-10-02', paidForDueDate: '2026-09-03' });
    expect(coverageAfterEdit(unticked, { ...unticked, dueDate: 5 })).toBe('2026-09-05');
    expect(coverageAfterEdit(unticked, { ...unticked, amount: 12 })).toBe('2026-09-03');
    expect(assignPaidPeriod({ ...unticked, dueDate: 5 }, '2026-10-02')).toBe('2026-10-05');
  });
  it('does not let the payment that earned the coverage count as early a second time', () => {
    // Paid on 28 September for the 3 September bill: inside the seven days before 3 October, but a late payment, not an early one.
    const late = bill({ dueDate: 3, isPaid: true, lastPaidDate: '2026-09-28', paidForDueDate: '2026-09-03' });
    expect(coverageAfterEdit(late, { ...late, name: 'Renamed' })).toBe('2026-09-03');
    expect(coverageAfterEdit(late, { ...late, dueDate: 5 })).toBe('2026-09-05');
    // A first-ever confirmation with no stored period behaves the same.
    const firstEver = bill({ dueDate: 3, isPaid: true, lastPaidDate: '2026-09-28' });
    expect(coverageAfterEdit(firstEver, { ...firstEver })).toBe('2026-09-03');
  });
  it('moves coverage forward when the last-paid date moves into a later period', () => {
    const previous = bill({ dueDate: 1, isPaid: true, lastPaidDate: '2026-09-10', paidForDueDate: '2026-09-01' });
    expect(coverageAfterEdit(previous, { ...previous, lastPaidDate: '2026-10-10' })).toBe('2026-10-01');
  });
  it('starts from the payment date when the previous row had no coverage', () => {
    expect(coverageAfterEdit(bill({ dueDate: 3 }), bill({ dueDate: 3, lastPaidDate: '2026-09-28' }))).toBe('2026-09-03');
    expect(coverageAfterEdit(bill({ dueDate: 3, lastPaidDate: 'garbage' }), bill({ dueDate: 3, lastPaidDate: '2026-09-28' }))).toBe('2026-09-03');
  });
  it('drops early credit and reads Unpaid when the frequency changes to a longer period', () => {
    const previous = earlyForNovember();
    const quarterly = { ...previous, frequency: 'quarterly' as const, dueMonth: 2 };
    // The payment's own quarter is the one starting 1 August; one period back leaves it unpaid.
    expect(coverageAfterEdit(previous, quarterly)).toBe('2026-05-01');
    expect(isRecurringPaidForPeriod({ ...quarterly, paidForDueDate: '2026-05-01' }, '2026-10-30')).toBe(false);
    const annual = { ...previous, frequency: 'annually' as const, dueMonth: 6 };
    expect(coverageAfterEdit(previous, annual)).toBe('2025-06-01');
    expect(isRecurringPaidForPeriod({ ...annual, paidForDueDate: '2025-06-01' }, '2026-10-30')).toBe(false);
  });
  it('keeps the payment\'s own period when the frequency changes to a shorter one that was covering it', () => {
    const quarterly = bill({ frequency: 'quarterly', dueMonth: 10, dueDate: 3, isPaid: true, lastPaidDate: '2026-10-02', paidForDueDate: '2026-10-03' });
    const monthly = { ...quarterly, frequency: 'monthly' as const };
    expect(coverageAfterEdit(quarterly, monthly)).toBe('2026-10-03');
    expect(isRecurringPaidForPeriod({ ...monthly, paidForDueDate: '2026-10-03' }, '2026-10-10')).toBe(true);
    // A quarter anchored in August covers October too, and the monthly period is October's.
    const august = { ...quarterly, dueMonth: 8, paidForDueDate: '2026-08-03' };
    expect(coverageAfterEdit(august, { ...august, frequency: 'monthly' })).toBe('2026-10-03');
    // An early quarterly payment covering the next quarter does not stretch into a monthly one.
    const earlyForNovember = { ...quarterly, dueMonth: 2, dueDate: 1, lastPaidDate: '2026-10-28', paidForDueDate: '2026-11-01' };
    expect(coverageAfterEdit(earlyForNovember, { ...earlyForNovember, frequency: 'monthly' })).toBe('2026-10-01');
  });
  it('does not bring an unticked payment back by changing the frequency to a shorter period', () => {
    const quarterly = bill({ frequency: 'quarterly', dueMonth: 10, dueDate: 3, isPaid: true, lastPaidDate: '2026-10-02', paidForDueDate: '2026-10-03' });
    const unticked = { ...quarterly, ...untickRecurring(quarterly, '2026-10-10') };
    expect(unticked).toMatchObject({ isPaid: false, paidForDueDate: '2026-07-03' });
    const monthly = { ...unticked, frequency: 'monthly' as const };
    expect(coverageAfterEdit(unticked, monthly)).toBe('2026-09-03');
    expect(isRecurringPaidForPeriod({ ...monthly, paidForDueDate: '2026-09-03' }, '2026-10-10')).toBe(false);
  });
  it('does not cover a quarter by changing an unticked monthly payment to quarterly', () => {
    const start = bill({ dueDate: 3, lastPaidDate: '2026-08-20', paidForDueDate: '2026-08-03' });
    const ticked = { ...start, ...tickRecurring(start, '2026-10-02') };
    const unticked = { ...ticked, ...untickRecurring(ticked, '2026-10-02') };
    expect(unticked).toMatchObject({ isPaid: false, paidForDueDate: '2026-09-03' });
    const quarterly = { ...unticked, frequency: 'quarterly' as const, dueMonth: 10 };
    expect(assignPaidPeriod(quarterly, '2026-10-02')).toBe('2026-10-03');
    expect(coverageAfterEdit(unticked, quarterly)).toBe('2026-07-03');
    expect(isRecurringPaidForPeriod({ ...quarterly, paidForDueDate: '2026-07-03' }, '2026-10-10')).toBe(false);
  });
  it('does not make a monthly payment cover the current annual cycle', () => {
    const paid = bill({ dueDate: 3, isPaid: true, lastPaidDate: '2026-09-02', paidForDueDate: '2026-09-03' });
    const annual = { ...paid, frequency: 'annually' as const, dueMonth: 8 };
    expect(assignPaidPeriod(annual, '2026-09-02')).toBe('2026-08-03');
    expect(coverageAfterEdit(paid, annual)).toBe('2025-08-03');
    expect(isRecurringPaidForPeriod({ ...annual, paidForDueDate: '2025-08-03' }, '2026-10-10')).toBe(false);
  });
  it('reads a previous schedule that cannot place a period, or no previous coverage at all, as not covering its payment', () => {
    const broken = bill({ frequency: 'annually', dueMonth: 8, dueDate: 0, isPaid: true, lastPaidDate: '2026-09-02', paidForDueDate: '2026-08-03' });
    expect(coverageAfterEdit(broken, { ...broken, frequency: 'monthly', dueDate: 3 })).toBe('2026-08-03');
    const none = bill({ frequency: 'annually', dueMonth: 8, dueDate: 0, isPaid: true, lastPaidDate: '2026-09-02' });
    expect(coverageAfterEdit(none, { ...none, frequency: 'monthly', dueDate: 3 })).toBe('2026-08-03');
    expect(coverageAfterEdit(bill({ dueDate: 3 }), bill({ frequency: 'quarterly', dueDate: 3, lastPaidDate: '2026-09-28' }))).toBe('2026-04-03');
    expect(coverageAfterEdit(bill({ frequency: 'quarterly', dueDate: 3 }), bill({ dueDate: 3, lastPaidDate: '2026-09-28' }))).toBe('2026-08-03');
  });
  it('drops a weekly bill\'s payment into the period before when it becomes monthly, ticked or not', () => {
    for (const isPaid of [true, false]) {
      const weekly = bill({ frequency: 'weekly', isPaid, lastPaidDate: '2026-10-28' });
      expect(coverageAfterEdit(weekly, { ...weekly, frequency: 'monthly', dueDate: 1 })).toBe('2026-09-01');
    }
  });
  it('is undefined when a frequency change lands on weekly or an invalid schedule', () => {
    const previous = earlyForNovember();
    expect(coverageAfterEdit(previous, { ...previous, frequency: 'weekly' })).toBeUndefined();
    expect(coverageAfterEdit(previous, { ...previous, frequency: 'annually', dueMonth: 13 })).toBeUndefined();
  });
  it('clamps a due day of 31 through February, leap and non-leap', () => {
    const january = bill({ dueDate: 1, isPaid: true, lastPaidDate: '2027-01-28', paidForDueDate: '2027-02-01' });
    expect(coverageAfterEdit(january, { ...january, dueDate: 31 })).toBe('2027-02-28');
    const leap = bill({ dueDate: 1, isPaid: true, lastPaidDate: '2028-01-28', paidForDueDate: '2028-02-01' });
    expect(coverageAfterEdit(leap, { ...leap, dueDate: 31 })).toBe('2028-02-29');
    const clamped = bill({ dueDate: 31, isPaid: true, lastPaidDate: '2027-02-20', paidForDueDate: '2027-02-28' });
    expect(coverageAfterEdit(clamped, { ...clamped, dueDate: 30 })).toBe('2027-02-28');
    expect(coverageAfterEdit(clamped, { ...clamped, dueDate: 15 })).toBe('2027-02-15');
  });
  it('is undefined for weekly bills, before or after the edit', () => {
    const weekly = bill({ frequency: 'weekly', isPaid: true, lastPaidDate: '2026-10-28' });
    expect(coverageAfterEdit(weekly, { ...weekly, lastPaidDate: '2026-10-29' })).toBeUndefined();
    expect(coverageAfterEdit(earlyForNovember(), { ...earlyForNovember(), frequency: 'weekly' })).toBeUndefined();
  });
  it('is undefined when the new schedule cannot place a period or the date is invalid', () => {
    const previous = earlyForNovember();
    expect(coverageAfterEdit(previous, { ...previous, dueDate: 0 })).toBeUndefined();
    expect(coverageAfterEdit(previous, { ...previous, lastPaidDate: '2026-02-30' })).toBeUndefined();
    expect(coverageAfterEdit(previous, { ...previous, frequency: 'quarterly', dueMonth: 13 })).toBeUndefined();
  });
  it('carries early credit across the year boundary', () => {
    const previous = bill({ dueDate: 1, isPaid: true, lastPaidDate: '2026-12-28', paidForDueDate: '2027-01-01' });
    expect(coverageAfterEdit(previous, { ...previous, dueDate: 2 })).toBe('2027-01-02');
  });
  it('does not mutate either bill', () => {
    const previous = earlyForNovember();
    const next = { ...previous, dueDate: 2 };
    const before = [{ ...previous }, { ...next }];
    coverageAfterEdit(previous, next);
    expect([previous, next]).toEqual(before);
  });
});

describe('tick and untick round trip', () => {
  const cases: Array<[string, RecurringBill, string]> = [
    ['monthly, normal payment', bill({ dueDate: 3, lastPaidDate: '2026-08-20', paidForDueDate: '2026-08-03' }), '2026-09-10'],
    ['monthly, late payment', bill({ dueDate: 3, lastPaidDate: '2026-08-02', paidForDueDate: '2026-08-03' }), '2026-09-28'],
    ['monthly, December into January', bill({ dueDate: 3, lastPaidDate: '2026-11-20', paidForDueDate: '2026-11-03' }), '2026-12-10'],
    ['monthly, 31st through February', bill({ dueDate: 31, lastPaidDate: '2027-01-30', paidForDueDate: '2027-01-31' }), '2027-02-10'],
    ['monthly, payment in the last week of the month', bill({ dueDate: 3, lastPaidDate: '2026-08-02', paidForDueDate: '2026-08-03' }), '2026-09-28'],
    ['quarterly', bill({ frequency: 'quarterly', dueMonth: 2, dueDate: 1, lastPaidDate: '2026-02-02', paidForDueDate: '2026-02-01' }), '2026-05-10'],
    ['annual', bill({ frequency: 'annually', dueMonth: 6, dueDate: 15, lastPaidDate: '2025-06-20', paidForDueDate: '2025-06-15' }), '2026-06-20'],
  ];
  it.each(cases)('returns %s to the coverage it started with', (_name, start, today) => {
    const ticked = { ...start, ...tickRecurring(start, today) };
    expect(recurringCoverage(ticked)).not.toBe(recurringCoverage(start));
    const unticked = { ...ticked, ...untickRecurring(ticked, today) };
    expect(recurringCoverage(unticked)).toBe(recurringCoverage(start));
    expect(unticked.paidForDueDate).toBe(start.paidForDueDate);
    expect(unticked.isPaid).toBe(false);
  });
  const earlyCases: Array<[string, RecurringBill, string]> = [
    ['monthly', bill({ dueDate: 3, isPaid: true, lastPaidDate: '2026-09-02', paidForDueDate: '2026-09-03' }), '2026-09-28'],
    ['quarterly', bill({ frequency: 'quarterly', dueMonth: 2, dueDate: 1, isPaid: true, lastPaidDate: '2026-02-02', paidForDueDate: '2026-02-01' }), '2026-04-28'],
    ['annual', bill({ frequency: 'annually', dueMonth: 6, dueDate: 15, isPaid: true, lastPaidDate: '2025-06-20', paidForDueDate: '2025-06-15' }), '2026-06-10'],
  ];
  it.each(earlyCases)('returns an early %s payment to the coverage it started with, still Paid', (_name, start, today) => {
    const paidEarly = { ...start, ...payRecurringEarly(start, today) };
    expect(recurringCoverage(paidEarly)).not.toBe(recurringCoverage(start));
    const unticked = { ...paidEarly, ...untickRecurring(paidEarly, today) };
    expect(unticked.paidForDueDate).toBe(start.paidForDueDate);
    expect(unticked.isPaid).toBe(true);
    expect(isRecurringPaidForPeriod(unticked, today)).toBe(true);
  });
  it('shows Unpaid after a normal round trip', () => {
    const normal = bill({ dueDate: 3, lastPaidDate: '2026-08-20', paidForDueDate: '2026-08-03' });
    const normalTicked = { ...normal, ...tickRecurring(normal, '2026-09-10') };
    const normalUnticked = { ...normalTicked, ...untickRecurring(normalTicked, '2026-09-10') };
    expect(normalUnticked.isPaid).toBe(false);
    expect(isRecurringPaidForPeriod(normalUnticked, '2026-09-10')).toBe(false);
  });
  it('returns a weekly bill to Unpaid with no stored period', () => {
    const weekly = bill({ frequency: 'weekly' });
    const ticked = { ...weekly, ...tickRecurring(weekly, '2026-09-10') };
    expect(untickRecurring(ticked, '2026-09-10')).toMatchObject({ isPaid: false, paidForDueDate: undefined });
  });
});

// Each sequence applies the helpers in the order the page would, spreading every result onto the bill.
describe('sequences that must not leave isPaid and coverage disagreeing', () => {
  const apply = (row: RecurringBill, fields: Partial<RecurringBill> | undefined): RecurringBill => ({ ...row, ...fields });
  const edit = (row: RecurringBill, changes: Partial<RecurringBill>): RecurringBill => {
    const next = { ...row, ...changes };
    return { ...next, paidForDueDate: coverageAfterEdit(row, next) };
  };

  it('tick, untick, an edit that is not about payment, then a late tick stays in October', () => {
    const start = bill({ dueDate: 3, lastPaidDate: '2026-08-20', paidForDueDate: '2026-08-03' });
    const ticked = apply(start, tickRecurring(start, '2026-10-02'));
    expect(ticked.paidForDueDate).toBe('2026-10-03');
    const unticked = apply(ticked, untickRecurring(ticked, '2026-10-02'));
    expect(unticked).toMatchObject({ isPaid: false, paidForDueDate: '2026-09-03' });
    const renamed = edit(unticked, { amount: 12 });
    expect(renamed.paidForDueDate).toBe('2026-09-03');
    expect(isRecurringPaidForPeriod(renamed, '2026-10-28')).toBe(false);
    const again = apply(renamed, tickRecurring(renamed, '2026-10-28'));
    expect(again.paidForDueDate).toBe('2026-10-03');
    expect(earlyPaymentTarget(again, '2026-10-28')).toBe('2026-11-03');
  });

  it('an older row with no paidForDueDate, unticked, offers no early button and earns no early credit', () => {
    const older = bill({ dueDate: 3, isPaid: true, lastPaidDate: '2026-10-02' });
    const unticked = apply(older, untickRecurring(older, '2026-10-28'));
    expect(unticked.isPaid).toBe(false);
    expect(isRecurringPaidForPeriod(unticked, '2026-10-28')).toBe(false);
    expect(earlyPaymentTarget(unticked, '2026-10-28')).toBeUndefined();
    expect(payRecurringEarly(unticked, '2026-10-28')).toBeUndefined();
    expect(tickRecurring(unticked, '2026-10-28').paidForDueDate).toBe('2026-10-03');
  });

  it('an early payment keeps its credit when its date is corrected to another day inside the window', () => {
    const covered = bill({ dueDate: 3, isPaid: true, lastPaidDate: '2026-10-02', paidForDueDate: '2026-10-03' });
    const early = apply(covered, payRecurringEarly(covered, '2026-10-28'));
    expect(early.paidForDueDate).toBe('2026-11-03');
    const corrected = edit(early, { lastPaidDate: '2026-10-29' });
    expect(corrected.paidForDueDate).toBe('2026-11-03');
    expect(isRecurringPaidForPeriod(corrected, '2026-11-02')).toBe(true);
    // Corrected to a day outside the window, the payment is simply October's.
    expect(edit(early, { lastPaidDate: '2026-10-20' }).paidForDueDate).toBe('2026-10-03');
  });

  it('a payment correction after its period has ended does not make one payment cover two months', () => {
    for (const isPaid of [true, false]) {
      const paid = bill({ dueDate: 3, isPaid, lastPaidDate: '2026-10-02', paidForDueDate: '2026-10-03' });
      const corrected = edit(paid, { lastPaidDate: '2026-10-28' });
      expect(corrected.paidForDueDate).toBe('2026-10-03');
      expect(isRecurringPaidForPeriod(corrected, '2026-11-05')).toBe(false);
    }
  });

  it('an early payment unticked on either side of the month end does not earn November back when its date is corrected', () => {
    const covered = bill({ dueDate: 3, isPaid: true, lastPaidDate: '2026-10-02', paidForDueDate: '2026-10-03' });
    const early = apply(covered, payRecurringEarly(covered, '2026-10-28'));
    expect(early.paidForDueDate).toBe('2026-11-03');
    const results = ['2026-10-30', '2026-11-01'].map(day => {
      const unticked = apply(early, untickRecurring(early, day));
      expect(unticked.paidForDueDate).toBe('2026-10-03');
      const corrected = edit(unticked, { lastPaidDate: '2026-10-29' });
      expect(isRecurringPaidForPeriod(corrected, '2026-11-01')).toBe(false);
      return corrected.paidForDueDate;
    });
    expect(results).toEqual(['2026-10-03', '2026-10-03']);
  });

  it('a schedule-only edit after an untick leaves the bill unpaid', () => {
    const paid = bill({ dueDate: 3, isPaid: true, lastPaidDate: '2026-10-02', paidForDueDate: '2026-10-03' });
    const unticked = apply(paid, untickRecurring(paid, '2026-10-10'));
    expect(unticked).toMatchObject({ isPaid: false, paidForDueDate: '2026-09-03' });
    for (const dueDate of [1, 5, 31]) {
      const moved = edit(unticked, { dueDate });
      expect(isRecurringPaidForPeriod(moved, '2026-10-10')).toBe(false);
      expect(isRecurringPaidForPeriod(moved, '2026-10-31')).toBe(false);
    }
    expect(edit(unticked, { dueDate: 5 }).paidForDueDate).toBe('2026-09-05');
    // Deriving it from lastPaidDate again is what would have read October as paid.
    expect(isRecurringPaidForPeriod({ ...unticked, dueDate: 5, paidForDueDate: undefined }, '2026-10-10')).toBe(true);
  });
});
