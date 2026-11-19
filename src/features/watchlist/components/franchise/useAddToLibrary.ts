import { newItemFromDetails } from '@/features/watchlist/new-item';
import { useCallback, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useWatchlist } from '@/features/watchlist/useWatchlist';
import { useTMDB } from '@/features/watchlist/useTMDB';
import type { OrderEntryInput } from '@/features/watchlist/franchise';
import type { WatchedWhen } from '@/features/watchlist/watched-when';

/** "Add to library" (or "Seen it") for an entry that is not in it yet: the same
 *  getMovieDetails + addWatchlistItem path as the Library's add dialog. */
export function useAddToLibrary() {
  const { addWatchlistItem } = useWatchlist();
  const { getMovieDetails } = useTMDB();
  const { toast } = useToast();
  const [pending, setPending] = useState<Set<string>>(new Set());

  const addToLibrary = useCallback(
    async (entry: OrderEntryInput, options?: { watched?: boolean; watchedWhen?: WatchedWhen }) => {
      setPending((prev) => new Set(prev).add(entry.key));
      try {
        const details = await getMovieDetails(entry.tmdbId, entry.mediaType);
        if (!details) {
          toast({ title: `Could not look up ${entry.title}`, variant: 'destructive' });
          return;
        }
        await addWatchlistItem(
          {
            ...newItemFromDetails(details, entry.mediaType === 'movie' ? 'Movies' : 'TV Shows'),
            watched: options?.watched === true,
          },
          { watchedWhen: options?.watchedWhen, seasons: details.seasons },
        );
      } finally {
        setPending((prev) => {
          const next = new Set(prev);
          next.delete(entry.key);
          return next;
        });
      }
    },
    [addWatchlistItem, getMovieDetails, toast],
  );

  return { addToLibrary, isAdding: (key: string) => pending.has(key) };
}
