/**
 * Pure finance domain logic: no React, no Supabase, no DOM.
 *
 * This boundary is location-independent by design (REHAUL_PLAN.md 7.I) — the
 * same modules run in the browser today and in a server process if the site
 * ever moves off GitHub Pages. Nothing here may import from `features/`.
 */

export * from './credit';
export * from './dates';
export * from './debt';
export * from './geometry';
export * from './holidays';
export * from './payday';
export * from './scenario';
