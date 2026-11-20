import { describe, expect, it } from 'vitest';
import type { WatchlistItem } from './WatchlistContext';
import {
  groupLibraryItemsByShelf,
  mergePersonFilmography,
  normalizeCombinedCredits,
} from './person-credits';

function makeMovie(overrides: Partial<WatchlistItem>): WatchlistItem {
  return {
    id: '1',
    title: 'Film',
    category: 'Movies',
    watched: false,
    created_at: '2024-01-01T00:00:00Z',
    release_date: '2024-01-01',
    ...overrides,
  };
}

describe('normalizeCombinedCredits', () => {
  const today = new Date('2026-11-19T12:00:00Z');

  it('deduplicates multiple roles on the same title and sorts upcoming first', () => {
    const credits = normalizeCombinedCredits(
      [
        {
          id: 10,
          media_type: 'movie',
          title: 'Older Film',
          release_date: '2020-05-01',
          character: 'Lead',
        },
      ],
      [
        {
          id: 10,
          media_type: 'movie',
          title: 'Older Film',
          release_date: '2020-05-01',
          job: 'Producer',
        },
        {
          id: 20,
          media_type: 'movie',
          title: 'Next Film',
          release_date: '2027-07-16',
          job: 'Director',
        },
      ],
      today,
    );

    expect(credits.map((c) => c.title)).toEqual(['Next Film', 'Older Film']);
    expect(credits[0].upcoming).toBe(true);
    expect(credits[1].roles).toEqual(['Producer', 'as Lead']);
  });
});

describe('mergePersonFilmography', () => {
  it('merges extra TMDB-matched library items without duplicating existing ones', () => {
    const first = makeMovie({ id: '1', tmdb_id: 100, title: 'In DB Top 3', watched: true });
    const supporting = makeMovie({ id: '2', tmdb_id: 200, title: 'Supporting Role', watched: false });
    const missing = {
      key: 'movie:300',
      tmdbId: 300,
      mediaType: 'movie' as const,
      title: 'Not In Library',
      releaseDate: '2025-02-01',
      year: 2025,
      roles: ['Director'],
      upcoming: false,
    };

    const merged = mergePersonFilmography(
      [first],
      [
        { ...missing, key: 'movie:100', tmdbId: 100, title: 'In DB Top 3' },
        { ...missing, key: 'movie:200', tmdbId: 200, title: 'Supporting Role' },
        missing,
      ],
      [first, supporting],
    );

    expect(merged.inLibrary.map((i) => i.id)).toEqual(['1', '2']);
    expect(merged.notInLibrary.map((c) => c.tmdbId)).toEqual([300]);
  });
});

describe('groupLibraryItemsByShelf', () => {
  const today = new Date('2026-11-19T12:00:00Z');

  it('groups items in shelf order and hides private shelves from non-admins', () => {
    const watched = makeMovie({ id: '1', title: 'Done', watched: true });
    const upcoming = makeMovie({ id: '2', title: 'Soon', release_date: '2027-01-01' });
    const hidden = makeMovie({ id: '3', title: 'Secret', library_state: 'hidden' });

    const visitorGroups = groupLibraryItemsByShelf([watched, upcoming, hidden], false, today);
    expect(visitorGroups.map((g) => g.shelf)).toEqual(['Upcoming', 'Finished']);

    const adminGroups = groupLibraryItemsByShelf([watched, upcoming, hidden], true, today);
    expect(adminGroups.map((g) => g.shelf)).toEqual(['Upcoming', 'Finished', 'Hidden']);
  });
});
