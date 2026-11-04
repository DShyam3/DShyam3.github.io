import { useEffect } from 'react';
import { useQueryClient, type FetchQueryOptions } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { collections } from '@/collections/registry';
import { collectionQuery } from '@/collections/useCollection';
import { warmFinanceSections } from '@/features/finance/section-chunks';
import { visitedCitiesQuery } from '@/features/travel/useVisitedCities';
import { visitedCountriesQuery } from '@/features/travel/useVisitedCountries';
import { watchlistLibraryQuery } from '@/features/watchlist/library-query';
import { upNextQueryOptions } from '@/features/watchlist/up-next-query';
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
import { prefersSavedData, whenIdle, warmChunk } from '@/lib/idle';
import { EDUCATION_READ, EXPERIENCE_READ } from './useResume';
import { ABOUT_READ } from './useSiteContent';
import { supabaseTableQuery } from './useSupabaseTable';

/**
 * Fetches what every other page needs while the user reads the current one,
 * so moving between sections is a render rather than a round trip.
 *
 * Two halves, both deferred to idle so the visible page paints first:
 *
 * - **Code.** The three split route chunks, and for the admin every finance
 *   section. The browser keeps a fetched chunk for the life of the tab.
 * - **Rows.** Each page's table read, prefetched into the query cache under
 *   the key the page itself uses, so opening it renders from cache at once and
 *   revalidates behind the scenes once the data is older than `staleTime`.
 *   `prefetchQuery` skips anything still fresh, so this never re-reads what a
 *   page has just loaded.
 *
 * Finance rows are not here: FinanceSession warms them by mounting the
 * finance provider on idle. Nor are Watchlist's premiere episodes, whose read
 * depends on the announcements the page has already loaded.
 *
 * Waits for auth to settle: admin-only reads (Beliefs) and the finance code
 * are warmed only for the account that can open them, and a read sent before
 * the session is known would go out as anon and cache the wrong answer.
 */
export function useSiteWarmup() {
  const queryClient = useQueryClient();
  const { isAdmin, isAuthLoading } = useAuth();

  useEffect(() => {
    if (isAuthLoading || prefersSavedData()) return;

    return whenIdle(() => {
      warmChunk(() => import('@/features/travel/TravelPage'));
      warmChunk(() => import('@/features/watchlist/WatchlistPage'));
      if (isAdmin) {
        warmChunk(() => import('@/features/finance/FinancePage'));
        warmFinanceSections();
      }

      // Typed loosely on purpose: each read carries its own row type, and the
      // array only needs to hand them to prefetchQuery one at a time.
      const reads: FetchQueryOptions[] = [
        supabaseTableQuery('site_content', EXPERIENCE_READ),
        supabaseTableQuery('site_content', EDUCATION_READ),
        supabaseTableQuery('site_content', ABOUT_READ),
        ...collections.filter(c => isAdmin || !c.adminOnly).map(collectionQuery),
        visitedCountriesQuery,
        visitedCitiesQuery,
        watchlistLibraryQuery,
        scheduleQuery,
        upNextQueryOptions,
        pinnedTitleQuery,
        // The windows WatchlistNews asks for; a different one is a different key.
        recentEpisodesQuery(30),
        recentMoviesQuery(30),
        upcomingEpisodesQuery,
        upcomingMoviesQuery,
        watchlistEventsQuery(30),
        recentAnnouncementsQuery(30),
      ];
      // prefetchQuery never throws: a failed warm-up leaves the page to fetch
      // and report the error itself when it is opened.
      for (const read of reads) void queryClient.prefetchQuery(read);
    });
  }, [queryClient, isAdmin, isAuthLoading]);
}
