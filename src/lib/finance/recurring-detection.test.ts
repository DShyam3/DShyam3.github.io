import { describe, expect, it } from 'vitest';
import type { MockTransaction, RecurringBill } from '@/features/finance/finance-types';
import { candidateMatchesBill, detectRecurringPayments, isActiveRecurring, isRecurringPaidForPeriod, recurringPaymentEvidence, recurringPaymentKey } from './recurring-detection';

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
  it('carries a payment up to seven days early into a January monthly period', () => {
    const paid = bill({ dueDate: 1, lastPaidDate: '2025-12-31' });
    expect(isRecurringPaidForPeriod(paid, '2026-01-01')).toBe(true);
    expect(isRecurringPaidForPeriod(paid, '2026-01-31')).toBe(true);
    expect(isRecurringPaidForPeriod({ ...paid, lastPaidDate: '2025-12-25' }, '2026-01-01')).toBe(true);
    expect(isRecurringPaidForPeriod({ ...paid, lastPaidDate: '2025-12-24' }, '2026-01-01')).toBe(false);
  });
  it('carries early annual payments across the anniversary with a seven-day limit', () => {
    const paid = bill({ frequency: 'annually', dueMonth: 6, dueDate: 15, lastPaidDate: '2026-06-14' });
    expect(isRecurringPaidForPeriod(paid, '2026-06-15')).toBe(true);
    expect(isRecurringPaidForPeriod({ ...paid, lastPaidDate: '2026-06-08' }, '2026-06-15')).toBe(true);
    expect(isRecurringPaidForPeriod({ ...paid, lastPaidDate: '2026-06-07' }, '2026-06-15')).toBe(false);
  });
  it('carries early quarterly payments across the anchored quarter boundary', () => {
    const paid = bill({ frequency: 'quarterly', dueMonth: 2, dueDate: 1, lastPaidDate: '2026-01-31' });
    expect(isRecurringPaidForPeriod(paid, '2026-02-01')).toBe(true);
    expect(isRecurringPaidForPeriod(paid, '2026-04-30')).toBe(true);
    expect(isRecurringPaidForPeriod(paid, '2026-05-01')).toBe(false);
    expect(isRecurringPaidForPeriod({ ...paid, lastPaidDate: '2026-01-24' }, '2026-02-01')).toBe(false);
  });
  it('defaults annual dueMonth to January and rejects invalid schedule fields', () => {
    expect(isRecurringPaidForPeriod(bill({ frequency: 'annually', dueDate: 1, lastPaidDate: '2026-01-01' }), '2026-12-31')).toBe(true);
    for (const dueMonth of [0, 13, 1.5, NaN]) {
      expect(isRecurringPaidForPeriod(bill({ frequency: 'quarterly', dueMonth, lastPaidDate: '2026-04-01' }), '2026-04-06')).toBe(false);
    }
    expect(isRecurringPaidForPeriod(bill({ frequency: 'annually', dueDate: -1, lastPaidDate: '2026-01-01' }), '2026-04-06')).toBe(false);
  });
});
