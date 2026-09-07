import { cn } from '@/lib/utils';
import { DotMatrixText } from '@/components/dot-matrix/DotMatrixText';
import { Skeleton } from '@/components/ui/skeleton';
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
  /**
   * True until the first fetch returns. Without it the figure renders £0.00
   * and then snaps to the real value, which reads as the page being wrong
   * before it is slow.
   */
  loading?: boolean;
}

const TONE: Record<NonNullable<SurfaceHeroProps['tone']>, string> = {
  neutral: 'text-foreground',
  positive: 'text-positive',
  negative: 'text-destructive',
};

export function SurfaceHero({ label, value, tone = 'neutral', detail, aside, loading }: SurfaceHeroProps) {
  return (
    <section
      aria-label={label}
      className="flex flex-col gap-3 border-b border-border/40 pb-5 sm:flex-row sm:items-end sm:justify-between"
    >
      <div className="min-w-0 space-y-1">
        <DotMatrixText text={label.toUpperCase()} size="xs" />
        {loading ? (
          <>
            {/* Sized to the figure it replaces, so nothing shifts when the
                real number arrives. */}
            <Skeleton className="h-9 w-56 rounded-lg sm:h-10" />
            <Skeleton className="mt-2 h-3 w-72 max-w-full rounded" />
          </>
        ) : (
          <>
            <p className={cn('font-sans text-3xl font-bold tabular-nums sm:text-4xl', TONE[tone])}>
              {value}
            </p>
            {/* A div, not a p: detail is a ReactNode and callers put block
                content in it -- the net worth hero passes a chart -- which is
                invalid inside a paragraph and React warns about it. */}
            {detail ? (
              <div className="font-sans text-xs text-muted-foreground">{detail}</div>
            ) : null}
          </>
        )}
      </div>
      {loading ? (
        <Skeleton className="h-10 w-28 shrink-0 rounded-lg" />
      ) : aside ? (
        <div className="shrink-0 text-left sm:text-right">{aside}</div>
      ) : null}
    </section>
  );
}
