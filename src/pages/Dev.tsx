import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Gauge,
  History,
  RefreshCw,
  Server,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { DotMatrixText } from '@/components/dot-matrix/DotMatrixText';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { flushClientUsage, getSessionUsageSamples } from '@/integrations/supabase/api-usage-fetch';

type TimeRange = '1h' | '24h' | '7d' | '30d';
type ServiceGroupId =
  | 'tmdb'
  | 'omdb'
  | 'wikidata'
  | 'supabase'
  | 'truelayer'
  | 'brandfetch'
  | 'bank_holidays'
  | 'books';

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

interface ServiceDefinition {
  id: ServiceGroupId;
  name: string;
  description: string;
  howUsed: string;
  whyUsed: string;
  providers: string[];
  limitLabel: string;
  rateLimitPrefix?: string;
  rateLimitCap?: number;
  windowSeconds?: number;
}

const SERVICES: ServiceDefinition[] = [
  {
    id: 'tmdb',
    name: 'TMDB (Proxy & Cron)',
    description: 'The Movie Database API for films, TV shows, posters, collections & recommendations.',
    howUsed: 'Called via tmdb-proxy during Watchlist browsing/Discover/Franchises and via watchlist-cron-sync nightly.',
    whyUsed: 'Keeps the TMDB API key server-side and fills in release dates, episodes, collections, and suggestions.',
    providers: ['tmdb'],
    limitLabel: '60 req / min per IP (proxy)',
    rateLimitPrefix: 'tmdb-proxy:',
    rateLimitCap: 60,
    windowSeconds: 60,
  },
  {
    id: 'omdb',
    name: 'OMDb',
    description: 'Open Movie Database ratings API (IMDb score, Metascore, Rotten Tomatoes).',
    howUsed: 'Called server-side by watchlist-cron-sync using each title’s IMDb ID on a weekly refresh pass.',
    whyUsed: 'TMDB does not include IMDb or Rotten Tomatoes ratings; OMDb supplies those critic and audience scores.',
    providers: ['omdb'],
    limitLabel: '1,000 req / day (free tier)',
  },
  {
    id: 'wikidata',
    name: 'Wikidata',
    description: 'Public SPARQL knowledge graph linking TV series to their spin-offs, and films to shared universes.',
    howUsed: 'Queried by tmdb-proxy: wikidata/tv-spinoffs with your library’s TV TMDB IDs, and wikidata/film-universes for the Marvel Cinematic Universe’s films. Both cached for 24 hours.',
    whyUsed: 'TMDB has film collections but no TV franchise grouping, and splits a shared universe like the MCU into small collections; Wikidata links both.',
    providers: ['wikidata'],
    limitLabel: 'Shared with tmdb-proxy (60 / min)',
  },
  {
    id: 'supabase',
    name: 'Supabase',
    description: 'Backend platform powering Postgres REST tables, RPC functions, Edge Functions, Auth & Storage.',
    howUsed: 'Called directly from the browser for all app data, admin authentication/MFA, and Edge Function invokes.',
    whyUsed: 'Provides the database, row-level security, file storage, and serverless proxies for this static site.',
    providers: ['supabase_rest', 'supabase_rpc', 'supabase_functions', 'supabase_auth', 'supabase_storage'],
    limitLabel: '25s client REST timeout',
  },
  {
    id: 'truelayer',
    name: 'TrueLayer',
    description: 'UK Open Banking API connecting your bank accounts and credit cards.',
    howUsed: 'Called server-side by truelayer-sync on the 05:00 daily cron and when you click Sync in Finance.',
    whyUsed: 'Imports live balances and transaction history securely without storing banking credentials.',
    providers: ['truelayer'],
    limitLabel: '15m manual sync cooldown (05:00 cron)',
    rateLimitPrefix: 'truelayer-sync:',
  },
  {
    id: 'brandfetch',
    name: 'Brandfetch',
    description: 'Brand search and icon CDN for merchant logos.',
    howUsed: 'Called server-side once per new merchant by merchant-logo-cache and saved to Supabase Storage.',
    whyUsed: 'Avoids sending your live spend history or IP to a third-party logo host on every Finance page render.',
    providers: ['brandfetch'],
    limitLabel: 'Cached permanently in Storage',
  },
  {
    id: 'bank_holidays',
    name: 'UK Bank Holidays',
    description: 'Official GOV.UK bank holidays JSON feed (England & Wales, Scotland, NI).',
    howUsed: 'Fetched by sync-bank-holidays on a quarterly cron (or manual trigger) into uk_bank_holidays.',
    whyUsed: 'Calculates accurate UK working-day paydays and recurring bill dates in Finance.',
    providers: ['bank_holidays'],
    limitLabel: 'Quarterly cron / manual',
  },
  {
    id: 'books',
    name: 'Book Catalogues',
    description: 'Open Library & Google Books public metadata APIs.',
    howUsed: 'Queried from the browser only when searching for a book to add or backfill in the Books section.',
    whyUsed: 'Auto-fills book titles, authors, covers, page counts, and publication dates.',
    providers: ['open_library', 'google_books'],
    limitLabel: 'On-demand browser lookups',
  },
];

