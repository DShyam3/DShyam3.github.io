import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { collectionByPath, collections } from '@/collections/registry';
import { collectionQuery } from '@/collections/useCollection';
import { visitedCountriesQuery } from '@/features/travel/useVisitedCountries';
import { visitedCitiesQuery } from '@/features/travel/useVisitedCities';
import { watchlistLibraryQuery, type WatchlistLibrary } from '@/features/watchlist/library-query';

export interface InspectorMetadataRow {
  label: string;
  value: string;
  tone?: 'default' | 'accent' | 'amber' | 'sky';
}

export interface InspectorBacklink {
  id: string;
  code: string;
  label: string;
  to: string;
  meta?: string;
}

export interface InspectorAction {
  label: string;
  to?: string;
}

export interface WorkspaceInspectorTarget {
  id: string;
  eyebrow: string;
  title: string;
  summary: string;
  rows: InspectorMetadataRow[];
  backlinks: InspectorBacklink[];
  primaryAction?: InspectorAction;
  secondaryAction?: InspectorAction;
}

export interface DockedInspectorDetail {
  id: string;
  eyebrow: string;
  title: string;
  onClose: () => void;
  node: ReactNode;
}

interface WorkspaceInspectorContextValue {
  target: WorkspaceInspectorTarget;
  hasCustomTarget: boolean;
  selectTarget: (next: WorkspaceInspectorTarget) => void;
  resetTarget: () => void;
  dockedDetail: DockedInspectorDetail | null;
  setDockedDetail: (detail: DockedInspectorDetail | null) => void;
  inspectorSheetOpen: boolean;
  setInspectorSheetOpen: (open: boolean) => void;
  commandOpen: boolean;
  setCommandOpen: (open: boolean) => void;
  commandDraft: string;
  openCommandWithDraft: (draft?: string) => void;
}

const WorkspaceInspectorContext = createContext<WorkspaceInspectorContextValue | null>(null);

