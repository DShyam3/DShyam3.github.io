/**
 * Money that may never have left the household: proposed transfer pairs.
 *
 * `findTransferPairCandidates` only proposes -- an amount and a date agreeing
 * is evidence, not proof, and a person confirming each pair is what makes it
 * count against income and spending (transfer-detection.ts). This is that
 * confirmation surface: pending pairs to accept, and confirmed ones to undo.
 */

import { useMemo } from 'react';
import { useFinanceData } from '../FinanceDataContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatGBP } from '@/features/finance/utils/calculations';
import { formatDate } from '@/lib/format-date';
import {
  findTransferCycles, findTransferPairCandidates,
  type TransferCandidateTransaction, type TransferPairCandidate, type TransferSignal,
} from '@/lib/finance/transfer-detection';
import { X } from 'lucide-react';

const SIGNAL_LABEL: Record<Exclude<TransferSignal, 'exact_amount'>, string> = {
  same_day: 'Same day',
  provider_says_transfer: 'Bank calls it a transfer',
  name_suggests_transfer: 'Name says transfer',
  savings_category: 'Savings category',
};

export function TransferReviewSection() {
  const { mockTransactions, bankAccounts, transferLinks, saveTransferLink, deleteTransferLink } = useFinanceData();

  const accountName = (id: string | null | undefined): string =>
    (id && bankAccounts.find(account => account.id === id)?.name) || 'Unknown account';

  const transactionName = (id: string): string =>
    mockTransactions.find(transaction => transaction.id === id)?.name ?? 'Unknown transaction';

  const linkedIds = useMemo(() => {
    const ids = new Set<string>();
    for (const link of transferLinks) {
      ids.add(link.outflowTransactionId);
      ids.add(link.inflowTransactionId);
    }
    return ids;
  }, [transferLinks]);

  const allCandidates = useMemo(() => {
    const candidateTransactions: TransferCandidateTransaction[] = mockTransactions.map(tx => ({
      id: tx.id,
      date: tx.date,
      name: tx.name,
      amount: tx.amount,
      accountId: tx.bankAccountId || tx.accountId || null,
      category: tx.category,
      providerCategory: undefined,
    }));
    return findTransferPairCandidates(candidateTransactions);
  }, [mockTransactions]);

  const pending = useMemo(
    () => allCandidates.filter(pair => !linkedIds.has(pair.outflowId) && !linkedIds.has(pair.inflowId)),
    [allCandidates, linkedIds],
  );

  const cycles = useMemo(() => findTransferCycles(pending), [pending]);

  if (pending.length === 0 && transferLinks.length === 0) return null;

  return (
    <div className="surface-card rounded-xl border border-border/40 bg-card/50 p-5 hover:border-border/80 transition-colors space-y-4">
      <div className="min-w-0">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground font-mono">Possible transfers</h3>
        <p className="text-xs text-muted-foreground font-mono mt-0.5">
          Same amount, close dates, different accounts -- that is evidence, not proof.
          Confirm a pair and it stops counting as income or spending.
        </p>
      </div>

      {cycles.map((cycle, index) => (
        <p key={index} className="text-xs text-muted-foreground font-mono">
          {cycle.accountPath.map(accountName).join(' → ')}, {formatGBP(cycle.totalMoved)} moved
        </p>
      ))}

      {pending.length > 0 && (
        <div className="space-y-1.5">
          {pending.map(pair => (
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
              <Button
                size="sm"
                onClick={() => void saveTransferLink(pair.outflowId, pair.inflowId)}
                className="h-7 rounded-lg bg-primary text-primary-foreground text-xs font-mono shrink-0"
              >
                Confirm
              </Button>
            </div>
          ))}
        </div>
      )}

      {transferLinks.length > 0 && (
        <div className="space-y-1.5 pt-1 border-t border-border/20">
          {transferLinks.map(link => (
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
        </div>
      )}
    </div>
  );
}
