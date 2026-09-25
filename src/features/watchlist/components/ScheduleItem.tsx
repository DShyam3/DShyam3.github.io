import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Tv, Film, Clock, Calendar, ArrowRightLeft, MoreHorizontal, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WatchlistItem, Season } from '@/features/watchlist/useWatchlist';
import { formatRuntime } from '@/features/watchlist/watchlist-utils';
import { WatchlistDetailDialog } from './WatchlistDetailDialog';
import { useDeleteConfirm } from '@/hooks/useDeleteConfirm';
import type { ScheduleItem as ScheduleEntry } from '@/features/watchlist/useSchedule';
import { SmartScheduleDialog, scheduleReleaseDate } from './SmartScheduleDialog';

interface ScheduleItemProps {
  scheduleItem: ScheduleEntry;
  item: WatchlistItem;
  removeFromSchedule?: (id: string) => void;
  updateScheduleDay?: (
    id: string,
    newDay:
      | 'Monday'
      | 'Tuesday'
      | 'Wednesday'
      | 'Thursday'
      | 'Friday'
      | 'Saturday'
      | 'Sunday',
  ) => void;
  onRemoveWatchlist?: (id: string) => void;
  toggleEpisodeWatched?: (
    showId: string,
    seasonNumber: number,
    episodeNumber: number,
  ) => void;
  isEpisodeWatched: (
    showId: string,
    seasonNumber: number,
    episodeNumber: number,
  ) => boolean;
  isSeasonWatched: (showId: string, season: Season) => boolean;
  getAutoStatus: (item: WatchlistItem) => string | undefined;
  addToSchedule?: (item: Omit<ScheduleEntry, 'id'>) => void;
  isInSchedule: (watchlistItemId: string) => boolean;
  onMoveToFavourites?: (item: WatchlistItem) => void;
}

export function ScheduleItem({
  scheduleItem,
  item,
  removeFromSchedule,
  updateScheduleDay,
  onRemoveWatchlist,
  toggleEpisodeWatched,
  isEpisodeWatched,
  isSeasonWatched,
  getAutoStatus,
  addToSchedule,
  isInSchedule,
  onMoveToFavourites,
}: ScheduleItemProps) {
  const [detailOpen, setDetailOpen] = useState(false);
  const { askDelete, deleteDialog } = useDeleteConfirm();
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [changeDayDialogOpen, setChangeDayDialogOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<
    'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday'
  >('Monday');
  const DAYS = [
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday',
  ] as const;

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

  const handleChangeDay = () => {
    if (updateScheduleDay && selectedDay !== scheduleItem.day) {
      updateScheduleDay(scheduleItem.id, selectedDay);
    }
    setChangeDayDialogOpen(false);
  };

  const openChangeDayDialog = () => {
    setSelectedDay(scheduleItem.day);
    setChangeDayDialogOpen(true);
  };

  return (
    <>
      <div
        className="schedule-card group relative bg-secondary/20 hover:bg-secondary/40 border border-transparent hover:border-border rounded-md overflow-hidden transition-[background-color,border-color] duration-200 cursor-pointer"
        onClick={() => setDetailOpen(true)}
      >
        <div className={cn('flex items-center p-1.5 gap-2', (updateScheduleDay || removeFromSchedule) && 'schedule-card-row')}>
          {item.image_url ? (
            <div className="h-10 w-8 flex-shrink-0 rounded overflow-hidden">
              <img
                src={item.image_url}
                alt={item.title}
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="h-10 w-8 flex-shrink-0 rounded bg-muted flex items-center justify-center">
              {item.category === 'TV Shows' ? (
                <Tv className="h-3 w-3 opacity-40" />
              ) : (
                <Film className="h-3 w-3 opacity-40" />
              )}
            </div>
          )}

          <div className="schedule-card-text min-w-0 flex-1">
            <p className="text-xs font-medium line-clamp-2 break-words leading-tight">
              {item.title}
            </p>
            {scheduleItem.mode === 'date' && scheduleItem.scheduledDate && (
              <p className="text-[10px] text-primary/80">{new Date(`${scheduleItem.scheduledDate}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
            )}
            <div className="flex items-center gap-1 mt-0.5">
              {item.category === 'TV Shows' ? (
                <Tv className="h-2.5 w-2.5 text-muted-foreground" />
              ) : (
                <Film className="h-2.5 w-2.5 text-muted-foreground" />
              )}
              {item.category === 'TV Shows' && getAutoStatus(item) && (
                <span className="text-xs text-muted-foreground opacity-70 truncate">
                  {getAutoStatus(item)}
                </span>
              )}
            </div>
          </div>

          {/* In the row rather than laid over the title. */}
          {(updateScheduleDay || removeFromSchedule) && (
            <div className="schedule-card-actions card-actions shrink-0" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={`Schedule actions for ${item.title}`}>
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                  {updateScheduleDay && (
                    <DropdownMenuItem onSelect={openChangeDayDialog}>
                      <ArrowRightLeft className="mr-2 h-4 w-4" />Change day
                    </DropdownMenuItem>
                  )}
                  {removeFromSchedule && (
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onSelect={() =>
                        askDelete({
                          name: item.title,
                          title: 'Remove from schedule',
                          confirmLabel: 'Remove',
                          description: `Remove "${item.title}" from your weekly schedule? The title stays on your watchlist.`,
                          onConfirm: () => removeFromSchedule(scheduleItem.id),
                        })
                      }
                    >
                      <Trash2 className="mr-2 h-4 w-4" />Remove from schedule
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
      </div>

      <SmartScheduleDialog
        open={scheduleDialogOpen}
        onOpenChange={setScheduleDialogOpen}
        title={item.title}
        releaseDate={scheduleReleaseDate(item)}
        defaultMode={item.category === 'TV Shows' ? 'weekly' : 'date'}
        onAdd={handleAddToSchedule}
      />

      <Dialog open={changeDayDialogOpen} onOpenChange={setChangeDayDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif">Change Schedule Day</DialogTitle>
            <DialogDescription className="sr-only">
              Choose a different day of the week for this item.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Move <span className="font-medium">{item.title}</span> to a different day
            </p>
            <div className="space-y-2">
              <Label>New day</Label>
              <Select
                value={selectedDay}
                onValueChange={(value) => setSelectedDay(value as typeof selectedDay)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAYS.map((day) => (
                    <SelectItem
                      key={day}
                      value={day}
                      disabled={day === scheduleItem.day}
                    >
                      {day} {day === scheduleItem.day && '(current)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setChangeDayDialogOpen(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleChangeDay}
                className="flex-1"
                disabled={selectedDay === scheduleItem.day}
              >
                Move to {selectedDay}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <WatchlistDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        item={item}
        status={getAutoStatus(item)}
        onDelete={
          onRemoveWatchlist
            ? () => {
                onRemoveWatchlist(item.id);
                setDetailOpen(false);
              }
            : undefined
        }
        onSchedule={
          addToSchedule
            ? () => {
                if (!isInSchedule(item.id)) {
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
                    removeFromSchedule(scheduleItem.id);
                    setDetailOpen(false);
                  },
                })
            : undefined
        }
        isScheduled={isInSchedule(item.id)}
        toggleEpisodeWatched={toggleEpisodeWatched}
        isEpisodeWatched={isEpisodeWatched}
        isSeasonWatched={isSeasonWatched}
        onMoveToFavourites={
          onMoveToFavourites
            ? () => {
                onMoveToFavourites(item);
                setDetailOpen(false);
              }
            : undefined
        }
      />

      {deleteDialog}
    </>
  );
}
