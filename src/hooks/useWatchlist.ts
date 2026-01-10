import { useWatchlistContext } from '@/contexts/WatchlistContext';
export * from '@/contexts/WatchlistContext';

export function useWatchlist() {
    return useWatchlistContext();
}
