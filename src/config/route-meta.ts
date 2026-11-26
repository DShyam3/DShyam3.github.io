import { SITE } from './site';
import { ALL_APP_MANIFESTS } from '@/apps/useActiveApp';
import type { AppManifest } from '@/apps/types';

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

function buildRouteMetaList(manifests: readonly AppManifest[]): {
  publicRoutes: RouteMeta[];
  privateRoutes: RouteMeta[];
  wildcardRoutes: Array<{ prefix: string; meta: RouteMeta }>;
} {
  const publicRoutes: RouteMeta[] = [];
  const privateRoutes: RouteMeta[] = [];
  const wildcardRoutes: Array<{ prefix: string; meta: RouteMeta }> = [];

  for (const app of manifests) {
    const isPrivate = Boolean(app.noindex || app.requiresAuth);
    const rootMeta: RouteMeta = {
      path: app.basePath,
      title: app.basePath === '/' ? SITE.siteTitle : app.name,
      description: app.description,
      ...(isPrivate ? { noindex: true } : {}),
    };

    if (isPrivate) {
      privateRoutes.push(rootMeta);
    } else {
      publicRoutes.push(rootMeta);
    }

    if (app.wildcard && app.basePath !== '/') {
      wildcardRoutes.push({ prefix: app.basePath.toLowerCase(), meta: rootMeta });
    }

    if (app.subRoutes) {
      for (const sub of app.subRoutes) {
        const subPrivate = Boolean(sub.noindex ?? isPrivate);
        const subMeta: RouteMeta = {
          path: sub.path,
          title: sub.title,
          description: sub.description,
          ...(subPrivate ? { noindex: true } : {}),
        };
        if (subPrivate) {
          privateRoutes.push(subMeta);
        } else {
          publicRoutes.push(subMeta);
        }
      }
    }
  }

  privateRoutes.push({
    path: '/auth',
    title: 'Sign In',
    description: 'Admin sign-in.',
    noindex: true,
  });

  return { publicRoutes, privateRoutes, wildcardRoutes };
}

const { publicRoutes, privateRoutes, wildcardRoutes } = buildRouteMetaList(ALL_APP_MANIFESTS);

export const PUBLIC_ROUTE_META: readonly RouteMeta[] = publicRoutes;

const PRIVATE_ROUTE_META: readonly RouteMeta[] = privateRoutes;

const NOT_FOUND_META: RouteMeta = {
  path: '/404',
  title: 'Page Not Found',
  description: 'The requested page could not be found.',
  noindex: true,
};

const normalizePath = (pathname: string): string => {
  if (!pathname || pathname === '/') return '/';
  return pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
};

export function resolveRouteMeta(pathname: string): RouteMeta {
  const clean = normalizePath(pathname);
  const lower = clean.toLowerCase();

  const exactPublic = PUBLIC_ROUTE_META.find((r) => r.path.toLowerCase() === lower);
  if (exactPublic) return exactPublic;

  const exactPrivate = PRIVATE_ROUTE_META.find((r) => r.path.toLowerCase() === lower);
  if (exactPrivate) return exactPrivate;

  for (const entry of wildcardRoutes) {
    if (lower === entry.prefix || lower.startsWith(`${entry.prefix}/`)) {
      return entry.meta;
    }
  }

  return { ...NOT_FOUND_META, path: clean };
}

export function canonicalUrlFor(path: string): string {
  const base = SITE.url.replace(/\/+$/, '');
  const clean = normalizePath(path);
  return clean === '/' ? `${base}/` : `${base}${clean}`;
}
