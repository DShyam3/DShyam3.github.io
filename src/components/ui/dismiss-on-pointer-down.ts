import type React from 'react';

/**
 * Makes an overlay dismiss on touch as well as with a mouse.
 *
 * Radix closes a layer on `pointerdown` for a mouse, but when
 * `pointerType === "touch"` it defers to the `click` that should follow -- and
 * iOS Safari only synthesises a click on elements it treats as interactive,
 * which a bare backdrop div is not. The result on an iPad was that tapping
 * outside a dialog or sheet did nothing at all.
 *
 * Wrap the overlay in the primitive's `Close` and give it this handler: the
 * click Radix is waiting for gets fired here instead of being left to Safari.
 *
 * @param onPointerDown any handler the caller passed through, run first
 */
export function dismissOnPointerDown<T extends HTMLElement>(
  onPointerDown?: React.PointerEventHandler<T>,
): React.PointerEventHandler<T> {
  return (event) => {
    onPointerDown?.(event);
    // Left button only, and never when the caller has already handled it.
    if (event.defaultPrevented || event.button !== 0) return;
    event.currentTarget.click();
  };
}
