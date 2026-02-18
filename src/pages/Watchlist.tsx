import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useWatchlist, WatchlistItem } from '@/hooks/useWatchlist';
import { useSchedule } from '@/hooks/useSchedule';
import { useTMDB } from '@/hooks/useTMDB';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Bell, CalendarDays, X, Search, RefreshCcw, ArrowUpDown, ArrowDownAZ, Tv, Film, Clock, Eye, History, CheckCircle, XCircle, Timer } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Filter } from 'lucide-react';
import { WatchlistCard } from '@/components/watchlist/WatchlistCard';
import { WeeklySchedule } from '@/components/watchlist/WeeklySchedule';
import { formatRuntime, getPlatformColor } from '@/lib/watchlist-utils';

const CATEGORIES = ['TV Shows', 'Movies', 'Currently Watching', 'Upcoming'] as const;

const ALL_PLATFORMS = [
    'Netflix',
    'Prime Video',
    'Disney+',
    'Apple TV+',
    'BBC iPlayer',
    'Online'
];

const ALL_GENRES = [
    'Action',
    'Adventure',
    'Animation',
    'Biography',
    'Comedy',
    'Crime',
    'Documentary',
    'Drama',
    'Family',
    'Fantasy',
    'History',
    'Horror',
    'Music',
    'Mystery',
    'Romance',
    'Sci-Fi',
    'Sport',
    'Thriller',
    'War',
    'Western'
];

