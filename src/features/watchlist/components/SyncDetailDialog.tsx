import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DotMatrixText } from '@/components/dot-matrix/DotMatrixText';
import { cn } from '@/lib/utils';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Layers,
  Search,
  Copy,
  Check,
  Calendar,
} from 'lucide-react';
import type { DisplaySyncLogEntry } from '@/features/watchlist/sync-logic';

interface SyncDetailDialogProps {
  entry: DisplaySyncLogEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatDuration(ms?: number): string {
  if (!ms || ms <= 0) return '0s';
  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds < 60) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) return `${minutes}m ${seconds}s`;
  const hours = Math.floor(minutes / 60);
  const remMinutes = minutes % 60;
  return `${hours}h ${remMinutes}m ${seconds}s`;
}

function parseFailedItems(errorMessage?: string | null): { count: number; titles: string[] } | null {
  if (!errorMessage) return null;
  const match = errorMessage.match(/^(\d+)\s*item\(s\)\s*failed:\s*(.+)$/i);
  if (!match) return null;
  const count = parseInt(match[1], 10);
  const titles = match[2]
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
  return { count, titles };
}

export function SyncDetailDialog({ entry, open, onOpenChange }: SyncDetailDialogProps) {
  const [filterQuery, setFilterQuery] = useState('');
  const [copied, setCopied] = useState(false);

  const parsedErrors = useMemo(() => {
    return parseFailedItems(entry?.error_message);
  }, [entry?.error_message]);

  const filteredTitles = useMemo(() => {
    if (!parsedErrors) return [];
    if (!filterQuery.trim()) return parsedErrors.titles;
    const q = filterQuery.toLowerCase();
    return parsedErrors.titles.filter((t) => t.toLowerCase().includes(q));
  }, [parsedErrors, filterQuery]);

  if (!entry) return null;

  const hasError = entry.status === 'error' || Boolean(entry.error_message);

  const handleCopy = async () => {
    if (!entry.error_message) return;
    await navigator.clipboard.writeText(entry.error_message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-0 overflow-hidden bg-card border-border flex flex-col max-h-[85vh]">
        {/* Header */}
        <DialogHeader className="p-4 border-b border-border/60 bg-secondary/20">
          <div className="flex items-center justify-between gap-2 pr-6">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'px-1.5 py-0.5 rounded text-xs font-semibold tracking-wide',
                  entry.is_missed || entry.status === 'error'
                    ? 'bg-destructive/20 text-destructive border border-destructive/30'
                    : entry.error_message
                      ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30'
                      : 'bg-secondary text-muted-foreground border border-border',
                )}
              >
                {entry.is_missed
                  ? 'MISSED'
                  : entry.sync_type === 'auto'
                    ? 'AUTO SYNC'
                    : entry.sync_type === 'daily'
                      ? 'DAILY SYNC'
                      : 'MANUAL SYNC'}
              </span>
              <DialogTitle className="text-sm font-semibold tracking-wide flex items-center gap-1.5">
                <DotMatrixText text="SYNC RUN DETAILS" size="xs" />
              </DialogTitle>
            </div>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {new Date(entry.synced_at).toLocaleString([], {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })}
            </span>
          </div>
          <DialogDescription className="sr-only">
            Detailed information about the selected watchlist synchronization run.
          </DialogDescription>
        </DialogHeader>

        {/* Content Body */}
        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          {/* Key Metrics Cards */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg border border-border/60 bg-secondary/30 p-2.5 flex flex-col justify-between">
              <span className="text-[11px] text-muted-foreground uppercase font-medium">Result</span>
              <div className="flex items-center gap-1.5 mt-1">
                {entry.is_missed || entry.status === 'error' ? (
                  <>
                    <XCircle className="h-4 w-4 text-destructive flex-shrink-0" />
                    <span className="text-xs font-semibold text-destructive">
                      {entry.is_missed ? 'Missed' : 'Failed'}
                    </span>
                  </>
                ) : entry.error_message ? (
                  <>
                    <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
                    <span className="text-xs font-semibold text-amber-500">Partial</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-xs font-semibold text-foreground">Success</span>
                  </>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-border/60 bg-secondary/30 p-2.5 flex flex-col justify-between">
              <span className="text-[11px] text-muted-foreground uppercase font-medium flex items-center gap-1">
                <Layers className="h-3 w-3" />
                Synced
              </span>
              <span className="text-xs font-semibold mt-1">
                {entry.is_missed ? '0 items' : `${(entry.items_synced || 0).toLocaleString()} items`}
              </span>
            </div>

            <div className="rounded-lg border border-border/60 bg-secondary/30 p-2.5 flex flex-col justify-between">
              <span className="text-[11px] text-muted-foreground uppercase font-medium flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Duration
              </span>
              <span className="text-xs font-semibold mt-1">
                {entry.is_missed ? '—' : formatDuration(entry.duration_ms)}
              </span>
            </div>
          </div>

          {/* Missed Cron Notice */}
          {entry.is_missed && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">No scheduled cron execution was recorded.</p>
                <p className="text-destructive/80 mt-0.5">
                  The scheduled 06:00 UTC daily background sync did not log a run for this calendar day.
                  This may occur if the database was restarting, migrating, or if outbound network requests were blocked.
                </p>
              </div>
            </div>
          )}

          {/* Parsed Failed Items Section */}
          {parsedErrors && parsedErrors.titles.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                  Failed Titles ({parsedErrors.titles.length})
                </span>
                {parsedErrors.titles.length > 6 && (
                  <div className="relative w-48">
                    <Search className="h-3 w-3 absolute left-2 top-2 text-muted-foreground" />
                    <Input
                      placeholder="Filter failed titles..."
                      value={filterQuery}
                      onChange={(e) => setFilterQuery(e.target.value)}
                      className="h-7 text-xs pl-7 py-1"
                    />
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-border/60 bg-secondary/20 p-2 max-h-48 overflow-y-auto">
                <div className="flex flex-wrap gap-1.5">
                  {filteredTitles.map((title, idx) => (
                    <span
                      key={`${title}-${idx}`}
                      className="px-2 py-0.5 rounded text-xs bg-destructive/10 text-destructive border border-destructive/20 font-medium"
                    >
                      {title}
                    </span>
                  ))}
                  {filteredTitles.length === 0 && (
                    <p className="text-xs text-muted-foreground p-2">No matching titles</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Raw Error Message Box (for non-title errors or for copyable diagnostics) */}
          {entry.error_message && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-muted-foreground uppercase">
                  {parsedErrors ? 'Raw Error Message' : 'Error Details'}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopy}
                  className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
                >
                  {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              </div>
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-2.5 max-h-32 overflow-y-auto">
                <pre className="text-xs font-mono text-destructive/90 whitespace-pre-wrap break-all leading-relaxed">
                  {entry.error_message}
                </pre>
              </div>
            </div>
          )}

          {!hasError && !entry.is_missed && (
            <div className="rounded-lg border border-border/60 bg-secondary/10 p-4 text-center">
              <CheckCircle className="h-8 w-8 text-muted-foreground/60 mx-auto mb-2" />
              <p className="text-xs font-semibold text-foreground">All items synchronized cleanly</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                No title timeouts, platform query errors, or network anomalies occurred during this run.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-border/60 bg-secondary/10 flex justify-end">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="h-8">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
