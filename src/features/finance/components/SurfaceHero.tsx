import { cn } from '@/lib/utils';
import { DotMatrixText } from '@/components/dot-matrix/DotMatrixText';
import type { ReactNode } from 'react';

/**
 * The one number a surface exists to answer, above whatever it renders.
 *
 * Copilot and Treasury both open on a single figure with its evidence beneath,
 * rather than on a title and a table (REHAUL_PLAN.md 7.C). This is that, using
 * the site's own faces: Doto for the label, Space Mono for the figure, which is
 * monospace and so keeps digits aligned as the value changes.
 *
 * `tone` is deliberately not derived from the sign of the number. A negative
 * net worth is bad, a negative spend is good, and only the caller knows which.
 */
export interface SurfaceHeroProps {
  label: string;
  value: string;
  tone?: 'neutral' | 'positive' | 'negative';
  /** The evidence line: what the figure is made of, or what it is measured against. */
  detail?: ReactNode;
  /** Right-hand slot for a secondary figure that earns equal billing. */
  aside?: ReactNode;
}

const TONE: Record<NonNullable<SurfaceHeroProps['tone']>, string> = {
  neutral: 'text-foreground',
  positive: 'text-positive',
  negative: 'text-destructive',
};

export function SurfaceHero({ label, value, tone = 'neutral', detail, aside }: SurfaceHeroProps) {
  return (
    <section
      aria-label={label}
      className="flex flex-col gap-3 border-b border-border/40 pb-5 sm:flex-row sm:items-end sm:justify-between"
    >
      <div className="min-w-0 space-y-1">
        <DotMatrixText text={label.toUpperCase()} size="xs" />
        <p className={cn('font-sans text-3xl font-bold tabular-nums sm:text-4xl', TONE[tone])}>
          {value}
        </p>
        {detail ? (
          <p className="font-sans text-xs text-muted-foreground">{detail}</p>
        ) : null}
      </div>
      {aside ? <div className="shrink-0 text-left sm:text-right">{aside}</div> : null}
    </section>
  );
}
