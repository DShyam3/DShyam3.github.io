import { describe, expect, it } from 'vitest';
import type { WatchlistItem } from './WatchlistContext';
import {
  buildImportPayload, buildLibraryIndex, chunk, classifyCandidates, filmsFromLetterboxd, importFromTrakt,
  matchFilm, matchShow, resolveVerdict, settle, summarisePlan, type Candidate, type ImportFilm, type ImportPlan, type ImportShowRef,
} from './import-match';
import { parseTraktFiles } from './trakt-import';

const film = (id: string, title: string, year: number, tmdb?: number): WatchlistItem => ({
  id, title: `${title} (${year})`, category: 'Movies', year, tmdb_id: tmdb, created_at: '',
});
const show = (id: string, title: string, year: number, tmdb: number | undefined, seasons: WatchlistItem['seasons'] = []): WatchlistItem => ({
  id, title, category: 'TV Shows', year, tmdb_id: tmdb, created_at: '', seasons,
});
const imported = (name: string, year: number | null, extra: Partial<ImportFilm> = {}): ImportFilm => ({
  key: `${name}|${year}`, name, year, tmdbId: null, watchedAt: null, rating: null, ...extra,
});
const cand = (id: number, title: string, year: number | null): Candidate => ({ id, title, year, poster: null });

describe('library matching', () => {
  const index = buildLibraryIndex([film('1', 'Amélie', 2001, 194), film('2', 'Fast & Furious', 2009), show('9', 'Dark', 2017, 70523)]);

  it('matches a stored "Title (Year)" against the bare title and year', () => {
    expect(matchFilm(imported('Amelie', 2001), index)).toMatchObject({ status: 'library', libraryId: '1' });
  });
  it('normalises accents and ampersands', () => {
    expect(matchFilm(imported('Fast and Furious', 2009), index)).toMatchObject({ libraryId: '2' });
  });
  it('requires the year to agree', () => {
    expect(matchFilm(imported('Amelie', 2002), index)).toBeNull();
  });
  it('prefers tmdb id over title', () => {
    expect(matchFilm(imported('Something else', 1999, { tmdbId: 194 }), index)).toMatchObject({ libraryId: '1' });
  });
  it('treats an unmatched Trakt film with an id as new, without a search', () => {
    expect(matchFilm(imported('Unknown', 2020, { tmdbId: 5 }), index)).toMatchObject({ status: 'new', tmdbId: 5, include: false });
  });
  it('does not let a title hit override a different TMDB id, but accepts one without an id', () => {
    const idx = buildLibraryIndex([film('1', 'Heat', 1995, 949), film('2', 'Plain', 2000)]);
    expect(matchFilm(imported('Heat', 1995, { tmdbId: 111 }), idx)).toMatchObject({ status: 'new', tmdbId: 111 });
    expect(matchFilm(imported('Heat', 1995), idx)).toMatchObject({ status: 'library', libraryId: '1', libraryTitle: 'Heat (1995)' });
    expect(matchFilm(imported('Plain', 2000, { tmdbId: 5 }), idx)).toMatchObject({ status: 'library', libraryId: '2' });
  });
  it('matches shows by id or title and year', () => {
    const ref = (tmdbId: number | null): ImportShowRef => ({ tmdbId, title: 'Dark', year: 2017 });
    expect(matchShow(ref(null), index)).toMatchObject({ libraryId: '9' });
    expect(matchShow(ref(70523), index)).toMatchObject({ libraryId: '9' });
    expect(matchShow(ref(1), index)).toMatchObject({ status: 'new', tmdbId: 1 });
    expect(matchShow({ tmdbId: 1, title: 'Other', year: 2000 }, index)).toMatchObject({ status: 'new' });
  });
});

describe('classifyCandidates', () => {
  it('is confident with exactly one equal title and year', () => {
    const result = classifyCandidates({ title: 'Heat', year: 1995 }, [cand(1, 'Heat', 1995), cand(2, 'Heat', 1986)]);
    expect(result).toMatchObject({ status: 'confident', match: { id: 1 } });
  });
  it('is unsure when two candidates tie', () => {
    expect(classifyCandidates({ title: 'Heat', year: 1995 }, [cand(1, 'Heat', 1995), cand(2, 'heat', 1995)]).status).toBe('unsure');
  });
  it('ranks same title, then year within one, then the rest, capped at 3', () => {
    const result = classifyCandidates({ title: 'Heat', year: 1995 }, [cand(1, 'Cold', 2000), cand(2, 'Hot', 1994), cand(3, 'Heat', 1986), cand(4, 'Warm', 1990)]);
    expect(result.status).toBe('unsure');
    if (result.status === 'unsure') expect(result.candidates.map(c => c.id)).toEqual([3, 2, 1]);
  });
  it('is missing without candidates', () => {
    expect(classifyCandidates({ title: 'x', year: null }, [])).toEqual({ status: 'missing' });
  });
});

describe('resolveVerdict', () => {
  const idx = buildLibraryIndex([film('1', 'Birdman', 2014, 194)]);
  it('resolves a confident hit already in the library to the library row', () => {
    const verdict = classifyCandidates({ title: 'Birdman or (The Unexpected Virtue of Ignorance)', year: 2014 }, [cand(194, 'Birdman or (The Unexpected Virtue of Ignorance)', 2014)]);
    expect(resolveVerdict(verdict, idx, 'Movies')).toMatchObject({ status: 'library', libraryId: '1', libraryTitle: 'Birdman (2014)' });
  });
  it('keeps a confident hit not in the library as new', () => {
    expect(resolveVerdict({ status: 'confident', match: cand(5, 'X', 2000) }, idx, 'Movies')).toMatchObject({ status: 'new', tmdbId: 5 });
  });
  it('marks unsure candidates in the library, and choosing one settles to that row', () => {
    const res = resolveVerdict({ status: 'unsure', candidates: [cand(194, 'Birdman', 2014), cand(7, 'Other', 2014)] }, idx, 'Movies');
    if (res.status !== 'unsure') throw new Error('expected unsure');
    expect(res.candidates.map(c => c.libraryId)).toEqual(['1', undefined]);
    expect(settle({ ...res, chosen: 194 })).toEqual({ kind: 'library', libraryId: '1' });
    expect(settle({ ...res, chosen: 7 })).toMatchObject({ kind: 'new', tmdbId: 7 });
  });
});

