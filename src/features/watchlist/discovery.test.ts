import { describe, expect, it } from 'vitest';
import { curateDiscovery, discoverySeeds, interleaveBySeed, interleaveUpcoming, type DiscoveryItem } from './discovery';
import type { FavouriteItem, WatchlistItem } from './WatchlistContext';

const makeWatchlistItem = (overrides: Partial<WatchlistItem>): WatchlistItem => ({
  id: '1',
  title: 'Example Title',
  category: 'Movies',
  created_at: '2026-01-01T00:00:00Z',
  ...overrides,
});

const makeFavourite = (overrides: Partial<FavouriteItem>): FavouriteItem => ({
  id: 'fav-1',
  title: 'Example Favourite',
  media_type: 'movie',
  created_at: '2026-01-01T00:00:00Z',
  category: 'Hollywood',
  facts: {},
  ...overrides,
});

const makeDiscoveryItem = (overrides: Partial<DiscoveryItem>): DiscoveryItem => ({
  id: 100,
  title: 'Discovered Title',
  poster_path: null,
  overview: '',
  media: 'movie',
  reason: 'Upcoming UK cinema release',
  kind: 'upcoming',
  ...overrides,
});

// Week zero: the weekly rotation offset is 0, so order is the ranking itself.
const weekZero = new Date(0);

describe('discoverySeeds', () => {
  it('takes turns between scores, favourites, recent watches and upcoming saves, then other saved titles', () => {
    const watchlist: WatchlistItem[] = [
      makeWatchlistItem({ id: '1', title: 'Good Show', category: 'TV Shows', tmdb_id: 20, personal_rating: 8 }),
      makeWatchlistItem({ id: '2', title: 'Great Movie', category: 'Movies', tmdb_id: 30, personal_rating: 9.5 }),
      makeWatchlistItem({ id: '3', title: 'Okay Movie', category: 'Movies', tmdb_id: 40, personal_rating: 6, watched: true, watched_at: '2026-11-01T00:00:00Z' }),
      makeWatchlistItem({ id: '4', title: 'Unrated Movie', category: 'Movies', tmdb_id: 50 }),
      makeWatchlistItem({ id: '5', title: 'Later Film', category: 'Movies', tmdb_id: 60, release_date: '2027-03-01' }),
      makeWatchlistItem({ id: '6', title: 'Sooner Film', category: 'Movies', tmdb_id: 70, release_date: '2026-12-01' }),
    ];
    const favourites: FavouriteItem[] = [
      makeFavourite({ id: 'f1', title: 'Old Fav', media_type: 'movie', tmdb_id: 10, created_at: '2025-01-01T00:00:00Z' }),
      makeFavourite({ id: 'f2', title: 'New Fav', media_type: 'tv', tmdb_id: 11, created_at: '2026-06-01T00:00:00Z' }),
    ];
    const today = new Date(2026, 10, 18, 12);
    const seeds = discoverySeeds(watchlist, favourites, today);
    // Fewer than 24 seeds all rotate weekly; compare as the cycle it is,
    // starting from the top score.
    const start = seeds.findIndex((seed) => seed.title === 'Great Movie');
    const cycle = [...seeds.slice(start), ...seeds.slice(0, start)];
    expect(cycle.map((seed) => seed.reason)).toEqual([
      'Because you rated Great Movie 9.5/10',
      'Because you favourited New Fav',
      'Because you watched Okay Movie',
      'Because you’re waiting for Sooner Film',
      'Because you rated Good Show 8/10',
      'Because you favourited Old Fav',
      'Because you’re waiting for Later Film',
      'Based on Unrated Movie in your library',
    ]);
  });

  it('no longer starts from the alphabetically first favourite', () => {
    const favourites: FavouriteItem[] = [
      makeFavourite({ id: 'f1', title: '21 Jump Street', tmdb_id: 1, created_at: '2024-01-01T00:00:00Z' }),
      makeFavourite({ id: 'f2', title: 'Zodiac', tmdb_id: 2, created_at: '2026-01-01T00:00:00Z' }),
    ];
    expect(discoverySeeds([], favourites, weekZero)[0].title).toBe('Zodiac');
  });

  it('rotates the strong seeds week to week and keeps every seed reachable', () => {
    const favourites = Array.from({ length: 10 }, (_, index) =>
      makeFavourite({ id: `f${index}`, title: `Fav ${index}`, tmdb_id: index + 1, created_at: `2026-01-${String(10 + index).padStart(2, '0')}T00:00:00Z` }),
    );
    const week = 7 * 24 * 60 * 60 * 1000;
    const first = discoverySeeds([], favourites, weekZero);
    const next = discoverySeeds([], favourites, new Date(week));
    expect(next[0]).not.toEqual(first[0]);
    expect(new Set(next.map((seed) => seed.id))).toEqual(new Set(first.map((seed) => seed.id)));
  });

  it('filters seeds by type', () => {
    const watchlist: WatchlistItem[] = [
      makeWatchlistItem({ id: '1', title: 'Film', category: 'Movies', tmdb_id: 1 }),
      makeWatchlistItem({ id: '2', title: 'Show', category: 'TV Shows', tmdb_id: 2 }),
    ];
    expect(discoverySeeds(watchlist, [], weekZero, 'tv').map((seed) => seed.title)).toEqual(['Show']);
    expect(discoverySeeds(watchlist, [], weekZero, 'movie').map((seed) => seed.title)).toEqual(['Film']);
  });

  it('excludes low-rated, hidden, and stopped-watching items even if favourited', () => {
    const watchlist: WatchlistItem[] = [
      makeWatchlistItem({ id: '1', title: 'Low Rated', category: 'Movies', tmdb_id: 11, personal_rating: 5.5 }),
      makeWatchlistItem({ id: '2', title: 'Hidden Show', category: 'TV Shows', tmdb_id: 12, library_state: 'hidden', personal_rating: 10 }),
      makeWatchlistItem({ id: '3', title: 'Stopped Show', category: 'TV Shows', tmdb_id: 13, library_state: 'stopped', personal_rating: 9 }),
      makeWatchlistItem({ id: '4', title: 'Active Show', category: 'TV Shows', tmdb_id: 14, personal_rating: 7 }),
    ];
    const favourites: FavouriteItem[] = [
      makeFavourite({ id: 'f1', title: 'Hidden Show', media_type: 'tv', tmdb_id: 12 }),
      makeFavourite({ id: 'f2', title: 'Low Rated', media_type: 'movie', tmdb_id: 11 }),
    ];

    expect(discoverySeeds(watchlist, favourites, weekZero)).toEqual([
      { id: 14, media: 'tv', title: 'Active Show', reason: 'Based on Active Show in your library' },
    ]);
  });

  it('keeps movie and TV seeds separate when TMDB IDs collide', () => {
    const watchlist: WatchlistItem[] = [
      makeWatchlistItem({ id: '1', title: 'Movie 42', category: 'Movies', tmdb_id: 42, personal_rating: 9 }),
      makeWatchlistItem({ id: '2', title: 'Series 42', category: 'TV Shows', tmdb_id: 42, personal_rating: 8.5 }),
    ];

    const seeds = discoverySeeds(watchlist, [], weekZero);
    expect(seeds).toHaveLength(2);
    expect(seeds.map((seed) => `${seed.media}:${seed.id}`)).toEqual(['movie:42', 'tv:42']);
  });
});

