/**
 * What a keystroke means in the review queue.
 *
 * The DOM half of this -- which element has focus, whether a dialog is open,
 * how the list scrolls -- lives in the hook. This is the decision alone, so it
 * can be tested the way the rest of lib/finance is: call it with a key and a
 * list, assert on what comes back.
 */

export type ReviewAction =
  /** Move the cursor. */
  | { kind: 'focus'; id: string }
  /** Toggle reviewed on `id`, then land on `then` (null = stay put). */
  | { kind: 'review'; id: string; then: string | null }
  /** Toggle the tick box on `id`. */
  | { kind: 'select'; id: string }
  | { kind: 'selectAll' }
  | { kind: 'clear' }
  | null;

/**
 * `focusedId` may be absent (nothing picked yet) or stale (the row was
 * filtered out from under the cursor). Both are treated as "no position", so
 * the first movement key lands on an end of the list rather than doing nothing.
 */
export function reviewKeyAction(
  key: string,
  orderedIds: readonly string[],
  focusedId: string | null,
): ReviewAction {
  if (orderedIds.length === 0) return null;

  const index = focusedId ? orderedIds.indexOf(focusedId) : -1;
  const at = (i: number): ReviewAction => ({ kind: 'focus', id: orderedIds[i] });
  const step = (delta: number): ReviewAction => {
    if (index === -1) return at(delta > 0 ? 0 : orderedIds.length - 1);
    // Clamped, not wrapped: hitting the end of a queue should feel like the
    // end of the queue, not silently send you back to the top.
    return at(Math.min(orderedIds.length - 1, Math.max(0, index + delta)));
  };

  switch (key) {
    case 'j':
    case 'ArrowDown':
      return step(1);
    case 'k':
    case 'ArrowUp':
      return step(-1);
    case 'r':
      if (index === -1) return null;
      return {
        kind: 'review',
        id: orderedIds[index],
        // Advance after marking, so holding r walks the queue instead of
        // flipping one row on and off.
        then: index < orderedIds.length - 1 ? orderedIds[index + 1] : null,
      };
    case 'x':
      return index === -1 ? null : { kind: 'select', id: orderedIds[index] };
    case 'a':
      return { kind: 'selectAll' };
    case 'Escape':
      return { kind: 'clear' };
    default:
      return null;
  }
}
