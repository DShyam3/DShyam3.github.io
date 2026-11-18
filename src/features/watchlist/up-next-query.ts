import { queryOptions, type QueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { selectUpNextRail } from './watchlist-utils';

/** A row of the watchlist_up_next view. Nothing renders the rail now; the
 *  query stays because a watched write still refreshes it (and it is tested). */
export interface UpNextItem {
  tv_show_id: number;
  title: string;
  poster: string | null;
  platform: string;
  season_number: number;
  episode_number: number;
  episode_title: string | null;
  release_date: string | null;
  runtime: number | null;
  state: 'ready' | 'upcoming' | 'unscheduled';
  season_in_progress: boolean;
}

export const upNextQueryOptions = queryOptions({
  queryKey: ['watchlist', 'up-next'],
  queryFn: async () => {
    const { data, error } = await supabase.from('watchlist_up_next').select('*');
    if (error) throw error;
    return selectUpNextRail((data ?? []) as UpNextItem[], new Date());
  },
  retry: false,
});

/** Shared by individual and season updates; local state follows confirmed writes. */
export async function persistWatchedProgress(
  queryClient: QueryClient,
  episodeIds: (number | undefined)[],
  watched: boolean,
) {
  if (episodeIds.length === 0 || episodeIds.some((id) => id == null)) {
    throw new Error('Missing episode IDs');
  }
  const ids = episodeIds as number[];
  const { data, error } = await supabase.from('tv_show_episodes')
    .update({ watched })
    .in('id', ids)
    .select('id');
  if (error) throw error;
  if (!data || ids.some((id) => !data.some((row) => row.id === id))) {
    throw new Error('Episode update incomplete');
  }
  // Query failures stay in the cache's error state, not in the write's promise.
  await queryClient.invalidateQueries(
    { queryKey: upNextQueryOptions.queryKey },
    { throwOnError: false },
  );
}
