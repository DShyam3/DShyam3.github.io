import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Tv, Film, Bell, Calendar, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WatchlistItem, Season } from '@/hooks/useWatchlist';
import { CardDetailDialog, DetailSection } from '@/components/cards/CardDetailDialog';
import { SeasonEpisodeList } from './SeasonEpisodeList';
import { formatRuntime, getPlatformColor } from '@/lib/watchlist-utils';

interface WatchlistCardProps {
    item: WatchlistItem;
    onRemove?: (id: string) => void;
    getCategoryIcon: (cat: string) => JSX.Element | null;
    toggleEpisodeWatched: (showId: string, seasonNumber: number, episodeNumber: number) => void;
    isEpisodeWatched: (showId: string, seasonNumber: number, episodeNumber: number) => boolean;
    isSeasonWatched: (showId: string, season: Season) => boolean;
    getAutoStatus: (item: WatchlistItem) => string | undefined;
    addToSchedule: (item: Omit<any, 'id'>) => void;
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
        addToSchedule({
            watchlistItemId: item.id,
            day: selectedDay,
            title: item.title,
            category: item.category,
            image_url: item.image_url,
        });
        setScheduleDialogOpen(false);
    };

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

                    <div className="absolute top-2 left-2 px-2 py-1 rounded bg-background/80 backdrop-blur-sm text-[10px] font-medium flex items-center gap-1">
                        {getCategoryIcon(item.category)}
                        {item.category === 'TV Shows' ? 'TV' : 'Movie'}
                    </div>

                    {item.streaming_platform && (
                        <div className={cn(
                            "absolute top-2 right-2 px-2 py-1 rounded backdrop-blur-sm text-[10px] font-medium",
                            getPlatformColor(item.streaming_platform)
                        )}>
                            {item.streaming_platform}
                        </div>
                    )}
                </div>

                <div className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="min-w-0">
                            <h3 className="font-serif text-base leading-tight line-clamp-1">{item.title}</h3>
                            {item.year && (
                                <span className="text-xs text-muted-foreground">{item.year}</span>
                            )}
                        </div>
                        {onRemove && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="opacity-0 group-hover:opacity-100 h-7 w-7 flex-shrink-0"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onRemove(item.id);
                                }}
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                        )}
                    </div>

                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                        {item.category === 'TV Shows' && getAutoStatus(item) && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                                {getAutoStatus(item)}
                            </span>
                        )}
                    </div>

                    <div className="flex items-center justify-end mt-auto">
                        <div className="flex items-center gap-1">
                            <Button
                                variant="ghost"
                                size="icon"
                                className={cn(
                                    "h-8 w-8",
                                    isInSchedule(item.id) ? "text-primary opacity-100" : "opacity-0 group-hover:opacity-100"
                                )}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setScheduleDialogOpen(true);
                                }}
                            >
                                <Calendar className="h-4 w-4" />
                            </Button>
                        </div>
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

            <CardDetailDialog
                open={detailOpen}
                onOpenChange={setDetailOpen}
                title={item.title}
                subtitle={
                    <div className="flex flex-wrap items-center gap-2">
                        {item.year && <span>{item.year}</span>}
                        {item.genres && item.genres.length > 0 && (
                            <>
                                {item.year && <span>•</span>}
                                {item.genres.map((genre, idx) => (
                                    <span
                                        key={idx}
                                        className="text-xs px-2 py-0.5 rounded-full bg-secondary/50"
                                    >
                                        {genre}
                                    </span>
                                ))}
                            </>
                        )}
                    </div>
                }
                imageUrl={item.image_url}
                link={item.link}
                badge={item.category === 'TV Shows' ? getAutoStatus(item) : undefined}
                onDelete={onRemove ? () => {
                    onRemove(item.id);
                    setDetailOpen(false);
                } : undefined}
                onSchedule={() => {
                    if (!isInSchedule(item.id)) {
                        setScheduleDialogOpen(true);
                    }
                }}
                isScheduled={isInSchedule(item.id)}
            >
                {item.description && (
                    <DetailSection label="Description">
                        <p className="whitespace-pre-wrap">{item.description}</p>
                    </DetailSection>
                )}

                {item.category === 'TV Shows' && item.series_status && (
                    <DetailSection label="Series Status">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className={cn(
                                "inline-flex items-center px-3 py-1 rounded-full text-xs font-medium",
                                item.series_status === 'Returning Series' && "bg-green-500/10 text-green-600 dark:text-green-400",
                                item.series_status === 'In Production' && "bg-blue-500/10 text-blue-600 dark:text-blue-400",
                                item.series_status === 'Ended' && "bg-gray-500/10 text-gray-600 dark:text-gray-400",
                                item.series_status === 'Cancelled' && "bg-red-500/10 text-red-600 dark:text-red-400"
                            )}>
                                {item.series_status}
                            </span>
                        </div>
                    </DetailSection>
                )}

                {item.category === 'Movies' && item.runtime && (
                    <DetailSection label="Runtime">
                        <div className="flex items-center gap-2 text-sm">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <span>{formatRuntime(item.runtime)}</span>
                        </div>
                    </DetailSection>
                )}

                {item.category === 'TV Shows' && item.seasons && item.seasons.length > 0 && (
                    <SeasonEpisodeList
                        showId={item.id}
                        seasons={item.seasons}
                        toggleEpisodeWatched={toggleEpisodeWatched}
                        isEpisodeWatched={isEpisodeWatched}
                        isSeasonWatched={isSeasonWatched}
                    />
                )}
            </CardDetailDialog>
        </>
    );
});
