import type React from 'react';

/** Marks a backdrop that dismisses its layer on release. */
export const DISMISS_OVERLAY_ATTR = 'data-dismiss-overlay';

const touches = new WeakMap<HTMLElement, { id: number; x: number; y: number; moved: boolean }>();

/** Dismiss only a tap that began and ended on the backdrop, never a drag. */
export function dismissOnRelease<T extends HTMLElement>(
  onTouchEnd?: React.TouchEventHandler<T>,
): {
  [DISMISS_OVERLAY_ATTR]: '';
  onTouchStart: React.TouchEventHandler<T>;
  onTouchMove: React.TouchEventHandler<T>;
  onTouchCancel: React.TouchEventHandler<T>;
  onTouchEnd: React.TouchEventHandler<T>;
} {
  return {
    [DISMISS_OVERLAY_ATTR]: '',
    onTouchStart: (event) => {
      touches.delete(event.currentTarget);
      if (event.target !== event.currentTarget || event.touches.length !== 1) return;
      const touch = event.touches[0];
      touches.set(event.currentTarget, { id: touch.identifier, x: touch.clientX, y: touch.clientY, moved: false });
    },
    onTouchMove: (event) => {
      const start = touches.get(event.currentTarget);
      if (!start) return;
      const touch = Array.from(event.touches).find(t => t.identifier === start.id);
      if (!touch || event.touches.length !== 1 || Math.hypot(touch.clientX - start.x, touch.clientY - start.y) > 8) start.moved = true;
    },
    onTouchCancel: (event) => { touches.delete(event.currentTarget); },
    onTouchEnd: (event) => {
      onTouchEnd?.(event);
      const start = touches.get(event.currentTarget);
      touches.delete(event.currentTarget);
      if (event.defaultPrevented || event.target !== event.currentTarget) return;
      // Also suppress the compatibility click after a swipe or multi-touch.
      event.preventDefault();
      const end = Array.from(event.changedTouches).find(t => t.identifier === start?.id);
      if (!start || start.moved || !end || event.touches.length || Math.hypot(end.clientX - start.x, end.clientY - start.y) > 8) return;
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
