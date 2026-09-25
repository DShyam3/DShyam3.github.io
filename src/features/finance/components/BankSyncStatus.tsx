/**
 * Bank sync status: when each bank last synced, the run history, and any
 * nightly run that never landed.
 *
 * The nightly pg_cron job is otherwise invisible -- the banks' last-synced
 * times move on a manual press too -- so this is where to check it is still
 * doing its job. The Transactions tab and Wealth both show it; the host owns
 * the `useTrueLayer` state and passes it in, so opening this costs no second
 * connection check.
 */

import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, History, RefreshCw, Timer, X, XCircle } from 'lucide-react';
import { SyncHistoryIcon } from '@/components/shared/SyncHistoryIcon';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { formatRelativeTime } from '@/lib/format-date';
import { formatCooldownEnd } from '@/hooks/useCooldown';
import type { TrueLayerStatus } from '../finance-types';
import { buildBankSyncHistory, nextScheduledSync, type BankSyncHistoryEntry } from '../bank-sync-history';
import { useBankSyncLog } from '../useBankSyncLog';

/** A consent this close to expiry is worth renewing before a nightly run fails on it. */
const CONSENT_WARNING_DAYS = 14;

interface BankSyncStatusProps {
  status: TrueLayerStatus | null;
  isSyncing: boolean;
  syncAvailableAt: number | null;
  onSync: () => void;
  className?: string;
}

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Today 18:57", "Yesterday 05:00", "22 Sep 05:00" -- short enough for one row. */
const formatRunTime = (iso: string, now: Date) => {
  const date = new Date(iso);
  const time = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const daysAgo = Math.round((startOf(now) - startOf(date)) / 86_400_000);
  if (daysAgo === 0) return `Today ${time}`;
  if (daysAgo === 1) return `Yesterday ${time}`;
  return `${date.getDate()} ${SHORT_MONTHS[date.getMonth()]} ${time}`;
};

/* One short phrase per run; the banks are listed above, so the row only says
   what changed. Bank count and duration stay on hover. */
const runSummary = (entry: BankSyncHistoryEntry) => {
  if (entry.status === 'missed') return 'No run recorded';
  if (entry.status === 'error' && entry.error_message) return entry.error_message;
  return `${entry.transactions_new} new`;
};

const runDetail = (entry: BankSyncHistoryEntry) =>
  entry.status === 'missed'
    ? 'The nightly sync left no record for this night'
    : `${entry.connections_synced} bank${entry.connections_synced === 1 ? '' : 's'} · ${entry.transactions_synced} transactions read · ${(entry.duration_ms / 1000).toFixed(1)}s`;

