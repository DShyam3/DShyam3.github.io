import { useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteQuery, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { selectAllPages } from '@/integrations/supabase/select-all-pages';
import { useAuth } from '@/contexts/AuthContext';
import { useWatchlist } from './useWatchlist';
import {
  SEEDS_PER_PAGE,
  curateDiscovery,
  discoveryKey,
  dismissalHandover,
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
  newestAdded,
  orderByNewestAdded,
  tvFranchisesFromLinks,
  type OrderEntryInput,
  type OrderView,
} from './franchise';
import { POSTER_BASE } from './components/franchise/EntryList';
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
  /** Newest library row id in the franchise; see `newestAdded`. */
  added: number;
}

// tmdb-proxy allows 60 calls a minute per visitor. Opening Discover costs 25
// (8 suggestion seeds, 2 coming soon, 2 likely seen, 12 collections, 1
// spin-off lookup); the automatic top-ups below add at most 26 more (12
// collections, 8 suggestions, 4 coming soon, 2 likely seen), once per visit
// to Discover. That leaves 9 for the owner's clicks: an add or "Seen it" on a
// film is one call, on a series one plus one per season, which a long series
// can outrun; the details call waits out the limit (useTMDB `detailRetry`),
// the season calls do not. Franchises lead the page, so they get the largest
// share. Show more buttons are the owner's own call and are not budgeted.
const COLLECTIONS_PER_BATCH = 12;
const MAX_UPCOMING_PAGES = 5;
const AUTO_UPCOMING_PAGES = 2;
const LIKELY_SEEN_ROTATION_WEEKS = 15;
const TARGET_RECOMMENDATIONS = 12;
const TARGET_LIKELY_SEEN = 12;
const TARGET_FRANCHISES = 6;
const AUTO_PAGE_CAP = 1;
const AUTO_COLLECTION_BATCH_CAP = 1;
const AUTO_LIKELY_SEEN_PAGES = 1;

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
  // A key stays in the browser copy, and so stays hidden, until a read of the
  // table has it; see `dismissalHandover` for why a write alone is not enough.
  const remoteKeys = remote.data;
  const sendingRef = useRef(new Set<string>());
  useEffect(() => {
    if (!ownerSynced || localDismissed.size === 0) return;
    const { release, send } = dismissalHandover(localDismissed, remoteKeys, sendingRef.current);
    if (release.size > 0) {
      setLocalDismissed((prev) => {
        const next = new Set([...prev].filter((key) => !release.has(key)));
        if (next.size > 0) writeDismissed(next);
        else { try { localStorage.removeItem(DISMISSED_KEY); } catch { /* Still works for this visit. */ } }
        return next;
      });
    }
    if (send.length === 0) return;
    const keys = send.map((row) => discoveryKey(row.media, row.tmdb_id));
    for (const key of keys) sendingRef.current.add(key);
    void supabase.from('watchlist_dismissed_suggestions').upsert(send, { onConflict: 'media,tmdb_id', ignoreDuplicates: true })
      .then(({ error }) => {
        for (const key of keys) sendingRef.current.delete(key);
        // Re-read, cancelling any read that started before this write; the
        // next pass releases what the fresh read confirms. On an error the
        // keys stay in the browser and go on the next visit.
        if (!error) void queryClient.invalidateQueries({ queryKey: DISMISSED_QUERY_KEY });
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
  }, [movieSeeds, tvSeeds]);

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
  const upcoming = useInfiniteQuery({
    queryKey: ['watchlist', 'discovery', 'upcoming', start],
    enabled: !loading,
    staleTime: 60 * 60 * 1000,
    retry: false,
    initialPageParam: 1,
    queryFn: ({ pageParam }) => load([
      { endpoint: 'discover/movie', params: { region: 'GB', 'release_date.gte': start, 'release_date.lte': end, with_release_type: '3', sort_by: 'popularity.desc', include_adult: 'false', page: String(pageParam) }, media: 'movie' as const, reason: 'In UK cinemas soon', kind: 'upcoming' as const },
      { endpoint: 'discover/tv', params: { 'first_air_date.gte': start, 'first_air_date.lte': end, sort_by: 'popularity.desc', include_adult: 'false', page: String(pageParam) }, media: 'tv' as const, reason: 'New series', kind: 'upcoming' as const },
    ]),
    getNextPageParam: (_lastPage, _pages, lastParam) => (
      lastParam < MAX_UPCOMING_PAGES ? lastParam + 1 : undefined
    ),
  });

  const recommendationItems = useMemo(() => {
    const moviePages = movieRecommendations.data?.pages ?? [];
    const tvPages = tvRecommendations.data?.pages ?? [];
    if (type === 'movie') return moviePages.flatMap((page) => interleaveBySeed(page.items));
    if (type === 'tv') return tvPages.flatMap((page) => interleaveBySeed(page.items));
    const pageCount = Math.max(moviePages.length, tvPages.length);
    const interleaved: DiscoveryItem[] = [];
    for (let i = 0; i < pageCount; i += 1) {
      const m = moviePages[i] ? interleaveBySeed(moviePages[i].items) : [];
      const t = tvPages[i] ? interleaveBySeed(tvPages[i].items) : [];
      interleaved.push(...interleaveUpcoming([...m, ...t]));
    }
    return interleaved;
  }, [type, movieRecommendations.data, tvRecommendations.data]);

  const upcomingItems = useMemo(
    () => (upcoming.data?.pages.flatMap((page) => page.items) ?? []).filter((item) => type === 'all' || item.media === type),
    [upcoming.data?.pages, type],
  );

  // Rotating pool of widely-watched released titles so "Have you already
  // watched?" always has familiar films and series to log or dismiss.
  const likelySeenStartPage = (week % LIKELY_SEEN_ROTATION_WEEKS) + 1;
  const likelySeenPool = useInfiniteQuery({
    queryKey: ['watchlist', 'discovery', 'likely-seen-pool', week],
    enabled: !loading,
    staleTime: 60 * 60 * 1000,
    retry: false,
    initialPageParam: likelySeenStartPage,
    queryFn: ({ pageParam }) => load([
      {
        endpoint: 'discover/movie',
        params: { 'release_date.lte': start, sort_by: 'vote_count.desc', include_adult: 'false', page: String(pageParam) },
        media: 'movie' as const,
        reason: 'Widely watched on TMDB — have you seen this already?',
        shortReason: 'Widely watched',
        kind: 'recommendation' as const,
      },
      {
        endpoint: 'discover/tv',
        params: { 'first_air_date.lte': start, sort_by: 'vote_count.desc', include_adult: 'false', page: String(pageParam) },
        media: 'tv' as const,
        reason: 'Widely watched on TMDB — have you seen this already?',
        shortReason: 'Widely watched',
        kind: 'recommendation' as const,
      },
    ]),
    getNextPageParam: (_lastPage, pages, lastParam) => (
      pages.length < LIKELY_SEEN_ROTATION_WEEKS
        ? (lastParam % LIKELY_SEEN_ROTATION_WEEKS) + 1
        : undefined
    ),
  });

  const likelySeenPoolItems = useMemo(() => {
    const pages = likelySeenPool.data?.pages ?? [];
    const items = pages.flatMap((page) => (type === 'all' ? interleaveUpcoming(page.items) : page.items));
    return items.filter((item) => type === 'all' || item.media === type);
  }, [likelySeenPool.data?.pages, type]);

  // --- "Have you already watched?" grouped franchises & spin-offs ----------
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `week` stands in for `today`.
  const lookup = useMemo(() => libraryLookup(watchlist, today), [watchlist, week]);

  // Fetched in this order, a batch at a time, so the collection added to most
  // recently is looked up first. Never by release date: `created_at` on a
  // library item is its release date.
  const libraryCollections = useMemo(() => {
    return collectionsFromLibrary(
      watchlist.flatMap((item) =>
        item.category === 'Movies' &&
        item.collection_id != null &&
        (isAdmin || (item.library_state !== 'hidden' && item.library_state !== 'stopped'))
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
    )
      .map((collection) => ({ ...collection, added: newestAdded(collection.films) }))
      .sort((a, b) => b.added - a.added || a.name.localeCompare(b.name));
  }, [watchlist, isAdmin]);

  const activeCollectionIds = useMemo(
    () => libraryCollections.slice(0, collectionLimit).map((c) => c.collectionId),
    [libraryCollections, collectionLimit],
  );

  // `getCollection` caches under `['watchlist', 'tmdb-collection', id]`;
  // using a distinct outer key avoids React Query's same-key fetchQuery deadlock.
  const collectionQueries = useQueries({
    queries: activeCollectionIds.map((collectionId) => ({
      queryKey: ['watchlist', 'discovery-collection', collectionId] as const,
      enabled: !loading && type !== 'tv',
      staleTime: 24 * 60 * 60 * 1000,
      retry: false,
      // getCollection answers null on failure; thrown, so a rate-limited
      // lookup is retried on the next visit instead of cached as empty.
      queryFn: async () => {
        const collection = await getCollection(collectionId);
        if (!collection) throw new Error('Collection unavailable');
        return collection;
      },
    })),
  });
  const expandedCollectionsData = useMemo(
    () =>
      activeCollectionIds.flatMap((collectionId, idx) => {
        const data = collectionQueries[idx]?.data;
        if (!data) return [];
        return [{ collectionId, entries: collectionPartsToEntries(data.parts ?? [], POSTER_BASE) }];
      }),
    [activeCollectionIds, collectionQueries],
  );
  const collectionsPending = activeCollectionIds.length > 0 && collectionQueries.some((q) => q.isPending);

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
    // Thrown on failure: this key is persisted, and a failed lookup must not
    // be kept for a day as "no spin-offs".
    queryFn: () => getTvSpinoffs(tvSeedIds, { throwOnError: true }),
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

  // A franchise is two or more titles, and it shows once one of them is in
  // the library and another is not.
  const franchiseGroups = useMemo((): DiscoveryFranchiseGroup[] => {
    const groups: DiscoveryFranchiseGroup[] = [];
    if (type !== 'tv') {
      const byId = new Map(libraryCollections.map((c) => [c.collectionId, c]));
      for (const item of expandedCollectionsData) {
        const filtered = filterDismissedEntries(item.entries);
        const view = buildOrderView(filtered, lookup);
        const missingCount = view.total - view.inLibrary;
        if (view.total >= 2 && missingCount > 0) {
          groups.push({
            key: `collection:${item.collectionId}`,
            name: byId.get(item.collectionId)?.name ?? `Collection ${item.collectionId}`,
            kind: 'collection',
            media: 'movie',
            view,
            missingCount,
            hasGap: hasWatchGap(view),
            added: byId.get(item.collectionId)?.added ?? -1,
          });
        }
      }
    }
    if (type !== 'movie') {
      for (const tvGroup of tvFranchiseSummaries) {
        const filtered = filterDismissedEntries(tvGroup.entries);
        const view = buildOrderView(filtered, lookup);
        const missingCount = view.total - view.inLibrary;
        if (view.total >= 2 && missingCount > 0) {
          groups.push({
            key: `spinoff:${tvGroup.key}`,
            name: tvGroup.name,
            kind: 'tv-spinoff',
            media: 'tv',
            view,
            missingCount,
            hasGap: hasWatchGap(view),
            added: newestAdded(view.entries.flatMap((entry) => (entry.libraryId ? [{ id: entry.libraryId }] : []))),
          });
        }
      }
    }
    return orderByNewestAdded(groups);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `dismissed` is read through filterDismissedEntries.
  }, [type, libraryCollections, expandedCollectionsData, tvFranchiseSummaries, lookup, dismissed]);

  const franchiseEntryKeys = useMemo(
    () => new Set(franchiseGroups.flatMap((g) => g.view.entries.map((e) => e.key))),
    [franchiseGroups],
  );

  // Multi-seed consensus first, topped up with a weekly-rotating pool of
  // widely-watched released titles so HAVE YOU ALREADY WATCHED? always has
  // familiar titles to log or dismiss; excluded from YOU MIGHT LIKE.
  const likelySeen = useMemo(
    () =>
      curateDiscovery(
        [...likelySeenConsensus(recommendationItems, today), ...likelySeenPoolItems],
        watchlist,
        favourites,
        dismissed,
        franchiseEntryKeys,
      ).slice(0, TARGET_LIKELY_SEEN),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `week` stands in for `today`.
    [recommendationItems, likelySeenPoolItems, watchlist, favourites, dismissed, franchiseEntryKeys, week],
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

  const activeQueries = useMemo(
    () => (type === 'movie'
      ? [movieRecommendations]
      : type === 'tv'
        ? [tvRecommendations]
        : [movieRecommendations, tvRecommendations]),
    [type, movieRecommendations, tvRecommendations],
  );
  const isPending = activeQueries.every((q) => q.isPending);
  const isError = activeQueries.every((q) => q.isError);
  const partlyFailed = !isError && (
    activeQueries.some((q) => q.isError) ||
    activeQueries.some((q) => q.data?.pages.some((page) => page.failed) ?? false)
  );
  const hasMore = activeQueries.some((q) => q.hasNextPage);
  const loadingMore = activeQueries.some((q) => q.isFetchingNextPage);

  const recommendations = useMemo(
    () => curateDiscovery(recommendationItems, watchlist, favourites, dismissed, alreadyWatchedKeys),
    [recommendationItems, watchlist, favourites, dismissed, alreadyWatchedKeys],
  );
  const upcomingCurated = useMemo(
    () => curateDiscovery(upcomingItems, watchlist, favourites, dismissed),
    [upcomingItems, watchlist, favourites, dismissed],
  );

  const collectionsAllFailed = activeCollectionIds.length > 0 && !collectionsPending && collectionQueries.every((q) => q.isError);
  const hasMoreFranchises = type !== 'tv' && collectionLimit < libraryCollections.length;

  // Automatic top-ups, counted once per visit to Discover and never re-armed
  // (not by a target being met, a type switch or a click), so the request
  // budget above holds for the whole visit.
  const autoUpcomingRef = useRef(0);
  const autoLikelySeenRef = useRef(0);
  const autoFranchiseBatchesRef = useRef(0);
  const autoRecPagesRef = useRef(0);

  // If the current page of widely-watched titles is mostly logged/dismissed,
  // rotate forward so HAVE YOU ALREADY WATCHED? stays populated.
  const {
    isPending: likelySeenPending,
    isFetchingNextPage: likelySeenFetchingNext,
    isError: likelySeenError,
    hasNextPage: likelySeenHasNext,
    fetchNextPage: fetchNextLikelySeen,
  } = likelySeenPool;
  useEffect(() => {
    if (likelySeen.length >= TARGET_LIKELY_SEEN) return;
    if (loading || likelySeenPending || likelySeenFetchingNext || likelySeenError || !likelySeenHasNext) return;
    if (autoLikelySeenRef.current >= AUTO_LIKELY_SEEN_PAGES) return;
    autoLikelySeenRef.current += 1;
    void fetchNextLikelySeen();
  }, [likelySeen.length, loading, likelySeenPending, likelySeenFetchingNext, likelySeenError, likelySeenHasNext, fetchNextLikelySeen]);

  // If page 1 of Coming Soon is entirely in the library or dismissed, keep
  // paging (up to AUTO_UPCOMING_PAGES more) so the column is not left empty.
  const {
    isPending: upcomingPending,
    isFetchingNextPage: upcomingFetchingNext,
    isError: upcomingError,
    hasNextPage: upcomingHasNext,
    fetchNextPage: fetchNextUpcoming,
  } = upcoming;
  useEffect(() => {
    if (upcomingCurated.length > 0) return;
    if (loading || upcomingPending || upcomingFetchingNext || upcomingError || !upcomingHasNext) return;
    if (autoUpcomingRef.current >= AUTO_UPCOMING_PAGES) return;
    autoUpcomingRef.current += 1;
    void fetchNextUpcoming();
  }, [upcomingCurated.length, loading, upcomingPending, upcomingFetchingNext, upcomingError, upcomingHasNext, fetchNextUpcoming]);

  // Collections are fetched newest-added first, and most turn out to be
  // complete already; scan ahead until a healthy set of incomplete ones turns
  // up. Franchises lead this section, so "Likely seen" filling up never stops
  // the scan. Waits for the spin-off lookup, whose groups count too.
  const spinoffsPending = type !== 'movie' && tvSeedIds.length > 0 && tvSpinoffs.isPending;
  useEffect(() => {
    if (franchiseGroups.length >= TARGET_FRANCHISES) return;
    if (loading || collectionsPending || spinoffsPending || collectionsAllFailed || !hasMoreFranchises) return;
    if (autoFranchiseBatchesRef.current >= AUTO_COLLECTION_BATCH_CAP) return;
    autoFranchiseBatchesRef.current += 1;
    setCollectionLimit((prev) => prev + COLLECTIONS_PER_BATCH);
  }, [franchiseGroups.length, loading, collectionsPending, spinoffsPending, collectionsAllFailed, hasMoreFranchises]);

  // With a large library, a whole page of seed recommendations can curate down
  // to only a couple of titles; keep paging until a full grid is ready.
  useEffect(() => {
    if (recommendations.length >= TARGET_RECOMMENDATIONS) return;
    if (loading || ratingsStatus === 'loading' || isPending || loadingMore || isError || !hasMore) return;
    if (autoRecPagesRef.current >= AUTO_PAGE_CAP) return;
    autoRecPagesRef.current += 1;
    for (const q of activeQueries) {
      if (q.isError && !q.isFetching) void q.refetch();
      else if (q.hasNextPage && !q.isFetchingNextPage) void q.fetchNextPage();
    }
  }, [recommendations.length, loading, ratingsStatus, isPending, loadingMore, isError, hasMore, activeQueries]);

  const franchisesLoading =
    loading ||
    (type !== 'tv' && collectionsPending) ||
    spinoffsPending;

  return {
    recommendations,
    likelySeen,
    upcoming: upcomingCurated,
    franchises: franchiseGroups,
    franchisesLoading,
    hasMoreFranchises,
    loadMoreFranchises: () => setCollectionLimit((prev) => prev + COLLECTIONS_PER_BATCH),
    loading: loading || ratingsStatus === 'loading' || isPending,
    upcomingLoading: loading || upcoming.isPending,
    upcomingLoadingMore: upcoming.isFetchingNextPage,
    failed: isError,
    partlyFailed,
    upcomingFailed: upcoming.isError || Boolean(upcoming.data?.pages.some((page) => page.failed)),
    hasMore,
    loadingMore,
    loadMore: () => {
      for (const q of activeQueries) {
        if (q.isError && !q.isFetching) void q.refetch();
        else if (q.hasNextPage && !q.isFetchingNextPage) void q.fetchNextPage();
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
