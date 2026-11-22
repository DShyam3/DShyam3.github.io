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
  interleaveFreshBySeed,
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
import { createCallPacer } from './call-pacer';
import { detailRetry, detailRetryDelay, isNotFound, useTMDB } from './useTMDB';
import { useDismissedSuggestions } from './useDismissedSuggestions';
import type { LibraryType } from './library-state';
import type { TMDBCollection, TMDBSearchResponse } from './tmdb-types';

/** TMDB stops paging at 500; the filler never needs to go that far. */
const MAX_PAGES = 200;

/**
 * Discover's own share of tmdb-proxy's 60 calls a minute. Everything Discover
 * fetches by itself waits its turn here; the rest of the minute stays free for
 * the owner's adds, "Seen it" and searches, which do not.
 */
const DISCOVER_CALLS_PER_MINUTE = 40;
/**
 * How those are shared. Franchises lead the page, so the collection walk has
 * the larger share; with many dismissals the other sections can page for
 * minutes without adding a tile. Each share is a ceiling, so neither can take
 * the other's last places: pages keep at least 12 a minute, the walk 20.
 */
const PAGE_CALLS_PER_MINUTE = 20;
const WALK_CALLS_PER_MINUTE = 28;
const discoverSlot = createCallPacer(DISCOVER_CALLS_PER_MINUTE, 60_000);
const pageSlot = () => discoverSlot({ kind: 'page', limit: PAGE_CALLS_PER_MINUTE });
const walkSlot = () => discoverSlot({ kind: 'walk', limit: WALK_CALLS_PER_MINUTE });

/**
 * One tmdb-proxy call for a section's page, paced by `pageSlot`. A 429 (from
 * calls outside the pacer) waits and tries again: 5s, 20s, 40s, together
 * longer than the proxy's one-minute window.
 */
