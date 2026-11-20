import { describe, expect, it } from 'vitest';
import type { WatchlistItem } from './WatchlistContext';
import {
  buildOrderView,
  collectionPartsToEntries,
  collectionsFromLibrary,
  customFranchisesFromLibrary,
  entryState,
  hasWatchGap,
  libraryLookup,
  sortByRelease,
  tvFranchisesFromLinks,
  type LibraryLookup,
  type OrderEntryInput,
} from './franchise';

const entry = (over: Partial<OrderEntryInput>): OrderEntryInput => ({
  key: 'k', mediaType: 'movie', tmdbId: 1, title: 'T', releaseDate: null, poster: null, ...over,
});

const library: LibraryLookup = {
  movies: new Map([
    [1, { id: 'm1', watched: true }],
    [2, { id: 'm2', watched: false }],
  ]),
  shows: new Map([
    [10, { id: 's10', airedEpisodes: 8, watchedEpisodes: 8 }],
    [11, { id: 's11', airedEpisodes: 8, watchedEpisodes: 3 }],
    [12, { id: 's12', airedEpisodes: 8, watchedEpisodes: 0 }],
    [13, { id: 's13', airedEpisodes: 0, watchedEpisodes: 0 }],
  ]),
};

describe('entryState', () => {
  it('handles movies', () => {
    expect(entryState(entry({ tmdbId: 1 }), library)).toEqual({ state: 'watched', libraryId: 'm1', progress: null });
    expect(entryState(entry({ tmdbId: 2 }), library)).toEqual({ state: 'unwatched', libraryId: 'm2', progress: null });
    expect(entryState(entry({ tmdbId: 3 }), library)).toEqual({ state: 'not-in-library', libraryId: null, progress: null });
  });
  it('handles shows', () => {
    const tv = (tmdbId: number) => entryState(entry({ mediaType: 'tv', tmdbId }), library);
    expect(tv(10)).toEqual({ state: 'watched', libraryId: 's10', progress: { watched: 8, aired: 8 } });
    expect(tv(11).state).toBe('in-progress');
    expect(tv(12).state).toBe('unwatched');
    expect(tv(13)).toEqual({ state: 'unwatched', libraryId: 's13', progress: { watched: 0, aired: 0 } });
    expect(tv(99)).toEqual({ state: 'not-in-library', libraryId: null, progress: null });
  });
  it('does not mix movie and show ids', () => {
    expect(entryState(entry({ mediaType: 'tv', tmdbId: 1 }), library).state).toBe('not-in-library');
  });
});

describe('buildOrderView', () => {
  it('keeps order, counts, and skips watched for nextUp', () => {
    const view = buildOrderView(
      [entry({ key: 'a', tmdbId: 1 }), entry({ key: 'b', tmdbId: 3 }), entry({ key: 'c', tmdbId: 2 })],
      library,
    );
    expect(view.entries.map((e) => e.key)).toEqual(['a', 'b', 'c']);
    expect(view).toMatchObject({ total: 3, watched: 1, inLibrary: 2 });
    expect(view.nextUp?.key).toBe('b');
  });
  it('has no nextUp when all are watched or empty', () => {
    expect(buildOrderView([entry({ tmdbId: 1 })], library).nextUp).toBeNull();
    expect(buildOrderView([], library)).toMatchObject({ total: 0, nextUp: null });
  });
});

describe('sortByRelease', () => {
  it('sorts by date, undated last, then title, without mutating', () => {
    const input = [
      { title: 'Z', releaseDate: null },
      { title: 'B', releaseDate: '2020-01-01' },
      { title: 'A', releaseDate: '2020-01-01' },
      { title: 'C', releaseDate: '2019-05-05' },
      { title: 'A undated', releaseDate: null },
    ];
    const copy = [...input];
    expect(sortByRelease(input).map((i) => i.title)).toEqual(['C', 'A', 'B', 'A undated', 'Z']);
    expect(input).toEqual(copy);
  });
});

const film = (over: Partial<Parameters<typeof collectionsFromLibrary>[0][number]>) => ({
  id: 'x', tmdbId: 1, title: 'T', watched: false, releaseDate: null, poster: null,
  collectionId: null, collectionName: null, ...over,
});

