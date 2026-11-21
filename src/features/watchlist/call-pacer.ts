/**
 * Holds each caller until its call fits under `limit` calls in any rolling
 * `windowMs`. A rolling window also bounds every fixed clock minute, which is
 * how tmdb-proxy counts, so a pacer set below the proxy's limit leaves the
 * difference free for calls that do not go through it.
 *
 * A caller may pass a lower `ceiling` of its own: it waits while that many
 * calls are already in the window, so a long background job cannot take the
 * whole limit from callers that pass none.
 */
export function createCallPacer(
  limit: number,
  windowMs: number,
  // Monotonic: a wall clock stepping back would hold every caller.
  now: () => number = () => performance.now(),
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
): (ceiling?: number) => Promise<void> {
  const recent: number[] = [];
  return async function slot(ceiling = limit) {
    const cap = Math.max(1, Math.min(ceiling, limit));
    for (;;) {
      const at = now();
      while (recent.length > 0 && at - recent[0] >= windowMs) recent.shift();
      if (recent.length < cap) {
        recent.push(at);
        return;
      }
      // The window frees its oldest call first; wait for as many to leave as
      // this caller needs.
      await sleep(windowMs - (at - recent[recent.length - cap]));
    }
  };
}
