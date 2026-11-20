import { Fragment, useState } from 'react';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatRuntime } from '@/features/watchlist/watchlist-utils';
import { PersonFilmographyDialog } from '@/features/watchlist/components/PersonFilmographyDialog';
import type { WatchlistItem } from '@/features/watchlist/useWatchlist';

/**
 * Fragments the detail dialog renders twice -- once in its mobile layout and
 * once in its desktop one. They were copy-pasted, differing only in padding
 * and margin, so each was a place a fix could be applied to one half.
 */

/**
 * Neutral like the status pills in watchlist-utils, and for the same reason:
 * a green "Returning Series" next to a green "Watched" next to an amber
 * countdown read as three unrelated signals. Only a cancellation is coloured,
 * and it uses the theme's destructive token rather than a raw Tailwind red.
 */
const SERIES_STATUS_COLOURS: Record<string, string> = {
  'Returning Series': 'bg-secondary text-muted-foreground',
  'In Production':
    'bg-transparent text-muted-foreground ring-1 ring-inset ring-border',
  Ended: 'bg-secondary text-muted-foreground',
  // TMDB returns the US spelling; the British one is kept for rows stored
  // before that was noticed. Both layouts previously only matched
  // 'Cancelled', so a show TMDB had marked 'Canceled' rendered with no
  // colour at all.
  Canceled: 'bg-destructive/10 text-destructive',
  Cancelled: 'bg-destructive/10 text-destructive',
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

function ClickableNameList({
  names,
  onSelect,
  max = 3,
}: {
  names: string[];
  onSelect: (name: string) => void;
  max?: number;
}) {
  const shown = names.slice(0, max);
  const remaining = names.length - shown.length;

  return (
    <>
      {shown.map((name, index) => {
        const isLastShown = index === shown.length - 1;
        const separator =
          index === 0
            ? ''
            : isLastShown && remaining === 0
              ? ' and '
              : ', ';
        return (
          <Fragment key={name}>
            {separator}
            <button
              type="button"
              onClick={() => onSelect(name)}
              className="underline decoration-border underline-offset-4 hover:decoration-foreground transition-colors text-left"
            >
              {name}
            </button>
          </Fragment>
        );
      })}
      {remaining > 0 ? ` and ${remaining} more` : null}
    </>
  );
}

/** "Directed by" / "Created by" and "Starring" rows. Renders nothing when both lists are empty. */
export function CreditsList({
  kind,
  leads,
  cast,
  className,
}: {
  kind: 'movie' | 'tv';
  leads?: string[];
  cast?: string[];
  className?: string;
}) {
  const [selectedPerson, setSelectedPerson] = useState<string | null>(null);
  const hasLeads = !!leads?.length;
  const hasCast = !!cast?.length;
  if (!hasLeads && !hasCast) return null;
  return (
    <>
      <dl className={cn('grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm', className)}>
        {hasLeads && leads ? (
          <>
            <dt className="text-muted-foreground">{kind === 'tv' ? 'Created by' : 'Directed by'}</dt>
            <dd className="text-foreground">
              <ClickableNameList names={leads} onSelect={setSelectedPerson} />
            </dd>
          </>
        ) : null}
        {hasCast && cast ? (
          <>
            <dt className="text-muted-foreground">Starring</dt>
            <dd className="text-foreground">
              <ClickableNameList names={cast} onSelect={setSelectedPerson} />
            </dd>
          </>
        ) : null}
      </dl>
      <PersonFilmographyDialog
        name={selectedPerson}
        open={selectedPerson !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedPerson(null);
        }}
      />
    </>
  );
}
