import { describe, expect, it } from 'vitest';
import type { Payslip } from './payslip';
import { findPayslipReimbursementCandidates, isReimbursementLine } from './payslip-reimbursement';

const payslip: Payslip = {
  id: 'oct-pay', payDate: '2026-10-31', gross: 3000, incomeTax: 400,
  nationalInsurance: 200, pensionEmployee: 100, pensionEmployer: 100,
  studentLoan: 0, otherDeductions: 0, net: 2300,
  lines: [
    { label: 'Basic pay', amount: 3000, kind: 'payment' },
    { label: 'Travel expenses reimbursed', amount: 42.37, kind: 'payment' },
    { label: 'Expense claim', amount: 15, kind: 'deduction' },
  ],
};

describe('payslip reimbursement suggestions', () => {
  it('recognises clear reimbursement wording without treating salary or bonus as one', () => {
    expect(isReimbursementLine('EXPENSES')).toBe(true);
    expect(isReimbursementLine('Mileage reimbursement')).toBe(true);
    expect(isReimbursementLine('Basic pay')).toBe(false);
    expect(isReimbursementLine('Performance bonus')).toBe(false);
    expect(isReimbursementLine('Travel allowance')).toBe(false);
  });

  it('suggests only exact outgoing card spending before pay, nearest first', () => {
    const candidates = findPayslipReimbursementCandidates(payslip, [
      { id: 'older', date: '2026-09-01', name: 'Train', amount: 42.37 },
      { id: 'nearest', date: '2026-10-20', name: 'Hotel', amount: 42.37 },
      { id: 'incoming', date: '2026-10-20', name: 'Refund', amount: -42.37 },
      { id: 'wrong', date: '2026-10-20', name: 'Cafe', amount: 42.38 },
      { id: 'future', date: '2026-11-01', name: 'Taxi', amount: 42.37 },
      { id: 'stale', date: '2026-06-01', name: 'Rail', amount: 42.37 },
      { id: 'bad-date', date: '2026-10-32', name: 'Hotel', amount: 42.37 },
    ]);
    expect(candidates.map(candidate => candidate.transactionId)).toEqual(['nearest', 'older']);
    expect(candidates[0]).toMatchObject({ payslipId: 'oct-pay', lineIndex: 1, lineLabel: 'Travel expenses reimbursed', daysBeforePay: 11 });
  });

  it('does not suggest a deduction or a payment without reimbursement wording', () => {
    expect(findPayslipReimbursementCandidates(payslip, [
      { id: 'salary', date: '2026-10-20', name: 'Card', amount: 3000 },
      { id: 'deduction', date: '2026-10-20', name: 'Card', amount: 15 },
    ])).toEqual([]);
  });
});
