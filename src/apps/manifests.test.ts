import { describe, it, expect } from 'vitest';
import { SFSparkles } from '@/components/ui/sf-symbols';
import {
  CORE_APP_MANIFESTS,
  isAppActive,
  resolveAppByPath,
} from './manifests';
import { definePortableApp } from './types';

describe('app manifests registry', () => {
  it('declares unique ids, basePaths, names, and brand-agnostic descriptions', () => {
    const ids = new Set<string>();
    const paths = new Set<string>();

    for (const app of CORE_APP_MANIFESTS) {
      expect(app.id.trim().length).toBeGreaterThan(0);
      expect(app.basePath.startsWith('/')).toBe(true);
      expect(app.name.trim().length).toBeGreaterThan(0);
      expect(app.tagline.trim().length).toBeGreaterThan(0);
      expect(app.description.trim().length).toBeGreaterThan(20);

      expect(ids.has(app.id)).toBe(false);
      expect(paths.has(app.basePath)).toBe(false);
      ids.add(app.id);
      paths.add(app.basePath);

      if (app.basePath !== '/') {
        expect(app.description.toLowerCase()).not.toContain('dhyan');
      }
    }
  });

  it('resolves exact, nested, trailing-slash, and mixed-case paths', () => {
    expect(resolveAppByPath('/')?.id).toBe('about');
    expect(resolveAppByPath('/watchlist')?.id).toBe('watchlist');
    expect(resolveAppByPath('/watchlist/diary')?.id).toBe('watchlist');
    expect(resolveAppByPath('/Finance/budget/')?.id).toBe('finance');
    expect(resolveAppByPath('/Books/')?.id).toBe('books');
    expect(resolveAppByPath('/unknown-app')).toBeUndefined();
  });

  it('distinguishes root Hub from nested app paths in isAppActive', () => {
    const hub = CORE_APP_MANIFESTS.find((a) => a.id === 'about')!;
    const watchlist = CORE_APP_MANIFESTS.find((a) => a.id === 'watchlist')!;

    expect(isAppActive(hub, '/')).toBe(true);
    expect(isAppActive(hub, '/books')).toBe(false);
    expect(isAppActive(watchlist, '/watchlist')).toBe(true);
    expect(isAppActive(watchlist, '/watchlist/library')).toBe(true);
    expect(isAppActive(watchlist, '/watchlists')).toBe(false);
  });

  it('defaults portable drop-in apps to wrapInShell: true and resolves them seamlessly', () => {
    const portable = definePortableApp({
      id: 'sandbox',
      basePath: '/sandbox',
      name: 'Sandbox',
      tagline: 'Portable Test App',
      description: 'Standalone portable app mounted automatically into the suite.',
      icon: SFSparkles,
      group: 'app',
      accentHsl: '205 82% 58%',
      element: null,
    });

    expect(portable.wrapInShell).toBe(true);
    expect(resolveAppByPath('/sandbox/item', [...CORE_APP_MANIFESTS, portable])?.id).toBe('sandbox');
  });
});
