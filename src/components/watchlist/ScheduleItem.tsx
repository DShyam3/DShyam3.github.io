import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Tv, Film, X, Clock, Calendar, ArrowRightLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WatchlistItem, Season } from '@/hooks/useWatchlist';
import { formatRuntime, getPlatformColor } from '@/lib/watchlist-utils';
import { WatchlistDetailDialog } from './WatchlistDetailDialog';

interface ScheduleItemProps {
    scheduleItem: any;
    item: WatchlistItem;
    removeFromSchedule?: (id: string) => void;
    updateScheduleDay?: (id: string, newDay: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday') => void;
    onRemoveWatchlist?: (id: string) => void;
    toggleEpisodeWatched?: (showId: string, seasonNumber: number, episodeNumber: number) => void;
    isEpisodeWatched: (showId: string, seasonNumber: number, episodeNumber: number) => boolean;
    isSeasonWatched: (showId: string, season: Season) => boolean;
    getAutoStatus: (item: WatchlistItem) => string | undefined;
    addToSchedule?: (item: Omit<any, 'id'>) => void;
    isInSchedule: (watchlistItemId: string) => boolean;
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
}: ScheduleItemProps) {
    const [detailOpen, setDetailOpen] = useState(false);
    const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
    const [changeDayDialogOpen, setChangeDayDialogOpen] = useState(false);
    const [selectedDay, setSelectedDay] = useState<'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday'>('Monday');
    const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;

    const handleAddToSchedule = () => {
        if (addToSchedule) {
            addToSchedule({
                watchlistItemId: item.id,
                day: selectedDay,
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
                className="group relative bg-secondary/20 hover:bg-secondary/40 border border-transparent hover:border-border rounded-md overflow-hidden transition-all cursor-pointer"
                onClick={() => setDetailOpen(true)}
            >
                <div className="flex items-center p-1.5 gap-2">
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
                            {item.category === 'TV Shows' ? <Tv className="h-3 w-3 opacity-40" /> : <Film className="h-3 w-3 opacity-40" />}
                        </div>
                    )}

                    <div className="min-w-0 flex-1 pr-4">
                        <p className="text-[11px] font-medium truncate leading-tight">{item.title}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                            {item.category === 'TV Shows' ? (
                                <Tv className="h-2.5 w-2.5 text-muted-foreground" />
                            ) : (
                                <Film className="h-2.5 w-2.5 text-muted-foreground" />
                            )}
                            {item.category === 'TV Shows' && getAutoStatus(item) && (
                                <span className="text-[9px] text-muted-foreground opacity-70 truncate">
                                    {getAutoStatus(item)}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="absolute top-1/2 -translate-y-1/2 right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    {updateScheduleDay && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 bg-background/90 backdrop-blur-sm"
                            onClick={(e) => {
                                e.stopPropagation();
                                openChangeDayDialog();
                            }}
                        >
                            <ArrowRightLeft className="h-2.5 w-2.5" />
                        </Button>
                    )}
                    {removeFromSchedule && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 bg-background/90 backdrop-blur-sm"
                            onClick={(e) => {
                                e.stopPropagation();
                                removeFromSchedule(scheduleItem.id);
                            }}
                        >
                            <X className="h-2.5 w-2.5" />
                        </Button>
                    )}
                </div>
            </div>

            <Dialog open={scheduleDialogOpen} onOpenChange={setScheduleDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="font-serif">Add to Weekly Schedule</DialogTitle>
                        <DialogDescription className="sr-only">Choose a day of the week to schedule watching this title.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                            Select which day you want to watch <span className="font-medium">{item.title}</span>
                        </p>
                        <div className="space-y-2">
                            <Label>Day of the week</Label>
                            <Select value={selectedDay} onValueChange={(value) => setSelectedDay(value as typeof selectedDay)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {DAYS.map((day) => (
                                        <SelectItem key={day} value={day}>
                                            {day}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => setScheduleDialogOpen(false)} className="flex-1">
                                Cancel
                            </Button>
                            <Button onClick={handleAddToSchedule} className="flex-1">
                                Add to {selectedDay}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={changeDayDialogOpen} onOpenChange={setChangeDayDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="font-serif">Change Schedule Day</DialogTitle>
                        <DialogDescription className="sr-only">Choose a different day of the week for this item.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                            Move <span className="font-medium">{item.title}</span> to a different day
                        </p>
                        <div className="space-y-2">
                            <Label>New day</Label>
                            <Select value={selectedDay} onValueChange={(value) => setSelectedDay(value as typeof selectedDay)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {DAYS.map((day) => (
                                        <SelectItem key={day} value={day} disabled={day === scheduleItem.day}>
                                            {day} {day === scheduleItem.day && '(current)'}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => setChangeDayDialogOpen(false)} className="flex-1">
                                Cancel
                            </Button>
                            <Button onClick={handleChangeDay} className="flex-1" disabled={selectedDay === scheduleItem.day}>
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
                onDelete={onRemoveWatchlist ? () => {
                    onRemoveWatchlist(item.id);
                    setDetailOpen(false);
                } : undefined}
                onSchedule={addToSchedule ? () => {
                    if (!isInSchedule(item.id)) {
                        setScheduleDialogOpen(true);
                    }
                } : undefined}
                isScheduled={isInSchedule(item.id)}
                toggleEpisodeWatched={toggleEpisodeWatched}
                isEpisodeWatched={isEpisodeWatched}
                isSeasonWatched={isSeasonWatched}
            />
        </>
    );
}
