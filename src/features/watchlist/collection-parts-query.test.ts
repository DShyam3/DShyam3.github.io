import { describe, expect, it, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
import { COLLECTION_PARTS_MAX_AGE_MS, collectionsFromPartRows, type CollectionPartRow } from './collection-parts-query';
import { collectionPartsToEntries } from './franchise';
import { collectionPartRows } from '../../../supabase/functions/_shared/collection-parts';

const NIGHT = '2026-11-22T03:00:00.000+00:00';
const NOW = Date.parse('2026-11-22T16:00:00Z');

const row = (collectionId: number, tmdbId: number, extra: Partial<CollectionPartRow> = {}): CollectionPartRow => ({
  collection_id: collectionId,
  tmdb_id: tmdbId,
  title: `Film ${tmdbId}`,
  release_date: '2001-01-01',
  poster_path: `/p${tmdbId}.jpg`,
  synced_at: NIGHT,
  ...extra,
});

describe('collectionsFromPartRows', () => {
  it('groups rows into the collection shape TMDB returns', () => {
    const collections = collectionsFromPartRows([row(10, 1), row(10, 2, { release_date: null, poster_path: null }), row(20, 3)], NOW);
    expect([...collections.keys()]).toEqual([10, 20]);
    expect(collections.get(10)).toEqual({
      id: 10,
      parts: [
        { id: 1, title: 'Film 1', release_date: '2001-01-01', poster_path: '/p1.jpg' },
        { id: 2, title: 'Film 2', release_date: null, poster_path: null },
      ],
    });
  });

  it('makes the same entries as the TMDB response it was stored from', () => {
    const tmdbParts = [
      { id: 2, title: 'Second', release_date: '2004-06-01', poster_path: '/b.jpg', overview: 'unused' },
      { id: 1, title: 'First', release_date: '2001-05-04', poster_path: '/a.jpg' },
      { id: 3, title: 'Announced', release_date: '', poster_path: null },
    ];
    const rows = [
      row(10, 1, { title: 'First', release_date: '2001-05-04', poster_path: '/a.jpg' }),
      row(10, 2, { title: 'Second', release_date: '2004-06-01', poster_path: '/b.jpg' }),
      row(10, 3, { title: 'Announced', release_date: null, poster_path: null }),
    ];
    const cached = collectionsFromPartRows(rows, NOW).get(10)!;
    for (const library of [new Set<number>(), new Set([3])]) {
      expect(collectionPartsToEntries(cached.parts!, 'https://img/', library)).toEqual(
        collectionPartsToEntries(tmdbParts, 'https://img/', library),
      );
    }
  });

  it('stores and reads back what TMDB returned as the same entries, end to end', () => {
    // As TMDB sends it; collectionPartRows is the cron's half, run here so a
    // change to either half's trimming shows up.
    const raw = [
      { id: 2, title: 'Second ', release_date: '2004-06-01', poster_path: '/b.jpg', overview: 'unused' },
      { id: 1, title: '  First', release_date: '2001-05-04', poster_path: '/a.jpg' },
      { id: 3, title: 'Announced', release_date: '', poster_path: null },
      { id: 4, title: 'Spaced date', release_date: ' 2010-02-03 ', poster_path: '' },
      { id: 5, title: 'No date at all' },
      { id: 6, title: '   ', release_date: '2012-01-01' },
      { id: 0, title: 'Bad id', release_date: '2012-01-01' },
      { id: 7, title: 'Same day', release_date: '2004-06-01', poster_path: '/c.jpg' },
    ];
    const stored = collectionPartRows(10, raw, NIGHT);
    expect(stored).not.toBeNull();
    const cached = collectionsFromPartRows(stored!, NOW).get(10)!;
    for (const library of [new Set<number>(), new Set([3]), new Set([3, 5])]) {
      expect(collectionPartsToEntries(cached.parts!, 'https://img/', library)).toEqual(
        collectionPartsToEntries(raw, 'https://img/', library),
      );
    }
  });

  it("reads only each collection's newest sync", () => {
    const collections = collectionsFromPartRows(
      [row(10, 1), row(10, 2, { synced_at: '2026-11-21T03:00:00.000+00:00' }), row(10, 3)],
      NOW,
    );
    expect(collections.get(10)?.parts?.map((part) => part.id)).toEqual([1, 3]);
  });

  it('leaves out a collection synced longer ago than the limit, so the walk asks TMDB', () => {
    const old = new Date(NOW - COLLECTION_PARTS_MAX_AGE_MS - 1).toISOString();
    const edge = new Date(NOW - COLLECTION_PARTS_MAX_AGE_MS).toISOString();
    const collections = collectionsFromPartRows([row(10, 1, { synced_at: old }), row(20, 2, { synced_at: edge })], NOW);
    expect(collections.has(10)).toBe(false);
    expect(collections.has(20)).toBe(true);
  });

  it('skips rows with an unreadable sync time', () => {
    const collections = collectionsFromPartRows([row(10, 1, { synced_at: 'not a time' }), row(20, 2)], NOW);
    expect([...collections.keys()]).toEqual([20]);
  });

  it('returns nothing for no rows', () => {
    expect(collectionsFromPartRows([], NOW).size).toBe(0);
  });
});
