import { useEffect } from 'react';
import { useQueryClient, type FetchQueryOptions } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { collections } from '@/collections/registry';
import { collectionQuery } from '@/collections/useCollection';
import { favouriteTitlesQuery } from '@/components/home/FactCards';
import { warmFinanceSections } from '@/features/finance/section-chunks';
import { merchantLogosQuery } from '@/features/finance/useMerchantLogos';
import { trueLayerConnectionQuery } from '@/features/finance/useTrueLayer';
import { travelJournalQuery } from '@/features/travel/useTravelJournal';
import { visitedCitiesQuery } from '@/features/travel/useVisitedCities';
import { visitedCountriesQuery } from '@/features/travel/useVisitedCountries';
import { diaryQueryOptions } from '@/features/watchlist/diary-query';
import { watchlistLibraryQuery } from '@/features/watchlist/library-query';
import { watchlistRatingsQuery } from '@/features/watchlist/ratings-query';
import { scheduleQuery } from '@/features/watchlist/useSchedule';
import {
  pinnedTitleQuery,
  recentAnnouncementsQuery,
  recentEpisodesQuery,
  recentMoviesQuery,
  upcomingEpisodesQuery,
  upcomingMoviesQuery,
  watchlistEventsQuery,
} from '@/features/watchlist/useWatchlistNews';
import { viewingOrdersQueryOptions } from '@/features/watchlist/viewing-orders-query';
import { prefersSavedData, whenIdle, warmChunk } from '@/lib/idle';
import { EDUCATION_READ, EXPERIENCE_READ } from './useResume';
import { ABOUT_READ } from './useSiteContent';
import { supabaseTableQuery } from './useSupabaseTable';

/**
 * Progressively warms code chunks and Supabase reads in staged idle tiers so
 * moving between sections (Watchlist ↔ Finance, internal tabs, Travel, Books,
 * EDC) is a render rather than a round trip — without firing 50+ requests in
 * one burst on startup.
 *
 * - **Stage 1 (immediate idle):** Sibling tabs of the section the user is on.
 * - **Stage 2 (+1.5 s idle):** The other major sections (Watchlist, Travel,
 *   Finance chunks/status) and route chunks.
 * - **Stage 3 (+4.5 s idle):** Remaining collections (Books, EDC/Inventory,
 *   Projects, Links, Recipes, etc.).
 *
 * `prefetchQuery` skips anything still fresh (including entries hydrated from
 * IndexedDB), so stages never duplicate work. Waits for auth to settle so
 * admin-only reads are warmed only for the admin account.
 */
export function useSiteWarmup() {
  const queryClient = useQueryClient();
  const { session, isAdmin, isAuthLoading } = useAuth();
  const userId = session?.user.id;

  useEffect(() => {
    if (isAuthLoading || prefersSavedData()) return;

    let cancelled = false;
    const timers: Array<ReturnType<typeof setTimeout>> = [];
    const idleCancels: Array<() => void> = [];

    const prefetchAll = (reads: FetchQueryOptions[]) => {
      for (const read of reads) void queryClient.prefetchQuery(read);
    };

    const scheduleStage = (delayMs: number, run: () => void) => {
      const enqueueIdle = () => {
        if (cancelled) return;
        idleCancels.push(whenIdle(() => {
          if (!cancelled) run();
        }));
      };
      if (delayMs === 0) {
        enqueueIdle();
      } else {
        timers.push(setTimeout(enqueueIdle, delayMs));
      }
    };

    const pathname = typeof window !== 'undefined' ? window.location.pathname : '/';

    const homeReads: FetchQueryOptions[] = [
      supabaseTableQuery('site_content', EXPERIENCE_READ),
      supabaseTableQuery('site_content', EDUCATION_READ),
      supabaseTableQuery('site_content', ABOUT_READ),
      favouriteTitlesQuery,
    ];

    const watchlistReads: FetchQueryOptions[] = [
      watchlistLibraryQuery,
      watchlistRatingsQuery,
      scheduleQuery,
      diaryQueryOptions,
      viewingOrdersQueryOptions,
      pinnedTitleQuery,
      recentEpisodesQuery(30),
      recentMoviesQuery(30),
      upcomingEpisodesQuery,
      upcomingMoviesQuery,
      watchlistEventsQuery(30),
      recentAnnouncementsQuery(30),
    ];

    const travelReads: FetchQueryOptions[] = [
      visitedCountriesQuery,
      visitedCitiesQuery,
      travelJournalQuery(userId, isAdmin),
    ];

    const financeReads: FetchQueryOptions[] = isAdmin
      ? [trueLayerConnectionQuery, merchantLogosQuery]
      : [];

    const collectionReads: FetchQueryOptions[] = collections
      .filter((c) => isAdmin || !c.adminOnly)
      .map(collectionQuery);

    const warmFinanceCode = () => {
      if (!isAdmin) return;
      warmChunk(() => import('@/features/finance/FinancePage'));
      warmFinanceSections();
    };

    // Stage 1: warm the sibling tabs of whichever section the user opened.
    scheduleStage(0, () => {
      if (pathname.startsWith('/watchlist')) {
        warmChunk(() => import('@/features/watchlist/WatchlistPage'));
        prefetchAll(watchlistReads);
      } else if (pathname.startsWith('/finance')) {
        warmFinanceCode();
        prefetchAll(financeReads);
      } else if (pathname.startsWith('/travel')) {
        warmChunk(() => import('@/features/travel/TravelPage'));
        prefetchAll(travelReads);
      } else {
        prefetchAll(homeReads);
      }
    });

    // Stage 2: warm the other major sections and split route chunks.
    scheduleStage(1_500, () => {
      warmChunk(() => import('@/features/travel/TravelPage'));
      warmChunk(() => import('@/features/watchlist/WatchlistPage'));
      warmFinanceCode();
      prefetchAll([
        ...homeReads,
        ...watchlistReads,
        ...travelReads,
        ...financeReads,
      ]);
    });

    // Stage 3: warm all remaining collections (Books, EDC/Inventory, Projects, etc.).
    scheduleStage(4_500, () => {
      prefetchAll(collectionReads);
    });

    return () => {
      cancelled = true;
      for (const timer of timers) clearTimeout(timer);
      for (const cancel of idleCancels) cancel();
    };
  }, [queryClient, userId, isAdmin, isAuthLoading]);
}
