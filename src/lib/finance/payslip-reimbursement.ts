/** Suggestions connecting a payroll expense reimbursement to earlier card spending. */
import { epochDay } from './dates';
import type { Payslip } from './payslip';
import type { ReconciliationTransaction } from './payslip-reconciliation';

export interface PayslipReimbursementCandidate {
  payslipId: string;
  lineIndex: number;
  lineLabel: string;
  transactionId: string;
  date: string;
  name: string;
  amount: number;
  daysBeforePay: number;
}

export const REIMBURSEMENT_MATCH_WINDOW_DAYS = 120;

/** A payment line must actually describe money paid back, not ordinary pay. */
export const isReimbursementLine = (label: string): boolean =>
  /\breimburs\w*\b|\bexpenses\b|\bexpense\s+(?:claim|refund|repayment)\b|\btravel\s+expenses\b|\bmileage\s+(?:claim|reimbursement|expenses)\b/i.test(label);

/** Suggestions are evidence for a person's confirmation, never automatic proof. */
export const findPayslipReimbursementCandidates = (
  payslip: Payslip,
  transactions: readonly ReconciliationTransaction[],
): PayslipReimbursementCandidate[] => {
  const payDay = epochDay(payslip.payDate);
  if (payDay === undefined) return [];

  return (payslip.lines ?? []).flatMap((line, lineIndex) => {
    const amountPence = Math.round(line.amount * 100);
    if (line.kind !== 'payment' || !isReimbursementLine(line.label) || !Number.isFinite(line.amount) || amountPence <= 0) return [];

    return transactions.flatMap(transaction => {
      const spendDay = epochDay(transaction.date);
      const daysBeforePay = spendDay === undefined ? -1 : payDay - spendDay;
      if (
        !Number.isFinite(transaction.amount)
        || Math.round(transaction.amount * 100) !== amountPence
        || daysBeforePay < 0
        || daysBeforePay > REIMBURSEMENT_MATCH_WINDOW_DAYS
      ) return [];

      return [{
        payslipId: payslip.id,
        lineIndex,
        lineLabel: line.label,
        transactionId: transaction.id,
        date: transaction.date,
        name: transaction.name,
        amount: transaction.amount,
        daysBeforePay,
      }];
    });
  }).sort((a, b) => a.lineIndex - b.lineIndex || a.daysBeforePay - b.daysBeforePay || a.transactionId.localeCompare(b.transactionId));
};
