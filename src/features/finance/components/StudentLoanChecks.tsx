/**
 * Is SLC charging what it should? The model's rate set against the rate two of
 * SLC's own balances imply, and the balance rebuilt from borrowing set against
 * the latest one.
 *
 * Every figure comes from `lib/finance`: `studentLoanReadingCheck` does the
 * whole comparison for a pair of readings, given the simulation re-run from the
 * first, and `simulateStudentLoan` supplies `anchorCheck`. This only gathers
 * the inputs and phrases the answer.
 */

import { useMemo } from 'react';
import { formatGBP } from '@/features/finance/utils/calculations';
import { formatDayMonth } from '@/lib/format-date';
import {
  MIN_RATE_CHECK_DAYS,
  studentLoanReadingCheck,
  type BalanceReading,
  type StudentLoanDatedAmount,
  type StudentLoanRateCheck,
  type StudentLoanReadingChecked,
  type StudentLoanSimResult,
} from '@/lib/finance';

type SimulateFrom = (anchor: BalanceReading) => StudentLoanSimResult;

const pct = (rate: number) => `${rate.toFixed(2)}%`;

/** "your last payslip deduction (£171.00)" / "your last 2 payslip deductions (£342.00)". */
const lastDeductions = (w: NonNullable<StudentLoanRateCheck['withoutLatest']>) =>
  `your last ${w.count === 1 ? 'payslip deduction' : `${w.count} payslip deductions`} (${formatGBP(w.amount)})`;

/** What the income-linked interest the model expected has to do with the result, if anything. */
const topUpNote = (c: StudentLoanReadingChecked) =>
  c.withoutTopUp
    ? `That matches if the ${formatGBP(c.topUpAssumed)} of income-linked interest the model expected by then has not landed yet.`
    : c.verdict === 'matches' && c.topUpAssumed > 0
      ? `Allows for ${formatGBP(c.topUpAssumed)} of income-linked interest the model expects to have landed by then.`
      : '';

/** For a balance typed but not yet saved: the rate it implies, and any late money that would explain a gap. */
export const impliedRateNote = (from: BalanceReading, c: StudentLoanReadingChecked) =>
  [
    `That implies SLC charged ${pct(c.impliedRate)} a year since ${formatDayMonth(from.date)}; the model expects ${pct(c.expectedRate)}.`,
    c.withoutLatest && `That matches if SLC hasn't yet received ${lastDeductions(c.withoutLatest)}.`,
    topUpNote(c),
  ].filter(Boolean).join(' ');

function rateLine(c: StudentLoanReadingChecked) {
  const rates = `SLC charged ${pct(c.impliedRate)} a year; the model expects ${pct(c.expectedRate)}.`;
  const w = c.withoutLatest;
  const verdict = c.verdict === 'matches'
    ? `${rates} That matches.`
    : c.verdict === 'higher'
      ? w
        ? `${rates} SLC's balance is ${formatGBP(c.gap)} higher than that rate explains, which matches if SLC hasn't yet received ${lastDeductions(w)}. HMRC passes them on with a delay.`
        : `SLC charged more than expected (${pct(c.impliedRate)} against ${pct(c.expectedRate)}). Check for a missed payment or a top-up that landed.`
      : `SLC charged less than expected (${pct(c.impliedRate)} against ${pct(c.expectedRate)}). A payment or refund missing here usually explains it.`;
  return [verdict, topUpNote(c)].filter(Boolean).join(' ');
}

export function StudentLoanChecks({
  observations,
  payments,
  adjustments,
  simulateFrom,
  anchorCheck,
  hasBorrowing,
}: {
  /** SLC's verified balances, oldest first, each on the date SLC shows. */
  observations: BalanceReading[];
  /** Payroll deductions: positive amounts. */
  payments: StudentLoanDatedAmount[];
  /** Signed: borrowing and refunds raise the balance, payments you made lower it. */
  adjustments: StudentLoanDatedAmount[];
  /** The projection re-run from a different verified balance. */
  simulateFrom: SimulateFrom;
  anchorCheck: StudentLoanSimResult['anchorCheck'];
  hasBorrowing: boolean;
}) {
  const lines = useMemo(() => {
    const out: { key: string; text: string }[] = [];
    if (observations.length === 1) {
      out.push({
        key: 'next',
        text: `Record your next SLC balance to see the rate SLC actually charged since ${formatDayMonth(observations[0].date, { withYear: true })}.`,
      });
    }
    // Newest pair first, three at most.
    for (let i = observations.length - 1; i >= Math.max(1, observations.length - 3); i--) {
      const from = observations[i - 1];
      const to = observations[i];
      const check = studentLoanReadingCheck({ from, to, payments, adjustments, months: simulateFrom(from).months });
      const span = `${formatDayMonth(from.date)} to ${formatDayMonth(to.date, { withYear: true })}`;
      if (check.status === 'checked') out.push({ key: `pair-${i}`, text: `${span}: ${rateLine(check)}` });
      else if (check.status === 'too_close') {
        out.push({ key: `pair-${i}`, text: `${span}: Too close together to tell (${check.days} days apart; it needs ${MIN_RATE_CHECK_DAYS}).` });
      }
    }
    return out;
  }, [observations, payments, adjustments, simulateFrom]);

  const rebuilt = (() => {
    if (!anchorCheck) return hasBorrowing ? null : 'Add what you borrowed in Edit to rebuild the balance from scratch and check SLC\'s figure.';
    // Without a verified balance the run is anchored on the balance saved on the loan, which is not SLC's.
    if (observations.length === 0) return null;
    const { gap } = anchorCheck;
    const difference = gap === 0 ? 'the same as SLC' : `${formatGBP(Math.abs(gap))} ${gap > 0 ? 'higher' : 'lower'} at SLC`;
    return `Rebuilt from what you borrowed: ${formatGBP(anchorCheck.rebuiltBalance)} on ${formatDayMonth(anchorCheck.date, { withYear: true })}, against SLC's ${formatGBP(anchorCheck.slcBalance)} (${difference}). Repayments before your first payslip are estimated from salary.`;
  })();

  if (lines.length === 0 && !rebuilt) return null;

  return (
    <div className="space-y-2 border-t border-border/40 pt-5">
      <h4 className="text-sm font-semibold">Checking SLC&apos;s figures</h4>
      <ul className="space-y-1.5 text-xs text-muted-foreground">
        {lines.map(l => <li key={l.key}>{l.text}</li>)}
        {rebuilt && <li>{rebuilt}</li>}
      </ul>
    </div>
  );
}
