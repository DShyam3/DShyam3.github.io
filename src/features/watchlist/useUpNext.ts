import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { selectUpNextRail, type UpNextReason } from '@/features/watchlist/watchlist-utils';

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

export interface UpNextRailItem extends UpNextItem {
  reason: UpNextReason;
}

/**
 * The Up Next rail's rows, from `public.watchlist_up_next` (REHAUL_PLAN.md
 * 8.A, narrowed in 8.C by `selectUpNextRail`). The view does not exist on the
 * live database until its migration lands, so a query error here is expected
 * rather than exceptional -- it degrades to an empty rail exactly like a
 * fetch that found nothing, never a thrown error.
 */
export function useUpNext() {
  const [upNext, setUpNext] = useState<UpNextRailItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUpNext = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('watchlist_up_next').select('*');

      if (error) throw error;

      setUpNext(selectUpNextRail((data || []) as UpNextItem[], new Date()));
    } catch (error) {
      console.error('Error fetching up next:', error);
      setUpNext([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUpNext();
  }, [fetchUpNext]);

  return { upNext, loading };
}
