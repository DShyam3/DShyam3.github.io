import { describe, expect, it } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import {
  buildPublicSnapshot,
  hydratePublicSnapshot,
  isPersistablePublicQueryKey,
  MAX_PERSISTED_AGE_MS,
  PUBLIC_CACHE_VERSION,
} from './query-cache-persistence';

describe('isPersistablePublicQueryKey', () => {
  it('allows public collections, watchlist public data, and anonymous travel', () => {
    expect(isPersistablePublicQueryKey(['books', '*', undefined])).toBe(true);
    expect(isPersistablePublicQueryKey(['books', 'id, title, author, cover_url', undefined])).toBe(true);
    expect(isPersistablePublicQueryKey(['inventory_items', '*', undefined])).toBe(true);
    expect(isPersistablePublicQueryKey(['inventory_items', 'id, name, brand', undefined])).toBe(true);
    expect(isPersistablePublicQueryKey(['site_content', '*', { column: 'section', value: 'about' }])).toBe(true);
    expect(isPersistablePublicQueryKey(['favourites', 'titles'])).toBe(true);
    expect(isPersistablePublicQueryKey(['travel', 'visited-countries'])).toBe(true);
    expect(isPersistablePublicQueryKey(['travel-journal', 'public', false])).toBe(true);
    expect(isPersistablePublicQueryKey(['watchlist', 'library'])).toBe(true);
    expect(isPersistablePublicQueryKey(['watchlist', 'diary'])).toBe(true);
    expect(isPersistablePublicQueryKey(['watchlist', 'viewing-orders'])).toBe(true);
    expect(isPersistablePublicQueryKey(['watchlist', 'news', 'recent-episodes', 30])).toBe(true);
    expect(isPersistablePublicQueryKey(['watchlist', 'tmdb-details', 'movie', 123])).toBe(true);
    expect(isPersistablePublicQueryKey(['watchlist', 'film-universes'])).toBe(true);
    expect(isPersistablePublicQueryKey(['watchlist', 'discovery-person', 'director', 'Christopher Nolan'])).toBe(true);
  });

  it('rejects private, admin-only, signed-URL, and finance query keys', () => {
    expect(isPersistablePublicQueryKey(['finance', 'bank-sync-log'])).toBe(false);
    expect(isPersistablePublicQueryKey(['finance', 'truelayer-connection'])).toBe(false);
    expect(isPersistablePublicQueryKey(['finance', 'merchant-logos'])).toBe(false);
    expect(isPersistablePublicQueryKey(['beliefs', '*', undefined])).toBe(false);
    expect(isPersistablePublicQueryKey(['watchlist', 'ratings'])).toBe(false);
    expect(isPersistablePublicQueryKey(['watchlist', 'sync-log'])).toBe(false);
    expect(isPersistablePublicQueryKey(['watchlist', 'dismissed-suggestions'])).toBe(false);
    expect(isPersistablePublicQueryKey(['watchlist', 'not-seen'])).toBe(false);
    expect(isPersistablePublicQueryKey(['travel-journal', 'user-123', true])).toBe(false);
    expect(isPersistablePublicQueryKey(['travel-journal', 'public', true])).toBe(false);
    expect(isPersistablePublicQueryKey(['travel-photo', 'public', false, 'a.jpg'])).toBe(false);
    expect(isPersistablePublicQueryKey(['unknown-table'])).toBe(false);
  });
});

describe('buildPublicSnapshot & hydratePublicSnapshot', () => {
  it('persists only allowlisted public queries and hydrates them into a fresh client', () => {
    const now = 1_700_000_000_000;
    const source = new QueryClient();
    source.setQueryData(['books', '*'], [{ id: '1', title: 'Dune' }], { updatedAt: now });
    source.setQueryData(['beliefs', '*'], [{ id: 'secret' }], { updatedAt: now });
    source.setQueryData(['finance', 'bank-sync-log'], [{ id: 'tx' }], { updatedAt: now });
    source.setQueryData(['watchlist', 'ratings'], [{ id: 'r1' }], { updatedAt: now });

    const snapshot = buildPublicSnapshot(source, now);
    expect(snapshot.version).toBe(PUBLIC_CACHE_VERSION);
    expect(snapshot.state.queries.map((q) => q.queryKey)).toEqual([['books', '*']]);

    const target = new QueryClient();
    const restored = hydratePublicSnapshot(target, snapshot, now + 1_000);
    expect(restored).toBe(1);
    expect(target.getQueryData(['books', '*'])).toEqual([{ id: '1', title: 'Dune' }]);
    expect(target.getQueryData(['beliefs', '*'])).toBeUndefined();
  });

  it('ignores expired snapshots and never overwrites fresher in-memory data', () => {
    const now = 1_700_000_000_000;
    const source = new QueryClient();
    source.setQueryData(['books', '*'], [{ id: 'old' }], { updatedAt: now });
    const snapshot = buildPublicSnapshot(source, now);

    const expiredTarget = new QueryClient();
    expect(hydratePublicSnapshot(expiredTarget, snapshot, now + MAX_PERSISTED_AGE_MS + 1)).toBe(0);
    expect(expiredTarget.getQueryData(['books', '*'])).toBeUndefined();

    const fresherTarget = new QueryClient();
    fresherTarget.setQueryData(['books', '*'], [{ id: 'fresh' }], { updatedAt: now + 5_000 });
    expect(hydratePublicSnapshot(fresherTarget, snapshot, now + 6_000)).toBe(0);
    expect(fresherTarget.getQueryData(['books', '*'])).toEqual([{ id: 'fresh' }]);
  });
});
