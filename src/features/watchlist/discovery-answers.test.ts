import { describe, expect, it } from 'vitest';
import {
  SKIP_DAYS,
  answersHandover,
  hiddenFromSuggestionKeys,
  keySetHandover,
  mergeAnswers,
  notInterestedKeys,
  outranks,
  parseStoredAnswers,
  type DismissalAnswer,
} from './discovery-answers';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse('2026-11-22T12:00:00.000Z');
const daysAgo = (days: number) => new Date(NOW - days * DAY).toISOString();
const notInterested = (answeredAt = daysAgo(1)): DismissalAnswer => ({ reason: 'not_interested', source: 'you_might_like', answeredAt });
const skip = (answeredAt = daysAgo(1)): DismissalAnswer => ({ reason: 'skip', source: 'you_might_like', answeredAt });

describe('what each answer hides', () => {
  const answers = new Map([
    ['movie:1', notInterested(daysAgo(400))],
    ['movie:2', skip(daysAgo(10))],
    ['movie:3', skip(daysAgo(SKIP_DAYS + 1))],
  ]);

  it('hides Not interested everywhere, and never a skip', () => {
    expect(notInterestedKeys(answers)).toEqual(new Set(['movie:1']));
  });

  it('keeps skips out of suggestions only until they are SKIP_DAYS old', () => {
    expect(hiddenFromSuggestionKeys(answers, NOW)).toEqual(new Set(['movie:1', 'movie:2']));
  });
});

describe('outranks', () => {
  it('never lets a skip undo Not interested, however much later', () => {
    expect(outranks(skip(daysAgo(0)), notInterested(daysAgo(300)))).toBe(false);
    expect(outranks(notInterested(daysAgo(300)), skip(daysAgo(0)))).toBe(true);
  });

  it('otherwise takes the later answer', () => {
    expect(outranks(skip(daysAgo(1)), skip(daysAgo(50)))).toBe(true);
    expect(outranks(skip(daysAgo(50)), skip(daysAgo(1)))).toBe(false);
    expect(outranks(skip(daysAgo(1)), skip(daysAgo(1)))).toBe(false);
  });
});

describe('mergeAnswers', () => {
  it('keeps Not interested over a skip from either copy, and the later of two skips', () => {
    const remote = new Map([['movie:1', skip(daysAgo(5))], ['movie:2', notInterested(daysAgo(30))], ['movie:3', skip(daysAgo(40))]]);
    const local = new Map([['movie:1', notInterested(daysAgo(20))], ['movie:2', skip(daysAgo(1))], ['movie:3', skip(daysAgo(2))]]);
    const merged = mergeAnswers(remote, local);
    expect(merged.get('movie:1')?.reason).toBe('not_interested');
    // A later skip, given while the table's answer had not loaded, must not
    // weaken it.
    expect(merged.get('movie:2')).toEqual(notInterested(daysAgo(30)));
    expect(merged.get('movie:3')).toEqual(skip(daysAgo(2)));
  });
});

describe('answersHandover', () => {
  it('keeps a written answer in the browser until a read of the table has it', () => {
    // The race this guards: a read that began before the write finishes after
    // it, without the new row. The answer must stay local, so the title stays hidden.
    const local = new Map([['movie:331', notInterested()]]);
    expect(answersHandover(local, new Map([['movie:1', skip()]]), new Set(['movie:331']))).toEqual({ release: new Set(), send: [] });
    expect(answersHandover(local, new Map([['movie:331', notInterested()]]), new Set())).toEqual({ release: new Set(['movie:331']), send: [] });
  });

  it('sends what the table lacks, once, with why and where', () => {
    const local = new Map([['movie:331', notInterested()], ['movie:330', skip()], ['tv:44217', skip(daysAgo(2))]]);
    const { release, send } = answersHandover(local, new Map(), new Set(['movie:330']));
    expect(release.size).toBe(0);
    expect(send).toEqual([
      { media: 'movie', tmdb_id: 331, reason: 'not_interested', source: 'you_might_like', answered_at: daysAgo(1) },
      { media: 'tv', tmdb_id: 44217, reason: 'skip', source: 'you_might_like', answered_at: daysAgo(2) },
    ]);
  });

  it('sends a changed answer the table holds an older one for', () => {
    // A skip made Not interested later: the table's skip must be replaced.
    const local = new Map([['movie:7', notInterested(daysAgo(1))]]);
    const { release, send } = answersHandover(local, new Map([['movie:7', skip(daysAgo(30))]]), new Set());
    expect(release.size).toBe(0);
    expect(send.map((row) => row.reason)).toEqual(['not_interested']);
  });

  it('releases a local skip the table already holds as Not interested, without sending it', () => {
    const local = new Map([['movie:8', skip(daysAgo(0))]]);
    const { release, send } = answersHandover(local, new Map([['movie:8', notInterested(daysAgo(60))]]), new Set());
    expect(release).toEqual(new Set(['movie:8']));
    expect(send).toEqual([]);
  });

  it('releases answers that could never be written', () => {
    // 'movie:1.0' and 'movie:1:x' name the same row as 'movie:1'; sent
    // together, they would fail the whole upsert.
    const keys = ['book:1', 'movie:abc', 'movie:0', 'movie:1.0', 'movie:1:x'];
    const local = new Map(keys.map((key) => [key, notInterested()]));
    const { release, send } = answersHandover(local, undefined, new Set());
    expect([...release].sort()).toEqual([...keys].sort());
    expect(send).toEqual([]);
  });
});

describe('parseStoredAnswers', () => {
  it('reads the old list of bare keys as Not interested', () => {
    const answers = parseStoredAnswers(null, ['movie:1', 42], daysAgo(0));
    expect([...answers]).toEqual([['movie:1', { reason: 'not_interested', source: 'unknown', answeredAt: daysAgo(0) }]]);
  });

  it('prefers the current list, and drops entries it cannot read', () => {
    const current = [
      ['movie:1', skip()],
      ['movie:2', { reason: 'maybe', source: 'you_might_like', answeredAt: daysAgo(1) }],
      ['movie:3', { reason: 'skip', source: 'elsewhere', answeredAt: daysAgo(1) }],
      'movie:4',
      ['movie:5', { reason: 'skip', source: 'you_might_like', answeredAt: 'yesterday' }],
    ];
    const answers = parseStoredAnswers(current, ['movie:1'], daysAgo(0));
    expect(answers.get('movie:1')).toEqual(skip());
    expect(answers.has('movie:2')).toBe(false);
    expect(answers.get('movie:3')?.source).toBe('unknown');
    expect(answers.has('movie:4')).toBe(false);
    expect(answers.has('movie:5')).toBe(false);
  });
});

describe('keySetHandover', () => {
  it('keeps a key in the browser until a read of the table has it, and sends it once', () => {
    const local = new Set(['movie:1', 'tv:2']);
    expect(keySetHandover(local, new Set(['movie:1']), new Set(['tv:2']))).toEqual({ release: new Set(['movie:1']), send: [] });
    expect(keySetHandover(local, undefined, new Set())).toEqual({
      release: new Set(),
      send: [{ media: 'movie', tmdb_id: 1 }, { media: 'tv', tmdb_id: 2 }],
    });
  });

  it('releases keys that could never be written', () => {
    expect(keySetHandover(new Set(['book:1', 'movie:1.0']), undefined, new Set()).release).toEqual(new Set(['book:1', 'movie:1.0']));
  });
});
