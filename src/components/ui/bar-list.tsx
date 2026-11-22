import * as React from 'react';
import { cn } from '@/lib/utils';

export interface BarListItem {
  key?: string;
  name: string;
  value: number;
  /** Optional formatted string shown on the right; defaults to locale number. */
  valueLabel?: string;
  /** Optional secondary caption beside the name (e.g. "24%"). */
  meta?: string;
  /** Optional CSS color token, e.g. `hsl(var(--chart-1))`. */
  color?: string;
  icon?: React.ReactNode;
}

export interface BarListProps {
  data: BarListItem[];
  /** Override max value for bar width scaling (defaults to largest item value). */
  maxValue?: number;
  valueFormatter?: (value: number) => string;
  onSelect?: (item: BarListItem) => void;
  activeKey?: string;
  emptyLabel?: string;
  className?: string;
}

/**
 * Horizontal proportional breakdown list (Tremor Raw `BarList` pattern),
 * skinned strictly in Sovereign Folio tokens with tabular Space Mono figures.
 */
export function BarList({
  data,
  maxValue,
  valueFormatter = (v) => v.toLocaleString('en-GB'),
  onSelect,
  activeKey,
  emptyLabel = 'No items yet.',
  className,
}: BarListProps) {
  if (!data.length) {
    return (
      <p className={cn('font-mono text-xs text-muted-foreground', className)}>
        {emptyLabel}
      </p>
    );
  }

  const ceiling =
    maxValue !== undefined && maxValue > 0
      ? maxValue
      : Math.max(...data.map((d) => Math.max(0, d.value)), 1);

  return (
    <div className={cn('space-y-2', className)} role="list">
      {data.map((item, idx) => {
        const key = item.key ?? `${item.name}-${idx}`;
        const pct = Math.max(0, Math.min(100, (Math.max(0, item.value) / ceiling) * 100));
        const fill = item.color ?? 'hsl(var(--primary))';
        const isActive = activeKey !== undefined && activeKey === key;
        const formatted = item.valueLabel ?? valueFormatter(item.value);

        const rowBody = (
          <div className="flex w-full items-center justify-between gap-3">
            <div className="relative min-w-0 flex-1 overflow-hidden rounded-sm bg-muted/35 px-2.5 py-1.5">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 left-0 rounded-sm transition-[width] duration-300"
                style={{
                  width: `${pct}%`,
                  backgroundColor: `color-mix(in srgb, ${fill} 20%, transparent)`,
                  borderRight: pct > 0 ? `2px solid ${fill}` : undefined,
                }}
              />
              <div className="relative flex items-center gap-2 min-w-0">
                {item.icon ? <span className="shrink-0">{item.icon}</span> : null}
                <span className="truncate font-mono text-xs font-medium text-foreground">
                  {item.name}
                </span>
                {item.meta ? (
                  <span className="shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
                    {item.meta}
                  </span>
                ) : null}
              </div>
            </div>
            <span className="shrink-0 font-mono text-xs font-semibold text-foreground tabular-nums">
              {formatted}
            </span>
          </div>
        );

        if (onSelect) {
          return (
            <button
              key={key}
              type="button"
              role="listitem"
              aria-pressed={isActive}
              onClick={() => onSelect(item)}
              className={cn(
                'block w-full rounded-sm text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                isActive && 'ring-1 ring-primary/60',
              )}
            >
              {rowBody}
            </button>
          );
        }

        return (
          <div key={key} role="listitem">
            {rowBody}
          </div>
        );
      })}
    </div>
  );
}

export interface CategoryBarSegment {
  label: string;
  value: number;
  /** CSS color token, e.g. `hsl(var(--chart-5))` or `hsl(var(--positive))`. */
  color: string;
}

export interface CategoryBarProps {
  segments: CategoryBarSegment[];
  /** Optional 0–100 marker position (e.g. target threshold or elapsed month %). */
  markerPercent?: number;
  markerLabel?: string;
  showLegend?: boolean;
  valueFormatter?: (value: number, pct: number) => string;
  ariaLabel?: string;
  className?: string;
}

/**
 * Segmented proportional allocation bar (Tremor Raw `CategoryBar` pattern)
 * for budget splits, income vs. bills vs. free cash, and breakdown strips.
 */
export function CategoryBar({
  segments,
  markerPercent,
  markerLabel,
  showLegend = true,
  valueFormatter,
  ariaLabel = 'Category breakdown',
  className,
}: CategoryBarProps) {
  const total = segments.reduce((sum, s) => sum + Math.max(0, s.value), 0);

  return (
    <div className={cn('space-y-2', className)}>
      <div
        role="img"
        aria-label={ariaLabel}
        className="relative flex h-2.5 w-full overflow-hidden rounded-full bg-muted/45"
      >
        {total > 0 &&
          segments.map((seg, idx) => {
            const pct = (Math.max(0, seg.value) / total) * 100;
            if (pct <= 0) return null;
            return (
              <div
                key={`${seg.label}-${idx}`}
                title={`${seg.label}: ${pct.toFixed(0)}%`}
                className="h-full transition-[width] duration-300 first:rounded-l-full last:rounded-r-full"
                style={{
                  width: `${pct}%`,
                  backgroundColor: seg.color,
                }}
              />
            );
          })}

        {markerPercent !== undefined && Number.isFinite(markerPercent) && (
          <div
            title={markerLabel}
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 w-0.5 bg-foreground/85"
            style={{ left: `${Math.max(0, Math.min(100, markerPercent))}%` }}
          />
        )}
      </div>

      {showLegend && segments.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs text-muted-foreground tabular-nums">
          {segments.map((seg, idx) => {
            const pct = total > 0 ? (Math.max(0, seg.value) / total) * 100 : 0;
            const detail = valueFormatter
              ? valueFormatter(seg.value, pct)
              : `${pct.toFixed(0)}%`;
            return (
              <span key={`${seg.label}-${idx}`} className="inline-flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: seg.color }}
                />
                <span>{seg.label}</span>
                <span className="font-semibold text-foreground">{detail}</span>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
