/**
 * Deterministic suggestions for connecting a payslip to a bank transaction.
 *
 * This deliberately does not create links. A bank's payment reference is not
 * reliable enough to be proof of employment, so the caller presents these
 * candidates for a person to confirm (REHAUL_PLAN.md 7.8).
 */

import type { Payslip } from './payslip';

/** Ledger amounts are positive for money spent and negative for money received. */
export interface ReconciliationTransaction {
  id: string;
  date: string;
  name: string;
  merchant?: string;
  amount: number;
}

export interface PayslipTransactionCandidate {
  payslipId: string;
  transactionId: string;
  date: string;
  name: string;
  amount: number;
  /** Absolute number of calendar days from payslip pay date to bank posting. */
  daysApart: number;
  /** A useful tie-breaker only; never enough to confirm a link automatically. */
  employerMentioned: boolean;
}

export const PAYSLIP_MATCH_WINDOW_DAYS = 5;

const pence = (amount: number): number => Math.round(amount * 100);

const dateAtMidnightUtc = (value: string): number | undefined => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return undefined;
  const [, year, month, day] = match;
  const timestamp = Date.UTC(Number(year), Number(month) - 1, Number(day));
  const parsed = new Date(timestamp);
  if (
    parsed.getUTCFullYear() !== Number(year)
    || parsed.getUTCMonth() !== Number(month) - 1
    || parsed.getUTCDate() !== Number(day)
  ) return undefined;
  return timestamp;
};

const employerTokens = (employer: string | undefined): string[] =>
  (employer ?? '')
    .toLocaleLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(token => token.length >= 3 && !['ltd', 'limited', 'llp', 'plc', 'the'].includes(token));

const mentionsEmployer = (payslip: Payslip, transaction: ReconciliationTransaction): boolean => {
  const reference = `${transaction.name} ${transaction.merchant ?? ''}`.toLocaleLowerCase();
  return employerTokens(payslip.employer).some(token => reference.includes(token));
};

/**
 * Finds the small set of exact, incoming take-home payments worth reviewing.
 *
 * An amount is compared as pence rather than floating point. The date window
 * allows for weekend and bank-processing delays; it is not a guess at which
 * transaction is correct. Results are ordered deterministically for the UI.
 */
export const findPayslipTransactionCandidates = (
  payslip: Payslip,
  transactions: readonly ReconciliationTransaction[],
): PayslipTransactionCandidate[] => {
  const payDate = dateAtMidnightUtc(payslip.payDate);
  const takeHomePence = pence(payslip.net);
  if (payDate === undefined || takeHomePence <= 0) return [];

  return transactions
    .flatMap(transaction => {
      const transactionDate = dateAtMidnightUtc(transaction.date);
      const daysApart = transactionDate === undefined
        ? Number.POSITIVE_INFINITY
        : Math.abs(transactionDate - payDate) / 86_400_000;
      if (
        pence(transaction.amount) !== -takeHomePence
        || daysApart > PAYSLIP_MATCH_WINDOW_DAYS
      ) return [];

      return [{
        payslipId: payslip.id,
        transactionId: transaction.id,
        date: transaction.date,
        name: transaction.name,
        amount: transaction.amount,
        daysApart,
        employerMentioned: mentionsEmployer(payslip, transaction),
      }];
    })
    .sort((left, right) => (
      left.daysApart - right.daysApart
      || Number(right.employerMentioned) - Number(left.employerMentioned)
      || left.date.localeCompare(right.date)
      || left.transactionId.localeCompare(right.transactionId)
    ));
};
