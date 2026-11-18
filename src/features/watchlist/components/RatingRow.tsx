import { useRef, type KeyboardEvent } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatScore, formatVoteCount, scoreLine } from '@/features/watchlist/tmdb-score';

interface RatingRowProps {
  mine?: number;
  tmdbAverage?: number;
  /** Null for a season: TMDB gives no vote count per season. */
  tmdbVotes?: number | null;
  /** Names the score, e.g. "Your score" or "Season 2". */
  label: string;
  editable: boolean;
  onChange?: (rating: number | null) => void;
  className?: string;
}

const SCORES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export function RatingRow({
  mine,
  tmdbAverage,
  tmdbVotes,
  label,
  editable,
  onChange,
  className,
}: RatingRowProps) {
  const line = scoreLine(mine, tmdbAverage, tmdbVotes);

  // Unsynced titles have null votes until the nightly sync backfills them, so
  // only an explicit zero count means "no votes yet".
  let tmdbText: string | null = null;
  if (line.tmdb !== null) {
    tmdbText =
      line.votes !== null
        ? `TMDB ${formatScore(line.tmdb)} (${formatVoteCount(line.votes)} votes)`
        : `TMDB ${formatScore(line.tmdb)}`;
  } else if (tmdbVotes === 0) {
    tmdbText = 'TMDB: no votes yet';
  }
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const move = (index: number) => {
    const next = (index + SCORES.length) % SCORES.length;
    refs.current[next]?.focus();
    onChange?.(SCORES[next]);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        move(index + 1);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        move(index - 1);
        break;
      case 'Home':
        move(0);
        break;
      case 'End':
        move(SCORES.length - 1);
        break;
      default:
        return;
    }
    event.preventDefault();
  };
  const mineText = line.mine !== null ? `You ${line.mine}` : editable ? 'Not rated' : null;

  return (
    <div className={cn('space-y-1.5', className)}>
      {mineText || tmdbText ? (
        <p className="text-xs text-muted-foreground">
          {mineText ? (
            <span className="text-foreground">
              {mineText}
              {tmdbText ? ' · ' : ''}
            </span>
          ) : null}
          {tmdbText}
          {tmdbText && line.fewVotes ? <span> · few votes</span> : null}
        </p>
      ) : null}

      {editable ? (
        <div className="flex flex-wrap items-center gap-1">
          <div
            role="radiogroup"
            aria-label={`${label}: your score out of 10`}
            className="grid grid-cols-[repeat(5,2.75rem)] gap-1"
          >
            {SCORES.map((score, index) => {
              const selected = line.mine === score;
              const tabbable = line.mine !== null ? selected : index === 0;
              return (
                <button
                  key={score}
                  ref={(el) => {
                    refs.current[index] = el;
                  }}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  tabIndex={tabbable ? 0 : -1}
                  onClick={() => {
                    if (!selected) onChange?.(score);
                  }}
                  onKeyDown={(event) => onKeyDown(event, index)}
                  className={cn(
                    'min-h-11 rounded-md border border-border text-xs font-medium transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                    selected
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'bg-background text-foreground/75 hover:bg-muted hover:text-foreground',
                  )}
                >
                  {score}
                </button>
              );
            })}
          </div>
          {line.mine !== null ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onChange?.(null)}
              className="min-h-10 px-2 text-xs text-muted-foreground"
            >
              Clear
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
