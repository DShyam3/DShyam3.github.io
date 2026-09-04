import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatRuntime } from '@/features/watchlist/watchlist-utils';
import type { WatchlistItem } from '@/features/watchlist/useWatchlist';

/**
 * Fragments the detail dialog renders twice -- once in its mobile layout and
 * once in its desktop one. They were copy-pasted, differing only in padding
 * and margin, so each was a place a fix could be applied to one half.
 */

const SERIES_STATUS_COLOURS: Record<string, string> = {
  'Returning Series': 'bg-green-500/10 text-green-600 dark:text-green-400',
  'In Production': 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  Ended: 'bg-gray-500/10 text-gray-600 dark:text-gray-400',
  // TMDB returns the US spelling; the British one is kept for rows stored
  // before that was noticed. Both layouts previously only matched
  // 'Cancelled', so a show TMDB had marked 'Canceled' rendered with no
  // colour at all.
  Canceled: 'bg-red-500/10 text-red-600 dark:text-red-400',
  Cancelled: 'bg-red-500/10 text-red-600 dark:text-red-400',
};

export function SeriesStatusPill({
  status,
  className,
}: {
  status: NonNullable<WatchlistItem['series_status']>;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full text-xs font-medium',
        SERIES_STATUS_COLOURS[status],
        className,
      )}
    >
      {status}
    </span>
  );
}

export function RuntimeRow({
  runtime,
  className,
  iconClassName,
}: {
  runtime: number;
  className?: string;
  iconClassName?: string;
}) {
  return (
    <div className={cn('flex items-center gap-2 text-sm', className)}>
      <Clock className={cn('h-4 w-4', iconClassName)} />
      <span>{formatRuntime(runtime)}</span>
    </div>
  );
}

export function DetailDescription({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  return (
    <p className={cn('text-sm text-muted-foreground mt-4', className)}>{text}</p>
  );
}
