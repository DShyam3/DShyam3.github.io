import { useState, useEffect, useId, useRef, useMemo } from 'react';
import { ExternalLink, Trash2, CalendarDays, Calendar, Heart, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useWatchlist, type WatchlistItem, type Season } from '@/features/watchlist/useWatchlist';
import { SeasonEpisodeList } from './SeasonEpisodeList';
import { DetailDescription, RuntimeRow, SeriesStatusPill } from './WatchlistDetailParts';
import { displayTitle, getStatusColor, isUpcomingStatus } from '@/features/watchlist/watchlist-utils';
import { PlatformBadge } from './PlatformLogo';
import { useDeleteConfirm } from '@/hooks/useDeleteConfirm';
import { useWorkspaceInspector } from '@/contexts/WorkspaceInspectorContext';

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
  ) => void;
  toggleSeasonWatched?: (showId: string, seasonNumber: number) => void;
  isEpisodeWatched: (
    showId: string,
    seasonNumber: number,
    episodeNumber: number,
  ) => boolean;
  isSeasonWatched: (showId: string, season: Season) => boolean;
  onMoveToFavourites?: () => void;
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
  onMoveToFavourites,
  onResync,
  syncing,
}: WatchlistDetailDialogProps) {
  const instanceId = useId();
  const { setDockedDetail } = useWorkspaceInspector();
  const wasOpenRef = useRef(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { askDelete, deleteDialog } = useDeleteConfirm();
  const { loadShowEpisodes, loadItemDescription } = useWatchlist();

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

  // Reset deleting state when dialog opens/closes
  useEffect(() => {
    if (!open) setIsDeleting(false);
  }, [open]);

  const isTVShow = item.category === 'TV Shows';
  const hasSeasons = Boolean(isTVShow && item.seasons && item.seasons.length > 0);

  const upcomingReleaseDate = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    if (item.category === 'Movies') {
      if (item.release_date) {
        const releaseDate = new Date(item.release_date);
        releaseDate.setHours(0, 0, 0, 0);
        if (releaseDate > now) {
          return releaseDate;
        }
      }
      return null;
    }

    if (!item.seasons || item.seasons.length === 0) return null;

    const futureSeasons = item.seasons.filter(
      (s) => s.release_date && new Date(s.release_date) > now,
    );
    if (futureSeasons.length > 0) {
      const earliestSeason = futureSeasons.reduce((earliest, current) => {
        if (!earliest.release_date) return current;
        if (!current.release_date) return earliest;
        return new Date(current.release_date) <
          new Date(earliest.release_date)
          ? current
          : earliest;
      });

      if (earliestSeason.release_date) {
        const releaseDate = new Date(earliestSeason.release_date);
        releaseDate.setHours(0, 0, 0, 0);
        return releaseDate;
      }
    }
    return null;
  }, [item.category, item.release_date, item.seasons]);

  useEffect(() => {
    if (!open) {
      if (wasOpenRef.current) {
        wasOpenRef.current = false;
        setDockedDetail(null);
      }
      return;
    }

    wasOpenRef.current = true;
    setDockedDetail({
      id: `watchlist-${item.category}-${item.id}-${instanceId}`,
      eyebrow: isTVShow ? 'TV Series Inspector' : 'Movie Inspector',
      title: item.title,
      onClose: () => {
        onOpenChange(false);
        onCloseAutoFocus?.(new Event('close'));
      },
      node: (
        <div className="space-y-4">
          {item.image_url ? (
            <div className="flex justify-center rounded-xl border border-border/50 bg-background/50 p-2">
              <img
                src={item.image_url}
                alt={item.title}
                className="max-h-52 w-auto rounded-lg object-contain shadow-md"
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
              {item.genres && item.genres.length > 0 ? (
                <span>• {item.genres.join(', ')}</span>
              ) : null}
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
            </div>
          </div>

          {item.description ? (
            <DetailDescription text={item.description} />
          ) : null}

          {!isTVShow && item.runtime ? (
            <RuntimeRow
              runtime={item.runtime}
              className="text-muted-foreground"
              iconClassName="text-muted-foreground"
            />
          ) : null}

          {isTVShow && item.series_status ? (
            <div>
              <SeriesStatusPill status={item.series_status} className="px-2.5 py-1" />
            </div>
          ) : null}

          {hasSeasons && item.seasons ? (
            <div
              className="rounded-xl border border-border/50 bg-background/45 p-2.5"
              role="region"
              aria-label="Episodes"
            >
              <SeasonEpisodeList
                showId={item.id}
                seasons={item.seasons}
                toggleEpisodeWatched={toggleEpisodeWatched}
                toggleSeasonWatched={toggleSeasonWatched}
                isEpisodeWatched={isEpisodeWatched}
                isSeasonWatched={isSeasonWatched}
              />
            </div>
          ) : null}

          {(onSchedule || onMoveToFavourites || onResync || onDelete) ? (
            <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-border/50">
              {onSchedule ? (
                <Button
                  variant={isScheduled ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={
                    isScheduled && onRemoveFromSchedule
                      ? onRemoveFromSchedule
                      : onSchedule
                  }
                  className="gap-1.5 text-xs flex-1 justify-center"
                >
                  <CalendarDays className="h-3.5 w-3.5" />
                  {isScheduled ? 'Unschedule' : 'Schedule'}
                </Button>
              ) : null}

              {onMoveToFavourites ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onMoveToFavourites}
                  className="gap-1.5 text-xs flex-1 justify-center hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
                >
                  <Heart className="h-3.5 w-3.5" />
                  Favourite
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
                  className="gap-1.5 text-xs flex-1 justify-center"
                >
                  <RefreshCcw className={cn('h-3.5 w-3.5', syncing && 'animate-spin')} />
                  Resync
                </Button>
              ) : null}

              {onDelete ? (
                <div className="flex-1 flex items-center gap-1.5">
                  {isDeleting ? (
                    <>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => askDelete({ name: item.title, onConfirm: onDelete })}
                        className="gap-1 text-xs flex-1 justify-center"
                      >
                        Confirm
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsDeleting(false)}
                        className="text-xs flex-1 justify-center"
                      >
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsDeleting(true)}
                      className="gap-1.5 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 flex-1 justify-center"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </Button>
                  )}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ),
    });
  }, [
    open,
    instanceId,
    isTVShow,
    hasSeasons,
    item,
    status,
    upcomingReleaseDate,
    isScheduled,
    syncing,
    isDeleting,
    onOpenChange,
    onCloseAutoFocus,
    onSchedule,
    onRemoveFromSchedule,
    onMoveToFavourites,
    onResync,
    onDelete,
    askDelete,
    toggleEpisodeWatched,
    toggleSeasonWatched,
    isEpisodeWatched,
    isSeasonWatched,
    setDockedDetail,
  ]);

  useEffect(() => {
    return () => {
      if (wasOpenRef.current) {
        wasOpenRef.current = false;
        setDockedDetail(null);
      }
    };
  }, [setDockedDetail]);

  return <>{deleteDialog}</>;
}
