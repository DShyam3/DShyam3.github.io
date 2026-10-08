/**
 * The finance context, handed over by the Finance page while it is mounted.
 *
 * Finance data lives in `FinanceDataProvider`, which only the Finance page
 * mounts. Rather than mount a second copy for the assistant -- twenty-odd
 * table reads and save paths racing the first -- the page publishes the tool
 * context it already computes (`FinanceAssistantSource`), and the assistant
 * reads it at the moment a finance tool runs. Off the Finance page it is null,
 * and the finance tools say so.
 */

import type { FinanceToolContext } from '@/lib/finance/tools';

let current: FinanceToolContext | null = null;

export function publishFinanceToolContext(context: FinanceToolContext | null): void {
  current = context;
}

export function readFinanceToolContext(): FinanceToolContext | null {
  return current;
}
