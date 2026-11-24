import { describe, expect, it } from 'vitest';
import { EMPTY_TASTE, type TasteProfile } from './taste-profile';
import { WILDCARD_MAX_SHARE, wildcardExcludedGenres, wildcardGenres, wildcardQuery } from './wildcards';

const profile = (genres: Record<number, number>): TasteProfile => ({
  genre: new Map(Object.entries(genres).map(([id, value]) => [Number(id), value])),
  decade: new Map(),
  language: new Map(),
});

// Films lean to Action, Adventure, Comedy; Drama and Thriller are watched
// too; Horror is turned away from; the rest are barely or never watched.
const films = profile({ 28: 0.2, 12: 0.18, 35: 0.16, 18: 0.1, 53: 0.06, 37: 0.01, 99: 0.03, 27: -0.05, 10749: -0.01 });

describe('wildcardGenres', () => {
  it('takes the genres under a quarter of the best-liked, least liked first', () => {
    const genres = wildcardGenres(films, 'movie');
    // 0.2 × 0.25 = 0.05: Thriller (0.06) is usual, Documentary (0.03) is not.
    expect(WILDCARD_MAX_SHARE).toBe(0.25);
    expect(genres).not.toEqual(expect.arrayContaining([28, 12, 35, 18, 53]));
    expect(genres).toEqual(expect.arrayContaining([37, 99, 10749]));
    expect(genres.indexOf(10749)).toBeLessThan(genres.indexOf(37));
    expect(genres.indexOf(37)).toBeLessThan(genres.indexOf(99));
  });

  it('never offers a genre the profile is turned away from', () => {
    expect(wildcardGenres(films, 'movie')).not.toContain(27);
  });

  it('reads a series genre that is two film genres as usual if either half is', () => {
    const series = profile({ 18: 0.3, 28: 0.2, 878: 0.01, 14: 0.01 });
    const genres = wildcardGenres(series, 'tv');
    expect(genres).not.toContain(10759); // Action & Adventure: Action is usual
    expect(genres).toContain(10765); // Sci-Fi & Fantasy: neither half is
    expect(genres).not.toContain(18);
  });

  it('reads a series genre as avoided if either half is', () => {
    const series = profile({ 18: 0.3, 878: -0.03, 14: 0.01 });
    expect(wildcardGenres(series, 'tv')).not.toContain(10765);
  });

  it('offers nothing while the profile likes nothing', () => {
    expect(wildcardGenres(EMPTY_TASTE, 'movie')).toEqual([]);
    expect(wildcardGenres(profile({ 27: -0.1 }), 'movie')).toEqual([]);
  });
});

describe('wildcardExcludedGenres', () => {
  it('rules out the three best-liked usual genres and every avoided one', () => {
    expect([...wildcardExcludedGenres(films)].sort((a, b) => a - b)).toEqual([12, 27, 28, 35]);
  });

  it('never rules out a genre that is itself outside the usual', () => {
    // Only Action is usual; Documentary is liked but a wildcard genre.
    const narrow = profile({ 28: 0.5, 99: 0.05 });
    expect([...wildcardExcludedGenres(narrow)]).toEqual([28]);
    expect(wildcardGenres(narrow, 'movie')).toContain(99);
  });
});

describe('wildcardQuery', () => {
  it('asks for one outside genre, well rated, without the usual or avoided genres', () => {
    const query = wildcardQuery(films, 'movie', 0, 0)!;
    const genres = wildcardGenres(films, 'movie');
    expect(query.genre).toBe(genres[0]);
    expect(query.params).toMatchObject({
      with_genres: String(genres[0]),
      without_genres: '12,27,28,35',
      'vote_average.gte': '7.5',
      'vote_count.gte': '500',
      sort_by: 'vote_count.desc',
      include_adult: 'false',
    });
    expect(query.name).toBe('Romance');
  });

  it('turns the genres over page by page and week by week, one turn each a visit', () => {
    const genres = wildcardGenres(films, 'movie');
    expect(wildcardQuery(films, 'movie', 1, 0)!.genre).toBe(genres[1]);
    expect(wildcardQuery(films, 'movie', 0, 1)!.genre).toBe(genres[1]);
    expect(wildcardQuery(films, 'movie', genres.length - 1, 1)!.genre).toBe(genres[0]);
    expect(wildcardQuery(films, 'movie', genres.length, 0)).toBeNull();
  });

  it('rules out series genres by their own ids', () => {
    const series = profile({ 18: 0.3, 28: 0.2, 12: 0.1, 99: 0.01 });
    const query = wildcardQuery(series, 'tv', 0, 0)!;
    // Drama, and Action & Adventure for Action and Adventure.
    expect(query.params.without_genres).toBe('18,10759');
    expect(query.params['vote_count.gte']).toBe('200');
  });

  it('rules out series-only genres that are usual or avoided', () => {
    const series = profile({ 18: 0.3, 10764: 0.25, 80: 0.2, 28: 0.01, 10767: -0.05 });
    expect(wildcardQuery(series, 'tv', 0, 0)!.params.without_genres).toBe('18,80,10764,10767');
  });

  it('names a series genre by its own name', () => {
    const series = profile({ 18: 0.3, 28: 0.2, 878: 0.01, 14: 0.01 });
    const genres = wildcardGenres(series, 'tv');
    const query = wildcardQuery(series, 'tv', genres.indexOf(10765), 0)!;
    expect(query.name).toBe('Sci-Fi & Fantasy');
  });

  it('is null when no genre is outside the usual', () => {
    expect(wildcardQuery(EMPTY_TASTE, 'movie', 0, 0)).toBeNull();
  });
});
