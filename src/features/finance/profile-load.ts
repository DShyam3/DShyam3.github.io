/** Bound the whole profile query, including Supabase's pre-fetch token wait. */
export const PROFILE_LOAD_LIMIT_MS = 15_000;

export async function readProfilesWithDeadline<T>(
  read: (signal: AbortSignal) => PromiseLike<T>,
  caller: AbortSignal,
  limitMs = PROFILE_LOAD_LIMIT_MS,
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let cancel = () => {};
  const stopped = new Promise<never>((_resolve, reject) => {
    cancel = () => {
      const reason = caller.reason ?? new DOMException('Profile load cancelled.', 'AbortError');
      reject(reason);
      controller.abort(reason);
    };
    if (caller.aborted) {
      cancel();
      return;
    }
    caller.addEventListener('abort', cancel, { once: true });
    timer = setTimeout(() => {
      const reason = new DOMException('Finance profiles did not answer in time.', 'TimeoutError');
      reject(reason);
      controller.abort(reason);
    }, limitMs);
  });
  try {
    return await Promise.race([
      stopped,
      Promise.resolve().then(() => {
        // A cancelled operation must not start a request after a token wait.
        if (controller.signal.aborted) throw controller.signal.reason;
        return read(controller.signal);
      }),
    ]);
  } finally {
    clearTimeout(timer);
    caller.removeEventListener('abort', cancel);
  }
}

/** Waits before each automatic retry. A press of Try again starts the sequence over. */
export const PROFILE_LOAD_RETRY_DELAYS_MS: readonly number[] = [1_000, 3_000];

const pause = (ms: number, caller: AbortSignal) => new Promise<void>((resolve, reject) => {
  const cancelled = () => caller.reason ?? new DOMException('Profile load cancelled.', 'AbortError');
  if (caller.aborted) {
    reject(cancelled());
    return;
  }
  const onAbort = () => {
    clearTimeout(timer);
    reject(cancelled());
  };
  const timer = setTimeout(() => {
    caller.removeEventListener('abort', onAbort);
    resolve();
  }, ms);
  caller.addEventListener('abort', onAbort, { once: true });
});

/**
 * `readProfilesWithDeadline`, retried after a quick failure -- a dropped
 * connection or an error result -- so a blip does not need a click. A missed
 * deadline is not retried: it has already cost fifteen seconds, and Try again
 * is the faster way out. The last attempt's error result is returned as-is.
 */
export async function readProfilesWithRetry<T extends { error: unknown }>(
  read: (signal: AbortSignal) => PromiseLike<T>,
  caller: AbortSignal,
  delaysMs: readonly number[] = PROFILE_LOAD_RETRY_DELAYS_MS,
  limitMs = PROFILE_LOAD_LIMIT_MS,
): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    const last = attempt >= delaysMs.length;
    try {
      const result = await readProfilesWithDeadline(read, caller, limitMs);
      if (!result.error || last) return result;
    } catch (error) {
      const timedOut = error instanceof DOMException && error.name === 'TimeoutError';
      if (caller.aborted || timedOut || last) throw error;
    }
    await pause(delaysMs[attempt], caller);
  }
}
