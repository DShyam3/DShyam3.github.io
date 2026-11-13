import { describe, expect, it } from 'vitest';
import { currentRole, dayNumber, featuredFavourite, travelFacts, type FavouriteTitle } from './fact-cards';

const fav = (id: number, title: string, tmdb_id: number | null): FavouriteTitle => ({
  id, title, tmdb_id, poster: null, media_type: 'movie',
});

describe('featuredFavourite', () => {
  const items = [fav(3, 'Wall-E', 10681), fav(1, 'Interstellar', 157336), fav(2, '3 Idiots', 20453)];

  it('shows the chosen title when it is still a favourite', () => {
    expect(featuredFavourite(items, '20453', 0)).toEqual({ item: items[2], chosen: true });
  });

  it('ignores whitespace around the stored id', () => {
    expect(featuredFavourite(items, ' 157336\n', 0)?.item.title).toBe('Interstellar');
  });

  it('falls back to the day pick when the chosen title was removed', () => {
    expect(featuredFavourite(items, '999', 0)).toEqual({ item: items[1], chosen: false });
  });

  it('turns over daily in id order, wrapping round the list', () => {
    expect([0, 1, 2, 3].map((day) => featuredFavourite(items, undefined, day)?.item.id)).toEqual([1, 2, 3, 1]);
  });

  it('copes with a day before the epoch', () => {
    expect(featuredFavourite(items, undefined, -1)?.item.id).toBe(3);
  });

  it('is null with no favourites', () => {
    expect(featuredFavourite([], '157336', 5)).toBeNull();
  });

  it('never matches a row with no TMDB id', () => {
    expect(featuredFavourite([fav(1, 'Untracked', null)], 'null', 0)?.chosen).toBe(false);
  });
});

describe('dayNumber', () => {
  it('counts whole UTC days', () => {
    expect(dayNumber(new Date('1970-01-02T00:00:00Z'))).toBe(1);
    expect(dayNumber(new Date('1970-01-02T23:59:59Z'))).toBe(1);
  });
});

describe('travelFacts', () => {
  // A stand-in for the UN set: buildMemberships only reads membership from it.
  const sovereign = new Set(['FR', 'GB', 'JP', 'VA', 'US']);
  const continents = { FR: 'Europe', GB: 'Europe', JP: 'Asia', VA: 'Europe', US: 'North America', GI: 'Europe' };

  it('counts UN states, territories and continents', () => {
    expect(travelFacts(['FR', 'GB', 'JP', 'VA', 'GI'], sovereign, continents)).toEqual({
      countries: 4, total: 195, territories: 1, continents: 2,
    });
  });

  it('counts a repeated code once', () => {
    expect(travelFacts(['FR', 'FR'], sovereign, continents)?.countries).toBe(1);
  });

  it('leaves a code with no continent out of the continent count', () => {
    expect(travelFacts(['FR', 'XX'], sovereign, continents)).toMatchObject({ countries: 1, territories: 1, continents: 1 });
  });

  it('waits for the country dataset rather than calling every visit a territory', () => {
    expect(travelFacts(['FR'], new Set(), continents)).toBeNull();
  });

  it('reads zero with no visits', () => {
    expect(travelFacts([], sovereign, continents)).toEqual({ countries: 0, total: 195, territories: 0, continents: 0 });
  });
});

describe('currentRole', () => {
  const role = (order: number, end_date: string) => ({ title: `R${order}`, company: 'C', start_date: '2020', end_date, order });

  it('takes the first ongoing role in timeline order', () => {
    expect(currentRole([role(2, 'Present'), role(0, 'June 2026'), role(1, 'present')])?.order).toBe(1);
  });

  it('is null when every role has ended or has no end date', () => {
    expect(currentRole([role(0, 'June 2026'), role(1, '')])).toBeNull();
  });
});
