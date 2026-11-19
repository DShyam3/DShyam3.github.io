import type { ReactNode } from 'react';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatScore, formatVoteCount } from '@/features/watchlist/tmdb-score';

function ImdbBadge() {
  return (
    <span
      aria-hidden="true"
      className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-bold leading-none tracking-tight text-black"
      style={{ backgroundColor: '#F5C518' }}
    >
      IMDb
    </span>
  );
}

function TomatoIcon({ fresh }: { fresh: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0">
      {fresh ? (
        <>
          <circle cx="8" cy="9" r="5.5" fill="#FA320A" />
          <path d="M8 3.5c-.4-1 .2-1.8 1-2.2M8 3.5c-1-.6-2.2-.3-2.8.4M8 3.5c1-.6 2.2-.3 2.8.4" stroke="#3B8E26" strokeWidth="1.5" strokeLinecap="round" fill="none" />
        </>
      ) : (
        <path
          d="M8 2.5c1.2 0 1.8 1.2 2.9 1.1 1.1-.1 2.2.8 1.9 2-.3 1.2.8 1.9 1.3 2.9.5 1-.3 2.3-1.5 2.3-1.1 0-1.4 1.3-2.4 1.9-1 .6-2-.4-2.8-.2-.8.2-1.6 1.2-2.6.6-1-.6-.8-1.9-1.9-2.2-1.1-.3-1.5-1.6-.8-2.6.7-1-.2-2 .1-3.1.3-1.1 1.6-1.4 2.6-1.1C6.8 3.8 6.8 2.5 8 2.5Z"
          fill="#6AC238"
        />
      )}
    </svg>
  );
}

function MetacriticBadge({ score }: { score: number }) {
  const bg = score >= 61 ? '#66CC33' : score >= 40 ? '#FFCC33' : '#B91C1C';
  const fg = score >= 40 ? '#111111' : '#FFFFFF';
  return (
    <span
      aria-hidden="true"
      className="inline-flex h-5 min-w-5 items-center justify-center rounded px-1 text-xs font-bold leading-none"
      style={{ backgroundColor: bg, color: fg }}
    >
      M
    </span>
  );
}

function TmdbBadge() {
  return (
    <span
      aria-hidden="true"
      className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-bold leading-none tracking-tight text-[#032541]"
      style={{ backgroundColor: '#01B4E4' }}
    >
      TMDB
    </span>
  );
}

/**
 * Compact score chips: the owner's own, then IMDb, Rotten Tomatoes, Metacritic
 * and TMDB. The external three come from OMDb (nightly sync), while TMDB comes
 * from the title's TMDB record.
 */
export function TitleScores({ mine, imdbRating, imdbVotes, rtScore, metascore, tmdbRating, tmdbVotes, className }: {
  /** The owner's own score, shown read-only (the admin edits it elsewhere). */
  mine?: number | null;
  imdbRating?: number;
  imdbVotes?: number;
  rtScore?: number;
  metascore?: number;
  tmdbRating?: number;
  tmdbVotes?: number;
  className?: string;
}) {
  const chip = 'inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-secondary/40 px-2 py-1 text-xs text-muted-foreground tabular-nums';
  const parts: ReactNode[] = [];
  if (mine != null) {
    parts.push(
      <span key="mine" className={chip}>
        <Star aria-hidden="true" className="h-3.5 w-3.5 fill-primary text-primary" />
        <span className="font-medium text-foreground">My score {formatScore(mine)}</span>
        <span className="sr-only"> out of 10</span>
      </span>,
    );
  }
  if (imdbRating != null) {
    parts.push(
      <span key="imdb" className={chip}>
        <ImdbBadge />
        <span className="font-medium text-foreground">{formatScore(imdbRating)}</span>
        {imdbVotes != null && <span>({formatVoteCount(imdbVotes)})</span>}
        <span className="sr-only"> IMDb out of 10</span>
      </span>,
    );
  }
  if (rtScore != null) {
    parts.push(
      <span key="rt" className={chip}>
        <TomatoIcon fresh={rtScore >= 60} />
        <span className="font-medium text-foreground">{rtScore}%</span>
        <span className="sr-only"> on Rotten Tomatoes</span>
      </span>,
    );
  }
  if (metascore != null) {
    parts.push(
      <span key="meta" className={chip}>
        <MetacriticBadge score={metascore} />
        <span className="font-medium text-foreground">{metascore}</span>
        <span className="sr-only"> Metacritic critics' score out of 100</span>
      </span>,
    );
  }
  if (tmdbRating != null && tmdbRating > 0) {
    parts.push(
      <span key="tmdb" className={chip}>
        <TmdbBadge />
        <span className="font-medium text-foreground">{formatScore(tmdbRating)}</span>
        {tmdbVotes != null && tmdbVotes > 0 && <span>({formatVoteCount(tmdbVotes)})</span>}
        <span className="sr-only"> TMDB out of 10</span>
      </span>,
    );
  }
  if (parts.length === 0) return null;
  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      {parts}
    </div>
  );
}
