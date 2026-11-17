import { describe, expect, it } from 'vitest';
import { countPlaces, PLACES_FALLBACK_TOTAL } from './memberships';

describe('countPlaces', () => {
  const places = { FR: 'Europe', GI: 'Europe', JP: 'Asia' };

  it('counts every visited place, territories included, out of every place in the dataset', () => {
    expect(countPlaces(['FR', 'GI'], places)).toEqual({ visited: 2, total: 3 });
  });

  it('counts a repeated code once, since the Travel page passes its rows as they are', () => {
    expect(countPlaces(['FR', 'FR'], places)).toEqual({ visited: 1, total: 3 });
  });

  it('falls back to the dataset size until the country list is in', () => {
    expect(countPlaces(['FR'], {})).toEqual({ visited: 1, total: PLACES_FALLBACK_TOTAL });
  });

  it('reads zero with no visits', () => {
    expect(countPlaces([], places)).toEqual({ visited: 0, total: 3 });
  });
});
