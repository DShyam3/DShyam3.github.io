import { useCallback, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useWatchlist } from '@/features/watchlist/useWatchlist';
import { useTMDB } from '@/features/watchlist/useTMDB';
import type { OrderEntryInput } from '@/features/watchlist/franchise';

/** "Add to library" for an entry that is not in it yet: the same
 *  getMovieDetails + addWatchlistItem path as the Library's add dialog. */
export function useAddToLibrary() {
  const { addWatchlistItem } = useWatchlist();
  const { getMovieDetails } = useTMDB();
  const { toast } = useToast();
  const [pending, setPending] = useState<Set<string>>(new Set());

  const addToLibrary = useCallback(
    async (entry: OrderEntryInput) => {
      setPending((prev) => new Set(prev).add(entry.key));
      try {
        const details = await getMovieDetails(entry.tmdbId, entry.mediaType);
        if (!details) {
          toast({ title: `Could not look up ${entry.title}`, variant: 'destructive' });
          return;
        }
        await addWatchlistItem({
          title: details.release_year ? `${details.title} (${details.release_year})` : details.title,
          category: entry.mediaType === 'movie' ? 'Movies' : 'TV Shows',
          description: details.overview,
          year: details.release_year || undefined,
          image_url: details.poster || undefined,
          backdrop_url: details.backdrop || undefined,
          runtime: details.runtime || undefined,
          genres: details.genres,
          tmdb_id: details.tmdb_id,
          release_date: details.release_date,
          streaming_platform: details.platform,
          trailer_key: details.trailer_key ?? undefined,
          tmdb_vote_average: details.tmdb_vote_average ?? undefined,
          tmdb_vote_count: details.tmdb_vote_count ?? undefined,
          collection_id: details.collection_id ?? undefined,
          collection_name: details.collection_name ?? undefined,
          directors: details.directors ?? undefined,
          creators: details.creators ?? undefined,
          top_cast: details.top_cast ?? undefined,
        });
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
