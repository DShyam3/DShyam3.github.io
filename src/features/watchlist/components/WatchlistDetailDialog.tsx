import { useState, useEffect, useId, useRef, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink, Trash2, CalendarDays, Calendar, RefreshCcw, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useWatchlist, type WatchlistItem, type Season } from '@/features/watchlist/useWatchlist';
import { libraryShelf } from '@/features/watchlist/library-state';
import { SeasonEpisodeList } from './SeasonEpisodeList';
import { TrailerButton } from './TrailerButton';
import { LibraryActions } from './LibraryActions';
import { useAuth } from '@/contexts/AuthContext';
import { CreditsList, DetailDescription, RuntimeRow, SeriesStatusPill } from './WatchlistDetailParts';
import { currentSeasonNumber, displayTitle, getStatusColor, isUpcomingStatus } from '@/features/watchlist/watchlist-utils';
import { detailTrailer } from '@/features/watchlist/trailer';
import { countdownRelease, libraryStatus, nextSeasonToWatch, releaseDay } from '@/features/watchlist/library-state';
import { PlatformBadge } from './PlatformLogo';
import { useDeleteConfirm } from '@/hooks/useDeleteConfirm';
import { useWorkspaceInspector } from '@/contexts/WorkspaceInspectorContext';
import type { WatchedWhen } from '@/features/watchlist/watched-when';
import { TitleScores } from './TitleScores';
import { libraryCategories } from '../library-categories';
import { useTMDB } from '../useTMDB';
import { useSchedule } from '../useSchedule';

interface WatchlistDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus?: (event: Event) => void;
  item: WatchlistItem;
  status?: string;
  onDelete?: () => void;
  onSchedule?: () => void;
  onRemoveFromSchedule?: () => void;
  isScheduled?: boolean;
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
  onResync?: () => void;
  syncing?: boolean;
}

