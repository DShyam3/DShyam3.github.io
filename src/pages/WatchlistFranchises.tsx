import { useEffect, useMemo, useState } from 'react';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { DotMatrixText } from '@/components/dot-matrix/DotMatrixText';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { WatchlistNav } from '@/features/watchlist/components/WatchlistNav';
import { SectionFailure } from '@/features/watchlist/components/SectionFailure';
import { WatchlistDetailDialog } from '@/features/watchlist/components/WatchlistDetailDialog';
import { CollectionCard } from '@/features/watchlist/components/franchise/CollectionCard';
import { FranchiseCard } from '@/features/watchlist/components/franchise/FranchiseCard';
import { EntryList, POSTER_BASE } from '@/features/watchlist/components/franchise/EntryList';
import { EntryPreviewDialog } from '@/features/watchlist/components/franchise/EntryPreviewDialog';
import { NewOrderForm } from '@/features/watchlist/components/franchise/NewOrderForm';
import { OrderCard, type OrderActions } from '@/features/watchlist/components/franchise/OrderCard';
import { TvFranchiseCard } from '@/features/watchlist/components/franchise/TvFranchiseCard';
import { useAddToLibrary } from '@/features/watchlist/components/franchise/useAddToLibrary';
import {
  buildOrderView,
  collectionPartsToEntries,
  collectionsFromLibrary,
  collectionsInsideUniverses,
  customFranchisesFromLibrary,
  filmUniversesFromMembers,
  libraryLookup,
  tvFranchisesFromLinks,
  type OrderEntryView,
  type UniverseLibraryFilm,
} from '@/features/watchlist/franchise';
import type { TMDBCollection } from '@/features/watchlist/tmdb-types';
import { useTMDB } from '@/features/watchlist/useTMDB';
import { useWatchlist } from '@/features/watchlist/useWatchlist';
import { DismissedContext, useDismissedSuggestions } from '@/features/watchlist/useDismissedSuggestions';
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
import { visibleLibraryFor } from '@/features/watchlist/library-state';
import { tvSeedIdsOf } from '@/features/watchlist/wikidata-cache-query';
import { useDeleteConfirm } from '@/hooks/useDeleteConfirm';
import { useToast } from '@/hooks/use-toast';

/** Postgres unique_violation: the film or show is already in this order. */
const UNIQUE_VIOLATION = '23505';
const COLLECTIONS_PER_BATCH = 20;

type FranchiseCategory = 'all' | 'film-series' | 'tv-spinoffs' | 'orders' | 'library';

/** A collection's name and its films' titles, for the search box. */
const collectionSearchText = (c: { name: string; films: { title: string }[] }) =>
  [c.name, ...c.films.map((f) => f.title)].join(' ').toLowerCase();
type FranchiseProgress = 'all' | 'in-progress' | 'completed';
type FranchiseSort = 'largest' | 'alphabetical';

