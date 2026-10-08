/**
 * Publishes the finance tool context for the site assistant while the Finance
 * page is open. Renders nothing, and is mounted only when an assistant
 * provider exists, so without a key it costs nothing.
 *
 * Nothing is published until the ledger has loaded, and loaded whole: a
 * context built from empty or half-read tables answers "you spent £0", which
 * reads exactly like a real answer. `hasLoaded` alone is not that -- it turns
 * true when a load ends, failed or not -- so this waits for
 * `recurringDataReady`, the one flag the context exposes that also says the
 * transactions read succeeded and no load is in flight.
 */

import { useEffect } from 'react';
import { publishFinanceToolContext } from '@/features/assistant/finance-source';
import { useFinanceData } from './FinanceDataContext';
import { useFinanceToolContext } from './useFinanceToolContext';

export function FinanceAssistantSource() {
  const { recurringDataReady } = useFinanceData();
  const context = useFinanceToolContext();

  useEffect(() => {
    publishFinanceToolContext(recurringDataReady ? context : null);
  }, [recurringDataReady, context]);

  useEffect(() => () => publishFinanceToolContext(null), []);

  return null;
}
