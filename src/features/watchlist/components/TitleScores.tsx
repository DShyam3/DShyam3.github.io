import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { formatScore, formatVoteCount } from '@/features/watchlist/tmdb-score';

/**
 * One muted line of scores: the owner's own, then IMDb, Rotten Tomatoes and
 * Metacritic. The external three come from OMDb, an unofficial aggregator, so
 * RT and Metacritic are often missing for TV and for older or foreign films.
 * Values fill in from the nightly sync; a title it has not reached yet says
 * nothing rather than "no votes".
 */
export function TitleScores({ mine, imdbRating, imdbVotes, rtScore, metascore, className }: {
  /** The owner's own score, shown read-only (the admin edits it elsewhere). */
  mine?: number | null;
  imdbRating?: number;
  imdbVotes?: number;
  rtScore?: number;
  metascore?: number;
  className?: string;
}) {
  const parts: ReactNode[] = [];
  if (mine != null) {
    parts.push(
      <span key="mine">
        <span className="font-medium text-foreground">My score {formatScore(mine)}</span>
        <span className="sr-only"> out of 10</span>
      </span>,
    );
  }
  if (imdbRating != null) {
    parts.push(
      <span key="imdb">
        <span className="font-medium text-foreground">IMDb {formatScore(imdbRating)}</span>
        {imdbVotes != null ? ` (${formatVoteCount(imdbVotes)})` : ''}
        <span className="sr-only"> out of 10, IMDb users' weighted rating</span>
      </span>,
    );
  }
  if (rtScore != null) {
    parts.push(
      <span key="rt">
        <span className="font-medium text-foreground">RT {rtScore}%</span>
        <span className="sr-only"> of critics' reviews positive on Rotten Tomatoes</span>
      </span>,
    );
  }
  if (metascore != null) {
    parts.push(
      <span key="meta">
        <span className="font-medium text-foreground">Metacritic {metascore}</span>
        <span className="sr-only"> Metacritic critics' score out of 100</span>
      </span>,
    );
  }
  if (parts.length === 0) return null;
  return (
    <p className={cn('text-xs text-muted-foreground', className)}>
      {parts.flatMap((part, i) => (i === 0 ? [part] : [' · ', part]))}
    </p>
  );
}
