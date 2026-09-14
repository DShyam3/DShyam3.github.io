import { useState } from 'react';
import { formatDate } from '@/lib/format-date';
import { cn } from '@/lib/utils';

interface CountdownCardProps {
  /** The title shown top-right -- a show, a trip, a warranty, a goal. */
  label: string;
  /** The date counted down to, in any `formatDate`-parseable form. */
  date: string;
  /**
   * Whole days from now to `date`, already computed by the caller (e.g.
   * `daysUntil` in `watchlist-utils.ts`). This component does no date maths
   * of its own, which is what keeps it usable for any surface's countdown --
   * see REHAUL_PLAN.md 8.D.
   */
  days: number;
  /** A full sentence for assistive tech, e.g. "13 days until The Super Mario Bros. Movie". */
  srLabel: string;
  href?: string;
  image?: string | null;
  imageAlt: string;
  className?: string;
  /** `compact` shrinks the card and its type for a denser rail; the day
   *  count stays the largest thing on it either way. */
  size?: 'default' | 'compact';
}

/**
 * A landscape image card with a title and date overlaid top-right, and a
 * large day-count numeral with its unit beneath, bottom-left, over a dark
 * scrim for legibility. Generic on purpose -- REHAUL_PLAN.md 8.D names a show
 * release, a trip departure, a warranty expiry and a goal date as its
 * consumers, so nothing here may name a watchlist concept.
 */
export function CountdownCard({
  label,
  date,
  days,
  srLabel,
  href,
  image,
  imageAlt,
  className,
  size = 'default',
}: CountdownCardProps) {
  const unit = days === 1 ? 'day' : 'days';
  const [broken, setBroken] = useState(false);
  const showFallback = !image || broken;
  const compact = size === 'compact';

  const content = (
    <>
      {showFallback ? (
        <div
          className={cn(
            'missing-art absolute inset-0 flex items-center justify-center text-center',
            compact ? 'p-2' : 'p-3',
          )}
        >
          <span
            className={cn(
              'line-clamp-3 font-serif font-medium leading-tight',
              compact ? 'text-sm' : 'text-lg',
            )}
          >
            {imageAlt}
          </span>
        </div>
      ) : (
        <img
          src={image ?? undefined}
          alt={imageAlt}
          loading="lazy"
          onError={() => setBroken(true)}
          className="absolute inset-0 h-full w-full object-cover object-top"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent" />
      <div
        className={cn(
          // A local scrim of its own, not just the card-wide gradient below --
          // title art sitting under this corner (e.g. "Slow Horses",
          // "Forgotten Island") otherwise fights the text for contrast.
          'absolute max-w-[70%] rounded-md bg-black/55 text-right text-white',
          compact ? 'right-2 top-2 px-1.5 py-1' : 'right-3 top-3 px-2 py-1',
        )}
      >
        <p
          className={cn(
            'line-clamp-2 font-medium leading-tight drop-shadow',
            compact ? 'text-xs' : 'text-sm',
          )}
        >
          {label}
        </p>
        <p className={cn('mt-0.5 text-white/80', compact ? 'text-[10px]' : 'text-xs')}>
          {formatDate(date)}
        </p>
      </div>
      <div
        className={cn('absolute leading-none text-white', compact ? 'bottom-2 left-2' : 'bottom-3 left-3')}
      >
        <span className="sr-only">{srLabel}</span>
        <div aria-hidden="true">
          <span className={cn('font-sans font-bold tabular-nums', compact ? 'text-2xl' : 'text-4xl')}>
            {days}
          </span>
          <span
            className={cn(
              'ml-1.5 uppercase tracking-wider text-white/80',
              compact ? 'text-[10px]' : 'text-xs',
            )}
          >
            {unit}
          </span>
        </div>
      </div>
    </>
  );

  const cardClassName = cn(
    'item-card relative block aspect-[16/10] shrink-0 overflow-hidden',
    compact ? 'w-40' : 'w-64',
    className,
  );

  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cardClassName}>
        {content}
      </a>
    );
  }

  return <div className={cardClassName}>{content}</div>;
}
