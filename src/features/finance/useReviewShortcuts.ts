/**
 * Keyboard flow for the review queue.
 *
 * Reviewing is the one thing done daily and in volume -- 255 transactions is a
 * lot of trips to a button. This turns it into a loop that never leaves the
 * keyboard: move, mark, move.
 *
 * The meaning of each key lives in `reviewKeyAction`; what is left here is the
 * part that needs a DOM -- deciding when the list is even listening.
 */

import { useEffect } from 'react';
import { reviewKeyAction } from '@/lib/finance/review';

export interface ReviewShortcutHandlers {
  /** Ordered ids as currently shown, so the cursor follows sort and filter. */
  orderedIds: string[];
  focusedId: string | null;
  setFocusedId: (id: string | null) => void;
  toggleReviewed: (id: string) => void;
  toggleSelected: (id: string) => void;
  selectAll: () => void;
  clearSelection: () => void;
  /** Enter with nothing in particular focused opens the highlighted row. */
  open?: (id: string) => void;
  enabled?: boolean;
}

const isTypingTarget = (el: EventTarget | null): boolean => {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName.toLowerCase();
  // A closed Select takes letters as typeahead, so it counts as typing too.
  return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable
    || el.getAttribute('role') === 'combobox';
};

/**
 * Something open over the list that the keyboard is addressing: a dialog
 * (not one already sliding away -- it keeps its role until it has gone), or
 * an open Select or menu, whose typeahead takes letters.
 */
const OVERLAY_OPEN = '[role="dialog"]:not([data-state="closed"]), [role="listbox"][data-state="open"], [role="menu"][data-state="open"]';

export function useReviewShortcuts({
  orderedIds,
  focusedId,
  setFocusedId,
  toggleReviewed,
  toggleSelected,
  selectAll,
  clearSelection,
  open,
  enabled = true,
}: ReviewShortcutHandlers) {
  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (e: KeyboardEvent) => {
      // Leave the browser's own shortcuts alone: cmd+A must still select text.
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      // A key a dialog has already acted on (Radix marks the Escape that
      // closes one) is spent: closing a sheet must not also drop the cursor.
      if (e.defaultPrevented) return;
      // A bare letter has to stay a letter inside the search box.
      if (isTypingTarget(e.target)) return;
      // Radix portals overlays to the body root; while one is open the list
      // behind it is not what the keyboard is addressing.
      if (document.querySelector(OVERLAY_OPEN)) return;

      // A row handles its own Enter; this is Enter with focus nowhere in
      // particular, after J/K moved the highlight.
      if (e.key === 'Enter') {
        if (open && focusedId && (e.target === document.body || e.target === document.documentElement)) {
          e.preventDefault();
          open(focusedId);
        }
        return;
      }

      const action = reviewKeyAction(e.key, orderedIds, focusedId);
      if (!action) return;
      e.preventDefault();

      switch (action.kind) {
        case 'focus':
          return setFocusedId(action.id);
        case 'review':
          toggleReviewed(action.id);
          if (action.then) setFocusedId(action.then);
          return;
        case 'select':
          return toggleSelected(action.id);
        case 'selectAll':
          return selectAll();
        case 'clear':
          return clearSelection();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled, orderedIds, focusedId, setFocusedId, toggleReviewed, toggleSelected, selectAll, clearSelection, open]);
}
