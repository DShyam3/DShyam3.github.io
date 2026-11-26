import { useId, useState, type ReactNode } from 'react';
import { Check, ChevronDown, Play } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Poster } from './EntryList';

export interface StripItem {
  key: string;
  title?: string;
  poster: string | null;
  mediaType: 'movie' | 'tv';
  watched: boolean;
  inProgress?: boolean;
}

const MAX_VISIBLE_STRIP = 10;

/**
 * One card for a saved order or a series from the library: category badge,
 * name, tabular progress fraction + meter, next-up callout, a poster strip
 * with a tick on what is watched, and a smooth disclosure body beneath.
 */
export function FranchiseCard({
  name,
  kindLabel,
  summary,
  watchedCount,
  totalCount,
  nextUp,
  nextUpYear,
  strip,
  open,
  onToggle,
  children,
}: {
  name: string;
  kindLabel?: string;
  summary: string;
  watchedCount?: number;
  totalCount?: number;
  nextUp?: string | null;
  nextUpYear?: string | null;
  strip: StripItem[];
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const bodyId = useId();
  const [hasOpened, setHasOpened] = useState(open);
  if (open && !hasOpened) {
    setHasOpened(true);
  }
  const hasCounts =
    typeof watchedCount === 'number' &&
    typeof totalCount === 'number' &&
    totalCount > 0;
  const pct = hasCounts
    ? Math.max(0, Math.min(100, Math.round((watchedCount / totalCount) * 100)))
    : 0;
  const isComplete = hasCounts && watchedCount >= totalCount;
  const isInProgress = hasCounts && watchedCount > 0 && watchedCount < totalCount;
  const visibleStrip = strip.slice(0, MAX_VISIBLE_STRIP);
  const overflowCount = Math.max(0, strip.length - visibleStrip.length);

  return (
    <Card
      className={cn(
        'surface-card min-w-0 overflow-hidden transition-colors',
        open && 'border-primary/45',
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={bodyId}
        className="t-press group flex w-full items-start justify-between gap-3 p-4 sm:p-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <span className="min-w-0 flex-1 space-y-3">
          <span className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex flex-wrap items-center gap-2">
              {kindLabel ? (
                <span className="inline-flex items-center rounded-sm border border-border/70 bg-muted/50 px-2 py-0.5 font-mono text-xs text-muted-foreground">
                  {kindLabel}
                </span>
              ) : null}
              {isComplete ? (
                <span className="inline-flex items-center gap-1 rounded-sm border border-positive/35 bg-positive/10 px-2 py-0.5 font-mono text-xs font-medium text-positive">
                  <Check className="h-3 w-3" aria-hidden="true" />
                  Complete
                </span>
              ) : isInProgress ? (
                <span className="inline-flex items-center rounded-sm border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-xs font-medium tabular-nums text-primary">
                  {pct}% watched
                </span>
              ) : null}
            </span>

            <span className="font-mono text-xs tabular-nums text-muted-foreground">
              {summary}
            </span>
          </span>

          <span className="block break-words text-base sm:text-lg font-semibold leading-snug tracking-tight text-foreground">
            {name}
          </span>

          {hasCounts ? (
            <span
              aria-hidden="true"
              className="block h-1.5 w-full overflow-hidden rounded-full bg-muted/70"
            >
              <span
                className={cn(
                  'block h-full rounded-full transition-[width] duration-200',
                  isComplete ? 'bg-positive' : 'bg-primary',
                )}
                style={{ width: `${pct}%` }}
              />
            </span>
          ) : null}

          {nextUp ? (
            <span className="inline-flex max-w-full items-center gap-2 rounded-sm border border-border/70 bg-background/70 px-2.5 py-1 text-xs text-foreground">
              <Play className="h-3 w-3 shrink-0 fill-primary text-primary" aria-hidden="true" />
              <span className="shrink-0 font-mono text-muted-foreground">Up next:</span>
              <span className="truncate font-medium">
                {nextUp}
                {nextUpYear ? ` (${nextUpYear})` : ''}
              </span>
            </span>
          ) : null}

          {visibleStrip.length > 0 ? (
            <span className="flex flex-wrap items-center gap-1.5 pt-0.5" aria-hidden="true">
              {visibleStrip.map((item) => (
                <span
                  key={item.key}
                  title={item.title}
                  className={cn(
                    'relative shrink-0 overflow-hidden rounded-sm border transition-opacity',
                    item.watched
                      ? 'border-primary/40 opacity-100'
                      : item.inProgress
                        ? 'border-primary opacity-100'
                        : 'border-border/60 opacity-75 group-hover:opacity-95',
                  )}
                >
                  <Poster src={item.poster} mediaType={item.mediaType} className="w-9 sm:w-10" />
                  {item.watched ? (
                    <span className="absolute bottom-0.5 right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
                      <Check className="h-2.5 w-2.5" />
                    </span>
                  ) : null}
                </span>
              ))}
              {overflowCount > 0 ? (
                <span className="flex aspect-[2/3] w-9 sm:w-10 shrink-0 items-center justify-center rounded-sm border border-dashed border-border bg-muted/40 font-mono text-xs font-medium tabular-nums text-muted-foreground">
                  +{overflowCount}
                </span>
              ) : null}
            </span>
          ) : null}
        </span>

        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border/60 bg-background/60 text-muted-foreground transition-colors group-hover:border-border group-hover:text-foreground">
          <ChevronDown
            data-open={open}
            className="t-chevron-flip h-4 w-4 shrink-0"
            aria-hidden="true"
          />
        </span>
      </button>

      <div
        id={bodyId}
        data-open={open}
        aria-hidden={!open}
        ref={(node) => { if (node) node.toggleAttribute('inert', !open); }}
        className={cn(
          't-disclosure-body bg-background/30',
          open && 'border-t border-border/50',
        )}
      >
        <div className="t-disclosure-inner">
          {hasOpened ? (
            <div className="space-y-3 px-4 pb-4 pt-3 sm:px-5 sm:pb-5">
              {children}
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
