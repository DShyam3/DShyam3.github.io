import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hasWritesInFlight, WRITE_QUIET_MS, withWriteTracking, writesSettled } from './write-tracking-fetch';

const PROJECT = 'https://x.supabase.co';

/** Every request the fake fetch has not answered yet, across tests: the
 *  tracker's state is the module's, so one left in flight would hold the
 *  next test's wait. */
const unanswered = new Set<() => void>();

/** A fetch whose every request waits until the test answers it. */
function controlledFetch() {
  const pending: { resolve: () => void; reject: () => void }[] = [];
  const fetchImpl = (() =>
    new Promise<Response>((resolve, reject) => {
      const answer = () => resolve(new Response(null, { status: 204 }));
      unanswered.add(answer);
      pending.push({
        resolve: () => { unanswered.delete(answer); answer(); },
        reject: () => { unanswered.delete(answer); reject(new TypeError('Failed to fetch')); },
      });
    })) as typeof fetch;
  return { fetchImpl, pending, tracked: withWriteTracking(fetchImpl, PROJECT) };
}

/** Whether `promise` has settled once `ms` of timers have run. */
async function settledAfter(promise: Promise<unknown>, ms: number): Promise<boolean> {
  let settled = false;
  void promise.then(() => { settled = true; }, () => { settled = true; });
  await vi.advanceTimersByTimeAsync(ms);
  return settled;
}

describe('writesSettled', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(async () => {
    for (const answer of unanswered) answer();
    unanswered.clear();
    await vi.advanceTimersByTimeAsync(WRITE_QUIET_MS);
    vi.useRealTimers();
  });

  it('waits for a write in flight to land, so a fresh reader cannot read before it', async () => {
    const { pending, tracked } = controlledFetch();
    const write = tracked(`${PROJECT}/rest/v1/finance_transfer_links?on_conflict=id`, { method: 'POST' });
    expect(hasWritesInFlight('finance_')).toBe(true);

    const wait = writesSettled('finance_');
    expect(await settledAfter(wait, 1_000)).toBe(false);

    pending[0].resolve();
    await write;
    expect(await settledAfter(wait, WRITE_QUIET_MS)).toBe(true);
    expect(hasWritesInFlight('finance_')).toBe(false);
  });

  it('counts a failed write as landed', async () => {
    const { pending, tracked } = controlledFetch();
    const write = tracked(`${PROJECT}/rest/v1/finance_payslips`, { method: 'PATCH' });
    const wait = writesSettled('finance_');

    pending[0].reject();
    await expect(write).rejects.toThrow('Failed to fetch');
    expect(await settledAfter(wait, WRITE_QUIET_MS)).toBe(true);
  });

  it('waits for the write a caller sends once its first one lands, after the session lock', async () => {
    const { pending, tracked } = controlledFetch();
    // A reading, then the balance it changes. supabase-js reads the session
    // (a browser lock) before each request, so the second reaches fetch a
    // few milliseconds after the first lands.
    const save = (async () => {
      await tracked(`${PROJECT}/rest/v1/finance_debt_observations`, { method: 'POST' });
      await new Promise(resolve => setTimeout(resolve, 20));
      await tracked(`${PROJECT}/rest/v1/finance_debts?id=eq.1`, { method: 'PATCH' });
    })();
    const wait = writesSettled('finance_');

    pending[0].resolve();
    expect(await settledAfter(wait, WRITE_QUIET_MS)).toBe(false);
    expect(pending).toHaveLength(2);

    pending[1].resolve();
    await save;
    expect(await settledAfter(wait, WRITE_QUIET_MS)).toBe(true);
  });

  it('ignores reads, other tables, and requests outside the database tables', async () => {
    const { tracked } = controlledFetch();
    void tracked(`${PROJECT}/rest/v1/finance_transactions?select=*`);
    void tracked(`${PROJECT}/rest/v1/finance_transactions?select=*`, { method: 'HEAD' });
    void tracked(`${PROJECT}/rest/v1/watchlist_ratings`, { method: 'POST' });
    void tracked(`${PROJECT}/functions/v1/truelayer-sync`, { method: 'POST' });
    void tracked(`${PROJECT}/storage/v1/object/finance-documents/a.pdf`, { method: 'POST' });

    expect(hasWritesInFlight('finance_')).toBe(false);
    expect(await settledAfter(writesSettled('finance_'), 0)).toBe(true);
  });

  it('reads the method from a Request when no init is given', async () => {
    const { pending, tracked } = controlledFetch();
    const write = tracked(new Request(`${PROJECT}/rest/v1/finance_goals`, { method: 'DELETE' }));
    const wait = writesSettled('finance_');
    expect(await settledAfter(wait, 1_000)).toBe(false);

    pending[0].resolve();
    await write;
    expect(await settledAfter(wait, WRITE_QUIET_MS)).toBe(true);
  });
});
