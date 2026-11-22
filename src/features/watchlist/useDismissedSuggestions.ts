import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { selectAllPages } from '@/integrations/supabase/select-all-pages';
import { useAuth } from '@/contexts/AuthContext';
import { discoveryKey, type DiscoveryMedia } from './discovery';
import {
  answersHandover,
  hiddenFromSuggestionKeys,
  isDismissReason,
  isDismissSource,
  mergeAnswers,
  notInterestedKeys,
  parseStoredAnswers,
  type DismissalAnswer,
  type DismissReason,
  type DismissSource,
} from './discovery-answers';

const ANSWERS_KEY = 'watchlist-discovery-answers-v2';
/** Bare keys, all Not interested; read once and folded into the list above. */
const LEGACY_DISMISSED_KEY = 'watchlist-discovery-dismissed-v1';
const DISMISSED_QUERY_KEY = ['watchlist', 'dismissed-suggestions'] as const;

const readJson = (key: string): unknown => {
  try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; }
};
function writeAnswers(answers: ReadonlyMap<string, DismissalAnswer>) {
  try {
    if (answers.size > 0) localStorage.setItem(ANSWERS_KEY, JSON.stringify([...answers]));
    else localStorage.removeItem(ANSWERS_KEY);
  } catch { /* Still works for this visit. */ }
  // On its own: if the write above fails, the old list must still go, or
  // every load would read its keys again as new answers.
  try { localStorage.removeItem(LEGACY_DISMISSED_KEY); } catch { /* Nothing more to do. */ }
}
function readAnswers(): Map<string, DismissalAnswer> {
  const legacy = readJson(LEGACY_DISMISSED_KEY);
  const answers = parseStoredAnswers(readJson(ANSWERS_KEY), legacy, new Date().toISOString());
  if (legacy !== null) writeAnswers(answers);
  return answers;
}

/**
 * Titles turned down in Discover, as `media:tmdbId` keys with why and where:
 * this browser's copy plus, once it is reachable, the owner's table shared
 * across devices. See `DismissReason` for what each answer hides.
 */
export function useDismissedSuggestions() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [localAnswers, setLocalAnswers] = useState(readAnswers);

  // The owner's answers, shared across devices. If the read fails the
  // browser copy carries on.
  const remote = useQuery({
    queryKey: DISMISSED_QUERY_KEY,
    staleTime: 5 * 60 * 1000,
    retry: false,
    queryFn: async () => {
      // Paged: dismissals only grow, and the Data API stops at 1,000 rows.
      const { data, error } = await selectAllPages((from, to) => supabase
        .from('watchlist_dismissed_suggestions')
        .select('id, media, tmdb_id, reason, source, answered_at', { count: 'exact' })
        .order('id', { ascending: true })
        .range(from, to), (row) => String(row.id));
      if (error) throw new Error(error.message);
      // A plain array, not a Map: TanStack Query keeps an unchanged result's
      // identity only for plain data, and the handover effect below re-runs
      // whenever the result's identity changes.
      return data.map((row): [string, DismissalAnswer] => [discoveryKey(row.media as DiscoveryMedia, row.tmdb_id), {
        reason: isDismissReason(row.reason) ? row.reason : 'not_interested',
        source: isDismissSource(row.source) ? row.source : 'unknown',
        answeredAt: row.answered_at,
      }]);
    },
  });
  const ownerSynced = isAdmin && remote.isSuccess;
  const remoteAnswers = useMemo(() => (remote.data ? new Map(remote.data) : undefined), [remote.data]);
  // Where both copies have a title, the stronger answer wins (see `outranks`).
  const answers = useMemo(() => mergeAnswers(remoteAnswers ?? new Map(), localAnswers), [remoteAnswers, localAnswers]);
  const notInterested = useMemo(() => notInterestedKeys(answers), [answers]);
  const hiddenFromSuggestions = useMemo(() => hiddenFromSuggestionKeys(answers, Date.now()), [answers]);

  // Once the owner's table is reachable, this browser's own answers move
  // into it, so a reset on one device clears them on every device.
  // An answer stays in the browser copy, and so keeps hiding its title,
  // until a read of the table has it; see `answersHandover`.
  const sendingRef = useRef(new Set<string>());
  // Writes still in flight, so a reset can wait for them: a write landing
  // after the reset's delete would bring its rows back.
  const writesRef = useRef(new Set<Promise<unknown>>());
  useEffect(() => {
    if (!ownerSynced || localAnswers.size === 0) return;
    const { release, send } = answersHandover(localAnswers, remoteAnswers, sendingRef.current);
    if (release.size > 0) {
      setLocalAnswers((prev) => {
        // Only an answer unchanged since this pass looked: one given since
        // is not what the table confirmed.
        const next = new Map([...prev].filter(([key, answer]) => !(release.has(key) && answer === localAnswers.get(key))));
        writeAnswers(next);
        return next;
      });
    }
    if (send.length === 0) return;
    const keys = send.map((row) => discoveryKey(row.media, row.tmdb_id));
    for (const key of keys) sendingRef.current.add(key);
    // The table's trigger keeps whichever answer outranks the other: a skip
    // given again restarts its 90 days, and Not interested outranks a skip.
    const write = Promise.resolve(supabase.from('watchlist_dismissed_suggestions').upsert(send, { onConflict: 'media,tmdb_id' })
      .then(({ error }) => {
        for (const key of keys) sendingRef.current.delete(key);
        // Re-read, cancelling any read that started before this write; the
        // next pass releases what the fresh read confirms. On an error the
        // answers stay in the browser and go on the next visit.
        if (!error) void queryClient.invalidateQueries({ queryKey: DISMISSED_QUERY_KEY });
      }));
    writesRef.current.add(write);
    void write.finally(() => { writesRef.current.delete(write); });
  }, [ownerSynced, localAnswers, remoteAnswers, queryClient]);

  // Kept in the browser first, so it holds even if the table write fails;
  // the effect above moves it into the table for the owner.
  const dismissMany = (
    items: ReadonlyArray<{ media: DiscoveryMedia; id: number }>,
    reason: DismissReason,
    source: DismissSource,
  ) => {
    if (items.length === 0) return;
    const answeredAt = new Date().toISOString();
    setLocalAnswers((prev) => {
      const next = new Map(prev);
      for (const item of items) next.set(discoveryKey(item.media, item.id), { reason, source, answeredAt });
      writeAnswers(next);
      return next;
    });
  };
  // Visitors can only reset their own browser's answers; the owner's table
  // is theirs alone to clear.
  const resetDismissed = async () => {
    setLocalAnswers(new Map());
    writeAnswers(new Map());
    if (ownerSynced) {
      await Promise.allSettled([...writesRef.current]);
      const { error } = await supabase.from('watchlist_dismissed_suggestions').delete().gt('id', 0);
      await queryClient.invalidateQueries({ queryKey: DISMISSED_QUERY_KEY });
      if (error) throw new Error(error.message);
    }
  };
  const resettable = localAnswers.size + (ownerSynced ? remoteAnswers?.size ?? 0 : 0);

  return { notInterested, hiddenFromSuggestions, dismissMany, resetDismissed, resettable, ownerSynced };
}

/**
 * The titles marked Not interested, for lists that mark such a title rather
 * than drop it. Empty unless a page provides it.
 */
export const DismissedContext = createContext<ReadonlySet<string>>(new Set());
export const useDismissedKeys = () => useContext(DismissedContext);
