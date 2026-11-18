import { describe, expect, it } from 'vitest';
import { parseTraktFiles } from './trakt-import';

const now = new Date('2026-11-18T12:00:00Z');
const parse = (...data: unknown[]) => parseTraktFiles(data.map((d, i) => ({ name: `f${i}.json`, text: JSON.stringify(d) })), { now });
const show = { title: 'Severance', year: 2022, ids: { tmdb: 95396 } };
const ep = (watched_at: string, number = 1) => ({ watched_at, type: 'episode', episode: { season: 1, number }, show });

describe('parseTraktFiles', () => {
  it('merges history episodes to the earliest watch', () => {
    const out = parse([ep('2024-05-02T10:00:00.000Z'), ep('2024-05-01T10:00:00.000Z'), ep('2024-05-03T10:00:00.000Z', 2)]);
    expect(out.episodes).toHaveLength(2);
    expect(out.episodes[0].watchedAt).toBe('2024-05-01T10:00:00.000Z');
    expect(out.skipped).toBe(0);
  });

  it('reads the watched-shows shape', () => {
    const out = parse([{ show, seasons: [{ number: 1, episodes: [{ number: 1, last_watched_at: '2024-01-01T00:00:00Z', plays: 2 }, { number: 2, last_watched_at: null }] }] }]);
    expect(out.episodes.map(e => [e.episode, e.watchedAt])).toEqual([[1, '2024-01-01T00:00:00.000Z'], [2, null]]);
  });

  it('reads movies from history and watched shapes, keeping the earliest', () => {
    const movie = { title: 'Heat', year: 1995, ids: { tmdb: 949 } };
    const out = parse([{ watched_at: '2024-02-01T00:00:00Z', type: 'movie', movie }, { movie, last_watched_at: '2023-02-01T00:00:00Z', plays: 1 }, { movie }]);
    expect(out.movies).toHaveLength(1);
    expect(out.movies[0]).toMatchObject({ title: 'Heat', tmdbId: 949, watchedAt: '2023-02-01T00:00:00.000Z' });
  });

  it('accepts object-wrapped arrays', () => {
    const out = parse({ history: [ep('2024-05-01T00:00:00Z')], other: 'ignored' });
    expect(out.episodes).toHaveLength(1);
    expect(out.files).toEqual([{ name: 'f0.json', items: 1 }]);
  });

  it('falls back to a title identity without ids.tmdb', () => {
    const noId = { title: ' Heat ', year: 1995 };
    const out = parse([{ watched_at: '2024-01-01T00:00:00Z', movie: noId }, { watched_at: '2023-01-01T00:00:00Z', movie: { title: 'heat', year: 1995 } }]);
    expect(out.movies).toHaveLength(1);
    expect(out.movies[0].tmdbId).toBeNull();
    expect(out.movies[0].watchedAt).toBe('2023-01-01T00:00:00.000Z');
  });

  it('keeps the latest rating and skips episode ratings', () => {
    const out = parse([
      { rating: 5, rated_at: '2024-01-01T00:00:00Z', type: 'show', show },
      { rating: 9, rated_at: '2024-06-01T00:00:00Z', type: 'show', show },
      { rating: 7, type: 'show', show },
      { rating: 8, type: 'season', season: { number: 1 }, show },
      { rating: 8, type: 'episode', episode: { season: 1, number: 1 }, show },
      { rating: 11, type: 'movie', movie: { title: 'X' } },
    ]);
    expect(out.ratings.map(r => [r.kind, r.rating, r.season])).toEqual([['show', 9, undefined], ['season', 8, 1]]);
    expect(out.skipped).toBe(2);
    expect(out.skippedReasons).toEqual({ 'episode rating': 1, 'invalid rating': 1 });
  });

  it('nulls invalid timestamps but keeps the watch, and skips bad numbers', () => {
    const out = parse([ep('garbage'), ep('1850-01-01T00:00:00Z', 2), ep('2030-01-01T00:00:00Z', 3), { watched_at: '2024-01-01T00:00:00Z', episode: { season: -1, number: 1 }, show }, { nothing: true }]);
    expect(out.episodes.map(e => e.watchedAt)).toEqual([null, null, null]);
    expect(out.skipped).toBe(2);
  });

  it('throws on malformed JSON naming the file, and on an empty list', () => {
    expect(() => parseTraktFiles([{ name: 'bad.json', text: '{oops' }])).toThrow(/bad\.json/);
    expect(() => parseTraktFiles([])).toThrow();
  });
});
