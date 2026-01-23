import { WatchlistItem, Season } from '@/hooks/useWatchlist';
import { ScheduleItem } from './ScheduleItem';

interface WeeklyScheduleProps {
    DAYS: readonly ('Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday')[];
    getScheduleForDay: (day: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday') => any[];
    removeFromSchedule?: (id: string) => void;
    updateScheduleDay?: (id: string, newDay: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday') => void;
    watchlist: WatchlistItem[];
    toggleEpisodeWatched?: (showId: string, seasonNumber: number, episodeNumber: number) => void;
    isEpisodeWatched: (showId: string, seasonNumber: number, episodeNumber: number) => boolean;
    isSeasonWatched: (showId: string, season: Season) => boolean;
    getAutoStatus: (item: WatchlistItem) => string | undefined;
    onRemoveWatchlist?: (id: string) => void;
    addToSchedule?: (item: Omit<any, 'id'>) => void;
    isInSchedule: (watchlistItemId: string) => boolean;
}

export function WeeklySchedule({
    DAYS,
    getScheduleForDay,
    removeFromSchedule,
    updateScheduleDay,
    watchlist,
    toggleEpisodeWatched,
    isEpisodeWatched,
    isSeasonWatched,
    getAutoStatus,
    onRemoveWatchlist,
    addToSchedule,
    isInSchedule,
}: WeeklyScheduleProps) {
    return (
        <div className="px-4 md:px-0 py-6">
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-7 gap-4">
                {DAYS.map((day) => {
                    const daySchedule = getScheduleForDay(day);

                    return (
                        <div key={day} className="space-y-3 min-w-0">
                            <div className="bg-background/95 backdrop-blur-sm pb-2 border-b md:sticky md:top-0 md:z-20">
                                <h3 className="font-medium text-sm">{day}</h3>
                                <p className="text-xs text-muted-foreground">{daySchedule.length} items</p>
                            </div>

                            <div className="space-y-2">
                                {daySchedule.length === 0 ? (
                                    <p className="text-xs text-muted-foreground text-center py-8">
                                        No items scheduled
                                    </p>
                                ) : (
                                    daySchedule.map((scheduleItem) => {
                                        const watchlistItem = watchlist.find(w => w.id === scheduleItem.watchlistItemId);
                                        if (!watchlistItem) return null;

                                        return (
                                            <ScheduleItem
                                                key={scheduleItem.id}
                                                scheduleItem={scheduleItem}
                                                item={watchlistItem}
                                                removeFromSchedule={removeFromSchedule}
                                                updateScheduleDay={updateScheduleDay}
                                                toggleEpisodeWatched={toggleEpisodeWatched}
                                                isEpisodeWatched={isEpisodeWatched}
                                                isSeasonWatched={isSeasonWatched}
                                                getAutoStatus={getAutoStatus}
                                                onRemoveWatchlist={onRemoveWatchlist}
                                                addToSchedule={addToSchedule}
                                                isInSchedule={isInSchedule}
                                            />
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
