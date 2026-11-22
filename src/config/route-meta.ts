import { SITE } from './site';

export interface RouteMeta {
  /** Path pattern or exact pathname (e.g. "/projects"). */
  path: string;
  /** Document title shown in the browser tab and Open Graph title. */
  title: string;
  /** Unique meta description for search engines and link previews. */
  description: string;
  /** Exclude from search indexing and sitemap (admin/auth/404 routes). */
  noindex?: boolean;
}

const withSiteName = (section: string) => `${section} · ${SITE.name}`;

export const PUBLIC_ROUTE_META: readonly RouteMeta[] = [
  {
    path: '/',
    title: SITE.siteTitle,
    description: SITE.description,
  },
  {
    path: '/projects',
    title: withSiteName('Projects'),
    description: `Engineering, robotics, and software projects built by ${SITE.name}.`,
  },
  {
    path: '/travel',
    title: withSiteName('Travel'),
    description: `Interactive dot-matrix globe and log of countries and cities visited by ${SITE.name}.`,
  },
  {
    path: '/inventory',
    title: withSiteName('Inventory'),
    description: `Everyday carry, hardware, and favourite gear used daily by ${SITE.name}.`,
  },
  {
    path: '/links',
    title: withSiteName('Links'),
    description: `Curated bookmarks, tools, and corners of the web collected by ${SITE.name}.`,
  },
  {
    path: '/books',
    title: withSiteName('Books'),
    description: `Reading list, notes, and favourite books curated by ${SITE.name}.`,
  },
  {
    path: '/beliefs',
    title: withSiteName('Beliefs'),
    description: `Core principles, ideas, and mental models held by ${SITE.name}.`,
  },
  {
    path: '/thoughts',
    title: withSiteName('Thoughts'),
    description: `Short essays, reflections, and working notes written by ${SITE.name}.`,
  },
  {
    path: '/thoughts/year-in-hours',
    title: withSiteName('A Year in Hours'),
    description: 'Visualizing how 8,760 hours of a year are spent across sleep, work, and life.',
  },
  {
    path: '/watchlist',
    title: withSiteName('Watchlist'),
    description: `Upcoming film and TV releases and cinema news tracked by ${SITE.name}.`,
  },
  {
    path: '/watchlist/library',
    title: withSiteName('Watchlist Library'),
    description: `Complete library of watched and queued films and TV series tracked by ${SITE.name}.`,
  },
  {
    path: '/watchlist/favourites',
    title: withSiteName('Favourite Films & Shows'),
    description: `All-time favourite films and television series picked by ${SITE.name}.`,
  },
  {
    path: '/watchlist/diary',
    title: withSiteName('Watch Diary'),
    description: `Chronological film and television watch diary kept by ${SITE.name}.`,
  },
  {
    path: '/watchlist/franchises',
    title: withSiteName('Franchises'),
    description: `Film and television franchises and shared universes tracked by ${SITE.name}.`,
  },
  {
    path: '/watchlist/facts',
    title: withSiteName('Watchlist Stats'),
    description: `Viewing statistics, runtime totals, and genre breakdowns from ${SITE.name}'s watchlist.`,
  },
  {
    path: '/inspiration',
    title: withSiteName('Inspiration'),
    description: `Design, art, photography, and creative references saved by ${SITE.name}.`,
  },
  {
    path: '/photos',
    title: withSiteName('Photos'),
    description: `Personal photography archive and favourite frames captured by ${SITE.name}.`,
  },
  {
    path: '/articles',
    title: withSiteName('Articles'),
    description: `Long-form reads, essays, and papers bookmarked by ${SITE.name}.`,
  },
  {
    path: '/recipes',
    title: withSiteName('Recipes'),
    description: `Favourite home-cooked recipes and kitchen notes kept by ${SITE.name}.`,
  },
];

const PRIVATE_ROUTE_META: readonly RouteMeta[] = [
  {
    path: '/finance',
    title: withSiteName('Finance'),
    description: `Private personal finance dashboard for ${SITE.name}.`,
    noindex: true,
  },
  {
    path: '/dev',
    title: withSiteName('Dev Status'),
    description: `Internal service health and diagnostics for ${SITE.siteTitle}.`,
    noindex: true,
  },
  {
    path: '/auth',
    title: withSiteName('Sign In'),
    description: `Admin sign-in for ${SITE.siteTitle}.`,
    noindex: true,
  },
];

const NOT_FOUND_META: RouteMeta = {
  path: '/404',
  title: withSiteName('Page Not Found'),
  description: `The requested page could not be found on ${SITE.siteTitle}.`,
  noindex: true,
};

const normalizePath = (pathname: string): string => {
  if (!pathname || pathname === '/') return '/';
  return pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
};

export function resolveRouteMeta(pathname: string): RouteMeta {
  const clean = normalizePath(pathname);
  const lower = clean.toLowerCase();

  if (lower === '/finance' || lower.startsWith('/finance/')) {
    return PRIVATE_ROUTE_META[0];
  }

  const exactPublic = PUBLIC_ROUTE_META.find((r) => r.path === lower);
  if (exactPublic) return exactPublic;

  const exactPrivate = PRIVATE_ROUTE_META.find((r) => r.path === lower);
  if (exactPrivate) return exactPrivate;

  return { ...NOT_FOUND_META, path: clean };
}

export function canonicalUrlFor(path: string): string {
  const base = SITE.url.replace(/\/+$/, '');
  const clean = normalizePath(path);
  return clean === '/' ? `${base}/` : `${base}${clean}`;
}
