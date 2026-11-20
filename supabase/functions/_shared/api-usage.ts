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

export async function recordApiUsage(event: ApiUsageEvent): Promise<void> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) return;

  const outcome = event.outcome ?? outcomeFromStatus(event.statusCode);
  const payload = {
    provider: event.provider.slice(0, 40),
    endpoint: normalizeEndpoint(event.endpoint),
    source: event.source ?? 'edge',
    status_code: event.statusCode ?? null,
    outcome,
    duration_ms: event.durationMs != null ? Math.max(0, Math.round(event.durationMs)) : null,
    request_count: Math.max(1, Math.round(event.requestCount ?? 1)),
  };

  try {
    await fetch(`${supabaseUrl}/rest/v1/api_usage_events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(payload),
    });
  } catch {
    // Telemetry is best-effort; never fail the caller.
  }
}
