import { describe, expect, it } from 'vitest';
import {
  formatScore,
  formatVoteCount,
  pickCollection,
  pickSeasonVote,
  pickTitleVotes,
  scoreLine,
} from './tmdb-score';

describe('pickTitleVotes', () => {
  it('returns undefined when vote_count is missing, so nothing is wiped', () => {
    expect(pickTitleVotes({})).toBeUndefined();
    expect(pickTitleVotes({ vote_average: 7 })).toBeUndefined();
    expect(pickTitleVotes({ vote_average: 7, vote_count: null })).toBeUndefined();
  });
  it('turns a zero average or zero count into a null average', () => {
    expect(pickTitleVotes({ vote_average: 0, vote_count: 12 })).toEqual({ tmdb_vote_average: null, tmdb_vote_count: 12 });
    expect(pickTitleVotes({ vote_average: 8, vote_count: 0 })).toEqual({ tmdb_vote_average: null, tmdb_vote_count: 0 });
    expect(pickTitleVotes({ vote_count: 5 })).toEqual({ tmdb_vote_average: null, tmdb_vote_count: 5 });
  });
  it('rounds to one decimal and clamps to 0-10', () => {
    expect(pickTitleVotes({ vote_average: 7.456, vote_count: 100 })).toEqual({ tmdb_vote_average: 7.5, tmdb_vote_count: 100 });
    expect(pickTitleVotes({ vote_average: 12, vote_count: 100 })?.tmdb_vote_average).toBe(10);
  });
});

describe('pickSeasonVote', () => {
  it('is undefined only for undefined', () => {
    expect(pickSeasonVote(undefined)).toBeUndefined();
  });
  it('nulls null, zero, negative and non-finite', () => {
    expect(pickSeasonVote(null)).toBeNull();
    expect(pickSeasonVote(0)).toBeNull();
    expect(pickSeasonVote(-1)).toBeNull();
    expect(pickSeasonVote(NaN)).toBeNull();
  });
  it('rounds a real score', () => {
    expect(pickSeasonVote(8.26)).toBe(8.3);
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

describe('scoreLine', () => {
  it('carries mine, tmdb and votes through', () => {
    expect(scoreLine(8, 7.4, 500)).toEqual({ mine: 8, tmdb: 7.4, votes: 500, fewVotes: false });
  });
  it('flags few votes below 50', () => {
    expect(scoreLine(8, 7, 49).fewVotes).toBe(true);
    expect(scoreLine(8, 7, 50).fewVotes).toBe(false);
    expect(scoreLine(8, 7, null).fewVotes).toBe(false);
  });
  it('treats a null or zero average as no TMDB score', () => {
    expect(scoreLine(8, 0, 10)).toMatchObject({ tmdb: null });
    expect(scoreLine(8, null, null)).toMatchObject({ tmdb: null, votes: null });
  });
});