async function request(endpoint: string, params: Record<string, string>): Promise<TMDBSearchResponse> {
  const query = new URLSearchParams({ endpoint, language: 'en-GB', page: '1', ...params });
  for (let failures = 0; ; failures += 1) {
    await pageSlot();
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

interface PagedSource {
  isFetching: boolean;
  isError: boolean;
  hasNextPage: boolean;
  data?: { pages: unknown[] };
  refetch: () => Promise<unknown>;
  fetchNextPage: () => Promise<unknown>;
}

/**
 * The next page of one source. One that failed with pages already loaded asks
 * for the next page again; a refetch would re-read every loaded page.
 */
function loadNext(q: PagedSource) {
  if (q.isFetching) return;
  if (q.isError && !q.data?.pages.length) void q.refetch();
  else if (q.hasNextPage) void q.fetchNextPage();
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

// How much each section fetches by itself. All of it goes through
// `discoverSlot`, so however much there is, it arrives at no more than
// DISCOVER_CALLS_PER_MINUTE:
// - HAVE YOU ALREADY WATCHED? walks the library's film collections in a fixed
//   order, most recently touched first, a batch at a time, until it has
//   enough with something unanswered; Show more asks for six more. It takes
//   up to WALK_CALLS_PER_MINUTE, never fewer than 20. A collection
//   is kept for a day, so the walk is paid for once a day (about 200 calls
//   at most); a fresh cached one skips the queue.
// - Every other section's pages share PAGE_CALLS_PER_MINUTE, never fewer
//   than 12; each section's first page (12 calls in All) goes at once.
// - COMING SOON pages until its grid is full, at most 10 pages (20 calls).
// - YOU MIGHT LIKE and Likely seen page until full, at most 6 and 5 pages
//   automatically per visit; Show more is the owner's own call.
const COLLECTIONS_PER_BATCH = 12;
const FRANCHISES_PER_STEP = 6;
const MAX_UPCOMING_PAGES = 10;
const TARGET_UPCOMING = 12;
const LIKELY_SEEN_ROTATION_WEEKS = 15;
const TARGET_RECOMMENDATIONS = 12;
const TARGET_LIKELY_SEEN = 12;
const AUTO_PAGE_CAP = 6;
const AUTO_EMPTY_ROUNDS = 2;
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

  // Known titles leave before each seed is capped at four (see
  // `interleaveFreshBySeed`). Dismissing a tile lets that seed's next title
  // in at the end of its turns.
  const knownKeys = useMemo(() => knownDiscoveryKeys(watchlist, favourites, dismissed), [watchlist, favourites, dismissed]);
  const recommendationItems = useMemo(() => {
    const fresh = (items: DiscoveryItem[]) => interleaveFreshBySeed(items, knownKeys);
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

  const upcomingItems = useMemo(() => {
    const pages = upcoming.data?.pages ?? [];
    const items = pages.flatMap((page) => (type === 'all' ? interleaveUpcoming(page.items) : page.items));
    return items.filter((item) => type === 'all' || item.media === type);
  }, [upcoming.data?.pages, type]);

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
      // A failure is thrown, so it is retried on the next visit instead of
      // cached as empty. A collection TMDB no longer has (removed or merged)
      // is not a failure: it has no parts, so it makes no card.
      queryFn: async (): Promise<TMDBCollection> => {
        try {
          // Paced per network attempt, so a collection cached and still
          // fresh costs nothing and a stale one waits its turn.
          const collection = await getCollection(collectionId, { throwOnError: true, beforeFetch: walkSlot });
          if (!collection) throw new Error('Collection unavailable');
          return collection;
        } catch (error) {
          if (isNotFound(error)) return { id: collectionId, parts: [] };
          throw error;
        }
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
        franchise: item.franchise ?? null,
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
    queryKey: ['watchlist', 'tv-spinoffs', 'v2', tvSeedIds],
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
  // Matches lead and the pool follows. The order is only remembered once the
  // first suggestions are in: the pool usually lands first and would
  // otherwise keep every early place after the matches arrive.
  const recommendationsSettled =
    (type === 'tv' || !movieRecommendations.isPending) && (type === 'movie' || !tvRecommendations.isPending);
  const likelySeenOrder = useRef(new Map<string, number>());
  const likelySeen = useMemo(() => {
    const curated = curateDiscovery(
      [...likelySeenConsensus(recommendationItems, today), ...likelySeenPoolItems],
      watchlist,
      favourites,
      dismissed,
      franchiseEntryKeys,
    );
    // Sorted by the remembered order always; new titles are only remembered
    // once settled, so a type switch never reshuffles tiles already shown.
    const order = recommendationsSettled ? likelySeenOrder.current : new Map(likelySeenOrder.current);
    const ordered = keepFirstSeenOrder(curated, (item) => discoveryKey(item.media, item.id), order);
    return ordered.slice(0, TARGET_LIKELY_SEEN);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `week` stands in for `today`.
  }, [recommendationsSettled, recommendationItems, likelySeenPoolItems, watchlist, favourites, dismissed, franchiseEntryKeys, week]);

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

  const recommendationsOrderByType = useRef<Record<LibraryType, Map<string, number>>>({
    all: new Map(),
    movie: new Map(),
    tv: new Map(),
  });
  const recommendations = useMemo(
    () =>
      keepFirstSeenOrder(
        curateDiscovery(recommendationItems, watchlist, favourites, dismissed, alreadyWatchedKeys),
        (item) => discoveryKey(item.media, item.id),
        recommendationsOrderByType.current[type],
      ),
    [recommendationItems, watchlist, favourites, dismissed, alreadyWatchedKeys, type],
  );
  const upcomingCurated = useMemo(
    () => curateDiscovery([...upcomingFranchiseItems, ...upcomingItems], watchlist, favourites, dismissed),
    [upcomingFranchiseItems, upcomingItems, watchlist, favourites, dismissed],
  );

  // The walk stops when the latest batch failed whole, even after waiting out
  // 429s: earlier successes must not let it run on through the library.
  const latestBatch = collectionQueries.slice(-COLLECTIONS_PER_BATCH);
  const latestBatchFailed = latestBatch.length > 0 && !collectionsPending && latestBatch.every((q) => q.isError);
  const hasMoreCollections = type !== 'tv' && collectionLimit < libraryCollections.length;
  const collectionsChecked = collectionQueries.filter((q) => !q.isPending).length;
  const filmGroupCount = franchiseGroups.filter((group) => group.kind !== 'tv-spinoff').length;
  const filmGroupsWanted = filmGroupsNeeded(type, franchiseTarget, franchiseGroups.length - filmGroupCount);

  // Automatic pages of suggestions, counted once per visit to Discover and
  // never re-armed (not by a target being met, a type switch or a click).
  const autoLikelySeenRef = useRef(0);
  const autoRecPagesRef = useRef(0);
  // Rounds in a row that added nothing: with almost everything known, more
  // pages are calls the walk could have had.
  const autoRecEmptyRef = useRef<Record<LibraryType, { rounds: number; seen: number }>>({
    all: { rounds: 0, seen: -1 },
    movie: { rounds: 0, seen: -1 },
    tv: { rounds: 0, seen: -1 },
  });

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
    if (!recommendationsSettled || likelySeen.length >= TARGET_LIKELY_SEEN) return;
    if (loading || likelySeenPending || likelySeenFetchingNext || likelySeenError || !likelySeenHasNext) return;
    if (autoLikelySeenRef.current >= AUTO_LIKELY_SEEN_PAGES) return;
    autoLikelySeenRef.current += 1;
    void fetchNextLikelySeen();
  }, [recommendationsSettled, likelySeen.length, loading, likelySeenPending, likelySeenFetchingNext, likelySeenError, likelySeenHasNext, fetchNextLikelySeen]);

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
  const walking = type !== 'tv' && hasMoreCollections && !latestBatchFailed && filmGroupCount < filmGroupsWanted;
  // `collectionLimit` is a dependency: a batch already cached settles in the
  // same render it is asked for, so nothing else changes to run this again.
  useEffect(() => {
    if (!walking || loading || collectionsPending || spinoffsPending || universesPending) return;
    setCollectionLimit((prev) => prev + COLLECTIONS_PER_BATCH);
  }, [walking, loading, collectionsPending, spinoffsPending, universesPending, collectionLimit]);

  // With a large library, a whole page of seed recommendations can curate down
  // to only a couple of titles; keep paging until a full grid is ready.
  useEffect(() => {
    if (recommendations.length >= TARGET_RECOMMENDATIONS) return;
    if (loading || ratingsStatus === 'loading' || isPending || loadingMore || isError || !hasMore) return;
    if (autoRecPagesRef.current >= AUTO_PAGE_CAP) return;
    // Counted in titles ever shown, not tiles now on screen: the walk and
    // Likely seen take tiles away without any page having landed.
    const empty = autoRecEmptyRef.current[type];
    const seen = recommendationsOrderByType.current[type].size;
    if (empty.seen >= 0) empty.rounds = seen > empty.seen ? 0 : empty.rounds + 1;
    empty.seen = seen;
    if (empty.rounds >= AUTO_EMPTY_ROUNDS) return;
    autoRecPagesRef.current += 1;
    for (const q of activeQueries) loadNext(q);
  }, [recommendations.length, loading, ratingsStatus, isPending, loadingMore, isError, hasMore, activeQueries, type]);

  const franchisesLoading =
    loading ||
    (type !== 'tv' && (collectionsPending || walking)) ||
    spinoffsPending ||
    universesPending;
  const shownFranchises = useMemo(() => franchiseGroups.slice(0, franchiseTarget), [franchiseGroups, franchiseTarget]);
  const retryFranchises = () => {
    for (const q of collectionQueries) {
      if (q.isError && !q.isFetching) void q.refetch();
    }
    if (tvSpinoffs.isError && !tvSpinoffs.isFetching) void tvSpinoffs.refetch();
    if (filmUniverses.isError && !filmUniverses.isFetching) void filmUniverses.refetch();
  };
  const franchisesFailed =
    (type !== 'tv' && ((!collectionsPending && collectionQueries.some((q) => q.isError)) || filmUniverses.isError)) ||
    (type !== 'movie' && tvSpinoffs.isError);

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
    // After a batch failed, Show more asks for it again, so the walk can go on.
    loadMoreFranchises: () => {
      setFranchiseTarget((prev) => prev + FRANCHISES_PER_STEP);
      if (latestBatchFailed) retryFranchises();
    },
    retryFranchises,
    loading: loading || ratingsStatus === 'loading' || isPending,
    upcomingLoading: loading || upcoming.isPending,
    upcomingLoadingMore: upcoming.isFetchingNextPage,
    failed: isError,
    partlyFailed,
    upcomingFailed: upcoming.isError || Boolean(upcoming.data?.pages.some((page) => page.failed)),
    hasMore,
    loadingMore,
    loadMore: () => {
      for (const q of activeQueries) loadNext(q);
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
