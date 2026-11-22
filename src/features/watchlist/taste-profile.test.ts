import { describe, expect, it } from 'vitest';
import {
  EMPTY_TASTE,
  buildTasteProfile,
  buildTasteProfiles,
  libraryTasteTitles,
  tasteGenres,
  tasteScore,
  tasteSummary,
  titleWeight,
} from './taste-profile';
import type { FavouriteItem, WatchlistItem } from './WatchlistContext';

const names = (code: string) => ({ en: 'English', ja: 'Japanese', fr: 'French' } as Record<string, string>)[code] ?? code;

describe('titleWeight', () => {
  it('lets a rating speak over the status, at its edges too', () => {
    expect(titleWeight({ status: 'Watched', rating: 9, favourite: false })).toBe(3);
    expect(titleWeight({ status: 'Watched', rating: 8, favourite: false })).toBe(3);
    expect(titleWeight({ status: 'Watched', rating: 7.5, favourite: false })).toBe(1.5);
    expect(titleWeight({ status: 'Watched', rating: 6, favourite: false })).toBe(1.5);
    expect(titleWeight({ status: 'Watched', rating: 5.5, favourite: false })).toBe(-2);
    // The owner's rating of a hidden title still says what they thought of it.
    expect(titleWeight({ status: 'Hidden', rating: 9, favourite: false })).toBe(3);
  });

  it('counts a series seen in part as seen, and only an unstarted title as saved', () => {
    for (const status of ['Watched', 'Completed', 'Caught up', 'Watching', 'Between seasons']) {
      expect(titleWeight({ status, favourite: false })).toBe(1);
    }
    expect(titleWeight({ status: 'To Watch', favourite: false })).toBe(0.25);
    expect(titleWeight({ status: 'Stopped watching', favourite: false })).toBe(-1);
    expect(titleWeight({ status: 'Hidden', favourite: false })).toBe(0);
  });

  it('adds a favourite', () => {
    expect(titleWeight({ status: null, favourite: true })).toBe(2);
    expect(titleWeight({ status: 'Watched', favourite: true })).toBe(3);
  });
});

describe('tasteGenres', () => {
  it('maps series genres onto films’ and keeps each once', () => {
    expect(tasteGenres([10759, 28, 10765])).toEqual([28, 12, 878, 14]);
    expect(tasteGenres(null)).toEqual([]);
  });
});

describe('buildTasteProfile', () => {
  it('splits a title’s weight between its genres and shares out the total', () => {
    const profile = buildTasteProfile([
      { media: 'movie', genreIds: [28, 12], year: 2014, language: 'en', weight: 2 },
      { media: 'movie', genreIds: [16], year: 2001, language: 'ja', weight: 1 },
      { media: 'movie', genreIds: [27], year: 2019, language: 'en', weight: -1 },
      { media: 'movie', genreIds: [35], year: 2010, language: 'en', weight: 0 },
    ]);
    expect(profile.genre.get(28)).toBeCloseTo(1 / 4);
    expect(profile.genre.get(16)).toBeCloseTo(1 / 4);
    expect(profile.genre.get(27)).toBeCloseTo(-1 / 4);
    expect(profile.genre.has(35)).toBe(false);
    expect(profile.decade.get(2010)).toBeCloseTo(1 / 4);
    expect(profile.decade.get(2000)).toBeCloseTo(1 / 4);
    expect(profile.language.get('en')).toBeCloseTo(1 / 4);
    expect(profile.language.get('ja')).toBeCloseTo(1 / 4);
  });

  it('is empty when nothing carries weight', () => {
    expect(buildTasteProfile([{ media: 'movie', genreIds: [28], weight: 0 }])).toBe(EMPTY_TASTE);
  });
});

