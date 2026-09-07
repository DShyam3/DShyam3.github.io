/**
 * The five finance surfaces (REHAUL_PLAN.md 7.C).
 *
 * Ten top-level tabs was the other half of why finance read as a different
 * product bolted to the site. Nothing is deleted -- the tabs become sections
 * inside a surface, so Budget stops being a destination and becomes part of
 * Spending, and Time Spent becomes a lens on Income.
 *
 * Each surface is a route, so a view is linkable and the back button works.
 * Code splitting per surface is not here yet -- the page is still one
 * component, so it is still one chunk. That lands in 7.2c, and is what finally
 * stops every section paying for `recharts` (excluded from `manualChunks` in
 * vite.config.ts, so it sits in the finance chunk).
 */

export const SURFACES = [
  { key: 'home', label: 'Home', tabs: ['dashboard'] },
  { key: 'spending', label: 'Spending', tabs: ['transactions', 'budget', 'recurrings'] },
  { key: 'plan', label: 'Plan', tabs: ['cash-flow', 'goals', 'scenarios'] },
  { key: 'wealth', label: 'Wealth', tabs: ['accounts', 'investments', 'retirement'] },
  { key: 'income', label: 'Income', tabs: ['tax-income', 'time-spent'] },
] as const;

export type SurfaceKey = (typeof SURFACES)[number]['key'];
export type TabKey = (typeof SURFACES)[number]['tabs'][number];

/** Section labels, shown in a surface's second-level nav. */
export const TAB_LABELS: Record<TabKey, string> = {
  dashboard: 'Dashboard',
  transactions: 'Transactions',
  budget: 'Budget',
  recurrings: 'Recurrings',
  'cash-flow': 'Cash Flow',
  goals: 'Goals',
  scenarios: 'What if',
  accounts: 'Accounts',
  investments: 'Investments',
  retirement: 'Retirement',
  'tax-income': 'Tax & Income',
  'time-spent': 'Time Spent',
};

export const DEFAULT_TAB: TabKey = 'dashboard';

const surfaceFor = (tab: TabKey) =>
  SURFACES.find(s => (s.tabs as readonly string[]).includes(tab)) ?? SURFACES[0];

/**
 * The URL for a section. A surface with one section has no section segment,
 * so Home is `/finance` rather than `/finance/home/dashboard`.
 */
export const pathForTab = (tab: TabKey): string => {
  const surface = surfaceFor(tab);
  // Home is the only single-section surface, so it needs no section segment.
  if (surface.key === 'home') return '/finance';
  return `/finance/${surface.key}/${tab}`;
};

export const pathForSurface = (surface: SurfaceKey): string =>
  surface === 'home' ? '/finance' : `/finance/${surface}`;

/**
 * Reads a section out of the URL. An unknown surface or section falls back
 * rather than rendering nothing, so a stale bookmark still lands somewhere.
 */
export const tabFromPath = (surfaceSeg?: string, sectionSeg?: string): TabKey => {
  const surface = SURFACES.find(s => s.key === surfaceSeg);
  if (!surface) return DEFAULT_TAB;
  const section = surface.tabs.find(t => t === sectionSeg);
  return (section ?? surface.tabs[0]) as TabKey;
};

export const surfaceForTab = (tab: TabKey): SurfaceKey => surfaceFor(tab).key;

/**
 * Sections that lead with their own headline figure.
 *
 * The surface hero answers "what is this surface about", which is usually what
 * a section wants above it too. Retirement does not: it opens on a projected
 * pot, and stacking net worth on top of it puts two large unrelated figures in
 * the same eyeline and makes the reader choose which one matters.
 */
export const SECTIONS_WITH_OWN_HERO: readonly TabKey[] = ['retirement'];

export const showsSurfaceHero = (tab: TabKey): boolean =>
  !SECTIONS_WITH_OWN_HERO.includes(tab);