export function WatchlistDetailDialog({
  open,
  onOpenChange,
  onCloseAutoFocus,
  item,
  status,
  onDelete,
  onSchedule,
  onRemoveFromSchedule,
  isScheduled,
  toggleEpisodeWatched,
  toggleSeasonWatched,
  isEpisodeWatched,
  isSeasonWatched,
  onResync,
  syncing,
}: WatchlistDetailDialogProps) {
  const instanceId = useId();
  const { claimDockedDetail, updateDockedDetail, releaseDockedDetail } = useWorkspaceInspector();
  const wasOpenRef = useRef(false);
  // The season the viewer picked, or null to follow the one they are on. Tied
  // to the title: News and Your Week hand one open dialog the next title, and
  // a pick on one show must not carry over to another.
  const [seasonPick, setSeasonPick] = useState<{ itemId: string; season: number } | null>(null);
  const pickedSeason = seasonPick?.itemId === item.id ? seasonPick.season : null;
  const pickSeason = useCallback(
    (season: number) => setSeasonPick({ itemId: item.id, season }),
    [item.id],
  );
  const { askDelete, deleteDialog } = useDeleteConfirm();
  const { loadShowEpisodes, loadItemDescription, setPersonalRating, ratingsStatus, favourites, removeWatchlistItem } = useWatchlist();
  const { removeFromScheduleByWatchlistId } = useSchedule();
  const removeFromScheduleRef = useRef(removeFromScheduleByWatchlistId);
  useEffect(() => {
    removeFromScheduleRef.current = removeFromScheduleByWatchlistId;
  }, [removeFromScheduleByWatchlistId]);
  const { getMovieDetails } = useTMDB();
  const { isAdmin } = useAuth();
  const handleDelete = useMemo(() => {
    if (onDelete) return onDelete;
    if (!isAdmin) return undefined;
    return async () => {
      await removeWatchlistItem(item);
      await removeFromScheduleRef.current(item);
      onOpenChange(false);
    };
  }, [onDelete, isAdmin, removeWatchlistItem, item, onOpenChange]);
  const shelf = libraryShelf(item);
  const isFavourite = favourites.some(
    (candidate) =>
      candidate.media_type === (item.category === 'TV Shows' ? 'tv' : 'movie') &&
      (item.tmdb_id ? candidate.tmdb_id === item.tmdb_id : candidate.title === item.title),
  );

  // The grid only loads episode numbers and watched flags; episode titles,
  // air dates and runtimes are fetched here, for this show only, the first
  // time its dialog is opened.
  useEffect(() => {
    if (open && item.category === 'TV Shows' && !item.episodesLoaded) {
      void loadShowEpisodes(item.id);
    }
  }, [open, item.category, item.episodesLoaded, item.id, loadShowEpisodes]);

  // Plot summaries are 61% of the movies payload and are only shown here, so
  // the list query skips them and this fetches the one being looked at.
  useEffect(() => {
    if (open && !item.descriptionLoaded) {
      void loadItemDescription(item);
    }
  }, [open, item, loadItemDescription]);

  // Reset the season pick when dialog closes
  useEffect(() => {
    if (!open) {
      setSeasonPick(null);
    }
  }, [open]);

  const isTVShow = item.category === 'TV Shows';
  const { data: tmdbDetail } = useQuery({
    // Not getMovieDetails' own key, which it fetches inside: same-key
    // fetchQuery joins this query's in-flight promise and never settles.
    queryKey: ['watchlist', 'detail-dialog-tmdb', isTVShow ? 'tv' : 'movie', item.tmdb_id],
    enabled: open && !!item.tmdb_id,
    staleTime: 30 * 60 * 1000,
    queryFn: async () => {
      const details = await getMovieDetails(item.tmdb_id!, isTVShow ? 'tv' : 'movie');
      if (!details) throw new Error('TMDB details unavailable');
      return details;
    },
  });
  const hasSeasons = Boolean(isTVShow && item.seasons && item.seasons.length > 0);
  const regularSeasonCount = isTVShow ? (item.seasons?.filter((season) => season.season_number > 0).length ?? 0) : 0;

  // Read every render, not memoised: isSeasonWatched keeps one identity while
  // the watched flags behind it change.
  const seasons = hasSeasons ? item.seasons ?? [] : [];
  const selectedSeason =
    pickedSeason !== null && seasons.some((season) => season.season_number === pickedSeason)
      ? pickedSeason
      // Between seasons, open where the card says you pick up ("S5 next").
      : (libraryStatus(item) === 'Between seasons' ? nextSeasonToWatch(item) : null) ?? currentSeasonNumber(seasons, (season) => isSeasonWatched(item.id, season));
  const trailer = detailTrailer(
    item,
    seasons.find((season) => season.season_number === selectedSeason),
  );

  // The date the status pill counts down to, from the same pure source as
  // the card.
  const upcomingReleaseDate = useMemo(() => {
    const next = countdownRelease(item);
    return next ? releaseDay(next) : null;
  }, [item]);

  useEffect(() => {
    if (!open) {
      if (wasOpenRef.current) {
        wasOpenRef.current = false;
        releaseDockedDetail(instanceId);
      }
      return;
    }

    // Claim only on opening; see claimDockedDetail.
    const dock = wasOpenRef.current ? updateDockedDetail : claimDockedDetail;
    wasOpenRef.current = true;
    dock(instanceId, {
      id: `watchlist-${item.category}-${item.id}-${instanceId}`,
      eyebrow: isTVShow ? 'TV Series Inspector' : 'Movie Inspector',
      title: item.title,
      onClose: () => {
        onOpenChange(false);
        onCloseAutoFocus?.(new Event('close'));
      },
      onReplaced: () => onOpenChange(false),
      node: (
        <div className="space-y-4">
          {item.image_url ? (
            // The poster stands on the panel itself. A bordered, tinted box
            // around it read as a frame inside the panel's own frame.
            <div className="flex justify-center">
              <img
                src={item.image_url}
                alt={item.title}
                className="max-h-52 w-auto rounded-lg object-contain"
              />
            </div>
          ) : null}

          <div className="space-y-2">
            <h2 className="font-serif text-base font-semibold text-foreground leading-snug">
              {item.link ? (
                <a
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-primary transition-colors inline-flex items-center gap-1.5"
                >
                  <span>{displayTitle(item.title, item.year)}</span>
                  <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-70" />
                </a>
              ) : (
                displayTitle(item.title, item.year)
              )}
            </h2>

            <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-1.5">
              <span className="uppercase tracking-wider font-medium">
                {isTVShow ? 'TV Show' : 'Movie'}
              </span>
              {item.year ? <span>• {item.year}</span> : null}
              {regularSeasonCount > 0 ? (
                <span>• {regularSeasonCount} season{regularSeasonCount === 1 ? '' : 's'}</span>
              ) : null}
              {item.genres && item.genres.length > 0 ? (
                <span>• {item.genres.join(', ')}</span>
              ) : null}
              {libraryCategories(item).length > 0 && <span>• Categories: {libraryCategories(item).join(', ')}</span>}
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <PlatformBadge platform={item.streaming_platform} size={20} />
              {status ? (
                isUpcomingStatus(status) && upcomingReleaseDate ? (
                  <div
                    className={cn(
                      'flex flex-col gap-0.5 px-2 py-1 rounded-lg',
                      getStatusColor(status),
                    )}
                  >
                    <span className="text-xs font-medium">{status}</span>
                    <span className="text-xs opacity-70 flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {upcomingReleaseDate.toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                ) : (
                  <span
                    className={cn(
                      'text-xs px-2 py-1 rounded-full font-medium',
                      getStatusColor(status),
                    )}
                  >
                    {status}
                  </span>
                )
              ) : null}
              {isTVShow && item.series_status && status !== item.series_status ? (
                <SeriesStatusPill status={item.series_status} className="px-2.5 py-1" />
              ) : null}
              {shelf && shelf.toLowerCase() !== status?.toLowerCase() ? (
                <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-muted-foreground">
                  Shelf: {shelf}
                </span>
              ) : null}
              {isFavourite ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-foreground">
                  <Heart className="h-3 w-3 fill-current" aria-hidden="true" />
                  Favourite
                </span>
              ) : null}
            </div>
          </div>

          {item.description ? (
            <DetailDescription text={item.description} />
          ) : null}

          <CreditsList
            kind={isTVShow ? 'tv' : 'movie'}
            leads={isTVShow ? item.creators : item.directors}
            cast={item.top_cast}
          />

          <TrailerButton
            trailerKey={trailer.key}
            title={trailer.title}
            label={trailer.label}
            className="w-full"
          />

          {/* The admin rates in LibraryActions; visitors see the score here. */}
          <TitleScores
            mine={isAdmin ? undefined : item.personal_rating}
            imdbRating={item.imdb_rating}
            imdbVotes={item.imdb_votes}
            rtScore={item.rt_score}
            metascore={item.metascore}
            tmdbRating={item.tmdb_rating ?? tmdbDetail?.tmdb_rating ?? undefined}
            tmdbVotes={item.tmdb_votes ?? tmdbDetail?.tmdb_votes ?? undefined}
          />

          {!isTVShow && item.runtime ? (
            <RuntimeRow
              runtime={item.runtime}
              className="text-muted-foreground"
              iconClassName="text-muted-foreground"
            />
          ) : null}

          <LibraryActions key={`${item.category}:${item.id}`} item={item} />

          {hasSeasons && item.seasons ? (
            <div
              className="rounded-xl border border-border/50 bg-background/45 p-2.5"
              role="region"
              aria-label="Episodes"
            >
              <SeasonEpisodeList
                onRate={isAdmin && ratingsStatus === 'ready' ? (rating, seasonNumber, episodeNumber) => setPersonalRating(item, rating, seasonNumber, episodeNumber) : undefined}
                showId={item.id}
                seasons={item.seasons}
                selectedSeason={selectedSeason}
                onSelectSeason={pickSeason}
                toggleEpisodeWatched={toggleEpisodeWatched}
                toggleSeasonWatched={toggleSeasonWatched}
                isEpisodeWatched={isEpisodeWatched}
                isSeasonWatched={isSeasonWatched}
              />
            </div>
          ) : null}

          {(onSchedule || onResync || handleDelete) ? (
            // Two by two: the inspector and the sheet are never wide enough for
            // four in a row, and a 0-basis flex row squeezed them until the
            // labels spilled out. A last action left alone on its row (News
            // passes only Schedule) takes the full width, as InspectorBody does.
            <div className="grid grid-cols-2 items-start gap-2 border-t border-border/50 pt-3 [&>:last-child:nth-child(odd)]:col-span-2">
              {onSchedule ? (
                <Button
                  variant={isScheduled ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={
                    isScheduled && onRemoveFromSchedule
                      ? onRemoveFromSchedule
                      : onSchedule
                  }
                  className="gap-1.5 text-xs justify-center"
                >
                  <CalendarDays className="h-3.5 w-3.5" />
                  {isScheduled ? 'Unschedule' : 'Schedule'}
                </Button>
              ) : null}

              {onResync ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onResync}
                  disabled={syncing}
                  aria-label="Resync title"
                  title="Resync this title's data from TMDB"
                  className="gap-1.5 text-xs justify-center"
                >
                  <RefreshCcw className={cn('h-3.5 w-3.5', syncing && 'animate-spin')} />
                  Resync
                </Button>
              ) : null}

              {handleDelete ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    askDelete({
                      name: item.title,
                      title: isTVShow ? 'Remove show from library' : 'Remove movie from library',
                      confirmLabel: isTVShow ? 'Remove show' : 'Remove movie',
                      description: (
                        <>
                          Remove{' '}
                          <span className="font-medium text-foreground">&ldquo;{item.title}&rdquo;</span>{' '}
                          from your library? This action cannot be undone.
                        </>
                      ),
                      onConfirm: handleDelete,
                    })
                  }
                  className="gap-1.5 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 justify-center"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {isTVShow ? 'Remove show' : 'Remove movie'}
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      ),
    });
  }, [
    open,
    isAdmin,
    setPersonalRating,
    ratingsStatus,
    instanceId,
    isTVShow,
    hasSeasons,
    regularSeasonCount,
    item,
    selectedSeason,
    trailer.key,
    tmdbDetail?.tmdb_rating,
    tmdbDetail?.tmdb_votes,
    trailer.title,
    trailer.label,
    status,
    shelf,
    isFavourite,
    upcomingReleaseDate,
    isScheduled,
    syncing,
    onOpenChange,
    onCloseAutoFocus,
    onSchedule,
    onRemoveFromSchedule,
    onResync,
    handleDelete,
    askDelete,
    toggleEpisodeWatched,
    toggleSeasonWatched,
    isEpisodeWatched,
    isSeasonWatched,
    pickSeason,
    claimDockedDetail,
    updateDockedDetail,
    releaseDockedDetail,
  ]);

  useEffect(() => {
    return () => {
      if (wasOpenRef.current) {
        wasOpenRef.current = false;
        releaseDockedDetail(instanceId);
      }
    };
  }, [instanceId, releaseDockedDetail]);

  return <>{deleteDialog}</>;
}
