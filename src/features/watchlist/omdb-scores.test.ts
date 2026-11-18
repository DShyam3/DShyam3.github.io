import { describe, expect, it } from 'vitest';
import { isImdbId, parseOmdbResponse } from './omdb-scores';

const full = {
  Response: 'True',
  imdbRating: '7.8',
  imdbVotes: '1,234,567',
  Metascore: '84',
  Ratings: [
    { Source: 'Internet Movie Database', Value: '7.8/10' },
    { Source: 'Rotten Tomatoes', Value: '91%' },
    { Source: 'Metacritic', Value: '84/100' },
  ],
};

describe('isImdbId', () => {
  it('accepts tt followed by 7 to 10 digits', () => {
    expect(isImdbId('tt0111161')).toBe(true);
    expect(isImdbId('tt1234567')).toBe(true);
    expect(isImdbId('tt1234567890')).toBe(true);
    expect(isImdbId('tt12345678901')).toBe(false);
  });

  it('rejects everything else', () => {
    expect(isImdbId('tt123456')).toBe(false);
    expect(isImdbId('nm0000001')).toBe(false);
    expect(isImdbId(' tt0111161')).toBe(false);
    expect(isImdbId('tt0111161\n')).toBe(false);
    expect(isImdbId(null)).toBe(false);
    expect(isImdbId(undefined)).toBe(false);
    expect(isImdbId(111161)).toBe(false);
  });
});

describe('parseOmdbResponse failures', () => {
  it('maps the daily limit to limit, case-insensitively', () => {
    expect(parseOmdbResponse({ Response: 'False', Error: 'Daily request limit reached!' })).toEqual({ kind: 'limit' });
    expect(parseOmdbResponse({ Response: 'False', Error: 'REQUEST LIMIT REACHED' })).toEqual({ kind: 'limit' });
  });

  it('maps unknown titles to not-found', () => {
    expect(parseOmdbResponse({ Response: 'False', Error: 'Incorrect IMDb ID.' })).toEqual({ kind: 'not-found' });
    expect(parseOmdbResponse({ Response: 'False', Error: 'Movie not found!' })).toEqual({ kind: 'not-found' });
    expect(parseOmdbResponse({ Response: 'False', Error: 'Series NOT FOUND' })).toEqual({ kind: 'not-found' });
  });

  it('maps a bad key and anything else to error', () => {
    expect(parseOmdbResponse({ Response: 'False', Error: 'Invalid API key!' })).toEqual({
      kind: 'error',
      message: 'Invalid API key!',
    });
    expect(parseOmdbResponse({ Response: 'False' })).toEqual({ kind: 'error', message: 'OMDb returned an error' });
  });

  it('never throws on malformed input', () => {
    for (const bad of [null, undefined, 'x', 42, [], {}, { Response: 'Maybe' }]) {
      expect(parseOmdbResponse(bad).kind).toBe('error');
    }
  });
});

describe('parseOmdbResponse scores', () => {
  it('reads every field from a full response', () => {
    expect(parseOmdbResponse(full)).toEqual({
      kind: 'scores',
      scores: { imdb_rating: 7.8, imdb_votes: 1234567, rt_score: 91, metascore: 84 },
    });
  });

  it('turns N/A into null', () => {
    expect(parseOmdbResponse({ Response: 'True', imdbRating: 'N/A', imdbVotes: 'N/A', Metascore: 'N/A', Ratings: [] })).toEqual({
      kind: 'scores',
      scores: { imdb_rating: null, imdb_votes: null, rt_score: null, metascore: null },
    });
  });

  it('is still scores when every field is missing', () => {
    expect(parseOmdbResponse({ Response: 'True' })).toEqual({
      kind: 'scores',
      scores: { imdb_rating: null, imdb_votes: null, rt_score: null, metascore: null },
    });
  });

  it('falls back to the Ratings entries for IMDb and Metacritic', () => {
    const result = parseOmdbResponse({ ...full, imdbRating: 'N/A', Metascore: 'N/A' });
    expect(result).toEqual({
      kind: 'scores',
      scores: { imdb_rating: 7.8, imdb_votes: 1234567, rt_score: 91, metascore: 84 },
    });
  });

  it('prefers the top-level fields over the Ratings entries', () => {
    const result = parseOmdbResponse({
      ...full,
      imdbRating: '6.0',
      Metascore: '50',
    });
    expect(result).toEqual({
      kind: 'scores',
      scores: { imdb_rating: 6, imdb_votes: 1234567, rt_score: 91, metascore: 50 },
    });
  });

  it('handles a missing Ratings array', () => {
    expect(parseOmdbResponse({ Response: 'True', imdbRating: '5.5' })).toEqual({
      kind: 'scores',
      scores: { imdb_rating: 5.5, imdb_votes: null, rt_score: null, metascore: null },
    });
  });

  it('rounds the IMDb rating to one decimal and clamps it to 0-10', () => {
    const rating = (imdbRating: string) => {
      const out = parseOmdbResponse({ Response: 'True', imdbRating });
      return out.kind === 'scores' ? out.scores.imdb_rating : 'not scores';
    };
    expect(rating('7.84')).toBe(7.8);
    expect(rating('7.85')).toBe(7.9);
    expect(rating('11')).toBe(10);
    expect(rating('0')).toBe(0);
    expect(rating('abc')).toBeNull();
    expect(rating('-1')).toBeNull();
  });

  it('strips commas from votes and rejects junk', () => {
    const votes = (imdbVotes: unknown) => {
      const out = parseOmdbResponse({ Response: 'True', imdbVotes });
      return out.kind === 'scores' ? out.scores.imdb_votes : 'not scores';
    };
    expect(votes('987')).toBe(987);
    expect(votes('12,345')).toBe(12345);
    expect(votes('0')).toBe(0);
    expect(votes('1.5')).toBeNull();
    expect(votes('-5')).toBeNull();
    expect(votes('many')).toBeNull();
    expect(votes(1234)).toBeNull();
  });

  it('reads Rotten Tomatoes only from a percentage in range', () => {
    const rt = (Value: string) => {
      const out = parseOmdbResponse({ Response: 'True', Ratings: [{ Source: 'Rotten Tomatoes', Value }] });
      return out.kind === 'scores' ? out.scores.rt_score : 'not scores';
    };
    expect(rt('91%')).toBe(91);
    expect(rt('0%')).toBe(0);
    expect(rt('100%')).toBe(100);
    expect(rt('101%')).toBeNull();
    expect(rt('91')).toBeNull();
    expect(rt('N/A')).toBeNull();
  });

  it('rejects out-of-range metascores', () => {
    const meta = (Metascore: string, Ratings?: unknown) => {
      const out = parseOmdbResponse({ Response: 'True', Metascore, Ratings });
      return out.kind === 'scores' ? out.scores.metascore : 'not scores';
    };
    expect(meta('100')).toBe(100);
    expect(meta('0')).toBe(0);
    expect(meta('101')).toBeNull();
    expect(meta('N/A', [{ Source: 'Metacritic', Value: '72/100' }])).toBe(72);
    expect(meta('N/A', [{ Source: 'Metacritic', Value: '200/100' }])).toBeNull();
  });

  it('ignores malformed Ratings entries', () => {
    const out = parseOmdbResponse({ Response: 'True', Ratings: [null, 'x', { Source: 'Rotten Tomatoes' }, { Value: '5%' }] });
    expect(out).toEqual({
      kind: 'scores',
      scores: { imdb_rating: null, imdb_votes: null, rt_score: null, metascore: null },
    });
  });
});
