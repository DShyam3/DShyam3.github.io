import { describe, expect, it } from 'vitest';
import type { WatchRecord } from './diary';
import { buildYearReview, yearsWithData, type RatedThing } from './year-review';

const UTC = 'UTC';
const London = 'Europe/London';

let nextId = 1;
const ep = (
  titleId: string,
  seasonNumber: number,
  episodeNumber: number,
  watchedAt: string | null,
  runtime: number | null = 40,
  extra: Partial<WatchRecord> = {},
): WatchRecord => ({
  kind: 'episode',
  id: nextId++,
  watchedAt,
  runtime,
  titleId,
  title: titleId.toUpperCase(),
  poster: null,
  seasonNumber,
  episodeNumber,
  genres: [],
  platform: null,
  ...extra,
});

const film = (
  titleId: string,
  watchedAt: string | null,
  runtime: number | null = 100,
  extra: Partial<WatchRecord> = {},
): WatchRecord => ({
  kind: 'movie',
  id: nextId++,
  watchedAt,
  runtime,
  titleId,
  title: titleId.toUpperCase(),
  poster: null,
  genres: [],
  platform: null,
  ...extra,
});

const review = (records: WatchRecord[], year = 2026, ratings: RatedThing[] = [], timeZone = UTC) =>
  buildYearReview({ records, ratings, year, timeZone });

describe('yearsWithData', () => {
  it('lists years descending from dated records only', () => {
    const years = yearsWithData(
      [
        film('a', '2024-05-01T10:00:00Z'),
        film('b', '2026-05-01T10:00:00Z'),
        film('c', '2025-05-01T10:00:00Z'),
        film('d', '2026-06-01T10:00:00Z'),
        film('e', null),
      ],
      UTC,
    );
    expect(years).toEqual([2026, 2025, 2024]);
  });

  it('uses the local year at the new-year boundary', () => {
    const records = [film('a', '2025-12-31T23:30:00Z')];
    expect(yearsWithData(records, 'America/Los_Angeles')).toEqual([2025]);
    expect(yearsWithData(records, 'Pacific/Auckland')).toEqual([2026]);
  });

  it('is empty for no records', () => {
    expect(yearsWithData([])).toEqual([]);
  });
});