describe('collectionsFromLibrary', () => {
  it('groups, skips unusable films, sorts films and groups', () => {
    const out = collectionsFromLibrary([
      film({ id: 'a', tmdbId: 1, title: 'Two', watched: true, releaseDate: '2005-01-01', collectionId: 5, collectionName: 'Zeta Collection' }),
      film({ id: 'b', tmdbId: 2, title: 'One', watched: false, releaseDate: '2001-01-01', collectionId: 5, collectionName: 'Zeta Collection' }),
      film({ id: 'c', tmdbId: 3, title: 'Solo', collectionId: 2, collectionName: 'Alpha' }),
      film({ id: 'd', tmdbId: null, collectionId: 5 }),
      film({ id: 'e', tmdbId: 4, collectionId: null }),
    ]);
    expect(out.map((c) => c.name)).toEqual(['Alpha', 'Zeta Collection']);
    expect(out[1].films.map((f) => f.id)).toEqual(['b', 'a']);
    expect(out[1].watched).toBe(1);
  });
  it('names from the first non-empty name, else a fallback', () => {
    const out = collectionsFromLibrary([
      film({ tmdbId: 1, collectionId: 7, collectionName: null }),
      film({ tmdbId: 2, collectionId: 7, collectionName: 'Found' }),
      film({ tmdbId: 3, collectionId: 8, collectionName: null }),
    ]);
    expect(out.find((c) => c.collectionId === 7)?.name).toBe('Found');
    expect(out.find((c) => c.collectionId === 8)?.name).toBe('Collection 8');
  });
});

describe('collectionPartsToEntries', () => {
  it('filters, dedupes, normalises and sorts', () => {
    const out = collectionPartsToEntries(
      [
        { id: 3, title: 'Late', release_date: '2010-01-01', poster_path: '/l.jpg' },
        { id: 1, title: 'Early', release_date: '2000-01-01', poster_path: null },
        { id: 2, title: 'Undated', release_date: '', poster_path: '/u.jpg' },
        { id: 1, title: 'Early dup', release_date: '2000-01-01' },
        { title: 'No id' },
        { id: 0, title: 'Zero' },
        { id: 1.5, title: 'Frac' },
        { id: 4, title: '  ' },
        { id: 5 },
      ],
      'https://img/',
    );
    expect(out.map((e) => e.key)).toEqual(['movie:1', 'movie:3', 'movie:2']);
    expect(out[0]).toMatchObject({ mediaType: 'movie', tmdbId: 1, title: 'Early', poster: null });
    expect(out[1].poster).toBe('https://img//l.jpg');
    expect(out[2]).toMatchObject({ releaseDate: null, poster: 'https://img//u.jpg' });
  });
});

describe('libraryLookup', () => {
  const today = new Date(2026, 5, 15, 18, 30);
  const ep = (n: number, release_date: string | undefined, watched = false) => ({
    episode_number: n, title: '', release_date, watched,
  });
  const show = {
    id: 's1', category: 'TV Shows', tmdb_id: 50, title: 'Show',
    seasons: [
      { season_number: 0, episodes: [ep(1, '2020-01-01', true)] },
      {
        season_number: 1,
        episodes: [
          ep(1, '2026-06-01', true),
          ep(2, '2026-06-15', false),
          ep(3, '2026-06-16', true),
          ep(4, undefined, true),
        ],
      },
    ],
  } as unknown as WatchlistItem;
  const movie = { id: 'm1', category: 'Movies', tmdb_id: 7, watched: true, title: 'Film' } as unknown as WatchlistItem;
  const noId = { id: 'x', category: 'Movies', tmdb_id: null, title: 'No id' } as unknown as WatchlistItem;

  it('maps films by TMDB id and skips items without one', () => {
    const lookup = libraryLookup([movie, noId], today);
    expect(lookup.movies.get(7)).toEqual({ id: 'm1', watched: true });
    expect(lookup.movies.size).toBe(1);
  });

  it('counts aired episodes up to and including today, skipping specials and undated ones', () => {
    expect(libraryLookup([show], today).shows.get(50)).toEqual({ id: 's1', airedEpisodes: 2, watchedEpisodes: 1 });
  });
});

