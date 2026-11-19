import { queryOptions, useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

/**
 * Route C: the index of logos cached in our own storage.
 *
 * The browser never asks a logo host for anything. The merchant-logo-cache
 * function fetches a mark once, server-side, and puts it in the
 * `merchant-logos` bucket; this reads the index of what landed there and hands
 * back public URLs on our own origin.
 *
 * Reading the index is admin-only: its slugs are the brands the owner pays, so
 * it is spend history, not public data. Stored in React Query (in-memory only,
 * never persisted to IndexedDB) so sign-out clears it automatically and bank
 * syncs can invalidate it without a page reload.
 */

export type LogoIndex = ReadonlyMap<string, string>;

const EMPTY: LogoIndex = new Map();

export const MERCHANT_LOGOS_QUERY_KEY = ['finance', 'merchant-logos'] as const;

export const merchantLogosQuery = queryOptions<LogoIndex>({
  queryKey: MERCHANT_LOGOS_QUERY_KEY,
  staleTime: 30 * 60_000,
  queryFn: async () => {
    const { data, error } = await supabase
      .from('finance_merchant_logos')
      .select('slug, storage_path')
      .not('storage_path', 'is', null);

    // A missing index is not an error worth surfacing: every row falls back to
    // its monogram, which is a complete answer on its own.
    if (error || !data) return EMPTY;

    return new Map(
      data.map(row => [
        row.slug,
        supabase.storage.from('merchant-logos').getPublicUrl(row.storage_path!).data.publicUrl,
      ]),
    );
  },
});

/** Cached merchant logos by canonical slug. Empty until the index arrives. */
export const useMerchantLogos = (): LogoIndex => {
  const { isAdmin } = useAuth();
  const { data } = useQuery({
    ...merchantLogosQuery,
    enabled: isAdmin,
  });
  return data ?? EMPTY;
};
