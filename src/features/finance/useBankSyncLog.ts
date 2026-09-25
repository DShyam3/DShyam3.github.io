/**
 * The bank sync run log, read from `finance_sync_log`.
 *
 * Only truelayer-sync writes it, one row per run. Bank connections belong to
 * the operator's own profile whichever profile is being viewed, so this reads
 * every row RLS allows rather than scoping to the active profile -- the same
 * rule `check_connection` follows.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { parseBankResults, type BankSyncLogRow } from './bank-sync-history';

export const BANK_SYNC_LOG_QUERY_KEY = ['finance', 'bank-sync-log'] as const;

/** A month of nightly runs plus the manual ones in between. */
const LOG_LIMIT = 60;

export function useBankSyncLog(enabled = true) {
  return useQuery({
    queryKey: BANK_SYNC_LOG_QUERY_KEY,
    enabled,
    queryFn: async (): Promise<BankSyncLogRow[]> => {
      const { data, error } = await supabase
        .from('finance_sync_log')
        .select('id, synced_at, trigger, status, duration_ms, connections_synced, accounts_synced, transactions_synced, transactions_new, banks, error_message')
        .order('synced_at', { ascending: false })
        .limit(LOG_LIMIT);
      if (error) throw error;
      return (data ?? []).map(row => ({
        ...row,
        trigger: row.trigger === 'manual' ? 'manual' : 'scheduled',
        status: row.status === 'partial' || row.status === 'error' ? row.status : 'success',
        banks: parseBankResults(row.banks),
      }));
    },
  });
}
