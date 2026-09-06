import { useState, useEffect, lazy, Suspense } from 'react';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from 'next-themes';
import { OpeningSequence } from '@/components/layout/OpeningSequence';
import { useTimeBasedTheme } from '@/hooks/useTimeBasedTheme';

import { WatchlistProvider } from './features/watchlist/WatchlistContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { DotMatrixProvider } from './contexts/DotMatrixContext';

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
 * RoutePrefetch below so a click still does not wait on them.
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
import Auth from './pages/Auth';
import NotFound from './pages/NotFound';

const Finance = lazy(() => import('./features/finance/FinancePage'));
const Travel = lazy(() => import('./features/travel/TravelPage'));
const Watchlist = lazy(() => import('./features/watchlist/WatchlistPage'));

/**
 * Warms the three split chunks once the browser is idle, so the click that
 * needs them is not the thing that fetches them. Finance is ~256 kB gzipped
 * and admin-only, so it is warmed only for the account that can open it.
 */
function RoutePrefetch() {
  const { isAdmin } = useAuth();

  useEffect(() => {
    const warm = () => {
      void import('./features/travel/TravelPage');
      void import('./features/watchlist/WatchlistPage');
      if (isAdmin) void import('./features/finance/FinancePage');
    };

    if (typeof window.requestIdleCallback === 'function') {
      const handle = window.requestIdleCallback(warm, { timeout: 4000 });
      return () => window.cancelIdleCallback?.(handle);
    }
    // Safari has no requestIdleCallback. A plain timer after first paint is
    // close enough for something this small.
    const timer = window.setTimeout(warm, 2000);
    return () => window.clearTimeout(timer);
  }, [isAdmin]);

  return null;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Content here changes rarely (admin-edited), so there's no need to
      // refetch every table on every window focus/remount by default.
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    },
  },
});

// Loading fallback component
const PageLoader = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
  </div>
);

// Flattened providers component
// WatchlistProvider is deliberately NOT here: it runs a data fetch + a
// 15-minute auto-sync loop on mount, and every one of its consumers lives
// under the /watchlist route -- mounting it app-wide meant that logic ran
// on every page view instead of just the Watchlist page.
const AppProviders = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>
    <DotMatrixProvider>
      <RoutePrefetch />
      {children}
    </DotMatrixProvider>
  </AuthProvider>
);

const WatchlistPage = () => (
  <WatchlistProvider>
    <Watchlist />
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
      {/* disableTransitionOnChange: the palettes are inverses, so any
          crossfade between them passes through a mid-grey where text and
          card meet at the same value and the page reads as blank for a
          frame. Synchronising the durations does not help -- the midpoint
          is where the contrast goes, not the timing. next-themes drops
          every transition for the one frame the class flips, so the swap
          is atomic. ThemeToggle animates its own arc around this. */}
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
            <AppProviders>
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/finance" element={<Finance />} />
                  <Route path="/travel" element={<Travel />} />
                  <Route path="/inventory" element={<Inventory />} />
                  <Route path="/links" element={<Links />} />
                  <Route path="/books" element={<Books />} />
                  <Route path="/beliefs" element={<Beliefs />} />
                  <Route path="/thoughts" element={<Thoughts />} />
                  <Route path="/watchlist" element={<WatchlistPage />} />
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
          </BrowserRouter>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
