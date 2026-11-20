/**
 * Lightweight, batched telemetry wrapper for the Supabase client's `fetch`.
 *
 * Records every Supabase REST, RPC, Edge Function, Auth, and Storage call
 * (except calls to `api_usage_events` itself, to prevent feedback loops),
 * keeps an in-memory rolling log for the current browser session, and flushes
 * aggregated counts to `public.api_usage_events` when the admin is signed in.
 */

export type ClientTelemetryOutcome = 'ok' | 'rate_limited' | 'error';

export interface ClientUsageSample {
  occurredAt: string;
  provider: string;
  endpoint: string;
  statusCode: number | null;
  outcome: ClientTelemetryOutcome;
  durationMs: number;
}

interface PendingBucket {
  provider: string;
  endpoint: string;
  statusCode: number | null;
  outcome: ClientTelemetryOutcome;
  totalDurationMs: number;
  count: number;
  lastOccurredAt: string;
}

const FLUSH_INTERVAL_MS = 15_000;
const FLUSH_BATCH_THRESHOLD = 25;
const MAX_SESSION_SAMPLES = 250;

const sessionSamples: ClientUsageSample[] = [];
const pendingBuckets = new Map<string, PendingBucket>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let flushing = false;
let telemetryEnabled = false;
let rawFetchRef: typeof fetch | null = null;
let supabaseUrlRef = '';
let anonKeyRef = '';
let accessTokenRef: string | null = null;

/** Called by AuthContext (or Dev page) so only the signed-in admin flushes to Postgres. */
export function setClientTelemetryAuth(enabled: boolean, accessToken: string | null) {
  telemetryEnabled = enabled;
  accessTokenRef = accessToken;
  if (!enabled) {
    pendingBuckets.clear();
  }
}

/** Recent client-side Supabase calls captured in this browser session. */
export function getSessionUsageSamples(): readonly ClientUsageSample[] {
  return sessionSamples;
}

/** Classifies a Supabase request URL into provider + normalized endpoint, or null to skip. */
export function classifySupabaseRequest(
  href: string,
  supabaseUrl: string,
): { provider: string; endpoint: string } | null {
  let url: URL;
  let base: URL;
  try {
    url = new URL(href);
    base = new URL(supabaseUrl);
  } catch {
    return null;
  }
  if (url.origin !== base.origin) return null;

  const path = url.pathname;
  // Never track telemetry writes/reads themselves.
  if (path.includes('/api_usage_events') || path.includes('/rpc/get_active_rate_limits')) {
    return null;
  }

  const rpcMatch = path.match(/\/rest\/v1\/rpc\/([^/]+)/);
  if (rpcMatch) {
    return { provider: 'supabase_rpc', endpoint: rpcMatch[1] };
  }

  const restMatch = path.match(/\/rest\/v1\/([^/]+)/);
  if (restMatch) {
    return { provider: 'supabase_rest', endpoint: restMatch[1] };
  }

  const fnMatch = path.match(/\/functions\/v1\/([^/]+)/);
  if (fnMatch) {
    const fnName = fnMatch[1];
    // For tmdb-proxy, include the logical endpoint param if present (already normalized server-side too).
    if (fnName === 'tmdb-proxy') {
      const ep = url.searchParams.get('endpoint');
      const normalized = ep
        ? ep.replace(/(^|\/)\d+(?=\/|$)/g, '$1:id').slice(0, 80)
        : 'tmdb-proxy';
      return { provider: 'supabase_functions', endpoint: `tmdb-proxy:${normalized}` };
    }
    return { provider: 'supabase_functions', endpoint: fnName };
  }

  const authMatch = path.match(/\/auth\/v1\/([^/]+)/);
  if (authMatch) {
    return { provider: 'supabase_auth', endpoint: authMatch[1] };
  }

  const storageMatch = path.match(/\/storage\/v1\/([^/]+(?:\/[^/]+)?)/);
  if (storageMatch) {
    return { provider: 'supabase_storage', endpoint: storageMatch[1] };
  }

  return null;
}