describe('tvFranchisesFromLinks', () => {
  it('groups transitive spin-offs (e.g. TBBT -> Young Sheldon -> Georgie & Mandy), sorts chronologically, and uses library metadata', () => {
    const watchlist = [
      { id: '1', category: 'TV Shows', tmdb_id: 1418, title: 'The Big Bang Theory (2007)', release_date: '2007-09-24', image_url: '/tbbt.jpg' },
      { id: '2', category: 'TV Shows', tmdb_id: 71728, title: 'Young Sheldon (2017)', release_date: '2017-09-25', image_url: '/ys.jpg' },
    ] as unknown as WatchlistItem[];

    const groups = tvFranchisesFromLinks(
      [
        {
          seedTmdbId: 1418,
          seedTitle: 'The Big Bang Theory',
          franchiseId: 'Q141934409',
          franchiseName: 'The Big Bang Theory',
          relatedMediaType: 'tv',
          relatedTmdbId: 71728,
          relatedTitle: 'Young Sheldon',
          releaseDate: '2017-09-25',
        },
        {
          seedTmdbId: 71728,
          seedTitle: 'Young Sheldon',
          franchiseId: 'Q141934409',
          franchiseName: 'The Big Bang Theory',
          relatedMediaType: 'tv',
          relatedTmdbId: 243875,
          relatedTitle: "Georgie & Mandy's First Marriage",
          releaseDate: '2024-10-17',
          posterPath: '/gm.jpg',
        },
      ],
      watchlist,
      'https://img/',
    );

    expect(groups).toHaveLength(1);
    expect(groups[0].name).toBe('The Big Bang Theory Universe');
    expect(groups[0].entries.map((e) => e.key)).toEqual(['tv:1418', 'tv:71728', 'tv:243875']);
    expect(groups[0].entries[0]).toMatchObject({ title: 'The Big Bang Theory', poster: '/tbbt.jpg' });
    expect(groups[0].entries[2]).toMatchObject({
      title: "Georgie & Mandy's First Marriage",
      releaseDate: '2024-10-17',
      poster: 'https://img//gm.jpg',
    });
  });

  it('ignores same-title international remakes when no shared franchise name exists', () => {
    const groups = tvFranchisesFromLinks(
      [
        {
          seedTmdbId: 34307,
          seedTitle: 'Shameless',
          franchiseId: null,
          franchiseName: null,
          relatedMediaType: 'tv',
          relatedTmdbId: 1906,
          relatedTitle: 'Shameless',
          releaseDate: '2004-01-13',
        },
      ],
      [],
    );
    expect(groups).toEqual([]);
  });
});

describe('hasWatchGap', () => {
  it('detects missing or unwatched earlier entries when a later entry is watched', () => {
    const gapView = buildOrderView(
      [entry({ key: 'a', tmdbId: 1 }), entry({ key: 'b', tmdbId: 3 }), entry({ key: 'c', tmdbId: 100 })],
      {
        movies: new Map([
          [1, { id: 'm1', watched: true }],
          [100, { id: 'm3', watched: true }],
        ]),
        shows: new Map(),
      },
    );
    expect(hasWatchGap(gapView)).toBe(true);

    const noGapView = buildOrderView(
      [entry({ key: 'a', tmdbId: 1 }), entry({ key: 'b', tmdbId: 3 })],
      {
        movies: new Map([[1, { id: 'm1', watched: true }]]),
        shows: new Map(),
      },
    );
    expect(hasWatchGap(noGapView)).toBe(false);
  });
});

describe('customFranchisesFromLibrary', () => {
  it('groups movies and TV shows by their stored franchise name in release order', () => {
    const items: WatchlistItem[] = [
      {
        id: '1',
        title: 'Tulsa King',
        category: 'TV Shows',
        tmdb_id: 101,
        release_date: '2022-11-13',
        franchise: 'Sheridan Universe',
        created_at: '2022-11-13T00:00:00Z',
        seasons: [{ id: 1, season_number: 1, episodes: [{ id: 1, episode_number: 1, title: 'Ep 1', watched: true }] }],
      },
      {
        id: '2',
        title: 'Wind River',
        category: 'Movies',
        tmdb_id: 202,
        release_date: '2017-08-04',
        watched: true,
        franchise: 'Sheridan Universe',
        created_at: '2017-08-04T00:00:00Z',
      },
      {
        id: '3',
        title: 'Hidden Entry',
        category: 'Movies',
        tmdb_id: 303,
        library_state: 'hidden',
        franchise: 'Sheridan Universe',
        created_at: '2020-01-01T00:00:00Z',
      },
    ];

    const groups = customFranchisesFromLibrary(items, libraryLookup(items, new Date('2026-11-20T00:00:00Z')));
    expect(groups).toHaveLength(1);
    expect(groups[0].name).toBe('Sheridan Universe');
    expect(groups[0].view.entries.map((e) => e.title)).toEqual(['Wind River', 'Tulsa King']);
  });
});
