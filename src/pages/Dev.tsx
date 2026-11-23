import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle, CheckCircle2, CircleDashed, History, RefreshCw, XCircle } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { DotMatrixText } from '@/components/dot-matrix/DotMatrixText';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { flushClientUsage, getSessionUsageSamples } from '@/integrations/supabase/api-usage-fetch';
import { formatRelativeTime } from '@/lib/format-date';
import { cn } from '@/lib/utils';
import {
  HEALTH_LABELS,
  HEALTH_TONE,
  RANGE_MS,
  SERVICES,
  callBuckets,
  callsIn,
  describeResult,
  formatDuration,
  isTimeout,
  labelForProvider,
  liveWindow,
  serviceForProvider,
  serviceStatus,
  summarise,
  topEndpoints,
  type ApiHealth,
  type ServiceDefinition,
  type ServiceId,
  type TimeRange,
  type UsageRow,
} from '@/features/dev/api-status';

const USAGE_COLUMNS = 'id, occurred_at, provider, endpoint, source, status_code, outcome, duration_ms, request_count';
/** Newest rows read per API for its current status. Enough to cover a burst, small enough to poll. */
const STATUS_ROWS = 50;
const HISTORY_ROW_LIMIT = 5000;
const CALL_LOG_ROWS = 100;

/** Status colours, from the site's own tokens: identity is never colour alone (icon + label + legend). */
const OUTCOME_SERIES = [
  { key: 'ok', label: 'OK', color: 'hsl(var(--positive))' },
  { key: 'rate_limited', label: 'Rate limited', color: 'hsl(var(--chart-4))' },
  { key: 'error', label: 'Error', color: 'hsl(var(--destructive))' },
] as const;

const TONE_STYLES = {
  good: 'bg-positive/15 text-positive',
  warning: 'bg-chart-4/15 text-chart-4',
  problem: 'bg-destructive/15 text-destructive',
  neutral: 'bg-secondary text-muted-foreground',
} as const;

function HealthIcon({ health, className }: { health: ApiHealth; className?: string }) {
  const tone = HEALTH_TONE[health];
  if (tone === 'good') return <CheckCircle2 className={className} aria-hidden="true" />;
  if (tone === 'warning') return <AlertTriangle className={className} aria-hidden="true" />;
  if (tone === 'problem') return <XCircle className={className} aria-hidden="true" />;
  return <CircleDashed className={className} aria-hidden="true" />;
}

function HealthPill({ health }: { health: ApiHealth }) {
  return (
    <span className={cn('inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-mono', TONE_STYLES[HEALTH_TONE[health]])}>
      <HealthIcon health={health} className="h-3 w-3" />
      {HEALTH_LABELS[health]}
    </span>
  );
}

const bucketLabel = (startMs: number, range: TimeRange) =>
  range === '1h' || range === '24h'
    ? new Date(startMs).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    : new Date(startMs).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

/** What a bucket spans, for the tooltip: "14:00–15:00", or the day. */
const bucketSpan = (startMs: number, range: TimeRange) => {
  if (range === '7d' || range === '30d') {
    return new Date(startMs).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  }
  const endMs = startMs + (range === '1h' ? 5 : 60) * 60 * 1000;
  return `${bucketLabel(startMs, range)}–${bucketLabel(endMs, range)}`;
};

const callTime = (iso: string) => {
  const date = new Date(iso);
  const time = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  return date.toDateString() === new Date().toDateString()
    ? time
    : `${date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} ${time}`;
};

interface ChartPoint {
  start: number;
  label: string;
  span: string;
  ok: number;
  rate_limited: number;
  error: number;
}

function BucketTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: ChartPoint }> }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  const total = point.ok + point.rate_limited + point.error;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs font-mono text-popover-foreground shadow-md">
      <p className="font-medium">{point.span}</p>
      <p className="text-muted-foreground">{total.toLocaleString()} call{total === 1 ? '' : 's'}</p>
      {total > 0 && (
        <ul className="mt-1 space-y-0.5">
          {OUTCOME_SERIES.map(series => (
            <li key={series.key} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: series.color }} />
                {series.label}
              </span>
              <span className="tabular-nums">{point[series.key].toLocaleString()}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type HistoryTab = 'overview' | 'log' | 'session';

export default function Dev() {
  const { isAdmin, isAuthLoading } = useAuth();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyService, setHistoryService] = useState<ServiceId | 'all'>('all');
  const [historyRange, setHistoryRange] = useState<TimeRange>('24h');
  const [historyTab, setHistoryTab] = useState<HistoryTab>('overview');

  // Ticks every second so the rate-limit countdown and "2m ago" stay true.
  useEffect(() => {
    if (!isAdmin) return;
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [isAdmin]);

  // Current status: each API's newest rows, however old. The bank holiday
  // feed is called four times a year and its last answer is still its state.
  const statusQueries = useQueries({
    queries: SERVICES.map(svc => ({
      queryKey: ['dev', 'api-status', svc.id],
      enabled: isAdmin,
      staleTime: 30_000,
      refetchInterval: 60_000,
      queryFn: async (): Promise<UsageRow[]> => {
        const { data, error } = await supabase
          .from('api_usage_events')
          .select(USAGE_COLUMNS)
          .in('provider', svc.providers)
          .order('occurred_at', { ascending: false })
          .order('id', { ascending: false })
          .limit(STATUS_ROWS);
        if (error) throw error;
        return (data ?? []) as UsageRow[];
      },
    })),
  });

  const rateLimitsQuery = useQuery({
    queryKey: ['dev', 'active-rate-limits'],
    enabled: isAdmin,
    staleTime: 10_000,
    refetchInterval: 15_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_active_rate_limits');
      if (error) throw error;
      return data ?? [];
    },
  });

  // History is read only while the dialog is open, for the one API it shows.
  const historyProviders = historyService === 'all' ? null : SERVICES.find(s => s.id === historyService)?.providers ?? null;
  const historyQuery = useQuery({
    queryKey: ['dev', 'api-history', historyRange, historyService],
    enabled: isAdmin && historyOpen,
    staleTime: 30_000,
    queryFn: async (): Promise<UsageRow[]> => {
      // PostgREST caps a single query at 1,000 rows; page in 1,000-row slices
      // up to HISTORY_ROW_LIMIT so Overview/charts never silently undercount.
      const PAGE_SIZE = 1000;
      const sinceIso = new Date(Date.now() - RANGE_MS[historyRange]).toISOString();
      const seen = new Set<number>();
      const collected: UsageRow[] = [];
      for (let offset = 0; offset < HISTORY_ROW_LIMIT; offset += PAGE_SIZE) {
        let query = supabase
          .from('api_usage_events')
          .select(USAGE_COLUMNS)
          .gte('occurred_at', sinceIso);
        if (historyProviders) query = query.in('provider', historyProviders);
        const { data, error } = await query
          .order('occurred_at', { ascending: false })
          .order('id', { ascending: false })
          .range(offset, Math.min(offset + PAGE_SIZE - 1, HISTORY_ROW_LIMIT - 1));
        if (error) throw error;
        const page = (data ?? []) as UsageRow[];
        for (const row of page) {
          if (!seen.has(row.id)) {
            seen.add(row.id);
            collected.push(row);
          }
        }
        if (page.length < PAGE_SIZE) break;
      }
      return collected;
    },
  });

  // Eight APIs of at most 50 rows each: cheap enough to recompute on the
  // one-second tick that keeps the countdowns true.
  const cards = SERVICES.map((svc, i) => {
    const query = statusQueries[i];
    const live = rateLimitsQuery.data ? liveWindow(svc, rateLimitsQuery.data, nowMs) : null;
    const state: ServiceCardProps['state'] = query.isError ? 'error' : query.isPending ? 'pending' : 'ok';
    return { svc, live, state, status: serviceStatus(query.data ?? [], svc, live) };
  });
  const allStatusFailed = statusQueries.every(q => q.isError);
  const failedCards = cards.filter(card => card.state === 'error');
  const needsLook = cards.filter(card => card.state === 'ok' && ['warning', 'problem'].includes(HEALTH_TONE[card.status.health]));

  const historyRows = useMemo(() => historyQuery.data ?? [], [historyQuery.data]);
  // The chart's "now" is when the rows were read, so it does not shift every second.
  const historyReadAt = historyQuery.dataUpdatedAt;
  const chartPoints = useMemo<ChartPoint[]>(
    () => callBuckets(historyRows, historyRange, historyReadAt || Date.now()).map(bucket => ({
      ...bucket,
      label: bucketLabel(bucket.start, historyRange),
      span: bucketSpan(bucket.start, historyRange),
    })),
    [historyRows, historyRange, historyReadAt],
  );
  const historySummary = useMemo(() => summarise(historyRows), [historyRows]);
  const historyEndpoints = useMemo(() => topEndpoints(historyRows), [historyRows]);
  const sessionSamples = getSessionUsageSamples().slice(-30).reverse();

  const openHistoryFor = (serviceId: ServiceId | 'all') => {
    setHistoryService(serviceId);
    setHistoryTab('overview');
    setHistoryOpen(true);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await flushClientUsage();
      await queryClient.invalidateQueries({ queryKey: ['dev'] });
    } finally {
      setRefreshing(false);
    }
  };

  if (isAuthLoading) {
    return (
      <AppShell title="Dev" subtitle="API status">
        <p role="status" className="text-sm text-muted-foreground">Checking access…</p>
      </AppShell>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  const historyTitle = historyTab === 'session'
    ? 'Session calls (this tab)'
    : historyService === 'all'
      ? 'API history'
      : `${SERVICES.find(s => s.id === historyService)?.name ?? historyService} history`;
  const historyTimeoutMs = (row: UsageRow) => serviceForProvider(row.provider)?.timeoutMs ?? null;

  return (
    <AppShell title="Dev" subtitle="API status">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <h2 className="text-xs"><DotMatrixText text="API STATUS" size="xs" /></h2>
            <p role="status" className="text-xs text-muted-foreground">
              {statusQueries.some(q => q.isPending)
                ? 'Checking each API…'
                : allStatusFailed
                  ? 'Could not reach Supabase to check API status.'
                  : failedCards.length > 0 || needsLook.length > 0
                    ? `Needs a look: ${[
                        ...failedCards.map(card => `${card.svc.name} (unavailable)`),
                        ...needsLook.map(card => `${card.svc.name} (${HEALTH_LABELS[card.status.health].toLowerCase()})`),
                      ].join(', ')}.`
                    : 'Every API answered normally on its latest calls.'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => openHistoryFor('all')} className="gap-1.5">
              <History className="h-3.5 w-3.5" aria-hidden="true" />
              History
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => void handleRefresh()} disabled={refreshing} className="gap-1.5">
              <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} aria-hidden="true" />
              Refresh
            </Button>
          </div>
        </div>

        {allStatusFailed && (
          <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            Could not read API usage from Supabase. Check that the `api_usage_events` migration is applied.
          </div>
        )}

        <section aria-label="APIs" className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {cards.map(({ svc, live, state, status }) => (
            <ServiceCard
              key={svc.id}
              svc={svc}
              live={live}
              state={state}
              status={status}
              nowMs={nowMs}
              onHistory={() => openHistoryFor(svc.id)}
            />
          ))}
        </section>
      </div>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{historyTitle}</DialogTitle>
            <DialogDescription>Calls over time, the busiest endpoints, and every recorded call.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1" role="group" aria-label="View">
                {([
                  ['overview', 'Overview'],
                  ['log', 'Call log'],
                  ['session', `This tab (${sessionSamples.length})`],
                ] as const).map(([tab, label]) => (
                  <Button
                    key={tab}
                    type="button"
                    size="sm"
                    variant={historyTab === tab ? 'secondary' : 'ghost'}
                    aria-pressed={historyTab === tab}
                    onClick={() => setHistoryTab(tab)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
              {historyTab !== 'session' && (
                <div className="flex items-center gap-1" role="group" aria-label="Time range">
                  {(['1h', '24h', '7d', '30d'] as const).map(range => (
                    <Button
                      key={range}
                      type="button"
                      size="sm"
                      variant={historyRange === range ? 'secondary' : 'ghost'}
                      aria-pressed={historyRange === range}
                      onClick={() => setHistoryRange(range)}
                    >
                      {range}
                    </Button>
                  ))}
                </div>
              )}
            </div>

            {historyTab !== 'session' && (
              <div className="flex flex-wrap items-center gap-1" role="group" aria-label="API">
                {([['all', 'All APIs'], ...SERVICES.map(svc => [svc.id, svc.name])] as Array<[ServiceId | 'all', string]>).map(([id, name]) => (
                  <Button
                    key={id}
                    type="button"
                    size="sm"
                    variant={historyService === id ? 'secondary' : 'ghost'}
                    aria-pressed={historyService === id}
                    onClick={() => setHistoryService(id)}
                    className="min-h-8 h-auto px-2.5 text-xs"
                  >
                    {name}
                  </Button>
                ))}
              </div>
            )}

            {historyTab !== 'session' && historyQuery.isError && (
              <p role="alert" className="text-sm text-destructive">Could not load history.</p>
            )}
            {historyTab !== 'session' && historyRows.length >= HISTORY_ROW_LIMIT && (
              <p className="text-xs text-muted-foreground">
                Showing the newest {HISTORY_ROW_LIMIT.toLocaleString()} records; pick one API or a shorter range to see all of it.
              </p>
            )}

            {historyTab === 'overview' && !historyQuery.isError && (
              <>
                <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {([
                    ['Calls', historySummary.calls.toLocaleString()],
                    ['Rate limited', historySummary.rateLimited.toLocaleString()],
                    ['Errors', historySummary.errors.toLocaleString()],
                    ['Average time', historySummary.avgMs != null ? formatDuration(historySummary.avgMs) : '—'],
                  ] as const).map(([label, value]) => (
                    <div key={label} className="rounded-lg border border-border/60 bg-card/40 px-3 py-2">
                      <dt className="text-xs text-muted-foreground">{label}</dt>
                      <dd className="mt-0.5 text-lg font-mono font-semibold tabular-nums">{historyQuery.isPending ? '…' : value}</dd>
                    </div>
                  ))}
                </dl>

                <div className="space-y-2 rounded-xl border border-border/60 bg-card/40 p-4">
                  <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                    Calls per {historyRange === '1h' ? '5 minutes' : historyRange === '24h' ? 'hour' : 'day'}
                  </h3>
                  {historyQuery.isPending ? (
                    <p className="text-sm text-muted-foreground">Loading history…</p>
                  ) : historySummary.calls === 0 ? (
                    <p className="text-sm text-muted-foreground">No calls recorded in this range.</p>
                  ) : (
                    <div
                      className="h-64 w-full"
                      role="img"
                      aria-label={`${historySummary.calls} calls in the last ${historyRange}: ${historySummary.rateLimited} rate limited, ${historySummary.errors} errors. The call log lists them.`}
                    >
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartPoints} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barCategoryGap="20%">
                          <CartesianGrid stroke="hsl(var(--border))" strokeOpacity={0.5} vertical={false} />
                          <XAxis
                            dataKey="label"
                            tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                            axisLine={{ stroke: 'hsl(var(--border))' }}
                            tickLine={false}
                            minTickGap={16}
                          />
                          <YAxis
                            width={44}
                            tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                            axisLine={false}
                            tickLine={false}
                            allowDecimals={false}
                          />
                          <Tooltip cursor={{ fill: 'hsl(var(--muted-foreground) / 0.08)' }} content={<BucketTooltip />} />
                          <Legend
                            verticalAlign="top"
                            align="right"
                            iconType="square"
                            iconSize={8}
                            wrapperStyle={{ fontSize: '12px', paddingBottom: '8px' }}
                            // The swatch carries the colour; the label stays in text ink.
                            formatter={(value: string) => <span className="text-muted-foreground">{value}</span>}
                          />
                          {OUTCOME_SERIES.map(series => (
                            <Bar
                              key={series.key}
                              dataKey={series.key}
                              name={series.label}
                              stackId="calls"
                              fill={series.color}
                              maxBarSize={28}
                              isAnimationActive={false}
                            />
                          ))}
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

                <div className="space-y-2 rounded-xl border border-border/60 bg-card/40 p-4">
                  <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Busiest endpoints</h3>
                  {historyEndpoints.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{historyQuery.isPending ? 'Loading…' : 'No endpoints recorded in this range.'}</p>
                  ) : (
                    <div className="app-scroll overflow-x-auto overflow-y-hidden overscroll-y-auto">
                      <table className="w-full text-left text-xs font-mono">
                        <thead className="border-b border-border/60 text-muted-foreground">
                          <tr>
                            <th className="py-2 pr-3 font-medium">API</th>
                            <th className="py-2 pr-3 font-medium">Endpoint</th>
                            <th className="py-2 pr-3 font-medium">From</th>
                            <th className="py-2 pr-3 text-right font-medium">Calls</th>
                            <th className="py-2 pr-3 text-right font-medium">429</th>
                            <th className="py-2 pr-3 text-right font-medium">Errors</th>
                            <th className="py-2 pr-3 text-right font-medium">Avg</th>
                            <th className="py-2 text-right font-medium">Last</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40">
                          {historyEndpoints.map(ep => (
                            <tr key={ep.key}>
                              <td className="py-2 pr-3 whitespace-nowrap">{labelForProvider(ep.provider)}</td>
                              <td className="py-2 pr-3 break-all">{ep.endpoint}</td>
                              <td className="py-2 pr-3 text-muted-foreground">{ep.source}</td>
                              <td className="py-2 pr-3 text-right tabular-nums font-semibold">{ep.calls.toLocaleString()}</td>
                              <td className={cn('py-2 pr-3 text-right tabular-nums', ep.rateLimited > 0 && 'text-chart-4')}>{ep.rateLimited}</td>
                              <td className={cn('py-2 pr-3 text-right tabular-nums', ep.errors > 0 && 'text-destructive')}>{ep.errors}</td>
                              <td className="py-2 pr-3 text-right tabular-nums whitespace-nowrap">{ep.avgMs != null ? formatDuration(ep.avgMs) : '—'}</td>
                              <td className="py-2 text-right whitespace-nowrap text-muted-foreground">{formatRelativeTime(ep.lastSeen, nowMs)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}

            {historyTab === 'log' && !historyQuery.isError && (
              <div className="space-y-2 rounded-xl border border-border/60 bg-card/40 p-4">
                <p className="text-xs text-muted-foreground">
                  The newest {CALL_LOG_ROWS} records in this range. Each record can stand for several calls batched together.
                </p>
                {historyRows.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{historyQuery.isPending ? 'Loading…' : 'No calls recorded in this range.'}</p>
                ) : (
                  <div className="app-scroll overflow-x-auto overflow-y-hidden overscroll-y-auto">
                    <table className="w-full text-left text-xs font-mono">
                      <thead className="border-b border-border/60 text-muted-foreground">
                        <tr>
                          <th className="py-1.5 pr-3 font-medium">Time</th>
                          <th className="py-1.5 pr-3 font-medium">API</th>
                          <th className="py-1.5 pr-3 font-medium">Endpoint</th>
                          <th className="py-1.5 pr-3 font-medium">Result</th>
                          <th className="py-1.5 pr-3 text-right font-medium">Calls</th>
                          <th className="py-1.5 text-right font-medium">Time taken</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {historyRows.slice(0, CALL_LOG_ROWS).map(row => (
                          <tr key={row.id}>
                            <td className="py-1.5 pr-3 whitespace-nowrap text-muted-foreground">{callTime(row.occurred_at)}</td>
                            <td className="py-1.5 pr-3 whitespace-nowrap">{labelForProvider(row.provider)}</td>
                            <td className="py-1.5 pr-3 break-all">{row.endpoint}</td>
                            <td className={cn('py-1.5 pr-3 whitespace-nowrap', row.outcome === 'error' ? 'text-destructive' : row.outcome === 'rate_limited' ? 'text-chart-4' : '')}>
                              {describeResult(row, historyTimeoutMs(row))}
                            </td>
                            <td className="py-1.5 pr-3 text-right tabular-nums">{callsIn(row)}</td>
                            <td className="py-1.5 text-right tabular-nums whitespace-nowrap text-muted-foreground">{formatDuration(row.duration_ms) || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {historyTab === 'session' && (
              <div className="space-y-2 rounded-xl border border-border/60 bg-card/40 p-4">
                <p className="text-xs text-muted-foreground">
                  The latest 30 calls this browser tab made, before they are batched and saved every 15 seconds.
                </p>
                {sessionSamples.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No calls captured in this tab yet.</p>
                ) : (
                  <div className="app-scroll overflow-x-auto overflow-y-hidden overscroll-y-auto">
                    <table className="w-full text-left text-xs font-mono">
                      <thead className="border-b border-border/60 text-muted-foreground">
                        <tr>
                          <th className="py-1.5 pr-3 font-medium">Time</th>
                          <th className="py-1.5 pr-3 font-medium">API</th>
                          <th className="py-1.5 pr-3 font-medium">Endpoint</th>
                          <th className="py-1.5 pr-3 text-right font-medium">Status</th>
                          <th className="py-1.5 text-right font-medium">Time taken</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {sessionSamples.map((sample, idx) => (
                          <tr key={`${sample.occurredAt}-${idx}`}>
                            <td className="py-1.5 pr-3 whitespace-nowrap text-muted-foreground">{callTime(sample.occurredAt)}</td>
                            <td className="py-1.5 pr-3 whitespace-nowrap">{labelForProvider(sample.provider)}</td>
                            <td className="py-1.5 pr-3 break-all">{sample.endpoint}</td>
                            <td
                              className={cn(
                                'py-1.5 pr-3 text-right tabular-nums whitespace-nowrap',
                                sample.outcome === 'error'
                                  ? 'text-destructive'
                                  : sample.outcome === 'rate_limited'
                                    ? 'text-chart-4'
                                    : '',
                              )}
                            >
                              {describeResult(
                                {
                                  outcome: sample.outcome,
                                  status_code: sample.statusCode,
                                  duration_ms: sample.durationMs,
                                },
                                serviceForProvider(sample.provider)?.timeoutMs ?? null,
                              )}
                            </td>
                            <td className="py-1.5 text-right tabular-nums text-muted-foreground">{formatDuration(sample.durationMs)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

interface ServiceCardProps {
  svc: ServiceDefinition;
  live: ReturnType<typeof liveWindow>;
  state: 'ok' | 'pending' | 'error';
  status: ReturnType<typeof serviceStatus>;
  nowMs: number;
  onHistory: () => void;
}

function ServiceCard({ svc, live, state, status, nowMs, onHistory }: ServiceCardProps) {
  const { lastCall, lastProblem } = status;
  const pct = live ? Math.min(100, Math.round((live.count / live.cap) * 100)) : 0;
  // A timeout already names how long it waited.
  const callLine = (row: UsageRow) =>
    [
      formatRelativeTime(row.occurred_at, nowMs),
      describeResult(row, svc.timeoutMs),
      isTimeout(row, svc.timeoutMs) ? '' : formatDuration(row.duration_ms),
      row.endpoint,
    ]
      .filter(Boolean)
      .join(' · ');

  return (
    <article aria-labelledby={`api-${svc.id}`} className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card/50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 id={`api-${svc.id}`} className="text-sm font-medium">{svc.name}</h3>
            {state === 'pending' ? (
              <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-mono text-muted-foreground">Checking…</span>
            ) : state === 'error' ? (
              <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-mono text-muted-foreground">Unknown</span>
            ) : (
              <HealthPill health={status.health} />
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {state === 'error' ? 'Could not read its recent calls.' : state === 'pending' ? svc.description : status.reason}
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onHistory}
          className="h-8 shrink-0 gap-1.5 px-2 text-xs"
          aria-label={`${svc.name} history`}
        >
          <History className="h-3.5 w-3.5" aria-hidden="true" />
          History
        </Button>
      </div>

      <dl className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-x-3 gap-y-1.5 border-t border-border/40 pt-3 text-xs font-mono">
        <dt className="text-muted-foreground">Last call</dt>
        <dd className="break-words">{lastCall ? callLine(lastCall) : 'None recorded'}</dd>

        <dt className="text-muted-foreground">Last problem</dt>
        <dd className={cn('break-words', lastProblem ? (lastProblem.outcome === 'error' ? 'text-destructive' : 'text-chart-4') : 'text-muted-foreground')}>
          {lastProblem ? callLine(lastProblem) : lastCall ? `None in the latest ${STATUS_ROWS} records` : '—'}
        </dd>

        <dt className="text-muted-foreground">Timeout</dt>
        <dd className="text-muted-foreground">{svc.timeoutLabel}</dd>

        <dt className="text-muted-foreground">Limit</dt>
        <dd>
          {live ? (
            <div className="space-y-1">
              <p className="tabular-nums">
                {live.count} / {live.cap} this minute
                <span className="text-muted-foreground">
                  {live.resetsInSec != null ? ` · resets in ${live.resetsInSec}s` : ' · window clear'}
                </span>
              </p>
              <div
                className="h-1.5 w-full max-w-48 overflow-hidden rounded-full bg-secondary"
                role="meter"
                aria-label={`${svc.name} calls this minute`}
                aria-valuemin={0}
                aria-valuemax={live.cap}
                aria-valuenow={live.count}
              >
                <div
                  className={cn('h-full transition-[width]', pct >= 100 ? 'bg-destructive' : pct >= 75 ? 'bg-chart-4' : 'bg-primary')}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          ) : (
            <span className="text-muted-foreground">{svc.limitLabel}</span>
          )}
        </dd>
      </dl>

      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer select-none font-mono hover:text-foreground">How and why it’s used</summary>
        <div className="mt-1.5 space-y-1 rounded-md border border-border/40 bg-background/40 p-2 leading-relaxed">
          <p>{svc.description}</p>
          <p><span className="font-mono text-foreground/85">How:</span> {svc.howUsed}</p>
          <p><span className="font-mono text-foreground/85">Why:</span> {svc.whyUsed}</p>
        </div>
      </details>
    </article>
  );
}
