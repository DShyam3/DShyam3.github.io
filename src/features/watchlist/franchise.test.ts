import { describe, expect, it } from 'vitest';
import {
  buildOrderView,
  collectionPartsToEntries,
  collectionsFromLibrary,
  entryState,
  sortByRelease,
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
