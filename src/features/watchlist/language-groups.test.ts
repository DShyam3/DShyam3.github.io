import { describe, expect, it } from 'vitest';
import { groupByLanguage, languageDisplayName } from './language-groups';

interface TestItem {
  id: number;
  original_language?: string | null;
  genre_ids?: number[] | null;
  genres?: string[] | null;
  mediaType: 'movie' | 'tv';
}

describe('languageDisplayName', () => {
  it('resolves ISO language codes to English names', () => {
    expect(languageDisplayName('en')).toBe('English');
    expect(languageDisplayName('hi')).toBe('Hindi');
    expect(languageDisplayName('es')).toBe('Spanish');
    expect(languageDisplayName('ja')).toBe('Japanese');
  });

  it('returns Other for empty or nullish codes', () => {
    expect(languageDisplayName(null)).toBe('Other');
    expect(languageDisplayName(undefined)).toBe('Other');
    expect(languageDisplayName('  ')).toBe('Other');
  });
});

describe('groupByLanguage', () => {
  it('groups by language sorted by count descending with Other last', () => {
    const items: TestItem[] = [
      { id: 1, original_language: 'hi', mediaType: 'movie' },
      { id: 2, original_language: 'en', mediaType: 'movie' },
      { id: 3, original_language: 'en', mediaType: 'tv' },
      { id: 4, original_language: 'en', genre_ids: [16, 35], mediaType: 'movie' },
      { id: 5, original_language: 'hi', mediaType: 'movie' },
      { id: 6, original_language: 'es', mediaType: 'movie' },
      { id: 7, original_language: null, mediaType: 'tv' },
    ];

    const groups = groupByLanguage(items, (i) => i, {
      minGroupSize: 2,
      collapseThreshold: 3,
    });

    expect(groups.map((g) => [g.key, g.label, g.items.length, g.defaultCollapsed])).toEqual([
      ['en', 'English', 3, false],
      ['hi', 'Hindi', 2, true],
      ['other', 'Other', 2, true],
    ]);

    expect(groups[0].movies.map((i) => i.id)).toEqual([2]);
    expect(groups[0].tvShows.map((i) => i.id)).toEqual([3]);
    expect(groups[0].cartoons.map((i) => i.id)).toEqual([4]);
  });

  it('detects animation from genres string array when genre_ids is absent', () => {
    const items: TestItem[] = [
      { id: 1, original_language: 'ja', genres: ['Animation', 'Action'], mediaType: 'tv' },
      { id: 2, original_language: 'ja', genres: ['Drama'], mediaType: 'tv' },
    ];

    const groups = groupByLanguage(items, (i) => i, { minGroupSize: 2 });
    expect(groups[0].cartoons.map((i) => i.id)).toEqual([1]);
    expect(groups[0].tvShows.map((i) => i.id)).toEqual([2]);
  });
});
