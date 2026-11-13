import { useRef } from 'react';

/**
 * Remembers what had focus when a Radix dialog opened and gives focus back to
 * it on close.
 *
 * Radix does this itself only for a dialog opened by its own `Trigger`. The
 * palette and the inspector sheet are opened from several places and from the
 * keyboard, so there is no trigger and focus would otherwise fall to `<body>`.
 */
export function useReturnFocus() {
  const openerRef = useRef<HTMLElement | null>(null);

  return {
    /**
     * Call from `onOpenAutoFocus`, before focus has moved into the dialog.
     * `fallback` is used when nothing in particular has focus -- as when a
     * dialog opens because the element that had it was just hidden.
     */
    remember: (fallback?: () => HTMLElement | null) => {
      const active = document.activeElement;
      openerRef.current = active instanceof HTMLElement && active !== document.body
        ? active
        : fallback?.() ?? null;
    },
    /**
     * Drop the opener, for a close that moves the visitor somewhere else:
     * focus should follow them to the new page, not jump back.
     */
    forget: () => {
      openerRef.current = null;
    },
    /** Pass as `onCloseAutoFocus`. */
    restore: (event: Event) => {
      const opener = openerRef.current;
      openerRef.current = null;
      if (!opener?.isConnected) return;
      event.preventDefault();
      opener.focus();
    },
  };
}
