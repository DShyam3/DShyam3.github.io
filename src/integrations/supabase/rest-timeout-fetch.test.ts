import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isRestTimeout, withRestTimeout } from './rest-timeout-fetch';

const PROJECT = 'https://x.supabase.co';

/** A fetch that never answers, but rejects when its signal aborts. */
const hangingFetch = vi.fn((_input: RequestInfo | URL, init?: RequestInit) =>
  new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true });
  }),
);

describe('withRestTimeout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    hangingFetch.mockClear();
  });
  afterEach(() => vi.useRealTimers());

  it('fails a database request on a dead connection after the limit, so the save queue moves on', async () => {
    const limited = withRestTimeout(hangingFetch as unknown as typeof fetch, PROJECT, 1_000);
    const request = limited(`${PROJECT}/rest/v1/finance_transactions?id=eq.1`, { method: 'PATCH' });
    const settled = expect(request).rejects.toMatchObject({ name: 'TimeoutError' });
    await vi.advanceTimersByTimeAsync(1_000);
    await settled;
  });

  it('leaves edge functions, storage and auth unlimited', async () => {
    const limited = withRestTimeout(hangingFetch as unknown as typeof fetch, PROJECT, 1_000);
    for (const url of [
      `${PROJECT}/functions/v1/truelayer-sync`,
      `${PROJECT}/storage/v1/object/finance-documents/a.pdf`,
      `${PROJECT}/auth/v1/token`,
    ]) {
      void limited(url);
      const init = hangingFetch.mock.calls.at(-1)?.[1];
      expect(init?.signal).toBeUndefined();
    }
  });

  it('still honours a caller\'s own abort', async () => {
    const limited = withRestTimeout(hangingFetch as unknown as typeof fetch, PROJECT, 60_000);
    const caller = new AbortController();
    const request = limited(`${PROJECT}/rest/v1/finance_goals`, { signal: caller.signal });
    const settled = expect(request).rejects.toBe('stopped');
    caller.abort('stopped');
    await settled;
  });

  it('keeps the limit running while the body is read', async () => {
    // Headers arrive, then the link dies mid-body.
    const stalling = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) =>
      new Response(new ReadableStream({
        start(stream) {
          init?.signal?.addEventListener('abort', () => stream.error(init.signal?.reason), { once: true });
        },
      })),
    );
    const limited = withRestTimeout(stalling as unknown as typeof fetch, PROJECT, 1_000);
    const request = limited(`${PROJECT}/rest/v1/finance_transactions`);
    const settled = expect(request).rejects.toMatchObject({ name: 'TimeoutError' });
    await vi.advanceTimersByTimeAsync(1_000);
    await settled;
  });

  it('marks its own abort so a save can tell it from other failures', async () => {
    const limited = withRestTimeout(hangingFetch as unknown as typeof fetch, PROJECT, 1_000);
    const settled = limited(`${PROJECT}/rest/v1/finance_goals`).catch((err: unknown) => err);
    await vi.advanceTimersByTimeAsync(1_000);
    const raw = await settled;
    expect(isRestTimeout(raw)).toBe(true);
    // As postgrest-js hands it back from a rejected fetch.
    expect(isRestTimeout({ message: `TimeoutError: ${(raw as Error).message}`, code: '' })).toBe(true);
    expect(isRestTimeout({ message: 'new row violates row-level security policy', code: '42501' })).toBe(false);
    expect(isRestTimeout(new DOMException('signal timed out', 'TimeoutError'))).toBe(false);
  });

  it('reports its own abort even when the browser rejects with a plain AbortError', async () => {
    const genericAbort = vi.fn((_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('The operation was aborted.', 'AbortError')), { once: true });
      }),
    );
    const limited = withRestTimeout(genericAbort as unknown as typeof fetch, PROJECT, 1_000);
    const settled = limited(`${PROJECT}/rest/v1/finance_goals`).catch((err: unknown) => err);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(isRestTimeout(await settled)).toBe(true);
  });

  it('builds the database prefix from a project URL that has a path', async () => {
    const limited = withRestTimeout(hangingFetch as unknown as typeof fetch, 'https://host.example/supabase', 1_000);
    void limited('https://host.example/supabase/rest/v1/finance_goals');
    expect(hangingFetch.mock.calls.at(-1)?.[1]?.signal).toBeInstanceOf(AbortSignal);
    void limited('https://host.example/supabase/storage/v1/object/a.pdf');
    expect(hangingFetch.mock.calls.at(-1)?.[1]?.signal).toBeUndefined();
  });

  it('passes a bodiless answer through', async () => {
    const noContent = vi.fn(async () => new Response(null, { status: 204, headers: { 'content-range': '*/0' } }));
    const limited = withRestTimeout(noContent as unknown as typeof fetch, PROJECT, 1_000);
    const response = await limited(`${PROJECT}/rest/v1/finance_goals`, { method: 'DELETE' });
    expect(response.status).toBe(204);
    expect(response.headers.get('content-range')).toBe('*/0');
  });

  it('matches the database path only, not the same text elsewhere in a URL', async () => {
    const limited = withRestTimeout(hangingFetch as unknown as typeof fetch, PROJECT, 1_000);
    for (const url of [
      `${PROJECT}/storage/v1/object/finance-documents/rest/v1/a.pdf`,
      `${PROJECT}/functions/v1/tmdb-proxy?path=/rest/v1/`,
    ]) {
      void limited(url);
      expect(hangingFetch.mock.calls.at(-1)?.[1]?.signal).toBeUndefined();
    }
  });

  it('lets go of a caller\'s signal once the request settles', async () => {
    const answering = vi.fn(async () => new Response('[]'));
    const limited = withRestTimeout(answering as unknown as typeof fetch, PROJECT, 1_000);
    const caller = new AbortController();
    const remove = vi.spyOn(caller.signal, 'removeEventListener');
    await limited(`${PROJECT}/rest/v1/finance_goals`, { signal: caller.signal });
    expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
  });

  it('clears its timer when the request answers', async () => {
    const answering = vi.fn(async () => new Response('[]'));
    const limited = withRestTimeout(answering as unknown as typeof fetch, PROJECT, 1_000);
    await limited(`${PROJECT}/rest/v1/finance_goals`);
    expect(vi.getTimerCount()).toBe(0);
  });
});