const RANGE_MS: Record<TimeRange, number> = {
  '1h': 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
};

const PROVIDER_LABELS: Record<string, string> = {
  tmdb: 'TMDB',
  omdb: 'OMDb',
  wikidata: 'Wikidata',
  bank_holidays: 'UK Bank Holidays',
  truelayer: 'TrueLayer',
  brandfetch: 'Brandfetch',
  open_library: 'Open Library',
  google_books: 'Google Books',
  supabase_rest: 'Supabase REST',
  supabase_rpc: 'Supabase RPC',
  supabase_functions: 'Edge Functions',
  supabase_auth: 'Supabase Auth',
  supabase_storage: 'Supabase Storage',
};

const PROVIDER_COLORS: Record<string, string> = {
  tmdb: '#f59e0b',
  omdb: '#eab308',
  wikidata: '#a855f7',
  bank_holidays: '#14b8a6',
  truelayer: '#ec4899',
  brandfetch: '#f97316',
  open_library: '#0ea5e9',
  google_books: '#22c55e',
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
  if (range === '1h' || range === '24h') {
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

function formatRelativeTime(iso: string | null): string {
  if (!iso) return 'No recent calls';
  const diffSec = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.round(diffHr / 24)}d ago`;
}

export default function Dev() {
  const { isAdmin, isAuthLoading } = useAuth();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  // History modal state (opened via card "History" button or top "All History" button)
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyService, setHistoryService] = useState<ServiceGroupId | 'all'>('all');
  const [historyRange, setHistoryRange] = useState<TimeRange>('24h');
  const [historyTab, setHistoryTab] = useState<'overview' | 'session'>('overview');

  // Tick every second so live rate-limit reset countdowns stay accurate.
  useEffect(() => {
    if (!isAdmin) return;
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [isAdmin]);

  const statusSinceIso = useMemo(() => new Date(Date.now() - RANGE_MS['24h']).toISOString(), []);
  const historySinceIso = useMemo(() => new Date(Date.now() - RANGE_MS[historyRange]).toISOString(), [historyRange]);

  const statusUsageQuery = useQuery({
    queryKey: ['dev', 'api-usage', '24h'],
    enabled: isAdmin,
    staleTime: 30_000,
    queryFn: async (): Promise<UsageRow[]> => {
      const { data, error } = await supabase
        .from('api_usage_events')
        .select('id, occurred_at, provider, endpoint, source, status_code, outcome, duration_ms, request_count')
        .gte('occurred_at', statusSinceIso)
        .order('occurred_at', { ascending: false })
        .limit(5000);
      if (error) throw error;
      return (data ?? []) as UsageRow[];
    },
  });

  const historyUsageQuery = useQuery({
    queryKey: ['dev', 'api-usage', historyRange],
    enabled: isAdmin && historyOpen && historyRange !== '24h',
    staleTime: 30_000,
    queryFn: async (): Promise<UsageRow[]> => {
      const { data, error } = await supabase
        .from('api_usage_events')
        .select('id, occurred_at, provider, endpoint, source, status_code, outcome, duration_ms, request_count')
        .gte('occurred_at', historySinceIso)
        .order('occurred_at', { ascending: false })
        .limit(5000);
      if (error) throw error;
      return (data ?? []) as UsageRow[];
    },
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

  const rows24h = useMemo(() => statusUsageQuery.data ?? [], [statusUsageQuery.data]);
  const historyAllRows = useMemo(
    () => (historyRange === '24h' ? rows24h : historyUsageQuery.data ?? []),
    [historyRange, rows24h, historyUsageQuery.data],
  );

  const summary24h = useMemo(() => {
    let totalCalls = 0;
    let rateLimited = 0;
    let errors = 0;
    let durationSum = 0;
    let durationN = 0;
    for (const row of rows24h) {
      const n = Math.max(1, row.request_count || 1);
      totalCalls += n;
      if (row.outcome === 'rate_limited') rateLimited += n;
      else if (row.outcome === 'error') errors += n;
      if (row.duration_ms != null) {
        durationSum += row.duration_ms * n;
        durationN += n;
      }
    }
    return {
      totalCalls,
      rateLimited,
      errors,
      avgMs: durationN > 0 ? Math.round(durationSum / durationN) : null,
    };
  }, [rows24h]);

  const serviceCards = useMemo(() => {
    const oneHourAgo = nowMs - RANGE_MS['1h'];
    const activeLimits = rateLimitsQuery.data ?? [];

    return SERVICES.map((svc) => {
      const providerSet = new Set(svc.providers);
      let calls1h = 0;
      let calls24h = 0;
      let rateLimited24h = 0;
      let errors24h = 0;
      let durationSum = 0;
      let durationN = 0;
      let lastSeen: string | null = null;

      for (const row of rows24h) {
        if (!providerSet.has(row.provider)) continue;
        const n = Math.max(1, row.request_count || 1);
        calls24h += n;
        const ts = Date.parse(row.occurred_at);
        if (!Number.isNaN(ts) && ts >= oneHourAgo) calls1h += n;
        if (row.outcome === 'rate_limited') rateLimited24h += n;
        else if (row.outcome === 'error') errors24h += n;
        if (row.duration_ms != null) {
          durationSum += row.duration_ms * n;
          durationN += n;
        }
        if (!lastSeen || row.occurred_at > lastSeen) lastSeen = row.occurred_at;
      }

      // Find the currently active rate-limit window (still open right now) for this service
      let liveCount = 0;
      let resetsInSec: number | null = null;
      if (svc.rateLimitPrefix && svc.windowSeconds) {
        for (const rl of activeLimits) {
          if (!rl.key.startsWith(svc.rateLimitPrefix)) continue;
          const startMs = Date.parse(rl.window_start);
          const endMs = startMs + svc.windowSeconds * 1000;
          if (endMs > nowMs && rl.count > liveCount) {
            liveCount = rl.count;
            resetsInSec = Math.max(1, Math.ceil((endMs - nowMs) / 1000));
          }
        }
      }

      const cap = svc.rateLimitCap ?? null;
      const pct = cap ? Math.min(100, Math.round((liveCount / cap) * 100)) : null;

      let status: 'healthy' | 'near-limit' | 'rate-limited' | 'errors' | 'idle' = 'idle';
      if (cap && liveCount >= cap) status = 'rate-limited';
      else if (cap && liveCount >= Math.round(cap * 0.75)) status = 'near-limit';
      else if (errors24h > 0 && calls24h > 0 && errors24h / calls24h >= 0.1) status = 'errors';
      else if (calls24h > 0 || liveCount > 0) status = 'healthy';

      return {
        ...svc,
        calls1h,
        calls24h,
        rateLimited24h,
        errors24h,
        avgMs: durationN > 0 ? Math.round(durationSum / durationN) : null,
        lastSeen,
        liveCount,
        resetsInSec,
        cap,
        pct,
        status,
      };
    });
  }, [rows24h, rateLimitsQuery.data, nowMs]);

  const historyRows = useMemo(() => {
    if (historyService === 'all') return historyAllRows;
    const svc = SERVICES.find((s) => s.id === historyService);
    if (!svc) return historyAllRows;
    const allowed = new Set(svc.providers);
    return historyAllRows.filter((r) => allowed.has(r.provider));
  }, [historyAllRows, historyService]);

  const historyChart = useMemo(() => {
    const buckets = new Map<number, Record<string, number | string>>();
    const activeProviders = new Set<string>();
    for (const row of historyRows) {
      const ms = Date.parse(row.occurred_at);
      if (Number.isNaN(ms)) continue;
      const bMs = bucketStartMs(ms, historyRange);
      const bucket = buckets.get(bMs) ?? { ts: bMs, label: formatBucketLabel(new Date(bMs), historyRange) };
      const current = typeof bucket[row.provider] === 'number' ? (bucket[row.provider] as number) : 0;
      bucket[row.provider] = current + Math.max(1, row.request_count || 1);
      buckets.set(bMs, bucket);
      activeProviders.add(row.provider);
    }
    return {
      points: [...buckets.entries()].sort(([a], [b]) => a - b).map(([, v]) => v),
      providers: [...activeProviders].sort(),
    };
  }, [historyRows, historyRange]);

  const historyEndpoints = useMemo(() => {
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
    for (const row of historyRows) {
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
  }, [historyRows]);

  const sessionSamples = getSessionUsageSamples().slice(-30).reverse();

  const openHistoryFor = (serviceId: ServiceGroupId | 'all') => {
    setHistoryService(serviceId);
    setHistoryTab('overview');
    setHistoryOpen(true);
  };

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
      <AppShell title="Dev" subtitle="API Status & Quotas">
        <p role="status" className="text-sm text-muted-foreground">Checking access…</p>
      </AppShell>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  const activeHistoryTitle =
    historyService === 'all'
      ? 'All APIs & Supabase History'
      : `${SERVICES.find((s) => s.id === historyService)?.name ?? historyService} History`;

  return (
    <AppShell title="Dev" subtitle="API Status & Quotas">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-card/50 p-3">
          <div className="space-y-0.5">
            <h2 className="text-xs"><DotMatrixText text="API HEALTH & RATE LIMITS" size="xs" /></h2>
            <p className="text-xs text-muted-foreground">
              Live quota status and 24-hour health per service. Open History on any API for charts and endpoint logs.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => openHistoryFor('all')} className="gap-1.5">
              <History className="h-3.5 w-3.5" aria-hidden="true" />
              All History
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => void handleRefresh()} disabled={refreshing} className="gap-1.5">
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
              Flush &amp; Refresh
            </Button>
          </div>
        </div>

        {statusUsageQuery.isError && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            Could not load stored metrics from Supabase. Make sure `api_usage_events` migration is applied.
          </div>
        )}

        <section aria-labelledby="dev-summary-heading" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <h2 id="dev-summary-heading" className="sr-only">24-hour summary</h2>
          <div className="rounded-xl border border-border/60 bg-card/50 p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Activity className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
              <span>Calls (24h)</span>
            </div>
            <p className="mt-2 text-2xl font-mono font-semibold tabular-nums">{summary24h.totalCalls.toLocaleString()}</p>
          </div>
          <div className="rounded-xl border border-border/60 bg-card/50 p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Gauge className="h-3.5 w-3.5 text-amber-500" aria-hidden="true" />
              <span>Rate limited (24h)</span>
            </div>
            <p className="mt-2 text-2xl font-mono font-semibold tabular-nums">{summary24h.rateLimited.toLocaleString()}</p>
          </div>
          <div className="rounded-xl border border-border/60 bg-card/50 p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <AlertTriangle className="h-3.5 w-3.5 text-destructive" aria-hidden="true" />
              <span>Errors (24h)</span>
            </div>
            <p className="mt-2 text-2xl font-mono font-semibold tabular-nums">{summary24h.errors.toLocaleString()}</p>
          </div>
          <div className="rounded-xl border border-border/60 bg-card/50 p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
              <span>Avg latency (24h)</span>
            </div>
            <p className="mt-2 text-2xl font-mono font-semibold tabular-nums">
              {summary24h.avgMs != null ? `${summary24h.avgMs} ms` : '—'}
            </p>
          </div>
        </section>

        <section aria-labelledby="dev-services-heading" className="space-y-3">
          <h2 id="dev-services-heading" className="sr-only">Services</h2>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {serviceCards.map((svc) => (
              <div
                key={svc.id}
                className="flex flex-col justify-between gap-4 rounded-xl border border-border/60 bg-card/50 p-4"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-medium">{svc.name}</h3>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-mono ${
                            svc.status === 'rate-limited'
                              ? 'bg-destructive/15 text-destructive'
                              : svc.status === 'near-limit'
                                ? 'bg-amber-500/15 text-amber-400'
                                : svc.status === 'errors'
                                  ? 'bg-destructive/15 text-destructive'
                                  : svc.status === 'healthy'
                                    ? 'bg-emerald-500/15 text-emerald-400'
                                    : 'bg-secondary text-muted-foreground'
                          }`}
                        >
                          {svc.status === 'healthy' && <CheckCircle2 className="h-3 w-3" aria-hidden="true" />}
                          {svc.status === 'rate-limited' && 'Rate limited (429)'}
                          {svc.status === 'near-limit' && 'Near limit'}
                          {svc.status === 'errors' && 'Elevated errors'}
                          {svc.status === 'healthy' && 'Healthy'}
                          {svc.status === 'idle' && 'Idle'}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">{svc.description}</p>
                      <details className="pt-1 text-xs text-muted-foreground">
                        <summary className="cursor-pointer select-none text-[11px] font-mono text-muted-foreground/80 hover:text-foreground">
                          How &amp; why it’s used
                        </summary>
                        <div className="mt-1.5 space-y-1 rounded-md border border-border/40 bg-background/40 p-2 text-[11px] leading-relaxed">
                          <p><span className="font-mono text-foreground/85">How:</span> {svc.howUsed}</p>
                          <p><span className="font-mono text-foreground/85">Why:</span> {svc.whyUsed}</p>
                        </div>
                      </details>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => openHistoryFor(svc.id)}
                      className="shrink-0 gap-1.5 text-xs"
                    >
                      <History className="h-3.5 w-3.5" aria-hidden="true" />
                      History
                    </Button>
                  </div>

                  {svc.cap != null ? (
                    <div className="rounded-lg border border-border/50 bg-background/50 p-2.5 space-y-1.5">
                      <div className="flex items-center justify-between gap-2 text-xs font-mono">
                        <span className="text-muted-foreground">Current 60s window</span>
                        <span className="tabular-nums font-semibold">
                          {svc.liveCount} / {svc.cap}
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                        <div
                          className={`h-full transition-all ${
                            (svc.pct ?? 0) >= 90
                              ? 'bg-destructive'
                              : (svc.pct ?? 0) >= 75
                                ? 'bg-amber-500'
                                : 'bg-primary'
                          }`}
                          style={{ width: `${svc.pct ?? 0}%` }}
                        />
                      </div>
                      <p className="text-[11px] font-mono text-muted-foreground">
                        {svc.resetsInSec != null
                          ? `Window resets in ${svc.resetsInSec}s`
                          : 'Ready — 0 calls in current window'}
                      </p>
                    </div>
                  ) : (
                    <p className="text-[11px] font-mono text-muted-foreground">Limit: {svc.limitLabel}</p>
                  )}
                </div>

                <div className="grid grid-cols-4 gap-2 border-t border-border/40 pt-3 text-xs font-mono">
                  <div>
                    <p className="text-[11px] text-muted-foreground">1h / 24h</p>
                    <p className="tabular-nums font-medium">{svc.calls1h} / {svc.calls24h}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground">429 / Err</p>
                    <p className={`tabular-nums font-medium ${svc.rateLimited24h > 0 || svc.errors24h > 0 ? 'text-amber-400' : ''}`}>
                      {svc.rateLimited24h} / {svc.errors24h}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground">Avg ms</p>
                    <p className="tabular-nums font-medium">{svc.avgMs != null ? `${svc.avgMs}` : '—'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] text-muted-foreground">Last call</p>
                    <p className="tabular-nums text-muted-foreground">{formatRelativeTime(svc.lastSeen)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{activeHistoryTitle}</DialogTitle>
            <DialogDescription>
              Historical call volume, endpoint breakdown, and live browser session log.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1" role="group" aria-label="History view">
                <Button
                  type="button"
                  size="sm"
                  variant={historyTab === 'overview' ? 'secondary' : 'ghost'}
                  onClick={() => setHistoryTab('overview')}
                >
                  Charts &amp; Endpoints
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={historyTab === 'session' ? 'secondary' : 'ghost'}
                  onClick={() => setHistoryTab('session')}
                  className="gap-1.5"
                >
                  <Server className="h-3.5 w-3.5" aria-hidden="true" />
                  This Session ({sessionSamples.length})
                </Button>
              </div>

              {historyTab === 'overview' && (
                <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Time range">
                  {(['1h', '24h', '7d', '30d'] as const).map((r) => (
                    <Button
                      key={r}
                      type="button"
                      size="sm"
                      variant={historyRange === r ? 'secondary' : 'ghost'}
                      onClick={() => setHistoryRange(r)}
                    >
                      {r}
                    </Button>
                  ))}
                </div>
              )}
            </div>

            {historyTab === 'overview' && (
              <>
                <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Service filter">
                  <Button
                    type="button"
                    size="sm"
                    variant={historyService === 'all' ? 'secondary' : 'ghost'}
                    onClick={() => setHistoryService('all')}
                  >
                    All
                  </Button>
                  {SERVICES.map((svc) => (
                    <Button
                      key={svc.id}
                      type="button"
                      size="sm"
                      variant={historyService === svc.id ? 'secondary' : 'ghost'}
                      onClick={() => setHistoryService(svc.id)}
                    >
                      {svc.name}
                    </Button>
                  ))}
                </div>

                <div className="space-y-2 rounded-xl border border-border/60 bg-card/40 p-4">
                  <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                    Calls over time ({historyRange})
                  </h3>
                  {historyUsageQuery.isPending && historyRange !== '24h' ? (
                    <p className="text-sm text-muted-foreground">Loading history…</p>
                  ) : historyChart.points.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No calls recorded in this window.</p>
                  ) : (
                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={historyChart.points} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.35} vertical={false} />
                          <XAxis
                            dataKey="label"
                            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                            axisLine={{ stroke: 'hsl(var(--border))' }}
                            tickLine={false}
                          />
                          <YAxis
                            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                            axisLine={false}
                            tickLine={false}
                            allowDecimals={false}
                          />
                          <Tooltip
                            cursor={{ fill: 'hsl(var(--muted))', opacity: 0.2 }}
                            contentStyle={{
                              backgroundColor: 'hsl(var(--popover))',
                              borderColor: 'hsl(var(--border))',
                              borderRadius: '0.5rem',
                              fontSize: '12px',
                              color: 'hsl(var(--popover-foreground))',
                            }}
                          />
                          <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                          {historyChart.providers.map((provider) => (
                            <Bar
                              key={provider}
                              dataKey={provider}
                              name={labelForProvider(provider)}
                              stackId="calls"
                              fill={colorForProvider(provider)}
                              maxBarSize={44}
                              radius={[2, 2, 0, 0]}
                            />
                          ))}
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

                <div className="space-y-2 rounded-xl border border-border/60 bg-card/40 p-4">
                  <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                    Top endpoints ({historyRange})
                  </h3>
                  {historyEndpoints.length === 0 ? (
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
                          {historyEndpoints.map((ep) => (
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
                                {formatRelativeTime(ep.lastSeen)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}

            {historyTab === 'session' && (
              <div className="space-y-2 rounded-xl border border-border/60 bg-card/40 p-4">
                <p className="text-xs text-muted-foreground">
                  Latest 30 client-side Supabase calls captured in this browser tab (flushed to Supabase every 15s).
                </p>
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
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
