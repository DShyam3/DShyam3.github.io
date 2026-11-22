/**
 * API status for the private /dev board.
 *
 * The board answers one question per API -- what is it doing right now -- and
 * keeps the counts and charts behind a History button. Everything here is a
 * rule over `api_usage_events` rows, so the status a card shows is
 * reproducible and tested rather than eyeballed.
 *
 * Rows are batched before they are written: the browser flushes every 15s and
 * each Edge Function run writes one row per (endpoint, outcome, status). A row
 * therefore stands for `request_count` calls with an average `duration_ms`.
 */

import { REST_REQUEST_LIMIT_MS } from '@/integrations/supabase/rest-timeout-fetch';

export type UsageOutcome = 'ok' | 'rate_limited' | 'error';

export interface UsageRow {
  id: number;
  occurred_at: string;
  provider: string;
  endpoint: string;
  source: string;
  status_code: number | null;
  outcome: string;
  duration_ms: number | null;
  request_count: number;
}

export type ServiceId =
  | 'tmdb'
  | 'omdb'
  | 'wikidata'
  | 'supabase'
  | 'truelayer'
  | 'brandfetch'
  | 'bank_holidays'
  | 'books';

export interface ServiceDefinition {
  id: ServiceId;
  name: string;
  description: string;
  howUsed: string;
  whyUsed: string;
  providers: string[];
  limitLabel: string;
  /** The request timeout the code sets, used to tell a timeout from a dropped connection. Null where none is set. */
  timeoutMs: number | null;
  timeoutLabel: string;
  /** An answer slower than this, on average across the latest calls, reads as Slow. */
  slowMs: number;
  rateLimitPrefix?: string;
  rateLimitCap?: number;
  windowSeconds?: number;
}

export const SERVICES: ServiceDefinition[] = [
  {
    id: 'tmdb',
    name: 'TMDB',
    description: 'Films, TV shows, posters, collections and recommendations.',
    howUsed: 'Called through tmdb-proxy while you browse Watchlist, Discover and Franchises, and by watchlist-cron-sync every night.',
    whyUsed: 'Keeps the TMDB key server-side and fills in release dates, episodes, collections and suggestions.',
    providers: ['tmdb'],
    limitLabel: '60 calls a minute per visitor (proxy)',
    timeoutMs: 15_000,
    timeoutLabel: '15 s in the nightly sync, none in the proxy',
    slowMs: 2_000,
    rateLimitPrefix: 'tmdb-proxy:',
    rateLimitCap: 60,
    windowSeconds: 60,
  },
  {
    id: 'omdb',
    name: 'OMDb',
    description: 'IMDb, Metascore and Rotten Tomatoes ratings.',
    howUsed: 'Called by watchlist-cron-sync with each title’s IMDb ID on a weekly refresh.',
    whyUsed: 'TMDB has no IMDb or Rotten Tomatoes scores; OMDb supplies them.',
    providers: ['omdb'],
    limitLabel: '1,000 calls a day (free tier)',
    timeoutMs: 15_000,
    timeoutLabel: '15 s',
    slowMs: 3_000,
  },
  {
    id: 'wikidata',
    name: 'Wikidata',
    description: 'Links TV series to their spin-offs and shared universes.',
    howUsed: 'Queried by tmdb-proxy with your library’s TV IDs, cached for 24 hours.',
    whyUsed: 'TMDB groups films into collections but not TV; Wikidata links connected series.',
    providers: ['wikidata'],
    limitLabel: 'Counts towards the TMDB proxy limit',
    timeoutMs: null,
    timeoutLabel: 'None set',
    slowMs: 5_000,
  },
  {
    id: 'supabase',
    name: 'Supabase',
    description: 'Database, RPCs, Edge Functions, sign-in and file storage.',
    howUsed: 'Called from the browser for all app data, sign-in and Edge Function calls.',
    whyUsed: 'Provides the database, row-level security, storage and the server-side proxies for this static site.',
    providers: ['supabase_rest', 'supabase_rpc', 'supabase_functions', 'supabase_auth', 'supabase_storage'],
    limitLabel: 'No call limit on this plan',
    timeoutMs: REST_REQUEST_LIMIT_MS,
    timeoutLabel: `${REST_REQUEST_LIMIT_MS / 1000} s for table reads`,
    slowMs: 2_000,
  },
  {
    id: 'truelayer',
    name: 'TrueLayer',
    description: 'Open Banking access to your bank accounts and cards.',
    howUsed: 'Called by truelayer-sync on the 05:00 cron and when you press Sync in Finance.',
    whyUsed: 'Imports balances and transactions without storing banking credentials.',
    providers: ['truelayer'],
    limitLabel: '15 minutes between manual syncs',
    timeoutMs: null,
    timeoutLabel: 'None set',
    slowMs: 5_000,
    rateLimitPrefix: 'truelayer-sync:',
  },
  {
    id: 'brandfetch',
    name: 'Brandfetch',
    description: 'Merchant logos.',
    howUsed: 'Called by merchant-logo-cache once per new merchant; the logo is kept in Storage.',
    whyUsed: 'Your spending never goes to a logo host on each Finance page view.',
    providers: ['brandfetch'],
    limitLabel: 'Each logo fetched once, then cached',
    timeoutMs: 8_000,
    timeoutLabel: '8 s',
    slowMs: 3_000,
  },
  {
    id: 'bank_holidays',
    name: 'UK Bank Holidays',
    description: 'GOV.UK bank holiday feed.',
    howUsed: 'Fetched by sync-bank-holidays every quarter, or by hand, into uk_bank_holidays.',
    whyUsed: 'Moves paydays and bill dates off weekends and bank holidays in Finance.',
    providers: ['bank_holidays'],
    limitLabel: 'Quarterly, or by hand',
    timeoutMs: null,
    timeoutLabel: 'None set',
    slowMs: 3_000,
  },
  {
    id: 'books',
    name: 'Book Catalogues',
    description: 'Open Library and Google Books metadata.',
    howUsed: 'Queried from the browser only when you search for a book to add or fill in.',
    whyUsed: 'Fills in titles, authors, covers, page counts and publication dates.',
    providers: ['open_library', 'google_books'],
    limitLabel: 'Only when you search',
    timeoutMs: 15_000,
    timeoutLabel: '15 s',
    slowMs: 3_000,
  },
];

