import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WatchlistItem, Season } from '@/hooks/useWatchlist';
import { WatchlistDetailDialog } from './WatchlistDetailDialog';
import { getPlatformColor } from '@/lib/watchlist-utils';

interface WatchlistCardProps {
    item: WatchlistItem;
    onRemove?: (id: string) => void;
    getCategoryIcon: (cat: string) => JSX.Element | null;
    toggleEpisodeWatched?: (showId: string, seasonNumber: number, episodeNumber: number) => void;
    isEpisodeWatched: (showId: string, seasonNumber: number, episodeNumber: number) => boolean;
    isSeasonWatched: (showId: string, season: Season) => boolean;
    getAutoStatus: (item: WatchlistItem) => string | undefined;
    addToSchedule?: (item: Omit<any, 'id'>) => void;
    isInSchedule: (watchlistItemId: string) => boolean;
}

export const WatchlistCard = React.memo(function WatchlistCard({
    item,
    onRemove,
    getCategoryIcon,
    toggleEpisodeWatched,
    isEpisodeWatched,
    isSeasonWatched,
    getAutoStatus,
    addToSchedule,
    isInSchedule,
}: WatchlistCardProps) {
    const [detailOpen, setDetailOpen] = useState(false);
    const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
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

    const status = getAutoStatus(item);

    return (
        <>
            <div
                className="item-card group cursor-pointer"
                onClick={() => setDetailOpen(true)}
            >
                <div className="aspect-[2/3] bg-muted relative overflow-hidden">
                    {item.image_url ? (
                        <img
                            src={item.image_url}
                            alt={item.title}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                            loading="lazy"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center bg-secondary/30">
                            {getCategoryIcon(item.category)}
                        </div>
                    )}

                    {/* Action buttons - top right on hover */}
                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                        {addToSchedule && (
                            <Button
                                variant="secondary"
                                size="icon"
                                className={cn(
                                    "h-7 w-7 bg-background/80 backdrop-blur-sm",
                                    isInSchedule(item.id) && "text-primary"
                                )}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setScheduleDialogOpen(true);
                                }}
                            >
                                <Calendar className="h-3.5 w-3.5" />
                            </Button>
                        )}
                        {onRemove && (
                            <Button
                                variant="secondary"
                                size="icon"
                                className="h-7 w-7 bg-background/80 backdrop-blur-sm"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onRemove(item.id);
                                }}
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                        )}
                    </div>

                    {/* Schedule indicator - visible when scheduled */}
                    {isInSchedule(item.id) && (
                        <div className="absolute top-2 left-2">
                            <Calendar className="h-4 w-4 text-primary drop-shadow-md" />
                        </div>
                    )}
                </div>

                <div className="p-2">
                    {/* Title */}
                    <h3 className="font-serif text-sm font-medium leading-tight line-clamp-1">{item.title}</h3>

                    {/* Year and first genre on same line */}
                    <p className="text-xs text-muted-foreground mt-0.5">
                        {item.year}
                        {item.year && item.genres && item.genres.length > 0 && ' · '}
                        {item.genres?.[0]}
                    </p>

                    {/* Platform and Status badges - wrap on mobile, single line on larger screens */}
                    <div className="flex items-center gap-1 mt-2 flex-wrap sm:flex-nowrap sm:overflow-hidden">
                        {item.streaming_platform && (
                            <span className={cn(
                                "text-[10px] px-1.5 py-0.5 rounded font-medium whitespace-nowrap",
                                getPlatformColor(item.streaming_platform)
                            )}>
                                {item.streaming_platform}
                            </span>
                        )}
                        {status && (
                            <span className={cn(
                                "text-[10px] px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap",
                                status === 'Watching' && "bg-orange-500/10 text-orange-600 dark:text-orange-400",
                                status === 'To Watch' && "bg-primary/10 text-primary",
                                (status === 'Completed' || status === 'Watched') && "bg-green-500/10 text-green-600 dark:text-green-400",
                                status === 'Coming Soon' && "bg-purple-500/10 text-purple-600 dark:text-purple-400",
                                status.toLowerCase().includes('releases in') && "bg-amber-500/10 text-amber-600 dark:text-amber-400",
                                status === 'Released' && "bg-gray-500/10 text-gray-600 dark:text-gray-400"
                            )}>
                                {status}
                            </span>
                        )}
                    </div>
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

            <WatchlistDetailDialog
                open={detailOpen}
                onOpenChange={setDetailOpen}
                item={item}
                status={status}
                onDelete={onRemove ? () => {
                    onRemove(item.id);
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
});
