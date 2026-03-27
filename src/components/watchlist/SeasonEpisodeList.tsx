import { useState, useRef, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, CheckCircle2, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Season } from '@/hooks/useWatchlist';
import { DetailSection } from '@/components/cards/CardDetailDialog';

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
    const firstUnwatched = seasons.find((s) => !isSeasonWatched(showId, s));
    return firstUnwatched ? firstUnwatched.season_number : seasons[seasons.length - 1].season_number;
  }, [seasons, showId, isSeasonWatched]);

  const [selectedSeason, setSelectedSeason] = useState(initialSeason);
  const unwatchedEpisodeRef = useRef<HTMLDivElement>(null);

  const currentSeason = seasons.find((s) => s.season_number === selectedSeason);

  useEffect(() => {
    if (unwatchedEpisodeRef.current) {
      // Use setTimeout to ensure the element is rendered and the container is ready
      setTimeout(() => {
        unwatchedEpisodeRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }, 100);
    }
  }, [selectedSeason, unwatchedEpisodeRef.current]);

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'TBA';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
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

  return (
    <DetailSection label="Seasons & Episodes">
      <div className="flex gap-2 mb-4 flex-wrap">
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
              onClick={() => setSelectedSeason(season.season_number)}
              className="text-xs relative"
            >
              Season {season.season_number}
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

      {currentSeason &&
        (() => {
          const seasonFullyWatched = isSeasonWatched(showId, currentSeason);
          const watchedCount = getWatchedCount(currentSeason);

          return (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground pb-2 border-b">
                <Calendar className="h-4 w-4" />
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
                    'w-full gap-2 text-xs transition-all whitespace-normal h-auto py-2',
                    seasonFullyWatched
                      ? 'border-green-500/30 text-green-600 dark:text-green-400 hover:bg-green-500/10'
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
                        Mark Season {currentSeason.season_number} as Complete
                        {watchedCount > 0 && (
                          <span className="opacity-60 ml-1">
                            ({watchedCount}/{currentSeason.episodes.length}{' '}
                            watched)
                          </span>
                        )}
                      </span>
                    </>
                  )}
                </Button>
              )}

              <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
                {currentSeason.episodes.map((episode, index) => {
                  const watched = isEpisodeWatched(
                    showId,
                    currentSeason.season_number,
                    episode.episode_number,
                  );

                  // Find the first unwatched episode to attach the ref
                  const firstUnwatchedIndex = currentSeason.episodes.findIndex(
                    (ep) =>
                      !isEpisodeWatched(
                        showId,
                        currentSeason.season_number,
                        ep.episode_number,
                      )
                  );
                  const isCurrentTarget = index === firstUnwatchedIndex;

                  return (
                    <div
                      key={episode.episode_number}
                      ref={isCurrentTarget ? unwatchedEpisodeRef : null}
                      onClick={() =>
                        toggleEpisodeWatched &&
                        toggleEpisodeWatched(
                          showId,
                          currentSeason.season_number,
                          episode.episode_number,
                        )
                      }
                      className={cn(
                        'p-3 rounded-lg transition-all border-l-4',
                        toggleEpisodeWatched
                          ? 'cursor-pointer'
                          : 'cursor-default',
                        !watched && 'bg-secondary/30 border-l-transparent',
                        !watched &&
                          toggleEpisodeWatched &&
                          'hover:bg-secondary/50',
                        watched &&
                          'bg-secondary/60 opacity-60 border-l-green-500',
                        watched &&
                          toggleEpisodeWatched &&
                          'hover:bg-secondary/70',
                      )}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-muted-foreground">
                              EP {episode.episode_number}
                            </span>
                            <h4
                              className={cn(
                                'text-sm font-medium',
                                watched && 'line-through opacity-70',
                              )}
                            >
                              {episode.title}
                            </h4>
                            {watched && <span className="text-xs">✓</span>}
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
                          <span className="ml-auto px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider bg-green-500 text-white">
                            Watched
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}
    </DetailSection>
  );
}
