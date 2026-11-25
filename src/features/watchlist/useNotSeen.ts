import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { selectAllPages } from '@/integrations/supabase/select-all-pages';
import { useAuth } from '@/contexts/AuthContext';
import { discoveryKey, type DiscoveryMedia } from './discovery';
import { keySetHandover } from './discovery-answers';

const NOT_SEEN_KEY = 'watchlist-discovery-not-seen-v1';
const NOT_SEEN_QUERY_KEY = ['watchlist', 'not-seen'] as const;

function readNotSeen(): Set<string> {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(NOT_SEEN_KEY) || '[]');
    return new Set(Array.isArray(saved) ? saved.filter((key): key is string => typeof key === 'string') : []);
  } catch { return new Set(); }
}
function writeNotSeen(keys: ReadonlySet<string>) {
  try {
    if (keys.size > 0) localStorage.setItem(NOT_SEEN_KEY, JSON.stringify([...keys]));
    else localStorage.removeItem(NOT_SEEN_KEY);
  } catch { /* Still works for this visit. */ }
}

/**
 * Titles answered "Not seen" under HAVE YOU ALREADY WATCHED?, as
 * `media:tmdbId` keys: this browser's copy plus, once it is reachable, the
 * owner's table shared across devices. Kept apart from Not interested and
 * skips (`useDismissedSuggestions`): not having seen a title says nothing
 * about wanting it suggested.
 */
export function useNotSeen() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [local, setLocal] = useState(readNotSeen);

  // If the read fails (the table not there yet), the browser copy carries on.
  const remote = useQuery({
    queryKey: NOT_SEEN_QUERY_KEY,
    staleTime: 5 * 60 * 1000,
    retry: false,
    queryFn: async () => {
      // Paged: answers only grow, and the Data API stops at 1,000 rows.
      const { data, error } = await selectAllPages((from, to) => supabase
        .from('watchlist_not_seen')
        .select('id, media, tmdb_id', { count: 'exact' })
        .order('id', { ascending: true })
        .range(from, to), (row) => String(row.id));
      if (error) throw new Error(error.message);
      return data.map((row) => discoveryKey(row.media as DiscoveryMedia, row.tmdb_id));
    },
  });
  const ownerSynced = isAdmin && remote.isSuccess;
  const remoteKeys = useMemo(() => (remote.data ? new Set(remote.data) : undefined), [remote.data]);
  const notSeen = useMemo(() => new Set([...local, ...(remoteKeys ?? [])]), [local, remoteKeys]);

  // The owner's browser answers move into the table; a key stays in the
  // browser copy until a read of the table has it (see `keySetHandover`).
  const sendingRef = useRef(new Set<string>());
  // Writes still in flight, so a reset can wait for them: a write landing
  // after the reset's delete would bring its rows back.
  const writesRef = useRef(new Set<Promise<unknown>>());
  useEffect(() => {
    if (!ownerSynced || local.size === 0) return;
    const { release, send } = keySetHandover(local, remoteKeys, sendingRef.current);
    if (release.size > 0) {
      setLocal((prev) => {
        const next = new Set([...prev].filter((key) => !release.has(key)));
        writeNotSeen(next);
        return next;
      });
    }
    if (send.length === 0) return;
    const keys = send.map((row) => discoveryKey(row.media, row.tmdb_id));
    for (const key of keys) sendingRef.current.add(key);
    const write = Promise.resolve(supabase.from('watchlist_not_seen').upsert(send, { onConflict: 'media,tmdb_id', ignoreDuplicates: true })
      .then(({ error }) => {
        for (const key of keys) sendingRef.current.delete(key);
        if (!error) void queryClient.invalidateQueries({ queryKey: NOT_SEEN_QUERY_KEY });
      }));
    writesRef.current.add(write);
    void write.finally(() => { writesRef.current.delete(write); });
  }, [ownerSynced, local, remoteKeys, queryClient]);

  const markNotSeen = (media: DiscoveryMedia, id: number) => {
    setLocal((prev) => {
      const next = new Set(prev).add(discoveryKey(media, id));
      writeNotSeen(next);
      return next;
    });
  };
  /** Likely seen's "None of these": every title on screen, in one write. */
  const markManyNotSeen = (items: ReadonlyArray<{ media: DiscoveryMedia; id: number }>) => {
    if (items.length === 0) return;
    setLocal((prev) => {
      const next = new Set(prev);
      for (const item of items) next.add(discoveryKey(item.media, item.id));
      writeNotSeen(next);
      return next;
    });
  };
  /**
   * Undo for "None of these": takes the titles back out, here and, for the
   * owner, from the table, once any write that may carry them has landed.
   */
  const unmarkNotSeen = async (items: ReadonlyArray<{ media: DiscoveryMedia; id: number }>) => {
    if (items.length === 0) return;
    const keys = new Set(items.map((item) => discoveryKey(item.media, item.id)));
    setLocal((prev) => {
      const next = new Set([...prev].filter((key) => !keys.has(key)));
      writeNotSeen(next);
      return next;
    });
    if (!ownerSynced) return;
    await Promise.allSettled([...writesRef.current]);
    const byMedia = new Map<DiscoveryMedia, number[]>();
    for (const item of items) byMedia.set(item.media, [...(byMedia.get(item.media) ?? []), item.id]);
    const results = await Promise.all([...byMedia].map(([media, ids]) =>
      supabase.from('watchlist_not_seen').delete().eq('media', media).in('tmdb_id', ids)));
    await queryClient.invalidateQueries({ queryKey: NOT_SEEN_QUERY_KEY });
    const failed = results.find((result) => result.error);
    if (failed?.error) throw new Error(failed.error.message);
  };
  const resetNotSeen = async () => {
    setLocal(new Set());
    writeNotSeen(new Set());
    if (ownerSynced) {
      await Promise.allSettled([...writesRef.current]);
      const { error } = await supabase.from('watchlist_not_seen').delete().gt('id', 0);
      await queryClient.invalidateQueries({ queryKey: NOT_SEEN_QUERY_KEY });
      if (error) throw new Error(error.message);
    }
  };
  const resettable = local.size + (ownerSynced ? remoteKeys?.size ?? 0 : 0);

  return { notSeen, markNotSeen, markManyNotSeen, unmarkNotSeen, resetNotSeen, resettable, ownerSynced };
}