describe('tasteScore', () => {
  const profile = buildTasteProfile([
    ...Array.from({ length: 4 }, () => ({ media: 'movie' as const, genreIds: [28], year: 2015, language: 'en', weight: 1 })),
    { media: 'movie', genreIds: [10749], year: 1995, language: 'fr', weight: 1 },
    { media: 'movie', genreIds: [27], year: 2015, language: 'en', weight: -2 },
  ]);

  it('ranks a title in the profile’s strongest genre, decade and language highest', () => {
    const action = tasteScore(profile, { genre_ids: [28], year: 2016, original_language: 'en' });
    const romance = tasteScore(profile, { genre_ids: [10749], year: 1996, original_language: 'fr' });
    const horror = tasteScore(profile, { genre_ids: [27], year: 2016, original_language: 'en' });
    expect(action).toBeCloseTo(1);
    expect(action).toBeGreaterThan(romance);
    expect(romance).toBeGreaterThan(horror);
    expect(horror).toBeLessThan(0.6 * 0 + 0.2 + 0.2);
  });

  it('keeps every part between -1 and 1 in a small or lopsided profile', () => {
    // A faint like against a strong dislike: the dislike must not swamp the rest.
    const lopsided = buildTasteProfile([
      { media: 'movie', genreIds: [28], year: 2015, language: 'en', weight: 0.25 },
      { media: 'movie', genreIds: [27], year: 2015, language: 'en', weight: -2 },
    ]);
    const horror = tasteScore(lopsided, { genre_ids: [27], year: 2015, original_language: 'en' });
    expect(horror).toBeGreaterThanOrEqual(-1);
    expect(tasteScore(lopsided, { genre_ids: [27] })).toBeCloseTo(-0.6);
    // With nothing liked at all, a disliked genre still scores below an unknown one.
    const onlyDislikes = buildTasteProfile([{ media: 'movie', genreIds: [27], weight: -2 }]);
    expect(tasteScore(onlyDislikes, { genre_ids: [27] })).toBeLessThan(tasteScore(onlyDislikes, { genre_ids: [99] }));
  });

  it('scores 0 for a title the profile knows nothing about', () => {
    expect(tasteScore(profile, { genre_ids: [99], year: 1950, original_language: 'ko' })).toBe(0);
    expect(tasteScore(EMPTY_TASTE, { genre_ids: [28], year: 2015, original_language: 'en' })).toBe(0);
  });
});

describe('tasteSummary', () => {
  it('names the top three genres, the top decade and the main languages', () => {
    const profile = buildTasteProfile([
      { media: 'movie', genreIds: [12], year: 2014, language: 'en', weight: 3 },
      { media: 'movie', genreIds: [28], year: 2012, language: 'en', weight: 2 },
      { media: 'movie', genreIds: [35], year: 2005, language: 'ja', weight: 1.5 },
      { media: 'movie', genreIds: [18], year: 2019, language: 'fr', weight: 0.5 },
    ]);
    expect(tasteSummary(profile, names)).toEqual({ genres: ['Adventure', 'Action', 'Comedy'], decade: '2010s', languages: ['English', 'Japanese'] });
  });

  it('says nothing for an empty profile, or one with only dislikes', () => {
    expect(tasteSummary(EMPTY_TASTE, names)).toBeNull();
    expect(tasteSummary(buildTasteProfile([{ media: 'movie', genreIds: [27], year: 2010, language: 'en', weight: -1 }]), names)).toBeNull();
  });

  it('names a decade or language only with a tenth of the weight', () => {
    const profile = buildTasteProfile([
      ...Array.from({ length: 19 }, () => ({ media: 'movie' as const, genreIds: [28], year: 2014, language: 'en', weight: 1 })),
      { media: 'movie', genreIds: [28], year: 1985, language: 'fr', weight: 1 },
    ]);
    expect(tasteSummary(profile, names)).toEqual({ genres: ['Action'], decade: '2010s', languages: ['English'] });
  });
});

describe('libraryTasteTitles', () => {
  const film = (over: Partial<WatchlistItem>): WatchlistItem => ({
    id: '1', title: 'A film', category: 'Movies', created_at: '2026-01-01', tmdb_id: 1,
    genre_ids: [28], original_language: 'en', year: 2014, watched: true, ...over,
  } as WatchlistItem);
  const favourite = (over: Partial<FavouriteItem>): FavouriteItem => ({
    id: 'f', title: 'A favourite', media_type: 'movie', tmdb_id: 2, created_at: '2026-01-01',
    category: 'Movies', facts: { genre_ids: [16], original_language: 'ja' }, ...over,
  } as FavouriteItem);

  it('weights library titles, adds favourites in the library, and keeps the rest of the favourites', () => {
    const titles = libraryTasteTitles(
      [film({ id: '1', tmdb_id: 1 }), film({ id: '2', tmdb_id: 3, personal_rating: 9 })],
      [favourite({ tmdb_id: 1 }), favourite({ tmdb_id: 2 })],
      true,
      new Date('2026-11-22'),
    );
    expect(titles.map((title) => title.weight)).toEqual([3, 3, 2]);
    expect(titles[2]).toMatchObject({ media: 'movie', genreIds: [16], language: 'ja' });
  });

  it('leaves hidden and stopped titles out of a visitor’s profile, not the owner’s', () => {
    const library = [
      film({ id: '1', tmdb_id: 1, genre_ids: [28] }),
      film({ id: '2', tmdb_id: 2, genre_ids: [27], library_state: 'hidden', personal_rating: 9 }),
      film({ id: '3', tmdb_id: 3, genre_ids: [99], library_state: 'stopped' }),
    ];
    const genresOf = (isAdmin: boolean) => [...buildTasteProfile(libraryTasteTitles(library, [], isAdmin, new Date('2026-11-22'))).genre.keys()].sort((a, b) => a - b);
    expect(genresOf(false)).toEqual([28]);
    expect(genresOf(true)).toEqual([27, 28, 99]);
  });
});
