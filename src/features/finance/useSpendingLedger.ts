/**
 * The ledger every income and spending figure is summed from.
 *
 * Money moved between the owner's own accounts is neither income nor
 * spending, so confirmed transfers drop out here: both legs of a confirmed
 * pair, and single legs whose other side sits in an account not tracked
 * here. Each surface used to decide this for itself, and only Cash Flow did,
 * so the same month could show two different spending totals depending on
 * where you looked.
 *
 * Only figures read from this. Lists of transactions keep every row -- a
 * transfer still happened, it just was not spending.
 */

import { useMemo } from 'react';
import { transferExcludedTransactionIds } from '@/lib/finance/transfer-detection';
import { useFinanceData } from './FinanceDataContext';
import type { MockTransaction } from './finance-types';

export function useSpendingLedger(): {
  ledger: MockTransaction[];
  /** True when the exclusions could not load, so totals may count transfers. */
  exclusionsUnreliable: boolean;
} {
  const { mockTransactions, transferLinks, transferSingleLegs, transferExclusionsFailed } = useFinanceData();

  const excludedIds = useMemo(
    () => transferExcludedTransactionIds(transferLinks, transferSingleLegs),
    [transferLinks, transferSingleLegs],
  );

  const ledger = useMemo(
    () => (excludedIds.size === 0 ? mockTransactions : mockTransactions.filter(tx => !excludedIds.has(tx.id))),
    [mockTransactions, excludedIds],
  );

  return { ledger, exclusionsUnreliable: transferExclusionsFailed };
}
