import { describe, expect, it } from 'vitest';
import { libraryCategories } from './library-categories';

describe('libraryCategories', () => {
  it('puts animated series in several matching categories', () => {
    expect(libraryCategories({ category: 'TV Shows', original_language: 'en', genre_ids: [16, 10759, 10765] }))
      .toEqual(['Cartoon', 'Action', 'Sci-Fi']);
  });

  it('distinguishes Japanese animation and Korean drama', () => {
    expect(libraryCategories({ category: 'TV Shows', origin_country: ['JP'], genre_ids: [16, 18] })).toEqual(['Anime']);
    expect(libraryCategories({ category: 'TV Shows', origin_country: ['KR'], genre_ids: [18] })).toEqual(['K-Drama (TV)']);
    expect(libraryCategories({ category: 'Movies', origin_country: ['KR'], genre_ids: [18] })).toEqual([]);
  });

  it('does not guess Cartoon without origin metadata', () => {
    expect(libraryCategories({ category: 'TV Shows', genre_ids: [16] })).toEqual([]);
  });

  it('supports the older stored genre names while facts are missing', () => {
    expect(libraryCategories({ category: 'Movies', genres: ['Action', 'Science Fiction', 'Documentary'] }))
      .toEqual(['Action', 'Sci-Fi', 'Documentary']);
    expect(libraryCategories({ category: 'Movies', genres: ['Sci-Fi'] }))
      .toEqual(['Sci-Fi']);
  });

  it('prefers synced genre_ids over stale genre strings and ignores whitespace-only language', () => {
    expect(libraryCategories({ category: 'Movies', genre_ids: [28], genres: ['Documentary'] }))
      .toEqual(['Action']);
    expect(libraryCategories({ category: 'TV Shows', original_language: '   ', genre_ids: [16] }))
      .toEqual([]);
  });
});