const PROVIDER_LABELS: Record<string, string> = {
  tmdb: 'TMDB',
  omdb: 'OMDb',
  wikidata: 'Wikidata',
  bank_holidays: 'UK Bank Holidays',
  truelayer: 'TrueLayer',
  brandfetch: 'Brandfetch',
  open_library: 'Open Library',
  google_books: 'Google Books',
  supabase_rest: 'Supabase tables',
  supabase_rpc: 'Supabase RPC',
  supabase_functions: 'Edge Functions',
  supabase_auth: 'Supabase sign-in',
  supabase_storage: 'Supabase Storage',
};

export const labelForProvider = (provider: string): string => PROVIDER_LABELS[provider] ?? provider;

export const serviceForProvider = (provider: string): ServiceDefinition | undefined =>
  SERVICES.find(svc => svc.providers.includes(provider));

/** Calls a row stands for. Never below one, so an old row without a count still counts. */
export const callsIn = (row: Pick<UsageRow, 'request_count'>): number => Math.max(1, row.request_count || 1);

const outcomeOf = (row: Pick<UsageRow, 'outcome'>): UsageOutcome =>
  row.outcome === 'rate_limited' || row.outcome === 'error' ? row.outcome : 'ok';

/** No status code and at least 90% of the timeout spent: the request was cut off, not refused. */
export const isTimeout = (row: Pick<UsageRow, 'outcome' | 'status_code' | 'duration_ms'>, timeoutMs: number | null): boolean =>
  outcomeOf(row) === 'error'
  && row.status_code == null
  && timeoutMs != null
  && row.duration_ms != null
  && row.duration_ms >= timeoutMs * 0.9;

const formatSeconds = (ms: number) => `${Math.round(ms / 100) / 10} s`;

export const formatDuration = (ms: number | null): string =>
  ms == null ? '' : ms < 1000 ? `${Math.round(ms)} ms` : formatSeconds(ms);

/** One short phrase for what a call came back with. */
export function describeResult(row: Pick<UsageRow, 'outcome' | 'status_code' | 'duration_ms'>, timeoutMs: number | null): string {
  const outcome = outcomeOf(row);
  if (isTimeout(row, timeoutMs)) return `Timed out after ${formatSeconds(timeoutMs as number)}`;
  if (outcome === 'error' && row.status_code == null) return 'No response';
  if (outcome === 'rate_limited') return `Rate limited (${row.status_code ?? 429})`;
  if (outcome === 'error') return `Error ${row.status_code}`;
  return row.status_code != null ? `OK (${row.status_code})` : 'OK';
}

export type ApiHealth = 'ok' | 'slow' | 'near-limit' | 'some-errors' | 'rate-limited' | 'timed-out' | 'failing' | 'idle';

export const HEALTH_LABELS: Record<ApiHealth, string> = {
  ok: 'OK',
  slow: 'Slow',
  'near-limit': 'Near limit',
  'some-errors': 'Some errors',
  'rate-limited': 'Rate limited',
  'timed-out': 'Timing out',
  failing: 'Failing',
  idle: 'No calls yet',
};

