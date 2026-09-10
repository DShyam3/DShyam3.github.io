import { describe, expect, it } from 'vitest';
import { findPayslipTransactionCandidates, type ReconciliationTransaction } from './payslip-reconciliation';
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

  it('never proposes outgoing, differently valued, stale, or malformed transactions', () => {
    const candidates = findPayslipTransactionCandidates(payslip(), [
      transaction({ id: 'outgoing', amount: 2300 }),
      transaction({ id: 'wrong-amount', amount: -2299.99 }),
      transaction({ id: 'too-old', date: '2026-08-22' }),
      transaction({ id: 'bad-date', date: '28/08/2026' }),
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
