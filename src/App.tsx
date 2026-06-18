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

const queryClient = new QueryClient();

// Loading fallback component
const PageLoader = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
  </div>
);

// Flattened providers component
const AppProviders = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>
    <WatchlistProvider>
      <DotMatrixProvider>
        {children}
      </DotMatrixProvider>
    </WatchlistProvider>
  </AuthProvider>
);

/** Invisible component that runs the time-based theme auto-switch logic */
function TimeBasedThemeManager() {
  useTimeBasedTheme();
  return null;
}

const App = () => {
  const [showOpening, setShowOpening] = useState(true);

  const handleOpeningComplete = () => {
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
                  <Route path="/travel" element={<Travel />} />
                  <Route path="/inventory" element={<Inventory />} />
                  <Route path="/links" element={<Links />} />
                  <Route path="/books" element={<Books />} />
                  <Route path="/beliefs" element={<Beliefs />} />
                  <Route path="/watchlist" element={<Watchlist />} />
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