/** How each state reads at a glance: good, a warning, or a problem. */
export const HEALTH_TONE: Record<ApiHealth, 'good' | 'warning' | 'problem' | 'neutral'> = {
  ok: 'good',
  slow: 'warning',
  'near-limit': 'warning',
  'some-errors': 'warning',
  'rate-limited': 'problem',
  'timed-out': 'problem',
  failing: 'problem',
  idle: 'neutral',
};

export interface LiveWindow {
  count: number;
  cap: number;
  resetsInSec: number | null;
}

export interface ServiceStatus {
  health: ApiHealth;
  /** Why the health reads as it does, in one line. */
  reason: string;
  lastCall: UsageRow | null;
  /** The newest call that was not OK, among the rows looked at. */
  lastProblem: UsageRow | null;
  /** Average answer time across the latest activity, OK calls only. */
  latestAvgMs: number | null;
}

/** Rows written within this long of the newest one belong to the same burst of activity. */
export const LATEST_ACTIVITY_WINDOW_MS = 60_000;

/**
 * What an API is doing now, from its newest rows (newest first).
 *
 * "Now" is the latest burst of activity rather than a fixed clock window:
 * the bank holiday feed is called four times a year, and its last answer is
 * still its current state. A single failure among many good calls is
 * "Some errors"; most of the burst failing is "Failing" or "Timing out".
 */
export function serviceStatus(
  rowsNewestFirst: readonly UsageRow[],
  service: Pick<ServiceDefinition, 'timeoutMs' | 'slowMs'>,
  live: LiveWindow | null = null,
): ServiceStatus {
  const lastCall = rowsNewestFirst[0] ?? null;
  const lastProblem = rowsNewestFirst.find(row => outcomeOf(row) !== 'ok') ?? null;

  if (live && live.count >= live.cap) {
    return { health: 'rate-limited', reason: `${live.count} of ${live.cap} calls used this minute`, lastCall, lastProblem, latestAvgMs: null };
  }
  if (!lastCall) {
    return { health: 'idle', reason: 'Nothing recorded yet', lastCall, lastProblem, latestAvgMs: null };
  }

  const newestMs = Date.parse(lastCall.occurred_at);
  const burst = rowsNewestFirst.filter(row => newestMs - Date.parse(row.occurred_at) <= LATEST_ACTIVITY_WINDOW_MS);
  let total = 0;
  let rateLimited = 0;
  let timedOut = 0;
  let failed = 0;
  let okDurationSum = 0;
  let okDurationN = 0;
  for (const row of burst) {
    const n = callsIn(row);
    total += n;
    const outcome = outcomeOf(row);
    if (outcome === 'rate_limited') rateLimited += n;
    else if (outcome === 'error') {
      failed += n;
      if (isTimeout(row, service.timeoutMs)) timedOut += n;
    } else if (row.duration_ms != null) {
      okDurationSum += row.duration_ms * n;
      okDurationN += n;
    }
  }
  const latestAvgMs = okDurationN > 0 ? Math.round(okDurationSum / okDurationN) : null;
  const result = (health: ApiHealth, reason: string): ServiceStatus => ({ health, reason, lastCall, lastProblem, latestAvgMs });
  if (total === 0) return result('idle', 'Latest call timestamp could not be read');
  const ofLatest = (n: number) => `${n} of the latest ${total} call${total === 1 ? '' : 's'}`;

  if (rateLimited > 0) return result('rate-limited', `${ofLatest(rateLimited)} refused with 429`);
  if (failed * 2 >= total) {
    return timedOut * 2 >= failed
      ? result('timed-out', `${ofLatest(timedOut)} timed out`)
      : result('failing', `${ofLatest(failed)} failed`);
  }
  if (failed > 0) return result('some-errors', `${ofLatest(failed)} failed`);
  if (live && live.count >= Math.round(live.cap * 0.75)) return result('near-limit', `${live.count} of ${live.cap} calls used this minute`);
  if (latestAvgMs != null && latestAvgMs >= service.slowMs) {
    return result('slow', `Answering in ${formatDuration(latestAvgMs)}, slow above ${formatDuration(service.slowMs)}`);
  }
  return result('ok', latestAvgMs != null ? `Answering in ${formatDuration(latestAvgMs)}` : 'Latest calls succeeded');
}

/**
 * The open rate-limit window for a service, from `get_active_rate_limits`:
 * the busiest key still inside its window right now.
 */