describe('chunk', () => {
  it('splits into batches of at most the size', () => {
    const parts = chunk(Array.from({ length: 2500 }, (_, i) => i));
    expect(parts.map(p => p.length)).toEqual([1000, 1000, 500]);
    expect(chunk([])).toEqual([]);
  });
});

describe('buildImportPayload', () => {
  const fresh = [
    film('1', 'Heat', 1995, 949),
    film('2', 'New One', 2020, 77),
    show('9', 'Dark', 2017, 70523, [{ id: 90, season_number: 1, episodes: [{ id: 901, episode_number: 1, title: '' }, { id: 902, episode_number: 2, title: '' }] }]),
  ];
  const dark: ImportShowRef = { tmdbId: 70523, title: 'Dark', year: 2017 };
  const plan: ImportPlan = {
    films: [
      { film: imported('Heat', 1995, { watchedAt: '2020-01-01T12:00:00.000Z', rating: 8 }), resolution: { status: 'library', libraryId: '1', include: true } },
      { film: imported('Undated', 2020, { tmdbId: 77 }), resolution: { status: 'new', tmdbId: 77, title: 'New One', year: 2020, poster: null, include: true } },
      { film: imported('Skipped', 2000), resolution: { status: 'library', libraryId: '1', include: false } },
      { film: imported('Vanished', 2001, { tmdbId: 5 }), resolution: { status: 'new', tmdbId: 5, title: 'V', year: 2001, poster: null, include: true } },
    ],
    shows: [{ ref: dark, resolution: { status: 'library', libraryId: '9', include: true } }],
    episodes: [
      { show: dark, season: 1, episode: 1, watchedAt: null },
      { show: dark, season: 1, episode: 7, watchedAt: null },
      { show: dark, season: 4, episode: 1, watchedAt: null },
    ],
    ratings: [{ kind: 'show', show: dark, rating: 9 }, { kind: 'season', show: dark, season: 1, rating: 7 }, { kind: 'season', show: dark, season: 5, rating: 6 }],
  };

  it('keeps only kept titles, preserves null dates and counts what is not found', () => {
    const payload = buildImportPayload(plan, fresh);
    expect(payload.p_movies).toEqual([
      { id: 1, watched_at: '2020-01-01T12:00:00.000Z', rating: 8 },
      { id: 2, watched_at: null, rating: null },
    ]);
    expect(payload.p_episodes).toEqual([{ id: 901, watched_at: null }]);
    expect(payload.p_shows).toEqual([{ id: 9, rating: 9 }]);
    expect(payload.p_seasons).toEqual([{ id: 90, rating: 7 }]);
    expect(payload.notFound).toEqual({ episodes: 2, films: 1, ratings: 1 });
  });

  it('summarises what will be saved', () => {
    expect(summarisePlan(plan)).toEqual({ films: 3, dated: 1, ratedOnly: 0, episodes: 3, ratings: 4, adds: 2 });
  });
});

describe('sources', () => {
  it('dates a Letterboxd film at local noon and keeps undated films null', () => {
    const [dated, undated] = filmsFromLetterboxd([
      { key: 'a|2000', name: 'A', year: 2000, watchedDates: ['2021-03-04'], firstWatched: '2021-03-04', rating: 6 },
      { key: 'b|2001', name: 'B', year: 2001, watchedDates: [], firstWatched: null, rating: null },
    ]);
    expect(new Date(dated.watchedAt ?? '').getHours()).toBe(12);
    expect(undated.watchedAt).toBeNull();
  });

  it('folds Trakt movie ratings into films and collects shows', () => {
    const result = parseTraktFiles([{ name: 'r.json', text: JSON.stringify([
      { type: 'movie', rating: 8, rated_at: '2022-01-01T00:00:00Z', movie: { title: 'Heat', year: 1995, ids: { tmdb: 949 } } },
      { movie: { title: 'Heat', year: 1995, ids: { tmdb: 949 } }, watched_at: '2021-01-01T00:00:00Z' },
      { show: { title: 'Dark', year: 2017, ids: { tmdb: 70523 } }, episode: { season: 1, number: 1 }, watched_at: '2021-01-01T00:00:00Z' },
    ]) }]);
    const out = importFromTrakt(result);
    expect(out.films).toHaveLength(1);
    expect(out.films[0]).toMatchObject({ tmdbId: 949, rating: 8, watchedAt: '2021-01-01T00:00:00.000Z' });
    expect(out.films[0].ratedOnly).toBeUndefined();
    expect(out.shows).toHaveLength(1);
    expect(out.episodes).toHaveLength(1);
  });

  it('flags a Trakt film rated without any history', () => {
    const out = importFromTrakt(parseTraktFiles([{ name: 'r.json', text: JSON.stringify([
      { type: 'movie', rating: 8, rated_at: '2022-01-01T00:00:00Z', movie: { title: 'Heat', year: 1995, ids: { tmdb: 949 } } },
    ]) }]));
    expect(out.films[0]).toMatchObject({ ratedOnly: true, watchedAt: null, rating: 8 });
  });
});