function outcomeFromStatus(status: number | null): ClientTelemetryOutcome {
  if (status === 429) return 'rate_limited';
  if (status != null && status >= 200 && status < 400) return 'ok';
  return 'error';
}

export async function flushClientUsage(): Promise<void> {
  if (flushing || !telemetryEnabled || !accessTokenRef || !rawFetchRef || !supabaseUrlRef || pendingBuckets.size === 0) {
    return;
  }
  flushing = true;
  const snapshot = [...pendingBuckets.values()];
  pendingBuckets.clear();
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }

  const rows = snapshot.map((b) => ({
    occurred_at: b.lastOccurredAt,
    provider: b.provider,
    endpoint: b.endpoint,
    source: 'client',
    status_code: b.statusCode,
    outcome: b.outcome,
    duration_ms: Math.round(b.totalDurationMs / Math.max(1, b.count)),
    request_count: b.count,
  }));

  try {
    const base = supabaseUrlRef.endsWith('/') ? supabaseUrlRef : `${supabaseUrlRef}/`;
    const res = await rawFetchRef(`${base}rest/v1/api_usage_events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: anonKeyRef,
        Authorization: `Bearer ${accessTokenRef}`,
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(rows),
    });
    if (res.status === 401 || res.status === 403) {
      // Not admin or session expired — stop flushing until auth updates.
      telemetryEnabled = false;
    }
  } catch {
    // Best-effort telemetry; drop silently on network failure.
  } finally {
    flushing = false;
  }
}

function scheduleFlush() {
  if (flushTimer || !telemetryEnabled) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushClientUsage();
  }, FLUSH_INTERVAL_MS);
}

function recordSample(sample: ClientUsageSample) {
  sessionSamples.push(sample);
  if (sessionSamples.length > MAX_SESSION_SAMPLES) {
    sessionSamples.splice(0, sessionSamples.length - MAX_SESSION_SAMPLES);
  }

  if (!telemetryEnabled) return;

  const bucketKey = `${sample.provider}|${sample.endpoint}|${sample.outcome}|${sample.statusCode ?? 'err'}`;
  const existing = pendingBuckets.get(bucketKey);
  if (existing) {
    existing.count += 1;
    existing.totalDurationMs += sample.durationMs;
    existing.lastOccurredAt = sample.occurredAt;
  } else {
    pendingBuckets.set(bucketKey, {
      provider: sample.provider,
      endpoint: sample.endpoint,
      statusCode: sample.statusCode,
      outcome: sample.outcome,
      totalDurationMs: sample.durationMs,
      count: 1,
      lastOccurredAt: sample.occurredAt,
    });
  }

  let totalPending = 0;
  for (const b of pendingBuckets.values()) totalPending += b.count;
  if (totalPending >= FLUSH_BATCH_THRESHOLD) {
    void flushClientUsage();
  } else {
    scheduleFlush();
  }
}

const hrefOf = (input: RequestInfo | URL): string =>
  typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

export function withApiUsageTelemetry(
  fetchImpl: typeof fetch,
  supabaseUrl: string,
  anonKey: string,
): typeof fetch {
  rawFetchRef = fetchImpl;
  supabaseUrlRef = supabaseUrl;
  anonKeyRef = anonKey;

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        void flushClientUsage();
      }
    });
  }

  return async (input, init) => {
    const classified = classifySupabaseRequest(hrefOf(input), supabaseUrl);
    if (!classified) {
      return fetchImpl(input, init);
    }

    const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
    try {
      const response = await fetchImpl(input, init);
      const elapsed = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt;
      recordSample({
        occurredAt: new Date().toISOString(),
        provider: classified.provider,
        endpoint: classified.endpoint,
        statusCode: response.status,
        outcome: outcomeFromStatus(response.status),
        durationMs: Math.max(0, Math.round(elapsed)),
      });
      return response;
    } catch (error) {
      const elapsed = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt;
      recordSample({
        occurredAt: new Date().toISOString(),
        provider: classified.provider,
        endpoint: classified.endpoint,
        statusCode: null,
        outcome: 'error',
        durationMs: Math.max(0, Math.round(elapsed)),
      });
      throw error;
    }
  };
}
