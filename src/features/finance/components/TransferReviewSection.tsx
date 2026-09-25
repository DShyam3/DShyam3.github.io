/**
 * Money that may never have left the household: proposed transfer pairs.
 *
 * `findTransferPairCandidates` only proposes -- an amount and a date agreeing
 * is evidence, not proof, and a person confirming each pair is what makes it
 * count against income and spending (transfer-detection.ts). This is that
 * confirmation surface: pending pairs to accept, and confirmed ones to undo.
 *
 * Below the pairs sit one-sided transfers: rows the bank or their name call a
 * transfer, with no matching leg in any tracked account. The other side may be
 * an account of the owner's not tracked here -- or another person. Only the
 * owner knows which, so each one waits for a verdict.
 */

import { useMemo, useState } from 'react';
import { useFinanceData } from '../FinanceDataContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatGBP } from '@/features/finance/utils/calculations';
import { formatDate } from '@/lib/format-date';
import {
  findSingleLegTransferCandidates, findTransferCycles, findTransferPairCandidates,
  TRANSFER_MATCH_WINDOW_DAYS, transferPairKey,
  type SingleLegSignal, type TransferCandidateTransaction, type TransferSignal,
} from '@/lib/finance/transfer-detection';
import { RotateCcw, X } from 'lucide-react';

/** Rows of each list shown before "Show all". Every queue here can reach
 *  back years, and they sit above the transaction list, so drawing them all
 *  slows the whole tab. */
const PREVIEW = 5;

const SIGNAL_LABEL: Record<Exclude<TransferSignal, 'exact_amount'>, string> = {
  same_day: 'Same day',
  provider_says_transfer: 'Bank calls it a transfer',
  name_suggests_transfer: 'Name says transfer',
  savings_category: 'Savings category',
};

