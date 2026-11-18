import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Trash2, Calendar, Heart, MoreHorizontal } from 'lucide-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { WatchlistItem, Season } from '@/features/watchlist/useWatchlist';
import type { TitleRef } from '@/features/watchlist/title-ref';
import { WatchlistDetailDialog } from './WatchlistDetailDialog';
import {
  compactUpcomingStatus,
  displayTitle,
  getStatusColor,
  isUpcomingStatus,
} from '@/features/watchlist/watchlist-utils';
import { PlatformBadge } from './PlatformLogo';
import { providerSearchUrl } from '@/features/watchlist/provider-links';
import { useDeleteConfirm } from '@/hooks/useDeleteConfirm';
import type { ScheduleItem as ScheduleEntry } from '@/features/watchlist/useSchedule';
import { PosterCard } from './PosterCard';
import { SmartScheduleDialog, scheduleReleaseDate } from './SmartScheduleDialog';

interface WatchlistCardProps {
  item: WatchlistItem;
  /** Time left to watch, shown in place of year and genre while the library is sorted by it. */
  timeLeft?: string;
  onRemove?: (ref: TitleRef) => void;
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
  getAutoStatus: (item: WatchlistItem) => string | undefined;
  addToSchedule?: (item: Omit<ScheduleEntry, 'id'>) => void;
  removeFromSchedule?: (ref: TitleRef) => void;
  isInSchedule: (ref: TitleRef) => boolean;
  /** Whether the title is a favourite; the menu offers the opposite. */
  isFavourite?: boolean;
  onToggleFavourite?: (item: WatchlistItem) => void;
  onResync?: (ref: TitleRef) => void;
  syncing?: boolean;
}