/** Franchises: viewing orders for film series and cinematic universes. */
export default function WatchlistFranchises() {
  const { watchlist, loading: libraryLoading, getAutoStatus, isEpisodeWatched, isSeasonWatched, toggleEpisodeWatched } = useWatchlist();
  const { isAdmin } = useAuth();
  const { getCollection, getTvSpinoffs, getFilmUniverses } = useTMDB();
  const { addToLibrary, isAdding } = useAddToLibrary();
  // Discover's "Not interested" marks: dimmed here rather than dropped.
  const { notInterested } = useDismissedSuggestions();
  const { askDelete, deleteDialog } = useDeleteConfirm();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const orders = useQuery(viewingOrdersQueryOptions);
  const [selected, setSelected] = useState<{ id: string; category: 'Movies' | 'TV Shows' } | null>(null);
  const [previewEntry, setPreviewEntry] = useState<OrderEntryView | null>(null);
  const [collectionLimit, setCollectionLimit] = useState(COLLECTIONS_PER_BATCH);
  const [categoryFilter, setCategoryFilter] = useState<FranchiseCategory>('all');
  const [progressFilter, setProgressFilter] = useState<FranchiseProgress>('all');
  const [sortBy, setSortBy] = useState<FranchiseSort>('largest');
  const [searchQuery, setSearchQuery] = useState('');
  // Searching asks TMDB for every matching collection, so it waits for a
  // pause in typing rather than asking on each key.
  const [settledQuery, setSettledQuery] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setSettledQuery(searchQuery), 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const visibleWatchlist = useMemo(() => visibleLibraryFor(watchlist, isAdmin), [watchlist, isAdmin]);
  const lookup = useMemo(() => libraryLookup(visibleWatchlist, new Date()), [visibleWatchlist]);

  const savedOrders = useMemo(() => orders.data ?? [], [orders.data]);
  const savedCollectionIds = new Set(savedOrders.flatMap((o) => (o.tmdbCollectionId == null ? [] : [o.tmdbCollectionId])));
  const savedMovieOrderNames = useMemo(
    () => new Set(savedOrders.filter((o) => o.entries.some((e) => e.mediaType === 'movie')).map((o) => o.name.trim().toLowerCase())),
    [savedOrders],
  );
  const savedTvOrderNames = useMemo(
    () => new Set(savedOrders.filter((o) => o.entries.some((e) => e.mediaType === 'tv')).map((o) => o.name.trim().toLowerCase())),
    [savedOrders],
  );
  const collections = useMemo(() => {
    // Hidden and Stopped watching films are the owner's own shelves: visitors do not see them here.
    return collectionsFromLibrary(
      visibleWatchlist.flatMap((item) =>
        item.category === 'Movies' && item.collection_id != null
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
    );
  }, [visibleWatchlist]);
  const openCollections = useMemo(
    () => collections.filter((c) => !savedCollectionIds.has(c.collectionId)),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- savedCollectionIds is derived from savedOrders.
    [collections, savedOrders],
  );
  // The search reaches every collection in the library, not just the ones
  // loaded so far: names and film titles are known before TMDB is asked.
  const normalizedQuery = settledQuery.trim().toLowerCase();
  const searchedCollections = useMemo(() => {
    const filtered = normalizedQuery
      ? openCollections.filter((c) => collectionSearchText(c).includes(normalizedQuery))
      : openCollections;
    if (sortBy !== 'largest') return filtered;
    return [...filtered].sort((a, b) => b.films.length - a.films.length || a.name.localeCompare(b.name));
  }, [openCollections, normalizedQuery, sortBy]);
  const activeCollections = useMemo(
    () => searchedCollections.slice(0, collectionLimit),
    [searchedCollections, collectionLimit],
  );
  const collectionQueries = useQueries({
    queries: activeCollections.map((c) => ({
      queryKey: ['watchlist', 'franchise-collection', c.collectionId] as const,
      enabled: !libraryLoading,
      staleTime: 24 * 60 * 60 * 1000,
      retry: false,
      queryFn: async () => {
        const found = await getCollection(c.collectionId);
        if (!found) throw new Error('Collection unavailable');
        return found;
      },
    })),
  });
  const expandedCollections = useMemo(() => {
    const map = new Map<number, TMDBCollection>();
    activeCollections.forEach((c, idx) => {
      const data = collectionQueries[idx]?.data;
      if (data) map.set(c.collectionId, data);
    });
    return map;
  }, [activeCollections, collectionQueries]);
  const collectionsChecking = activeCollections.length > 0 && collectionQueries.some((q) => q.isPending);
  const hasMoreCollections = collectionLimit < searchedCollections.length;

  const universeLibrary = useMemo(() => {
    const map = new Map<number, UniverseLibraryFilm>();
    for (const item of visibleWatchlist) {
      if (item.category !== 'Movies' || item.tmdb_id == null) continue;
      map.set(item.tmdb_id, {
        id: item.id,
        title: item.title,
        releaseDate: item.release_date?.slice(0, 10) || null,
        poster: item.image_url ?? null,
        lastActivityAt: item.last_activity_at ?? null,
        franchise: item.franchise ?? null,
      });
    }
    return map;
  }, [visibleWatchlist]);
  const filmUniversesQuery = useQuery({
    queryKey: ['watchlist', 'film-universes'],
    queryFn: () => getFilmUniverses({ throwOnError: true }),
    enabled: !libraryLoading && universeLibrary.size > 0,
    staleTime: 24 * 60 * 60 * 1000,
    retry: false,
  });
  const filmUniverses = useMemo(
    () => filmUniversesFromMembers(filmUniversesQuery.data ?? [], universeLibrary, POSTER_BASE),
    [filmUniversesQuery.data, universeLibrary],
  );
  const openFilmUniverses = useMemo(
    () => filmUniverses.filter((u) => !savedMovieOrderNames.has(u.name.trim().toLowerCase())),
    [filmUniverses, savedMovieOrderNames],
  );

  // Show a film series whenever TMDB confirms 2+ parts (even if only 1 is in
  // the library or unwatched), or while pending if 2+ films are already in the library.
  // Collections completely covered by a shared film universe (e.g. MCU sub-collections)
  // fold into that universe card (or its saved viewing order) rather than duplicating.
  const multiPartCollections = useMemo(() => {
    const candidates = activeCollections.flatMap((collection) => {
      const prefetched = expandedCollections.get(collection.collectionId);
      if (prefetched) {
        const entries = collectionPartsToEntries(prefetched.parts ?? [], POSTER_BASE, lookup.movies);
        if (entries.length < 2) return [];
        const view = buildOrderView(entries, lookup);
        return [{ collection, prefetched, entries, watched: view.watched, total: view.total }];
      }
      if (collection.films.length >= 2) {
        const entries = collection.films.map((f) => ({ key: `movie:${f.tmdbId}` }));
        return [{ collection, prefetched: undefined, entries, watched: collection.watched, total: collection.films.length }];
      }
      return [];
    });
    const covered = collectionsInsideUniverses(
      candidates.map((c) => ({ collectionId: c.collection.collectionId, entries: c.entries })),
      filmUniverses,
    );
    return candidates.filter((c) => !covered.has(c.collection.collectionId));
  }, [activeCollections, expandedCollections, lookup, filmUniverses]);

  const tvSeedIds = useMemo(() => tvSeedIdsOf(visibleWatchlist), [visibleWatchlist]);
  const tvSpinoffsQuery = useQuery({
    queryKey: ['watchlist', 'tv-spinoffs', 'v2', tvSeedIds],
    queryFn: () => getTvSpinoffs(tvSeedIds, { throwOnError: true }),
    enabled: !libraryLoading && tvSeedIds.length > 0,
    staleTime: 24 * 60 * 60 * 1000,
    retry: false,
  });
  const tvFranchises = useMemo(
    () => tvFranchisesFromLinks(tvSpinoffsQuery.data ?? [], visibleWatchlist, POSTER_BASE),
    [tvSpinoffsQuery.data, visibleWatchlist],
  );
  const openTvFranchises = useMemo(
    () => tvFranchises.filter((f) => !savedTvOrderNames.has(f.name.trim().toLowerCase())),
    [tvFranchises, savedTvOrderNames],
  );

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
  const selectedItem = selected && visibleWatchlist.find((i) => i.category === selected.category && i.id === selected.id);

  const loading = libraryLoading || orders.isPending;
  const customFranchises = useMemo(() => customFranchisesFromLibrary(visibleWatchlist, lookup), [visibleWatchlist, lookup]);
  const [openCustomFranchises, setOpenCustomFranchises] = useState<Set<string>>(() => new Set());

  const orderItems = useMemo(
    () => savedOrders.map((order) => ({ order, view: buildOrderView(order.entries, lookup) })),
    [savedOrders, lookup],
  );
  const filmUniverseItems = useMemo(
    () => openFilmUniverses.map((universe) => ({ universe, view: buildOrderView(universe.entries, lookup) })),
    [openFilmUniverses, lookup],
  );
  const tvFranchiseItems = useMemo(
    () => openTvFranchises.map((franchise) => ({ franchise, view: buildOrderView(franchise.entries, lookup) })),
    [openTvFranchises, lookup],
  );

  const matchesFilters = (name: string, watched: number, total: number) => {
    if (normalizedQuery && !name.toLowerCase().includes(normalizedQuery)) return false;
    if (progressFilter === 'in-progress') return watched < total;
    if (progressFilter === 'completed') return total > 0 && watched === total;
    return true;
  };

  const bySort = <T,>(items: T[], totalOf: (item: T) => number, nameOf: (item: T) => string) =>
    sortBy === 'largest'
      ? [...items].sort((a, b) => totalOf(b) - totalOf(a) || nameOf(a).localeCompare(nameOf(b)))
      : [...items].sort((a, b) => nameOf(a).localeCompare(nameOf(b)));

  const filteredCustomFranchises = useMemo(
    () => bySort(
      customFranchises.filter((g) => matchesFilters(g.name, g.view.watched, g.view.total)),
      (g) => g.view.total,
      (g) => g.name,
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- matchesFilters & bySort read normalizedQuery, progressFilter & sortBy.
    [customFranchises, normalizedQuery, progressFilter, sortBy],
  );
  const filteredOrders = useMemo(
    () => bySort(
      orderItems.filter((item) => matchesFilters(item.order.name, item.view.watched, item.view.total)),
      (item) => item.view.total,
      (item) => item.order.name,
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- matchesFilters & bySort read normalizedQuery, progressFilter & sortBy.
    [orderItems, normalizedQuery, progressFilter, sortBy],
  );
  const filteredTvFranchises = useMemo(
    () => bySort(
      tvFranchiseItems.filter((item) => matchesFilters(item.franchise.name, item.view.watched, item.view.total)),
      (item) => item.view.total,
      (item) => item.franchise.name,
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- matchesFilters & bySort read normalizedQuery, progressFilter & sortBy.
    [tvFranchiseItems, normalizedQuery, progressFilter, sortBy],
  );
  const filteredFilmUniverses = useMemo(
    () => bySort(
      filmUniverseItems.filter((item) =>
        matchesFilters(
          `${item.universe.name} ${item.universe.entries.map((e) => e.title).join(' ')}`,
          item.view.watched,
          item.view.total,
        ),
      ),
      (item) => item.view.total,
      (item) => item.universe.name,
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- matchesFilters & bySort read normalizedQuery, progressFilter & sortBy.
    [filmUniverseItems, normalizedQuery, progressFilter, sortBy],
  );
  const filteredCollections = useMemo(
    () => bySort(
      multiPartCollections.filter((item) => matchesFilters(collectionSearchText(item.collection), item.watched, item.total)),
      (item) => item.total,
      (item) => item.collection.name,
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- matchesFilters & bySort read normalizedQuery, progressFilter & sortBy.
    [multiPartCollections, normalizedQuery, progressFilter, sortBy],
  );

  const showCategory = (cat: Exclude<FranchiseCategory, 'all'>) => categoryFilter === 'all' || categoryFilter === cat;
  // Every film collection and shared universe in the library counts, loaded or not.
  const filmSeriesCount = openFilmUniverses.length + openCollections.length;
  const totalCount =
    customFranchises.length + savedOrders.length + openTvFranchises.length + filmSeriesCount;

  return (
    <AppShell title="Watchlist" subtitle="Franchises" toolbar={<WatchlistNav current="franchises" />}>
    <DismissedContext.Provider value={notInterested}>
    <div className="space-y-6 pb-8">
      <div className="flex flex-col gap-3 rounded-lg border border-border/60 bg-card/40 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Franchise categories">
            {(
              [
                { id: 'all', label: 'All', count: totalCount },
                { id: 'film-series', label: 'Film Series', count: filmSeriesCount },
                { id: 'tv-spinoffs', label: 'TV & Spin-offs', count: openTvFranchises.length },
                { id: 'orders', label: 'Viewing Orders', count: savedOrders.length },
                ...(customFranchises.length > 0
                  ? [{ id: 'library' as const, label: 'Library Franchises', count: customFranchises.length }]
                  : []),
              ] as const
            ).map((cat) => (
              <Button
                key={cat.id}
                type="button"
                size="sm"
                variant={categoryFilter === cat.id ? 'secondary' : 'ghost'}
                onClick={() => setCategoryFilter(cat.id)}
                className="gap-1.5"
              >
                <span>{cat.label}</span>
                <span className="text-xs text-muted-foreground">{cat.count}</span>
              </Button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Sort franchises">
              {(
                [
                  { id: 'largest', label: 'Largest' },
                  { id: 'alphabetical', label: 'A–Z' },
                ] as const
              ).map((option) => (
                <Button
                  key={option.id}
                  type="button"
                  size="sm"
                  variant={sortBy === option.id ? 'secondary' : 'ghost'}
                  onClick={() => setSortBy(option.id)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Completion status">
            {(
              [
                { id: 'all', label: 'All status' },
                { id: 'in-progress', label: 'In progress' },
                { id: 'completed', label: 'Completed' },
              ] as const
            ).map((status) => (
              <Button
                key={status.id}
                type="button"
                size="sm"
                variant={progressFilter === status.id ? 'secondary' : 'ghost'}
                onClick={() => setProgressFilter(status.id)}
              >
                {status.label}
              </Button>
            ))}
            </div>
          </div>
        </div>

        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <Input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter franchises…"
            aria-label="Filter franchises"
            className="pl-8"
          />
        </div>
      </div>

      {showCategory('library') && filteredCustomFranchises.length > 0 && (
        <section aria-labelledby="custom-franchises-heading" className="min-w-0 space-y-3">
          <h2 id="custom-franchises-heading"><DotMatrixText text="LIBRARY FRANCHISES" size="xs" /></h2>
          <p className="text-sm text-muted-foreground">
            Films and series grouped by the franchise field stored in your library.
          </p>
          <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-2">
            {filteredCustomFranchises.map((group) => (
              <FranchiseCard
                key={group.name}
                name={group.name}
                summary={`${group.view.watched} of ${group.view.total} watched`}
                nextUp={group.view.nextUp?.title}
                strip={group.view.entries.map((e) => ({ key: e.key, poster: e.poster, mediaType: e.mediaType, watched: e.state === 'watched' }))}
                open={openCustomFranchises.has(group.name)}
                onToggle={() =>
                  setOpenCustomFranchises((prev) => {
                    const next = new Set(prev);
                    if (next.has(group.name)) next.delete(group.name);
                    else next.add(group.name);
                    return next;
                  })
                }
              >
                <EntryList view={group.view} onOpen={openEntry} />
              </FranchiseCard>
            ))}
          </div>
        </section>
      )}

      {showCategory('orders') && (
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
          {!loading && !orders.isError && filteredOrders.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {savedOrders.length === 0 ? 'No viewing orders yet.' : 'No viewing orders match the current filter.'}
            </p>
          )}
          {!loading && filteredOrders.length > 0 && (
            <div className="space-y-3">
              {filteredOrders.map(({ order, view }) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  view={view}
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
      )}

      {showCategory('tv-spinoffs') && (
        <section aria-labelledby="tv-spinoffs-heading" className="min-w-0 space-y-3">
          <h2 id="tv-spinoffs-heading"><DotMatrixText text="TV SERIES & SPIN-OFFS IN YOUR LIBRARY" size="xs" /></h2>
          <p className="text-sm text-muted-foreground">
            Connected series and spin-offs discovered from your TV library, in release order. Save one as a viewing order to reorder it or add films.
          </p>
          {tvSpinoffsQuery.isPending && <p role="status" className="text-sm text-muted-foreground">Finding connected series &amp; spin-offs…</p>}
          {!tvSpinoffsQuery.isPending && filteredTvFranchises.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {openTvFranchises.length === 0 ? 'No unsaved TV spin-off groups found.' : 'No TV spin-off groups match the current filter.'}
            </p>
          )}
          {filteredTvFranchises.length > 0 && (
            <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-2">
              {filteredTvFranchises.map(({ franchise }) => (
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
      )}

      {showCategory('film-series') && (
        <section aria-labelledby="series-heading" className="min-w-0 space-y-3">
          <h2 id="series-heading"><DotMatrixText text="FILM SERIES IN YOUR LIBRARY" size="xs" /></h2>
          <p className="text-sm text-muted-foreground">
            Shared film universes (such as the Marvel Cinematic Universe) and TMDB collections in release order (2 or more films). Save one as a viewing order to reorder it or add series.
          </p>
          {(collectionsChecking || filmUniversesQuery.isPending) && multiPartCollections.length === 0 && openFilmUniverses.length === 0 && (
            <p role="status" className="text-sm text-muted-foreground">Checking TMDB for film series…</p>
          )}
          {!libraryLoading && !collectionsChecking && !filmUniversesQuery.isPending && filteredFilmUniverses.length === 0 && filteredCollections.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {!normalizedQuery && progressFilter === 'all'
                ? 'Film series appear here as the nightly sync fills them in.'
                : 'No film series match the current filter.'}
            </p>
          )}
          {(filteredFilmUniverses.length > 0 || filteredCollections.length > 0) && (
            <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-2">
              {filteredFilmUniverses.map(({ universe }) => (
                <TvFranchiseCard
                  key={`universe:${universe.id}`}
                  franchise={{ key: `universe:${universe.id}`, name: universe.name, entries: universe.entries }}
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
              {filteredCollections.map(({ collection, prefetched }) => (
                <CollectionCard
                  key={collection.collectionId}
                  collection={collection}
                  lookup={lookup}
                  getCollection={getCollection}
                  prefetchedCollection={prefetched}
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
          {hasMoreCollections && (
            <div className="flex justify-center pt-1">
              <Button variant="outline" onClick={() => setCollectionLimit((prev) => prev + COLLECTIONS_PER_BATCH)}>
                Show more film series
              </Button>
            </div>
          )}
        </section>
      )}

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
    </DismissedContext.Provider>
    </AppShell>
  );
}
