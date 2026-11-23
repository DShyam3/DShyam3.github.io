import { describe, expect, it } from 'vitest';
import {
  DISLIKE_PRIOR,
  DISLIKE_WEIGHT,
  EMPTY_TASTE,
  answerTasteTitles,
  buildTasteProfile,
  buildTasteProfiles,
  libraryTasteTitles,
  tasteGenres,
  tasteScore,
  tasteSummary,
  tasteTitles,
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
  it('splits a title’s weight between its genres, and sets like shares against part of the dislike shares', () => {
    const profile = buildTasteProfile([
      { media: 'movie', genreIds: [28, 12], year: 2014, language: 'en', weight: 2 },
      { media: 'movie', genreIds: [16], year: 2001, language: 'ja', weight: 1 },
      { media: 'movie', genreIds: [27], year: 2019, language: 'en', weight: -1 },
      { media: 'movie', genreIds: [35], year: 2010, language: 'en', weight: 0 },
    ]);
    // Likes total 3; one dislike, so it counts DISLIKE_WEIGHT * 1 / (1 + DISLIKE_PRIOR).
    const against = DISLIKE_WEIGHT / (1 + DISLIKE_PRIOR);
    expect(profile.genre.get(28)).toBeCloseTo(1 / 3);
    expect(profile.genre.get(16)).toBeCloseTo(1 / 3);
    expect(profile.genre.get(27)).toBeCloseTo(-against);
    expect(profile.genre.has(35)).toBe(false);
    expect(profile.decade.get(2010)).toBeCloseTo(2 / 3 - against);
    expect(profile.decade.get(2000)).toBeCloseTo(1 / 3);
    expect(profile.language.get('en')).toBeCloseTo(2 / 3 - against);
    expect(profile.language.get('ja')).toBeCloseTo(1 / 3);
  });

  it('counts a few dislikes for little, and hundreds almost fully', () => {
    // 400 liked films, a quarter of them horror, and one horror film turned down.
    const library = [
      ...Array.from({ length: 100 }, () => ({ media: 'movie' as const, genreIds: [27], weight: 1 })),
      ...Array.from({ length: 300 }, () => ({ media: 'movie' as const, genreIds: [28], weight: 1 })),
    ];
    const one = buildTasteProfile([...library, { media: 'movie', genreIds: [27], weight: -1 }]);
    expect(one.genre.get(27)).toBeGreaterThan(0.2);
    expect(tasteSummary(one, names)?.avoids).toEqual([]);
    const many = buildTasteProfile([...library, ...Array.from({ length: 600 }, () => ({ media: 'movie' as const, genreIds: [27], weight: -1 }))]);
    expect(many.genre.get(27)).toBeCloseTo(0.25 - DISLIKE_WEIGHT * (600 / (600 + DISLIKE_PRIOR)));
  });

  it('takes each dimension’s shares from the titles that have it', () => {
    // A favourite without a year does not thin out the decades.
    const profile = buildTasteProfile([
      { media: 'movie', genreIds: [28], year: 2014, weight: 1 },
      { media: 'movie', genreIds: [16], weight: 2 },
    ]);
    expect(profile.decade.get(2010)).toBeCloseTo(1);
    expect(profile.genre.get(28)).toBeCloseTo(1 / 3);
  });

  it('keeps a liked genre liked however many of its suggestions are turned down', () => {
    // Three hundred action films turned down, against ten watched: action is
    // still most of what you like, and no more of what you turn down.
    const profile = buildTasteProfile([
      ...Array.from({ length: 10 }, () => ({ media: 'movie' as const, genreIds: [28], weight: 1 })),
      ...Array.from({ length: 2 }, () => ({ media: 'movie' as const, genreIds: [27], weight: 1 })),
      ...Array.from({ length: 300 }, () => ({ media: 'movie' as const, genreIds: [28], weight: -1 })),
      ...Array.from({ length: 300 }, () => ({ media: 'movie' as const, genreIds: [27], weight: -1 })),
    ]);
    expect(profile.genre.get(28)).toBeGreaterThan(0);
    expect(profile.genre.get(27)).toBeLessThan(0);
  });

  it('is empty when nothing carries weight', () => {
    expect(buildTasteProfile([{ media: 'movie', genreIds: [28], weight: 0 }])).toBe(EMPTY_TASTE);
  });
});

