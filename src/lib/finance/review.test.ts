import { describe, expect, it } from 'vitest';
import { reviewKeyAction } from './review';

const ids = ['a', 'b', 'c'];

describe('reviewKeyAction', () => {
  it('does nothing on an empty list', () => {
    for (const key of ['j', 'k', 'r', 'x', 'a', 'Escape']) {
      expect(reviewKeyAction(key, [], null)).toBeNull();
    }
  });

  it('ignores keys it does not own', () => {
    expect(reviewKeyAction('q', ids, 'a')).toBeNull();
    expect(reviewKeyAction('Enter', ids, 'a')).toBeNull();
  });

  it('enters the list from the near end', () => {
    expect(reviewKeyAction('j', ids, null)).toEqual({ kind: 'focus', id: 'a' });
    expect(reviewKeyAction('k', ids, null)).toEqual({ kind: 'focus', id: 'c' });
  });

  it('treats a cursor that filtering removed as no cursor', () => {
    expect(reviewKeyAction('j', ids, 'gone')).toEqual({ kind: 'focus', id: 'a' });
    // No row to act on, so marking and ticking must not guess at one.
    expect(reviewKeyAction('r', ids, 'gone')).toBeNull();
    expect(reviewKeyAction('x', ids, 'gone')).toBeNull();
  });

  it('moves with both j/k and the arrows', () => {
    expect(reviewKeyAction('j', ids, 'a')).toEqual({ kind: 'focus', id: 'b' });
    expect(reviewKeyAction('ArrowDown', ids, 'a')).toEqual({ kind: 'focus', id: 'b' });
    expect(reviewKeyAction('k', ids, 'b')).toEqual({ kind: 'focus', id: 'a' });
    expect(reviewKeyAction('ArrowUp', ids, 'b')).toEqual({ kind: 'focus', id: 'a' });
  });

  it('clamps at both ends rather than wrapping', () => {
    expect(reviewKeyAction('j', ids, 'c')).toEqual({ kind: 'focus', id: 'c' });
    expect(reviewKeyAction('k', ids, 'a')).toEqual({ kind: 'focus', id: 'a' });
  });

  it('advances after marking so the key can be held', () => {
    expect(reviewKeyAction('r', ids, 'a')).toEqual({ kind: 'review', id: 'a', then: 'b' });
  });

  it('marks the last row without moving off it', () => {
    expect(reviewKeyAction('r', ids, 'c')).toEqual({ kind: 'review', id: 'c', then: null });
  });

  it('ticks the focused row only', () => {
    expect(reviewKeyAction('x', ids, 'b')).toEqual({ kind: 'select', id: 'b' });
  });

  it('takes the whole list and clears, with or without a cursor', () => {
    expect(reviewKeyAction('a', ids, null)).toEqual({ kind: 'selectAll' });
    expect(reviewKeyAction('a', ids, 'b')).toEqual({ kind: 'selectAll' });
    expect(reviewKeyAction('Escape', ids, null)).toEqual({ kind: 'clear' });
  });

  it('handles a single-row list', () => {
    expect(reviewKeyAction('j', ['only'], 'only')).toEqual({ kind: 'focus', id: 'only' });
    expect(reviewKeyAction('r', ['only'], 'only')).toEqual({ kind: 'review', id: 'only', then: null });
  });
});