export function WorkspaceInspectorProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const section = pathname.split('/')[1] || 'about';
  const queryClient = useQueryClient();

  const [customTarget, setCustomTarget] = useState<WorkspaceInspectorTarget | null>(null);
  const [dockedDetail, setDockedDetailState] = useState<DockedInspectorDetail | null>(null);
  const [inspectorSheetOpen, setInspectorSheetOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandDraft, setCommandDraft] = useState('');
  const [cacheVersion, setCacheVersion] = useState(0);

  // Re-evaluate live section stats whenever the React Query cache updates.
  useEffect(() => {
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event.type === 'updated') {
        setCacheVersion((v) => v + 1);
      }
    });
    return unsubscribe;
  }, [queryClient]);

  useEffect(() => {
    setCustomTarget(null);
    setDockedDetailState(null);
    setInspectorSheetOpen(false);
  }, [pathname]);

  const liveDefaultTarget = useMemo<WorkspaceInspectorTarget>(() => {
    void cacheVersion;
    const countries = queryClient.getQueryData<unknown[]>(visitedCountriesQuery.queryKey);
    const cities = queryClient.getQueryData<unknown[]>(visitedCitiesQuery.queryKey);
    const wlLib = queryClient.getQueryData<WatchlistLibrary>(watchlistLibraryQuery.queryKey);

    if (section === 'watchlist') {
      const total = wlLib?.watchlist.length;
      const moviesCount = wlLib?.watchlist.filter((i) => i.category === 'Movies').length ?? 0;
      const tvCount = wlLib?.watchlist.filter((i) => i.category === 'TV Shows').length ?? 0;
      const watchingCount =
        wlLib?.watchlist.filter((i) => i.status === 'Watching').length ?? 0;
      const favCount = wlLib?.favourites.length ?? 0;
      const onLibrary = pathname.startsWith('/watchlist/library');

      return {
        id: 'watchlist-live-stats',
        eyebrow: 'Live Section Telemetry',
        title: onLibrary ? 'Watchlist Library' : 'Watchlist & Schedule',
        summary:
          'Click any poster, episode card, or update row to inspect its synopsis, episode list, and schedule controls here in the side rail.',
        rows: [
          {
            label: 'Total tracked',
            value: total !== undefined ? `${total} titles` : 'Loading…',
            tone: 'accent',
          },
          {
            label: 'Breakdown',
            value:
              total !== undefined ? `${tvCount} TV · ${moviesCount} Movies` : 'Loading…',
          },
          {
            label: 'Watching now',
            value: total !== undefined ? `${watchingCount} active` : 'Loading…',
            tone: 'sky',
          },
          {
            label: 'Favourites shelf',
            value: total !== undefined ? `${favCount} saved` : 'Loading…',
            tone: 'amber',
          },
        ],
        backlinks: [
          {
            id: 'bl-wl-switch',
            code: onLibrary ? 'NWS' : 'LIB',
            label: onLibrary ? 'Watchlist News & Schedule' : 'Full Watchlist Library',
            to: onLibrary ? '/watchlist' : '/watchlist/library',
            meta: onLibrary ? '5-pane feed' : 'Poster wall',
          },
          {
            id: 'bl-wl-books',
            code: 'BKS',
            label: 'Books Reading Library',
            to: '/books',
            meta: 'Collection',
          },
          {
            id: 'bl-wl-articles',
            code: 'ART',
            label: 'Saved Articles & Essays',
            to: '/articles',
            meta: 'Collection',
          },
        ],
        primaryAction: {
          label: onLibrary ? 'Open Watchlist News' : 'Open Full Library',
          to: onLibrary ? '/watchlist' : '/watchlist/library',
        },
        secondaryAction: { label: 'Open Books', to: '/books' },
      };
    }

    if (section === 'travel') {
      const countryCount = countries?.length;
      const cityCount = cities?.length;
      return {
        id: 'travel-live-stats',
        eyebrow: 'Spatial Telemetry',
        title: 'Global Travel Atlas',
        summary:
          'Select any country on the globe or sidebar to inspect its logged cities, continent stats, and connected records here.',
        rows: [
          {
            label: 'Countries visited',
            value: countryCount !== undefined ? `${countryCount} logged` : 'Loading…',
            tone: 'accent',
          },
          {
            label: 'Cities logged',
            value: cityCount !== undefined ? `${cityCount} cities` : 'Loading…',
            tone: 'sky',
          },
          { label: 'Projection', value: 'Dot-matrix orthographic' },
        ],
        backlinks: [
          {
            id: 'bl-photos',
            code: 'PHO',
            label: 'Field Photography Archive',
            to: '/photos',
            meta: 'Visual notes',
          },
          {
            id: 'bl-recipes',
            code: 'RCP',
            label: 'Recipes & Kitchen Notes',
            to: '/recipes',
            meta: 'Collection',
          },
          {
            id: 'bl-home',
            code: 'HOM',
            label: 'Semantic Constellation Overview',
            to: '/',
            meta: '01 Home',
          },
        ],
        primaryAction: { label: 'Open Photos', to: '/photos' },
        secondaryAction: { label: 'Back to Home', to: '/' },
      };
    }

    if (section === 'finance') {
      return {
        id: 'finance-ledger-overview',
        eyebrow: 'Deterministic Ledger',
        title: 'Personal Treasury & Cash Flow',
        summary:
          'All balances, budgets, and tax figures are computed locally from rows by pure functions. No figure is ever generated by a model.',
        rows: [
          { label: 'Engine', value: 'Pure TypeScript modules', tone: 'accent' },
          { label: 'Time kind', value: 'Anchored ledger + Monthly' },
          { label: 'Privacy', value: 'Admin RLS · Allowlist only', tone: 'amber' },
        ],
        backlinks: [
          {
            id: 'bl-inventory-fin',
            code: 'INV',
            label: 'Hardware & Gear Inventory',
            to: '/inventory',
            meta: 'Owned assets',
          },
          {
            id: 'bl-travel-fin',
            code: 'TRV',
            label: 'Travel Atlas & City Hubs',
            to: '/travel',
            meta: 'Spatial log',
          },
        ],
        primaryAction: { label: 'Open Inventory', to: '/inventory' },
      };
    }

    const col = collectionByPath(`/${section}`);
    if (col) {
      const rows = queryClient.getQueryData<Record<string, unknown>[]>(
        collectionQuery(col).queryKey,
      );
      const count = rows?.length;
      const withLinks =
        rows?.filter((r) => Boolean(col.card.href?.(r as never))).length ?? 0;
      const withImages =
        rows?.filter((r) => Boolean(col.card.image?.(r as never))).length ?? 0;

      const primaryFacet = col.facets[0];
      let topGroupLabel = 'All records';
      if (rows && rows.length > 0 && primaryFacet) {
        const counts = new Map<string, number>();
        for (const r of rows) {
          const val = r[primaryFacet.field];
          const str = typeof val === 'string' && val.trim() ? val.trim() : '';
          if (str) {
            counts.set(str, (counts.get(str) ?? 0) + 1);
          }
        }
        const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
        if (sorted[0]) {
          topGroupLabel = `${sorted[0][0]} (${sorted[0][1]})`;
        }
      }

      return {
        id: `collection-live-${section}`,
        eyebrow: 'Live Collection Stats',
        title: col.title,
        summary:
          'Click any card in the grid to inspect its full details, external links, and admin actions right inside this rail.',
        rows: [
          {
            label: `Total ${col.noun.plural}`,
            value: count !== undefined ? `${count} records` : 'Loading…',
            tone: 'accent',
          },
          ...(primaryFacet
            ? [
                {
                  label: `Top ${(primaryFacet.label ?? primaryFacet.key).toLowerCase()}`,
                  value: count !== undefined ? topGroupLabel : 'Loading…',
                  tone: 'sky' as const,
                },
              ]
            : []),
          {
            label: 'Media & links',
            value:
              count !== undefined
                ? `${withImages} media · ${withLinks} links`
                : 'Loading…',
          },
        ],
        backlinks: [
          {
            id: 'bl-col-home',
            code: 'HOM',
            label: 'Home & Semantic Constellation',
            to: '/',
            meta: '01 Home',
          },
          ...collections
            .filter((c) => c.path !== col.path && !c.adminOnly)
            .slice(0, 2)
            .map((c) => {
              const cRows = queryClient.getQueryData<unknown[]>(
                collectionQuery(c).queryKey,
              );
              return {
                id: `bl-col-${c.path}`,
                code: c.title.slice(0, 3).toUpperCase(),
                label: c.title,
                to: c.path,
                meta: cRows ? `${cRows.length} items` : 'Collection',
              };
            }),
        ],
        primaryAction: { label: 'Back to Home', to: '/' },
      };
    }

    // Default: Home ('about')
    const invCol = collectionByPath('/inventory');
    const invRows = invCol
      ? queryClient.getQueryData<unknown[]>(collectionQuery(invCol).queryKey)
      : undefined;

    return {
      id: 'site-redesign-2026',
      eyebrow: 'Workspace Telemetry',
      title: 'Personal Index Overview',
      summary:
        'Select any 3D semantic cluster, glance tile, or timeline entry to inspect its provenance and connected backlinks here.',
      rows: [
        {
          label: 'Travel log',
          value:
            countries && cities
              ? `${countries.length} countries · ${cities.length} cities`
              : 'Loading…',
          tone: 'sky',
        },
        {
          label: 'Inventory rig',
          value: invRows ? `${invRows.length} items` : 'Loading…',
          tone: 'accent',
        },
        {
          label: 'Watchlist',
          value: wlLib ? `${wlLib.watchlist.length} titles` : 'Loading…',
          tone: 'amber',
        },
        {
          label: 'Collections',
          value: `${collections.length} active tables`,
        },
      ],
      backlinks: [
        {
          id: 'bl-travel',
          code: 'TRV',
          label: 'Global Travel Atlas & Cities',
          to: '/travel',
          meta: countries ? `${countries.length} countries` : 'Spatial atlas',
        },
        {
          id: 'bl-inventory',
          code: 'INV',
          label: 'Everyday Carry & Hardware Rig',
          to: '/inventory',
          meta: invRows ? `${invRows.length} items` : 'Gear index',
        },
        {
          id: 'bl-watchlist',
          code: 'WCH',
          label: 'Watchlist & Weekly Schedule',
          to: '/watchlist',
          meta: wlLib ? `${wlLib.watchlist.length} titles` : 'Media feed',
        },
      ],
      primaryAction: { label: 'Open Travel Atlas', to: '/travel' },
      secondaryAction: { label: 'Browse Inventory', to: '/inventory' },
    };
  }, [cacheVersion, pathname, queryClient, section]);

  const isRightRailVisible = () =>
    typeof window !== 'undefined' &&
    Boolean(window.matchMedia?.('(min-width: 1280px) and (min-height: 600px)').matches);

  const selectTarget = useCallback((next: WorkspaceInspectorTarget) => {
    setDockedDetailState(null);
    setCustomTarget(next);
    if (!isRightRailVisible()) {
      setInspectorSheetOpen(true);
    }
  }, []);

  const resetTarget = useCallback(() => {
    setCustomTarget(null);
    setDockedDetailState(null);
  }, []);

  const setDockedDetail = useCallback((detail: DockedInspectorDetail | null) => {
    setDockedDetailState(detail);
    if (detail && !isRightRailVisible()) {
      setInspectorSheetOpen(true);
    }
  }, []);

  const openCommandWithDraft = useCallback((draft = '') => {
    setCommandDraft(draft);
    setCommandOpen(true);
  }, []);

  const value = useMemo<WorkspaceInspectorContextValue>(
    () => ({
      target: customTarget ?? liveDefaultTarget,
      hasCustomTarget: Boolean(customTarget),
      selectTarget,
      resetTarget,
      dockedDetail,
      setDockedDetail,
      inspectorSheetOpen,
      setInspectorSheetOpen,
      commandOpen,
      setCommandOpen,
      commandDraft,
      openCommandWithDraft,
    }),
    [
      customTarget,
      liveDefaultTarget,
      selectTarget,
      resetTarget,
      dockedDetail,
      setDockedDetail,
      inspectorSheetOpen,
      setInspectorSheetOpen,
      commandOpen,
      setCommandOpen,
      commandDraft,
      openCommandWithDraft,
    ],
  );

  return (
    <WorkspaceInspectorContext.Provider value={value}>
      {children}
    </WorkspaceInspectorContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useWorkspaceInspector(): WorkspaceInspectorContextValue {
  const ctx = useContext(WorkspaceInspectorContext);
  if (!ctx) {
    throw new Error('useWorkspaceInspector must be used inside WorkspaceInspectorProvider');
  }
  return ctx;
}
