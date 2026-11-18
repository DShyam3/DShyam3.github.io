import { cn } from '@/lib/utils';
import { formatScore, formatVoteCount, scoreLine } from '@/features/watchlist/tmdb-score';

/**
 * TMDB's users' average beside the owner's own score. TMDB is the only
 * average with an open API: Rotten Tomatoes and Metacritic publish none.
 * A title the nightly sync has not reached yet has no stored votes, and
 * says nothing rather than "no votes". Seasons have an average but no
 * count, so `votes` is null for them.
 */
export function TmdbScore({ average, votes, mine, className }: {
  average?: number;
  votes?: number | null;
  /** The owner's own score, shown read-only (the admin edits it elsewhere). */
  mine?: number | null;
  className?: string;
}) {
  const line = scoreLine(mine ?? null, average, votes);
  const own = line.mine !== null ? (
    <>
      <span className="font-medium text-foreground">My score {formatScore(line.mine)}</span>
      <span className="sr-only"> out of 10</span>
    </>
  ) : null;
  if (line.tmdb === null) {
    if (votes !== 0) return own ? <p className={cn('text-xs text-muted-foreground', className)}>{own}</p> : null;
    return <p className={cn('text-xs text-muted-foreground', className)}>{own}{own ? ' · ' : ''}TMDB: no votes yet</p>;
  }
  return (
    <p className={cn('text-xs text-muted-foreground', className)}>
      {own}{own ? ' · ' : ''}
      <span className="font-medium text-foreground">TMDB {formatScore(line.tmdb)}</span>
      {line.votes !== null ? ` (${formatVoteCount(line.votes)} votes)` : ''}
      {line.fewVotes ? ' · few votes' : ''}
      <span className="sr-only"> out of 10, the average of TMDB users' scores</span>
    </p>
  );
}
