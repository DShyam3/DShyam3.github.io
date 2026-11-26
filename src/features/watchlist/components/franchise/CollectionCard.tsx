import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  buildOrderView,
  collectionPartsToEntries,
  type CollectionSummary,
  type LibraryLookup,
  type OrderEntryView,
} from '@/features/watchlist/franchise';
import type { TMDBCollection } from '@/features/watchlist/tmdb-types';
import type { WatchedWhen } from '@/features/watchlist/watched-when';
import { SectionFailure } from '@/features/watchlist/components/SectionFailure';
import { EntryList, POSTER_BASE } from './EntryList';
import { FranchiseCard } from './FranchiseCard';

/** A film series from the library. Opening it asks TMDB for every part, so
 *  films not in the library show too, in release order. */
export function CollectionCard({
  collection,
  lookup,
  getCollection,
  prefetchedCollection,
  open: controlledOpen,
  onToggle: controlledToggle,
  onOpen,
  onAddToLibrary,
  onSeenIt,
  isAdding,
  onSave,
}: {
  collection: CollectionSummary;
  lookup: LibraryLookup;
  getCollection: (id: number) => Promise<TMDBCollection | null>;
  prefetchedCollection?: TMDBCollection;
  open?: boolean;
  onToggle?: () => void;
  onOpen: (entry: OrderEntryView) => void;
  onAddToLibrary?: (entry: OrderEntryView) => void;
  onSeenIt?: (entry: OrderEntryView, when: WatchedWhen) => void;
  isAdding?: (key: string) => boolean;
  /** Admin only; receives the entries in release order. */
  onSave?: (collection: CollectionSummary, view: ReturnType<typeof buildOrderView>) => Promise<void>;
}) {
  const [localOpen, setLocalOpen] = useState(false);
  const open = controlledOpen ?? localOpen;
  const handleToggle = controlledToggle ?? (() => setLocalOpen((value) => !value));
  const [saving, setSaving] = useState(false);
  const query = useQuery({
    queryKey: ['watchlist', 'collection-card', collection.collectionId],
    queryFn: async () => {
      const found = await getCollection(collection.collectionId);
      if (!found) throw new Error('Collection unavailable');
      return found;
    },
    enabled: open && !prefetchedCollection,
    staleTime: 24 * 60 * 60 * 1000,
    retry: false,
  });
  const resolvedCollection = prefetchedCollection ?? query.data;
  const libraryView = useMemo(
    () =>
      buildOrderView(
        collection.films.map((film, index) => ({
          key: `movie:${film.tmdbId}`,
          tmdbId: film.tmdbId,
          mediaType: 'movie' as const,
          title: film.title,
          releaseDate: film.releaseDate ?? null,
          poster: film.poster ?? null,
          position: index,
        })),
        lookup,
      ),
    [collection.films, lookup],
  );
  const view = useMemo(
    () => (resolvedCollection ? buildOrderView(collectionPartsToEntries(resolvedCollection.parts ?? [], POSTER_BASE, lookup.movies), lookup) : null),
    [resolvedCollection, lookup],
  );
  const activeView = view ?? libraryView;

  return (
    <FranchiseCard
      name={collection.name}
      kindLabel="Film Series"
      summary={view ? `${view.watched} of ${view.total} watched` : `${collection.watched} of ${collection.films.length} in library watched`}
      watchedCount={activeView.watched}
      totalCount={activeView.total}
      nextUp={activeView.nextUp?.title}
      nextUpYear={activeView.nextUp?.releaseDate?.slice(0, 4) ?? null}
      strip={
        view
          ? view.entries.map((e) => ({ key: e.key, title: e.title, poster: e.poster, mediaType: e.mediaType, watched: e.state === 'watched' }))
          : collection.films.map((f) => ({ key: String(f.tmdbId), title: f.title, poster: f.poster, mediaType: 'movie', watched: f.watched }))
      }
      open={open}
      onToggle={handleToggle}
    >
      {!prefetchedCollection && query.isPending && <p role="status" className="text-xs text-muted-foreground">Checking TMDB for any missing parts…</p>}
      {!prefetchedCollection && query.isError && <SectionFailure>Could not load missing parts from TMDB</SectionFailure>}
      {onSave && view && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="gap-1.5"
          disabled={saving || view.total === 0}
          onClick={async () => {
            setSaving(true);
            try {
              await onSave(collection, view);
            } finally {
              setSaving(false);
            }
          }}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
          Save as viewing order
        </Button>
      )}
      <EntryList view={activeView} onOpen={onOpen} onAddToLibrary={onAddToLibrary} onSeenIt={onSeenIt} isAdding={isAdding} />
    </FranchiseCard>
  );
}
