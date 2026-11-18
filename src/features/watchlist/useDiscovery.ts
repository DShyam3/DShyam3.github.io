import { useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { selectAllPages } from '@/integrations/supabase/select-all-pages';
import { useAuth } from '@/contexts/AuthContext';
import { useWatchlist } from './useWatchlist';
import {
  SEEDS_PER_PAGE,
  curateDiscovery,
  discoveryKey,
  discoverySeeds,
  interleaveBySeed,
  interleaveUpcoming,
  likelySeenConsensus,
  weekIndex,
  type DiscoveryItem,
  type DiscoveryMedia,
  type DiscoverySeed,
} from './discovery';
import {
  buildOrderView,
  collectionPartsToEntries,
  collectionsFromLibrary,
  hasWatchGap,
  libraryLookup,
  tvFranchisesFromLinks,
  type OrderEntryInput,
  type OrderView,
} from './franchise';
import { POSTER_BASE } from './components/franchise/EntryList';
import { libraryCollectionsQueryOptions } from './viewing-orders-query';
import { useTMDB } from './useTMDB';
import type { LibraryType } from './library-state';
import type { TMDBSearchResponse } from './tmdb-types';

const DISMISSED_KEY = 'watchlist-discovery-dismissed-v1';
const DISMISSED_QUERY_KEY = ['watchlist', 'dismissed-suggestions'] as const;
/** TMDB stops paging at 500; the filler never needs to go that far. */
const MAX_PAGES = 200;

function readDismissed(): Set<string> {
  try { const saved: unknown = JSON.parse(localStorage.getItem(DISMISSED_KEY) || '[]'); return new Set(Array.isArray(saved) ? saved.filter((key): key is string => typeof key === 'string') : []); } catch { return new Set(); }
}
function writeDismissed(keys: Set<string>) {
  try { localStorage.setItem(DISMISSED_KEY, JSON.stringify([...keys])); } catch { /* Still works for this visit. */ }
}

async function request(endpoint: string, params: Record<string, string>): Promise<TMDBSearchResponse> {
  const query = new URLSearchParams({ endpoint, language: 'en-GB', page: '1', ...params });
  const { data, error } = await supabase.functions.invoke(`tmdb-proxy?${query}`, { method: 'GET' });
  if (error) throw error;
  return data as TMDBSearchResponse;
}

interface Source {
  endpoint: string;
  params: Record<string, string>;
  media: DiscoveryMedia;
  reason: string;
  kind: DiscoveryItem['kind'];
  seedKey?: string;
  shortReason?: string;
}

interface Loaded { items: DiscoveryItem[]; failed: boolean }

/** A page of suggestions, and the seed list every later page walks. */
interface SuggestionPage extends Loaded { seeds: DiscoverySeed[] }
interface PageParam { page: number; seeds: DiscoverySeed[] | null }

async function load(sources: Source[]): Promise<Loaded> {
  const results = await Promise.allSettled(sources.map(async (source) => {
    const data = await request(source.endpoint, source.params);
    return (data.results ?? [])
      .filter((row) => !(row as { adult?: boolean }).adult)
      .map((row): DiscoveryItem => ({ ...row, media: source.media, reason: source.reason, kind: source.kind, seedKey: source.seedKey, shortReason: source.shortReason }));
  }));
  if (results.length > 0 && results.every((result) => result.status === 'rejected')) {
    throw new Error('Failed to load suggestions');
  }
  return {
    items: results.flatMap((result) => (result.status === 'fulfilled' ? result.value : [])),
    failed: results.some((result) => result.status === 'rejected'),
  };
}

/**
 * One page of suggestions for one media type (`movie` or `tv`). Pages walk
 * that media type's seed list four at a time; once it runs out, they continue
 * with TMDB's most-voted titles of that media type, page by page.
 */
function sourcesForMediaPage(seeds: DiscoverySeed[], page: number, media: DiscoveryMedia): Source[] {
  const slice = seeds.slice(page * SEEDS_PER_PAGE, (page + 1) * SEEDS_PER_PAGE);
  if (slice.length > 0) {
    return slice.map((seed) => ({
      endpoint: `${seed.media}/${seed.id}/recommendations`,
      params: {},
      media: seed.media,
      reason: seed.reason,
      shortReason: `Like ${seed.title}`,
      kind: 'recommendation' as const,
      seedKey: discoveryKey(seed.media, seed.id),
    }));
  }
  const fillerPage = page - Math.ceil(seeds.length / SEEDS_PER_PAGE) + 1;
  return [{
    endpoint: `discover/${media}`,
    params: { sort_by: 'vote_count.desc', include_adult: 'false', page: String(fillerPage) },
    media,
    reason: 'Widely loved on TMDB',
    shortReason: 'Widely loved',
    kind: 'recommendation' as const,
    seedKey: `filler:${media}`,
  }];
}

export interface DiscoveryFranchiseGroup {
  key: string;
  name: string;
  kind: 'collection' | 'tv-spinoff';
  media: DiscoveryMedia;
  view: OrderView;
  missingCount: number;
  hasGap: boolean;
}

const COLLECTIONS_PER_BATCH = 8;

export function useDiscovery(type: LibraryType) {
  const { watchlist, favourites, loading, ratingsStatus } = useWatchlist();
  const { getCollection, getTvSpinoffs } = useTMDB();
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [localDismissed, setLocalDismissed] = useState(readDismissed);
  const [collectionLimit, setCollectionLimit] = useState(COLLECTIONS_PER_BATCH);
  const today = new Date();
  const week = weekIndex(today);

  // The owner's dismissals, shared across devices. Before the table exists
  // (migration not applied) the read fails and the browser copy carries on.
  const remote = useQuery({
    queryKey: DISMISSED_QUERY_KEY,
    staleTime: 5 * 60 * 1000,
    retry: false,
    queryFn: async () => {
      // Paged: dismissals only grow, and the Data API stops at 1,000 rows.
      const { data, error } = await selectAllPages((from, to) => supabase
        .from('watchlist_dismissed_suggestions')
        .select('id, media, tmdb_id', { count: 'exact' })
        .order('id', { ascending: true })
        .range(from, to), (row) => String(row.id));
      if (error) throw new Error(error.message);
      return data.map((row) => discoveryKey(row.media as DiscoveryMedia, row.tmdb_id));
    },
  });
  const synced = remote.isSuccess;
  const ownerSynced = isAdmin && synced;
  const dismissed = useMemo(() => new Set([...localDismissed, ...(remote.data ?? [])]), [localDismissed, remote.data]);

  // Once the owner's table is reachable, this browser's own dismissals move
  // into it, so a reset on one device clears them on every device.
  const remoteKeys = remote.data;
  useEffect(() => {
    if (!ownerSynced || localDismissed.size === 0) return;
    // Only the keys seen now are handed over; one dismissed while the write
    // is in flight stays local until the next pass sends it.
    const handed = new Set(localDismissed);
    const pending = [...handed].filter((key) => !remoteKeys?.includes(key));
    const rows = pending.map((key) => {
      const [media, id] = key.split(':');
      return { media, tmdb_id: Number(id) };
    }).filter((row) => (row.media === 'movie' || row.media === 'tv') && Number.isInteger(row.tmdb_id) && row.tmdb_id > 0);
    const releaseLocal = () => {
      setLocalDismissed((prev) => {
        const next = new Set([...prev].filter((key) => !handed.has(key)));
        if (next.size > 0) writeDismissed(next);
        else { try { localStorage.removeItem(DISMISSED_KEY); } catch { /* Still works for this visit. */ } }
        return next;
      });
    };
    if (rows.length === 0) { releaseLocal(); return; }
    void supabase.from('watchlist_dismissed_suggestions').upsert(rows, { onConflict: 'media,tmdb_id', ignoreDuplicates: true })
      .then(({ error }) => {
        if (error) return;
        // Into the shared copy first, so the tile does not come back while
        // the table is re-read.
        const sent = rows.map((row) => discoveryKey(row.media as DiscoveryMedia, row.tmdb_id));
        queryClient.setQueryData<string[]>(DISMISSED_QUERY_KEY, (old) => [...new Set([...(old ?? []), ...sent])]);
        releaseLocal();
        void queryClient.invalidateQueries({ queryKey: DISMISSED_QUERY_KEY });
      });
  }, [ownerSynced, localDismissed, remoteKeys, queryClient]);

  // Seeds are read at fetch time rather than keyed on: adding a suggestion
  // changes the library, and must not throw the pages already loaded away.
  // Ranking walks the whole library, so only when its inputs change.
  // Built separately for films and series so All, Films and Series read from
  // the exact same movie and TV caches: every film shown in All is in Films,
  // and every series shown in All is in Series.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `week` stands in for `today`.
  const movieSeeds = useMemo(() => discoverySeeds(watchlist, favourites, today, 'movie'), [watchlist, favourites, week]);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `week` stands in for `today`.
  const tvSeeds = useMemo(() => discoverySeeds(watchlist, favourites, today, 'tv'), [watchlist, favourites, week]);
  const movieSeedsRef = useRef(movieSeeds);
  const tvSeedsRef = useRef(tvSeeds);
  // Declared before the query, so the first fetch already sees these seeds.
  useEffect(() => {
    movieSeedsRef.current = movieSeeds;
    tvSeedsRef.current = tvSeeds;
  });

  // The seed list is fixed when the first page loads and travels with the
  // pages, so it survives the cache: adding or "Seen it"-ing a title
  // reorders the seeds, and paging must not repeat or skip one -- also after
  // leaving Discover and coming back, or switching type and back.
  const movieRecommendations = useInfiniteQuery({
    // isAdmin in the key: pages seeded as a visitor (no scores) must not be
    // what the owner gets after signing in.
    queryKey: ['watchlist', 'discovery', 'recommendations', 'movie', week, isAdmin],
    // Ratings decide the first seeds (8 and up lead, under 6 never seed), so
    // the first page waits for them rather than freezing without them.
    enabled: !loading && ratingsStatus !== 'loading' && type !== 'tv',
    staleTime: 60 * 60 * 1000,
    retry: false,
    initialPageParam: { page: 0, seeds: null } as PageParam,
    queryFn: async ({ pageParam }): Promise<SuggestionPage> => {
      const pageSeeds = pageParam.seeds ?? movieSeedsRef.current;
      const loaded = await load(sourcesForMediaPage(pageSeeds, pageParam.page, 'movie'));
      return { ...loaded, seeds: pageSeeds };
    },
    getNextPageParam: (lastPage, _pages, lastParam): PageParam | undefined => (
      lastParam.page + 1 < MAX_PAGES ? { page: lastParam.page + 1, seeds: lastPage.seeds } : undefined
    ),
  });

  const tvRecommendations = useInfiniteQuery({
    queryKey: ['watchlist', 'discovery', 'recommendations', 'tv', week, isAdmin],
    enabled: !loading && ratingsStatus !== 'loading' && type !== 'movie',
    staleTime: 60 * 60 * 1000,
    retry: false,
    initialPageParam: { page: 0, seeds: null } as PageParam,
    queryFn: async ({ pageParam }): Promise<SuggestionPage> => {
      const pageSeeds = pageParam.seeds ?? tvSeedsRef.current;
      const loaded = await load(sourcesForMediaPage(pageSeeds, pageParam.page, 'tv'));
      return { ...loaded, seeds: pageSeeds };
    },
    getNextPageParam: (lastPage, _pages, lastParam): PageParam | undefined => (
      lastParam.page + 1 < MAX_PAGES ? { page: lastParam.page + 1, seeds: lastPage.seeds } : undefined
    ),
  });

  const start = today.toLocaleDateString('en-CA');
  const endDate = new Date(today); endDate.setDate(endDate.getDate() + 180);
  const end = endDate.toLocaleDateString('en-CA');
  const upcoming = useQuery({
    queryKey: ['watchlist', 'discovery', 'upcoming', start],
    enabled: !loading,
    staleTime: 60 * 60 * 1000,
    retry: false,
    queryFn: () => load([
      { endpoint: 'discover/movie', params: { region: 'GB', 'release_date.gte': start, 'release_date.lte': end, with_release_type: '3', sort_by: 'popularity.desc', include_adult: 'false' }, media: 'movie' as const, reason: 'In UK cinemas soon', kind: 'upcoming' as const },
      { endpoint: 'discover/tv', params: { 'first_air_date.gte': start, 'first_air_date.lte': end, sort_by: 'popularity.desc', include_adult: 'false' }, media: 'tv' as const, reason: 'New series', kind: 'upcoming' as const },
    ]),
  });

  const recommendationItems = useMemo(() => {
    const movieList = (movieRecommendations.data?.pages ?? []).flatMap((page) => interleaveBySeed(page.items));
    const tvList = (tvRecommendations.data?.pages ?? []).flatMap((page) => interleaveBySeed(page.items));
    if (type === 'movie') return movieList;
    if (type === 'tv') return tvList;
    return interleaveUpcoming([...movieList, ...tvList]);
  }, [type, movieRecommendations.data, tvRecommendations.data]);

  const upcomingItems = useMemo(
    () => (upcoming.data?.items ?? []).filter((item) => type === 'all' || item.media === type),
    [upcoming.data?.items, type],
  );

  // --- "Have you already watched?" grouped franchises & spin-offs ----------
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `week` stands in for `today`.
  const lookup = useMemo(() => libraryLookup(watchlist, today), [watchlist, week]);

  const collectionRows = useQuery({
    ...libraryCollectionsQueryOptions,
    enabled: !loading && type !== 'tv',
  });
  const libraryCollections = useMemo(() => {
    const films = new Map(
      watchlist
        .filter((item) => item.category === 'Movies' && (isAdmin || (item.library_state !== 'hidden' && item.library_state !== 'stopped')))
        .map((item) => [item.id, item]),
    );
    return collectionsFromLibrary(
      (collectionRows.data ?? []).flatMap((row) => {
        const item = films.get(row.id);
        return item
          ? [{
              id: item.id,
              tmdbId: row.tmdbId,
              title: item.title,
              watched: !!item.watched,
              releaseDate: item.release_date ?? null,
              poster: item.image_url ?? null,
              collectionId: row.collectionId,
              collectionName: row.collectionName,
            }]
          : [];
      }),
    ).sort((a, b) => (b.watched - a.watched) || (b.films.length - a.films.length) || a.name.localeCompare(b.name));
  }, [watchlist, collectionRows.data, isAdmin]);

  const activeCollectionIds = useMemo(
    () => libraryCollections.slice(0, collectionLimit).map((c) => c.collectionId),
    [libraryCollections, collectionLimit],
  );

  const expandedCollections = useQuery({
    queryKey: ['watchlist', 'discovery', 'collections', activeCollectionIds],
    enabled: !loading && type !== 'tv' && activeCollectionIds.length > 0,
    staleTime: 24 * 60 * 60 * 1000,
    retry: false,
    queryFn: async () => {
      const settled = await Promise.allSettled(
        activeCollectionIds.map(async (collectionId) => {
          const data = await getCollection(collectionId);
          return { collectionId, entries: collectionPartsToEntries(data?.parts ?? [], POSTER_BASE) };
        }),
      );
      return settled.flatMap((res) => (res.status === 'fulfilled' ? [res.value] : []));
    },
  });

  const tvSeedIds = useMemo(
    () =>
      watchlist
        .filter((item) => item.category === 'TV Shows' && item.tmdb_id && (isAdmin || (item.library_state !== 'hidden' && item.library_state !== 'stopped')))
        .map((item) => item.tmdb_id!)
        .sort((a, b) => a - b),
    [watchlist, isAdmin],
  );
  const tvSpinoffs = useQuery({
    queryKey: ['watchlist', 'tv-spinoffs', tvSeedIds],
    enabled: !loading && type !== 'movie' && tvSeedIds.length > 0,
    staleTime: 24 * 60 * 60 * 1000,
    retry: false,
    queryFn: () => getTvSpinoffs(tvSeedIds),
  });
  const tvFranchiseSummaries = useMemo(
    () => tvFranchisesFromLinks(tvSpinoffs.data ?? [], watchlist, POSTER_BASE),
    [tvSpinoffs.data, watchlist],
  );

  const filterDismissedEntries = (entries: OrderEntryInput[]) =>
    entries.filter((entry) => {
      const inLibrary = entry.mediaType === 'movie' ? lookup.movies.has(entry.tmdbId) : lookup.shows.has(entry.tmdbId);
      return inLibrary || !dismissed.has(entry.key);
    });

  const franchiseGroups = useMemo((): DiscoveryFranchiseGroup[] => {
    const groups: DiscoveryFranchiseGroup[] = [];
    if (type !== 'tv') {
      const nameById = new Map(libraryCollections.map((c) => [c.collectionId, c.name]));
      for (const item of expandedCollections.data ?? []) {
        const filtered = filterDismissedEntries(item.entries);
        const view = buildOrderView(filtered, lookup);
        const missingCount = view.total - view.inLibrary;
        if (missingCount > 0) {
          groups.push({
            key: `collection:${item.collectionId}`,
            name: nameById.get(item.collectionId) ?? `Collection ${item.collectionId}`,
            kind: 'collection',
            media: 'movie',
            view,
            missingCount,
            hasGap: hasWatchGap(view),
          });
        }
      }
    }
    if (type !== 'movie') {
      for (const tvGroup of tvFranchiseSummaries) {
        const filtered = filterDismissedEntries(tvGroup.entries);
        const view = buildOrderView(filtered, lookup);
        const missingCount = view.total - view.inLibrary;
        if (missingCount > 0) {
          groups.push({
            key: `spinoff:${tvGroup.key}`,
            name: tvGroup.name,
            kind: 'tv-spinoff',
            media: 'tv',
            view,
            missingCount,
            hasGap: hasWatchGap(view),
          });
        }
      }
    }
    return groups.sort(
      (a, b) =>
        Number(b.hasGap) - Number(a.hasGap) ||
        b.view.watched - a.view.watched ||
        b.view.inLibrary - a.view.inLibrary ||
        a.name.localeCompare(b.name),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, libraryCollections, expandedCollections.data, tvFranchiseSummaries, lookup, dismissed]);

  const franchiseEntryKeys = useMemo(
    () => new Set(franchiseGroups.flatMap((g) => g.view.entries.map((e) => e.key))),
    [franchiseGroups],
  );

  // Multi-seed consensus: released titles independently recommended by 2+
  // titles in the library surface under HAVE YOU ALREADY WATCHED? ("Likely seen")
  // and are excluded from YOU MIGHT LIKE so they are not shown twice.
  const likelySeen = useMemo(
    () =>
      curateDiscovery(
        likelySeenConsensus(recommendationItems, today),
        watchlist,
        favourites,
        dismissed,
        franchiseEntryKeys,
      ).slice(0, 12),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `week` stands in for `today`.
    [recommendationItems, watchlist, favourites, dismissed, franchiseEntryKeys, week],
  );

  const alreadyWatchedKeys = useMemo(
    () => new Set([...franchiseEntryKeys, ...likelySeen.map((item) => discoveryKey(item.media, item.id))]),
    [franchiseEntryKeys, likelySeen],
  );

  // Kept in the browser first, so it holds even if the table write fails;
  // the effect above moves it into the table for the owner.
  const dismissMany = (items: ReadonlyArray<{ media: DiscoveryMedia; id: number }>) => {
    if (items.length === 0) return;
    setLocalDismissed((prev) => {
      const next = new Set(prev);
      for (const item of items) next.add(discoveryKey(item.media, item.id));
      writeDismissed(next);
      return next;
    });
  };
  const dismiss = (media: DiscoveryMedia, id: number) => dismissMany([{ media, id }]);
  // Visitors can only reset their own browser's dismissals; the owner's
  // table is theirs alone to clear.
  const resetDismissed = async () => {
    setLocalDismissed(new Set());
    try { localStorage.removeItem(DISMISSED_KEY); } catch { /* Still works for this visit. */ }
    if (ownerSynced) {
      await supabase.from('watchlist_dismissed_suggestions').delete().gt('id', 0);
      await queryClient.invalidateQueries({ queryKey: DISMISSED_QUERY_KEY });
    }
  };
  const resettable = localDismissed.size + (ownerSynced ? remote.data?.length ?? 0 : 0);

  const activeQueries = type === 'movie'
    ? [movieRecommendations]
    : type === 'tv'
      ? [tvRecommendations]
      : [movieRecommendations, tvRecommendations];
  const isPending = activeQueries.every((q) => q.isPending);
  const isError = activeQueries.every((q) => q.isError);
  const partlyFailed = !isError && (
    activeQueries.some((q) => q.isError) ||
    activeQueries.some((q) => q.data?.pages.some((page) => page.failed) ?? false)
  );
  const hasMore = activeQueries.some((q) => q.hasNextPage);
  const loadingMore = activeQueries.some((q) => q.isFetchingNextPage);

  return {
    recommendations: curateDiscovery(recommendationItems, watchlist, favourites, dismissed, alreadyWatchedKeys),
    likelySeen,
    upcoming: curateDiscovery(upcomingItems, watchlist, favourites, dismissed),
    franchises: franchiseGroups,
    franchisesLoading:
      loading ||
      (type !== 'tv' && (collectionRows.isPending || (activeCollectionIds.length > 0 && expandedCollections.isPending))) ||
      (type !== 'movie' && tvSeedIds.length > 0 && tvSpinoffs.isPending),
    hasMoreFranchises: type !== 'tv' && collectionLimit < libraryCollections.length,
    loadMoreFranchises: () => setCollectionLimit((prev) => prev + COLLECTIONS_PER_BATCH),
    loading: loading || ratingsStatus === 'loading' || isPending,
    upcomingLoading: loading || upcoming.isPending,
    failed: isError,
    partlyFailed,
    upcomingFailed: upcoming.isError || Boolean(upcoming.data?.failed),
    hasMore,
    loadingMore,
    loadMore: () => {
      for (const q of activeQueries) {
        if (q.hasNextPage && !q.isFetchingNextPage) void q.fetchNextPage();
      }
    },
    // Only after a total failure, which is one page: refetching every loaded
    // page at once would run into tmdb-proxy's per-minute limit.
    retry: () => {
      for (const q of activeQueries) {
        if (q.isError) void q.refetch();
      }
    },
    dismiss,
    dismissMany,
    resetDismissed,
    dismissedCount: resettable,
    synced: ownerSynced,
  };
}
