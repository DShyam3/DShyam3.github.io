/**
 * A hard limit on every database API request (`/rest/v1/`), body included.
 *
 * supabase-js sets no timeout, so a request on a dead connection -- a dropped
 * Wi-Fi link, a laptop that slept mid-save -- can hang indefinitely. Finance
 * saves are queued per collection, and a save that never settles holds every
 * later one behind it.
 *
 * Aborting only stops the browser waiting. A request that already reached the
 * server still runs there, for up to its pool wait plus the API roles' 8 s
 * statement timeout, so a write aborted here has an unknown outcome for a
 * while afterwards; `isRestTimeout` lets the save queue tell that apart from
 * a plain failure.
 *
 * Not covered: supabase-js refreshes an expired token through `/auth/v1/`
 * before the request is made, and a refresh on a dead link hangs before this
 * limit starts. That is deliberate -- aborting a refresh the server has
 * already rotated can end the session.
 *
 * Only `/rest/v1/` is limited: edge functions (a bank sync can take longer),
 * storage uploads and auth keep their own behaviour.
 */
export const REST_REQUEST_LIMIT_MS = 25_000;

// Statuses whose Response must be built with a null body.
const NULL_BODY_STATUSES = new Set([204, 205, 304]);

const TIMEOUT_MESSAGE = 'The database did not answer in time.';

/** True for this limit's abort, raw or as postgrest-js reports it
 *  (`{ message: 'TimeoutError: …' }`). A caller's own timeout is not it. */
export const isRestTimeout = (error: unknown): boolean => {
  const message = (error as { message?: unknown } | null)?.message;
  return typeof message === 'string' && message.includes(TIMEOUT_MESSAGE);
};

const hrefOf = (input: RequestInfo | URL): string =>
  typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

/** `supabaseUrl` is the project URL the client was created with; the REST
 *  prefix is built from it the way supabase-js builds it, so a URL with a
 *  path (self-hosted behind a prefix) still matches. */
export const withRestTimeout = (
  fetchImpl: typeof fetch,
  supabaseUrl: string,
  limitMs: number = REST_REQUEST_LIMIT_MS,
): typeof fetch => {
  const restPrefix = new URL('rest/v1/', supabaseUrl.endsWith('/') ? supabaseUrl : `${supabaseUrl}/`).href;
  return async (input, init) => {
    if (!hrefOf(input).startsWith(restPrefix)) return fetchImpl(input, init);
    const controller = new AbortController();
    const timeout = new DOMException(TIMEOUT_MESSAGE, 'TimeoutError');
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort(timeout);
    }, limitMs);
    // A caller's own signal (e.g. `.abortSignal(...)`) still aborts it.
    const outer = init?.signal;
    const forwardAbort = () => controller.abort(outer?.reason);
    if (outer?.aborted) forwardAbort();
    else outer?.addEventListener('abort', forwardAbort, { once: true });
    try {
      const response = await fetchImpl(input, { ...init, signal: controller.signal });
      // Headers are not the end of it: postgrest-js reads the body afterwards,
      // and a link that dies mid-body would hang that read with no limit. Read
      // it here, under the same timer, and hand back a finished response.
      const body = await response.arrayBuffer();
      return new Response(NULL_BODY_STATUSES.has(response.status) ? null : body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    } catch (err) {
      // Not every browser rejects with the abort's reason; some reject with a
      // plain AbortError. This limit's abort is rethrown as itself, so
      // `isRestTimeout` does not depend on how the browser reports it.
      throw timedOut ? timeout : err;
    } finally {
      clearTimeout(timer);
      outer?.removeEventListener('abort', forwardAbort);
    }
  };
};
