import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Season } from '@/hooks/useWatchlist';
import { DetailSection } from '@/components/cards/CardDetailDialog';

interface SeasonEpisodeListProps {
    seasons: Season[];
    showId: string;
    toggleEpisodeWatched: (showId: string, seasonNumber: number, episodeNumber: number) => void;
    isEpisodeWatched: (showId: string, seasonNumber: number, episodeNumber: number) => boolean;
    isSeasonWatched: (showId: string, season: Season) => boolean;
}

export function SeasonEpisodeList({
    seasons,
    showId,
    toggleEpisodeWatched,
    isEpisodeWatched,
    isSeasonWatched,
}: SeasonEpisodeListProps) {
    const [selectedSeason, setSelectedSeason] = useState(seasons[0].season_number);

    const currentSeason = seasons.find(s => s.season_number === selectedSeason);

    const formatDate = (dateString?: string) => {
        if (!dateString) return 'TBA';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    const formatRuntime = (minutes?: number) => {
        if (!minutes) return '';
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        if (hours > 0) {
            return `${hours}h ${mins}m`;
        }
        return `${mins}m`;
    };

    const getWatchedCount = (season: Season) => {
        return season.episodes.filter(ep =>
            isEpisodeWatched(showId, season.season_number, ep.episode_number)
        ).length;
    };

    return (
        <DetailSection label="Seasons & Episodes">
            <div className="flex gap-2 mb-4 flex-wrap">
                {seasons.map((season) => {
                    const seasonWatched = isSeasonWatched(showId, season);
                    const watchedCount = getWatchedCount(season);

                    return (
                        <Button
                            key={season.season_number}
                            variant={selectedSeason === season.season_number ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setSelectedSeason(season.season_number)}
                            className="text-xs relative"
                        >
                            Season {season.season_number}
                            {seasonWatched && (
                                <span className="ml-1.5 text-xs">✓</span>
                            )}
                            {!seasonWatched && watchedCount > 0 && (
                                <span className="ml-1.5 text-xs opacity-60">
                                    {watchedCount}/{season.episodes.length}
                                </span>
                            )}
                        </Button>
                    );
                })}
            </div>

            {currentSeason && (
                <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground pb-2 border-b">
                        <Calendar className="h-4 w-4" />
                        <span>Released: {formatDate(currentSeason.release_date)}</span>
                        <span className="ml-auto">{currentSeason.episodes.length} episodes</span>
                    </div>

                    <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
                        {currentSeason.episodes.map((episode) => {
                            const watched = isEpisodeWatched(showId, currentSeason.season_number, episode.episode_number);

                            return (
                                <div
                                    key={episode.episode_number}
                                    onClick={() => toggleEpisodeWatched(showId, currentSeason.season_number, episode.episode_number)}
                                    className={cn(
                                        "p-3 rounded-lg transition-all cursor-pointer",
                                        watched
                                            ? "bg-secondary/60 hover:bg-secondary/70 opacity-60"
                                            : "bg-secondary/30 hover:bg-secondary/50"
                                    )}
                                >
                                    <div className="flex items-start justify-between gap-2 mb-1">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-medium text-muted-foreground">
                                                    EP {episode.episode_number}
                                                </span>
                                                <h4 className={cn(
                                                    "text-sm font-medium",
                                                    watched && "line-through opacity-70"
                                                )}>
                                                    {episode.title}
                                                </h4>
                                                {watched && (
                                                    <span className="text-xs">✓</span>
                                                )}
                                            </div>
                                        </div>
                                        {episode.runtime && (
                                            <div className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
                                                <Clock className="h-3 w-3" />
                                                {formatRuntime(episode.runtime)}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                        <Calendar className="h-3 w-3" />
                                        {formatDate(episode.release_date)}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </DetailSection>
    );
}