describe('buildYearReview', () => {
  it('gives zeros, nulls and 12 months for empty input', () => {
    const r = review([]);
    expect(r.totals).toEqual({
      minutes: 0,
      episodes: 0,
      episodeMinutes: 0,
      films: 0,
      filmMinutes: 0,
      shows: 0,
      days: 0,
      unknownRuntime: 0,
    });
    expect(r.months).toHaveLength(12);
    expect(r.months.map((m) => m.month)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(r.topShows).toEqual([]);
    expect(r.genres).toEqual([]);
    expect(r.platforms).toEqual([]);
    expect(r.busiestDay).toBeNull();
    expect(r.longestStreak).toBeNull();
    expect(r.topRatedFilms).toEqual([]);
    expect(r.topRatedSeasons).toEqual([]);
    expect(r.undated).toBe(0);
  });

  it('excludes undated records from totals and counts them across years', () => {
    const r = review([film('a', null), ep('s', 1, 1, null), film('b', '2026-02-01T10:00:00Z')]);
    expect(r.undated).toBe(2);
    expect(r.totals.films).toBe(1);
    expect(r.totals.episodes).toBe(0);
    expect(r.totals.minutes).toBe(100);
  });

  it('counts null runtime as 0 minutes and unknown', () => {
    const r = review([film('a', '2026-02-01T10:00:00Z', null), ep('s', 1, 1, '2026-02-01T11:00:00Z', 45)]);
    expect(r.totals.minutes).toBe(45);
    expect(r.totals.unknownRuntime).toBe(1);
    expect(r.totals.films).toBe(1);
  });

  it('totals episodes, films, shows, days and months', () => {
    const r = review([
      ep('s', 1, 1, '2026-01-10T10:00:00Z', 40),
      ep('s', 1, 2, '2026-01-10T11:00:00Z', 40),
      ep('t', 1, 1, '2026-03-02T10:00:00Z', 30),
      film('f', '2026-03-02T20:00:00Z', 120),
      film('old', '2025-03-02T20:00:00Z', 90),
    ]);
    expect(r.totals).toEqual({
      minutes: 230,
      episodes: 3,
      episodeMinutes: 110,
      films: 1,
      filmMinutes: 120,
      shows: 2,
      days: 2,
      unknownRuntime: 0,
    });
    expect(r.months[0]).toEqual({ month: 1, minutes: 80, episodes: 2, films: 0 });
    expect(r.months[2]).toEqual({ month: 3, minutes: 150, episodes: 1, films: 1 });
    expect(r.months[1].minutes).toBe(0);
  });

  it('uses the local day for year membership', () => {
    const records = [film('a', '2025-12-31T23:30:00Z')];
    expect(review(records, 2025, [], London).totals.films).toBe(1);
    expect(review(records, 2026, [], 'Pacific/Auckland').totals.films).toBe(1);
    expect(review(records, 2025, [], 'Pacific/Auckland').totals.films).toBe(0);
  });

  it('puts a late-evening UK watch on the right local day across BST', () => {
    const r = review([film('a', '2026-06-30T23:30:00Z', 100)], 2026, [], London);
    expect(r.busiestDay).toEqual({ day: '2026-07-01', minutes: 100, records: 1 });
    expect(r.months[6].films).toBe(1);
    expect(r.months[5].films).toBe(0);
  });

  it('ranks top shows by minutes, episodes, then title', () => {
    const records = [
      ep('b', 1, 1, '2026-01-01T10:00:00Z', 50),
      ep('a', 1, 1, '2026-01-02T10:00:00Z', 50),
      ep('c', 1, 1, '2026-01-03T10:00:00Z', 25),
      ep('c', 1, 2, '2026-01-03T11:00:00Z', 25),
      ep('d', 1, 1, '2026-01-04T10:00:00Z', 90),
      ep('e', 1, 1, '2026-01-05T10:00:00Z', 1),
      ep('f', 1, 1, '2026-01-06T10:00:00Z', 2),
      ep('g', 1, 1, '2026-01-07T10:00:00Z', 3),
    ];
    const top = review(records).topShows;
    expect(top.map((s) => s.titleId)).toEqual(['d', 'c', 'a', 'b', 'g']);
    expect(top[1]).toMatchObject({ episodes: 2, minutes: 50 });
  });

  it('splits minutes equally across genres and shares sum to 1', () => {
    const r = review([
      film('a', '2026-01-01T10:00:00Z', 90, { genres: ['Drama', 'Comedy', 'Drama'] }),
      film('b', '2026-01-02T10:00:00Z', 60, { genres: [] }),
    ]);
    // Drama and Comedy 45 each, Unknown 60.
    expect(r.genres.map((g) => [g.genre, g.minutes])).toEqual([
      ['Unknown', 60],
      ['Comedy', 45],
      ['Drama', 45],
    ]);
    expect(r.genres.reduce((s, g) => s + g.share, 0)).toBeCloseTo(1, 10);
    expect(r.genres[0].share).toBeCloseTo(60 / 150, 10);
  });

  it('keeps the top 6 genres', () => {
    const genres = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
    const r = review([film('a', '2026-01-01T10:00:00Z', 70, { genres })]);
    expect(r.genres).toHaveLength(6);
  });

  it('gives share 0 when total minutes is 0', () => {
    const r = review([film('a', '2026-01-01T10:00:00Z', null, { genres: ['Drama'] })]);
    expect(r.genres).toEqual([{ genre: 'Drama', minutes: 0, share: 0 }]);
  });

  it('totals platforms with Unknown for null', () => {
    const r = review([
      film('a', '2026-01-01T10:00:00Z', 100, { platform: 'Netflix' }),
      film('b', '2026-01-02T10:00:00Z', 100, { platform: 'Apple TV' }),
      film('c', '2026-01-03T10:00:00Z', 30),
    ]);
    expect(r.platforms).toEqual([
      { platform: 'Apple TV', minutes: 100 },
      { platform: 'Netflix', minutes: 100 },
      { platform: 'Unknown', minutes: 30 },
    ]);
  });

  it('breaks a busiest-day tie by the earliest day', () => {
    const r = review([
      film('a', '2026-05-09T10:00:00Z', 100),
      film('b', '2026-05-03T10:00:00Z', 100),
      film('c', '2026-05-20T10:00:00Z', 50),
    ]);
    expect(r.busiestDay).toEqual({ day: '2026-05-03', minutes: 100, records: 1 });
  });

  it('finds a streak across a month boundary', () => {
    const r = review([
      film('a', '2026-01-30T10:00:00Z'),
      film('b', '2026-01-31T10:00:00Z'),
      film('c', '2026-02-01T10:00:00Z'),
      film('d', '2026-02-02T10:00:00Z'),
      film('e', '2026-02-10T10:00:00Z'),
      film('f', '2026-02-11T10:00:00Z'),
    ]);
    expect(r.longestStreak).toEqual({ days: 4, start: '2026-01-30', end: '2026-02-02' });
  });

  it('breaks a streak tie by the earliest and counts a lone day', () => {
    const r = review([
      film('a', '2026-03-10T10:00:00Z'),
      film('b', '2026-03-11T10:00:00Z'),
      film('c', '2026-03-20T10:00:00Z'),
      film('d', '2026-03-21T10:00:00Z'),
    ]);
    expect(r.longestStreak).toEqual({ days: 2, start: '2026-03-10', end: '2026-03-11' });
    expect(review([film('a', '2026-03-10T10:00:00Z')]).longestStreak).toEqual({
      days: 1,
      start: '2026-03-10',
      end: '2026-03-10',
    });
  });

  it('counts a streak across the BST clock change', () => {
    const r = review(
      [film('a', '2026-03-28T12:00:00Z'), film('b', '2026-03-29T12:00:00Z'), film('c', '2026-03-30T12:00:00Z')],
      2026,
      [],
      London,
    );
    expect(r.longestStreak?.days).toBe(3);
  });

  it('filters top-rated films and seasons by watched year', () => {
    const rating = (
      kind: RatedThing['kind'],
      titleId: string,
      rate: number,
      seasonNumber?: number,
    ): RatedThing => ({ kind, titleId, title: titleId.toUpperCase(), poster: null, seasonNumber, rating: rate });
    const records = [
      film('f1', '2026-02-01T10:00:00Z'),
      film('f2', '2026-02-02T10:00:00Z'),
      film('f3', '2025-02-02T10:00:00Z'),
      film('f4', null),
      ep('s1', 2, 1, '2026-04-01T10:00:00Z'),
      ep('s2', 1, 1, '2025-04-01T10:00:00Z'),
    ];
    const ratings = [
      rating('movie', 'f1', 8),
      rating('movie', 'f2', 8),
      rating('movie', 'f3', 10),
      rating('movie', 'f4', 10),
      rating('movie', 'f5', 10),
      rating('show', 's1', 10),
      rating('season', 's1', 9, 2),
      rating('season', 's1', 10, 1),
      rating('season', 's2', 7, 1),
    ];
    const r = review(records, 2026, ratings);
    expect(r.topRatedFilms.map((x) => x.titleId)).toEqual(['f1', 'f2']);
    expect(r.topRatedSeasons.map((x) => [x.titleId, x.seasonNumber])).toEqual([['s1', 2]]);
  });

  it('caps top-rated lists at 5', () => {
    const records = Array.from({ length: 7 }, (_, i) => film(`f${i}`, '2026-02-01T10:00:00Z'));
    const ratings: RatedThing[] = records.map((rec, i) => ({
      kind: 'movie',
      titleId: rec.titleId,
      title: rec.title,
      poster: null,
      rating: i + 1,
    }));
    const r = review(records, 2026, ratings);
    expect(r.topRatedFilms).toHaveLength(5);
    expect(r.topRatedFilms[0].rating).toBe(7);
  });
});
