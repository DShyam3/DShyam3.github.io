import { useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteQuery, useQueries, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useWatchlist } from './useWatchlist';
import {
  SEEDS_PER_PAGE,
  curateDiscovery,
  discoveryKey,
  discoverySeeds,
  filmGroupsNeeded,
  franchiseUpcomingItems,
  interleaveBySeed,
  interleaveUpcoming,
  keepFirstSeenOrder,
  knownDiscoveryKeys,
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
  collectionsInsideUniverses,
  filmUniversesFromMembers,
  hasWatchGap,
  libraryLookup,
  compareLastTouched,
  lastTouched,
  orderByLastTouched,
  type LastTouched,
  tvFranchisesFromLinks,
  type OrderEntryInput,
  type OrderView,
  type UniverseLibraryFilm,
} from './franchise';
import { POSTER_BASE } from './components/franchise/EntryList';
import { detailRetry, detailRetryDelay, useTMDB } from './useTMDB';
import { useDismissedSuggestions } from './useDismissedSuggestions';
import type { LibraryType } from './library-state';
import type { TMDBSearchResponse } from './tmdb-types';

/** TMDB stops paging at 500; the filler never needs to go that far. */
const MAX_PAGES = 200;

/**
 * One tmdb-proxy call. A 429 waits and tries again (5s, 20s, 40s: together
 * longer than the proxy's one-minute window), so a busy minute slows a page
 * down instead of emptying it.
 */
async function request(endpoint: string, params: Record<string, string>): Promise<TMDBSearchResponse> {
  const query = new URLSearchParams({ endpoint, language: 'en-GB', page: '1', ...params });
  for (let failures = 0; ; failures += 1) {
    const { data, error } = await supabase.functions.invoke(`tmdb-proxy?${query}`, { method: 'GET' });
    if (!error) return data as TMDBSearchResponse;
    if (!detailRetry(failures, error)) throw error;
    await new Promise((resolve) => setTimeout(resolve, detailRetryDelay(failures)));
  }
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
  kind: 'collection' | 'tv-spinoff' | 'universe';
  media: DiscoveryMedia;
  view: OrderView;
  missingCount: number;
  hasGap: boolean;
  /** When the owner last touched a library title in it; see `lastTouched`. */
  touched: LastTouched;
}

// tmdb-proxy allows 60 calls a minute per visitor. Opening Discover costs 26
// (8 suggestion seeds, 2 coming soon, 2 likely seen, 12 collections, 1
// spin-off lookup, 1 film-universe lookup); the automatic top-ups below add
// at most 26 more (12 collections, 8 suggestions, 4 coming soon, 2 likely
// seen), once per visit to Discover. That leaves 8 for the owner's clicks: an add or "Seen it" on a
// film is one call, on a series one plus one per season, which a long series
// can outrun; the details call waits out the limit (useTMDB `detailRetry`),
// the season calls do not. Franchises lead the page, so they get the largest
// share. Show more buttons are the owner's own call and are not budgeted.
const COLLECTIONS_PER_BATCH = 12;
const FRANCHISES_PER_STEP = 6;
const MAX_UPCOMING_PAGES = 10;
const TARGET_UPCOMING = 12;
const LIKELY_SEEN_ROTATION_WEEKS = 15;
const TARGET_RECOMMENDATIONS = 12;
const TARGET_LIKELY_SEEN = 12;
const AUTO_PAGE_CAP = 6;
const AUTO_LIKELY_SEEN_PAGES = 5;

