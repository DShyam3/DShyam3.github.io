import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { selectAllPages } from '@/integrations/supabase/select-all-pages';
import { useAuth } from '@/contexts/AuthContext';
import { discoveryKey, dismissalHandover, type DiscoveryMedia } from './discovery';

const DISMISSED_KEY = 'watchlist-discovery-dismissed-v1';
const DISMISSED_QUERY_KEY = ['watchlist', 'dismissed-suggestions'] as const;

function readDismissed(): Set<string> {
  try { const saved: unknown = JSON.parse(localStorage.getItem(DISMISSED_KEY) || '[]'); return new Set(Array.isArray(saved) ? saved.filter((key): key is string => typeof key === 'string') : []); } catch { return new Set(); }
}
function writeDismissed(keys: Set<string>) {
  try { localStorage.setItem(DISMISSED_KEY, JSON.stringify([...keys])); } catch { /* Still works for this visit. */ }
}

/**
 * Titles marked "Not interested", as `media:tmdbId` keys: this browser's copy
 * plus, once it is reachable, the owner's table shared across devices.
 */
export function useDismissedSuggestions() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [localDismissed, setLocalDismissed] = useState(readDismissed);

  // The owner's dismissals, shared across devices. Before the table exists
  // (migration not applied) the read fails and the browser copy carries on.
  const remote = useQuery({
    queryKey: DISMISSED_QUERY_KEY,
    staleTime: 5 * 60 * 1000,
    retry: false,
    queryFn: async () => {
      // Paged: dismissals only grow, and the Data API stops at 1,000 rows.
      const { data, error } = await selectAllPages((from, to) => supabase
        .from('watchlist_dismissed_suggestions')
        .select('id, media, tmdb_id', { count: 'exact' })
        .order('id', { ascending: true })
        .range(from, to), (row) => String(row.id));
      if (error) throw new Error(error.message);
      return data.map((row) => discoveryKey(row.media as DiscoveryMedia, row.tmdb_id));
    },
  });
  const ownerSynced = isAdmin && remote.isSuccess;
  const dismissed = useMemo(() => new Set([...localDismissed, ...(remote.data ?? [])]), [localDismissed, remote.data]);

  // Once the owner's table is reachable, this browser's own dismissals move
  // into it, so a reset on one device clears them on every device.
  // A key stays in the browser copy, and so stays hidden, until a read of the
  // table has it; see `dismissalHandover` for why a write alone is not enough.
  const remoteKeys = remote.data;
  const sendingRef = useRef(new Set<string>());
  useEffect(() => {
    if (!ownerSynced || localDismissed.size === 0) return;
    const { release, send } = dismissalHandover(localDismissed, remoteKeys, sendingRef.current);
    if (release.size > 0) {
      setLocalDismissed((prev) => {
        const next = new Set([...prev].filter((key) => !release.has(key)));
        if (next.size > 0) writeDismissed(next);
        else { try { localStorage.removeItem(DISMISSED_KEY); } catch { /* Still works for this visit. */ } }
        return next;
      });
    }
    if (send.length === 0) return;
    const keys = send.map((row) => discoveryKey(row.media, row.tmdb_id));
    for (const key of keys) sendingRef.current.add(key);
    void supabase.from('watchlist_dismissed_suggestions').upsert(send, { onConflict: 'media,tmdb_id', ignoreDuplicates: true })
      .then(({ error }) => {
        for (const key of keys) sendingRef.current.delete(key);
        // Re-read, cancelling any read that started before this write; the
        // next pass releases what the fresh read confirms. On an error the
        // keys stay in the browser and go on the next visit.
        if (!error) void queryClient.invalidateQueries({ queryKey: DISMISSED_QUERY_KEY });
      });
  }, [ownerSynced, localDismissed, remoteKeys, queryClient]);

  // Kept in the browser first, so it holds even if the table write fails;
  // the effect above moves it into the table for the owner.
  const dismissMany = (items: ReadonlyArray<{ media: DiscoveryMedia; id: number }>) => {
    if (items.length === 0) return;
    setLocalDismissed((prev) => {
      const next = new Set(prev);
      for (const item of items) next.add(discoveryKey(item.media, item.id));
      writeDismissed(next);
      return next;
    });
  };
  // Visitors can only reset their own browser's dismissals; the owner's
  // table is theirs alone to clear.
  const resetDismissed = async () => {
    setLocalDismissed(new Set());
    try { localStorage.removeItem(DISMISSED_KEY); } catch { /* Still works for this visit. */ }
    if (ownerSynced) {
      await supabase.from('watchlist_dismissed_suggestions').delete().gt('id', 0);
      await queryClient.invalidateQueries({ queryKey: DISMISSED_QUERY_KEY });
    }
  };
  const resettable = localDismissed.size + (ownerSynced ? remote.data?.length ?? 0 : 0);

  return { dismissed, dismissMany, resetDismissed, resettable, ownerSynced };
}

/**
 * The dismissed keys, for lists that mark a "Not interested" title rather
 * than drop it. Empty unless a page provides it.
 */
export const DismissedContext = createContext<ReadonlySet<string>>(new Set());
export const useDismissedKeys = () => useContext(DismissedContext);
