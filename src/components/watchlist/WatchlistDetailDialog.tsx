import { ReactNode, useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ExternalLink, Trash2, CalendarDays, Calendar, Clock, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { WatchlistItem, Season } from '@/hooks/useWatchlist';
import { SeasonEpisodeList } from './SeasonEpisodeList';
import { formatRuntime, getPlatformColor } from '@/lib/watchlist-utils';

interface WatchlistDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
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
}

export function WatchlistDetailDialog({
  open,
  onOpenChange,
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
}: WatchlistDetailDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  // Reset deleting state when dialog opens/closes
  useEffect(() => {
    if (!open) setIsDeleting(false);
  }, [open]);

  const isTVShow = item.category === 'TV Shows';
  const hasSeasons = isTVShow && item.seasons && item.seasons.length > 0;

  const upcomingReleaseDate = (() => {
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
  })();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'max-h-[85vh] overflow-y-auto p-0 rounded-xl items-start',
          // Wider dialog for TV shows with seasons
          hasSeasons ? 'sm:max-w-4xl' : 'sm:max-w-2xl',
        )}
      >
        {/* Mobile Layout - stacked */}
        <div className="sm:hidden">
          {item.image_url && (
            <div className="w-full max-h-[60vh] relative overflow-hidden rounded-t-xl bg-background flex justify-center">
              <img
                src={item.image_url}
                alt={item.title}
                className="h-auto max-h-[60vh] w-auto object-contain"
              />
            </div>
          )}
          <div className="p-4 pb-8">
            <DialogHeader className="text-left">
              <DialogTitle className="font-serif text-lg font-medium pr-8">
                {item.link ? (
                  <a
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-primary transition-colors inline-flex items-center gap-2"
                  >
                    {item.title}
                    <ExternalLink className="w-4 h-4 opacity-60" />
                  </a>
                ) : (
                  item.title
                )}
              </DialogTitle>
              <div className="text-sm text-muted-foreground mt-1 flex flex-wrap items-center gap-2">
                <span className="uppercase tracking-wider text-xs font-medium">
                  {isTVShow ? 'TV Show' : 'Movie'}
                </span>
                {item.year && <span>• {item.year}</span>}
                {item.genres && item.genres.length > 0 && (
                  <span>• {item.genres.join(', ')}</span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-3">
                {item.streaming_platform && (
                  <span
                    className={cn(
                      'text-xs px-2 py-1 rounded font-medium',
                      getPlatformColor(item.streaming_platform),
                    )}
                  >
                    {item.streaming_platform}
                  </span>
                )}
                <div className="flex flex-col items-start gap-1">
                  {status && (
                    <span
                      className={cn(
                        'text-xs px-2 py-1 rounded-full font-medium',
                        status === 'Watching' &&
                          'bg-orange-500/10 text-orange-600 dark:text-orange-400',
                        status === 'To Watch' && 'bg-primary/10 text-primary',
                        (status === 'Completed' || status === 'Watched') &&
                          'bg-green-500/10 text-green-600 dark:text-green-400',
                        status === 'Coming Soon' &&
                          'bg-purple-500/10 text-purple-600 dark:text-purple-400',
                        status.toLowerCase().includes('releases in') &&
                          'bg-amber-500/10 text-amber-600 dark:text-amber-400',
                        status === 'Released' &&
                          'bg-gray-500/10 text-gray-600 dark:text-gray-400',
                      )}
                    >
                      {status}
                    </span>
                  )}
                  {upcomingReleaseDate && status && (status.toLowerCase().includes('releases in') || status === 'Coming Soon') && (
                    <span className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {upcomingReleaseDate.toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                  )}
                </div>
              </div>
            </DialogHeader>

            {item.description && (
              <p className="text-sm text-muted-foreground mt-4 line-clamp-4">
                {item.description}
              </p>
            )}

            {/* Movie runtime */}
            {!isTVShow && item.runtime && (
              <div className="flex items-center gap-2 mt-3 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>{formatRuntime(item.runtime)}</span>
              </div>
            )}

            {/* TV Show series status */}
            {isTVShow && item.series_status && (
              <div className="mt-3">
                <span
                  className={cn(
                    'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium',
                    item.series_status === 'Returning Series' &&
                      'bg-green-500/10 text-green-600 dark:text-green-400',
                    item.series_status === 'In Production' &&
                      'bg-blue-500/10 text-blue-600 dark:text-blue-400',
                    item.series_status === 'Ended' &&
                      'bg-gray-500/10 text-gray-600 dark:text-gray-400',
                    item.series_status === 'Cancelled' &&
                      'bg-red-500/10 text-red-600 dark:text-red-400',
                  )}
                >
                  {item.series_status}
                </span>
              </div>
            )}

            {/* Seasons for mobile */}
            {hasSeasons && (
              <div className="mt-4">
                <SeasonEpisodeList
                  showId={item.id}
                  seasons={item.seasons!}
                  toggleEpisodeWatched={toggleEpisodeWatched}
                  toggleSeasonWatched={toggleSeasonWatched}
                  isEpisodeWatched={isEpisodeWatched}
                  isSeasonWatched={isSeasonWatched}
                />
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-2 mt-6 pt-4 border-t pb-2">
              {onSchedule && (
                <Button
                  variant={isScheduled ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={
                    isScheduled && onRemoveFromSchedule
                      ? onRemoveFromSchedule
                      : onSchedule
                  }
                  className="gap-1.5 flex-1 sm:flex-initial justify-center"
                >
                  <CalendarDays className="h-4 w-4" />
                  {isScheduled ? 'Remove from Schedule' : 'Add to Schedule'}
                </Button>
              )}
              {onMoveToFavourites && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onMoveToFavourites}
                  className="gap-1.5 flex-1 sm:flex-initial justify-center hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/30"
                >
                  <Heart className="h-4 w-4" />
                  Move to Favourites
                </Button>
              )}
              {onDelete && (
                <div className="flex-1 sm:flex-initial flex items-center gap-2">
                  {isDeleting ? (
                    <>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={onDelete}
                        className="gap-1.5 flex-1 justify-center"
                      >
                        Confirm
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsDeleting(false)}
                        className="flex-1 justify-center"
                      >
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsDeleting(true)}
                      className="gap-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 flex-1 justify-center"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Desktop Layout - side by side */}
        <div className="hidden sm:flex items-start">
          {/* Left: Poster - smaller for natural look */}
          {item.image_url && (
            <div className="shrink-0 p-6 flex items-start bg-secondary/5">
              <img
                src={item.image_url}
                alt={item.title}
                className="w-40 h-auto rounded-lg shadow-lg"
              />
            </div>
          )}

          {/* Middle: Info */}
          <div
            className={cn(
              'flex-1 p-6 min-w-0 flex flex-col',
              hasSeasons && 'border-r',
            )}
          >
            <DialogHeader className="text-left">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <DialogTitle className="font-serif text-xl font-medium">
                    {item.link ? (
                      <a
                        href={item.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-primary transition-colors inline-flex items-center gap-2"
                      >
                        {item.title}
                        <ExternalLink className="w-4 h-4 opacity-60" />
                      </a>
                    ) : (
                      item.title
                    )}
                  </DialogTitle>
                  <div className="text-sm text-muted-foreground mt-1 flex flex-wrap items-center gap-2">
                    <span className="uppercase tracking-wider text-xs font-medium">
                      {isTVShow ? 'TV Show' : 'Movie'}
                    </span>
                    {item.year && <span>• {item.year}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-3 mr-6">
                  {onSchedule && (
                    <Button
                      variant={isScheduled ? 'secondary' : 'ghost'}
                      size="icon"
                      onClick={
                        isScheduled && onRemoveFromSchedule
                          ? onRemoveFromSchedule
                          : onSchedule
                      }
                      className={cn(
                        'h-8 w-8 flex-shrink-0',
                        isScheduled
                          ? 'text-foreground'
                          : 'text-muted-foreground',
                      )}
                      title={
                        isScheduled ? 'Remove from schedule' : 'Add to schedule'
                      }
                    >
                      <CalendarDays className="h-4 w-4" />
                    </Button>
                  )}
                  {onMoveToFavourites && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={onMoveToFavourites}
                      className="h-8 w-8 flex-shrink-0 text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
                      title="Move to Favourites"
                    >
                      <Heart className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </DialogHeader>

            {/* Genre pills */}
            {item.genres && item.genres.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {item.genres.map((genre, idx) => (
                  <span
                    key={idx}
                    className="text-xs px-2 py-0.5 rounded-full bg-secondary/50"
                  >
                    {genre}
                  </span>
                ))}
              </div>
            )}

            {/* Status and platform */}
            <div className="flex flex-wrap items-center gap-2 mt-3">
              {item.streaming_platform && (
                <span
                  className={cn(
                    'text-xs px-2 py-1 rounded font-medium',
                    getPlatformColor(item.streaming_platform),
                  )}
                >
                  {item.streaming_platform}
                </span>
              )}
              <div className="flex flex-col items-start gap-1">
                {status && (
                  <span
                    className={cn(
                      'text-xs px-2 py-1 rounded-full font-medium',
                      status === 'Watching' &&
                        'bg-orange-500/10 text-orange-600 dark:text-orange-400',
                      status === 'To Watch' && 'bg-primary/10 text-primary',
                      (status === 'Completed' || status === 'Watched') &&
                        'bg-green-500/10 text-green-600 dark:text-green-400',
                      status === 'Coming Soon' &&
                        'bg-purple-500/10 text-purple-600 dark:text-purple-400',
                      status.toLowerCase().includes('releases in') &&
                        'bg-amber-500/10 text-amber-600 dark:text-amber-400',
                      status === 'Released' &&
                        'bg-gray-500/10 text-gray-600 dark:text-gray-400',
                    )}
                  >
                    {status}
                  </span>
                )}
                {upcomingReleaseDate && status && (status.toLowerCase().includes('releases in') || status === 'Coming Soon') && (
                  <span className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {upcomingReleaseDate.toLocaleDateString([], {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      })}
                  </span>
                )}
              </div>
            </div>

            {/* Description */}
            {item.description && (
              <p className="text-sm text-muted-foreground mt-4">
                {item.description}
              </p>
            )}

            {/* Movie runtime */}
            {!isTVShow && item.runtime && (
              <div className="flex items-center gap-2 mt-4 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>{formatRuntime(item.runtime)}</span>
              </div>
            )}

            {/* TV Show series status */}
            {isTVShow && item.series_status && (
              <div className="mt-4">
                <span
                  className={cn(
                    'inline-flex items-center px-3 py-1 rounded-full text-xs font-medium',
                    item.series_status === 'Returning Series' &&
                      'bg-green-500/10 text-green-600 dark:text-green-400',
                    item.series_status === 'In Production' &&
                      'bg-blue-500/10 text-blue-600 dark:text-blue-400',
                    item.series_status === 'Ended' &&
                      'bg-gray-500/10 text-gray-600 dark:text-gray-400',
                    item.series_status === 'Cancelled' &&
                      'bg-red-500/10 text-red-600 dark:text-red-400',
                  )}
                >
                  {item.series_status}
                </span>
              </div>
            )}

            {/* Delete button - pushed to bottom */}
            {onDelete && (
              <div className="mt-auto pt-8 flex justify-end">
                {isDeleting ? (
                  <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-2 duration-200">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={onDelete}
                      className="gap-1.5"
                    >
                      Confirm Delete
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsDeleting(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsDeleting(true)}
                    className="gap-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Right: Seasons (TV Shows only) */}
          {hasSeasons && (
            <div className="w-72 shrink-0 p-4 overflow-y-auto max-h-[70vh] bg-muted/30">
              <h3 className="text-sm font-medium mb-3">Seasons & Episodes</h3>
              <SeasonEpisodeList
                showId={item.id}
                seasons={item.seasons!}
                toggleEpisodeWatched={toggleEpisodeWatched}
                toggleSeasonWatched={toggleSeasonWatched}
                isEpisodeWatched={isEpisodeWatched}
                isSeasonWatched={isSeasonWatched}
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
