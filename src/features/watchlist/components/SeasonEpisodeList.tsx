import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, CheckCircle2, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Season } from '@/features/watchlist/useWatchlist';
interface SeasonEpisodeListProps {
  seasons: Season[];
  showId: string;
  toggleEpisodeWatched?: (
    showId: string,
    seasonNumber: number,
    episodeNumber: number,
  ) => void;
  toggleSeasonWatched?: (showId: string, seasonNumber: number) => void;
  isEpisodeWatched: (
    showId: string,
    seasonNumber: number,
    episodeNumber: number,
  ) => boolean;
  isSeasonWatched: (showId: string, season: Season) => boolean;
}

export function SeasonEpisodeList({
  seasons,
  showId,
  toggleEpisodeWatched,
  toggleSeasonWatched,
  isEpisodeWatched,
  isSeasonWatched,
}: SeasonEpisodeListProps) {
  const initialSeason = useMemo(() => {
    const regularSeasons = seasons.filter((season) => season.season_number > 0);
    const candidates = regularSeasons.length ? regularSeasons : seasons;
    const firstUnwatched = candidates.find((season) => !isSeasonWatched(showId, season));
    return firstUnwatched?.season_number ?? candidates[candidates.length - 1]?.season_number;
  }, [seasons, showId, isSeasonWatched]);

  const [selectedSeason, setSelectedSeason] = useState(initialSeason);
  const currentSeason = seasons.find((s) => s.season_number === selectedSeason);

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'TBA';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatRuntime = (minutes?: number) => {
    if (!minutes) return '';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const getWatchedCount = (season: Season) => {
    return season.episodes.filter((ep) =>
      isEpisodeWatched(showId, season.season_number, ep.episode_number),
    ).length;
  };

  const seasonFullyWatched = currentSeason ? isSeasonWatched(showId, currentSeason) : false;
  const currentWatchedCount = currentSeason ? getWatchedCount(currentSeason) : 0;

  return (
    // The season picker and its season-level controls stay put; only the
    // episode list below them scrolls.
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 space-y-2 pb-2">
        <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground" data-season-heading>
          Seasons &amp; Episodes
        </h4>

        <div className="flex gap-1.5 flex-wrap">
          {seasons.map((season) => {
            const seasonWatched = isSeasonWatched(showId, season);
            const watchedCount = getWatchedCount(season);

            return (
              <Button
                key={season.season_number}
                variant={
                  selectedSeason === season.season_number ? 'default' : 'outline'
                }
                size="sm"
                aria-pressed={selectedSeason === season.season_number}
                onClick={() => setSelectedSeason(season.season_number)}
                className="min-h-9 px-2.5 text-xs relative"
              >
                {season.season_number === 0 ? 'Specials' : `Season ${season.season_number}`}
                {seasonWatched && <span className="ml-1.5 text-xs">✓</span>}
                {!seasonWatched && watchedCount > 0 && (
                  <span className="ml-1.5 text-xs opacity-60">
                    {watchedCount}/{season.episodes.length}
                  </span>
                )}
              </Button>
            );
          })}
        </div>

        {currentSeason && (
          <>
            <div className="flex items-center gap-2 text-xs text-muted-foreground pb-1.5 border-b">
              <Calendar className="h-3.5 w-3.5" />
              <span>Released: {formatDate(currentSeason.release_date)}</span>
              <span className="ml-auto">
                {currentSeason.episodes.length} episodes
              </span>
            </div>

            {/* Mark Season Complete button */}
            {toggleSeasonWatched && currentSeason.episodes.length > 0 && (
              <Button
                variant={seasonFullyWatched ? 'outline' : 'default'}
                size="sm"
                onClick={() =>
                  toggleSeasonWatched(showId, currentSeason.season_number)
                }
                className={cn(
                  'w-full gap-2 text-xs transition-[color,background-color,border-color] whitespace-normal h-auto py-1.5',
                  seasonFullyWatched
                    ? 'text-muted-foreground hover:bg-secondary'
                    : '',
                )}
              >
                {seasonFullyWatched ? (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                    <span>Season Complete — Mark as Unwatched</span>
                  </>
                ) : (
                  <>
                    <Circle className="h-3.5 w-3.5 shrink-0" />
                    <span>
                      Mark {currentSeason.season_number === 0 ? 'Specials' : `Season ${currentSeason.season_number}`} as Complete
                      {currentWatchedCount > 0 && (
                        <span className="opacity-60 ml-1">
                          ({currentWatchedCount}/{currentSeason.episodes.length}{' '}
                          watched)
                        </span>
                      )}
                    </span>
                  </>
                )}
              </Button>
            )}
          </>
        )}
      </div>

      {currentSeason && (
        <div
          data-episode-scroll
          className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pt-1"
        >
          {currentSeason.episodes.map((episode) => {
            const watched = isEpisodeWatched(
              showId,
              currentSeason.season_number,
              episode.episode_number,
            );
            const released = !episode.release_date || new Date(`${episode.release_date}T23:59:59`).getTime() <= Date.now();
            const previousEpisodes = currentSeason.episodes.filter(
              (candidate) => candidate.episode_number < episode.episode_number,
            );
            const nextUp = released && !watched && previousEpisodes.every((candidate) =>
              isEpisodeWatched(showId, currentSeason.season_number, candidate.episode_number),
            );

            return (
              <div
                key={episode.episode_number}
                onClick={() =>
                  released &&
                  toggleEpisodeWatched &&
                  toggleEpisodeWatched(
                    showId,
                    currentSeason.season_number,
                    episode.episode_number,
                  )
                }
                className={cn(
                  'px-3 py-2 rounded-lg transition-[background-color,opacity,border-color] duration-200 border-l-4',
                  toggleEpisodeWatched
                    ? 'cursor-pointer'
                    : 'cursor-default',
                  !watched && 'bg-secondary/30 border-l-transparent',
                  !released && 'opacity-45 cursor-not-allowed bg-muted/20 border-l-transparent',
                  !watched &&
                    toggleEpisodeWatched &&
                    'hover:bg-secondary/50',
                  watched &&
                    'bg-secondary/60 opacity-60 border-l-foreground/40',
                  watched &&
                    toggleEpisodeWatched &&
                    'hover:bg-secondary/70',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="shrink-0 whitespace-nowrap text-xs font-medium text-muted-foreground">
                        EP {episode.episode_number}
                      </span>
                      <h4
                        className={cn(
                          'text-sm font-medium',
                          watched && 'line-through opacity-70',
                        )}
                      >
                        {episode.title || 'Title unavailable'}
                      </h4>
                      {watched && <span className="text-xs">✓</span>}
                      {!released && <span className="ml-auto text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Not released</span>}
                      {nextUp && <span className="ml-auto rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-primary">Next up</span>}
                    </div>
                  </div>
                  {episode.runtime && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
                      <Clock className="h-3 w-3" />
                      {formatRuntime(episode.runtime)}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  {formatDate(episode.release_date)}
                  {watched && (
                    <span className="ml-auto px-1.5 py-0.5 rounded text-xs font-medium uppercase tracking-wider bg-foreground/10 text-muted-foreground">
                      Watched
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
