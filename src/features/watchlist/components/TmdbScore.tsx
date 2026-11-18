import { cn } from '@/lib/utils';
import { formatScore, formatVoteCount, scoreLine } from '@/features/watchlist/tmdb-score';

/**
 * TMDB's users' average beside the owner's own score. TMDB is the only
 * average with an open API: Rotten Tomatoes and Metacritic publish none.
 * A title the nightly sync has not reached yet has no stored votes, and
 * says nothing rather than "no votes". Seasons have an average but no
 * count, so `votes` is null for them.
 */
export function TmdbScore({ average, votes, className }: {
  average?: number;
  votes?: number | null;
  className?: string;
}) {
  const line = scoreLine(null, average, votes);
  if (line.tmdb === null) {
    if (votes !== 0) return null;
    return <p className={cn('text-xs text-muted-foreground', className)}>TMDB: no votes yet</p>;
  }
  return (
    <p className={cn('text-xs text-muted-foreground', className)}>
      <span className="font-medium text-foreground">TMDB {formatScore(line.tmdb)}</span>
      {line.votes !== null ? ` (${formatVoteCount(line.votes)} votes)` : ''}
      {line.fewVotes ? ' · few votes' : ''}
      <span className="sr-only"> out of 10, the average of TMDB users' scores</span>
    </p>
  );
}