export function useDiscovery(type: LibraryType) {
  const { watchlist, favourites, loading, ratingsStatus } = useWatchlist();
  const { getCollection, getTvSpinoffs, getFilmUniverses } = useTMDB();
  const { isAdmin } = useAuth();
  const { dismissed, dismissMany, resetDismissed, resettable, ownerSynced } = useDismissedSuggestions();
  const [collectionLimit, setCollectionLimit] = useState(COLLECTIONS_PER_BATCH);
  const [franchiseTarget, setFranchiseTarget] = useState(FRANCHISES_PER_STEP);
  const today = new Date();
  const week = weekIndex(today);

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

  // Known titles (in the library, favourited, dismissed) leave before each
  // seed is capped at four, not after: with a large library, a seed's first
  // four were usually all known and whole pages came to nothing. A dismissed
  // tile is replaced in place by that seed's next title.
  const knownKeys = useMemo(() => knownDiscoveryKeys(watchlist, favourites, dismissed), [watchlist, favourites, dismissed]);
  const recommendationItems = useMemo(() => {
    const fresh = (items: DiscoveryItem[]) => interleaveBySeed(items.filter((item) => !knownKeys.has(discoveryKey(item.media, item.id))));
    const moviePages = movieRecommendations.data?.pages ?? [];
    const tvPages = tvRecommendations.data?.pages ?? [];
    if (type === 'movie') return moviePages.flatMap((page) => fresh(page.items));
    if (type === 'tv') return tvPages.flatMap((page) => fresh(page.items));
    const pageCount = Math.max(moviePages.length, tvPages.length);
    const interleaved: DiscoveryItem[] = [];
    for (let i = 0; i < pageCount; i += 1) {
      const m = moviePages[i] ? fresh(moviePages[i].items) : [];
      const t = tvPages[i] ? fresh(tvPages[i].items) : [];
      interleaved.push(...interleaveUpcoming([...m, ...t]));
    }
    return interleaved;
  }, [type, movieRecommendations.data, tvRecommendations.data, knownKeys]);

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
  // A visitor's cards read only what a visitor's seeds do: a hidden or
  // stopped title is neither a seed nor shown as in the library, so a card
  // never reveals it (its tick, its count, its details).
  const visibleLibrary = useMemo(
    () => (isAdmin ? watchlist : watchlist.filter((item) => item.library_state !== 'hidden' && item.library_state !== 'stopped')),
    [watchlist, isAdmin],
  );
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `week` stands in for `today`.
  const lookup = useMemo(() => libraryLookup(visibleLibrary, today), [visibleLibrary, week]);

  // Fetched in this order, a batch at a time, so the collection touched most
  // recently (added to, watched from, re-filed) is looked up first. Never by
  // release date: `created_at` on a library item is its release date.
  const libraryCollections = useMemo(() => {
    return collectionsFromLibrary(
      visibleLibrary.flatMap((item) =>
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
              lastActivityAt: item.last_activity_at ?? null,
            }]
          : [],
      ),
    )
      .map((collection) => ({ ...collection, touched: lastTouched(collection.films) }))
      .sort((a, b) => compareLastTouched(a.touched, b.touched) || a.name.localeCompare(b.name));
  }, [visibleLibrary]);

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
        return [{ collectionId, entries: collectionPartsToEntries(data.parts ?? [], POSTER_BASE, lookup.movies) }];
      }),
    [activeCollectionIds, collectionQueries, lookup.movies],
  );
  const collectionsPending = activeCollectionIds.length > 0 && collectionQueries.some((q) => q.isPending);

  // Shared universes (the MCU) span several collections, so the collection
  // lookups above cannot see them. One call, whatever the library holds: the
  // proxy names the universes, and the library decides which are started.
  const universeLibrary = useMemo(() => {
    const films = new Map<number, UniverseLibraryFilm>();
    for (const item of visibleLibrary) {
      if (item.category !== 'Movies' || item.tmdb_id == null) continue;
      films.set(item.tmdb_id, {
        id: item.id,
        title: item.title,
        releaseDate: item.release_date ?? null,
        poster: item.image_url ?? null,
        lastActivityAt: item.last_activity_at ?? null,
      });
    }
    return films;
  }, [visibleLibrary]);
  const filmUniverses = useQuery({
    queryKey: ['watchlist', 'film-universes'],
    enabled: !loading && type !== 'tv' && universeLibrary.size > 0,
    staleTime: 24 * 60 * 60 * 1000,
    retry: false,
    // Thrown on failure, as for spin-offs: persisted, and a failed lookup
    // must not be kept for a day as "no universes".
    queryFn: () => getFilmUniverses({ throwOnError: true }),
  });
  const filmUniverseSummaries = useMemo(
    () => filmUniversesFromMembers(filmUniverses.data ?? [], universeLibrary, POSTER_BASE),
    [filmUniverses.data, universeLibrary],
  );
  const universesPending = type !== 'tv' && universeLibrary.size > 0 && filmUniverses.isPending;

  const tvSeedIds = useMemo(
    () =>
      visibleLibrary
        .filter((item) => item.category === 'TV Shows' && item.tmdb_id)
        .map((item) => item.tmdb_id!)
        .sort((a, b) => a - b),
    [visibleLibrary],
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
    () => tvFranchisesFromLinks(tvSpinoffs.data ?? [], visibleLibrary, POSTER_BASE),
    [tvSpinoffs.data, visibleLibrary],
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
      // A collection wholly inside a universe is shown as part of it.
      const insideUniverse = collectionsInsideUniverses(expandedCollectionsData, filmUniverseSummaries);
      for (const universe of filmUniverseSummaries) {
        const view = buildOrderView(filterDismissedEntries(universe.entries), lookup);
        const missingCount = view.total - view.inLibrary;
        if (view.total >= 2 && missingCount > 0) {
          groups.push({
            key: `universe:${universe.id}`,
            name: universe.name,
            kind: 'universe',
            media: 'movie',
            view,
            missingCount,
            hasGap: hasWatchGap(view),
            touched: universe.touched,
          });
        }
      }
      for (const item of expandedCollectionsData) {
        if (insideUniverse.has(item.collectionId)) continue;
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
            touched: byId.get(item.collectionId)?.touched ?? { at: -1, id: -1 },
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
            touched: lastTouched(view.entries.flatMap((entry) => {
              if (!entry.libraryId) return [];
              const row = entry.mediaType === 'movie' ? lookup.movies.get(entry.tmdbId) : lookup.shows.get(entry.tmdbId);
              return [{ id: entry.libraryId, lastActivityAt: row?.lastActivityAt }];
            })),
          });
        }
      }
    }
    return orderByLastTouched(groups);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `dismissed` is read through filterDismissedEntries.
  }, [type, libraryCollections, expandedCollectionsData, filmUniverseSummaries, tvFranchiseSummaries, lookup, dismissed]);

  const franchiseEntryKeys = useMemo(
    () => new Set(franchiseGroups.flatMap((g) => g.view.entries.map((e) => e.key))),
    [franchiseGroups],
  );

  // Multi-seed consensus first, topped up with a weekly-rotating pool of
  // widely-watched released titles so HAVE YOU ALREADY WATCHED? always has
  // familiar titles to log or dismiss; excluded from YOU MIGHT LIKE.
  // Shown in the order titles first turned up, so a title already on screen
  // never moves when a later page finds a stronger match; new ones join the
  // end.
  const likelySeenOrder = useRef(new Map<string, number>());
  const likelySeen = useMemo(
    () =>
      keepFirstSeenOrder(
        curateDiscovery(
          [...likelySeenConsensus(recommendationItems, today), ...likelySeenPoolItems],
          watchlist,
          favourites,
          dismissed,
          franchiseEntryKeys,
        ),
        (item) => discoveryKey(item.media, item.id),
        likelySeenOrder.current,
      ).slice(0, TARGET_LIKELY_SEEN),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `week` stands in for `today`.
    [recommendationItems, likelySeenPoolItems, watchlist, favourites, dismissed, franchiseEntryKeys, week],
  );

  const alreadyWatchedKeys = useMemo(
    () => new Set([...franchiseEntryKeys, ...likelySeen.map((item) => discoveryKey(item.media, item.id))]),
    [franchiseEntryKeys, likelySeen],
  );

  const dismiss = (media: DiscoveryMedia, id: number) => dismissMany([{ media, id }]);

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

  const cachedCollectionUpcoming = useQuery({
    queryKey: ['watchlist', 'collection-upcoming', start],
    enabled: !loading && type !== 'tv' && libraryCollections.length > 0,
    staleTime: 60 * 60 * 1000,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('watchlist_collection_upcoming')
        .select('collection_id, tmdb_id, collection_name, title, release_date, poster_path')
        .gt('release_date', start)
        .order('release_date', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const upcomingFranchiseItems = useMemo(() => {
    const stripPosterBase = (poster: string | null) =>
      poster && poster.startsWith(POSTER_BASE) ? poster.slice(POSTER_BASE.length) : poster;
    const byId = new Map(libraryCollections.map((c) => [c.collectionId, c.name]));
    // Only include cached rows whose collection belongs to a visible film in
    // this viewer's library (so hidden/stopped collections never leak to visitors).
    const cachedByCollection = new Map<number, { name: string; entries: { mediaType: 'movie'; tmdbId: number; title: string; releaseDate: string; posterPath: string | null }[] }>();
    for (const row of cachedCollectionUpcoming.data ?? []) {
      const libraryName = byId.get(row.collection_id);
      if (!libraryName) continue;
      const group = cachedByCollection.get(row.collection_id) ?? {
        name: row.collection_name || libraryName,
        entries: [],
      };
      group.entries.push({
        mediaType: 'movie',
        tmdbId: row.tmdb_id,
        title: row.title,
        releaseDate: row.release_date,
        posterPath: row.poster_path,
      });
      cachedByCollection.set(row.collection_id, group);
    }
    const sources = [
      ...(type !== 'tv'
        ? expandedCollectionsData.map((item) => ({
            name: byId.get(item.collectionId) ?? 'your franchise',
            entries: item.entries.map((entry) => ({
              mediaType: entry.mediaType,
              tmdbId: entry.tmdbId,
              title: entry.title,
              releaseDate: entry.releaseDate,
              posterPath: stripPosterBase(entry.poster),
            })),
          }))
        : []),
      ...(type !== 'tv' ? [...cachedByCollection.values()] : []),
      ...(type !== 'movie'
        ? tvFranchiseSummaries.map((franchise) => ({
            name: franchise.name,
            entries: franchise.entries.map((entry) => ({
              mediaType: entry.mediaType,
              tmdbId: entry.tmdbId,
              title: entry.title,
              releaseDate: entry.releaseDate,
              posterPath: stripPosterBase(entry.poster),
            })),
          }))
        : []),
    ];
    return franchiseUpcomingItems(sources, start).filter(
      (item) => type === 'all' || item.media === type,
    );
  }, [type, libraryCollections, cachedCollectionUpcoming.data, expandedCollectionsData, tvFranchiseSummaries, start]);

  const recommendations = useMemo(
    () => curateDiscovery(recommendationItems, watchlist, favourites, dismissed, alreadyWatchedKeys),
    [recommendationItems, watchlist, favourites, dismissed, alreadyWatchedKeys],
  );
  const upcomingCurated = useMemo(
    () => curateDiscovery([...upcomingFranchiseItems, ...upcomingItems], watchlist, favourites, dismissed),
    [upcomingFranchiseItems, upcomingItems, watchlist, favourites, dismissed],
  );

  const collectionsAllFailed = activeCollectionIds.length > 0 && !collectionsPending && collectionQueries.every((q) => q.isError);
  const hasMoreCollections = type !== 'tv' && collectionLimit < libraryCollections.length;
  const collectionsChecked = collectionQueries.filter((q) => !q.isPending).length;
  const filmGroupCount = franchiseGroups.filter((group) => group.kind === 'collection').length;
  const filmGroupsWanted = filmGroupsNeeded(type, franchiseTarget, franchiseGroups.length - filmGroupCount);

  // Automatic pages of suggestions, counted once per visit to Discover and
  // never re-armed (not by a target being met, a type switch or a click).
  const autoLikelySeenRef = useRef(0);
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

  // Page on until the grid is full: with a large library and many dismissals,
  // whole pages of popular releases can curate down to nothing.
  const {
    isPending: upcomingPending,
    isFetchingNextPage: upcomingFetchingNext,
    isError: upcomingError,
    hasNextPage: upcomingHasNext,
    fetchNextPage: fetchNextUpcoming,
  } = upcoming;
  useEffect(() => {
    if (upcomingCurated.length >= TARGET_UPCOMING) return;
    if (loading || upcomingPending || upcomingFetchingNext || upcomingError || !upcomingHasNext) return;
    void fetchNextUpcoming();
  }, [upcomingCurated.length, loading, upcomingPending, upcomingFetchingNext, upcomingError, upcomingHasNext, fetchNextUpcoming]);

  // Collections are fetched most recently touched first, and most turn out to be
  // complete already; scan ahead until a healthy set of incomplete ones turns
  // up. Franchises lead this section, so "Likely seen" filling up never stops
  // the scan. Waits for the spin-off and universe lookups, whose groups count
  // too.
  const spinoffsPending = type !== 'movie' && tvSeedIds.length > 0 && tvSpinoffs.isPending;
  const walking = type !== 'tv' && hasMoreCollections && !collectionsAllFailed && filmGroupCount < filmGroupsWanted;
  useEffect(() => {
    if (!walking || loading || collectionsPending || spinoffsPending || universesPending) return;
    setCollectionLimit((prev) => prev + COLLECTIONS_PER_BATCH);
  }, [walking, loading, collectionsPending, spinoffsPending, universesPending]);

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
    (type !== 'tv' && (collectionsPending || walking)) ||
    spinoffsPending ||
    universesPending;
  const shownFranchises = useMemo(() => franchiseGroups.slice(0, franchiseTarget), [franchiseGroups, franchiseTarget]);
  const franchisesFailed =
    type !== 'tv' && (
      (!collectionsPending && collectionQueries.some((q) => q.isError)) ||
      filmUniverses.isError
    );

  return {
    recommendations,
    likelySeen,
    upcoming: upcomingCurated,
    franchises: shownFranchises,
    franchisesLoading,
    franchisesFailed,
    hasMoreFranchises: franchiseGroups.length > franchiseTarget || hasMoreCollections,
    collectionsChecked: type === 'tv' ? 0 : collectionsChecked,
    collectionsTotal: type === 'tv' ? 0 : libraryCollections.length,
    loadMoreFranchises: () => setFranchiseTarget((prev) => prev + FRANCHISES_PER_STEP),
    retryFranchises: () => {
      for (const q of collectionQueries) {
        if (q.isError && !q.isFetching) void q.refetch();
      }
      if (tvSpinoffs.isError && !tvSpinoffs.isFetching) void tvSpinoffs.refetch();
      if (filmUniverses.isError && !filmUniverses.isFetching) void filmUniverses.refetch();
    },
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
