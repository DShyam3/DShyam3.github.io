import { classifySupabaseRequest } from './api-usage-fetch';
import { hrefOf } from './rest-timeout-fetch';

/**
 * Database writes in flight, so a reader can wait for them to land.
 *
 * Finance's "Try again" (`FinanceSession`) mounts a fresh data provider after
 * a render failure, while the failed one's writes may still be in flight: a
 * transfer just confirmed, a payslip just saved. Read before they land, the
 * fresh provider would show the rows from before them. Most of those writes
 * go straight to the client rather than through the provider's save queue,
 * so the queue cannot answer for them; every write passes through here.
 *
 * A write is a request to a table (`/rest/v1/<table>`) other than GET or
 * HEAD. It counts as landed once it settles, failed or not: a failure has
 * nothing left to land, and a write this client gave up on for time
 * (`rest-timeout-fetch.ts`) cannot be waited for from here.
 *
 * Not counted: a write still waiting for supabase-js to read its session,
 * which happens before the request reaches fetch.
 */

/** Each write in flight, settled to `undefined` either way, with its table. */
const inFlight = new Map<Promise<void>, string>();

/** How long no write may be in flight before writes count as settled. A
 *  caller that sends a second write once its first lands (a reading, then
 *  the balance it changes) sends it only after supabase-js has read the
 *  session again, which waits on a browser lock: later than the next task,
 *  sooner than this. */
export const WRITE_QUIET_MS = 100;

const writesTo = (tablePrefix: string): Promise<void>[] =>
  [...inFlight].filter(([, table]) => table.startsWith(tablePrefix)).map(([write]) => write);

/** `supabaseUrl` is the project URL the client was created with. */
export const withWriteTracking = (fetchImpl: typeof fetch, supabaseUrl: string): typeof fetch =>
  (input, init) => {
    const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
    const target = method === 'GET' || method === 'HEAD' ? null : classifySupabaseRequest(hrefOf(input), supabaseUrl);
    if (target?.provider !== 'supabase_rest') return fetchImpl(input, init);
    const request = fetchImpl(input, init);
    const settled = request.then(() => undefined, () => undefined);
    inFlight.set(settled, target.endpoint);
    void settled.then(() => inFlight.delete(settled));
    return request;
  };

/** Whether a write to a table whose name starts with `tablePrefix` is in flight now. */
export const hasWritesInFlight = (tablePrefix: string): boolean => writesTo(tablePrefix).length > 0;

/**
 * Resolves once no write to a table whose name starts with `tablePrefix` has
 * been in flight for `WRITE_QUIET_MS`.
 */
export async function writesSettled(tablePrefix: string): Promise<void> {
  for (;;) {
    const pending = writesTo(tablePrefix);
    if (pending.length === 0) return;
    await Promise.all(pending);
    await new Promise(resolve => setTimeout(resolve, WRITE_QUIET_MS));
  }
}
