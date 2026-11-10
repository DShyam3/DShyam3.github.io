import { Link } from 'react-router-dom';
import { Hourglass } from 'lucide-react';
import { HOURS_IN_YEAR } from '@/lib/year-hours';

export const YEAR_IN_HOURS_PATH = '/thoughts/year-in-hours';

/**
 * The card for the one thought that is a page rather than a stored row. It
 * wears the same face as the cards beside it so the wall keeps its rhythm.
 */
export function YearInHoursCard() {
  return (
    <Link
      to={YEAR_IN_HOURS_PATH}
      className="item-card group relative h-full flex flex-col overflow-hidden"
    >
      <div
        className="missing-art relative overflow-hidden shrink-0 flex flex-col items-center justify-center gap-2 p-6 text-center"
        // Set by the collection page on the grid, so this box matches its neighbours'.
        style={{ aspectRatio: 'var(--card-aspect)' }}
      >
        <Hourglass className="h-9 w-9 text-primary" aria-hidden="true" />
        <span className="text-sm font-medium tabular-nums">
          {HOURS_IN_YEAR.toLocaleString('en-GB')} hours
        </span>
        <div className="absolute top-2 left-2 pointer-events-none">
          <span className="block text-xs font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-background/80 text-muted-foreground backdrop-blur-sm shadow-sm border border-border/40">
            Interactive
          </span>
        </div>
      </div>
      <div className="card-body p-3 flex flex-col gap-1 flex-1">
        <h3 className="card-title text-sm font-medium line-clamp-2 min-h-[2.5rem] group-hover:text-primary transition-colors">
          A year in hours
        </h3>
        <div className="card-meta flex items-baseline justify-between gap-2 min-h-[1rem]">
          <p className="text-xs text-muted-foreground line-clamp-1 min-w-0">Try it yourself</p>
        </div>
        <p className="card-sub text-xs text-muted-foreground/80 line-clamp-2 min-h-[2rem]">
          Where a year goes once sleep, work and the commute have taken theirs. Move the sliders.
        </p>
      </div>
    </Link>
  );
}
