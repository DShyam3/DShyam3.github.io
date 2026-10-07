import { describe, expect, it } from 'vitest';
import {
  findPayslipTransactionCandidates,
  unambiguousPayslipMatches,
  type PayslipTransactionCandidate,
  type ReconciliationTransaction,
} from './payslip-reconciliation';
import type { Payslip } from './payslip';

const payslip = (overrides: Partial<Payslip> = {}): Payslip => ({
  id: 'august-pay',
  payDate: '2026-08-28',
  employer: 'Acme Limited',
  gross: 3000,
  incomeTax: 400,
  nationalInsurance: 200,
  pensionEmployee: 100,
  pensionEmployer: 100,
  studentLoan: 0,
  otherDeductions: 0,
  net: 2300,
  ...overrides,
});

const transaction = (overrides: Partial<ReconciliationTransaction> = {}): ReconciliationTransaction => ({
  id: 'salary',
  date: '2026-08-28',
  name: 'ACME PAYROLL',
  amount: -2300,
  ...overrides,
});

describe('findPayslipTransactionCandidates', () => {
  it('offers an exact incoming take-home payment on the pay date', () => {
    expect(findPayslipTransactionCandidates(payslip(), [transaction()])).toEqual([
      expect.objectContaining({
        payslipId: 'august-pay', transactionId: 'salary', daysApart: 0, employerMentioned: true,
      }),
    ]);
  });

  it('allows a short posting delay, including across a month boundary', () => {
    const candidates = findPayslipTransactionCandidates(
      payslip({ payDate: '2026-08-31' }),
      [transaction({ date: '2026-09-02' })],
    );

    expect(candidates[0]?.daysApart).toBe(2);
  });

  it('finds a payment made early anywhere in the pay month', () => {
    const candidates = findPayslipTransactionCandidates(
      payslip({ payDate: '2025-12-31' }),
      [transaction({ date: '2025-12-23' }), transaction({ id: 'start-of-month', date: '2025-12-01' })],
    );

    expect(candidates.map(candidate => [candidate.transactionId, candidate.daysApart])).toEqual([
      ['salary', 8], ['start-of-month', 30],
    ]);
  });

  it('never proposes outgoing, differently valued, stale, or malformed transactions', () => {
    const candidates = findPayslipTransactionCandidates(payslip(), [
      transaction({ id: 'outgoing', amount: 2300 }),
      transaction({ id: 'wrong-amount', amount: -2299.99 }),
      transaction({ id: 'previous-month', date: '2026-07-28' }),
      transaction({ id: 'next-month', date: '2026-09-03' }),
      transaction({ id: 'bad-date', date: '28/08/2026' }),
      transaction({ id: 'timestamp-in-pay-month', date: '2026-08-28T00:00:00Z' }),
      transaction({ id: 'impossible-day-in-pay-month', date: '2026-08-32' }),
    ]);

    expect(candidates).toEqual([]);
  });

  it('orders the nearest match first, then a reference that mentions the employer', () => {
    const candidates = findPayslipTransactionCandidates(payslip(), [
      transaction({ id: 'near-no-name', name: 'BACS CREDIT' }),
      transaction({ id: 'near-employer', name: 'ACME PAYROLL' }),
      transaction({ id: 'later-employer', date: '2026-08-29', name: 'ACME PAYROLL' }),
    ]);

    expect(candidates.map(candidate => candidate.transactionId)).toEqual([
      'near-employer', 'near-no-name', 'later-employer',
    ]);
  });

  it('does not make a candidate for an empty or non-positive take-home amount', () => {
    expect(findPayslipTransactionCandidates(payslip({ net: 0 }), [transaction({ amount: 0 })])).toEqual([]);
  });
});

describe('unambiguousPayslipMatches', () => {
  const candidate = (
    payslipId: string,
    transactionId: string,
    daysApart = 0,
  ): PayslipTransactionCandidate => ({
    payslipId, transactionId, daysApart, date: '2023-01-27', name: 'KEYSIGHT', amount: -1331.36, employerMentioned: true,
  });

  it('offers each unlinked payslip whose only candidate landed on the pay date', () => {
    const matches = unambiguousPayslipMatches(new Map([
      ['jan', [candidate('jan', 'tx-jan')]],
      ['feb', [candidate('feb', 'tx-feb')]],
    ]), new Set());

    expect(matches).toEqual([
      { payslipId: 'jan', transactionId: 'tx-jan' },
      { payslipId: 'feb', transactionId: 'tx-feb' },
    ]);
  });

  it('leaves linked, early, contested and multi-candidate payslips for review one at a time', () => {
    const matches = unambiguousPayslipMatches(new Map([
      ['linked', [candidate('linked', 'tx-linked')]],
      ['early', [candidate('early', 'tx-early', 3)]],
      ['two-candidates', [candidate('two-candidates', 'tx-a'), candidate('two-candidates', 'tx-b')]],
      ['shared-1', [candidate('shared-1', 'tx-shared')]],
      ['shared-2', [candidate('shared-2', 'tx-shared')]],
      ['none', []],
    ]), new Set(['linked']));

    expect(matches).toEqual([]);
  });

  it('does not count a linked payslip as a rival for the same transaction', () => {
    const matches = unambiguousPayslipMatches(new Map([
      ['linked', [candidate('linked', 'tx-shared')]],
      ['open', [candidate('open', 'tx-shared')]],
    ]), new Set(['linked']));

    expect(matches).toEqual([{ payslipId: 'open', transactionId: 'tx-shared' }]);
  });
});
