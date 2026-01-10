import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Tv, Film, X, Clock, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WatchlistItem, Season } from '@/hooks/useWatchlist';
import { CardDetailDialog, DetailSection } from '@/components/cards/CardDetailDialog';
import { SeasonEpisodeList } from './SeasonEpisodeList';
import { formatRuntime, getPlatformColor } from '@/lib/watchlist-utils';

interface ScheduleItemProps {
    scheduleItem: any;
    item: WatchlistItem;
    removeFromSchedule: (id: string) => void;
    onRemoveWatchlist: (id: string) => void;
    toggleEpisodeWatched: (showId: string, seasonNumber: number, episodeNumber: number) => void;
    isEpisodeWatched: (showId: string, seasonNumber: number, episodeNumber: number) => boolean;
    isSeasonWatched: (showId: string, season: Season) => boolean;
    getAutoStatus: (item: WatchlistItem) => string | undefined;
    addToSchedule: (item: Omit<any, 'id'>) => void;
    isInSchedule: (watchlistItemId: string) => boolean;
}

export function ScheduleItem({
    scheduleItem,
    item,
    removeFromSchedule,
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

                <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-1/2 -translate-y-1/2 right-1 h-5 w-5 opacity-0 group-hover:opacity-100 bg-background/90 backdrop-blur-sm z-10 transition-opacity"
                    onClick={(e) => {
                        e.stopPropagation();
                        removeFromSchedule(scheduleItem.id);
                    }}
                >
                    <X className="h-2.5 w-2.5" />
                </Button>
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
                onDelete={() => {
                    onRemoveWatchlist(item.id);
                    setDetailOpen(false);
                }}
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
                            {item.streaming_platform && (
                                <span className={cn(
                                    "inline-flex items-center px-3 py-1 rounded-full text-xs font-medium",
                                    getPlatformColor(item.streaming_platform)
                                )}>
                                    {item.streaming_platform}
                                </span>
                            )}
                        </div>
                    </DetailSection>
                )}

                {item.category === 'Movies' && item.runtime && (
                    <DetailSection label="Runtime">
                        <div className="flex items-center gap-3 flex-wrap">
                            <div className="flex items-center gap-2 text-sm">
                                <Clock className="h-4 w-4 text-muted-foreground" />
                                <span>{formatRuntime(item.runtime)}</span>
                            </div>
                            {item.streaming_platform && (
                                <span className={cn(
                                    "inline-flex items-center px-3 py-1 rounded-full text-xs font-medium",
                                    getPlatformColor(item.streaming_platform)
                                )}>
                                    {item.streaming_platform}
                                </span>
                            )}
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
}
