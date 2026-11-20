import { FunctionsHttpError } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));

const { detailRetry, detailRetryDelay, isRateLimited } = await import('./useTMDB');

const httpError = (status: number) => new FunctionsHttpError(new Response(null, { status }));

describe('TMDB detail lookups under the proxy rate limit', () => {
  it('recognises only a 429 as rate limited', () => {
    expect(isRateLimited(httpError(429))).toBe(true);
    expect(isRateLimited(httpError(404))).toBe(false);
    expect(isRateLimited(new Error('network'))).toBe(false);
  });

  it('retries a rate-limited lookup three times, then gives up', () => {
    expect([0, 1, 2, 3].map((failures) => detailRetry(failures, httpError(429)))).toEqual([true, true, true, false]);
  });

  it('fails a missing title at once', () => {
    expect(detailRetry(0, httpError(404))).toBe(false);
  });

  it('waits past a whole proxy minute, since every retry counts against it', () => {
    expect([0, 1, 2].map(detailRetryDelay)).toEqual([5_000, 20_000, 40_000]);
    expect([0, 1, 2].map(detailRetryDelay).reduce((sum, ms) => sum + ms, 0)).toBeGreaterThan(60_000);
  });
});
