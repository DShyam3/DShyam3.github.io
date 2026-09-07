/**
 * Collapse a burst of saves into one write.
 *
 * The review queue can be driven from the keyboard, so holding `r` walks the
 * list marking rows. Each mark rewrites the whole transactions array, and
 * without this that is one full upsert per keystroke.
 *
 * Local state is untouched -- the UI still updates on every press. Only the
 * trip to Supabase waits, which is safe here because these saves are
 * idempotent whole-collection upserts: the last one contains every earlier
 * one.
 */

import { useCallback, useEffect, useRef } from 'react';

export function useCoalescedSave<T>(save: (value: T) => void, delayMs = 800) {
  // Held in a ref so a caller passing an inline arrow does not restart the
  // timer on every render.
  const saveRef = useRef(save);
  saveRef.current = save;

  const timer = useRef<number | null>(null);
  const pending = useRef<{ value: T } | null>(null);

  const flush = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    if (pending.current) {
      const { value } = pending.current;
      pending.current = null;
      saveRef.current(value);
    }
  }, []);

  const schedule = useCallback((value: T) => {
    pending.current = { value };
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(flush, delayMs);
  }, [delayMs, flush]);

  useEffect(() => {
    // Leaving the page or the surface must not silently drop the last edit.
    // A pending write is at most `delayMs` old, so this is a short race, but
    // it is the difference between a lost review and a saved one.
    const onLeave = () => flush();
    window.addEventListener('beforeunload', onLeave);
    return () => {
      window.removeEventListener('beforeunload', onLeave);
      flush();
    };
  }, [flush]);

  return schedule;
}
