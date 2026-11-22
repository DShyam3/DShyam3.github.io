import * as React from 'react';
import type { Format } from '@number-flow/react';
import { AnimatedNumber } from '@/components/ui/animated-number';
import { cn } from '@/lib/utils';

export type MetricTileTone = 'neutral' | 'positive' | 'negative' | 'warning';

export interface MetricTileDelta {
  label: string;
  tone?: 'positive' | 'negative' | 'neutral';
}

export interface MetricTileProps {
  /** Short sentence-case label; rendered as the single 12px uppercase mono eyebrow. */
  label: string;
  /** Numeric value (rendered via NumberFlow) or pre-formatted string/node (e.g. masked). */
  value: number | React.ReactNode;
  /** Optional NumberFlow Intl format when `value` is a number. */
  format?: Format;
  prefix?: string;
  suffix?: string;
  tone?: MetricTileTone;
  /** `default` uses `surface-card`; `gradient` uses the Sovereign Folio halftone tile. */
  variant?: 'default' | 'gradient';
  /** Optional section palette for `gradient` or tinted accent cards. */
  palette?: string;
  delta?: MetricTileDelta;
  detail?: React.ReactNode;
  icon?: React.ReactNode;
  aside?: React.ReactNode;
  /** Optional compact series for an inline SVG sparkline (no external chart overhead). */
  sparkline?: number[];
  loading?: boolean;
  onClick?: () => void;
  className?: string;
}

const VALUE_TONE: Record<MetricTileTone, string> = {
  neutral: 'text-foreground',
  positive: 'text-positive',
  negative: 'text-destructive',
  warning: 'text-warning',
};

const DELTA_TONE: Record<NonNullable<MetricTileDelta['tone']>, string> = {
  positive: 'border-positive/30 bg-positive/10 text-positive',
  negative: 'border-destructive/30 bg-destructive/10 text-destructive',
  neutral: 'border-border/70 bg-muted/50 text-muted-foreground',
};

function InlineSparkline({
  values,
  tone,
}: {
  values: number[];
  tone: MetricTileTone;
}) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const width = 88;
  const height = 26;
  const pad = 2;

  const points = values
    .map((v, i) => {
      const x = pad + (i / (values.length - 1)) * (width - pad * 2);
      const y = height - pad - ((v - min) / span) * (height - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const strokeClass =
    tone === 'positive'
      ? 'stroke-positive'
      : tone === 'negative'
        ? 'stroke-destructive'
        : tone === 'warning'
          ? 'stroke-warning'
          : 'stroke-primary';

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      className="shrink-0 overflow-visible"
    >
      <polyline
        fill="none"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
        className={strokeClass}
      />
    </svg>
  );
}

/**
 * Unified KPI / metric tile shared across Finance, Watchlist Diary, Travel, and Home.
 *
 * Follows `DESIGN_SYSTEM.md`:
 * - Single 12px uppercase mono label (`tracking-[0.08em]`)
 * - Tabular numerals with value-driven `AnimatedNumber` (`NumberFlow`)
 * - Zero hardcoded hex; strictly semantic & Sovereign Folio surface tokens
 */
export function MetricTile({
  label,
  value,
  format,
  prefix,
  suffix,
  tone = 'neutral',
  variant = 'default',
  palette,
  delta,
  detail,
  icon,
  aside,
  sparkline,
  loading = false,
  onClick,
  className,
}: MetricTileProps) {
  const isGradient = variant === 'gradient';
  const baseClass = cn(
    isGradient
      ? 'ambient-card gradient-metric-tile'
      : 'surface-card',
    'flex flex-col justify-between gap-3 border p-4 sm:p-5 text-left',
    onClick &&
      'cursor-pointer transition-colors hover:border-primary/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    className,
  );

  const content = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="font-mono text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
          {label}
        </p>
        {icon ? <span className="shrink-0 text-muted-foreground">{icon}</span> : null}
      </div>

      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div
            className={cn(
              'font-mono text-2xl sm:text-3xl font-semibold leading-none tracking-tight tabular-nums',
              VALUE_TONE[tone],
            )}
          >
            {loading ? (
              <span className="text-muted-foreground">—</span>
            ) : typeof value === 'number' ? (
              <AnimatedNumber
                value={value}
                format={format}
                prefix={prefix}
                suffix={suffix}
              />
            ) : (
              value
            )}
          </div>

          {delta ? (
            <span
              className={cn(
                'inline-flex items-center rounded-sm border px-1.5 py-0.5 font-mono text-xs font-medium tabular-nums',
                DELTA_TONE[delta.tone ?? 'neutral'],
              )}
            >
              {delta.label}
            </span>
          ) : null}
        </div>

        {aside ? (
          <div className="shrink-0">{aside}</div>
        ) : sparkline && sparkline.length >= 2 ? (
          <InlineSparkline values={sparkline} tone={tone} />
        ) : null}
      </div>

      {detail ? (
        <div className="text-xs leading-relaxed text-muted-foreground">{detail}</div>
      ) : null}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        data-palette={palette}
        className={baseClass}
      >
        {content}
      </button>
    );
  }

  return (
    <div data-palette={palette} className={baseClass}>
      {content}
    </div>
  );
}