describe('tasteScore', () => {
  const profile = buildTasteProfile([
    ...Array.from({ length: 4 }, () => ({ media: 'movie' as const, genreIds: [28], year: 2015, language: 'en', weight: 1 })),
    { media: 'movie', genreIds: [10749], year: 1995, language: 'fr', weight: 1 },
    ...Array.from({ length: 40 }, () => ({ media: 'movie' as const, genreIds: [27], year: 2015, language: 'en', weight: -1 })),
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
      ...Array.from({ length: 200 }, () => ({ media: 'movie' as const, genreIds: [27], year: 2015, language: 'en', weight: -1 })),
    ]);
    const horror = tasteScore(lopsided, { genre_ids: [27], year: 2015, original_language: 'en' });
    expect(horror).toBeGreaterThanOrEqual(-1);
    expect(tasteScore(lopsided, { genre_ids: [28], year: 2015, original_language: 'en' })).toBeLessThanOrEqual(1);
    expect(tasteScore(lopsided, { genre_ids: [27] })).toBeLessThan(0);
    // With nothing liked at all, a disliked genre still scores below an unknown one.
    const onlyDislikes = buildTasteProfile([{ media: 'movie', genreIds: [27], weight: -2 }]);
    expect(tasteScore(onlyDislikes, { genre_ids: [27] })).toBeLessThan(tasteScore(onlyDislikes, { genre_ids: [99] }));
  });

  it('keeps a value just under zero just under zero', () => {
    // 2020s a little more of what is turned down than of what is liked: a
    // 2020s film scores a hair under one from a decade the profile never saw.
    const profile = buildTasteProfile([
      ...Array.from({ length: 70 }, () => ({ media: 'movie' as const, year: 2014, weight: 1 })),
      ...Array.from({ length: 30 }, () => ({ media: 'movie' as const, year: 2024, weight: 1 })),
      ...Array.from({ length: 75 }, () => ({ media: 'movie' as const, year: 2024, weight: -1 })),
      ...Array.from({ length: 25 }, () => ({ media: 'movie' as const, year: 2014, weight: -1 })),
    ]);
    expect(profile.decade.get(2020)).toBeLessThan(0);
    const recent = tasteScore(profile, { year: 2024 });
    expect(recent).toBeLessThan(0);
    expect(recent).toBeGreaterThan(-0.01);
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
    expect(tasteSummary(profile, names)).toEqual({ genres: ['Adventure', 'Action', 'Comedy'], decade: '2010s', languages: ['English', 'Japanese'], avoids: [] });
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
    expect(tasteSummary(profile, names)).toEqual({ genres: ['Action'], decade: '2010s', languages: ['English'], avoids: [] });
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

describe('answerTasteTitles', () => {
  const at = '2026-11-20T00:00:00.000Z';
  const facts = { genreIds: [27], language: 'en', year: 2015 };
  const today = new Date('2026-11-22');

  it('counts Not interested and skips against, only where the title’s facts are known', () => {
    const titles = answerTasteTitles(new Map([
      ['movie:1', { reason: 'not_interested' as const, source: 'you_might_like' as const, answeredAt: at, facts }],
      ['tv:2', { reason: 'skip' as const, source: 'you_might_like' as const, answeredAt: at, facts }],
      ['movie:3', { reason: 'not_interested' as const, source: 'unknown' as const, answeredAt: at }],
      ['film:4', { reason: 'not_interested' as const, source: 'unknown' as const, answeredAt: at, facts }],
    ]), new Set(), today);
    expect(titles).toEqual([
      { media: 'movie', genreIds: [27], year: 2015, language: 'en', weight: -1 },
      { media: 'tv', genreIds: [27], year: 2015, language: 'en', weight: -0.25 },
    ]);
  });

  it('leaves out titles in the library, and the decade of this year’s titles', () => {
    const titles = answerTasteTitles(new Map([
      ['movie:1', { reason: 'not_interested' as const, source: 'you_might_like' as const, answeredAt: at, facts }],
      ['movie:2', { reason: 'not_interested' as const, source: 'coming_soon' as const, answeredAt: at, facts: { ...facts, year: 2026 } }],
      ['movie:3', { reason: 'not_interested' as const, source: 'coming_soon' as const, answeredAt: at, facts: { ...facts, year: 2027 } }],
    ]), new Set(['movie:1']), today);
    expect(titles.map((title) => title.year)).toEqual([null, null]);
    expect(titles.every((title) => title.genreIds?.[0] === 27)).toBe(true);
  });

  it('counts an answer only for a title outside the library and favourites', () => {
    const watchlist = [{ id: '1', title: 'A film', category: 'Movies', created_at: '2026-01-01', tmdb_id: 1, genre_ids: [28], watched: true } as WatchlistItem];
    const favourites = [{ id: 'f', title: 'A favourite', media_type: 'movie', tmdb_id: 2, created_at: '2026-01-01', category: 'Hollywood', facts: null } as FavouriteItem];
    const answer = { reason: 'not_interested' as const, source: 'unknown' as const, answeredAt: at, facts };
    const titles = tasteTitles(watchlist, favourites, new Map([['movie:1', answer], ['movie:2', answer], ['movie:3', answer]]), true, today);
    expect(titles.filter((title) => title.weight < 0)).toHaveLength(1);
  });

  it('names what you turn down in the summary', () => {
    const profile = buildTasteProfile([
      ...Array.from({ length: 5 }, () => ({ media: 'movie' as const, genreIds: [28], year: 2014, language: 'en', weight: 1 })),
      ...Array.from({ length: 5 }, () => ({ media: 'movie' as const, genreIds: [27], year: 2014, language: 'en', weight: -1 })),
    ]);
    expect(tasteSummary(profile, names)?.avoids).toEqual(['Horror']);
  });

  it('names at most two genres you avoid, from -0.02 down', () => {
    const profile = {
      genre: new Map([[28, 0.5], [27, -0.02], [10752, -0.019], [37, -0.3], [36, -0.1]]),
      decade: new Map<number, number>(),
      language: new Map<string, number>(),
    };
    expect(tasteSummary(profile, names)?.avoids).toEqual(['Western', 'History']);
    profile.genre.delete(37);
    profile.genre.delete(36);
    expect(tasteSummary(profile, names)?.avoids).toEqual(['Horror']);
  });
});

