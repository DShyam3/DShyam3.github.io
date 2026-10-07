import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PROFILE_LOAD_LIMIT_MS, readProfilesWithDeadline, readProfilesWithRetry } from './profile-load';

describe('readProfilesWithDeadline', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('bounds an auth wait even when the read ignores abort', async () => {
    let querySignal: AbortSignal | undefined;
    const request = readProfilesWithDeadline(signal => {
      querySignal = signal;
      return new Promise(() => {});
    }, new AbortController().signal);
    const result = expect(request).rejects.toMatchObject({ name: 'TimeoutError' });
    await vi.advanceTimersByTimeAsync(PROFILE_LOAD_LIMIT_MS);
    await result;
    expect(querySignal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('never publishes a late success after timeout', async () => {
    let resolveRead!: (value: string[]) => void;
    const publish = vi.fn();
    const request = readProfilesWithDeadline(() => new Promise<string[]>(resolve => {
      resolveRead = resolve;
    }), new AbortController().signal).then(publish);
    const result = expect(request).rejects.toMatchObject({ name: 'TimeoutError' });
    await vi.advanceTimersByTimeAsync(PROFILE_LOAD_LIMIT_MS);
    await result;
    resolveRead(['late profile']);
    await Promise.resolve();
    expect(publish).not.toHaveBeenCalled();
  });

  it('returns successful rows and clears the timer and abort listener', async () => {
    const caller = new AbortController();
    const remove = vi.spyOn(caller.signal, 'removeEventListener');
    await expect(readProfilesWithDeadline(async () => ['profile'], caller.signal)).resolves.toEqual(['profile']);
    expect(vi.getTimerCount()).toBe(0);
    expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
  });

  it('propagates read rejection and cleans up', async () => {
    const failure = new Error('offline');
    await expect(readProfilesWithDeadline(() => Promise.reject(failure), new AbortController().signal)).rejects.toBe(failure);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('propagates a synchronous throw and cleans up', async () => {
    const failure = new Error('query construction failed');
    await expect(readProfilesWithDeadline(() => { throw failure; }, new AbortController().signal)).rejects.toBe(failure);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('cancels immediately even when the query ignores abort and answers later', async () => {
    const caller = new AbortController();
    let querySignal: AbortSignal | undefined;
    let resolveRead!: (value: string[]) => void;
    const publish = vi.fn();
    const request = readProfilesWithDeadline(signal => {
      querySignal = signal;
      return new Promise<string[]>(resolve => { resolveRead = resolve; });
    }, caller.signal).then(publish);
    const result = expect(request).rejects.toMatchObject({ name: 'AbortError' });
    await Promise.resolve();
    caller.abort();
    await result;
    resolveRead(['old user profile']);
    await Promise.resolve();
    expect(querySignal?.aborted).toBe(true);
    expect(publish).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not start a read for a previously cancelled caller', async () => {
    const caller = new AbortController();
    caller.abort();
    const read = vi.fn(async () => []);
    await expect(readProfilesWithDeadline(read, caller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    expect(read).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('leaves empty rows and API errors for the caller to present', async () => {
    await expect(readProfilesWithDeadline(async () => ({ data: [], error: null }), new AbortController().signal))
      .resolves.toEqual({ data: [], error: null });
    const result = { data: null, error: { message: 'permission denied' } };
    await expect(readProfilesWithDeadline(async () => result, new AbortController().signal)).resolves.toBe(result);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('readProfilesWithRetry', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const ok = { data: ['profile'], error: null };
  const failed = { data: null, error: { message: 'TypeError: Failed to fetch' } };

  it('retries an error result after each delay and returns the first success', async () => {
    const read = vi.fn()
      .mockResolvedValueOnce(failed)
      .mockResolvedValueOnce(failed)
      .mockResolvedValueOnce(ok);
    const request = readProfilesWithRetry(read, new AbortController().signal, [1_000, 3_000]);
    await vi.advanceTimersByTimeAsync(999);
    expect(read).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(read).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(3_000);
    await expect(request).resolves.toBe(ok);
    expect(read).toHaveBeenCalledTimes(3);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('returns the last error result once the retries run out', async () => {
    const read = vi.fn().mockResolvedValue(failed);
    const request = readProfilesWithRetry(read, new AbortController().signal, [1_000]);
    await vi.advanceTimersByTimeAsync(1_000);
    await expect(request).resolves.toBe(failed);
    expect(read).toHaveBeenCalledTimes(2);
  });

  it('retries a thrown failure, then rethrows the last one', async () => {
    const failure = new Error('offline');
    const read = vi.fn().mockRejectedValue(failure);
    const request = readProfilesWithRetry(read, new AbortController().signal, [1_000]);
    const result = expect(request).rejects.toBe(failure);
    await vi.advanceTimersByTimeAsync(1_000);
    await result;
    expect(read).toHaveBeenCalledTimes(2);
  });

  it('does not retry a missed deadline', async () => {
    const read = vi.fn(() => new Promise<typeof ok>(() => {}));
    const request = readProfilesWithRetry(read, new AbortController().signal, [1_000]);
    const result = expect(request).rejects.toMatchObject({ name: 'TimeoutError' });
    await vi.advanceTimersByTimeAsync(PROFILE_LOAD_LIMIT_MS + 1_000);
    await result;
    expect(read).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('stops waiting and never reads again once cancelled between attempts', async () => {
    const caller = new AbortController();
    const read = vi.fn().mockResolvedValue(failed);
    const request = readProfilesWithRetry(read, caller.signal, [1_000]);
    const result = expect(request).rejects.toMatchObject({ name: 'AbortError' });
    await vi.advanceTimersByTimeAsync(500);
    caller.abort();
    await result;
    await vi.advanceTimersByTimeAsync(1_000);
    expect(read).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});
