import { useEffect, useMemo, useState } from 'react';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronsDownUp, ChevronsUpDown, Search, X } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { DotMatrixText } from '@/components/dot-matrix/DotMatrixText';
import { CountLabel } from '@/components/shared/CountLabel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MetricTile } from '@/components/ui/metric-tile';
import { NativeSelect } from '@/components/ui/native-select';
import { WatchlistNav } from '@/features/watchlist/components/WatchlistNav';
import { SegmentedControl } from '@/features/watchlist/components/SegmentedControl';
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
import { cn } from '@/lib/utils';

/** Postgres unique_violation: the film or show is already in this order. */
const UNIQUE_VIOLATION = '23505';
const COLLECTIONS_PER_BATCH = 20;

type FranchiseCategory = 'all' | 'film-series' | 'tv-spinoffs' | 'orders' | 'library';
type FranchiseProgress = 'all' | 'in-progress' | 'completed' | 'not-started';
type FranchiseSort = 'largest' | 'progress' | 'alphabetical';

const PROGRESS_OPTIONS: readonly { key: FranchiseProgress; label: string }[] = [
  { key: 'all', label: 'All status' },
  { key: 'in-progress', label: 'In progress' },
  { key: 'completed', label: 'Completed' },
  { key: 'not-started', label: 'Not started' },
];

const SORT_OPTIONS: readonly { key: FranchiseSort; label: string }[] = [
  { key: 'largest', label: 'Largest' },
  { key: 'progress', label: 'Most watched' },
  { key: 'alphabetical', label: 'A–Z' },
];

