import { useState, lazy, Suspense } from 'react';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from 'next-themes';
import { OpeningSequence } from '@/components/layout/OpeningSequence';
import { useTimeBasedTheme } from '@/hooks/useTimeBasedTheme';

import { WatchlistProvider } from './contexts/WatchlistContext';
import { AuthProvider } from './contexts/AuthContext';
import { DotMatrixProvider } from './contexts/DotMatrixContext';

// Lazy loaded pages for code splitting
const Index = lazy(() => import('./pages/Index'));
const Finance = lazy(() => import('./pages/Finance'));
const Travel = lazy(() => import('./pages/Travel'));
const Inventory = lazy(() => import('./pages/Inventory'));
const Links = lazy(() => import('./pages/Links'));
const Books = lazy(() => import('./pages/Books'));
const Beliefs = lazy(() => import('./pages/Beliefs'));
const Watchlist = lazy(() => import('./pages/Watchlist'));
const Inspiration = lazy(() => import('./pages/Inspiration'));
const Photos = lazy(() => import('./pages/Photos'));
const Articles = lazy(() => import('./pages/Articles'));
const Recipes = lazy(() => import('./pages/Recipes'));
const Auth = lazy(() => import('./pages/Auth'));
const NotFound = lazy(() => import('./pages/NotFound'));

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
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
        <TimeBasedThemeManager />
        <TooltipProvider>
          <Toaster />
          <Sonner />

          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
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
