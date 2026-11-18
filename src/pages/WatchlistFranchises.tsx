import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DotMatrixText } from '@/components/dot-matrix/DotMatrixText';
import { WatchlistNav } from '@/features/watchlist/components/WatchlistNav';
import { SectionFailure } from '@/features/watchlist/components/SectionFailure';
import { WatchlistDetailDialog } from '@/features/watchlist/components/WatchlistDetailDialog';
import { CollectionCard } from '@/features/watchlist/components/franchise/CollectionCard';
import { NewOrderForm } from '@/features/watchlist/components/franchise/NewOrderForm';
import { OrderCard, type OrderActions } from '@/features/watchlist/components/franchise/OrderCard';
import { useAddToLibrary } from '@/features/watchlist/components/franchise/useAddToLibrary';
import {
  buildOrderView,
  collectionsFromLibrary,
  type LibraryLookup,
  type OrderEntryView,
} from '@/features/watchlist/franchise';
import { useTMDB } from '@/features/watchlist/useTMDB';
import { useWatchlist } from '@/features/watchlist/useWatchlist';
import {
  addEntry,
  createOrder,
  deleteOrder,
  moveEntry,
  removeEntry,
  renameOrder,
  updateEntryNote,
  viewingOrdersQueryOptions,
} from '@/features/watchlist/viewing-orders-query';
import { useAuth } from '@/contexts/AuthContext';
import { useDeleteConfirm } from '@/hooks/useDeleteConfirm';
import { useToast } from '@/hooks/use-toast';

const localDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Franchises: viewing orders for film series and cinematic universes. */
export default function WatchlistFranchises() {
  const { watchlist, loading: libraryLoading, getAutoStatus, isEpisodeWatched, isSeasonWatched, toggleEpisodeWatched } = useWatchlist();
  const { isAdmin } = useAuth();
  const { getCollection } = useTMDB();
  const { addToLibrary, isAdding } = useAddToLibrary();
  const { askDelete, deleteDialog } = useDeleteConfirm();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const orders = useQuery(viewingOrdersQueryOptions);
  const [selected, setSelected] = useState<{ id: string; category: 'Movies' | 'TV Shows' } | null>(null);

  const lookup = useMemo<LibraryLookup>(() => {
    const today = localDate(new Date());
    const movies: LibraryLookup['movies'] = new Map();
    const shows: LibraryLookup['shows'] = new Map();
    for (const item of watchlist) {
      if (item.tmdb_id == null) continue;
      if (item.category === 'Movies') {
        movies.set(item.tmdb_id, { id: item.id, watched: !!item.watched });
      } else if (item.category === 'TV Shows') {
        let airedEpisodes = 0;
        let watchedEpisodes = 0;
        for (const season of item.seasons ?? []) {
          if (season.season_number <= 0) continue;
          for (const ep of season.episodes) {
            if (!ep.release_date || ep.release_date.slice(0, 10) > today) continue;
            airedEpisodes++;
            if (ep.watched) watchedEpisodes++;
          }
        }
        shows.set(item.tmdb_id, { id: item.id, airedEpisodes, watchedEpisodes });
      }
    }
    return { movies, shows };
  }, [watchlist]);

  const savedOrders = orders.data ?? [];
  const savedCollectionIds = new Set(savedOrders.flatMap((o) => (o.tmdbCollectionId == null ? [] : [o.tmdbCollectionId])));
  const collections = useMemo(
    () =>
      collectionsFromLibrary(
        watchlist
          .filter((item) => item.category === 'Movies')
          .map((item) => ({
            id: item.id,
            tmdbId: item.tmdb_id ?? null,
            title: item.title,
            watched: !!item.watched,
            releaseDate: item.release_date ?? null,
            poster: item.image_url ?? null,
            collectionId: item.collection_id ?? null,
            collectionName: item.collection_name ?? null,
          })),
      ),
    [watchlist],
  );
  const openCollections = collections.filter((c) => !savedCollectionIds.has(c.collectionId));

  const run = async (action: () => Promise<unknown>, failure: string) => {
    try {
      await action();
      await queryClient.invalidateQueries({ queryKey: viewingOrdersQueryOptions.queryKey });
    } catch (error) {
      console.error(failure, error);
      toast({ title: failure, variant: 'destructive' });
    }
  };

  const actionsFor = (order: { id: number; name: string }): OrderActions => ({
    onRename: (name) => void run(() => renameOrder(order.id, name), 'Could not rename the order'),
    onDelete: () =>
      askDelete({ name: order.name, onConfirm: () => run(() => deleteOrder(order.id), 'Could not delete the order') }),
    onAdd: (entry) => void run(() => addEntry(order.id, entry), 'Could not add to the order'),
    onRemove: (entryId) => void run(() => removeEntry(entryId), 'Could not remove the entry'),
    onNote: (entryId, note) => void run(() => updateEntryNote(entryId, note), 'Could not save the note'),
    onMove: (entryIds, from, to) => void run(() => moveEntry(order.id, entryIds, from, to), 'Could not move the entry'),
  });

  const openEntry = (entry: OrderEntryView) => {
    if (entry.libraryId) setSelected({ id: entry.libraryId, category: entry.mediaType === 'movie' ? 'Movies' : 'TV Shows' });
  };
  const selectedItem = selected && watchlist.find((i) => i.category === selected.category && i.id === selected.id);

  const loading = libraryLoading || orders.isPending;

  return (
    <div className="space-y-6">
      <WatchlistNav current="franchises" />

      <section aria-labelledby="orders-heading" className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="orders-heading"><DotMatrixText text="YOUR VIEWING ORDERS" size="xs" /></h2>
          {isAdmin && (
            <NewOrderForm
              onCreate={async (name) => {
                await run(() => createOrder({ name }), 'Could not create the order');
              }}
            />
          )}
        </div>
        {loading && <p role="status" className="text-sm text-muted-foreground">Loading viewing orders…</p>}
        {orders.isError && <SectionFailure>Could not load viewing orders</SectionFailure>}
        {!loading && !orders.isError && savedOrders.length === 0 && (
          <p className="text-sm text-muted-foreground">No viewing orders yet.</p>
        )}
        {!loading && savedOrders.length > 0 && (
          <div className="space-y-3">
            {savedOrders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                view={buildOrderView(order.entries, lookup)}
                actions={isAdmin ? actionsFor(order) : undefined}
                onOpen={openEntry}
                onAddToLibrary={isAdmin ? (entry) => void addToLibrary(entry) : undefined}
                isAdding={isAdding}
              />
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="series-heading" className="min-w-0 space-y-3">
        <h2 id="series-heading"><DotMatrixText text="FILM SERIES IN YOUR LIBRARY" size="xs" /></h2>
        <p className="text-sm text-muted-foreground">
          Collections come from TMDB and list films only, in release order. Save one as a viewing order to reorder it or add series.
        </p>
        {!libraryLoading && collections.length === 0 && (
          <p className="text-sm text-muted-foreground">Film series appear here as the nightly sync fills them in.</p>
        )}
        {openCollections.length > 0 && (
          <div className="space-y-3">
            {openCollections.map((collection) => (
              <CollectionCard
                key={collection.collectionId}
                collection={collection}
                lookup={lookup}
                getCollection={getCollection}
                onOpen={openEntry}
                onAddToLibrary={isAdmin ? (entry) => void addToLibrary(entry) : undefined}
                isAdding={isAdding}
                onSave={
                  isAdmin
                    ? async (c, view) => {
                        await run(
                          () => createOrder({ name: c.name.slice(0, 120), tmdbCollectionId: c.collectionId, entries: view.entries }),
                          'Could not save the viewing order',
                        );
                      }
                    : undefined
                }
              />
            ))}
          </div>
        )}
      </section>

      {deleteDialog}
      {selectedItem && (
        <WatchlistDetailDialog
          open
          onOpenChange={(open) => {
            if (!open) setSelected(null);
          }}
          item={selectedItem}
          status={getAutoStatus(selectedItem)}
          toggleEpisodeWatched={isAdmin ? toggleEpisodeWatched : undefined}
          isEpisodeWatched={isEpisodeWatched}
          isSeasonWatched={isSeasonWatched}
        />
      )}
    </div>
  );
}
