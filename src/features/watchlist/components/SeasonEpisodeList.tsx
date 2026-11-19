import { useState } from 'react';
import { PersonalRating } from './PersonalRating';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, CheckCircle2, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Season } from '@/features/watchlist/useWatchlist';
import { currentSeasonNumber, daysUntil } from '@/features/watchlist/watchlist-utils';
import type { WatchedWhen } from '@/features/watchlist/watched-when';
import { useAuth } from '@/contexts/AuthContext';
import { TitleScores } from './TitleScores';
import { WatchedWhenMenu } from './WatchedWhenMenu';
import { summarizeRatings } from '../rating-summary';

interface SeasonEpisodeListProps {
  seasons: Season[];
  onRate?: (rating: number | null, seasonNumber: number, episodeNumber?: number) => Promise<void>;
  showId: string;
  toggleEpisodeWatched?: (
    showId: string,
    seasonNumber: number,
    episodeNumber: number,
  ) => void | Promise<void>;
  toggleSeasonWatched?: (showId: string, seasonNumber: number, when?: WatchedWhen) => void | Promise<void>;
  isEpisodeWatched: (
    showId: string,
    seasonNumber: number,
    episodeNumber: number,
  ) => boolean;
  isSeasonWatched: (showId: string, season: Season) => boolean;
  /**
   * The season shown. Held by the detail, whose one trailer button plays the
   * selected season's trailer.
   */
  selectedSeason: number | undefined;
  /**
   * Called with a season picked, and with the shown season whenever an
   * episode or the season is marked: the detail defaults to the season the
   * viewer is on, and finishing it must not move the list to the next one.
   */
  onSelectSeason: (seasonNumber: number) => void;
}