export const WatchlistCard = React.memo(function WatchlistCard({
  item,
  timeLeft,
  onRemove,
  toggleEpisodeWatched,
  toggleSeasonWatched,
  isEpisodeWatched,
  isSeasonWatched,
  getAutoStatus,
  addToSchedule,
  removeFromSchedule,
  isInSchedule,
  isFavourite = false,
  onToggleFavourite,
  onResync,
  syncing,
}: WatchlistCardProps) {
  const [detailOpen, setDetailOpen] = useState(false);
  const cardRef = useRef<HTMLButtonElement>(null);
  const { askDelete, deleteDialog } = useDeleteConfirm();
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const handleAddToSchedule = (day: ScheduleEntry['day'], date: string, mode: 'weekly' | 'date') => {
    if (addToSchedule) {
      addToSchedule({
        watchlistItemId: item.id,
        day,
        scheduledDate: mode === 'date' ? date : undefined,
        mode,
        title: item.title,
        category: item.category,
        image_url: item.image_url,
      });
    }
    setScheduleDialogOpen(false);
  };

  const status = getAutoStatus(item);
  // A search page on the provider's own site, not a deep link -- see
  // provider-links.ts.
  const watchUrl = providerSearchUrl(item.streaming_platform, item.title);

  const upcomingReleaseDate = React.useMemo(() => {
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
  }, [item]);

  return (
    <>
      <PosterCard
        cardRef={cardRef}
        title={displayTitle(item.title, item.year)}
        poster={item.image_url}
        onOpen={() => setDetailOpen(true)}
        subtitle={timeLeft ?? <>{item.year}{item.year && item.genres?.length ? ' · ' : ''}{item.genres?.[0]}</>}
        meta={<>
            {watchUrl ? (
              <a
                href={watchUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                title={`Watch on ${item.streaming_platform}`}
                aria-label={`Watch on ${item.streaming_platform}`}
                className="hover:opacity-80"
              >
                <PlatformBadge platform={item.streaming_platform} size={18} />
              </a>
            ) : (
              <PlatformBadge platform={item.streaming_platform} size={18} />
            )}
            {status && (
              isUpcomingStatus(status) && upcomingReleaseDate ? (
                <span
                  className={cn(
                    'flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap',
                    getStatusColor(status),
                  )}
                  title={`${status} — ${upcomingReleaseDate.toLocaleDateString([], {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}`}
                >
                  {/* The icon stays muted while the countdown takes the
                      foreground: two weights inside one pill, so the glyph
                      marks it as a date and the eye still lands on the
                      number rather than on the decoration. */}
                  <Calendar className="h-3 w-3 shrink-0 text-muted-foreground" />
                  {compactUpcomingStatus(status)}
                </span>
              ) : (
                <span
                  className={cn(
                    'text-xs px-2 py-0.5 rounded font-medium whitespace-nowrap',
                    getStatusColor(status),
                  )}
                >
                  {status}
                </span>
              )
            )}
        </>}
        scheduled={isInSchedule(item)}
        onSchedule={addToSchedule || removeFromSchedule ? () => {
          if (isInSchedule(item) && removeFromSchedule) {
            askDelete({ name: item.title, title: 'Remove from schedule', confirmLabel: 'Remove', description: 'The title stays in your library.', onConfirm: () => removeFromSchedule(item) });
          } else if (addToSchedule) setScheduleDialogOpen(true);
        } : undefined}
        actions={onToggleFavourite || onRemove ? (
          <div className="absolute right-2 top-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button variant="secondary" size="icon" className="h-11 w-11 bg-background/90" aria-label={`Actions for ${item.title}`}><MoreHorizontal className="h-5 w-5" /></Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {onToggleFavourite && <DropdownMenuItem onSelect={() => onToggleFavourite(item)}><Heart className={cn('mr-2 h-4 w-4', isFavourite && 'fill-current')} />{isFavourite ? 'Remove from favourites' : 'Add to favourites'}</DropdownMenuItem>}
                {onRemove && <DropdownMenuItem className="text-destructive" onSelect={() => setDeleteConfirmOpen(true)}><Trash2 className="mr-2 h-4 w-4" />Remove from library</DropdownMenuItem>}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : undefined}
      />

      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-serif">
              Delete from Watchlist
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to remove{' '}
              <span className="font-medium text-foreground">
                "{item.title}"
              </span>{' '}
              from your watchlist? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmOpen(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (onRemove) onRemove(item);
                setDeleteConfirmOpen(false);
              }}
              className="flex-1 gap-1.5"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <SmartScheduleDialog
        open={scheduleDialogOpen}
        onOpenChange={setScheduleDialogOpen}
        title={item.title}
        releaseDate={scheduleReleaseDate(item)}
        defaultMode={item.category === 'TV Shows' ? 'weekly' : 'date'}
        onAdd={handleAddToSchedule}
      />

      <WatchlistDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onCloseAutoFocus={(event) => { event.preventDefault(); cardRef.current?.focus(); }}
        item={item}
        status={status}
        onDelete={
          onRemove
            ? () => {
                onRemove(item);
                setDetailOpen(false);
              }
            : undefined
        }
        onSchedule={
          addToSchedule
            ? () => {
                if (!isInSchedule(item)) {
                  setScheduleDialogOpen(true);
                }
              }
            : undefined
        }
        onRemoveFromSchedule={
          removeFromSchedule
            ? () =>
                askDelete({
                  name: item.title,
                  title: 'Remove from schedule',
                  confirmLabel: 'Remove',
                  description: `Remove "${item.title}" from your weekly schedule? The title stays on your watchlist.`,
                  onConfirm: () => {
                    removeFromSchedule(item);
                    setDetailOpen(false);
                  },
                })
            : undefined
        }
        isScheduled={isInSchedule(item)}
        toggleEpisodeWatched={toggleEpisodeWatched}
        toggleSeasonWatched={toggleSeasonWatched}
        isEpisodeWatched={isEpisodeWatched}
        isSeasonWatched={isSeasonWatched}
        onResync={onResync ? () => onResync(item) : undefined}
        syncing={syncing}
      />

      {deleteDialog}
    </>
  );
});
