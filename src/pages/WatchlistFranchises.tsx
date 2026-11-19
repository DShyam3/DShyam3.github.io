import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/AppShell';
import { DotMatrixText } from '@/components/dot-matrix/DotMatrixText';
import { WatchlistNav } from '@/features/watchlist/components/WatchlistNav';
import { SectionFailure } from '@/features/watchlist/components/SectionFailure';
import { WatchlistDetailDialog } from '@/features/watchlist/components/WatchlistDetailDialog';
import { CollectionCard } from '@/features/watchlist/components/franchise/CollectionCard';
import { POSTER_BASE } from '@/features/watchlist/components/franchise/EntryList';
import { EntryPreviewDialog } from '@/features/watchlist/components/franchise/EntryPreviewDialog';
import { NewOrderForm } from '@/features/watchlist/components/franchise/NewOrderForm';
import { OrderCard, type OrderActions } from '@/features/watchlist/components/franchise/OrderCard';
import { TvFranchiseCard } from '@/features/watchlist/components/franchise/TvFranchiseCard';
import { useAddToLibrary } from '@/features/watchlist/components/franchise/useAddToLibrary';
import {
  buildOrderView,
  collectionsFromLibrary,
  libraryLookup,
  tvFranchisesFromLinks,
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

/** Postgres unique_violation: the film or show is already in this order. */
const UNIQUE_VIOLATION = '23505';

/** Franchises: viewing orders for film series and cinematic universes. */
export default function WatchlistFranchises() {
  const { watchlist, loading: libraryLoading, getAutoStatus, isEpisodeWatched, isSeasonWatched, toggleEpisodeWatched } = useWatchlist();
  const { isAdmin } = useAuth();
  const { getCollection, getTvSpinoffs } = useTMDB();
  const { addToLibrary, isAdding } = useAddToLibrary();
  const { askDelete, deleteDialog } = useDeleteConfirm();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const orders = useQuery(viewingOrdersQueryOptions);
  const [selected, setSelected] = useState<{ id: string; category: 'Movies' | 'TV Shows' } | null>(null);
  const [previewEntry, setPreviewEntry] = useState<OrderEntryView | null>(null);

  const lookup = useMemo(() => libraryLookup(watchlist, new Date()), [watchlist]);

  const savedOrders = orders.data ?? [];
  const savedCollectionIds = new Set(savedOrders.flatMap((o) => (o.tmdbCollectionId == null ? [] : [o.tmdbCollectionId])));
  const savedOrderNames = new Set(savedOrders.map((o) => o.name.trim().toLowerCase()));
  const collections = useMemo(() => {
    // Hidden films are the owner's own shelf: visitors do not see them here.
    return collectionsFromLibrary(
      watchlist.flatMap((item) =>
        item.category === 'Movies' &&
        item.collection_id != null &&
        (isAdmin || item.library_state !== 'hidden')
          ? [{
              id: item.id,
              tmdbId: item.tmdb_id ?? null,
              title: item.title,
              watched: !!item.watched,
              releaseDate: item.release_date ?? null,
              poster: item.image_url ?? null,
              collectionId: item.collection_id,
              collectionName: item.collection_name ?? null,
            }]
          : [],
      ),
    ).filter((c) => c.films.length >= 2);
  }, [watchlist, isAdmin]);
  const openCollections = collections.filter((c) => !savedCollectionIds.has(c.collectionId));

  const tvSeedIds = useMemo(
    () =>
      watchlist
        .filter((item) => item.category === 'TV Shows' && item.tmdb_id && (isAdmin || item.library_state !== 'hidden'))
        .map((item) => item.tmdb_id!)
        .sort((a, b) => a - b),
    [watchlist, isAdmin],
  );
  const tvSpinoffsQuery = useQuery({
    queryKey: ['watchlist', 'tv-spinoffs', tvSeedIds],
    queryFn: () => getTvSpinoffs(tvSeedIds),
    enabled: !libraryLoading && tvSeedIds.length > 0,
    staleTime: 24 * 60 * 60 * 1000,
    retry: false,
  });
  const tvFranchises = useMemo(
    () => tvFranchisesFromLinks(tvSpinoffsQuery.data ?? [], watchlist, POSTER_BASE),
    [tvSpinoffsQuery.data, watchlist],
  );
  const openTvFranchises = tvFranchises.filter((f) => !savedOrderNames.has(f.name.trim().toLowerCase()));

  /** Runs a change, then refreshes the orders. Resolves to an error message, or null on success. */
  const run = async (action: () => Promise<unknown>, failure: string): Promise<string | null> => {
    try {
      await action();
      await queryClient.invalidateQueries({ queryKey: viewingOrdersQueryOptions.queryKey });
      return null;
    } catch (error) {
      console.error(failure, error);
      return (error as { code?: string } | null)?.code === UNIQUE_VIOLATION ? 'Already in this order' : failure;
    }
  };

  const runWithToast = async (action: () => Promise<unknown>, failure: string) => {
    const message = await run(action, failure);
    if (message) toast({ title: message, variant: 'destructive' });
  };

  /** Orders with a change, or the read that follows it, in flight. */
  const [busyOrders, setBusyOrders] = useState<ReadonlySet<number>>(new Set());
  const inOrder = async <T,>(orderId: number, work: () => Promise<T>): Promise<T> => {
    setBusyOrders((current) => new Set(current).add(orderId));
    try {
      return await work();
    } finally {
      setBusyOrders((current) => {
        const next = new Set(current);
        next.delete(orderId);
        return next;
      });
    }
  };

  const actionsFor = (order: { id: number; name: string }): OrderActions => ({
    onRename: (name) => inOrder(order.id, () => run(() => renameOrder(order.id, name), 'Could not rename the order')),
    onDelete: () =>
      askDelete({
        name: order.name,
        onConfirm: () => inOrder(order.id, () => runWithToast(() => deleteOrder(order.id), 'Could not delete the order')),
      }),
    onAdd: (entry) => inOrder(order.id, () => run(() => addEntry(order.id, entry), 'Could not add to the order')),
    onRemove: (entryId) => void inOrder(order.id, () => runWithToast(() => removeEntry(entryId), 'Could not remove the entry')),
    onNote: (entryId, note) => inOrder(order.id, () => run(() => updateEntryNote(entryId, note), 'Could not save the note')),
    onMove: (entryIds, from, to) =>
      void inOrder(order.id, () => runWithToast(() => moveEntry(order.id, entryIds, from, to), 'Could not move the entry')),
  });

  const openEntry = (entry: OrderEntryView) => {
    if (entry.libraryId) setSelected({ id: entry.libraryId, category: entry.mediaType === 'movie' ? 'Movies' : 'TV Shows' });
    else setPreviewEntry(entry);
  };
  const selectedItem = selected && watchlist.find((i) => i.category === selected.category && i.id === selected.id);

  const loading = libraryLoading || orders.isPending;

  return (
    <AppShell title="Watchlist" subtitle="Franchises" toolbar={<WatchlistNav current="franchises" />}>
    <div className="space-y-6">

      <section aria-labelledby="orders-heading" className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="orders-heading"><DotMatrixText text="YOUR VIEWING ORDERS" size="xs" /></h2>
          {isAdmin && (
            <NewOrderForm
              onCreate={(name) => run(() => createOrder({ name }), 'Could not create the order')}
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
                busy={busyOrders.has(order.id)}
                onOpen={openEntry}
                onAddToLibrary={isAdmin ? (entry) => void addToLibrary(entry) : undefined}
                onSeenIt={isAdmin ? (entry, when) => void addToLibrary(entry, { watched: true, watchedWhen: when }) : undefined}
                isAdding={isAdding}
              />
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="tv-spinoffs-heading" className="min-w-0 space-y-3">
        <h2 id="tv-spinoffs-heading"><DotMatrixText text="TV SERIES & SPIN-OFFS IN YOUR LIBRARY" size="xs" /></h2>
        <p className="text-sm text-muted-foreground">
          Connected series and spin-offs discovered from your TV library, in release order. Save one as a viewing order to reorder it or add films.
        </p>
        {tvSpinoffsQuery.isPending && <p role="status" className="text-sm text-muted-foreground">Finding connected series &amp; spin-offs…</p>}
        {!tvSpinoffsQuery.isPending && openTvFranchises.length === 0 && (
          <p className="text-sm text-muted-foreground">No unsaved TV spin-off groups found.</p>
        )}
        {openTvFranchises.length > 0 && (
          <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-2">
            {openTvFranchises.map((franchise) => (
              <TvFranchiseCard
                key={franchise.key}
                franchise={franchise}
                lookup={lookup}
                onOpen={openEntry}
                onAddToLibrary={isAdmin ? (entry) => void addToLibrary(entry) : undefined}
                onSeenIt={isAdmin ? (entry, when) => void addToLibrary(entry, { watched: true, watchedWhen: when }) : undefined}
                isAdding={isAdding}
                onSave={
                  isAdmin
                    ? async (f, view) => {
                        await runWithToast(
                          () => createOrder({ name: f.name.slice(0, 120), entries: view.entries }),
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

      <section aria-labelledby="series-heading" className="min-w-0 space-y-3">
        <h2 id="series-heading"><DotMatrixText text="FILM SERIES IN YOUR LIBRARY" size="xs" /></h2>
        <p className="text-sm text-muted-foreground">
          Collections come from TMDB and list films only, in release order. Save one as a viewing order to reorder it or add series.
        </p>
        {!libraryLoading && collections.length === 0 && (
          <p className="text-sm text-muted-foreground">Film series appear here as the nightly sync fills them in.</p>
        )}
        {openCollections.length > 0 && (
          <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-2">
            {openCollections.map((collection) => (
              <CollectionCard
                key={collection.collectionId}
                collection={collection}
                lookup={lookup}
                getCollection={getCollection}
                onOpen={openEntry}
                onAddToLibrary={isAdmin ? (entry) => void addToLibrary(entry) : undefined}
                onSeenIt={isAdmin ? (entry, when) => void addToLibrary(entry, { watched: true, watchedWhen: when }) : undefined}
                isAdding={isAdding}
                onSave={
                  isAdmin
                    ? async (c, view) => {
                        await runWithToast(
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
      {previewEntry && (
        <EntryPreviewDialog
          entry={previewEntry}
          onOpenChange={(open) => {
            if (!open) setPreviewEntry(null);
          }}
          onAddToLibrary={isAdmin ? (entry) => addToLibrary(entry) : undefined}
          onSeenIt={isAdmin ? (entry, when) => addToLibrary(entry, { watched: true, watchedWhen: when }) : undefined}
          adding={isAdding(previewEntry.key)}
        />
      )}
    </div>
    </AppShell>
  );
}
