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
  weekIndex,
  type DiscoveryItem,
  type DiscoveryMedia,
  type DiscoverySeed,
} from './discovery';
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

const mediaFor = (type: LibraryType): DiscoveryMedia[] => (type === 'all' ? ['movie', 'tv'] : [type]);

/**
 * One page of suggestions. Pages walk the seed list four at a time; once it
 * runs out, they continue with TMDB's most-voted titles, page by page, so
 * the list does not end.
 */
function sourcesForPage(seeds: DiscoverySeed[], page: number, type: LibraryType): Source[] {
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
  return mediaFor(type).map((media) => ({
    endpoint: `discover/${media}`,
    params: { sort_by: 'vote_count.desc', include_adult: 'false', page: String(fillerPage) },
    media,
    reason: 'Widely loved on TMDB',
    shortReason: 'Widely loved',
    kind: 'recommendation' as const,
    seedKey: `filler:${media}`,
  }));
}

export function useDiscovery(type: LibraryType) {
  const { watchlist, favourites, loading, ratingsStatus } = useWatchlist();
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [localDismissed, setLocalDismissed] = useState(readDismissed);
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
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `week` stands in for `today`.
  const seeds = useMemo(() => discoverySeeds(watchlist, favourites, today, type), [watchlist, favourites, type, week]);
  const seedsRef = useRef(seeds);
  // Declared before the query, so the first fetch already sees these seeds.
  useEffect(() => { seedsRef.current = seeds; });

  // The seed list is fixed when the first page loads and travels with the
  // pages, so it survives the cache: adding or "Seen it"-ing a title
  // reorders the seeds, and paging must not repeat or skip one -- also after
  // leaving Discover and coming back, or switching type and back.
  const recommendations = useInfiniteQuery({
    // isAdmin in the key: a visitor's pages (public scores, but no owner-only
    // shelves) must not be what the owner gets after signing in.
    queryKey: ['watchlist', 'discovery', 'recommendations', type, week, isAdmin],
    // Ratings decide the first seeds (8 and up lead, under 6 never seed), so
    // the first page waits for them rather than freezing without them.
    enabled: !loading && ratingsStatus !== 'loading',
    staleTime: 60 * 60 * 1000,
    retry: false,
    initialPageParam: { page: 0, seeds: null } as PageParam,
    queryFn: async ({ pageParam }): Promise<SuggestionPage> => {
      const pageSeeds = pageParam.seeds ?? seedsRef.current;
      const loaded = await load(sourcesForPage(pageSeeds, pageParam.page, type));
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
    queryKey: ['watchlist', 'discovery', 'upcoming', type, start],
    enabled: !loading,
    staleTime: 60 * 60 * 1000,
    retry: false,
    queryFn: () => load([
      ...(type !== 'tv' ? [{ endpoint: 'discover/movie', params: { region: 'GB', 'release_date.gte': start, 'release_date.lte': end, with_release_type: '3', sort_by: 'popularity.desc', include_adult: 'false' }, media: 'movie' as const, reason: 'In UK cinemas soon', kind: 'upcoming' as const }] : []),
      ...(type !== 'movie' ? [{ endpoint: 'discover/tv', params: { 'first_air_date.gte': start, 'first_air_date.lte': end, sort_by: 'popularity.desc', include_adult: 'false' }, media: 'tv' as const, reason: 'New series', kind: 'upcoming' as const }] : []),
    ]),
  });

  const recommendationItems = useMemo(
    () => (recommendations.data?.pages ?? []).flatMap((page) => interleaveBySeed(page.items)),
    [recommendations.data],
  );

  // Kept in the browser first, so it holds even if the table write fails;
  // the effect above moves it into the table for the owner.
  const dismiss = (media: DiscoveryMedia, id: number) => {
    const key = discoveryKey(media, id);
    setLocalDismissed((prev) => { const next = new Set(prev).add(key); writeDismissed(next); return next; });
  };
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

  return {
    recommendations: curateDiscovery(recommendationItems, watchlist, favourites, dismissed),
    upcoming: curateDiscovery(upcoming.data?.items ?? [], watchlist, favourites, dismissed),
    loading: loading || ratingsStatus === 'loading' || recommendations.isPending,
    upcomingLoading: loading || upcoming.isPending,
    failed: recommendations.isError,
    partlyFailed: !recommendations.isError && (recommendations.data?.pages.some((page) => page.failed) ?? false),
    upcomingFailed: upcoming.isError || Boolean(upcoming.data?.failed),
    hasMore: recommendations.hasNextPage,
    loadingMore: recommendations.isFetchingNextPage,
    loadMore: () => { void recommendations.fetchNextPage(); },
    // Only after a total failure, which is one page: refetching every loaded
    // page at once would run into tmdb-proxy's per-minute limit.
    retry: () => { void recommendations.refetch(); },
    dismiss,
    resetDismissed,
    dismissedCount: resettable,
    synced: ownerSynced,
  };
}
