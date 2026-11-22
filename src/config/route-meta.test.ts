import { describe, it, expect } from 'vitest';
import {
  PUBLIC_ROUTE_META,
  resolveRouteMeta,
  canonicalUrlFor,
} from './route-meta';

describe('route-meta', () => {
  it('gives every public route a unique title and description', () => {
    const titles = new Set<string>();
    const descriptions = new Set<string>();
    const paths = new Set<string>();

    for (const route of PUBLIC_ROUTE_META) {
      expect(route.path.startsWith('/')).toBe(true);
      expect(route.title.trim().length).toBeGreaterThan(0);
      expect(route.description.trim().length).toBeGreaterThan(20);
      expect(route.noindex).not.toBe(true);

      expect(paths.has(route.path)).toBe(false);
      expect(titles.has(route.title)).toBe(false);
      expect(descriptions.has(route.description)).toBe(false);

      paths.add(route.path);
      titles.add(route.title);
      descriptions.add(route.description);
    }
  });

  it('normalizes trailing slashes and casing when resolving routes', () => {
    expect(resolveRouteMeta('/projects/').path).toBe('/projects');
    expect(resolveRouteMeta('/Projects').path).toBe('/projects');
    expect(resolveRouteMeta('/Finance/budget').noindex).toBe(true);
    expect(resolveRouteMeta('/').path).toBe('/');
  });

  it('marks private routes and unknown routes as noindex', () => {
    expect(resolveRouteMeta('/finance').noindex).toBe(true);
    expect(resolveRouteMeta('/finance/budget').noindex).toBe(true);
    expect(resolveRouteMeta('/dev').noindex).toBe(true);
    expect(resolveRouteMeta('/auth').noindex).toBe(true);
    expect(resolveRouteMeta('/does-not-exist').noindex).toBe(true);
  });

  it('builds absolute canonical URLs', () => {
    expect(canonicalUrlFor('/')).toMatch(/^https:\/\/.+\/$/);
    expect(canonicalUrlFor('/projects')).toMatch(/^https:\/\/.+\/projects$/);
    expect(canonicalUrlFor('/projects/')).toMatch(/^https:\/\/.+\/projects$/);
  });
});
