import { describe, expect, it } from 'vitest';
import { joinNames, pickCreators, pickDirectors, pickTopCast } from './credits';

describe('pickDirectors', () => {
  it('returns [] for no crew', () => {
    expect(pickDirectors(undefined)).toEqual([]);
    expect(pickDirectors(null)).toEqual([]);
    expect(pickDirectors([])).toEqual([]);
  });

  it('keeps only Director, in TMDB order', () => {
    expect(pickDirectors([
      { name: 'Writer One', job: 'Screenplay' },
      { name: 'Ada', job: 'Director' },
      { name: 'Producer', job: 'Producer' },
      { name: 'Bo', job: 'Director' },
    ])).toEqual(['Ada', 'Bo']);
  });

  it('removes duplicates and blank names, and trims', () => {
    expect(pickDirectors([
      { name: ' Ada ', job: 'Director' },
      { name: 'Ada', job: 'Director' },
      { name: '   ', job: 'Director' },
      { job: 'Director' },
    ])).toEqual(['Ada']);
  });
});

describe('pickCreators', () => {
  it('returns [] for nothing', () => {
    expect(pickCreators(undefined)).toEqual([]);
    expect(pickCreators(null)).toEqual([]);
  });

  it('trims, drops blanks and removes duplicates', () => {
    expect(pickCreators([{ name: ' Ada' }, { name: 'Ada' }, { name: '' }, {}, { name: 'Bo' }])).toEqual(['Ada', 'Bo']);
  });
});

describe('pickTopCast', () => {
  it('returns [] for nothing', () => {
    expect(pickTopCast(undefined)).toEqual([]);
    expect(pickTopCast(null)).toEqual([]);
    expect(pickTopCast([])).toEqual([]);
  });

  it('drops entries without a usable name', () => {
    expect(pickTopCast([{ name: '  ', order: 0 }, { order: 1 }, { name: 'Ada', order: 2 }])).toEqual(['Ada']);
  });

  it('ranks by episode count ahead of billing order', () => {
    expect(pickTopCast([
      { name: 'Guest', order: 0, total_episode_count: 2 },
      { name: 'Lead', order: 5, total_episode_count: 60 },
      { name: 'Support', order: 3, total_episode_count: 30 },
    ])).toEqual(['Lead', 'Support', 'Guest']);
  });

  it('falls back to billing order, with a missing order last', () => {
    expect(pickTopCast([
      { name: 'Third', order: 2 },
      { name: 'Unbilled' },
      { name: 'First', order: 0 },
      { name: 'Second', order: 1 },
    ])).toEqual(['First', 'Second', 'Third']);
  });

  it('breaks full ties by input order', () => {
    expect(pickTopCast([{ name: 'A' }, { name: 'B' }])).toEqual(['A', 'B']);
  });

  it('removes duplicates and caps at three', () => {
    expect(pickTopCast([
      { name: 'A', order: 0 },
      { name: 'A', order: 1 },
      { name: 'B', order: 2 },
      { name: 'C', order: 3 },
      { name: 'D', order: 4 },
    ])).toEqual(['A', 'B', 'C']);
  });
});

describe('joinNames', () => {
  it('handles every length', () => {
    expect(joinNames([])).toBe('');
    expect(joinNames(['A'])).toBe('A');
    expect(joinNames(['A', 'B'])).toBe('A and B');
    expect(joinNames(['A', 'B', 'C'])).toBe('A, B and C');
    expect(joinNames(['A', 'B', 'C', 'D', 'E'])).toBe('A, B, C and 2 more');
    expect(joinNames(['A', 'B', 'C', 'D'])).toBe('A, B, C and 1 more');
  });

  it('respects a custom max', () => {
    expect(joinNames(['A', 'B', 'C'], 2)).toBe('A, B and 1 more');
  });
});
