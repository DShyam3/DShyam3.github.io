import * as React from 'react';
import { cn } from '@/lib/utils';

export type TrackerTone = 'ok' | 'warn' | 'error' | 'muted';

export interface TrackerCell {
  key?: string;
  tone: TrackerTone;
  label: string;
}

export interface TrackerProps {
  data: TrackerCell[];
  ariaLabel?: string;
  className?: string;
}

const CELL_TONE: Record<TrackerTone, string> = {
  ok: 'bg-positive',
  warn: 'bg-warning',
  error: 'bg-destructive',
  muted: 'bg-muted-foreground/25',
};

/**
 * Segmented status / activity strip (Tremor Raw `Tracker` pattern)
 * for `/dev` service uptime history, Finance sync runs, and Watchlist streaks.
 */
export function Tracker({
  data,
  ariaLabel = 'Status history',
  className,
}: TrackerProps) {
  return (
    <div
      role="list"
      aria-label={ariaLabel}
      className={cn('flex h-6 w-full items-center gap-1', className)}
    >
      {data.map((cell, idx) => (
        <div
          key={cell.key ?? `${cell.label}-${idx}`}
          role="listitem"
          title={cell.label}
          aria-label={cell.label}
          className={cn(
            'h-full flex-1 rounded-sm transition-opacity duration-150 first:rounded-l-md last:rounded-r-md hover:opacity-85',
            CELL_TONE[cell.tone],
          )}
        />
      ))}
    </div>
  );
}
