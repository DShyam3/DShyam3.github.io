/**
 * Collapse a burst of saves into one write.
 *
 * The review queue can be driven from the keyboard, so holding `r` walks the
 * list marking rows. Each mark rewrites the whole transactions array, and
 * without this that is one full upsert per keystroke.
 *
 * Local state is untouched -- the UI still updates on every press. Only the
 * trip to Supabase waits. Each list is built from the one before, so the last
 * holds every earlier edit, and a save writes the rows an edit replaced.
 *
 * `registerFlush` lets a load send the pending list before it reads. Without
 * it a refresh inside the window replaced the rows on screen with copies that
 * lacked the pending edits: the next mark was built on those, the pending
 * list holding the earlier marks was thrown away unsent, and a later edit to
 * a row could send its unmarked copy back.
 */

import { useCallback, useEffect, useRef } from 'react';

export function useCoalescedSave<T>(
  save: (value: T) => void,
  { delayMs = 800, registerFlush }: { delayMs?: number; registerFlush?: (flush: () => void) => () => void } = {},
) {
  // Held in a ref so a caller passing an inline arrow does not restart the
  // timer on every render.
  const saveRef = useRef(save);
  saveRef.current = save;

  const timer = useRef<number | null>(null);
  // The save is captured with the value. `saveRef` follows the latest render,
  // so flushing through it after a profile switch would write one profile's
  // rows under the other's id.
  const pending = useRef<{ value: T; save: (value: T) => void } | null>(null);

  const flush = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    if (pending.current) {
      const { value, save: pendingSave } = pending.current;
      pending.current = null;
      pendingSave(value);
    }
  }, []);

  const schedule = useCallback((value: T) => {
    pending.current = { value, save: saveRef.current };
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(flush, delayMs);
  }, [delayMs, flush]);

  useEffect(() => registerFlush?.(flush), [registerFlush, flush]);

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
