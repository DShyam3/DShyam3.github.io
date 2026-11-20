import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Activity, AlertTriangle, Clock, Gauge, RefreshCw, Server } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { DotMatrixText } from '@/components/dot-matrix/DotMatrixText';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { flushClientUsage, getSessionUsageSamples } from '@/integrations/supabase/api-usage-fetch';

type TimeRange = '1h' | '24h' | '7d' | '30d';

interface UsageRow {
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

const RANGE_MS: Record<TimeRange, number> = {
  '1h': 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
};

const PROVIDER_LABELS: Record<string, string> = {
  tmdb: 'TMDB',
  wikidata: 'Wikidata',
  bank_holidays: 'UK Bank Holidays',
  truelayer: 'TrueLayer',
  supabase_rest: 'Supabase REST',
  supabase_rpc: 'Supabase RPC',
  supabase_functions: 'Edge Functions',
  supabase_auth: 'Supabase Auth',
  supabase_storage: 'Supabase Storage',
};

const PROVIDER_COLORS: Record<string, string> = {
  tmdb: '#f59e0b',
  wikidata: '#a855f7',
  bank_holidays: '#14b8a6',
  truelayer: '#ec4899',
  supabase_rest: '#3b82f6',
  supabase_rpc: '#06b6d4',
  supabase_functions: '#10b981',
  supabase_auth: '#6366f1',
  supabase_storage: '#84cc16',
};

function labelForProvider(provider: string): string {
  return PROVIDER_LABELS[provider] ?? provider;
}

function colorForProvider(provider: string): string {
  return PROVIDER_COLORS[provider] ?? '#94a3b8';
}

function formatBucketLabel(date: Date, range: TimeRange): string {
  if (range === '1h') {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  if (range === '24h') {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function bucketStartMs(tsMs: number, range: TimeRange): number {
  const d = new Date(tsMs);
  if (range === '1h') {
    d.setMinutes(Math.floor(d.getMinutes() / 5) * 5, 0, 0);
    return d.getTime();
  }
  if (range === '24h') {
    d.setMinutes(0, 0, 0);
    return d.getTime();
  }
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export default function Dev() {
  const { isAdmin, isAuthLoading } = useAuth();
  const queryClient = useQueryClient();
  const [range, setRange] = useState<TimeRange>('24h');
  const [providerFilter, setProviderFilter] = useState<string>('all');
  const [refreshing, setRefreshing] = useState(false);

  const sinceIso = useMemo(() => new Date(Date.now() - RANGE_MS[range]).toISOString(), [range]);

  const usageQuery = useQuery({
    queryKey: ['dev', 'api-usage', range],
    enabled: isAdmin,
    staleTime: 30_000,
    queryFn: async (): Promise<UsageRow[]> => {
      const { data, error } = await supabase
        .from('api_usage_events')
        .select('id, occurred_at, provider, endpoint, source, status_code, outcome, duration_ms, request_count')
        .gte('occurred_at', sinceIso)
        .order('occurred_at', { ascending: false })
        .limit(5000);
      if (error) throw error;
      return (data ?? []) as UsageRow[];
    },
  });

  const rateLimitsQuery = useQuery({
    queryKey: ['dev', 'active-rate-limits'],
    enabled: isAdmin,
    staleTime: 15_000,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_active_rate_limits');
      if (error) throw error;
      return data ?? [];
    },
  });

  const allRows = useMemo(() => usageQuery.data ?? [], [usageQuery.data]);
  const availableProviders = useMemo(() => {
    const set = new Set<string>();
    for (const row of allRows) set.add(row.provider);
    return [...set].sort();
  }, [allRows]);

  const rows = useMemo(
    () => (providerFilter === 'all' ? allRows : allRows.filter((r) => r.provider === providerFilter)),
    [allRows, providerFilter],
  );

  const summary = useMemo(() => {
    let totalCalls = 0;
    let rateLimited = 0;
    let errors = 0;
    let durationWeightedSum = 0;
    let durationCount = 0;

    for (const row of rows) {
      const n = Math.max(1, row.request_count || 1);
      totalCalls += n;
      if (row.outcome === 'rate_limited') rateLimited += n;
      else if (row.outcome === 'error') errors += n;
      if (row.duration_ms != null) {
        durationWeightedSum += row.duration_ms * n;
        durationCount += n;
      }
    }

    return {
      totalCalls,
      rateLimited,
      errors,
      avgMs: durationCount > 0 ? Math.round(durationWeightedSum / durationCount) : null,
    };
  }, [rows]);

  const byProvider = useMemo(() => {
    const map = new Map<
      string,
      { provider: string; calls: number; rateLimited: number; errors: number; durationSum: number; durationN: number }
    >();
    for (const row of allRows) {
      const n = Math.max(1, row.request_count || 1);
      const entry = map.get(row.provider) ?? {
        provider: row.provider,
        calls: 0,
        rateLimited: 0,
        errors: 0,
        durationSum: 0,
        durationN: 0,
      };
      entry.calls += n;
      if (row.outcome === 'rate_limited') entry.rateLimited += n;
      else if (row.outcome === 'error') entry.errors += n;
      if (row.duration_ms != null) {
        entry.durationSum += row.duration_ms * n;
        entry.durationN += n;
      }
      map.set(row.provider, entry);
    }
    return [...map.values()].sort((a, b) => b.calls - a.calls);
  }, [allRows]);

  const topEndpoints = useMemo(() => {
    const map = new Map<
      string,
      {
        key: string;
        provider: string;
        endpoint: string;
        source: string;
        calls: number;
        rateLimited: number;
        errors: number;
        durationSum: number;
        durationN: number;
        lastSeen: string;
      }
    >();
    for (const row of rows) {
      const n = Math.max(1, row.request_count || 1);
      const key = `${row.provider}|${row.endpoint}|${row.source}`;
      const existing = map.get(key);
      if (existing) {
        existing.calls += n;
        if (row.outcome === 'rate_limited') existing.rateLimited += n;
        else if (row.outcome === 'error') existing.errors += n;
        if (row.duration_ms != null) {
          existing.durationSum += row.duration_ms * n;
          existing.durationN += n;
        }
        if (row.occurred_at > existing.lastSeen) existing.lastSeen = row.occurred_at;
      } else {
        map.set(key, {
          key,
          provider: row.provider,
          endpoint: row.endpoint,
          source: row.source,
          calls: n,
          rateLimited: row.outcome === 'rate_limited' ? n : 0,
          errors: row.outcome === 'error' ? n : 0,
          durationSum: row.duration_ms != null ? row.duration_ms * n : 0,
          durationN: row.duration_ms != null ? n : 0,
          lastSeen: row.occurred_at,
        });
      }
    }
    return [...map.values()].sort((a, b) => b.calls - a.calls).slice(0, 30);
  }, [rows]);

  const chartData = useMemo(() => {
    const buckets = new Map<number, Record<string, number | string>>();
    const activeProviders = new Set<string>();

    for (const row of rows) {
      const ms = Date.parse(row.occurred_at);
      if (Number.isNaN(ms)) continue;
      const bMs = bucketStartMs(ms, range);
      const bucket = buckets.get(bMs) ?? { ts: bMs, label: formatBucketLabel(new Date(bMs), range) };
      const current = typeof bucket[row.provider] === 'number' ? (bucket[row.provider] as number) : 0;
      bucket[row.provider] = current + Math.max(1, row.request_count || 1);
      buckets.set(bMs, bucket);
      activeProviders.add(row.provider);
    }

    return {
      points: [...buckets.entries()].sort(([a], [b]) => a - b).map(([, v]) => v),
      providers: [...activeProviders].sort(),
    };
  }, [rows, range]);

  const sessionSamples = getSessionUsageSamples().slice(-25).reverse();

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await flushClientUsage();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['dev', 'api-usage'] }),
        queryClient.invalidateQueries({ queryKey: ['dev', 'active-rate-limits'] }),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  if (isAuthLoading) {
    return (
      <AppShell title="Dev" subtitle="API & Supabase Metrics">
        <p role="status" className="text-sm text-muted-foreground">Checking access…</p>
      </AppShell>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <AppShell title="Dev" subtitle="API & Supabase Metrics">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-card/50 p-3">
          <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Time range">
            {(['1h', '24h', '7d', '30d'] as const).map((r) => (
              <Button
                key={r}
                type="button"
                size="sm"
                variant={range === r ? 'secondary' : 'ghost'}
                onClick={() => setRange(r)}
              >
                {r}
              </Button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Provider filter">
            <Button
              type="button"
              size="sm"
              variant={providerFilter === 'all' ? 'secondary' : 'ghost'}
              onClick={() => setProviderFilter('all')}
            >
              All providers
            </Button>
            {availableProviders.map((provider) => (
              <Button
                key={provider}
                type="button"
                size="sm"
                variant={providerFilter === provider ? 'secondary' : 'ghost'}
                onClick={() => setProviderFilter(provider)}
              >
                {labelForProvider(provider)}
              </Button>
            ))}
          </div>

          <Button type="button" size="sm" variant="outline" onClick={() => void handleRefresh()} disabled={refreshing} className="gap-1.5">
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
            Flush &amp; Refresh
          </Button>
        </div>

        {usageQuery.isError && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            Could not load stored metrics from Supabase. Make sure the latest `api_usage_events` migration is applied.
          </div>
        )}

        <section aria-labelledby="dev-summary-heading" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <h2 id="dev-summary-heading" className="sr-only">Summary</h2>
          <div className="rounded-xl border border-border/60 bg-card/50 p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Activity className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
              <span>Total calls ({range})</span>
            </div>
            <p className="mt-2 text-2xl font-mono font-semibold tabular-nums">{summary.totalCalls.toLocaleString()}</p>
          </div>
          <div className="rounded-xl border border-border/60 bg-card/50 p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Gauge className="h-3.5 w-3.5 text-amber-500" aria-hidden="true" />
              <span>Rate limited (429)</span>
            </div>
            <p className="mt-2 text-2xl font-mono font-semibold tabular-nums">{summary.rateLimited.toLocaleString()}</p>
          </div>
          <div className="rounded-xl border border-border/60 bg-card/50 p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <AlertTriangle className="h-3.5 w-3.5 text-destructive" aria-hidden="true" />
              <span>Errors</span>
            </div>
            <p className="mt-2 text-2xl font-mono font-semibold tabular-nums">{summary.errors.toLocaleString()}</p>
          </div>
          <div className="rounded-xl border border-border/60 bg-card/50 p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
              <span>Avg latency</span>
            </div>
            <p className="mt-2 text-2xl font-mono font-semibold tabular-nums">
              {summary.avgMs != null ? `${summary.avgMs} ms` : '—'}
            </p>
          </div>
        </section>

        <section aria-labelledby="dev-rate-limits-heading" className="space-y-3 rounded-xl border border-border/60 bg-card/50 p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 id="dev-rate-limits-heading"><DotMatrixText text="LIVE RATE LIMIT WINDOWS" size="xs" /></h2>
            <span className="text-xs text-muted-foreground">TMDB proxy cap: 60 / min per IP</span>
          </div>
          {rateLimitsQuery.isPending && (
            <p className="text-sm text-muted-foreground">Loading live windows…</p>
          )}
          {!rateLimitsQuery.isPending && (rateLimitsQuery.data?.length ?? 0) === 0 && (
            <p className="text-sm text-muted-foreground">No active rate-limit windows in the last 5 minutes.</p>
          )}
          {(rateLimitsQuery.data?.length ?? 0) > 0 && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {rateLimitsQuery.data!.map((rl) => {
                const isTmdb = rl.key.startsWith('tmdb-proxy:');
                const cap = isTmdb ? 60 : null;
                const pct = cap ? Math.min(100, Math.round((rl.count / cap) * 100)) : null;
                return (
                  <div key={`${rl.key}-${rl.window_start}`} className="rounded-lg border border-border/50 bg-background/50 p-3 space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-xs font-mono">
                      <span className="truncate">{rl.key}</span>
                      <span className="tabular-nums font-semibold">
                        {rl.count}{cap ? ` / ${cap}` : ''}
                      </span>
                    </div>
                    {pct != null && (
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                        <div
                          className={`h-full transition-all ${pct >= 90 ? 'bg-destructive' : pct >= 70 ? 'bg-amber-500' : 'bg-primary'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    )}
                    <p className="text-[11px] text-muted-foreground">
                      Window: {new Date(rl.window_start).toLocaleTimeString()}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section aria-labelledby="dev-chart-heading" className="space-y-3 rounded-xl border border-border/60 bg-card/50 p-4">
          <h2 id="dev-chart-heading"><DotMatrixText text="CALLS OVER TIME" size="xs" /></h2>
          {chartData.points.length === 0 ? (
            <p className="text-sm text-muted-foreground">No calls recorded in this window yet.</p>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData.points} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      borderColor: 'hsl(var(--border))',
                      borderRadius: '0.5rem',
                      fontSize: '12px',
                    }}
                  />
                  {chartData.providers.map((provider) => (
                    <Bar
                      key={provider}
                      dataKey={provider}
                      name={labelForProvider(provider)}
                      stackId="calls"
                      fill={colorForProvider(provider)}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        <section aria-labelledby="dev-providers-heading" className="space-y-3 rounded-xl border border-border/60 bg-card/50 p-4">
          <h2 id="dev-providers-heading"><DotMatrixText text="BY PROVIDER" size="xs" /></h2>
          {byProvider.length === 0 ? (
            <p className="text-sm text-muted-foreground">No provider activity in this window.</p>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {byProvider.map((p) => (
                <div key={p.provider} className="rounded-lg border border-border/50 bg-background/50 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <span
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: colorForProvider(p.provider) }}
                        aria-hidden="true"
                      />
                      {labelForProvider(p.provider)}
                    </span>
                    <span className="font-mono text-sm font-semibold tabular-nums">{p.calls.toLocaleString()}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground font-mono">
                    <span>429: {p.rateLimited}</span>
                    <span>Err: {p.errors}</span>
                    <span>Avg: {p.durationN > 0 ? `${Math.round(p.durationSum / p.durationN)}ms` : '—'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section aria-labelledby="dev-endpoints-heading" className="space-y-3 rounded-xl border border-border/60 bg-card/50 p-4">
          <h2 id="dev-endpoints-heading"><DotMatrixText text="TOP ENDPOINTS" size="xs" /></h2>
          {topEndpoints.length === 0 ? (
            <p className="text-sm text-muted-foreground">No endpoints recorded in this window.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="border-b border-border/60 text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-3 font-medium">Provider</th>
                    <th className="py-2 pr-3 font-medium">Endpoint</th>
                    <th className="py-2 pr-3 font-medium">Source</th>
                    <th className="py-2 pr-3 text-right font-medium">Calls</th>
                    <th className="py-2 pr-3 text-right font-medium">429</th>
                    <th className="py-2 pr-3 text-right font-medium">Err</th>
                    <th className="py-2 pr-3 text-right font-medium">Avg ms</th>
                    <th className="py-2 text-right font-medium">Last seen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {topEndpoints.map((ep) => (
                    <tr key={ep.key}>
                      <td className="py-2 pr-3 whitespace-nowrap">{labelForProvider(ep.provider)}</td>
                      <td className="py-2 pr-3 break-all">{ep.endpoint}</td>
                      <td className="py-2 pr-3 text-muted-foreground">{ep.source}</td>
                      <td className="py-2 pr-3 text-right tabular-nums font-semibold">{ep.calls.toLocaleString()}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{ep.rateLimited}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{ep.errors}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {ep.durationN > 0 ? Math.round(ep.durationSum / ep.durationN) : '—'}
                      </td>
                      <td className="py-2 text-right whitespace-nowrap text-muted-foreground">
                        {new Date(ep.lastSeen).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section aria-labelledby="dev-session-heading" className="space-y-3 rounded-xl border border-border/60 bg-card/50 p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 id="dev-session-heading" className="flex items-center gap-2">
              <Server className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
              <DotMatrixText text="THIS BROWSER SESSION" size="xs" />
            </h2>
            <span className="text-xs text-muted-foreground">Latest 25 Supabase calls in this tab</span>
          </div>
          {sessionSamples.length === 0 ? (
            <p className="text-sm text-muted-foreground">No client calls captured yet in this tab.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="border-b border-border/60 text-muted-foreground">
                  <tr>
                    <th className="py-1.5 pr-3 font-medium">Time</th>
                    <th className="py-1.5 pr-3 font-medium">Provider</th>
                    <th className="py-1.5 pr-3 font-medium">Endpoint</th>
                    <th className="py-1.5 pr-3 text-right font-medium">Status</th>
                    <th className="py-1.5 text-right font-medium">Duration</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {sessionSamples.map((s, idx) => (
                    <tr key={`${s.occurredAt}-${idx}`}>
                      <td className="py-1.5 pr-3 whitespace-nowrap text-muted-foreground">
                        {new Date(s.occurredAt).toLocaleTimeString()}
                      </td>
                      <td className="py-1.5 pr-3 whitespace-nowrap">{labelForProvider(s.provider)}</td>
                      <td className="py-1.5 pr-3 break-all">{s.endpoint}</td>
                      <td className={`py-1.5 pr-3 text-right tabular-nums ${s.outcome === 'ok' ? '' : 'text-destructive'}`}>
                        {s.statusCode ?? 'ERR'}
                      </td>
                      <td className="py-1.5 text-right tabular-nums text-muted-foreground">{s.durationMs} ms</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
