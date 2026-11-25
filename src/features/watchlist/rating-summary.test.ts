import { describe, expect, it } from 'vitest';
import { summarizeExternalScores, summarizeRatings } from './rating-summary';

describe('summarizeRatings', () => {
  it('keeps an empty or entirely unrated average absent', () => {
    expect(summarizeRatings([])).toEqual({ average: null, rated: 0, total: 0 });
    expect(summarizeRatings([null, undefined])).toEqual({ average: null, rated: 0, total: 2 });
  });

  it('does not treat unrated episodes as zero', () => {
    expect(summarizeRatings([8, null, 9, undefined])).toEqual({ average: 8.5, rated: 2, total: 4 });
  });

  it('includes half-point endpoints and counts all rated episodes', () => {
    expect(summarizeRatings([0.5, 10, 7.5])).toEqual({ average: 6, rated: 3, total: 3 });
  });

  it('rounds the average to one decimal', () => {
    expect(summarizeRatings([8, 8, 9])).toEqual({ average: 8.3, rated: 3, total: 3 });
    expect(summarizeRatings([8, 8.5])).toEqual({ average: 8.3, rated: 2, total: 2 });
  });

  it('excludes invalid scores rather than rounding them into valid ratings', () => {
    const values = [0, -1, 10.5, NaN, Infinity, -Infinity, 7.49, 7.51, 8] as const;
    expect(summarizeRatings(values)).toEqual({ average: 8, rated: 1, total: 9 });
  });
});

describe('summarizeExternalScores', () => {
  it('returns null average and zero count when empty or unscored', () => {
    expect(summarizeExternalScores([])).toEqual({ average: null, count: 0 });
    expect(summarizeExternalScores([null, undefined, 0])).toEqual({ average: null, count: 0 });
  });

  it('accepts tenth-point IMDb and TMDB scores and ignores missing entries', () => {
    expect(summarizeExternalScores([8.7, null, 9.1, undefined, 7.4])).toEqual({
      average: 8.4,
      count: 3,
    });
  });

  it('includes valid bounds above zero through ten and rounds to one decimal', () => {
    expect(summarizeExternalScores([0.1, 10])).toEqual({ average: 5.1, count: 2 });
    expect(summarizeExternalScores([8.1, 8.2, 8.2])).toEqual({ average: 8.2, count: 3 });
  });

  it('filters out zero, negative, out-of-range, and non-finite numbers', () => {
    const values = [0, -2.5, 10.1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 8.7] as const;
    expect(summarizeExternalScores(values)).toEqual({ average: 8.7, count: 1 });
  });
});