export function liveWindow(
  service: Pick<ServiceDefinition, 'rateLimitPrefix' | 'rateLimitCap' | 'windowSeconds'>,
  limits: ReadonlyArray<{ key: string; window_start: string; count: number }>,
  nowMs: number,
): LiveWindow | null {
  if (!service.rateLimitPrefix || !service.rateLimitCap || !service.windowSeconds) return null;
  let count = 0;
  let resetsInSec: number | null = null;
  for (const limit of limits) {
    if (!limit.key.startsWith(service.rateLimitPrefix)) continue;
    const endMs = Date.parse(limit.window_start) + service.windowSeconds * 1000;
    if (endMs > nowMs && limit.count > count) {
      count = limit.count;
      resetsInSec = Math.max(1, Math.ceil((endMs - nowMs) / 1000));
    }
  }
  return { count, cap: service.rateLimitCap, resetsInSec };
}

export type TimeRange = '1h' | '24h' | '7d' | '30d';

export const RANGE_MS: Record<TimeRange, number> = {
  '1h': 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
};

const BUCKET_MS: Record<TimeRange, number> = {
  '1h': 5 * 60 * 1000,
  '24h': 60 * 60 * 1000,
  '7d': 24 * 60 * 60 * 1000,
  '30d': 24 * 60 * 60 * 1000,
};

/** Start of the bucket holding `ms`: 5 minutes, an hour, or a local day. */
export function bucketStart(ms: number, range: TimeRange): number {
  const d = new Date(ms);
  if (range === '1h') d.setMinutes(Math.floor(d.getMinutes() / 5) * 5, 0, 0);
  else if (range === '24h') d.setMinutes(0, 0, 0);
  else d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export interface CallBucket {
  start: number;
  ok: number;
  rate_limited: number;
  error: number;
}

/**
 * Calls per bucket across the whole range, oldest first, with empty buckets
 * kept: a quiet hour is a gap on the axis, not a missing tick. The first
 * bucket is partial, so every row the range query returns lands in one.
 */
export function callBuckets(rows: readonly UsageRow[], range: TimeRange, nowMs: number): CallBucket[] {
  const step = BUCKET_MS[range];
  const first = bucketStart(nowMs - RANGE_MS[range], range);
  const last = bucketStart(nowMs, range);
  const buckets = new Map<number, CallBucket>();
  // Day buckets step by date, not by 24h, so a clock change cannot skip a day.
  // Sub-day buckets step directly by `step` so a sub-hour DST shift cannot loop.
  for (let start = first; start <= last;) {
    buckets.set(start, { start, ok: 0, rate_limited: 0, error: 0 });
    if (step >= BUCKET_MS['7d']) {
      const next = new Date(start);
      next.setDate(next.getDate() + 1);
      start = bucketStart(next.getTime(), range);
    } else {
      start += step;
    }
  }
  for (const row of rows) {
    const ms = Date.parse(row.occurred_at);
    if (Number.isNaN(ms)) continue;
    const bucket = buckets.get(bucketStart(ms, range));
    if (bucket) bucket[outcomeOf(row)] += callsIn(row);
  }
  return [...buckets.values()];
}

export interface RangeSummary {
  calls: number;
  rateLimited: number;
  errors: number;
  avgMs: number | null;
}

export function summarise(rows: readonly UsageRow[]): RangeSummary {
  let calls = 0;
  let rateLimited = 0;
  let errors = 0;
  let durationSum = 0;
  let durationN = 0;
  for (const row of rows) {
    const n = callsIn(row);
    calls += n;
    const outcome = outcomeOf(row);
    if (outcome === 'rate_limited') rateLimited += n;
    else if (outcome === 'error') errors += n;
    if (row.duration_ms != null) {
      durationSum += row.duration_ms * n;
      durationN += n;
    }
  }
  return { calls, rateLimited, errors, avgMs: durationN > 0 ? Math.round(durationSum / durationN) : null };
}

export interface EndpointSummary extends RangeSummary {
  key: string;
  provider: string;
  endpoint: string;
  source: string;
  lastSeen: string;
}

/** The busiest endpoints in the range, most calls first. */
export function topEndpoints(rows: readonly UsageRow[], limit = 30): EndpointSummary[] {
  const groups = new Map<string, UsageRow[]>();
  for (const row of rows) {
    const key = `${row.provider}|${row.endpoint}|${row.source}`;
    const group = groups.get(key);
    if (group) group.push(row);
    else groups.set(key, [row]);
  }
  return [...groups.entries()]
    .map(([key, group]) => ({
      key,
      provider: group[0].provider,
      endpoint: group[0].endpoint,
      source: group[0].source,
      lastSeen: group.reduce((newest, row) => {
        const rowMs = Date.parse(row.occurred_at);
        const newestMs = Date.parse(newest);
        if (!Number.isNaN(rowMs) && (Number.isNaN(newestMs) || rowMs > newestMs)) return row.occurred_at;
        return newest;
      }, group[0].occurred_at),
      ...summarise(group),
    }))
    .sort((a, b) => b.calls - a.calls)
    .slice(0, limit);
}
