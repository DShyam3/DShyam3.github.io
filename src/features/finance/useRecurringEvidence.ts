/**
 * The latest bank payment matching each recurring bill, keyed by bill id.
 *
 * One implementation for the Recurrings tab (and its calendar) and for the
 * forecast, so the two never disagree about which bills the bank shows as
 * paid. Empty while recurring data loads, and while transfers fail to load: a
 * transfer left in the ledger could otherwise be read as a bill payment.
 *
 * `recurringPaymentEvidence` scans the whole ledger once per bill, so callers
 * pass `enabled` and it runs only for the view that shows it.
 */

import { useMemo } from 'react';
import { format } from 'date-fns';
import { recurringPaymentEvidence } from '@/lib/finance/recurring-detection';
import { useFinanceData } from './FinanceDataContext';
import { useSpendingLedger } from './useSpendingLedger';
import type { MockTransaction } from './finance-types';

export function useRecurringEvidence(enabled: boolean): ReadonlyMap<string, MockTransaction> {
  const { allRecurrings, recurringDataReady } = useFinanceData();
  const { ledger, exclusionsUnreliable } = useSpendingLedger();
  const today = format(new Date(), 'yyyy-MM-dd');

  return useMemo(
    () => new Map((enabled && recurringDataReady && !exclusionsUnreliable ? allRecurrings : []).flatMap(bill => {
      const payment = recurringPaymentEvidence(ledger, bill, today);
      return payment ? [[bill.id, payment] as const] : [];
    })),
    [enabled, recurringDataReady, exclusionsUnreliable, allRecurrings, ledger, today],
  );
}
