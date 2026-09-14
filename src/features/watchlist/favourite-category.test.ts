import { describe, it, expect } from 'vitest';
import {
  deriveFavouriteCategory,
  isFavouriteCategory,
  resolveFavouriteCategory,
} from './favourite-category';

describe('deriveFavouriteCategory', () => {
  it('Korean live-action TV is K-Drama', () => {
    expect(
      deriveFavouriteCategory({
        original_language: 'ko',
        origin_country: ['KR'],
        genre_ids: [18],
      }),
    ).toBe('K-Drama');
  });

  it('Korean with only origin_country known is K-Drama', () => {
    expect(deriveFavouriteCategory({ origin_country: ['KR'] })).toBe('K-Drama');
  });

  it('Korean with only original_language known is K-Drama', () => {
    expect(deriveFavouriteCategory({ original_language: 'ko' })).toBe('K-Drama');
  });

  it('Japanese animation is Anime', () => {
    expect(
      deriveFavouriteCategory({
        original_language: 'ja',
        origin_country: ['JP'],
        genre_ids: [16, 18],
      }),
    ).toBe('Anime');
  });

  it('Japanese live-action with no Animation genre is Others, not Anime', () => {
    expect(
      deriveFavouriteCategory({
        original_language: 'ja',
        origin_country: ['JP'],
        genre_ids: [18],
      }),
    ).toBe('Others');
  });

  it('Korean animation is Cartoon, not K-Drama', () => {
    expect(
      deriveFavouriteCategory({ original_language: 'ko', genre_ids: [16] }),
    ).toBe('Cartoon');
  });

  it('Hindi is Bollywood', () => {
    expect(
      deriveFavouriteCategory({ original_language: 'hi', origin_country: ['IN'] }),
    ).toBe('Bollywood');
  });

  it('Tamil is Others, not Bollywood', () => {
    expect(
      deriveFavouriteCategory({ original_language: 'ta', origin_country: ['IN'] }),
    ).toBe('Others');
  });

  it('English US is Hollywood', () => {
    expect(
      deriveFavouriteCategory({ original_language: 'en', origin_country: ['US'] }),
    ).toBe('Hollywood');
  });

  it('English GB is Hollywood, since the bucket means English-language', () => {
    expect(
      deriveFavouriteCategory({ original_language: 'en', origin_country: ['GB'] }),
    ).toBe('Hollywood');
  });

  it('French is Others', () => {
    expect(deriveFavouriteCategory({ original_language: 'fr' })).toBe('Others');
  });

  it('empty facts are unknown', () => {
    expect(deriveFavouriteCategory({})).toBe(null);
  });

  it('explicit nulls and empty arrays are unknown', () => {
    expect(
      deriveFavouriteCategory({
        original_language: null,
        origin_country: [],
        genre_ids: [],
      }),
    ).toBe(null);
  });

  it('whitespace-only language is not a language', () => {
    expect(deriveFavouriteCategory({ original_language: '  ' })).toBe(null);
  });

  it('is case-robust for language', () => {
    expect(deriveFavouriteCategory({ original_language: 'KO' })).toBe('K-Drama');
  });

  it('is case-robust for country', () => {
    expect(deriveFavouriteCategory({ origin_country: ['kr'] })).toBe('K-Drama');
  });

  it('English-language animation is Cartoon, not Hollywood', () => {
    expect(
      deriveFavouriteCategory({
        original_language: 'en',
        origin_country: ['US'],
        genre_ids: [16, 10751],
      }),
    ).toBe('Cartoon');
  });

  it('Hindi animation is Cartoon, not Bollywood', () => {
    expect(
      deriveFavouriteCategory({ original_language: 'hi', genre_ids: [16] }),
    ).toBe('Cartoon');
  });

  it('animation known only by a non-Japanese country is Cartoon', () => {
    expect(
      deriveFavouriteCategory({ origin_country: ['FR'], genre_ids: [16] }),
    ).toBe('Cartoon');
  });

  it('a Japanese co-production of animation is Anime, not Cartoon', () => {
    expect(
      deriveFavouriteCategory({
        original_language: 'en',
        origin_country: ['US', 'JP'],
        genre_ids: [16],
      }),
    ).toBe('Anime');
  });

  it('animation with no origin at all is undecided, not Cartoon', () => {
    // Could be Anime or Cartoon; nothing here can tell them apart.
    expect(deriveFavouriteCategory({ genre_ids: [16] })).toBe(null);
  });

  it('a genre alone is not enough to decide', () => {
    expect(deriveFavouriteCategory({ genre_ids: [18] })).toBe(null);
  });

  it('country and genre without a language is not enough to decide', () => {
    // The case that would otherwise overrule a correct stored 'Hollywood':
    // nothing here can produce Hollywood, so a confident 'Others' would be
    // worse than admitting the facts are thin.
    expect(
      deriveFavouriteCategory({ origin_country: ['US'], genre_ids: [28] }),
    ).toBe(null);
  });

  it('a bucketless country alone is not enough to decide', () => {
    expect(deriveFavouriteCategory({ origin_country: ['FR'] })).toBe(null);
  });
});

describe('isFavouriteCategory', () => {
  it('accepts every bucket, including the newest', () => {
    for (const cat of [
      'Bollywood',
      'Hollywood',
      'Anime',
      'Cartoon',
      'K-Drama',
      'Others',
    ]) {
      expect(isFavouriteCategory(cat)).toBe(true);
    }
  });

  it('rejects a stale stored value, null, undefined and empty', () => {
    expect(isFavouriteCategory('Drama')).toBe(false);
    expect(isFavouriteCategory('hollywood')).toBe(false);
    expect(isFavouriteCategory(null)).toBe(false);
    expect(isFavouriteCategory(undefined)).toBe(false);
    expect(isFavouriteCategory('')).toBe(false);
  });
});

describe('resolveFavouriteCategory', () => {
  it('prefers the derivation over the stored string', () => {
    expect(
      resolveFavouriteCategory({ original_language: 'ko' }, 'Others'),
    ).toBe('K-Drama');
  });

  it('falls back to the stored string when the facts are thin', () => {
    expect(resolveFavouriteCategory({}, 'Bollywood')).toBe('Bollywood');
  });

  it('keeps a correct stored value when partial facts cannot decide', () => {
    expect(
      resolveFavouriteCategory(
        { origin_country: ['US'], genre_ids: [28] },
        'Hollywood',
      ),
    ).toBe('Hollywood');
  });

  it('falls through a stale stored value to Others', () => {
    expect(resolveFavouriteCategory({}, 'Drama')).toBe('Others');
  });

  it('is Others with neither facts nor a stored value', () => {
    expect(resolveFavouriteCategory({})).toBe('Others');
    expect(resolveFavouriteCategory({}, null)).toBe('Others');
  });
});
