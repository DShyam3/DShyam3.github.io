import { cn } from '@/lib/utils';

/**
 * Shared visual primitives for the Finance module. Centralizing these keeps
 * the gain/loss/accent palette consistent instead of scattering raw
 * Tailwind colors (emerald-500, rose-500, indigo-500, ...) across tabs.
 */

export function finLabelClass(className?: string) {
  return cn('fin-label', className);
}

interface DeltaPillProps {
  value: number;
  formatter: (value: number) => string;
  className?: string;
  /** Show a leading +/- sign in front of the formatted value. */
  showSign?: boolean;
  /** Treat 0 as positive (green) instead of neutral. Default true. */
  zeroIsPositive?: boolean;
}

/** Small rounded pill used for signed amounts/percentages (income vs spend, gains vs losses). */
export function DeltaPill({
  value,
  formatter,
  className,
  showSign = true,
  zeroIsPositive = true,
}: DeltaPillProps) {
  const isPositive = zeroIsPositive ? value >= 0 : value > 0;
  const sign = showSign ? (value > 0 ? '+' : value < 0 ? '' : isPositive ? '+' : '') : '';
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold font-mono',
        isPositive ? 'bg-fin-positive/10 text-fin-positive' : 'bg-fin-negative/10 text-fin-negative',
        className,
      )}
    >
      {sign}
      {formatter(value)}
    </span>
  );
}

interface FinMeterSegment {
  key: string;
  percent: number;
  tone: 'positive' | 'negative' | 'accent' | 'warn' | 'muted';
}

const toneToClass: Record<FinMeterSegment['tone'], string> = {
  positive: 'bg-fin-positive',
  negative: 'bg-fin-negative',
  accent: 'bg-fin-accent',
  warn: 'bg-fin-warn',
  muted: 'bg-muted-foreground/40',
};

interface FinMeterProps {
  segments: FinMeterSegment[];
  className?: string;
  trackClassName?: string;
}

/** Segmented horizontal progress bar, e.g. spent/bills/free breakdown or a single-tone budget meter. */
export function FinMeter({ segments, className, trackClassName }: FinMeterProps) {
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-muted/60 flex', trackClassName, className)}>
      {segments.map((seg) => (
        <div
          key={seg.key}
          className={cn('h-full transition-all duration-300', toneToClass[seg.tone])}
          style={{ width: `${Math.max(0, Math.min(100, seg.percent))}%` }}
        />
      ))}
    </div>
  );
}

/** The signature accent -> violet -> positive gradient bar, for the one or two hero meters per view. */
export function FinGradientMeter({ percent, className }: { percent: number; className?: string }) {
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-muted/60', className)}>
      <div
        className="fin-gradient-bar h-full rounded-full transition-all duration-500"
        style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
      />
    </div>
  );
}

interface SegmentedOption<T extends string> {
  key: T;
  label: string;
}

interface FinSegmentedControlProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

/** Small pill-style segmented control, e.g. This Month / Last 3M / YTD / All Time. */
export function FinSegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
}: FinSegmentedControlProps<T>) {
  return (
    <div className={cn('flex gap-0.5 rounded-full border border-border/50 bg-muted/30 p-0.5', className)}>
      {options.map((opt) => {
        const isActive = value === opt.key;
        return (
          <button
            key={opt.key}
            type="button"
            onClick={() => onChange(opt.key)}
            className={cn(
              'whitespace-nowrap rounded-full px-2.5 py-1 font-sans text-[10px] font-semibold transition-all',
              isActive
                ? 'bg-fin-accent text-white shadow-sm'
                : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground',
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export const Sparkline = ({ data }: { data: number[] }) => {
  if (data.length === 0) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const width = 100;
  const height = 30;

  const points = data.map((val, idx) => {
    const x = (idx / (data.length - 1)) * width;
    const y = height - ((val - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg className="w-24 h-8 text-primary overflow-visible" viewBox={`0 0 ${width} ${height}`}>
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
};