export function TransferReviewSection() {
  const {
    mockTransactions, bankAccounts,
    transferLinks, transferExclusionsFailed, saveTransferLink, deleteTransferLink,
    transferDismissals, dismissTransferPair, restoreTransferPair,
    transferSingleLegs, decideTransferSingleLeg, undoTransferSingleLeg,
  } = useFinanceData();
  const [showDismissed, setShowDismissed] = useState(false);
  const [showAllSingleLegs, setShowAllSingleLegs] = useState(false);
  const [showAllPending, setShowAllPending] = useState(false);
  const [showAllLinks, setShowAllLinks] = useState(false);
  const [showExternalLegs, setShowExternalLegs] = useState(false);

  const accountName = (id: string | null | undefined): string =>
    (id && bankAccounts.find(account => account.id === id)?.name) || 'Unknown account';

  const namesById = useMemo(
    () => new Map(mockTransactions.map(transaction => [transaction.id, transaction.name])),
    [mockTransactions],
  );
  const transactionName = (id: string): string => namesById.get(id) ?? 'Unknown transaction';

  const linkedIds = useMemo(() => {
    const ids = new Set<string>();
    for (const link of transferLinks) {
      ids.add(link.outflowTransactionId);
      ids.add(link.inflowTransactionId);
    }
    return ids;
  }, [transferLinks]);

  const dismissedKeys = useMemo(
    () => new Set(transferDismissals.map(d => transferPairKey(d.outflowTransactionId, d.inflowTransactionId))),
    [transferDismissals],
  );

  /* Legs of a confirmed link are left out before pairing, not filtered out of
     the result afterwards: a row already spoken for must not claim the
     closest match for an unconfirmed one. */
  const candidateTransactions = useMemo(
    (): TransferCandidateTransaction[] => mockTransactions.map(tx => ({
      id: tx.id,
      date: tx.date,
      name: tx.name,
      amount: tx.amount,
      accountId: tx.bankAccountId || tx.accountId || null,
      category: tx.category,
      providerCategory: tx.providerCategory,
    })),
    [mockTransactions],
  );

  const pending = useMemo(
    () => findTransferPairCandidates(
      candidateTransactions.filter(tx => !linkedIds.has(tx.id)),
      TRANSFER_MATCH_WINDOW_DAYS,
      dismissedKeys,
    ),
    [candidateTransactions, linkedIds, dismissedKeys],
  );

  const cycles = useMemo(() => findTransferCycles(pending), [pending]);

  /* A row already in a pair -- confirmed or still proposed -- is answered
     there, and a row with a verdict is answered already. */
  const singleLegs = useMemo(() => {
    const answered = new Set(linkedIds);
    for (const pair of pending) {
      answered.add(pair.outflowId);
      answered.add(pair.inflowId);
    }
    for (const decision of transferSingleLegs) answered.add(decision.transactionId);
    return findSingleLegTransferCandidates(candidateTransactions, answered);
  }, [candidateTransactions, linkedIds, pending, transferSingleLegs]);

  const internalLegs = transferSingleLegs.filter(decision => decision.verdict === 'internal');
  const externalLegs = transferSingleLegs.filter(decision => decision.verdict === 'external');
  const visibleSingleLegs = showAllSingleLegs ? singleLegs : singleLegs.slice(0, PREVIEW);

  const accountOf = (id: string): string | null => {
    const tx = mockTransactions.find(transaction => transaction.id === id);
    return tx ? (tx.bankAccountId || tx.accountId || null) : null;
  };

  if (
    pending.length === 0 && transferLinks.length === 0
    && transferDismissals.length === 0 && singleLegs.length === 0
    && transferSingleLegs.length === 0 && !transferExclusionsFailed
  ) return null;

  return (
    <div className="surface-card rounded-xl border border-border/40 bg-card/50 p-5 hover:border-border/80 transition-colors space-y-4">
      <div className="min-w-0">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground font-mono">Possible transfers</h3>
        <p className="text-xs text-muted-foreground font-mono mt-0.5">
          Same amount, close dates, different accounts -- that is evidence, not proof.
          Confirm a pair and it stops counting as income or spending.
        </p>
        {transferExclusionsFailed && (
          <p role="alert" className="text-xs text-destructive font-mono mt-1.5">
            Confirmed transfers could not load. Rows already answered show here
            again, and income and spending include them until they do.
          </p>
        )}
      </div>

      {cycles.map((cycle, index) => (
        <p key={index} className="text-xs text-muted-foreground font-mono">
          {cycle.accountPath.map(accountName).join(' → ')}, {formatGBP(cycle.totalMoved)} moved
        </p>
      ))}

      {pending.length > 0 && (
        <div className="space-y-1.5">
          {(showAllPending ? pending : pending.slice(0, PREVIEW)).map(pair => (
            <div
              key={`${pair.outflowId}_${pair.inflowId}`}
              className="flex items-center gap-3 rounded-lg border border-border/40 bg-card/40 px-3 py-2"
            >
              <div className="min-w-0 flex-1 space-y-1">
                <div className="text-xs font-semibold text-foreground font-mono truncate">
                  {transactionName(pair.outflowId)} ({accountName(pair.fromAccountId)})
                  {' → '}
                  {transactionName(pair.inflowId)} ({accountName(pair.toAccountId)})
                </div>
                <div className="text-xs text-muted-foreground font-mono">
                  {formatGBP(pair.amount)} · {pair.daysApart === 0 ? 'same day' : `${pair.daysApart} day${pair.daysApart === 1 ? '' : 's'} apart`}
                </div>
                <div className="flex flex-wrap gap-1">
                  {pair.signals
                    .filter((signal): signal is Exclude<TransferSignal, 'exact_amount'> => signal !== 'exact_amount')
                    .map(signal => (
                      <Badge key={signal} variant="outline" className="text-xs font-mono border-border/40 text-muted-foreground">
                        {SIGNAL_LABEL[signal]}
                      </Badge>
                    ))}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => void dismissTransferPair(pair.outflowId, pair.inflowId)}
                  className="h-7 rounded-lg text-xs font-mono text-muted-foreground"
                >
                  Not a transfer
                </Button>
                <Button
                  size="sm"
                  onClick={() => void saveTransferLink(pair.outflowId, pair.inflowId)}
                  className="h-7 rounded-lg bg-primary text-primary-foreground text-xs font-mono"
                >
                  Confirm
                </Button>
              </div>
            </div>
          ))}
          {pending.length > PREVIEW && (
            <button
              type="button"
              onClick={() => setShowAllPending(open => !open)}
              aria-expanded={showAllPending}
              className="text-xs font-mono text-muted-foreground hover:text-foreground"
            >
              {showAllPending ? 'Show fewer' : `Show all ${pending.length}`}
            </button>
          )}
        </div>
      )}

      {transferLinks.length > 0 && (
        <div className="space-y-1.5 pt-1 border-t border-border/20">
          {(showAllLinks ? transferLinks : transferLinks.slice(0, PREVIEW)).map(link => (
            <div
              key={link.id}
              className="flex items-center gap-3 rounded-lg border border-border/20 bg-card/20 px-3 py-1.5 text-muted-foreground"
            >
              <div className="min-w-0 flex-1 text-xs font-mono truncate">
                {transactionName(link.outflowTransactionId)} {'→'} {transactionName(link.inflowTransactionId)}
                <span className="text-muted-foreground/60"> · confirmed as a transfer</span>
              </div>
              <button
                type="button"
                onClick={() => void deleteTransferLink(link.id)}
                className="text-muted-foreground hover:text-destructive shrink-0"
                aria-label="Undo this transfer link"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          {transferLinks.length > PREVIEW && (
            <button
              type="button"
              onClick={() => setShowAllLinks(open => !open)}
              aria-expanded={showAllLinks}
              className="text-xs font-mono text-muted-foreground hover:text-foreground"
            >
              {showAllLinks ? 'Show fewer' : `Show all ${transferLinks.length}`}
            </button>
          )}
        </div>
      )}

      {transferDismissals.length > 0 && (
        <div className="space-y-1.5 pt-1 border-t border-border/20">
          <button
            type="button"
            onClick={() => setShowDismissed(open => !open)}
            aria-expanded={showDismissed}
            className="text-xs font-mono text-muted-foreground hover:text-foreground"
          >
            {transferDismissals.length} dismissed {transferDismissals.length === 1 ? 'pair' : 'pairs'}
            {showDismissed ? ' · hide' : ' · show'}
          </button>
          {showDismissed && transferDismissals.map(dismissal => (
            <div
              key={dismissal.id}
              className="flex items-center gap-3 rounded-lg border border-border/20 bg-card/20 px-3 py-1.5 text-muted-foreground"
            >
              <div className="min-w-0 flex-1 text-xs font-mono truncate">
                {transactionName(dismissal.outflowTransactionId)} {'→'} {transactionName(dismissal.inflowTransactionId)}
                <span className="text-muted-foreground/60"> · not a transfer</span>
              </div>
              <button
                type="button"
                onClick={() => void restoreTransferPair(dismissal.id)}
                className="text-muted-foreground hover:text-foreground shrink-0"
                aria-label="Put this pair back up for review"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {(singleLegs.length > 0 || transferSingleLegs.length > 0) && (
        <div className="space-y-2 pt-3 border-t border-border/20">
          <div className="min-w-0">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground font-mono">One-sided transfers</h4>
            <p className="text-xs text-muted-foreground font-mono mt-0.5">
              Called a transfer, but nothing matching arrived in or left another
              tracked account. If the other side is an account of yours not
              tracked here, it is not spending or income.
            </p>
          </div>

          {visibleSingleLegs.map(leg => (
            <div
              key={leg.transactionId}
              className="flex flex-wrap items-center gap-3 rounded-lg border border-border/40 bg-card/40 px-3 py-2"
            >
              <div className="min-w-0 flex-1 space-y-1">
                <div className="text-xs font-semibold text-foreground font-mono truncate">
                  {transactionName(leg.transactionId)} ({accountName(leg.accountId)})
                </div>
                <div className="text-xs text-muted-foreground font-mono">
                  {leg.direction === 'out' ? '−' : '+'}{formatGBP(leg.amount)} · {formatDate(leg.date)}
                </div>
                <div className="flex flex-wrap gap-1">
                  {leg.signals.map((signal: SingleLegSignal) => (
                    <Badge key={signal} variant="outline" className="text-xs font-mono border-border/40 text-muted-foreground">
                      {SIGNAL_LABEL[signal]}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => void decideTransferSingleLeg(leg.transactionId, 'external')}
                  className="h-7 rounded-lg text-xs font-mono text-muted-foreground"
                >
                  {leg.direction === 'out' ? 'Real spending' : 'Real income'}
                </Button>
                <Button
                  size="sm"
                  onClick={() => void decideTransferSingleLeg(leg.transactionId, 'internal')}
                  className="h-7 rounded-lg bg-primary text-primary-foreground text-xs font-mono"
                >
                  My own account
                </Button>
              </div>
            </div>
          ))}

          {singleLegs.length > PREVIEW && (
            <button
              type="button"
              onClick={() => setShowAllSingleLegs(open => !open)}
              aria-expanded={showAllSingleLegs}
              className="text-xs font-mono text-muted-foreground hover:text-foreground"
            >
              {showAllSingleLegs ? 'Show fewer' : `Show all ${singleLegs.length}`}
            </button>
          )}

          {internalLegs.map(decision => (
            <div
              key={decision.id}
              className="flex items-center gap-3 rounded-lg border border-border/20 bg-card/20 px-3 py-1.5 text-muted-foreground"
            >
              <div className="min-w-0 flex-1 text-xs font-mono truncate">
                {transactionName(decision.transactionId)} ({accountName(accountOf(decision.transactionId))})
                <span className="text-muted-foreground/60"> · your own account, not counted</span>
              </div>
              <button
                type="button"
                onClick={() => void undoTransferSingleLeg(decision.id)}
                className="text-muted-foreground hover:text-destructive shrink-0"
                aria-label="Count this as spending or income again"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}

          {externalLegs.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => setShowExternalLegs(open => !open)}
                aria-expanded={showExternalLegs}
                className="text-xs font-mono text-muted-foreground hover:text-foreground"
              >
                {externalLegs.length} marked as real spending or income
                {showExternalLegs ? ' · hide' : ' · show'}
              </button>
              {showExternalLegs && externalLegs.map(decision => (
                <div
                  key={decision.id}
                  className="flex items-center gap-3 rounded-lg border border-border/20 bg-card/20 px-3 py-1.5 text-muted-foreground"
                >
                  <div className="min-w-0 flex-1 text-xs font-mono truncate">
                    {transactionName(decision.transactionId)}
                    <span className="text-muted-foreground/60"> · real spending or income</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => void undoTransferSingleLeg(decision.id)}
                    className="text-muted-foreground hover:text-foreground shrink-0"
                    aria-label="Put this back up for review"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
