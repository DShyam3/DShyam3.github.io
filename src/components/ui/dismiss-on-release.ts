import type React from 'react';

/** Marks a backdrop that dismisses its layer on release. */
export const DISMISS_OVERLAY_ATTR = 'data-dismiss-overlay';

/**
 * Makes an overlay dismiss on the *release* of a tap or click, never the press.
 *
 * Radix closes a modal layer on `pointerdown` for a mouse. Dialogs here skip
 * their exit animation, so the overlay unmounts mid-click and the `click` that
 * follows lands on whatever sat underneath -- clicking outside a recipe card
 * closed it and opened the card behind. So the press is ignored (see
 * `ignoreOverlayPointerDown`) and the overlay closes from its own `click`,
 * which it still owns because it is still mounted.
 *
 * Touch needs one more step: iOS Safari only synthesises a click on elements
 * it treats as interactive, which a bare backdrop div is not, so a tap outside
 * did nothing on an iPad. `touchend` fires the click itself and cancels the
 * browser's own, so no ghost click reaches the page once the overlay is gone.
 *
 * Wrap the overlay in the primitive's `Close` and spread these props onto it.
 *
 * @param onTouchEnd any handler the caller passed through, run first
 */
export function dismissOnRelease<T extends HTMLElement>(
  onTouchEnd?: React.TouchEventHandler<T>,
): { [DISMISS_OVERLAY_ATTR]: ''; onTouchEnd: React.TouchEventHandler<T> } {
  return {
    [DISMISS_OVERLAY_ATTR]: '',
    onTouchEnd: (event) => {
      onTouchEnd?.(event);
      // A touch that started on the overlay itself, never a caller-handled one.
      if (event.defaultPrevented || event.target !== event.currentTarget) return;
      event.preventDefault();
      event.currentTarget.click();
    },
  };
}

/**
 * Stops Radix dismissing on a press that landed on a release-dismiss overlay;
 * the overlay closes the layer on release instead. Presses anywhere else keep
 * Radix's behaviour.
 *
 * @param onPointerDownOutside any handler the caller passed through, run first
 */
export function ignoreOverlayPointerDown<E extends CustomEvent<{ originalEvent: PointerEvent }>>(
  onPointerDownOutside?: (event: E) => void,
): (event: E) => void {
  return (event) => {
    onPointerDownOutside?.(event);
    const target = event.detail.originalEvent.target;
    if (target instanceof Element && target.closest(`[${DISMISS_OVERLAY_ATTR}]`)) event.preventDefault();
  };
}