/** A collection's name and its films' titles, for the search box. */
const collectionSearchText = (c: { name: string; films: { title: string }[] }) =>
  [c.name, ...c.films.map((f) => f.title)].join(' ').toLowerCase();

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
  const [openCards, setOpenCards] = useState<Set<string>>(() => new Set());

  // Searching asks TMDB for every matching collection, so it waits for a
  // pause in typing rather than asking on each key.
  const [settledQuery, setSettledQuery] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setSettledQuery(searchQuery), 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const toggleCard = (cardKey: string) => {
    setOpenCards((prev) => {
      const next = new Set(prev);
      if (next.has(cardKey)) next.delete(cardKey);
      else next.add(cardKey);
      return next;
    });
  };

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
    if (sortBy === 'alphabetical') return filtered;
    if (sortBy === 'progress') {
      return [...filtered].sort(
        (a, b) =>
          (b.films.length ? b.watched / b.films.length : 0) - (a.films.length ? a.watched / a.films.length : 0) ||
          b.films.length - a.films.length ||
          a.name.localeCompare(b.name),
      );
    }
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
    queryKey: ['watchlist', 'tv-spinoffs', 'v3', tvSeedIds],
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
    if (progressFilter === 'in-progress') return watched > 0 && watched < total;
    if (progressFilter === 'completed') return total > 0 && watched >= total;
    if (progressFilter === 'not-started') return total > 0 && watched === 0;
    return true;
  };

  const bySort = <T,>(
    items: T[],
    watchedOf: (item: T) => number,
    totalOf: (item: T) => number,
    nameOf: (item: T) => string,
  ) => {
    if (sortBy === 'alphabetical') {
      return [...items].sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
    }
    if (sortBy === 'progress') {
      return [...items].sort((a, b) => {
        const pctA = totalOf(a) > 0 ? watchedOf(a) / totalOf(a) : 0;
        const pctB = totalOf(b) > 0 ? watchedOf(b) / totalOf(b) : 0;
        return pctB - pctA || totalOf(b) - totalOf(a) || nameOf(a).localeCompare(nameOf(b));
      });
    }
    return [...items].sort((a, b) => totalOf(b) - totalOf(a) || nameOf(a).localeCompare(nameOf(b)));
  };

  const filteredCustomFranchises = useMemo(
    () => bySort(
      customFranchises.filter((g) => matchesFilters(g.name, g.view.watched, g.view.total)),
      (g) => g.view.watched,
      (g) => g.view.total,
      (g) => g.name,
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- matchesFilters & bySort read normalizedQuery, progressFilter & sortBy.
    [customFranchises, normalizedQuery, progressFilter, sortBy],
  );
  const filteredOrders = useMemo(
    () => bySort(
      orderItems.filter((item) => matchesFilters(item.order.name, item.view.watched, item.view.total)),
      (item) => item.view.watched,
      (item) => item.view.total,
      (item) => item.order.name,
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- matchesFilters & bySort read normalizedQuery, progressFilter & sortBy.
    [orderItems, normalizedQuery, progressFilter, sortBy],
  );
  const filteredTvFranchises = useMemo(
    () => bySort(
      tvFranchiseItems.filter((item) => matchesFilters(item.franchise.name, item.view.watched, item.view.total)),
      (item) => item.view.watched,
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
      (item) => item.view.watched,
      (item) => item.view.total,
      (item) => item.universe.name,
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- matchesFilters & bySort read normalizedQuery, progressFilter & sortBy.
    [filmUniverseItems, normalizedQuery, progressFilter, sortBy],
  );
  const filteredCollections = useMemo(
    () => bySort(
      multiPartCollections.filter((item) => matchesFilters(collectionSearchText(item.collection), item.watched, item.total)),
      (item) => item.watched,
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

  // Deterministic summary stats across all loaded franchise groups
  const overviewStats = useMemo(() => {
    const groups: { watched: number; total: number }[] = [
      ...customFranchises.map((g) => ({ watched: g.view.watched, total: g.view.total })),
      ...orderItems.map((o) => ({ watched: o.view.watched, total: o.view.total })),
      ...tvFranchiseItems.map((t) => ({ watched: t.view.watched, total: t.view.total })),
      ...filmUniverseItems.map((u) => ({ watched: u.view.watched, total: u.view.total })),
      ...multiPartCollections.map((c) => ({ watched: c.watched, total: c.total })),
    ];
    let completed = 0;
    let inProgress = 0;
    let watchedEntries = 0;
    let totalEntries = 0;
    for (const g of groups) {
      if (g.total <= 0) continue;
      watchedEntries += g.watched;
      totalEntries += g.total;
      if (g.watched >= g.total) completed += 1;
      else if (g.watched > 0) inProgress += 1;
    }
    const overallPct = totalEntries > 0 ? Math.round((watchedEntries / totalEntries) * 100) : 0;
    return { completed, inProgress, watchedEntries, totalEntries, overallPct };
  }, [customFranchises, orderItems, tvFranchiseItems, filmUniverseItems, multiPartCollections]);

  const visibleCardKeys = useMemo(() => {
    const keys: string[] = [];
    if (showCategory('library')) {
      for (const g of filteredCustomFranchises) keys.push(`custom:${g.name}`);
    }
    if (showCategory('orders')) {
      for (const { order } of filteredOrders) keys.push(`order:${order.id}`);
    }
    if (showCategory('tv-spinoffs')) {
      for (const { franchise } of filteredTvFranchises) keys.push(`tv:${franchise.key}`);
    }
    if (showCategory('film-series')) {
      for (const { universe } of filteredFilmUniverses) keys.push(`universe:${universe.id}`);
      for (const { collection } of filteredCollections) keys.push(`collection:${collection.collectionId}`);
    }
    return keys;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- showCategory reads categoryFilter.
  }, [
    categoryFilter,
    filteredCustomFranchises,
    filteredOrders,
    filteredTvFranchises,
    filteredFilmUniverses,
    filteredCollections,
  ]);

  const allVisibleOpen =
    visibleCardKeys.length > 0 && visibleCardKeys.every((key) => openCards.has(key));

  const toggleAllVisible = () => {
    setOpenCards((prev) => {
      const next = new Set(prev);
      if (allVisibleOpen) {
        for (const key of visibleCardKeys) next.delete(key);
      } else {
        for (const key of visibleCardKeys) next.add(key);
      }
      return next;
    });
  };

  const categoryButtons = [
    { id: 'all' as const, label: 'All', count: totalCount },
    { id: 'film-series' as const, label: 'Film Series', count: filmSeriesCount },
    { id: 'tv-spinoffs' as const, label: 'TV & Spin-offs', count: openTvFranchises.length },
    { id: 'orders' as const, label: 'Viewing Orders', count: savedOrders.length },
    ...(customFranchises.length > 0
      ? [{ id: 'library' as const, label: 'Library Franchises', count: customFranchises.length }]
      : []),
  ];

  const toolbar = (
    <div className="watchlist-toolbar space-y-2.5 py-2">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <WatchlistNav current="franchises" />
        {isAdmin ? (
          <NewOrderForm
            onCreate={(name) => run(() => createOrder({ name }), 'Could not create the order')}
          />
        ) : null}
      </div>

      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <NativeSelect
          aria-label="Franchise categories"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as FranchiseCategory)}
          wrapperClassName="w-full sm:hidden"
        >
          {categoryButtons.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.label} ({cat.count})
            </option>
          ))}
        </NativeSelect>

        <div
          className="hidden sm:flex flex-wrap items-center gap-1 rounded-full border border-border/70 bg-card/60 p-1"
          role="group"
          aria-label="Franchise categories"
        >
          {categoryButtons.map((cat) => {
            const active = categoryFilter === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                aria-pressed={active}
                onClick={() => setCategoryFilter(cat.id)}
                className={cn(
                  't-press inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-xs sm:text-sm font-medium transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                  active
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-foreground/80 hover:bg-muted/70 hover:text-foreground',
                )}
              >
                <span>{cat.label}</span>
                <span
                  className={cn(
                    'rounded-full px-1.5 py-0.5 font-mono text-xs tabular-nums',
                    active
                      ? 'bg-primary-foreground/20 text-primary-foreground'
                      : 'bg-muted text-muted-foreground',
                  )}
                >
                  {cat.count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-1 basis-64 flex-wrap items-center justify-end gap-2">
          <div className="relative min-w-[13rem] flex-1 max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter franchises or titles…"
              aria-label="Filter franchises"
              className={cn('h-11 w-full pl-9', searchQuery && 'pr-10')}
            />
            {searchQuery ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="group/clear absolute right-0 top-0 h-11 w-11 text-muted-foreground hover:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                aria-label="Clear franchise filter"
                onClick={() => setSearchQuery('')}
              >
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full transition-colors group-hover/clear:bg-secondary group-hover/clear:text-secondary-foreground group-focus-visible/clear:ring-2 group-focus-visible/clear:ring-ring">
                  <X className="h-4 w-4" />
                </span>
              </Button>
            ) : null}
          </div>

          <NativeSelect
            aria-label="Completion status"
            value={progressFilter}
            onChange={(e) => setProgressFilter(e.target.value as FranchiseProgress)}
            wrapperClassName="w-auto sm:hidden"
          >
            {PROGRESS_OPTIONS.map((opt) => (
              <option key={opt.key} value={opt.key}>
                {opt.label}
              </option>
            ))}
          </NativeSelect>
          <SegmentedControl
            label="Completion status"
            options={PROGRESS_OPTIONS}
            value={progressFilter}
            onChange={setProgressFilter}
            className="hidden sm:inline-flex"
          />

          <NativeSelect
            aria-label="Sort franchises"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as FranchiseSort)}
            wrapperClassName="w-auto sm:hidden"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.key} value={opt.key}>
                {opt.label}
              </option>
            ))}
          </NativeSelect>
          <SegmentedControl
            label="Sort franchises"
            options={SORT_OPTIONS}
            value={sortBy}
            onChange={setSortBy}
            className="hidden sm:inline-flex"
          />
        </div>
      </div>
    </div>
  );

  return (
    <AppShell title="Watchlist" subtitle="Franchises" toolbar={toolbar}>
      <DismissedContext.Provider value={notInterested}>
        <div className="space-y-6 pb-8">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricTile
              label="Franchises tracked"
              value={totalCount}
              variant="gradient"
              loading={loading}
              detail={[
                `${filmSeriesCount} film series`,
                `${openTvFranchises.length} TV universes`,
                `${savedOrders.length} orders`,
                ...(customFranchises.length > 0 ? [`${customFranchises.length} library`] : []),
              ].join(' · ')}
            />
            <MetricTile
              label="In progress"
              value={overviewStats.inProgress}
              loading={loading}
              detail="Started with entries still to watch"
            />
            <MetricTile
              label="Completed"
              value={overviewStats.completed}
              tone={overviewStats.completed > 0 ? 'positive' : 'neutral'}
              loading={loading}
              detail="Every listed installment watched"
            />
            <MetricTile
              label="Entries watched"
              value={overviewStats.watchedEntries}
              suffix={overviewStats.totalEntries > 0 ? ` / ${overviewStats.totalEntries}` : undefined}
              loading={loading}
              detail={`${overviewStats.overallPct}% completion across loaded franchises`}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-3">
            <div className="space-y-0.5">
              <CountLabel
                count={loading ? undefined : visibleCardKeys.length}
                noun={
                  normalizedQuery || progressFilter !== 'all'
                    ? visibleCardKeys.length === 1
                      ? 'matching franchise'
                      : 'matching franchises'
                    : visibleCardKeys.length === 1
                      ? 'loaded franchise'
                      : 'loaded franchises'
                }
              />
              <p className="text-xs text-muted-foreground">
                Click any franchise card to inspect its release order, check what is up next, or save a custom viewing order.
              </p>
            </div>

            {visibleCardKeys.length > 0 ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={toggleAllVisible}
                className="gap-1.5 font-mono text-xs"
              >
                {allVisibleOpen ? (
                  <>
                    <ChevronsDownUp className="h-3.5 w-3.5" aria-hidden="true" />
                    Collapse all
                  </>
                ) : (
                  <>
                    <ChevronsUpDown className="h-3.5 w-3.5" aria-hidden="true" />
                    Expand all
                  </>
                )}
              </Button>
            ) : null}
          </div>

          {showCategory('library') && filteredCustomFranchises.length > 0 && (
            <section aria-labelledby="custom-franchises-heading" className="min-w-0 space-y-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="space-y-1">
                  <h2 id="custom-franchises-heading" className="flex items-center gap-2">
                    <DotMatrixText text="LIBRARY FRANCHISES" size="xs" />
                    <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-xs tabular-nums text-muted-foreground">
                      {filteredCustomFranchises.length}
                    </span>
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Films and series grouped by the franchise field stored in your library.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-2">
                {filteredCustomFranchises.map((group) => {
                  const cardKey = `custom:${group.name}`;
                  return (
                    <FranchiseCard
                      key={group.name}
                      name={group.name}
                      kindLabel="Library Franchise"
                      summary={`${group.view.watched} of ${group.view.total} watched`}
                      watchedCount={group.view.watched}
                      totalCount={group.view.total}
                      nextUp={group.view.nextUp?.title}
                      nextUpYear={group.view.nextUp?.releaseDate?.slice(0, 4) ?? null}
                      strip={group.view.entries.map((e) => ({
                        key: e.key,
                        title: e.title,
                        poster: e.poster,
                        mediaType: e.mediaType,
                        watched: e.state === 'watched',
                        inProgress: e.state === 'in-progress',
                      }))}
                      open={openCards.has(cardKey)}
                      onToggle={() => toggleCard(cardKey)}
                    >
                      <EntryList view={group.view} onOpen={openEntry} />
                    </FranchiseCard>
                  );
                })}
              </div>
            </section>
          )}

          {showCategory('orders') && (
            <section aria-labelledby="orders-heading" className="min-w-0 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <h2 id="orders-heading" className="flex items-center gap-2">
                    <DotMatrixText text="YOUR VIEWING ORDERS" size="xs" />
                    <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-xs tabular-nums text-muted-foreground">
                      {filteredOrders.length}
                    </span>
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Custom film and series sequences you have saved and ordered by hand.
                  </p>
                </div>
              </div>
              {loading && <p role="status" className="text-sm text-muted-foreground">Loading viewing orders…</p>}
              {orders.isError && <SectionFailure>Could not load viewing orders</SectionFailure>}
              {!loading && !orders.isError && filteredOrders.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  {savedOrders.length === 0 ? 'No viewing orders yet.' : 'No viewing orders match the current filter.'}
                </p>
              )}
              {!loading && filteredOrders.length > 0 && (
                <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-2">
                  {filteredOrders.map(({ order, view }) => {
                    const cardKey = `order:${order.id}`;
                    return (
                      <OrderCard
                        key={order.id}
                        order={order}
                        view={view}
                        open={openCards.has(cardKey)}
                        onToggle={() => toggleCard(cardKey)}
                        actions={isAdmin ? actionsFor(order) : undefined}
                        busy={busyOrders.has(order.id)}
                        onOpen={openEntry}
                        onAddToLibrary={isAdmin ? (entry) => void addToLibrary(entry) : undefined}
                        onSeenIt={isAdmin ? (entry, when) => void addToLibrary(entry, { watched: true, watchedWhen: when }) : undefined}
                        isAdding={isAdding}
                      />
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {showCategory('tv-spinoffs') && (
            <section aria-labelledby="tv-spinoffs-heading" className="min-w-0 space-y-3">
              <div className="space-y-1">
                <h2 id="tv-spinoffs-heading" className="flex items-center gap-2">
                  <DotMatrixText text="TV SERIES & SPIN-OFFS IN YOUR LIBRARY" size="xs" />
                  <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-xs tabular-nums text-muted-foreground">
                    {filteredTvFranchises.length}
                  </span>
                </h2>
                <p className="text-sm text-muted-foreground">
                  Connected series and spin-offs discovered from your TV library, in release order. Save one as a viewing order to reorder it or add films.
                </p>
              </div>
              {tvSpinoffsQuery.isPending && <p role="status" className="text-sm text-muted-foreground">Finding connected series &amp; spin-offs…</p>}
              {!tvSpinoffsQuery.isPending && filteredTvFranchises.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  {openTvFranchises.length === 0 ? 'No unsaved TV spin-off groups found.' : 'No TV spin-off groups match the current filter.'}
                </p>
              )}
              {filteredTvFranchises.length > 0 && (
                <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-2">
                  {filteredTvFranchises.map(({ franchise }) => {
                    const cardKey = `tv:${franchise.key}`;
                    return (
                      <TvFranchiseCard
                        key={franchise.key}
                        franchise={franchise}
                        kindLabel="TV Universe"
                        lookup={lookup}
                        open={openCards.has(cardKey)}
                        onToggle={() => toggleCard(cardKey)}
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
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {showCategory('film-series') && (
            <section aria-labelledby="series-heading" className="min-w-0 space-y-3">
              <div className="space-y-1">
                <h2 id="series-heading" className="flex items-center gap-2">
                  <DotMatrixText text="FILM SERIES IN YOUR LIBRARY" size="xs" />
                  <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-xs tabular-nums text-muted-foreground">
                    {filteredFilmUniverses.length + filteredCollections.length}
                  </span>
                </h2>
                <p className="text-sm text-muted-foreground">
                  Shared film universes (such as the Marvel Cinematic Universe) and TMDB collections in release order (2 or more films). Save one as a viewing order to reorder it or add series.
                </p>
              </div>
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
                  {filteredFilmUniverses.map(({ universe }) => {
                    const cardKey = `universe:${universe.id}`;
                    return (
                      <TvFranchiseCard
                        key={cardKey}
                        franchise={{ key: cardKey, name: universe.name, entries: universe.entries }}
                        kindLabel="Film Universe"
                        lookup={lookup}
                        open={openCards.has(cardKey)}
                        onToggle={() => toggleCard(cardKey)}
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
                    );
                  })}
                  {filteredCollections.map(({ collection, prefetched }) => {
                    const cardKey = `collection:${collection.collectionId}`;
                    return (
                      <CollectionCard
                        key={collection.collectionId}
                        collection={collection}
                        lookup={lookup}
                        getCollection={getCollection}
                        prefetchedCollection={prefetched}
                        open={openCards.has(cardKey)}
                        onToggle={() => toggleCard(cardKey)}
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
                    );
                  })}
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
