/**
 * Runs `work` once the browser has nothing better to do, and returns a cancel
 * function for an effect's cleanup.
 *
 * Background warm-up goes through here so it never competes with the page the
 * user is actually looking at: the visible route renders and paints first,
 * then the idle callback fetches what the next click will need.
 */
export function whenIdle(work: () => void, timeout = 4000): () => void {
  if (typeof window.requestIdleCallback === 'function') {
    const handle = window.requestIdleCallback(work, { timeout });
    return () => window.cancelIdleCallback?.(handle);
  }
  // Safari has no requestIdleCallback. A plain timer after first paint is
  // close enough for background work.
  const timer = window.setTimeout(work, Math.min(timeout, 2000));
  return () => window.clearTimeout(timer);
}

/**
 * True when the visitor has asked their browser to save data (Chrome's Lite
 * mode, Android Data Saver). Warm-up is speculative by design, so it is the
 * first thing to drop for them; Safari and Firefox do not expose the flag.
 */
export const prefersSavedData = (): boolean =>
  (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;

/**
 * Starts a background chunk fetch. A failure is swallowed rather than left as
 * an unhandled rejection: nothing is waiting on a warm-up, and the click that
 * needs the chunk imports it again and reports through the route's own error
 * boundary.
 */
export const warmChunk = (load: () => Promise<unknown>): void => {
  load().catch(() => {});
};
