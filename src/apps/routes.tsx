import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Outlet, Route } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { PageLoader } from '@/components/layout/PageLoader';
import { FinanceRoute } from '@/features/finance/FinanceSession';
import { WatchlistProvider } from '@/features/watchlist/WatchlistContext';
import { ALL_APP_MANIFESTS } from './useActiveApp';
import { PORTABLE_APPS } from './portable';
import type { AppManifest, AppRouteBinding } from './types';

/**
 * Eagerly loaded light pages (see historical rationale: eleven 1–8 kB chunks
 * cost a network round trip each on first visit, so keeping them in the entry
 * chunk makes switching between collections instantaneous).
 */
import Index from '@/pages/Index';
import Inventory from '@/pages/Inventory';
import Links from '@/pages/Links';
import Projects from '@/pages/Projects';
import Books from '@/pages/Books';
import Beliefs from '@/pages/Beliefs';
import Thoughts from '@/pages/Thoughts';
import Inspiration from '@/pages/Inspiration';
import Photos from '@/pages/Photos';
import Articles from '@/pages/Articles';
import Recipes from '@/pages/Recipes';
import WatchlistNews from '@/pages/WatchlistNews';
import WatchlistFacts from '@/pages/WatchlistFacts';

/** Heavy feature apps stay code-split and are prefetched on idle by `useSiteWarmup`. */
const Travel = lazy(() => import('@/features/travel/TravelPage'));
const YearInHours = lazy(() => import('@/pages/YearInHours'));
const Watchlist = lazy(() => import('@/features/watchlist/WatchlistPage'));
const WatchlistFavourites = lazy(() => import('@/pages/WatchlistFavourites'));
const WatchlistFinished = lazy(() => import('@/pages/WatchlistFinished'));
const WatchlistDiary = lazy(() => import('@/pages/WatchlistDiary'));
const WatchlistFranchises = lazy(() => import('@/pages/WatchlistFranchises'));
const Dev = lazy(() => import('@/pages/Dev'));

/**
 * Shared provider layout for all `/watchlist/*` routes so moving between News,
 * Library, Favourites, Diary, Franchises, and Facts never refetches.
 */
function WatchlistLayout() {
  return (
    <WatchlistProvider>
      <Suspense fallback={<PageLoader />}>
        <Outlet />
      </Suspense>
    </WatchlistProvider>
  );
}

/**
 * Wraps a standalone portable page in the standard AppShell (Header, Sidebar,
 * scrollable middle card, Footer) so drop-in pages need zero shell boilerplate.
 */
function PortableAppFrame({ app, children }: { app: AppManifest; children: ReactNode }) {
  return (
    <AppShell title={app.name} subtitle={app.tagline}>
      {children}
    </AppShell>
  );
}

const CORE_ROUTE_BINDINGS: Record<string, AppRouteBinding> = {
  about: { id: 'about', element: <Index /> },
  finance: { id: 'finance', element: <FinanceRoute /> },
  travel: { id: 'travel', element: <Travel /> },
  watchlist: {
    id: 'watchlist',
    layout: WatchlistLayout,
    element: <WatchlistNews />,
    subRouteElements: {
      '/watchlist/library': <Watchlist />,
      '/watchlist/favourites': <WatchlistFavourites />,
      '/watchlist/finished': <WatchlistFinished />,
      '/watchlist/diary': <WatchlistDiary />,
      '/watchlist/franchises': <WatchlistFranchises />,
      '/watchlist/facts': <WatchlistFacts />,
    },
  },
  projects: { id: 'projects', element: <Projects /> },
  inventory: { id: 'inventory', element: <Inventory /> },
  links: { id: 'links', element: <Links /> },
  books: { id: 'books', element: <Books /> },
  articles: { id: 'articles', element: <Articles /> },
  inspiration: { id: 'inspiration', element: <Inspiration /> },
  photos: { id: 'photos', element: <Photos /> },
  recipes: { id: 'recipes', element: <Recipes /> },
  beliefs: { id: 'beliefs', element: <Beliefs /> },
  thoughts: {
    id: 'thoughts',
    element: <Thoughts />,
    subRouteElements: {
      '/thoughts/year-in-hours': <YearInHours />,
    },
  },
  dev: { id: 'dev', element: <Dev /> },
};

function bindingFor(app: AppManifest): AppRouteBinding | undefined {
  const core = CORE_ROUTE_BINDINGS[app.id];
  if (core) return core;
  const portable = PORTABLE_APPS.find((entry) => entry.id === app.id);
  if (!portable) return undefined;
  return {
    id: portable.id,
    element: portable.element,
    wrapInShell: portable.wrapInShell,
  };
}

function wrapElement(app: AppManifest, binding: AppRouteBinding, element: ReactNode): ReactNode {
  if (!binding.wrapInShell) return element;
  return <PortableAppFrame app={app}>{element}</PortableAppFrame>;
}

/**
 * Generates React Router `<Route>` elements for every registered app (built-in
 * and portable drop-ins), including nested sub-routes and legacy redirects.
 */
export function renderAppRoutes(): ReactNode[] {
  const routes: ReactNode[] = [];

  for (const app of ALL_APP_MANIFESTS) {
    const binding = bindingFor(app);
    if (!binding) continue;

    const rootPath = app.wildcard ? `${app.basePath}/*` : app.basePath;
    const rootElement = wrapElement(app, binding, binding.element);

    if (binding.layout) {
      const Layout = binding.layout;
      routes.push(
        <Route key={`layout:${app.id}`} element={<Layout />}>
          <Route path={rootPath} element={rootElement} />
          {app.subRoutes?.map((sub) => {
            const subElement = binding.subRouteElements?.[sub.path];
            if (!subElement) return null;
            return (
              <Route
                key={sub.path}
                path={sub.path}
                element={wrapElement(app, binding, subElement)}
              />
            );
          })}
        </Route>,
      );
    } else {
      routes.push(<Route key={app.id} path={rootPath} element={rootElement} />);
      if (app.subRoutes) {
        for (const sub of app.subRoutes) {
          const subElement = binding.subRouteElements?.[sub.path];
          if (!subElement) continue;
          routes.push(
            <Route
              key={sub.path}
              path={sub.path}
              element={wrapElement(app, binding, subElement)}
            />,
          );
        }
      }
    }

    if (app.redirects) {
      for (const from of app.redirects) {
        routes.push(
          <Route
            key={`redirect:${from}`}
            path={from}
            element={<Navigate to={app.basePath} replace />}
          />,
        );
      }
    }
  }

  return routes;
}
