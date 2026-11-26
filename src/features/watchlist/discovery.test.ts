import { describe, expect, it } from 'vitest';
import { LIKELY_SEEN_POOL_PAGES, LIKELY_SEEN_TOP_PAGES, admitWildcards, curateDiscovery, discoverySeeds, filmGroupsNeeded, franchiseUpcomingItems, interleaveBySeed, interleaveFreshBySeed, interleaveUpcoming, keepFirstSeenOrder, keepHeldInPlace, likelySeenConsensus, likelySeenLanguage, likelySeenTmdbPage, type DiscoveryItem } from './discovery';
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

  it('waits only for new titles; a series kept up with is watched, one with no date is saved', () => {
    const episodes = (next?: string) => [
      { title: 'Aired', episode_number: 1, watched: true, release_date: '2026-01-01' },
      ...(next ? [{ title: 'Next', episode_number: 2, release_date: next }] : []),
    ];
    const watchlist: WatchlistItem[] = [
      makeWatchlistItem({ id: '1', title: 'Returning Show', category: 'TV Shows', tmdb_id: 80, series_status: 'Returning Series', seasons: [{ season_number: 1, episodes: episodes('2026-12-01') }] }),
      makeWatchlistItem({ id: '2', title: 'Quiet Show', category: 'TV Shows', tmdb_id: 90, series_status: 'Returning Series', seasons: [{ season_number: 1, episodes: episodes() }] }),
      makeWatchlistItem({ id: '3', title: 'Next Season Show', category: 'TV Shows', tmdb_id: 95, seasons: [{ season_number: 1, episodes: episodes() }, { season_number: 2, episodes: [{ title: 'Out', episode_number: 1, release_date: '2026-06-01' }] }] }),
    ];
    const reasons = discoverySeeds(watchlist, [], new Date(2026, 10, 18, 12)).map((seed) => seed.reason);
    expect(reasons).not.toContain('Because you’re waiting for Returning Show');
    expect(reasons).toContain('Because you’re watching Returning Show');
    expect(reasons).toContain('Based on Quiet Show in your library');
    // Between seasons, on To watch, still counts as a show you are watching.
    expect(reasons).toContain('Because you’re watching Next Season Show');
    expect(reasons).not.toContain('Because you’re waiting for Quiet Show');
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

  it('prioritises franchise titles within seed signals regardless of release or watch date', () => {
    const watchlist: WatchlistItem[] = [
      makeWatchlistItem({ id: '1', title: 'Recent Solo', category: 'Movies', tmdb_id: 1, watched: true, watched_at: '2026-11-20T00:00:00Z', release_date: '2026-01-01' }),
      makeWatchlistItem({ id: '2', title: 'Older Franchise', category: 'Movies', tmdb_id: 2, watched: true, watched_at: '2020-01-01T00:00:00Z', release_date: '2009-05-01', collection_id: 86119 }),
    ];

    const seeds = discoverySeeds(watchlist, [], weekZero);
    expect(seeds.map((seed) => seed.title)).toEqual(['Older Franchise', 'Recent Solo']);
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

  it('caps each non-filler seed at MAX_SUGGESTIONS_PER_SEED while keeping filler uncapped', () => {
    const prolific = Array.from({ length: 6 }, (_, i) => makeDiscoveryItem({ id: i + 1, seedKey: 'tv:beef' }));
    const other = [makeDiscoveryItem({ id: 99, seedKey: 'tv:bb' })];
    const filler = Array.from({ length: 6 }, (_, i) => makeDiscoveryItem({ id: 200 + i, seedKey: 'filler:tv' }));

    const result = interleaveBySeed([...prolific, ...other]);
    expect(result.filter((i) => i.seedKey === 'tv:beef').map((i) => i.id)).toEqual([1, 2, 3, 4]);
    expect(result.filter((i) => i.seedKey === 'tv:bb')).toHaveLength(1);

    expect(interleaveBySeed(filler)).toHaveLength(6);
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
    expect(curateDiscovery(items, watchlist, favourites, dismissed, new Set(['movie:800'])).map((item) => `${item.media}:${item.id}`)).toEqual([
      'tv:500',
      'tv:700',
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

  it('keeps priority franchise upcoming items at the front before alternating general items, without breaking recommendations with shortReason', () => {
    const franchiseFilm = makeDiscoveryItem({ id: 90, media: 'movie', kind: 'upcoming', shortReason: 'In your franchise', reason: 'In your franchise · Johnny English Collection' });
    const franchiseShow = makeDiscoveryItem({ id: 91, media: 'tv', kind: 'upcoming', shortReason: 'In your franchise', reason: 'In your franchise · Example Universe' });
    const film = makeDiscoveryItem({ id: 1, media: 'movie', kind: 'upcoming' });
    const show = makeDiscoveryItem({ id: 2, media: 'tv', kind: 'upcoming' });
    expect(interleaveUpcoming([franchiseFilm, franchiseShow, film, show]).map((item) => `${item.media}:${item.id}`)).toEqual([
      'movie:90', 'tv:91', 'movie:1', 'tv:2',
    ]);
    // Recommendation items always carry shortReason and must still alternate movie/tv.
    const recMovie1 = makeDiscoveryItem({ id: 10, media: 'movie', kind: 'recommendation', shortReason: 'Widely watched' });
    const recMovie2 = makeDiscoveryItem({ id: 11, media: 'movie', kind: 'recommendation', shortReason: 'Widely watched' });
    const recTv1 = makeDiscoveryItem({ id: 20, media: 'tv', kind: 'recommendation', shortReason: 'Widely watched' });
    expect(interleaveUpcoming([recMovie1, recMovie2, recTv1]).map((item) => `${item.media}:${item.id}`)).toEqual([
      'movie:10', 'tv:20', 'movie:11',
    ]);
  });
});

describe('franchiseUpcomingItems', () => {
  it('turns dated future franchise instalments into priority Coming soon items sorted soonest first, ignoring past or undated ones', () => {
    const out = franchiseUpcomingItems(
      [
        {
          name: 'Johnny English Collection',
          entries: [
            { mediaType: 'movie', tmdbId: 1, title: 'Johnny English', releaseDate: '2003-04-11', posterPath: '/je1.jpg' },
            { mediaType: 'movie', tmdbId: 4, title: 'Johnny English 4', releaseDate: '2027-03-15', posterPath: '/je4.jpg' },
            { mediaType: 'movie', tmdbId: 5, title: 'Johnny English 5', releaseDate: null, posterPath: null },
          ],
        },
        {
          name: 'Dune Collection',
          entries: [
            { mediaType: 'movie', tmdbId: 10, title: 'Dune: Messiah', releaseDate: '2026-12-18', posterPath: '/dm.jpg' },
            // Duplicate of Johnny English 4 should be deduped.
            { mediaType: 'movie', tmdbId: 4, title: 'Johnny English 4', releaseDate: '2027-03-15', posterPath: '/je4.jpg' },
          ],
        },
      ],
      '2026-11-21',
    );
    expect(out.map((item) => item.id)).toEqual([10, 4]);
    expect(out[0]).toMatchObject({
      id: 10,
      media: 'movie',
      title: 'Dune: Messiah',
      release_date: '2026-12-18',
      poster_path: '/dm.jpg',
      kind: 'upcoming',
      shortReason: 'In your franchise',
      reason: 'In your franchise · Dune Collection',
    });
    expect(out[1]).toMatchObject({
      id: 4,
      reason: 'In your franchise · Johnny English Collection',
    });
  });
});

describe('likelySeenConsensus', () => {
  it('surfaces released titles recommended by 2+ independent library seeds and ignores future or single-seed items', () => {
    const today = new Date(2026, 10, 18);
    const items: DiscoveryItem[] = [
      makeDiscoveryItem({ id: 10, media: 'tv', name: 'The Sopranos', title: undefined, first_air_date: '1999-01-10', kind: 'recommendation', seedKey: 'tv:1', vote_count: 2500 }),
      makeDiscoveryItem({ id: 10, media: 'tv', name: 'The Sopranos', title: undefined, first_air_date: '1999-01-10', kind: 'recommendation', seedKey: 'tv:2', vote_count: 2500 }),
      makeDiscoveryItem({ id: 10, media: 'tv', name: 'The Sopranos', title: undefined, first_air_date: '1999-01-10', kind: 'recommendation', seedKey: 'tv:2', vote_count: 2500 }),
      makeDiscoveryItem({ id: 11, media: 'movie', title: 'Single Seed', release_date: '2020-01-01', kind: 'recommendation', seedKey: 'movie:1' }),
      makeDiscoveryItem({ id: 12, media: 'movie', title: 'Future Hit', release_date: '2027-01-01', kind: 'recommendation', seedKey: 'movie:1' }),
      makeDiscoveryItem({ id: 12, media: 'movie', title: 'Future Hit', release_date: '2027-01-01', kind: 'recommendation', seedKey: 'movie:2' }),
    ];

    const out = likelySeenConsensus(items, today, 2);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      id: 10,
      media: 'tv',
      shortReason: 'In 2 of your lists',
      reason: 'Recommended across 2 titles in your library',
    });
  });
});

describe('keepFirstSeenOrder', () => {
  const key = (item: { id: string }) => item.id;

  it('keeps titles already shown in place as new ones arrive', () => {
    const seen = new Map<string, number>();
    expect(keepFirstSeenOrder([{ id: 'b' }, { id: 'a' }], key, seen).map(key)).toEqual(['b', 'a']);
    // A later page ranks `c` first; it still goes after what was on screen.
    expect(keepFirstSeenOrder([{ id: 'c' }, { id: 'a' }, { id: 'b' }], key, seen).map(key)).toEqual(['b', 'a', 'c']);
  });

  it('closes the gap when a title leaves, and remembers it if it returns', () => {
    const seen = new Map<string, number>();
    keepFirstSeenOrder([{ id: 'a' }, { id: 'b' }, { id: 'c' }], key, seen);
    expect(keepFirstSeenOrder([{ id: 'c' }, { id: 'a' }], key, seen).map(key)).toEqual(['a', 'c']);
    expect(keepFirstSeenOrder([{ id: 'd' }, { id: 'b' }, { id: 'c' }], key, seen).map(key)).toEqual(['b', 'c', 'd']);
  });
});

describe('keepHeldInPlace', () => {
  const key = (item: { id: string }) => item.id;
  const ids = (...list: string[]) => list.map((id) => ({ id }));

  it('puts a held tile back where it was once its title leaves the list', () => {
    const held = [{ item: { id: 'b' }, after: ['a'] }];
    expect(keepHeldInPlace(ids('a', 'c', 'd'), held, key).map(key)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('does not double a held tile still in the list', () => {
    const held = [{ item: { id: 'b' }, after: ['a'] }];
    expect(keepHeldInPlace(ids('a', 'b', 'c'), held, key).map(key)).toEqual(['a', 'b', 'c']);
  });

  it('closes up before a held tile when a tile ahead of it goes', () => {
    // `c` was held after `a` and `b`; `b` has since gone.
    const held = [{ item: { id: 'c' }, after: ['a', 'b'] }];
    expect(keepHeldInPlace(ids('a', 'd', 'e'), held, key).map(key)).toEqual(['a', 'c', 'd', 'e']);
  });

  it('keeps one held tile after another', () => {
    const held = [{ item: { id: 'c' }, after: ['a', 'b'] }, { item: { id: 'b' }, after: ['a'] }];
    expect(keepHeldInPlace(ids('a', 'd'), held, key).map(key)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('puts a held tile first when nothing before it is still shown', () => {
    const held = [{ item: { id: 'z' }, after: ['x', 'y'] }];
    expect(keepHeldInPlace(ids('a', 'b'), held, key).map(key)).toEqual(['z', 'a', 'b']);
    expect(keepHeldInPlace([], held, key).map(key)).toEqual(['z']);
  });
});

describe('filmGroupsNeeded', () => {
  it('needs none for series only, and the whole target for films only', () => {
    expect(filmGroupsNeeded('tv', 6, 9)).toBe(0);
    expect(filmGroupsNeeded('movie', 6, 9)).toBe(6);
  });

  it('in All, fills what series leave and never drops below half', () => {
    expect(filmGroupsNeeded('all', 6, 0)).toBe(6);
    expect(filmGroupsNeeded('all', 6, 2)).toBe(4);
    expect(filmGroupsNeeded('all', 6, 9)).toBe(3);
    expect(filmGroupsNeeded('all', 12, 9)).toBe(6);
  });
});

describe('interleaveFreshBySeed', () => {
  const rec = (id: number, seedKey: string): DiscoveryItem => ({ id, title: `T${id}`, poster_path: null, overview: '', media: 'movie', reason: '', kind: 'recommendation', seedKey });

  it('removes known titles before each seed is capped at four', () => {
    const items = [1, 2, 3, 4, 5, 6].map((id) => rec(id, 'movie:100'));
    const known = new Set(['movie:1', 'movie:2', 'movie:3', 'movie:4']);
    expect(interleaveFreshBySeed(items, known).map((item) => item.id)).toEqual([5, 6]);
    // Capping first, as before, would have left nothing new.
    expect(interleaveBySeed(items).filter((item) => !known.has(`movie:${item.id}`))).toEqual([]);
  });

  it('still takes turns between seeds', () => {
    const items = [rec(1, 'movie:1'), rec(2, 'movie:1'), rec(3, 'movie:2'), rec(4, 'movie:2')];
    expect(interleaveFreshBySeed(items, new Set(['movie:1'])).map((item) => item.id)).toEqual([2, 3, 4]);
  });
});

describe('interleaveFreshBySeed with a score', () => {
  const item = (seedKey: string, id: number, fit: number): DiscoveryItem => ({
    id, title: `T${id}`, poster_path: null, overview: '', media: 'movie', reason: '', kind: 'recommendation', seedKey, vote_count: fit,
  });

  const fit = (entry: DiscoveryItem) => entry.vote_count ?? 0;

  it('lets each seed offer its best fits, keeping seeds’ turns and TMDB’s order on ties', () => {
    const items = [
      item('a', 1, 1), item('a', 2, 5), item('a', 3, 3), item('a', 4, 1), item('a', 5, 9),
      item('b', 6, 2), item('b', 7, 2),
    ];
    const picked = interleaveFreshBySeed(items, new Set(['movie:5']), fit);
    expect(picked.map((entry) => entry.id)).toEqual([2, 6, 3, 7, 1, 4]);
  });

  it('ranks before the cap of four, so a late best fit gets in', () => {
    // Six fresh titles; TMDB's sixth fits best and must displace one of its first four.
    const items = [1, 2, 3, 4, 5].map((id) => item('a', id, 1)).concat(item('a', 6, 9));
    expect(interleaveFreshBySeed(items, new Set(), fit).map((entry) => entry.id)).toEqual([6, 1, 2, 3]);
  });

  it('keeps seeds in their first-seen turns when their titles arrive mixed', () => {
    const items = [item('a', 1, 1), item('b', 2, 9), item('a', 3, 5)];
    expect(interleaveFreshBySeed(items, new Set(), fit).map((entry) => entry.id)).toEqual([3, 2, 1]);
  });

  it('reorders a filler seed too, without capping it', () => {
    const items = [1, 2, 3, 4, 5, 6].map((id) => item('filler:top', id, id));
    expect(interleaveFreshBySeed(items, new Set(), fit).map((entry) => entry.id)).toEqual([6, 5, 4, 3, 2, 1]);
  });
});


describe('wildcards on a page of suggestions', () => {
  const rec = (id: number, seedKey: string, extra: Partial<DiscoveryItem> = {}) =>
    makeDiscoveryItem({ id, kind: 'recommendation', seedKey, release_date: '2010-01-01', ...extra });
  const wild = (id: number) => rec(id, 'wildcard:movie', { wildcard: true, vote_count: 0 });

  it('takes two wildcards a page, each one more turn after the seeds', () => {
    const items = [
      ...[1, 2, 3, 4].map((id) => rec(id, 'movie:a')),
      ...[5, 6, 7, 8].map((id) => rec(id, 'movie:b')),
      ...[90, 91, 92, 93].map(wild),
    ];
    expect(interleaveBySeed(items).map((item) => item.id)).toEqual([1, 5, 90, 2, 6, 91, 3, 7, 4, 8]);
  });

  it('keeps TMDB’s order for wildcards when seeds are ranked by fit', () => {
    const items = [rec(1, 'movie:a', { vote_count: 1 }), rec(2, 'movie:a', { vote_count: 9 }), wild(90), { ...wild(91), vote_count: 50 }];
    const fit = (entry: DiscoveryItem) => entry.vote_count ?? 0;
    expect(interleaveFreshBySeed(items, new Set(), fit).map((item) => item.id)).toEqual([2, 90, 1, 91]);
  });

  it('never counts a wildcard as a seed agreeing on a title', () => {
    const items = [rec(10, 'movie:a'), { ...wild(10), seedKey: 'wildcard:movie' }];
    expect(likelySeenConsensus(items, new Date(2026, 10, 18), 2)).toEqual([]);
  });
});

describe('admitWildcards', () => {
  type Tile = { key: string; wildcard?: boolean };
  const keyOf = (tile: Tile) => tile.key;
  const others = (n: number, from = 0): Tile[] => Array.from({ length: n }, (_, i) => ({ key: `movie:${from + i}` }));
  const wild = (key: string): Tile => ({ key, wildcard: true });
  /** What keepFirstSeenOrder records once a list is shown. */
  const show = (tiles: Tile[], seen: Map<string, number>) => keepFirstSeenOrder(tiles, keyOf, seen);

  it('lets in one wildcard for every five other titles on screen, in the list’s order', () => {
    expect(admitWildcards([...others(4), wild('w1')], keyOf, new Map())).toHaveLength(4);
    const shown = admitWildcards([wild('w1'), ...others(10), wild('w2'), wild('w3')], keyOf, new Map());
    expect(shown.filter((tile) => tile.wildcard).map(keyOf)).toEqual(['w1', 'w2']);
  });

  it('keeps a wildcard once shown when other tiles are answered, and lets no new one in', () => {
    const seen = new Map<string, number>();
    expect(show(admitWildcards([...others(5), wild('w1')], keyOf, seen), seen).map(keyOf)).toContain('w1');
    // Four of the five are answered and leave the list.
    expect(admitWildcards([...others(1), wild('w1'), wild('w2')], keyOf, seen).map(keyOf)).toEqual(['movie:0', 'w1']);
  });

  it('does not let wildcards creep up as other tiles are answered page after page', () => {
    const seen = new Map<string, number>();
    let screen: Tile[] = [];
    for (let page = 0; page < 10; page++) {
      // Each page brings five new others and four wildcards; every other tile is answered.
      const pageTiles = [...others(5, page * 10), ...[0, 1, 2, 3].map((i) => wild(`w${page}-${i}`))];
      screen = show(admitWildcards([...screen, ...pageTiles], keyOf, seen), seen).filter((tile) => tile.wildcard);
    }
    expect(screen.filter((tile) => tile.wildcard)).toHaveLength(1);
  });

  it('keeps a title shown as a seed’s suggestion when it comes back as a wildcard', () => {
    const seen = new Map<string, number>();
    show(admitWildcards([...others(2), { key: 'x' }], keyOf, seen), seen);
    expect(admitWildcards([...others(2), wild('x')], keyOf, seen).map(keyOf)).toEqual(['movie:0', 'movie:1', 'x']);
  });
});

describe('likelySeenTmdbPage', () => {
  const walk = (week: number) => Array.from({ length: LIKELY_SEEN_POOL_PAGES }, (_, index) => likelySeenTmdbPage(index, week));

  it('reads every page of the pool once, whatever the week', () => {
    for (const week of [0, 1, 14, 15, 34, 35, 2930, -3]) {
      expect([...walk(week)].sort((a, b) => a - b)).toEqual(Array.from({ length: LIKELY_SEEN_POOL_PAGES }, (_, i) => i + 1));
    }
  });

  it('starts at the week\'s top page, then takes turns with the deeper pages', () => {
    const pages = walk(14);
    expect(pages[0]).toBe(15);
    expect(pages.slice(0, 6)).toEqual([15, 30, 1, 31, 2, 32]);
    for (let i = 0; i < 2 * LIKELY_SEEN_TOP_PAGES; i += 1) {
      if (i % 2 === 0) expect(pages[i]).toBeLessThanOrEqual(LIKELY_SEEN_TOP_PAGES);
      else expect(pages[i]).toBeGreaterThan(LIKELY_SEEN_TOP_PAGES);
    }
    expect(pages.slice(2 * LIKELY_SEEN_TOP_PAGES).every((page) => page > LIKELY_SEEN_TOP_PAGES)).toBe(true);
  });

  it('moves the top pages\' start on by one a week, as before', () => {
    expect(likelySeenTmdbPage(0, 0)).toBe(1);
    expect(likelySeenTmdbPage(0, 1)).toBe(2);
    expect(likelySeenTmdbPage(0, 15)).toBe(1);
  });
});

describe('likelySeenLanguage', () => {
  it('picks the strongest language other than English', () => {
    expect(likelySeenLanguage(new Map([['en', 0.9], ['hi', 0.05], ['ko', 0.04]]))).toBe('hi');
  });

  it('needs a few percent of the profile', () => {
    expect(likelySeenLanguage(new Map([['en', 0.98], ['hi', 0.02]]))).toBeNull();
    expect(likelySeenLanguage(new Map([['en', 0.97], ['hi', 0.03]]))).toBe('hi');
  });

  it('skips English, no language and languages turned away from', () => {
    expect(likelySeenLanguage(new Map([['en', 1]]))).toBeNull();
    expect(likelySeenLanguage(new Map([['en', 0.8], ['xx', 0.2]]))).toBeNull();
    expect(likelySeenLanguage(new Map([['en', 0.9], ['fr', -0.2]]))).toBeNull();
    expect(likelySeenLanguage(new Map())).toBeNull();
  });

  it('gives a tie to the earlier code, in any order', () => {
    expect(likelySeenLanguage(new Map([['ko', 0.05], ['ja', 0.05]]))).toBe('ja');
    expect(likelySeenLanguage(new Map([['ja', 0.05], ['ko', 0.05]]))).toBe('ja');
  });
});
