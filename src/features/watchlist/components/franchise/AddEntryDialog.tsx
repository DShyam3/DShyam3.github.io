import { useEffect, useState } from 'react';
import { TmdbSearchDialog } from '@/features/watchlist/components/TmdbSearchDialog';
import { useTMDB, type TMDBResult } from '@/features/watchlist/useTMDB';
import type { OrderEntryInput } from '@/features/watchlist/franchise';
import { POSTER_BASE } from './EntryList';

/** Search TMDB for a film or show and hand it back as an order entry. */
export function AddEntryDialog({
  existingKeys,
  onAdd,
}: {
  existingKeys: Set<string>;
  onAdd: (entry: OrderEntryInput) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const { results, loading, searchMulti, getPosterUrl } = useTMDB();

  useEffect(() => {
    if (query.length < 2) return;
    const timer = setTimeout(() => void searchMulti(query), 400);
    return () => clearTimeout(timer);
  }, [query, searchMulti]);

  const keyOf = (r: TMDBResult) => `${r.media_type}:${r.id}`;

  return (
    <TmdbSearchDialog
      open={open}
      onOpenChange={setOpen}
      triggerLabel="Add film or show"
      title="Add to this order"
      description="Search TMDB for a film or series to add to the end of this viewing order."
      searchLabel="Film or series"
      placeholder="Search films and series"
      query={query}
      onQueryChange={setQuery}
      results={results}
      loading={loading}
      resultKey={keyOf}
      isDisabled={(r) => existingKeys.has(keyOf(r))}
      renderStatus={(r) =>
        existingKeys.has(keyOf(r)) ? (
          <span className="text-xs font-bold uppercase tracking-wider text-foreground">In this order</span>
        ) : (
          <span className="text-xs text-muted-foreground">{r.media_type === 'tv' ? 'Series' : 'Film'}</span>
        )
      }
      getPosterUrl={getPosterUrl}
      onSelect={(r) =>
        onAdd({
          key: keyOf(r),
          mediaType: r.media_type,
          tmdbId: r.id,
          title: r.title || r.name || 'Untitled',
          releaseDate: r.release_date || r.first_air_date || null,
          poster: r.poster_path ? POSTER_BASE + r.poster_path : null,
        })
      }
    />
  );
}
