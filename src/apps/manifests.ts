import {
  SFBanknoteFill,
  SFBooksVerticalFill,
  SFCompassDrawing,
  SFForkKnife,
  SFGlobeEuropeAfricaFill,
  SFHammerFill,
  SFLightbulbFill,
  SFLinkCircleFill,
  SFNewspaperFill,
  SFPersonCropCircleFill,
  SFPhotoFill,
  SFShippingboxFill,
  SFSparkles,
  SFTvFill,
  SFWaveformPathEcg,
} from '@/components/ui/sf-symbols';
import { SITE } from '@/config/site';
import { defineApp, type AppGroup, type AppManifest } from './types';

/**
 * Canonical registry of every app and page in the suite.
 *
 * Sidebar page list, mobile App Switcher, ⌘K command palette, section icons,
 * app-first header identity, and browser/OG route metadata all derive from this
 * single list.
 *
 * To add a new portable drop-in page without touching routing or chrome, register
 * it in `src/apps/portable.tsx` (or add a manifest here + route in `src/apps/routes.tsx`).
 */
export const CORE_APP_MANIFESTS: readonly AppManifest[] = [
  defineApp({
    id: 'about',
    basePath: '/',
    name: 'About',
    tagline: SITE.tagline,
    description: SITE.description,
    icon: SFPersonCropCircleFill,
    group: 'hub',
  }),
  defineApp({
    id: 'projects',
    basePath: '/projects',
    name: 'Projects',
    tagline: 'Builds & Experiments',
    description: 'Engineering, robotics, and software projects.',
    icon: SFHammerFill,
    group: 'collection',
  }),
  defineApp({
    id: 'finance',
    basePath: '/finance',
    name: 'Finance',
    tagline: 'Personal Ledger',
    description: 'Personal finance dashboard for accounts, budgets, cash flow, tax, and forecasts.',
    icon: SFBanknoteFill,
    group: 'app',
    requiresAuth: true,
    noindex: true,
    wildcard: true,
  }),
  defineApp({
    id: 'travel',
    basePath: '/travel',
    name: 'Travel',
    tagline: 'World Atlas',
    description: 'Interactive dot-matrix globe and log of visited countries, territories, and cities.',
    icon: SFGlobeEuropeAfricaFill,
    group: 'app',
  }),
  defineApp({
    id: 'inventory',
    basePath: '/inventory',
    name: 'Inventory',
    tagline: 'Gear & Everyday Carry',
    description: 'Everyday carry, hardware, wardrobe, and kitchen gear.',
    icon: SFShippingboxFill,
    group: 'collection',
  }),
  defineApp({
    id: 'links',
    basePath: '/links',
    name: 'Links',
    tagline: 'Web Bookmarks',
    description: 'Curated bookmarks, tools, and useful corners of the web.',
    icon: SFLinkCircleFill,
    group: 'collection',
  }),
  defineApp({
    id: 'books',
    basePath: '/books',
    name: 'Books',
    tagline: 'Reading Library',
    description: 'Reading list, notes, and favourite books.',
    icon: SFBooksVerticalFill,
    group: 'collection',
  }),
  defineApp({
    id: 'articles',
    basePath: '/articles',
    name: 'Articles',
    tagline: 'Saved Reading',
    description: 'Long-form reads, essays, and papers.',
    icon: SFNewspaperFill,
    group: 'collection',
  }),
  defineApp({
    id: 'inspiration',
    basePath: '/inspiration',
    name: 'Inspiration',
    tagline: 'Visual Archive',
    description: 'Design, art, photography, and creative references.',
    icon: SFSparkles,
    group: 'collection',
  }),
  defineApp({
    id: 'photos',
    basePath: '/photos',
    name: 'Photos',
    tagline: 'Photography Archive',
    description: 'Photography archive and favourite frames.',
    icon: SFPhotoFill,
    group: 'collection',
  }),
  defineApp({
    id: 'recipes',
    basePath: '/recipes',
    name: 'Recipes',
    tagline: 'Kitchen Notes',
    description: 'Home-cooked recipes and kitchen notes.',
    icon: SFForkKnife,
    group: 'collection',
  }),
  defineApp({
    id: 'beliefs',
    basePath: '/beliefs',
    name: 'Beliefs',
    tagline: 'Principles & Models',
    description: 'Core principles, ideas, and mental models.',
    icon: SFCompassDrawing,
    group: 'collection',
    requiresAuth: true,
    noindex: true,
  }),
  defineApp({
    id: 'thoughts',
    basePath: '/thoughts',
    name: 'Thoughts',
    tagline: 'Essays & Notes',
    description: 'Short essays, reflections, and working notes.',
    icon: SFLightbulbFill,
    group: 'collection',
    subRoutes: [
      {
        path: '/thoughts/year-in-hours',
        title: 'A Year in Hours · Thoughts',
        description: 'Visualizing how 8,760 hours of a year are spent across sleep, work, and life.',
      },
    ],
  }),
  defineApp({
    id: 'watchlist',
    basePath: '/watchlist',
    name: 'Watchlist',
    tagline: 'Film & TV Tracker',
    description: 'Upcoming film and TV releases, watch library, franchises, and viewing stats.',
    icon: SFTvFill,
    group: 'app',
    redirects: ['/watchlist/news'],
    subRoutes: [
      {
        path: '/watchlist/library',
        title: 'Library · Watchlist',
        description: 'Complete library of watched, active, and queued films and TV series.',
      },
      {
        path: '/watchlist/favourites',
        title: 'Favourites · Watchlist',
        description: 'All-time favourite films and television series.',
      },
      {
        path: '/watchlist/finished',
        title: 'Finished · Watchlist',
        description: 'Watched films and completed television series.',
      },
      {
        path: '/watchlist/diary',
        title: 'Diary · Watchlist',
        description: 'Chronological film and television watch diary.',
      },
      {
        path: '/watchlist/franchises',
        title: 'Franchises · Watchlist',
        description: 'Film and television franchises and shared universes.',
      },
      {
        path: '/watchlist/facts',
        title: 'Stats · Watchlist',
        description: 'Viewing statistics, runtime totals, and genre breakdowns.',
      },
    ],
  }),

  // ── System ───────────────────────────────────────────────────────────────
  defineApp({
    id: 'dev',
    basePath: '/dev',
    name: 'Dev Status',
    tagline: 'Service Diagnostics',
    description: 'Internal service health, telemetry, and diagnostics.',
    icon: SFWaveformPathEcg,
    group: 'system',
    requiresAuth: true,
    noindex: true,
    showInNav: false,
  }),
];

/** Ordered group headings used in the sidebar page list. */
export const APP_GROUP_LABELS: Record<Exclude<AppGroup, 'system'>, string> = {
  hub: 'Hub',
  app: 'Apps',
  collection: 'Collections',
};

const normalizePath = (pathname: string): string => {
  if (!pathname || pathname === '/') return '/';
  return pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
};

/** Resolve which app owns `pathname` (exact match or nested prefix). */
export function resolveAppByPath(
  pathname: string,
  manifests: readonly AppManifest[] = CORE_APP_MANIFESTS,
): AppManifest | undefined {
  const clean = normalizePath(pathname).toLowerCase();
  if (clean === '/') {
    return manifests.find((app) => app.basePath === '/');
  }
  return manifests.find(
    (app) =>
      app.basePath !== '/' &&
      (clean === app.basePath.toLowerCase() ||
        clean.startsWith(`${app.basePath.toLowerCase()}/`)),
  );
}

/** Check whether `pathname` is currently inside `app`. */
export function isAppActive(app: AppManifest, pathname: string): boolean {
  const clean = normalizePath(pathname).toLowerCase();
  const base = app.basePath.toLowerCase();
  if (base === '/') return clean === '/';
  return clean === base || clean.startsWith(`${base}/`);
}
