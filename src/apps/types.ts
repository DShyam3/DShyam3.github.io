import type { ComponentType, ReactNode } from 'react';
import type { SFSymbolComponent } from '@/components/ui/sf-symbols';

export type AppGroup = 'hub' | 'app' | 'collection' | 'system';

export interface AppSubRouteMeta {
  /** Exact route path (e.g. '/watchlist/library'). */
  path: string;
  /** Browser tab / Open Graph title. */
  title: string;
  /** Brand-agnostic meta description. */
  description: string;
  /** Exclude from search indexing. Defaults to parent app's `noindex`. */
  noindex?: boolean;
}

export interface AppManifest {
  /** Stable identifier used for `data-section`, error isolation, and route bindings. */
  id: string;
  /** Root URL path for this app (e.g. '/', '/watchlist', '/finance'). */
  basePath: string;
  /** Display name shown in the sidebar page list, app switcher, header, and tab title. */
  name: string;
  /** Concise subtitle shown under the app name in the app-first header. */
  tagline: string;
  /** Brand-agnostic meta description for SEO and link previews. */
  description: string;
  /** SF Symbol shown in the sidebar, header badge, mobile menu, and ⌘K palette. */
  icon: SFSymbolComponent;
  /** Visual grouping in the sidebar page list. */
  group: AppGroup;
  /** Admin-only apps are hidden from visitors who are not signed in as admin. */
  requiresAuth?: boolean;
  /** Exclude from search indexing and sitemap. */
  noindex?: boolean;
  /** Whether to list this app in the primary page list / switcher. Defaults to true except 'system'. */
  showInNav?: boolean;
  /**
   * Optional custom accent colour in raw HSL channels (e.g. '205 82% 58%').
   * When set, overrides the default `[data-section]` token so portable apps
   * can bring their own accent colour without editing global CSS.
   */
  accentHsl?: string;
  /** When true, the app handles nested routes under `basePath/*` internally. */
  wildcard?: boolean;
  /** Optional nested routes with their own titles and descriptions. */
  subRoutes?: readonly AppSubRouteMeta[];
  /** Optional legacy paths that redirect to `basePath`. */
  redirects?: readonly string[];
}

export interface AppRouteBinding {
  /** Matches `AppManifest.id`. */
  id: string;
  /** Element rendered at `basePath` (or `basePath/*` when `wildcard` is true). */
  element: ReactNode;
  /**
   * Automatically wrap `element` in the standard `<AppShell>` (Header, Sidebar,
   * scrollable middle card, Footer). Set `true` for standalone portable pages
   * that don't render their own `<AppShell>`.
   */
  wrapInShell?: boolean;
  /** Optional shared layout wrapper (with `<Outlet />`) for `element` + `subRoutes`. */
  layout?: ComponentType;
  /** Elements for each sub-route path declared in `AppManifest.subRoutes`. */
  subRouteElements?: Record<string, ReactNode>;
}

export interface PortableAppDefinition extends AppManifest {
  /** React element rendered inside the standard `<AppShell>` frame. */
  element: ReactNode;
  /**
   * Defaults to `true` for portable apps so a plain page automatically inherits
   * the Header, Sidebar page list, middle card, and Footer. Set `false` if the
   * page renders its own `<AppShell>` (e.g. to supply a custom `toolbar`).
   */
  wrapInShell?: boolean;
}

export function defineApp(manifest: AppManifest): AppManifest {
  return manifest;
}

export function definePortableApp(app: PortableAppDefinition): PortableAppDefinition {
  return {
    wrapInShell: true,
    ...app,
  };
}
