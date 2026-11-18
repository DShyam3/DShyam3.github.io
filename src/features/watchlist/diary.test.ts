import { describe, expect, it } from 'vitest';
import { buildDiary, episodeRangeLabel, localDay, type WatchRecord } from './diary';

const London = 'Europe/London';

let nextId = 1;
const ep = (
  titleId: string,
  seasonNumber: number,
  episodeNumber: number,
  watchedAt: string | null,
  runtime: number | null = 40,
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
  episodeTitle: null,
  genres: [],
  platform: null,
});

const film = (titleId: string, watchedAt: string | null, runtime: number | null = 100): WatchRecord => ({
  kind: 'movie',
  id: nextId++,
  watchedAt,
  runtime,
  titleId,
  title: titleId.toUpperCase(),
  poster: null,
  genres: [],
  platform: null,
});

const nums = (season: number, ...episodes: number[]) =>
  episodes.map((episodeNumber) => ({ seasonNumber: season, episodeNumber }));

describe('localDay', () => {
  it('puts a late-evening UTC watch on the next UK day during BST', () => {
    expect(localDay('2026-07-01T23:30:00Z', London)).toBe('2026-07-02');
    expect(localDay('2026-07-01T23:30:00Z', 'UTC')).toBe('2026-07-01');
  });

  it('keeps a winter watch on the same day in London', () => {
    expect(localDay('2026-01-01T23:30:00Z', London)).toBe('2026-01-01');
  });
});

describe('episodeRangeLabel', () => {
  it('prints a single episode', () => {
    expect(episodeRangeLabel(nums(1, 3))).toBe('S1 E3');
  });

  it('compresses a binge', () => {
    expect(episodeRangeLabel(nums(2, 4, 2, 1, 3))).toBe('S2 E1–E4');
  });

  it('compresses only consecutive numbers', () => {
    expect(episodeRangeLabel(nums(1, 1, 2, 3, 5))).toBe('S1 E1–E3, E5');
  });

  it('joins seasons with a middle dot', () => {
    expect(episodeRangeLabel([...nums(2, 1, 2), ...nums(1, 10)])).toBe('S1 E10 · S2 E1–E2');
  });

  it('prints season 0 as S0', () => {
    expect(episodeRangeLabel(nums(0, 1))).toBe('S0 E1');
  });
});

describe('buildDiary', () => {
  it('excludes undated watches and counts them', () => {
    const diary = buildDiary([ep('a', 1, 1, null), ep('a', 1, 2, '2026-03-01T12:00:00Z')], { timeZone: 'UTC' });
    expect(diary.undated).toBe(1);
    expect(diary.dated).toBe(1);
    expect(diary.days).toHaveLength(1);
  });

  it('counts a null runtime as 0 minutes and unknown', () => {
    const diary = buildDiary(
      [ep('a', 1, 1, '2026-03-01T12:00:00Z', null), ep('a', 1, 2, '2026-03-01T13:00:00Z', 30)],
      { timeZone: 'UTC' },
    );
    const [day] = diary.days;
    expect(day.minutes).toBe(30);
    expect(day.unknownRuntime).toBe(1);
    expect(day.rows[0].minutes).toBe(30);
    expect(day.rows[0].unknownRuntime).toBe(1);
  });

  it('buckets a late-evening watch by the local day across BST', () => {
    const records = [film('f', '2026-07-01T23:30:00Z')];
    expect(buildDiary(records, { timeZone: London }).days[0].day).toBe('2026-07-02');
    expect(buildDiary(records, { timeZone: 'UTC' }).days[0].day).toBe('2026-07-01');
  });

  it('collapses a binge into one row with a compressed label', () => {
    const diary = buildDiary(
      [
        ep('a', 2, 3, '2026-03-01T20:00:00Z'),
        ep('a', 2, 1, '2026-03-01T18:00:00Z'),
        ep('a', 2, 4, '2026-03-01T21:00:00Z'),
        ep('a', 2, 2, '2026-03-01T19:00:00Z'),
      ],
      { timeZone: 'UTC' },
    );
    const rows = diary.days[0].rows;
    expect(rows).toHaveLength(1);
    expect(rows[0].key).toBe('episode:a:2026-03-01');
    expect(rows[0].label).toBe('S2 E1–E4');
    expect(rows[0].records.map((r) => r.episodeNumber)).toEqual([1, 2, 3, 4]);
    expect(rows[0].minutes).toBe(160);
    expect(rows[0].latestAt).toBe('2026-03-01T21:00:00Z');
  });

  it('orders days newest first and rows by latest watch, then title', () => {
    const diary = buildDiary(
      [
        film('b', '2026-03-01T10:00:00Z'),
        film('a', '2026-03-01T10:00:00Z'),
        film('c', '2026-03-01T22:00:00Z'),
        film('z', '2026-03-05T09:00:00Z'),
      ],
      { timeZone: 'UTC' },
    );
    expect(diary.days.map((d) => d.day)).toEqual(['2026-03-05', '2026-03-01']);
    expect(diary.days[1].rows.map((r) => r.titleId)).toEqual(['c', 'a', 'b']);
    expect(diary.days[1].rows[0].label).toBe('');
  });

  it('keeps one show on two days as two rows', () => {
    const diary = buildDiary(
      [ep('a', 1, 1, '2026-03-01T12:00:00Z'), ep('a', 1, 2, '2026-03-02T12:00:00Z')],
      { timeZone: 'UTC' },
    );
    expect(diary.days).toHaveLength(2);
  });

  it('does not crash on duplicates and dedupes by kind and id', () => {
    const f = film('f', '2026-03-01T12:00:00Z');
    const diary = buildDiary([f, { ...f }], { timeZone: 'UTC' });
    expect(diary.dated).toBe(1);
    expect(diary.days[0].rows).toHaveLength(1);
  });

  it('gives an empty diary for no records', () => {
    expect(buildDiary([])).toEqual({ days: [], undated: 0, dated: 0 });
  });
});
