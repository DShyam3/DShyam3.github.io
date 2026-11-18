import { describe, expect, it } from 'vitest';
import {
  describeWatchedAt,
  isCalendarDate,
  isOnOrBefore,
  localNoonIso,
  setWatchedArgs,
  todayLocal,
} from './watched-when';

describe('isCalendarDate', () => {
  it('accepts real dates', () => {
    expect(isCalendarDate('2026-11-18')).toBe(true);
    expect(isCalendarDate('2028-02-29')).toBe(true);
  });
  it('rejects malformed and impossible dates', () => {
    expect(isCalendarDate('2026-02-30')).toBe(false);
    expect(isCalendarDate('2027-02-29')).toBe(false);
    expect(isCalendarDate('2026-13-01')).toBe(false);
    expect(isCalendarDate('2026-1-1')).toBe(false);
    expect(isCalendarDate('2026-11-18T00:00')).toBe(false);
    expect(isCalendarDate('')).toBe(false);
  });
});

describe('localNoonIso', () => {
  it('round-trips to the same local calendar day at noon', () => {
    const d = new Date(localNoonIso('2026-03-29'));
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 2, 29, 12]);
  });
  it('throws on an invalid date', () => {
    expect(() => localNoonIso('2026-02-30')).toThrow();
    expect(() => localNoonIso('nope')).toThrow();
  });
});

describe('isOnOrBefore', () => {
  it('compares dates', () => {
    expect(isOnOrBefore('2026-11-17', '2026-11-18')).toBe(true);
    expect(isOnOrBefore('2026-11-18', '2026-11-18')).toBe(true);
    expect(isOnOrBefore('2026-11-19', '2026-11-18')).toBe(false);
  });
});

describe('todayLocal', () => {
  it('formats the local date with padding', () => {
    expect(todayLocal(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });
  it('defaults to now', () => {
    expect(isCalendarDate(todayLocal())).toBe(true);
  });
});

describe('setWatchedArgs', () => {
  it('sends now, release and unknown with no timestamp', () => {
    for (const mode of ['now', 'release', 'unknown'] as const) {
      expect(setWatchedArgs('movie', [1, 2], true, { mode })).toEqual({
        p_kind: 'movie', p_ids: [1, 2], p_watched: true, p_when: mode, p_at: null,
      });
    }
  });
  it('sends local noon for a picked day', () => {
    expect(setWatchedArgs('episode', [3], true, { mode: 'at', date: '2026-05-01' })).toEqual({
      p_kind: 'episode', p_ids: [3], p_watched: true, p_when: 'at', p_at: localNoonIso('2026-05-01'),
    });
  });
  it('unwatching always sends now and no date', () => {
    expect(setWatchedArgs('movie', [4], false, { mode: 'at', date: '2026-05-01' })).toEqual({
      p_kind: 'movie', p_ids: [4], p_watched: false, p_when: 'now', p_at: null,
    });
  });
  it('throws on empty or bad ids and invalid dates', () => {
    expect(() => setWatchedArgs('movie', [], true, { mode: 'now' })).toThrow();
    expect(() => setWatchedArgs('movie', [0], true, { mode: 'now' })).toThrow();
    expect(() => setWatchedArgs('movie', [1.5], true, { mode: 'now' })).toThrow();
    expect(() => setWatchedArgs('movie', [-2], true, { mode: 'now' })).toThrow();
    expect(() => setWatchedArgs('movie', [1], true, { mode: 'at', date: '2026-02-30' })).toThrow();
  });
});

describe('describeWatchedAt', () => {
  it('is empty when not watched', () => {
    expect(describeWatchedAt('2026-11-12T12:00:00.000Z', false)).toBe('');
    expect(describeWatchedAt(null, false)).toBe('');
  });
  it('says the date is unknown when watched without one', () => {
    expect(describeWatchedAt(null, true)).toBe('Watched · date unknown');
    expect(describeWatchedAt(undefined, true)).toBe('Watched · date unknown');
  });
  it('formats the date', () => {
    expect(describeWatchedAt(localNoonIso('2026-11-12'), true)).toBe('Watched 12 Nov 2026');
    expect(describeWatchedAt(localNoonIso('2026-11-12'), true, 'en-US')).toBe('Watched Nov 12, 2026');
  });
});
