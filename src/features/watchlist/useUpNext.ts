import { useQuery } from '@tanstack/react-query';
import { type UpNextReason } from '@/features/watchlist/watchlist-utils';
import { upNextQueryOptions } from './up-next-query';

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

/** A failed view fetch degrades to an empty rail. */
export function useUpNext() {
  const { data, isPending, isError } = useQuery(upNextQueryOptions);
  return { upNext: isError ? [] : data ?? [], loading: isPending };
}
