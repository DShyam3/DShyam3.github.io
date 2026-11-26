import { useState, Suspense } from 'react';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from 'next-themes';
import { DisplayModeProvider } from '@/contexts/DisplayModeContext';
import { OpeningSequence } from '@/components/layout/OpeningSequence';
import { useTimeBasedTheme } from '@/hooks/useTimeBasedTheme';
import { useSiteWarmup } from '@/hooks/useSiteWarmup';
import { useRouteMeta } from '@/hooks/useRouteMeta';
import { attachPublicQueryPersistence } from '@/lib/query-cache-persistence';
import { PageLoader } from '@/components/layout/PageLoader';
import { RouteErrorBoundary } from '@/components/layout/RouteErrorBoundary';
import { FinanceSession } from '@/features/finance/FinanceSession';
import { renderAppRoutes } from '@/apps/routes';

import { AuthProvider } from './contexts/AuthContext';
import { DotMatrixProvider } from './contexts/DotMatrixContext';
import { WorkspaceInspectorProvider } from './contexts/WorkspaceInspectorContext';

import Auth from './pages/Auth';
import NotFound from './pages/NotFound';

/** Invisible component that warms every page's code and rows on idle (see useSiteWarmup). */
function SiteWarmup() {
  useSiteWarmup();
  return null;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Content here is single-admin and mutations explicitly invalidate their
      // own keys, so a 10-minute freshness window avoids re-fetching tables on
      // routine route/tab switches while still revalidating long-lived sessions.
      staleTime: 10 * 60_000,
      refetchOnWindowFocus: false,
      // Kept for the life of the tab. SiteWarmup fills the cache for pages
      // that have not been opened yet, and the five-minute default would
      // discard those before the click they were fetched for. Stale entries
      // still revalidate on mount; they just render instantly while they do.
      gcTime: Infinity,
    },
  },
});

attachPublicQueryPersistence(queryClient);

// Flattened providers component
// WatchlistProvider is deliberately NOT here: it mounts inside WatchlistLayout
// (see `src/apps/routes.tsx`) so its fetch only runs under `/watchlist/*`.
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

/** Invisible component that runs the time-based theme auto-switch logic */
function TimeBasedThemeManager() {
  useTimeBasedTheme();
  return null;
}

/** Keeps document title, meta description, canonical, OG tags, and robots in sync per route. */
function RouteMetaManager() {
  useRouteMeta();
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
        <TooltipProvider delayDuration={250} skipDelayDuration={300}>
          <Sonner />

          <BrowserRouter>
            <RouteMetaManager />
            <DisplayModeProvider>
              <AppProviders>
                {/* A page that fails to render shows why, not a blank screen. */}
                <RouteErrorBoundary>
                  <Suspense fallback={<PageLoader />}>
                    <Routes>
                      {renderAppRoutes()}
                      <Route path="/auth" element={<Auth />} />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </Suspense>
                </RouteErrorBoundary>
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
