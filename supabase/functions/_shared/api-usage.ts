/**
 * Fire-and-forget usage telemetry for Edge Functions calling public APIs.
 * Writes directly to `public.api_usage_events` via the service role and
 * fails open so logging never disrupts a live request.
 */

export type ApiUsageOutcome = 'ok' | 'rate_limited' | 'error';

export interface ApiUsageEvent {
  provider: string;
  endpoint: string;
  source?: 'edge' | 'cron';
  statusCode?: number | null;
  outcome?: ApiUsageOutcome;
  durationMs?: number | null;
  requestCount?: number;
}

/** Collapses numeric path segments (`movie/105/recommendations` -> `movie/:id/recommendations`)
 *  so per-endpoint metrics aggregate cleanly without leaking or exploding cardinality. */
export function normalizeEndpoint(raw: string): string {
  return raw
    .split('?')[0]
    .replace(/^\/+|\/+$/g, '')
    .replace(/(^|\/)\d+(?=\/|$)/g, '$1:id')
    .slice(0, 120) || 'root';
}

export function outcomeFromStatus(status: number | null | undefined): ApiUsageOutcome {
  if (status === 429) return 'rate_limited';
  if (status != null && status >= 200 && status < 400) return 'ok';
  return 'error';
}

function toRow(event: ApiUsageEvent) {
  const outcome = event.outcome ?? outcomeFromStatus(event.statusCode);
  return {
    provider: event.provider.slice(0, 40),
    endpoint: normalizeEndpoint(event.endpoint),
    source: event.source ?? 'edge',
    status_code: event.statusCode ?? null,
    outcome,
    duration_ms: event.durationMs != null ? Math.max(0, Math.round(event.durationMs)) : null,
    request_count: Math.max(1, Math.round(event.requestCount ?? 1)),
  };
}

async function postRows(rows: ReturnType<typeof toRow>[]): Promise<void> {
  if (rows.length === 0) return;
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) return;

  try {
    await fetch(`${supabaseUrl}/rest/v1/api_usage_events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(rows),
    });
  } catch {
    // Telemetry is best-effort; never fail the caller.
  }
}

export async function recordApiUsage(event: ApiUsageEvent): Promise<void> {
  await postRows([toRow(event)]);
}

/**
 * Aggregates many upstream calls inside a single Edge Function / cron run into
 * one batched write per `(provider, endpoint, source, outcome, statusCode)`.
 */
export function createUsageBatcher(defaultSource: 'edge' | 'cron' = 'edge') {
  const buckets = new Map<
    string,
    {
      provider: string;
      endpoint: string;
      source: 'edge' | 'cron';
      statusCode: number | null;
      outcome: ApiUsageOutcome;
      durationSum: number;
      durationN: number;
      count: number;
    }
  >();

  return {
    record(event: ApiUsageEvent) {
      const provider = event.provider.slice(0, 40);
      const endpoint = normalizeEndpoint(event.endpoint);
      const source = event.source ?? defaultSource;
      const statusCode = event.statusCode ?? null;
      const outcome = event.outcome ?? outcomeFromStatus(statusCode);
      const count = Math.max(1, Math.round(event.requestCount ?? 1));
      const key = `${provider}|${endpoint}|${source}|${outcome}|${statusCode ?? 'err'}`;
      const existing = buckets.get(key);
      if (existing) {
        existing.count += count;
        if (event.durationMs != null) {
          existing.durationSum += Math.max(0, event.durationMs) * count;
          existing.durationN += count;
        }
      } else {
        buckets.set(key, {
          provider,
          endpoint,
          source,
          statusCode,
          outcome,
          durationSum: event.durationMs != null ? Math.max(0, event.durationMs) * count : 0,
          durationN: event.durationMs != null ? count : 0,
          count,
        });
      }
    },
    async flush() {
      if (buckets.size === 0) return;
      const rows = [...buckets.values()].map((b) => ({
        provider: b.provider,
        endpoint: b.endpoint,
        source: b.source,
        status_code: b.statusCode,
        outcome: b.outcome,
        duration_ms: b.durationN > 0 ? Math.round(b.durationSum / b.durationN) : null,
        request_count: b.count,
      }));
      buckets.clear();
      await postRows(rows);
    },
  };
}
