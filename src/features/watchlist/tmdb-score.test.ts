import { describe, expect, it } from 'vitest';
import {
  formatScore,
  formatVoteCount,
  pickCollection,
  pickTmdbEpisodeScores,
} from './tmdb-score';

describe('pickTmdbEpisodeScores', () => {
  it('normalises positive ratings to 1dp, caps at 10, and treats 0 or missing as null with >=0 votes', () => {
    expect(pickTmdbEpisodeScores({ vote_average: 8.76, vote_count: 342 })).toEqual({ tmdb_rating: 8.8, tmdb_votes: 342 });
    expect(pickTmdbEpisodeScores({ vote_average: 11.4, vote_count: 5 })).toEqual({ tmdb_rating: 10, tmdb_votes: 5 });
    expect(pickTmdbEpisodeScores({ vote_average: 0, vote_count: 0 })).toEqual({ tmdb_rating: null, tmdb_votes: 0 });
    expect(pickTmdbEpisodeScores({})).toEqual({ tmdb_rating: null, tmdb_votes: 0 });
    expect(pickTmdbEpisodeScores({ vote_average: -2, vote_count: -5 })).toEqual({ tmdb_rating: null, tmdb_votes: 0 });
  });
});

describe('pickCollection', () => {
  it('is undefined when the key is absent', () => {
    expect(pickCollection({})).toBeUndefined();
  });
  it('clears on an explicit null', () => {
    expect(pickCollection({ belongs_to_collection: null })).toEqual({ collection_id: null, collection_name: null });
  });
  it('clears on an invalid id', () => {
    expect(pickCollection({ belongs_to_collection: { id: 0, name: 'x' } })).toEqual({ collection_id: null, collection_name: null });
    expect(pickCollection({ belongs_to_collection: { name: 'x' } })).toEqual({ collection_id: null, collection_name: null });
  });
  it('returns id and trimmed name, null for a blank name', () => {
    expect(pickCollection({ belongs_to_collection: { id: 9, name: ' Saga ' } })).toEqual({ collection_id: 9, collection_name: 'Saga' });
    expect(pickCollection({ belongs_to_collection: { id: 9, name: ' ' } })).toEqual({ collection_id: 9, collection_name: null });
  });
});

describe('formatVoteCount', () => {
  it.each([
    [0, '0'],
    [999, '999'],
    [1000, '1k'],
    [1049, '1k'],
    [1250, '1.2k'],
    [9999, '9.9k'],
    [10000, '10k'],
    [12345, '12k'],
    [999999, '999k'],
    [1000000, '1M'],
    [1300000, '1.3M'],
  ])('%i -> %s', (n, out) => {
    expect(formatVoteCount(n)).toBe(out);
  });
});

describe('formatScore', () => {
  it('uses one decimal and drops .0', () => {
    expect(formatScore(7.4)).toBe('7.4');
    expect(formatScore(7)).toBe('7');
    expect(formatScore(10)).toBe('10');
  });
});