export function BankSyncStatus({ status, isSyncing, syncAvailableAt, onSync, className }: BankSyncStatusProps) {
  const [open, setOpen] = useState(false);
  // Reset on each open, so "missed" and "next sync" reflect when the popover
  // was looked at rather than when the page loaded.
  const [now, setNow] = useState(() => new Date());
  const connections = useMemo(() => status?.connections ?? [], [status]);
  const { data: rows = [], isError } = useBankSyncLog(connections.length > 0);
  const history = useMemo(() => buildBankSyncHistory(rows, now), [rows, now]);

  const handleOpenChange = (next: boolean) => {
    if (next) setNow(new Date());
    setOpen(next);
  };

  if (connections.length === 0) return null;

  const lastSynced = connections.reduce<string | null>(
    (newest, connection) =>
      connection.last_synced_at && (!newest || connection.last_synced_at > newest) ? connection.last_synced_at : newest,
    null,
  );
  // The newest run, and separately the newest nightly one: a manual press
  // every morning must not hide a nightly job that has stopped. An old failure
  // since fixed is history and raises nothing.
  const latest = history[0];
  const latestNightly = history.find(entry => entry.trigger === 'scheduled');
  const needsAttention = [latest, latestNightly].some(entry => entry !== undefined && entry.status !== 'success');

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn('h-9 border-border/40 rounded-lg text-xs gap-1.5 bg-background/30 hover:bg-background/80 hover:text-foreground font-mono', className)}
          aria-label={needsAttention ? 'Bank sync status, last run needs attention' : 'Bank sync status'}
        >
          <SyncHistoryIcon spinning={isSyncing} className="h-3.5 w-3.5" />
          <span>{isSyncing ? 'Syncing…' : lastSynced ? `Synced ${formatRelativeTime(lastSynced)}` : 'Not synced'}</span>
          {needsAttention && <span className="h-2 w-2 rounded-full bg-destructive" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        collisionPadding={12}
        className="flex w-96 max-w-[calc(100vw-24px)] flex-col gap-3 overflow-hidden font-mono"
        style={{ maxHeight: 'min(520px, var(--radix-popover-content-available-height))' }}
        aria-label="Bank sync status"
      >
        <div className="flex shrink-0 items-center justify-between gap-2">
          <h3 className="text-xs uppercase tracking-wider font-semibold text-muted-foreground flex items-center gap-1.5">
            <History className="h-3.5 w-3.5" /> Bank sync
          </h3>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={onSync}
              // The server refuses inside its cooldown whatever the button
              // says; disabling it only tells you before you ask.
              disabled={isSyncing || syncAvailableAt !== null}
              className="h-9 gap-1.5 text-xs"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', isSyncing && 'animate-spin')} />
              {isSyncing
                ? 'Syncing…'
                : syncAvailableAt !== null
                  ? `Next sync ${formatCooldownEnd(syncAvailableAt)}`
                  : 'Sync now'}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)} className="h-9 w-9 p-0" aria-label="Close bank sync status">
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <ul className="shrink-0 space-y-1" aria-label="Banks">
          {connections.map(connection => {
            const consentEnds = connection.consent_expires_at ? new Date(connection.consent_expires_at) : null;
            const consentSoon = consentEnds !== null
              && consentEnds.getTime() - now.getTime() < CONSENT_WARNING_DAYS * 24 * 60 * 60 * 1000;
            return (
              <li key={connection.id} className="flex items-center justify-between gap-2 text-xs">
                <span className="truncate text-foreground">{connection.provider_name}</span>
                <span className="flex shrink-0 items-center gap-2 text-muted-foreground">
                  {consentSoon && (
                    <span className="text-destructive">
                      {consentEnds.getTime() < now.getTime()
                        ? 'Consent expired'
                        : `Consent ends ${consentEnds.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`}
                    </span>
                  )}
                  <span>{connection.last_synced_at ? formatRelativeTime(connection.last_synced_at, now.getTime()) : 'Never'}</span>
                </span>
              </li>
            );
          })}
        </ul>

        <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto overscroll-contain border-t border-border/50 pt-2 pr-1">
          {isError ? (
            <p className="py-2 text-center text-xs text-muted-foreground">Could not load sync history</p>
          ) : history.length === 0 ? (
            <p className="py-2 text-center text-xs text-muted-foreground">No runs logged yet</p>
          ) : (
            <ul className="space-y-1.5" aria-label="Sync history">
              {history.map(entry => {
                const failed = entry.status === 'missed' || entry.status === 'error';
                const failedBanks = entry.banks.filter(bank => bank.status === 'failed');
                return (
                  <li
                    key={entry.id}
                    title={runDetail(entry)}
                    className={cn(
                      'rounded-sm px-2 py-1.5 text-xs',
                      failed
                        ? 'border border-destructive/20 bg-destructive/10'
                        : entry.status === 'partial'
                          ? 'border border-chart-4/25 bg-chart-4/10'
                          : 'bg-secondary/30',
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-1.5">
                        {failed ? (
                          <XCircle className="h-3 w-3 shrink-0 text-destructive" />
                        ) : entry.status === 'partial' ? (
                          <AlertTriangle className="h-3 w-3 shrink-0 text-chart-4" />
                        ) : (
                          <CheckCircle2 className="h-3 w-3 shrink-0 text-muted-foreground" />
                        )}
                        <span
                          className={cn(
                            'shrink-0 rounded-sm px-1 text-xs font-semibold',
                            failed ? 'bg-destructive/20 text-destructive' : 'bg-secondary text-muted-foreground',
                          )}
                        >
                          {entry.status === 'missed' ? 'Missed' : entry.trigger === 'scheduled' ? 'Nightly' : 'Manual'}
                        </span>
                        <span className={cn('truncate', failed ? 'text-destructive' : 'text-muted-foreground')}>
                          {runSummary(entry)}
                        </span>
                      </span>
                      <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">
                        {formatRunTime(entry.synced_at, now)}
                      </span>
                    </div>
                    {failedBanks.length > 0 && (
                      <ul className="mt-1 space-y-0.5 pl-5 text-xs text-muted-foreground">
                        {failedBanks.map((bank, index) => (
                          <li key={`${bank.name}-${index}`}>
                            <span className="text-foreground">{bank.name}</span>: {bank.error ?? 'Sync failed'}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <p className="shrink-0 flex items-center gap-1 border-t border-border/50 pt-1.5 text-xs text-muted-foreground">
          <Timer className="h-3 w-3" />
          Next nightly sync{' '}
          {nextScheduledSync(now).toLocaleString('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit' })}
        </p>
      </PopoverContent>
    </Popover>
  );
}
