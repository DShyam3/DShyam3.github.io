import type { QueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { setWatchedArgs, type WatchedWhen } from './watched-when';

/** Everything a changed watched mark can make stale, other than the library
 *  (which the provider edits in place). */
export async function invalidateWatchDerived(queryClient: QueryClient) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['watchlist', 'news'] }, { throwOnError: false }),
    queryClient.invalidateQueries({ queryKey: ['watchlist', 'diary'] }, { throwOnError: false }),
  ]);
}

/**
 * Shared by individual and season updates; local state follows confirmed
 * writes. `when` says when they were watched: without it, or 'now', a plain
 * update lets the database trigger stamp the time. Any other choice goes
 * through `set_watched`, because that trigger stamps now() whenever
 * `watched` flips and a client-sent watched_at cannot override it.
 */
export async function persistWatchedProgress(
  queryClient: QueryClient,
  episodeIds: (number | undefined)[],
  watched: boolean,
  when?: WatchedWhen,
) {
  if (episodeIds.length === 0 || episodeIds.some((id) => id == null)) {
    throw new Error('Missing episode IDs');
  }
  const ids = episodeIds as number[];
  if (watched && when && when.mode !== 'now') {
    const { error } = await supabase.rpc('set_watched', setWatchedArgs('episode', ids, true, when));
    if (error) throw error;
  } else {
    const { data, error } = await supabase.from('tv_show_episodes')
      .update({ watched })
      .in('id', ids)
      .select('id');
    if (error) throw error;
    if (!data || ids.some((id) => !data.some((row) => row.id === id))) {
      throw new Error('Episode update incomplete');
    }
  }
  await queryClient.invalidateQueries({ queryKey: ['watchlist', 'diary'] }, { throwOnError: false });
}
