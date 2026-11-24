import { describe, expect, it } from 'vitest';
import type { Season, WatchlistItem } from './WatchlistContext';
import { isRateable, pruneSkips, ratingQueue } from './rating-queue';

const TODAY = new Date('2026-11-24T12:00:00Z');

const film = (id: string, extra: Partial<WatchlistItem> = {}): WatchlistItem => ({
  id, title: `Film ${id}`, category: 'Movies', created_at: '2026-01-01', watched: true, ...extra,
});

/** Episodes aired in 2025, watched or not. */
const season = (season_number: number, watched: boolean[]): Season => ({
  season_number,
  episodes: watched.map((w, index) => ({ episode_number: index + 1, title: '', release_date: `2025-0${(index % 9) + 1}-01`, watched: w })),
});

const series = (id: string, seasons: Season[], extra: Partial<WatchlistItem> = {}): WatchlistItem => ({
  id, title: `Series ${id}`, category: 'TV Shows', created_at: '2026-01-01', seasons, series_status: 'Ended', ...extra,
});

const ids = (items: WatchlistItem[]) => items.map((item) => item.id);

describe('isRateable', () => {
  it('takes a watched film, and not one still to watch or to come', () => {
    expect(isRateable(film('a'), TODAY)).toBe(true);
    expect(isRateable(film('a', { watched: false }), TODAY)).toBe(false);
    expect(isRateable({ ...film('u'), category: 'Upcoming' }, TODAY)).toBe(false);
  });

  it('takes a series once finished, caught up or given up on, and not mid-season', () => {
    expect(isRateable(series('done', [season(1, [true, true])]), TODAY)).toBe(true);
    expect(isRateable(series('airing', [season(1, [true, true])], { series_status: 'Returning Series' }), TODAY)).toBe(true);
    expect(isRateable(series('stopped', [season(1, [true, false])], { library_state: 'stopped' }), TODAY)).toBe(true);
    expect(isRateable(series('mid', [season(1, [true, false])]), TODAY)).toBe(false);
  });

  it('never takes a series with nothing watched, or only specials', () => {
    expect(isRateable(series('none', [season(1, [false])], { library_state: 'stopped' }), TODAY)).toBe(false);
    expect(isRateable(series('specials', [season(0, [true]), season(1, [false])], { library_state: 'stopped' }), TODAY)).toBe(false);
  });

  it('never takes a hidden title', () => {
    expect(isRateable(film('h', { library_state: 'hidden' }), TODAY)).toBe(false);
    expect(isRateable(series('h', [season(1, [true])], { library_state: 'hidden' }), TODAY)).toBe(false);
  });
});

describe('ratingQueue', () => {
  it('asks only about rateable titles with no rating', () => {
    const items = [
      film('rated', { personal_rating: 7 }),
      film('unwatched', { watched: false }),
      film('low', { personal_rating: 0.5 }),
      film('open'),
    ];
    expect(ids(ratingQueue(items, new Map(), TODAY))).toEqual(['open']);
  });

  it('puts the most recently watched first, a series by its last episode', () => {
    const items = [
      film('old', { watched_at: '2026-03-01T10:00:00Z' }),
      series('show', [season(1, [true])], { watched_at: '2026-11-20T21:00:00Z' }),
      film('new', { watched_at: '2026-11-01T20:00:00Z' }),
    ];
    expect(ids(ratingQueue(items, new Map(), TODAY))).toEqual(['show', 'new', 'old']);
  });

  it('puts undated watches after dated ones, by TMDB votes, then by title', () => {
    const items = [
      film('quiet', { tmdb_votes: 900 }),
      film('dated', { watched_at: '2020-01-01T00:00:00Z' }),
      // IMDb's count is far larger than TMDB's for the same film; it is not compared.
      film('imdbOnly', { imdb_votes: 2_000_000 }),
      film('famous', { tmdb_votes: 37_000 }),
      film('b', { title: 'Beta' }),
      film('a', { title: 'Alpha' }),
    ];
    expect(ids(ratingQueue(items, new Map(), TODAY))).toEqual(['dated', 'famous', 'quiet', 'a', 'b', 'imdbOnly']);
  });

  it('puts skipped titles last, longest-skipped first', () => {
    const items = [
      film('recent', { watched_at: '2026-11-20T00:00:00Z' }),
      film('older', { watched_at: '2026-10-01T00:00:00Z' }),
      film('undated'),
    ];
    const skipped = new Map([['Movies:recent', 200], ['Movies:older', 100]]);
    expect(ids(ratingQueue(items, skipped, TODAY))).toEqual(['undated', 'older', 'recent']);
  });

  it('keys skips by category as well as id', () => {
    const items = [film('1'), series('1', [season(1, [true])], { watched_at: '2026-01-01T00:00:00Z' })];
    const queue = ratingQueue(items, new Map([['TV Shows:1', 1]]), TODAY);
    expect(queue.map((item) => item.category)).toEqual(['Movies', 'TV Shows']);
  });
});

describe('pruneSkips', () => {
  it('keeps only skips of titles still waiting', () => {
    const skips = new Map([['Movies:1', 1], ['Movies:2', 2], ['TV Shows:1', 3]]);
    expect([...pruneSkips(skips, new Set(['Movies:2', 'TV Shows:1']))]).toEqual([['Movies:2', 2], ['TV Shows:1', 3]]);
  });
});
