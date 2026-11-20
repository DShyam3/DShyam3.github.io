import { describe, expect, it } from 'vitest';
import { findExistingTitle } from './existing-title';
import type { WatchlistItem } from './WatchlistContext';
import type { TMDBResult } from './useTMDB';

describe('findExistingTitle', () => {
  const items = [
    { id: '1', category: 'Movies', title: 'White Lines (2020)', tmdb_id: 10, created_at: '' },
    { id: '2', category: 'TV Shows', title: 'White Lines (2020)', tmdb_id: 10, created_at: '' },
    { id: '3', category: 'Movies', title: 'Older Film (1999)', created_at: '' },
  ] as WatchlistItem[];

  it('keeps a film and series with the same TMDB ID distinct', () => {
    expect(findExistingTitle(items, { id: 10, media_type: 'tv', name: 'White Lines' } as TMDBResult)?.id).toBe('2');
    expect(findExistingTitle(items, { id: 10, media_type: 'movie', title: 'White Lines' } as TMDBResult)?.id).toBe('1');
  });

  it('uses the add mutation’s exact title fallback when TMDB IDs differ or are absent', () => {
    expect(findExistingTitle(items, { id: 99, media_type: 'movie', title: 'Older Film', release_date: '1999-01-01' } as TMDBResult)?.id).toBe('3');
    expect(findExistingTitle(items, { id: 99, media_type: 'movie', title: 'White Lines', release_date: '2020-01-01' } as TMDBResult)?.id).toBe('1');
  });
});

