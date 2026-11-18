import { describe, expect, it } from 'vitest';
import { discoveryAddPayload, seriesStatus } from './discovery-add';
import { libraryShelf } from './library-state';
import type { DiscoveryItem } from './discovery';
import type { WatchlistItem } from './WatchlistContext';

type Detail = Parameters<typeof discoveryAddPayload>[1];
const detail = (overrides: Partial<Detail> = {}): Detail => ({
  title: 'A title',
  series_status: undefined,
  overview: 'A synopsis',
  poster: null,
  backdrop: null,
  release_date: '2020-01-01',
  release_year: 2020,
  runtime: null,
  genres: ['Drama'],
  tmdb_id: 42,
  platform: 'Online',
  trailer_key: undefined,
  directors: null,
  creators: null,
  top_cast: null,
  imdb_id: null,
  collection_id: null,
  collection_name: null,
  ...overrides,
// The detail type is a union (films carry a collection, series do not), and a
// spread over a Partial of it does not narrow back on its own.
} as Detail);
const suggestion = (media: 'movie' | 'tv'): DiscoveryItem => ({
  id: 42, media, title: 'Fallback', poster_path: null, overview: '',
  kind: 'recommendation', reason: 'Based on your library',
});

describe('seriesStatus', () => {
  it.each(['Ended', 'Returning Series', 'In Production', 'Canceled', 'Cancelled'] as const)('preserves supported TV status %s', (status) => {
    expect(seriesStatus('tv', status)).toBe(status);
  });

  it('rejects film states, unknown states and missing states', () => {
    expect(seriesStatus('movie', 'Ended')).toBeUndefined();
    expect(seriesStatus('tv', 'Released')).toBeUndefined();
    expect(seriesStatus('tv', 'Unknown')).toBeUndefined();
    expect(seriesStatus('tv', undefined)).toBeUndefined();
  });
});

describe('discoveryAddPayload', () => {
  it.each([
    ['Ended', 'Finished'],
    ['Returning Series', 'Up to date'],
    ['Canceled', 'Finished'],
  ] as const)('keeps a seen %s series on the %s shelf', (status, shelf) => {
    const payload = discoveryAddPayload(suggestion('tv'), detail({ series_status: seriesStatus('tv', status) }), true);
    expect(payload.watched).toBe(true);
    expect(payload.series_status).toBe(status);
    // The existing add flow marks released episodes from the watched flag.
    const saved: WatchlistItem = {
      ...payload, id: '7', created_at: '2026-01-01T00:00:00Z',
      seasons: [{ season_number: 1, episodes: [{ episode_number: 1, title: 'Finale', release_date: '2020-01-01', watched: payload.watched }] }],
    };
    expect(libraryShelf(saved, new Date(2026, 10, 18))).toBe(shelf);
  });

  it('preserves fetched credits for films and series on both add actions', () => {
    const credits = { directors: ['Director'], creators: ['Creator'], top_cast: ['Actor 1', 'Actor 2'] };
    for (const media of ['movie', 'tv'] as const) {
      for (const watched of [true, false]) {
        expect(discoveryAddPayload(suggestion(media), detail(credits), watched)).toMatchObject({ ...credits, watched, tmdb_id: 42 });
      }
    }
  });

  it('preserves known-empty credits while missing credits remain absent for backfill', () => {
    const empty = discoveryAddPayload(suggestion('movie'), detail({ directors: [], top_cast: [] }), false);
    expect(empty.directors).toEqual([]);
    expect(empty.top_cast).toEqual([]);
    const missing = discoveryAddPayload(suggestion('tv'), detail(), false);
    expect(missing.creators).toBeUndefined();
    expect(missing.top_cast).toBeUndefined();
    expect(missing.series_status).toBeUndefined();
  });
});
