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
import { Plus, Bell, CalendarDays, X, Search, RefreshCcw, ArrowUpDown, ArrowDownAZ, Tv, Film, Clock } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Filter } from 'lucide-react';
import { WatchlistCard } from '@/components/watchlist/WatchlistCard';
import { WeeklySchedule } from '@/components/watchlist/WeeklySchedule';
import { formatRuntime, getPlatformColor } from '@/lib/watchlist-utils';

const CATEGORIES = ['TV Shows', 'Movies', 'Upcoming'] as const;

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
    const { watchlist, addWatchlistItem, removeWatchlistItem, loading, syncing, syncProgress, syncWatchlist, toggleEpisodeWatched, isEpisodeWatched, isSeasonWatched, getAutoStatus } = useWatchlist();
    const { addToSchedule, removeFromSchedule, getScheduleForDay, isInSchedule, DAYS } = useSchedule();
    const [open, setOpen] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState<typeof CATEGORIES[number]>('TV Shows');
    const [searchQuery, setSearchQuery] = useState('');
    const [hideCompleted, setHideCompleted] = useState(false);
    const [showSchedule, setShowSchedule] = useState(false);
    const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
    const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
    const [sortOrder, setSortOrder] = useState<'default' | 'alphabetical' | 'recent'>('default');
    const [title, setTitle] = useState('');
    const [status, setStatus] = useState('');
    const [description, setDescription] = useState('');
    const [year, setYear] = useState('');
    const [imageUrl, setImageUrl] = useState('');
    const [link, setLink] = useState('');
    const [addedItems, setAddedItems] = useState<Set<number>>(new Set());

    const { results: searchResults, search: tmdbSearch, getPosterUrl, getMovieDetails, loading: searchLoading } = useTMDB();

    // Reset form when dialog closes
    useEffect(() => {
        if (!open) {
            setTitle('');
            setStatus('');
            setDescription('');
            setYear('');
            setImageUrl('');
            setLink('');
            setAddedItems(new Set());
        }
    }, [open]);

    useEffect(() => {
        if (selectedCategory === 'Upcoming') return;

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

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim()) return;
        addWatchlistItem({
            title: title.trim(),
            category: selectedCategory,
            status: status.trim() || undefined,
            description: description.trim() || undefined,
            year: year ? parseInt(year) : undefined,
            image_url: imageUrl.trim() || undefined,
            link: link.trim() || undefined,
        });
        setOpen(false);
    };

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
        return watchlist.filter((item) => item.category === selectedCategory);
    }, [watchlist, selectedCategory]);

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
        if (sortOrder !== 'default' && selectedCategory !== 'Upcoming') {
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
        return watchlist.filter((item) => item.category === cat).length;
    }, [watchlist]);

    return (
        <div className="min-h-screen bg-background">
            <div className="wide-container">
                <Header title="Watchlist" subtitle="What I'm watching & tracking" />

                <div className="px-4 md:px-0 pt-6 space-y-4">
                    <div className="flex flex-wrap items-center gap-2 justify-between">
                        <div className="flex flex-wrap gap-2">
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
                                        setSortOrder('default');
                                    }}
                                    className="gap-1.5"
                                >
                                    {getCategoryIcon(cat)}
                                    {cat}
                                    <span className="text-xs opacity-70">({getCategoryCount(cat)})</span>
                                </Button>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            {isAdmin && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={syncWatchlist}
                                    disabled={syncing}
                                    className="gap-1.5 relative overflow-hidden"
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
                            )}
                            <Button
                                variant={showSchedule ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setShowSchedule(!showSchedule)}
                                className="gap-1.5"
                            >
                                <CalendarDays className="h-4 w-4" />
                                Weekly Schedule
                            </Button>
                        </div>
                    </div>

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
                                            variant={sortOrder !== 'default' ? 'default' : 'outline'}
                                            size="sm"
                                            onClick={() => {
                                                if (sortOrder === 'default') setSortOrder('alphabetical');
                                                else if (sortOrder === 'alphabetical') setSortOrder('recent');
                                                else setSortOrder('default');
                                            }}
                                            className="h-9 px-3 text-xs whitespace-nowrap gap-1.5"
                                        >
                                            {sortOrder === 'default' && <><ArrowUpDown className="h-3.5 w-3.5" />Sort</>}
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
                                    <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 p-6 pt-4">
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
                                            {selectedCategory !== 'Upcoming' && title.length >= 2 && (searchResults.length > 0 || searchLoading) ? (
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

                                        <div className="hidden">
                                            <Input id="year" type="number" value={year} onChange={(e) => setYear(e.target.value)} />
                                            <Input id="status" value={status} onChange={(e) => setStatus(e.target.value)} />
                                            <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} />
                                            <Input id="imageUrl" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />
                                            <Input id="link" value={link} onChange={(e) => setLink(e.target.value)} />
                                        </div>

                                        <div className="pt-4 flex-shrink-0">
                                            <Button type="submit" className="w-full h-11 text-base font-medium">Add to Watchlist</Button>
                                        </div>
                                    </form>
                                </DialogContent>
                            </Dialog>
                        )}
                    </div>
                </div>

                {showSchedule ? (
                    <WeeklySchedule
                        DAYS={DAYS}
                        getScheduleForDay={getScheduleForDay}
                        removeFromSchedule={removeFromSchedule}
                        watchlist={watchlist}
                        toggleEpisodeWatched={toggleEpisodeWatched}
                        isEpisodeWatched={isEpisodeWatched}
                        isSeasonWatched={isSeasonWatched}
                        getAutoStatus={getAutoStatus}
                        onRemoveWatchlist={removeWatchlistItem}
                        addToSchedule={addToSchedule}
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
                                    toggleEpisodeWatched={toggleEpisodeWatched}
                                    isEpisodeWatched={isEpisodeWatched}
                                    isSeasonWatched={isSeasonWatched}
                                    getAutoStatus={getAutoStatus}
                                    addToSchedule={addToSchedule}
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
