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

  let tmdbText: string;
  if (line.tmdb === null) {
    tmdbText = 'TMDB: no votes yet';
  } else if (line.votes !== null) {
    tmdbText = `TMDB ${formatScore(line.tmdb)} (${formatVoteCount(line.votes)} votes)`;
  } else {
    tmdbText = `TMDB ${formatScore(line.tmdb)}`;
  }
  const mineText = line.mine !== null ? `You ${line.mine}` : editable ? 'Not rated' : null;

  return (
    <div className={cn('space-y-1.5', className)}>
      <p className="text-xs text-muted-foreground">
        {mineText ? <span className="text-foreground">{mineText} · </span> : null}
        {tmdbText}
        {line.fewVotes ? <span> · few votes</span> : null}
      </p>

      {editable ? (
        <div className="flex flex-wrap items-center gap-1">
          <div
            role="radiogroup"
            aria-label={`${label}: your score out of 10`}
            className="flex flex-wrap gap-0.5"
          >
            {SCORES.map((score) => {
              const selected = line.mine === score;
              return (
                <button
                  key={score}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => onChange?.(selected ? null : score)}
                  className={cn(
                    'min-h-10 w-7 rounded-md border border-border text-xs font-medium transition-colors',
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
