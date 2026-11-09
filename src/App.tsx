import { useState, lazy, Suspense } from 'react';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { ThemeProvider } from 'next-themes';
import { DisplayModeProvider } from '@/contexts/DisplayModeContext';
import { OpeningSequence } from '@/components/layout/OpeningSequence';
import { useTimeBasedTheme } from '@/hooks/useTimeBasedTheme';
import { useSiteWarmup } from '@/hooks/useSiteWarmup';
import { PageLoader } from '@/components/layout/PageLoader';
import { FinanceRoute, FinanceSession } from '@/features/finance/FinanceSession';

import { WatchlistProvider } from './features/watchlist/WatchlistContext';
import { AuthProvider } from './contexts/AuthContext';
import { DotMatrixProvider } from './contexts/DotMatrixContext';
import { WorkspaceInspectorProvider } from './contexts/WorkspaceInspectorContext';

/**
 * Routing loads eagerly except where splitting actually pays for itself.
 *
 * Every page used to be lazy(), which sounds free and is not. React Router
 * wraps navigations in startTransition, and React deliberately does NOT show a
 * Suspense fallback during a transition -- it keeps the previous page on
 * screen until the new one is ready. So a click on a route whose chunk was not
 * cached did nothing visible at all until the network came back, and clicking
 * again while that was in flight left you on whichever route resolved first.
 *
 * Eleven of these chunks were between 1 and 8 kB. Splitting them bought
 * nothing and cost a round trip each, on the first visit to every section.
 * They are part of the entry chunk now (about 20 kB gzipped in total), so
 * navigating to them involves no network at all.
 *
 * Three are worth keeping out of the entry, and are prefetched on idle by
 * SiteWarmup below so a click still does not wait on them. Finance is the
 * third, loaded by FinanceSession rather than as a route element, so its data
 * outlives the page.
 */
import Index from './pages/Index';
import Inventory from './pages/Inventory';
import Links from './pages/Links';
import Books from './pages/Books';
import Beliefs from './pages/Beliefs';
import Thoughts from './pages/Thoughts';
import Inspiration from './pages/Inspiration';
import Photos from './pages/Photos';
import Articles from './pages/Articles';
import Recipes from './pages/Recipes';
import WatchlistNews from './pages/WatchlistNews';
import Auth from './pages/Auth';
import NotFound from './pages/NotFound';

const Travel = lazy(() => import('./features/travel/TravelPage'));
const Watchlist = lazy(() => import('./features/watchlist/WatchlistPage'));

/** Invisible component that warms every page's code and rows on idle (see useSiteWarmup). */
function SiteWarmup() {
  useSiteWarmup();
  return null;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Content here changes rarely (admin-edited), so there's no need to
      // refetch every table on every window focus/remount by default.
      staleTime: 60_000,
      refetchOnWindowFocus: false,
      // Kept for the life of the tab. SiteWarmup fills the cache for pages
      // that have not been opened yet, and the five-minute default would
      // discard those before the click they were fetched for. Stale entries
      // still revalidate on mount; they just render instantly while they do.
      gcTime: Infinity,
    },
  },
});


// Flattened providers component
// WatchlistProvider is deliberately NOT here: its data fetch is the
// watchlist/favourites table read every consumer needs, and every consumer
// lives under /watchlist -- mounting it app-wide meant that fetch ran on
// every page view instead of just there. It IS shared between News and
// Library (see WatchlistLayout below): both read the same watchlist, and
// splitting the provider between them meant leaving one route and coming
// back refetched it from nothing.
const AppProviders = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>
    <DotMatrixProvider>
      <WorkspaceInspectorProvider>
        <SiteWarmup />
        <FinanceSession>{children}</FinanceSession>
      </WorkspaceInspectorProvider>
    </DotMatrixProvider>
  </AuthProvider>
);

// One provider instance for every /watchlist route, so moving between News
// and Library does not refetch. It runs no sync of its own -- `syncWatchlist`
// (the TMDB-calling one) only ever fires from a button click inside the
// Library page, never on mount -- so News inherits nothing heavier than the
// same table read Library already needed.
const WatchlistLayout = () => (
  <WatchlistProvider>
    <Outlet />
  </WatchlistProvider>
);

/** Invisible component that runs the time-based theme auto-switch logic */
function TimeBasedThemeManager() {
  useTimeBasedTheme();
  return null;
}

const OPENING_SEEN_KEY = 'opening-sequence-seen';

const App = () => {
  // Only play the splash once per browser session -- it locks scroll and
  // requires a click/keypress, which is fine as a first-visit flourish but
  // was replaying (and blocking interaction) on every single page load.
  const [showOpening, setShowOpening] = useState(
    () => sessionStorage.getItem(OPENING_SEEN_KEY) !== 'true',
  );

  const handleOpeningComplete = () => {
    sessionStorage.setItem(OPENING_SEEN_KEY, 'true');
    setShowOpening(false);
  };

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme="dark"
        enableSystem
        disableTransitionOnChange
      >
        <TimeBasedThemeManager />
        <TooltipProvider>
          <Toaster />
          <Sonner />

          {/* The v7_startTransition / v7_relativeSplatPath opt-ins are gone:
              both are the default behaviour in react-router 7, and the prop no
              longer exists. */}
          <BrowserRouter>
            <DisplayModeProvider>
            <AppProviders>
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/finance/*" element={<FinanceRoute />} />
                  <Route path="/travel" element={<Travel />} />
                  <Route path="/inventory" element={<Inventory />} />
                  <Route path="/links" element={<Links />} />
                  <Route path="/books" element={<Books />} />
                  <Route path="/beliefs" element={<Beliefs />} />
                  <Route path="/thoughts" element={<Thoughts />} />
                  <Route element={<WatchlistLayout />}>
                    <Route path="/watchlist" element={<WatchlistNews />} />
                    <Route path="/watchlist/library" element={<Watchlist />} />
                  </Route>
                  {/* Kept so a saved or shared link to the old address still lands somewhere. */}
                  <Route path="/watchlist/news" element={<Navigate to="/watchlist" replace />} />
                  <Route path="/inspiration" element={<Inspiration />} />
                  <Route path="/photos" element={<Photos />} />
                  <Route path="/articles" element={<Articles />} />
                  <Route path="/recipes" element={<Recipes />} />
                  <Route path="/auth" element={<Auth />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
              {showOpening && <OpeningSequence onComplete={handleOpeningComplete} />}
            </AppProviders>
            </DisplayModeProvider>
          </BrowserRouter>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
