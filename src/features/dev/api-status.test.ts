import { describe, expect, it } from 'vitest';
import {
  RANGE_MS,
  callBuckets,
  describeResult,
  isTimeout,
  liveWindow,
  serviceStatus,
  summarise,
  topEndpoints,
  type UsageRow,
} from './api-status';

const NOW = Date.parse('2026-11-20T12:30:00Z');
let nextId = 1;

const row = (overrides: Partial<UsageRow> & { minsAgo?: number }): UsageRow => {
  const { minsAgo = 0, ...rest } = overrides;
  return {
    id: nextId++,
    occurred_at: new Date(NOW - minsAgo * 60_000).toISOString(),
    provider: 'tmdb',
    endpoint: 'movie/:id',
    source: 'edge',
    status_code: 200,
    outcome: 'ok',
    duration_ms: 300,
    request_count: 1,
    ...rest,
  };
};

const service = { timeoutMs: 15_000, slowMs: 2_000 };

describe('isTimeout', () => {
  it('needs an error with no status that used most of the timeout', () => {
    expect(isTimeout(row({ outcome: 'error', status_code: null, duration_ms: 14_900 }), 15_000)).toBe(true);
    expect(isTimeout(row({ outcome: 'error', status_code: null, duration_ms: 400 }), 15_000)).toBe(false);
    expect(isTimeout(row({ outcome: 'error', status_code: 504, duration_ms: 15_000 }), 15_000)).toBe(false);
    expect(isTimeout(row({ outcome: 'error', status_code: null, duration_ms: 30_000 }), null)).toBe(false);
  });
});

describe('describeResult', () => {
  it('names each kind of answer', () => {
    expect(describeResult(row({}), 15_000)).toBe('OK (200)');
    expect(describeResult(row({ outcome: 'rate_limited', status_code: 429 }), 15_000)).toBe('Rate limited (429)');
    expect(describeResult(row({ outcome: 'error', status_code: 502 }), 15_000)).toBe('Error 502');
    expect(describeResult(row({ outcome: 'error', status_code: null, duration_ms: 25_000 }), 25_000)).toBe('Timed out after 25 s');
    expect(describeResult(row({ outcome: 'error', status_code: null, duration_ms: 50 }), 25_000)).toBe('No response');
  });
});

describe('serviceStatus', () => {
  it('is idle with no rows', () => {
    expect(serviceStatus([], service).health).toBe('idle');
  });

  it('is OK when the latest calls succeeded quickly, whatever failed long ago', () => {
    const status = serviceStatus([row({}), row({ minsAgo: 300, outcome: 'error', status_code: 500 })], service);
    expect(status.health).toBe('ok');
    expect(status.lastProblem?.status_code).toBe(500);
    expect(status.latestAvgMs).toBe(300);
  });

  it('judges only the latest burst, even when it is old', () => {
    const rows = [row({ minsAgo: 60 * 24 * 40, outcome: 'error', status_code: null, duration_ms: 15_000 })];
    expect(serviceStatus(rows, service).health).toBe('timed-out');
  });

  it('weights rows by the calls they stand for', () => {
    const rows = [row({ request_count: 99 }), row({ outcome: 'error', status_code: 500 })];
    const status = serviceStatus(rows, service);
    expect(status.health).toBe('some-errors');
    expect(status.reason).toBe('1 of the latest 100 calls failed');
  });

  it('is failing when most of the latest calls failed', () => {
    const rows = [row({ outcome: 'error', status_code: 500, request_count: 3 }), row({})];
    expect(serviceStatus(rows, service).health).toBe('failing');
  });

  it('reads timeouts as timing out rather than failing', () => {
    const rows = [row({ outcome: 'error', status_code: null, duration_ms: 15_000, request_count: 2 })];
    expect(serviceStatus(rows, service).health).toBe('timed-out');
  });

  it('puts a 429 ahead of everything else', () => {
    const rows = [row({ outcome: 'rate_limited', status_code: 429 }), row({ request_count: 50 })];
    expect(serviceStatus(rows, service).health).toBe('rate-limited');
  });

  it('is slow when OK answers average above the threshold', () => {
    const status = serviceStatus([row({ duration_ms: 2_500 })], service);
    expect(status.health).toBe('slow');
    expect(status.reason).toBe('Answering in 2.5 s, slow above 2 s');
  });

  it('uses the live window for near-limit and rate-limited', () => {
    expect(serviceStatus([row({})], service, { count: 50, cap: 60, resetsInSec: 10 }).health).toBe('near-limit');
    expect(serviceStatus([], service, { count: 60, cap: 60, resetsInSec: 10 }).health).toBe('rate-limited');
  });
});

describe('liveWindow', () => {
  const tmdb = { rateLimitPrefix: 'tmdb-proxy:', rateLimitCap: 60, windowSeconds: 60 };

  it('takes the busiest open window for the service', () => {
    const limits = [
      { key: 'tmdb-proxy:a', window_start: new Date(NOW - 30_000).toISOString(), count: 12 },
      { key: 'tmdb-proxy:b', window_start: new Date(NOW - 50_000).toISOString(), count: 20 },
      { key: 'tmdb-proxy:c', window_start: new Date(NOW - 90_000).toISOString(), count: 59 },
      { key: 'truelayer-sync:x', window_start: new Date(NOW - 10_000).toISOString(), count: 1 },
    ];
    expect(liveWindow(tmdb, limits, NOW)).toEqual({ count: 20, cap: 60, resetsInSec: 10 });
  });

  it('is null for a service without a per-minute cap', () => {
    expect(liveWindow({ rateLimitPrefix: 'truelayer-sync:' }, [], NOW)).toBeNull();
  });
});

describe('callBuckets', () => {
  it('keeps empty buckets so the time axis is continuous', () => {
    const buckets = callBuckets([row({ minsAgo: 1 }), row({ minsAgo: 1, outcome: 'error', status_code: 500, request_count: 3 })], '24h', NOW);
    expect(buckets.length).toBe(25);
    expect(buckets.filter(b => b.ok + b.error + b.rate_limited > 0)).toHaveLength(1);
    expect(buckets.at(-1)).toMatchObject({ ok: 1, error: 3, rate_limited: 0 });
  });

  it('places every row the range query returns', () => {
    const oldest = row({ minsAgo: RANGE_MS['7d'] / 60_000 - 1 });
    const buckets = callBuckets([oldest], '7d', NOW);
    expect(buckets.reduce((sum, b) => sum + b.ok, 0)).toBe(1);
    expect(buckets.length).toBe(8);
  });
});

describe('summarise and topEndpoints', () => {
  it('counts calls, not rows', () => {
    const rows = [
      row({ request_count: 4, duration_ms: 100 }),
      row({ endpoint: 'search/multi', outcome: 'rate_limited', status_code: 429, duration_ms: 300 }),
    ];
    expect(summarise(rows)).toEqual({ calls: 5, rateLimited: 1, errors: 0, avgMs: 140 });
    expect(topEndpoints(rows).map(e => [e.endpoint, e.calls])).toEqual([['movie/:id', 4], ['search/multi', 1]]);
  });
});
