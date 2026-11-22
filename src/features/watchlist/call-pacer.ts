/**
 * Holds each caller until its call fits under `limit` calls in any rolling
 * `windowMs`. A rolling window also bounds every fixed clock minute, which is
 * how tmdb-proxy counts, so a pacer set below the proxy's limit leaves the
 * difference free for calls that do not go through it.
 *
 * A caller may name a `share`, a kind and its own limit: calls of that kind
 * then take at most that many places in the window, however quiet it is
 * otherwise, so they can never crowd out callers of another kind.
 */
export function createCallPacer(
  limit: number,
  windowMs: number,
  // Monotonic: a wall clock stepping back would hold every caller.
  now: () => number = () => performance.now(),
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
): (share?: { kind: string; limit: number }) => Promise<void> {
  const recent: { at: number; kind: string | undefined }[] = [];
  return async function slot(share) {
    const kind = share?.kind;
    const cap = Math.max(1, Math.min(share?.limit ?? limit, limit));
    for (;;) {
      const at = now();
      while (recent.length > 0 && at - recent[0].at >= windowMs) recent.shift();
      const own = kind === undefined ? [] : recent.filter((call) => call.kind === kind);
      if (recent.length < limit && own.length < cap) {
        recent.push({ at, kind });
        return;
      }
      // Wait until enough of the oldest calls leave the window: overall, and
      // of this caller's kind.
      const until: number[] = [];
      if (recent.length >= limit) until.push(recent[recent.length - limit].at);
      if (own.length >= cap) until.push(own[own.length - cap].at);
      await sleep(windowMs - (at - Math.max(...until)));
    }
  };
}