describe('interleaveBySeed', () => {
  it('takes one from each seed in turn so no single title fills the page', () => {
    const items = [
      makeDiscoveryItem({ id: 1, seedKey: 'a' }),
      makeDiscoveryItem({ id: 2, seedKey: 'a' }),
      makeDiscoveryItem({ id: 3, seedKey: 'a' }),
      makeDiscoveryItem({ id: 4, seedKey: 'b' }),
      makeDiscoveryItem({ id: 5, seedKey: 'c' }),
    ];
    expect(interleaveBySeed(items).map((item) => item.id)).toEqual([1, 4, 5, 2, 3]);
  });
});

describe('curateDiscovery', () => {
  it('excludes items already in watchlist, favourites, or dismissed while distinguishing movie and TV IDs', () => {
    const watchlist: WatchlistItem[] = [
      makeWatchlistItem({ id: '1', title: 'Saved Movie', category: 'Movies', tmdb_id: 500 }),
    ];
    const favourites: FavouriteItem[] = [
      makeFavourite({ id: 'f1', title: 'Saved Fav TV', media_type: 'tv', tmdb_id: 600 }),
    ];
    const dismissed = new Set(['movie:700']);

    const items: DiscoveryItem[] = [
      makeDiscoveryItem({ id: 500, media: 'movie', title: 'Saved Movie' }),
      makeDiscoveryItem({ id: 500, media: 'tv', name: 'TV With Same ID', title: undefined }),
      makeDiscoveryItem({ id: 600, media: 'tv', name: 'Saved Fav TV', title: undefined }),
      makeDiscoveryItem({ id: 700, media: 'movie', title: 'Dismissed Movie' }),
      makeDiscoveryItem({ id: 700, media: 'tv', name: 'Undismissed TV', title: undefined }),
      makeDiscoveryItem({ id: 800, media: 'movie', title: 'Fresh Movie' }),
      makeDiscoveryItem({ id: 800, media: 'movie', title: 'Duplicate Fresh Movie' }),
      makeDiscoveryItem({ id: 0, media: 'movie', title: 'Invalid ID' }),
      makeDiscoveryItem({ id: 900, media: 'movie', title: '' }),
    ];

    expect(curateDiscovery(items, watchlist, favourites, dismissed).map((item) => `${item.media}:${item.id}`)).toEqual([
      'tv:500',
      'tv:700',
      'movie:800',
    ]);
  });
});

describe('interleaveUpcoming', () => {
  it('shows films and series within the first twelve even with a full movie source', () => {
    const films = Array.from({ length: 20 }, (_, index) => makeDiscoveryItem({ id: index + 1, media: 'movie' }));
    const series = Array.from({ length: 8 }, (_, index) => makeDiscoveryItem({ id: index + 1, media: 'tv' }));
    const mixed = interleaveUpcoming([...films, ...series]);
    expect(mixed.slice(0, 12).map((item) => `${item.media}:${item.id}`)).toEqual([
      'movie:1', 'tv:1', 'movie:2', 'tv:2', 'movie:3', 'tv:3',
      'movie:4', 'tv:4', 'movie:5', 'tv:5', 'movie:6', 'tv:6',
    ]);
    expect(mixed.filter((item) => item.media === 'movie')).toEqual(films);
    expect(mixed.filter((item) => item.media === 'tv')).toEqual(series);
    expect(new Set(mixed.map((item) => `${item.media}:${item.id}`)).size).toBe(28);
  });

  it('fills remaining places from the longer source and handles one or no media types', () => {
    const films = [makeDiscoveryItem({ id: 1 }), makeDiscoveryItem({ id: 2 }), makeDiscoveryItem({ id: 3 })];
    const series = [makeDiscoveryItem({ id: 1, media: 'tv' })];
    expect(interleaveUpcoming([...films, ...series])).toEqual([films[0], series[0], films[1], films[2]]);
    expect(interleaveUpcoming(films)).toEqual(films);
    expect(interleaveUpcoming(series)).toEqual(series);
    expect(interleaveUpcoming([])).toEqual([]);
  });
});
