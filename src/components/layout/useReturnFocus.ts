import { useMemo, useRef } from 'react';

/**
 * Remembers what had focus when a Radix dialog opened and gives focus back to
 * it on close.
 *
 * Radix does this itself only for a dialog opened by its own `Trigger`. The
 * palette and the inspector sheet are opened from several places and from the
 * keyboard, so there is no trigger and focus would otherwise fall to `<body>`.
 */
/**
 * A menu item unmounts with its menu, so a dialog opened from one returns
 * focus to the button that opened the menu (Radix labels the menu by it).
 */
function lasting(element: HTMLElement): HTMLElement {
  const menu = element.closest<HTMLElement>('[role="menu"]');
  const triggerId = menu?.getAttribute('aria-labelledby');
  const trigger = triggerId ? document.getElementById(triggerId) : null;
  return trigger ?? element;
}

export function useReturnFocus() {
  const openerRef = useRef<HTMLElement | null>(null);
  const ifGoneRef = useRef<(() => HTMLElement | null) | null>(null);

  // Stable across renders: the methods only touch refs, and a caller may
  // list one in a hook's dependencies.
  return useMemo(() => ({
    /**
     * Call from `onOpenAutoFocus`, before focus has moved into the dialog.
     * `fallback` is used when nothing in particular has focus -- as when a
     * dialog opens because the element that had it was just hidden.
     * `ifGone` is where focus goes on close when the opener has left the
     * page, as a delete or reset button does once it has done its work.
     */
    remember: (fallback?: () => HTMLElement | null, ifGone?: () => HTMLElement | null) => {
      const active = document.activeElement;
      openerRef.current = active instanceof HTMLElement && active !== document.body
        ? lasting(active)
        : fallback?.() ?? null;
      ifGoneRef.current = ifGone ?? null;
    },
    /**
     * Drop the opener, for a close that moves the visitor somewhere else:
     * focus should follow them to the new page, not jump back.
     */
    forget: () => {
      openerRef.current = null;
      ifGoneRef.current = null;
    },
    /** Pass as `onCloseAutoFocus`. */
    restore: (event: Event) => {
      const opener = openerRef.current;
      const ifGone = ifGoneRef.current;
      openerRef.current = null;
      ifGoneRef.current = null;
      const target = opener?.isConnected ? opener : ifGone?.() ?? null;
      if (!target?.isConnected) return;
      event.preventDefault();
      target.focus();
    },
  }), []);
}
