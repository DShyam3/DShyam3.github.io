import { useWatchlistContext } from '@/features/watchlist/WatchlistContext';
export * from '@/features/watchlist/WatchlistContext';

export function useWatchlist() {
    return useWatchlistContext();
}
