/**
 * Publishes the finance tool context for the site assistant while the Finance
 * page is open. Renders nothing, and is mounted only when an assistant
 * provider exists, so without a key it costs nothing.
 *
 * Nothing is published until every table has loaded, and loaded cleanly: a
 * context built from empty or half-read tables answers "you spent £0" or
 * "you owe nothing", which reads exactly like a real answer. `hasLoaded`
 * alone is not that -- it turns true when a load ends, failed or not -- so
 * this waits for `financeDataReady`: no load in flight and no table blocked
 * by a failed read.
 */

import { useEffect } from 'react';
import { publishFinanceToolContext } from '@/features/assistant/finance-source';
import { useFinanceData } from './FinanceDataContext';
import { useFinanceToolContext } from './useFinanceToolContext';

export function FinanceAssistantSource() {
  const { financeDataReady } = useFinanceData();
  const context = useFinanceToolContext();

  useEffect(() => {
    publishFinanceToolContext(financeDataReady ? context : null);
  }, [financeDataReady, context]);

  useEffect(() => () => publishFinanceToolContext(null), []);

  return null;
}
