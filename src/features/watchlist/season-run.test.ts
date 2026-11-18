import { describe, it, expect } from 'vitest';
import { seasonRun } from './watchlist-utils';

const today = new Date(2026, 10, 18, 12);

describe('seasonRun', () => {
  it('counts a weekly season, aired so far, and its finale', () => {
    expect(seasonRun([
      { release_date: '2026-11-11' },
      { release_date: '2026-11-18' },
      { release_date: '2026-11-25' },
    ], today)).toEqual({ total: 3, aired: 2, pattern: 'weekly', finale: '2026-11-25' });
  });

  it('reads one shared date as all at once', () => {
    expect(seasonRun([{ release_date: '2026-11-12' }, { release_date: '2026-11-12' }], today))
      .toEqual({ total: 2, aired: 2, pattern: 'all-at-once', finale: '2026-11-12' });
  });

  it('gives no finale while an episode is undated', () => {
    expect(seasonRun([{ release_date: '2026-11-12' }, { release_date: null }], today)?.finale).toBeNull();
  });

  it('says nothing for an empty or undated season', () => {
    expect(seasonRun([], today)).toBeNull();
    expect(seasonRun([{ release_date: undefined }], today)).toBeNull();
  });
});