const Watchlist = () => {
    const { isAdmin } = useAuth();
    const { watchlist, addWatchlistItem, removeWatchlistItem, loading, syncing, syncProgress, lastSyncTime, lastAutoSyncTime, nextAutoSyncTime, syncLog, autoSyncEnabled, syncWatchlist, toggleEpisodeWatched, isEpisodeWatched, isSeasonWatched, getAutoStatus } = useWatchlist();
    const { addToSchedule, removeFromSchedule, updateScheduleDay, getScheduleForDay, isInSchedule, DAYS } = useSchedule();
    const [open, setOpen] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState<typeof CATEGORIES[number]>('TV Shows');
    const [searchQuery, setSearchQuery] = useState('');
    const [hideCompleted, setHideCompleted] = useState(false);
    const [showSchedule, setShowSchedule] = useState(false);
    const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
    const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
    const [sortOrder, setSortOrder] = useState<'alphabetical' | 'recent'>('alphabetical');
    const [title, setTitle] = useState('');
    const [addedItems, setAddedItems] = useState<Set<number>>(new Set());
    const [showSyncLog, setShowSyncLog] = useState(false);

    const { results: searchResults, search: tmdbSearch, getPosterUrl, getMovieDetails, loading: searchLoading } = useTMDB();

    // Reset form when dialog closes
    useEffect(() => {
        if (!open) {
            setTitle('');
            setAddedItems(new Set());
        }
    }, [open]);

    useEffect(() => {
        if (selectedCategory === 'Upcoming' || selectedCategory === 'Currently Watching') return;

        const timer = setTimeout(() => {
            if (title.length >= 2) {
                const yearMatch = title.match(/\((\d{4})\)\s*$/);
                const year = yearMatch ? parseInt(yearMatch[1]) : undefined;
                const cleanTitle = title.replace(/\s*\(\d{4}\)\s*$/, '').trim();
                tmdbSearch(cleanTitle, selectedCategory as 'TV Shows' | 'Movies', year);
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [title, selectedCategory, tmdbSearch]);



    const categoryItems = useMemo(() => {
        if (selectedCategory === 'Upcoming') {
            const now = new Date();
            return watchlist.filter(item => {
                if (item.release_date && new Date(item.release_date) > now) return true;
                if (item.category === 'TV Shows' && item.seasons) {
                    return item.seasons.some(s => s.release_date && new Date(s.release_date) > now);
                }
                return false;
            }).sort((a, b) => {
                const getEarliestDate = (item: WatchlistItem) => {
                    const dates = [];
                    if (item.release_date) dates.push(new Date(item.release_date));
                    if (item.seasons) {
                        item.seasons.forEach(s => {
                            if (s.release_date) dates.push(new Date(s.release_date));
                        });
                    }
                    const futureDates = dates.filter(d => d > new Date());
                    return futureDates.length > 0 ? Math.min(...futureDates.map(d => d.getTime())) : Infinity;
                };
                return getEarliestDate(a) - getEarliestDate(b);
            });
        }
        if (selectedCategory === 'Currently Watching') {
            return watchlist.filter((item) => {
                if (item.category !== 'TV Shows') return false;
                const autoStatus = getAutoStatus(item);
                // Only show shows that are actively being watched (started a season but not finished it)
                return autoStatus === 'Watching';
            });
        }
        return watchlist.filter((item) => item.category === selectedCategory);
    }, [watchlist, selectedCategory, getAutoStatus]);

    const platformCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        ALL_PLATFORMS.forEach(p => {
            counts[p] = categoryItems.filter(item => item.streaming_platform === p).length;
        });
        return counts;
    }, [categoryItems]);

    const genreCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        ALL_GENRES.forEach(g => {
            counts[g] = categoryItems.filter(item => item.genres?.includes(g)).length;
        });
        return counts;
    }, [categoryItems]);

    const getPlatformCount = (platform: string) => platformCounts[platform] || 0;
    const getGenreCount = (genre: string) => genreCounts[genre] || 0;

    const filteredWatchlist = useMemo(() => {
        let result = categoryItems;
        if (selectedPlatform) result = result.filter(item => item.streaming_platform === selectedPlatform);
        if (selectedGenre) result = result.filter(item => item.genres?.includes(selectedGenre));
        const normalizedQuery = searchQuery.trim().toLowerCase();
        if (normalizedQuery) result = result.filter((item) => item.title.toLowerCase().includes(normalizedQuery));
        if (selectedCategory === 'TV Shows' && hideCompleted) {
            result = result.filter((item) => {
                const autoStatus = getAutoStatus(item);
                return autoStatus !== 'Completed' && autoStatus !== 'Watched';
            });
        }
        if (selectedCategory !== 'Upcoming') {
            result = [...result].sort((a, b) => {
                if (sortOrder === 'alphabetical') return a.title.localeCompare(b.title);
                if (sortOrder === 'recent') {
                    if (selectedCategory === 'TV Shows') {
                        const getLatestSeasonDate = (item: WatchlistItem) => {
                            if (!item.seasons || item.seasons.length === 0) return item.release_date ? new Date(item.release_date).getTime() : 0;
                            const seasonDates = item.seasons.filter(s => s.release_date).map(s => new Date(s.release_date!).getTime());
                            return Math.max(...seasonDates, 0);
                        };
                        return getLatestSeasonDate(b) - getLatestSeasonDate(a);
                    }
                    const dateA = a.release_date ? new Date(a.release_date).getTime() : 0;
                    const dateB = b.release_date ? new Date(b.release_date).getTime() : 0;
                    return dateB - dateA;
                }
                return 0;
            });
        }
        return result;
    }, [categoryItems, selectedPlatform, selectedGenre, searchQuery, selectedCategory, hideCompleted, sortOrder, getAutoStatus]);

    const getCategoryIcon = useCallback((cat: string) => {
        switch (cat) {
            case 'TV Shows': return <Tv className="h-4 w-4" />;
            case 'Movies': return <Film className="h-4 w-4" />;
            case 'Currently Watching': return <Eye className="h-4 w-4" />;
            case 'Upcoming': return <Bell className="h-4 w-4" />;
            default: return null;
        }
    }, []);

    const getCategoryCount = useMemo(() => (cat: typeof CATEGORIES[number]) => {
        if (cat === 'Upcoming') {
            const now = new Date();
            return watchlist.filter(item => {
                if (item.release_date && new Date(item.release_date) > now) return true;
                if (item.category === 'TV Shows' && item.seasons) return item.seasons.some(s => s.release_date && new Date(s.release_date) > now);
                return false;
            }).length;
        }
        if (cat === 'Currently Watching') {
            return watchlist.filter((item) => {
                if (item.category !== 'TV Shows') return false;
                const autoStatus = getAutoStatus(item);
                return autoStatus === 'Watching';
            }).length;
        }
        return watchlist.filter((item) => item.category === cat).length;
    }, [watchlist, getAutoStatus]);

    return (
        <div className="min-h-screen bg-background">
            <div className="wide-container">
                <Header title="Watchlist" subtitle="What I'm watching & tracking" />

                <div className="px-4 md:px-0 pt-6 space-y-4">
                    <div className="flex flex-wrap items-center gap-2 justify-between">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 w-full sm:w-auto">
                            {CATEGORIES.map((cat) => (
                                <Button
                                    key={cat}
                                    variant={selectedCategory === cat ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => {
                                        setSelectedCategory(cat);
                                        setShowSchedule(false);
                                        setSelectedPlatform(null);
                                        setSelectedGenre(null);
                                    }}
                                    className="gap-1 px-2 text-[11px] sm:text-xs h-8 sm:h-9"
                                >
                                    <span className="shrink-0">{getCategoryIcon(cat)}</span>
                                    <span className="truncate">{cat}</span>
                                    <span className="text-[10px] opacity-70">({getCategoryCount(cat)})</span>
                                </Button>
                            ))}
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                            {isAdmin && (
                                <div className="flex flex-col gap-1">
                                    <div className="flex items-center gap-1.5">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => syncWatchlist('manual')}
                                            disabled={syncing}
                                            className="gap-1.5 relative overflow-hidden h-8 sm:h-9"
                                        >
                                            {syncing && (
                                                <div
                                                    className="absolute left-0 top-0 bottom-0 bg-primary/20 transition-all duration-300 ease-out"
                                                    style={{ width: `${syncProgress}%` }}
                                                />
                                            )}
                                            <span className="relative z-10 flex items-center gap-1.5">
                                                <RefreshCcw className={cn("h-4 w-4", syncing && "animate-spin")} />
                                                {syncing ? `${syncProgress}%` : 'Sync Updates'}
                                            </span>
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setShowSyncLog(!showSyncLog)}
                                            className="h-8 sm:h-9 px-2"
                                            title="View sync history"
                                        >
                                            <History className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    <div className="flex flex-col items-center gap-0.5">
                                        {lastSyncTime && (
                                            <span className="text-[10px] text-muted-foreground">
                                                Last synced: {(() => {
                                                    const now = new Date();
                                                    const syncDate = new Date(lastSyncTime);
                                                    const diffMs = now.getTime() - syncDate.getTime();
                                                    const diffMins = Math.floor(diffMs / 60000);
                                                    const diffHours = Math.floor(diffMs / 3600000);
                                                    const diffDays = Math.floor(diffMs / 86400000);

                                                    if (diffMins < 1) return 'just now';
                                                    if (diffMins < 60) return `${diffMins}m ago`;
                                                    if (diffHours < 24) return `${diffHours}h ago`;
                                                    if (diffDays < 7) return `${diffDays}d ago`;
                                                    return syncDate.toLocaleDateString();
                                                })()}
                                            </span>
                                        )}
                                        {autoSyncEnabled && (
                                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                                <Timer className="h-2.5 w-2.5" />
                                                Next auto: {new Date(nextAutoSyncTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )}
                            <Button
                                variant={showSchedule ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setShowSchedule(!showSchedule)}
                                className="gap-1.5 h-8 sm:h-9 flex-1 sm:flex-initial"
                            >
                                <CalendarDays className="h-4 w-4" />
                                Weekly Schedule
                            </Button>
                        </div>
                    </div>

                    {/* Sync Log Panel */}
                    {isAdmin && showSyncLog && (
                        <div className="rounded-lg border border-border bg-card/50 backdrop-blur-sm p-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-semibold flex items-center gap-2">
                                    <History className="h-4 w-4" />
                                    Sync History
                                </h3>
                                <Button variant="ghost" size="sm" onClick={() => setShowSyncLog(false)} className="h-6 w-6 p-0">
                                    <X className="h-3 w-3" />
                                </Button>
                            </div>
                            {syncLog.length === 0 ? (
                                <p className="text-xs text-muted-foreground text-center py-4">No sync history yet</p>
                            ) : (
                                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                                    {syncLog.map((entry) => (
                                        <div key={entry.id} className="flex items-center justify-between gap-3 text-xs py-1.5 px-2 rounded-md bg-secondary/30">
                                            <div className="flex items-center gap-2">
                                                {entry.status === 'success'
                                                    ? <CheckCircle className="h-3 w-3 text-green-500 flex-shrink-0" />
                                                    : <XCircle className="h-3 w-3 text-red-500 flex-shrink-0" />
                                                }
                                                <span className={cn(
                                                    "px-1.5 py-0.5 rounded text-[10px] font-medium",
                                                    entry.sync_type === 'auto' ? 'bg-blue-500/20 text-blue-400' : 'bg-orange-500/20 text-orange-400'
                                                )}>
                                                    {entry.sync_type === 'auto' ? 'AUTO' : 'MANUAL'}
                                                </span>
                                                <span className="text-muted-foreground">
                                                    {entry.items_synced} items · {(entry.duration_ms / 1000).toFixed(1)}s
                                                </span>
                                            </div>
                                            <span className="text-muted-foreground text-[10px] whitespace-nowrap">
                                                {new Date(entry.synced_at).toLocaleString([], {
                                                    month: 'short', day: 'numeric',
                                                    hour: '2-digit', minute: '2-digit'
                                                })}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {autoSyncEnabled && (
                                <div className="text-[10px] text-muted-foreground border-t border-border/50 pt-2 flex items-center gap-1.5">
                                    <Timer className="h-3 w-3" />
                                    Auto-sync runs daily at 6:00 AM (your local time). Next sync: {new Date(nextAutoSyncTime).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })}
                                </div>
                            )}
                        </div>
                    )}

                    {!showSchedule && (
                        <div className="space-y-4">
                            <div className="flex flex-col lg:flex-row gap-3">
                                <div className="flex-1">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                        <Input
                                            placeholder={`Search ${selectedCategory.toLowerCase()}...`}
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="w-full pl-10 pr-10"
                                        />
                                        {searchQuery && (
                                            <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 hover:bg-transparent" onClick={() => setSearchQuery('')}>
                                                <X className="w-4 h-4 text-muted-foreground" />
                                            </Button>
                                        )}
                                    </div>
                                </div>

                                <div className="flex flex-col sm:flex-row gap-2">
                                    <Select value={selectedPlatform || "all"} onValueChange={(v) => setSelectedPlatform(v === "all" ? null : v)}>
                                        <SelectTrigger className="w-full sm:w-[180px] h-9 text-xs">
                                            <div className="flex items-center gap-2 truncate">
                                                <Filter className="h-3 w-3 opacity-50" />
                                                <SelectValue placeholder="Platform" />
                                            </div>
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Platforms</SelectItem>
                                            {ALL_PLATFORMS.map(p => (
                                                <SelectItem key={p} value={p}>
                                                    <div className="flex items-center justify-between gap-4 w-full">
                                                        <span>{p}</span>
                                                        <span className="text-[10px] opacity-50">({getPlatformCount(p)})</span>
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>

                                    <Select value={selectedGenre || "all"} onValueChange={(v) => setSelectedGenre(v === "all" ? null : v)}>
                                        <SelectTrigger className="w-full sm:w-[180px] h-9 text-xs">
                                            <div className="flex items-center gap-2 truncate">
                                                <Filter className="h-3 w-3 opacity-50" />
                                                <SelectValue placeholder="Genre" />
                                            </div>
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Genres</SelectItem>
                                            {ALL_GENRES.map(g => (
                                                <SelectItem key={g} value={g}>
                                                    <div className="flex items-center justify-between gap-4 w-full">
                                                        <span>{g}</span>
                                                        <span className="text-[10px] opacity-50">({getGenreCount(g)})</span>
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>

                                    {selectedCategory === 'TV Shows' && (
                                        <Button
                                            variant={hideCompleted ? 'default' : 'outline'}
                                            size="sm"
                                            onClick={() => setHideCompleted(!hideCompleted)}
                                            className="h-9 px-3 text-xs whitespace-nowrap"
                                        >
                                            {hideCompleted ? 'Show All' : 'Hide Completed'}
                                        </Button>
                                    )}

                                    {(selectedCategory === 'Movies' || selectedCategory === 'TV Shows') && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                                setSortOrder(sortOrder === 'alphabetical' ? 'recent' : 'alphabetical');
                                            }}
                                            className="h-9 px-3 text-xs whitespace-nowrap gap-1.5"
                                        >
                                            {sortOrder === 'alphabetical' && <><ArrowDownAZ className="h-3.5 w-3.5" />A-Z</>}
                                            {sortOrder === 'recent' && <><Clock className="h-3.5 w-3.5" />Recent</>}
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">
                            {loading ? '...' : `${filteredWatchlist.length} ${selectedCategory.toLowerCase()}`}
                        </p>
                        {isAdmin && (
                            <Dialog open={open} onOpenChange={setOpen}>
                                <DialogTrigger asChild>
                                    <Button size="sm" className="gap-1.5">
                                        <Plus className="h-4 w-4" />
                                        Add Item
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-3xl h-[600px] max-h-[90vh] flex flex-col p-0">
                                    <div className="p-6 pb-0">
                                        <DialogHeader>
                                            <DialogTitle className="font-serif">Add to Watchlist</DialogTitle>
                                            <DialogDescription className="sr-only">Search and add items to your watchlist.</DialogDescription>
                                        </DialogHeader>
                                    </div>
                                    <div className="flex-1 flex flex-col min-h-0 p-6 pt-4">
                                        <div className="space-y-2 flex-shrink-0">
                                            <Label htmlFor="title">Search {selectedCategory} *</Label>
                                            <div className="relative">
                                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                                                <Input
                                                    id="title"
                                                    value={title}
                                                    onChange={(e) => setTitle(e.target.value)}
                                                    required
                                                    placeholder={`Type a ${selectedCategory.toLowerCase().slice(0, -1)} name...`}
                                                    autoComplete="off"
                                                    className="h-14 text-base pl-12 pr-12"
                                                />
                                                {title && (
                                                    <Button type="button" variant="ghost" size="icon" className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 hover:bg-transparent" onClick={() => setTitle('')}>
                                                        <X className="w-5 h-5 text-muted-foreground" />
                                                    </Button>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex-1 overflow-y-auto min-h-0 mt-4 -mx-6 px-6 border-t border-b border-border/50 bg-secondary/5">
                                            {selectedCategory !== 'Upcoming' && selectedCategory !== 'Currently Watching' && title.length >= 2 && (searchResults.length > 0 || searchLoading) ? (
                                                <div className="divide-y divide-border/50">
                                                    {searchLoading ? (
                                                        <div className="p-12 text-base text-muted-foreground text-center animate-pulse">Searching TMDB...</div>
                                                    ) : (
                                                        searchResults.map((result) => (
                                                            <div
                                                                key={result.id}
                                                                className="flex items-start gap-5 py-6 hover:bg-secondary/40 cursor-pointer transition-all -mx-6 px-6"
                                                                onClick={async (e) => {
                                                                    e.preventDefault();
                                                                    if (addedItems.has(result.id)) return;
                                                                    const details = await getMovieDetails(result.id, result.media_type);
                                                                    if (details) {
                                                                        const formattedTitle = details.release_year ? `${details.title} (${details.release_year})` : details.title;
                                                                        await addWatchlistItem({
                                                                            title: formattedTitle,
                                                                            category: selectedCategory,
                                                                            description: details.overview,
                                                                            year: details.release_year || undefined,
                                                                            image_url: details.poster || undefined,
                                                                            runtime: details.runtime || undefined,
                                                                            genres: details.genres,
                                                                            tmdb_id: details.tmdb_id,
                                                                            release_date: details.release_date,
                                                                            streaming_platform: details.platform,
                                                                        });
                                                                        setAddedItems(prev => new Set(prev).add(result.id));
                                                                    }
                                                                }}
                                                            >
                                                                <div className="h-32 w-20 flex-shrink-0 bg-secondary rounded-md overflow-hidden shadow-md">
                                                                    {result.poster_path ? (
                                                                        <img src={getPosterUrl(result.poster_path) || ''} alt={result.title || result.name} className="h-full w-full object-cover" />
                                                                    ) : (
                                                                        <div className="h-full w-full flex items-center justify-center text-[10px] text-muted-foreground p-2 text-center bg-muted">No Poster</div>
                                                                    )}
                                                                </div>
                                                                <div className="flex flex-col min-w-0 py-1 flex-1">
                                                                    <div className="flex items-baseline justify-between gap-2 mb-1">
                                                                        <div className="flex items-baseline gap-2">
                                                                            <span className="text-lg font-semibold truncate leading-tight tracking-tight">{result.title || result.name}</span>
                                                                            <span className="text-sm text-muted-foreground whitespace-nowrap">
                                                                                ({result.release_date || result.first_air_date ? new Date(result.release_date || result.first_air_date || '').getFullYear() : 'N/A'})
                                                                            </span>
                                                                        </div>
                                                                        {addedItems.has(result.id) && <span className="text-xs font-bold text-green-500 uppercase tracking-wider">Item Added</span>}
                                                                    </div>
                                                                    {result.overview && <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed">{result.overview}</p>}
                                                                </div>
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="h-full flex items-center justify-center text-muted-foreground text-sm p-12 text-center">
                                                    {title.length < 2 ? "Start typing to see recommendations..." : "No recommendations found"}
                                                </div>
                                            )}
                                        </div>

                                    </div>
                                </DialogContent>
                            </Dialog>
                        )}
                    </div>
                </div>

                {showSchedule ? (
                    <WeeklySchedule
                        DAYS={DAYS}
                        getScheduleForDay={getScheduleForDay}
                        removeFromSchedule={isAdmin ? removeFromSchedule : undefined}
                        updateScheduleDay={isAdmin ? updateScheduleDay : undefined}
                        watchlist={watchlist}
                        toggleEpisodeWatched={isAdmin ? toggleEpisodeWatched : undefined}
                        isEpisodeWatched={isEpisodeWatched}
                        isSeasonWatched={isSeasonWatched}
                        getAutoStatus={getAutoStatus}
                        onRemoveWatchlist={isAdmin ? removeWatchlistItem : undefined}
                        addToSchedule={isAdmin ? addToSchedule : undefined}
                        isInSchedule={isInSchedule}
                    />
                ) : (
                    <div className="px-4 md:px-0 py-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-4">
                        {loading ? (
                            [...Array(8)].map((_, i) => <Skeleton key={i} className="h-64 rounded-lg" />)
                        ) : filteredWatchlist.length === 0 ? (
                            <p className="col-span-full text-center py-16 text-muted-foreground">No items in {selectedCategory.toLowerCase()} yet</p>
                        ) : (
                            filteredWatchlist.map((item) => (
                                <WatchlistCard
                                    key={item.id}
                                    item={item}
                                    onRemove={isAdmin ? removeWatchlistItem : undefined}
                                    getCategoryIcon={getCategoryIcon}
                                    toggleEpisodeWatched={isAdmin ? toggleEpisodeWatched : undefined}
                                    isEpisodeWatched={isEpisodeWatched}
                                    isSeasonWatched={isSeasonWatched}
                                    getAutoStatus={getAutoStatus}
                                    addToSchedule={isAdmin ? addToSchedule : undefined}
                                    isInSchedule={isInSchedule}
                                />
                            ))
                        )}
                    </div>
                )}

                <Footer />
            </div>
        </div>
    );
};

export default Watchlist;