export function SeasonEpisodeList({
  seasons,
  onRate,
  showId,
  toggleEpisodeWatched,
  toggleSeasonWatched,
  isEpisodeWatched,
  isSeasonWatched,
  selectedSeason,
  onSelectSeason,
}: SeasonEpisodeListProps) {
  const [skippedSeasons, setSkippedSeasons] = useState<Set<number>>(new Set());
  const currentSeason = seasons.find((s) => s.season_number === selectedSeason);
  const { isAdmin } = useAuth();

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
  const promptSeason =
    !!currentSeason &&
    seasonFullyWatched &&
    currentSeason.personal_rating == null &&
    !skippedSeasons.has(currentSeason.season_number);
  const episodeRatingSummary = currentSeason
    ? summarizeRatings(currentSeason.episodes.map((ep) => ep.personal_rating))
    : null;

  /**
   * Advances to the next unwatched regular season after `completedSeasonNumber`
   * (or the first unwatched regular season if none follow it).
   */
  const advanceAfterSeason = (completedSeasonNumber: number) => {
    const isWatchedAfter = (season: Season) =>
      season.season_number === completedSeasonNumber || isSeasonWatched(showId, season);
    const nextAfter = seasons.find(
      (season) => season.season_number > completedSeasonNumber && !isWatchedAfter(season),
    );
    const nextSeason =
      nextAfter?.season_number ?? currentSeasonNumber(seasons, isWatchedAfter);
    if (nextSeason !== undefined) {
      onSelectSeason(nextSeason);
    }
  };

  return (
    // The episode list is never its own scroller: it renders in the
    // workspace inspector, which scrolls the whole panel, and a nested
    // scroller there would trap the wheel.
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 space-y-2 pb-2">
        <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
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
                onClick={() => onSelectSeason(season.season_number)}
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
            <TitleScores mine={isAdmin ? undefined : currentSeason.personal_rating} />
            <div className="flex items-center gap-2 text-xs text-muted-foreground pb-1.5 border-b">
              <Calendar className="h-3.5 w-3.5" />
              <span>Released: {formatDate(currentSeason.release_date)}</span>
              <span className="ml-auto">
                {currentSeason.episodes.length} episodes
              </span>
            </div>

            {onRate && (
              <PersonalRating
                key={currentSeason.season_number}
                label={`Season ${currentSeason.season_number} overall rating`}
                value={currentSeason.personal_rating}
                onChange={
                  currentWatchedCount > 0
                    ? async (rating) => {
                        const wasPrompting = promptSeason && rating !== null;
                        await onRate(rating, currentSeason.season_number);
                        if (wasPrompting) advanceAfterSeason(currentSeason.season_number);
                      }
                    : undefined
                }
                prompt={promptSeason ? `Finished season ${currentSeason.season_number} — rate it?` : undefined}
                onSkip={
                  promptSeason
                    ? () => {
                        setSkippedSeasons((prev) => new Set(prev).add(currentSeason.season_number));
                        advanceAfterSeason(currentSeason.season_number);
                      }
                    : undefined
                }
              />
            )}
            {onRate && episodeRatingSummary && episodeRatingSummary.average !== null && (
              <p className="text-xs text-muted-foreground tabular-nums">
                Episode average: {episodeRatingSummary.average}/10 · {episodeRatingSummary.rated} of {episodeRatingSummary.total} rated
              </p>
            )}

            {/* Mark Season Complete button */}
            {toggleSeasonWatched && currentSeason.episodes.length > 0 && !seasonFullyWatched && (
              <WatchedWhenMenu
                releaseDate={currentSeason.release_date}
                onPick={(when) => {
                  const completedNumber = currentSeason.season_number;
                  const willPromptRating =
                    Boolean(onRate) &&
                    currentSeason.personal_rating == null &&
                    !skippedSeasons.has(completedNumber);
                  onSelectSeason(completedNumber);
                  void Promise.resolve(toggleSeasonWatched(showId, completedNumber, when)).then(() => {
                    if (!willPromptRating) {
                      advanceAfterSeason(completedNumber);
                    }
                  });
                }}
                className="w-full whitespace-normal h-auto py-1.5"
              >
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
              </WatchedWhenMenu>
            )}
            {toggleSeasonWatched && currentSeason.episodes.length > 0 && seasonFullyWatched && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const completedNumber = currentSeason.season_number;
                  onSelectSeason(completedNumber);
                  void toggleSeasonWatched(showId, completedNumber);
                }}
                className="w-full gap-2 text-xs transition-[color,background-color,border-color] whitespace-normal h-auto py-1.5 text-muted-foreground hover:bg-secondary"
              >
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                <span>Season Complete — Mark as Unwatched</span>
              </Button>
            )}
          </>
        )}
      </div>

      {currentSeason && (
        <div className="min-h-0 flex-1 space-y-1.5 pt-1">
          {currentSeason.episodes.map((episode) => {
            const watched = isEpisodeWatched(
              showId,
              currentSeason.season_number,
              episode.episode_number,
            );
            // Air day counts as released, matching the Up Next rail and News.
            const daysToEpisode = daysUntil(episode.release_date, new Date());
            const released = daysToEpisode !== null && daysToEpisode <= 0;
            const previousEpisodes = currentSeason.episodes.filter(
              (candidate) => candidate.episode_number < episode.episode_number,
            );
            const nextUp = released && !watched && previousEpisodes.every((candidate) =>
              isEpisodeWatched(showId, currentSeason.season_number, candidate.episode_number),
            );

            return (
              <div
                key={episode.episode_number}
                onClick={() => {
                  if (!released || !toggleEpisodeWatched) return;
                  const completedNumber = currentSeason.season_number;
                  const willCompleteSeason =
                    !watched && currentWatchedCount + 1 === currentSeason.episodes.length;
                  const willPromptRating =
                    willCompleteSeason &&
                    Boolean(onRate) &&
                    currentSeason.personal_rating == null &&
                    !skippedSeasons.has(completedNumber);
                  onSelectSeason(completedNumber);
                  void Promise.resolve(
                    toggleEpisodeWatched(
                      showId,
                      completedNumber,
                      episode.episode_number,
                    ),
                  ).then(() => {
                    if (willCompleteSeason && !willPromptRating) {
                      advanceAfterSeason(completedNumber);
                    }
                  });
                }}
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
                      {!released && <span className="ml-auto text-xs font-medium uppercase tracking-wider text-muted-foreground">Not released</span>}
                      {nextUp && <span className="ml-auto rounded bg-primary/15 px-1.5 py-0.5 text-xs font-medium uppercase tracking-wider text-primary">Next up</span>}
                    </div>
                  </div>
                  {episode.runtime && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
                      <Clock className="h-3 w-3" />
                      {formatRuntime(episode.runtime)}
                    </div>
                  )}
                </div>
                {onRate && (
                  <PersonalRating
                    label={`Episode ${episode.episode_number} rating`}
                    value={episode.personal_rating}
                    onChange={watched ? (rating) => onRate(rating, currentSeason.season_number, episode.episode_number) : undefined}
                  />
                )}
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
