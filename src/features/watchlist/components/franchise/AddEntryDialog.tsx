import { useEffect, useState } from 'react';
import { TmdbSearchDialog } from '@/features/watchlist/components/TmdbSearchDialog';
import { useTMDB, type TMDBResult } from '@/features/watchlist/useTMDB';
import type { OrderEntryInput } from '@/features/watchlist/franchise';
import { POSTER_BASE } from './EntryList';

/** Search TMDB for a film or show and hand it back as an order entry. */
export function AddEntryDialog({
  existingKeys,
  onAdd,
  disabled = false,
}: {
  existingKeys: Set<string>;
  /** Resolves to an error message, or null once added. */
  onAdd: (entry: OrderEntryInput) => Promise<string | null>;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [failures, setFailures] = useState<Record<string, string>>({});
  const { results, loading, searchMulti, clearSearch, getPosterUrl } = useTMDB();

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
      onQueryChange={(value) => { clearSearch(); setQuery(value); }}
      results={results}
      loading={loading}
      resultKey={keyOf}
      isDisabled={(r) => disabled || existingKeys.has(keyOf(r)) || pending.has(keyOf(r))}
      renderStatus={(r) =>
        existingKeys.has(keyOf(r)) ? (
          <span className="text-xs font-bold uppercase tracking-wider text-foreground">In this order</span>
        ) : pending.has(keyOf(r)) ? (
          <span className="text-xs text-muted-foreground">Adding…</span>
        ) : failures[keyOf(r)] ? (
          <span role="alert" className="text-xs text-destructive">{failures[keyOf(r)]}</span>
        ) : (
          <span className="text-xs text-muted-foreground">{r.media_type === 'tv' ? 'Series' : 'Film'}</span>
        )
      }
      getPosterUrl={getPosterUrl}
      onSelect={async (r) => {
        const key = keyOf(r);
        setPending((current) => new Set(current).add(key));
        setFailures(({ [key]: _cleared, ...rest }) => rest);
        try {
          const failure = await onAdd({
            key,
            mediaType: r.media_type,
            tmdbId: r.id,
            title: r.title || r.name || 'Untitled',
            releaseDate: r.release_date || r.first_air_date || null,
            poster: r.poster_path ? POSTER_BASE + r.poster_path : null,
          });
          if (failure) setFailures((current) => ({ ...current, [key]: failure }));
        } finally {
          setPending((current) => {
            const next = new Set(current);
            next.delete(key);
            return next;
          });
        }
      }}
    />
  );
}
