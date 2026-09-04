import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { DotMatrixText } from '@/components/dot-matrix/DotMatrixText';
import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from 'react';
import { useWatchlist, WatchlistItem, FavouriteItem } from '@/features/watchlist/useWatchlist';
import { useSchedule } from '@/features/watchlist/useSchedule';
import { useTMDB } from '@/features/watchlist/useTMDB';
import type { TMDBResult } from '@/features/watchlist/useTMDB';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  Bell,
  CalendarDays,
  X,
  Search,
  RefreshCcw,
  ArrowUpDown,
  ArrowDownAZ,
  Tv,
  Film,
  Clock,
  Eye,
  History,
  CheckCircle,
  XCircle,
  Timer,
  Heart,
  Trash2,
  Loader2,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Filter } from 'lucide-react';
import { WatchlistCard } from '@/features/watchlist/components/WatchlistCard';
import { CARD_GRID } from '@/theme/layout';
import { TmdbSearchDialog } from '@/features/watchlist/components/TmdbSearchDialog';
import { WeeklySchedule } from '@/features/watchlist/components/WeeklySchedule';
import { formatRuntime, getPlatformColor } from '@/features/watchlist/watchlist-utils';

const CATEGORIES = [
  'TV Shows',
  'Movies',
  'Currently Watching',
  'Upcoming',
  'Favourites',
] as const;

const FAV_CATEGORIES = [
  'Bollywood',
  'Hollywood',
  'Anime',
  'Others',
] as const;

const ALL_PLATFORMS = [
  'Netflix',
  'Prime Video',
  'Disney+',
  'Apple TV+',
  'BBC iPlayer',
  'Online',
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
  'Western',
];

/** "just now" / "12m ago" / "2h ago" / "3d ago", then a plain date. */
function relativeTime(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(diffMs / 3600000);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(diffMs / 86400000);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

const Watchlist = () => {
  const { isAdmin } = useAuth();
  const {
    watchlist,
    favourites,
    addWatchlistItem,
    removeWatchlistItem,
    addFavourite,
    removeFavourite,
    loading,
    syncing,
    syncProgress,
    lastSyncTime,
    lastAutoSyncTime,
    nextAutoSyncTime,
    syncLog,
    autoSyncEnabled,
    syncWatchlist,
    syncSingleItem,
    cancelSync,
    toggleEpisodeWatched,
    toggleSeasonWatched,
    isEpisodeWatched,
    isSeasonWatched,
    getAutoStatus,
  } = useWatchlist();
  const {
    addToSchedule,
    removeFromSchedule,
    removeFromScheduleByWatchlistId,
    updateScheduleDay,
    getScheduleForDay,
    isInSchedule,
    DAYS,
  } = useSchedule();

  // removeWatchlistItem alone leaves a dangling weekly_schedule row behind
  // (watchlist and schedule are separate hooks/tables) -- always clear the
  // schedule entry too so deleting a show doesn't leave a stale "scheduled"
  // count on some day of the week.
  const removeWatchlistItemAndSchedule = useCallback(
    async (id: string) => {
      await removeWatchlistItem(id);
      await removeFromScheduleByWatchlistId(id);
    },
    [removeWatchlistItem, removeFromScheduleByWatchlistId],
  );

  const [open, setOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] =
    useState<(typeof CATEGORIES)[number]>('TV Shows');
  const [searchQuery, setSearchQuery] = useState('');
  const [hideCompleted, setHideCompleted] = useState(true);
  const [showSchedule, setShowSchedule] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'alphabetical' | 'recent'>(
    'alphabetical',
  );
  const [title, setTitle] = useState('');
  const [addedItems, setAddedItems] = useState<Set<number>>(new Set());
  // Covers the whole click-to-completion span, including the getMovieDetails
  // fetch that happens before addWatchlistItem is even called -- without
  // this, a second click during that window (or the multi-second TV season
  // fetch) could kick off a duplicate add.
  const [pendingResultIds, setPendingResultIds] = useState<Set<number>>(new Set());
  const [showSyncLog, setShowSyncLog] = useState(false);
  const [visibleCount, setVisibleCount] = useState(48);
  const observerTarget = useRef<HTMLDivElement>(null);

  const {
    results: searchResults,
    search: tmdbSearch,
    searchMulti: tmdbSearchMulti,
    getPosterUrl,
    getMovieDetails,
    loading: searchLoading,
  } = useTMDB();

  const [favDialogOpen, setFavDialogOpen] = useState(false);
  const [favSearchQuery, setFavSearchQuery] = useState('');
  const [favAddedItems, setFavAddedItems] = useState<Set<string>>(new Set());

  const [moveItem, setMoveItem] = useState<WatchlistItem | null>(null);
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [selectedFavCategory, setSelectedFavCategory] = useState<'Bollywood' | 'Hollywood' | 'Anime' | 'Others'>('Hollywood');

  /**
   * Auto-tag a favourite from TMDB's original_language. Shown as the "Auto:"
   * chip in the search results and stored as the favourite's category.
   */
  const favouriteCategoryFor = (result: TMDBResult) =>
    result.original_language === 'hi'
      ? 'Bollywood'
      : result.original_language === 'ja'
        ? 'Anime'
        : result.original_language === 'en'
          ? 'Hollywood'
          : 'Others';

  const handleAddFavourite = useCallback(
    async (result: TMDBResult) => {
      const itemKey = `${result.media_type}-${result.id}`;
      await addFavourite({
        title: result.title || result.name || '',
        poster: result.poster_path ? getPosterUrl(result.poster_path) || undefined : undefined,
        media_type: result.media_type,
        tmdb_id: result.id,
        category: favouriteCategoryFor(result),
      });
      setFavAddedItems((prev) => new Set(prev).add(itemKey));
    },
    [addFavourite, getPosterUrl],
  );

  const handleAddWatchlistItem = useCallback(
    async (result: TMDBResult) => {
      // Inline in JSX this was narrowed by the surrounding branch. As a
      // callback it needs the guard stated: the dialog's search is disabled
      // for Upcoming and Currently Watching, and Favourites has its own
      // dialog, so only these two can actually reach here.
      if (selectedCategory !== 'TV Shows' && selectedCategory !== 'Movies') return;

      // pendingResultIds covers the whole click-to-completion span, including
      // the getMovieDetails fetch before addWatchlistItem is even called.
      setPendingResultIds((prev) => new Set(prev).add(result.id));
      try {
        const details = await getMovieDetails(result.id, result.media_type);
        if (!details) return;
        await addWatchlistItem({
          title: details.release_year
            ? `${details.title} (${details.release_year})`
            : details.title,
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
        setAddedItems((prev) => new Set(prev).add(result.id));
      } finally {
        setPendingResultIds((prev) => {
          const next = new Set(prev);
          next.delete(result.id);
          return next;
        });
      }
    },
    [addWatchlistItem, getMovieDetails, selectedCategory],
  );

  const handleOpenMoveDialog = useCallback((item: WatchlistItem) => {
    setMoveItem(item);
    
    // Guess category based on title or genres
    const titleLower = item.title.toLowerCase();
    const genresLower = item.genres?.map(g => g.toLowerCase()) || [];
    
    if (genresLower.includes('anime') || genresLower.includes('animation')) {
      setSelectedFavCategory('Anime');
    } else if (titleLower.includes('hindi') || titleLower.includes('bollywood') || item.genres?.includes('Bollywood')) {
      setSelectedFavCategory('Bollywood');
    } else {
      setSelectedFavCategory('Hollywood');
    }
    
    setMoveDialogOpen(true);
  }, []);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setTitle('');
      setAddedItems(new Set());
    }
  }, [open]);

  // Reset favourites dialog when it closes
  useEffect(() => {
    if (!favDialogOpen) {
      setFavSearchQuery('');
      setFavAddedItems(new Set());
    }
  }, [favDialogOpen]);

  // TMDB search for favourites
  useEffect(() => {
    const timer = setTimeout(() => {
      if (favSearchQuery.length >= 2) {
        tmdbSearchMulti(favSearchQuery);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [favSearchQuery, tmdbSearchMulti]);

  useEffect(() => {
    if (
      selectedCategory === 'Upcoming' ||
      selectedCategory === 'Currently Watching' ||
      selectedCategory === 'Favourites'
    )
      return;

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
      return watchlist
        .filter((item) => {
          if (item.release_date && new Date(item.release_date) > now)
            return true;
          if (item.category === 'TV Shows' && item.seasons) {
            return item.seasons.some(
              (s) => s.release_date && new Date(s.release_date) > now,
            );
          }
          return false;
        })
        .sort((a, b) => {
          const getEarliestDate = (item: WatchlistItem) => {
            const dates = [];
            if (item.release_date) dates.push(new Date(item.release_date));
            if (item.seasons) {
              item.seasons.forEach((s) => {
                if (s.release_date) dates.push(new Date(s.release_date));
              });
            }
            const futureDates = dates.filter((d) => d > new Date());
            return futureDates.length > 0
              ? Math.min(...futureDates.map((d) => d.getTime()))
              : Infinity;
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
    ALL_PLATFORMS.forEach((p) => (counts[p] = 0));
    categoryItems.forEach((item) => {
      if (
        item.streaming_platform &&
        counts[item.streaming_platform] !== undefined
      ) {
        counts[item.streaming_platform]++;
      }
    });
    return counts;
  }, [categoryItems]);

  const genreCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    ALL_GENRES.forEach((g) => (counts[g] = 0));
    categoryItems.forEach((item) => {
      item.genres?.forEach((g) => {
        if (counts[g] !== undefined) {
          counts[g]++;
        }
      });
    });
    return counts;
  }, [categoryItems]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    categoryItems.forEach((item) => {
      if (item.category === 'TV Shows' && item.series_status) {
        const rawStatus = item.series_status;
        const normalizedStatus =
          rawStatus === 'Canceled' || rawStatus === 'Cancelled' || rawStatus === 'Ended'
            ? 'Ended / Cancelled'
            : rawStatus;
        counts[normalizedStatus] = (counts[normalizedStatus] || 0) + 1;
      }
    });
    return counts;
  }, [categoryItems]);

  const getPlatformCount = (platform: string) => platformCounts[platform] || 0;
  const getGenreCount = (genre: string) => genreCounts[genre] || 0;
  const getStatusCount = (status: string) => statusCounts[status] || 0;

  const filteredWatchlist = useMemo(() => {
    let result = categoryItems;
    if (selectedPlatform)
      result = result.filter(
        (item) => item.streaming_platform === selectedPlatform,
      );
    if (selectedGenre)
      result = result.filter((item) => item.genres?.includes(selectedGenre));
    if (selectedStatus && selectedCategory === 'TV Shows') {
      if (selectedStatus === 'Ended / Cancelled') {
        result = result.filter(
          (item) =>
            item.series_status === 'Ended' ||
            item.series_status === 'Cancelled' ||
            item.series_status === 'Canceled',
        );
      } else {
        result = result.filter((item) => item.series_status === selectedStatus);
      }
    }
    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (normalizedQuery)
      result = result.filter((item) =>
        item.title.toLowerCase().includes(normalizedQuery),
      );
    if (selectedCategory === 'TV Shows' && hideCompleted && !normalizedQuery) {
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
              if (!item.seasons || item.seasons.length === 0)
                return item.release_date
                  ? new Date(item.release_date).getTime()
                  : 0;
              const seasonDates = item.seasons
                .filter((s) => s.release_date)
                .map((s) => new Date(s.release_date!).getTime());
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
  }, [
    categoryItems,
    selectedPlatform,
    selectedGenre,
    selectedStatus,
    searchQuery,
    selectedCategory,
    hideCompleted,
    sortOrder,
    getAutoStatus,
  ]);

  const getCategoryIcon = useCallback((cat: string) => {
    switch (cat) {
      case 'TV Shows':
        return <Tv className="h-4 w-4" />;
      case 'Movies':
        return <Film className="h-4 w-4" />;
      case 'Currently Watching':
        return <Eye className="h-4 w-4" />;
      case 'Upcoming':
        return <Bell className="h-4 w-4" />;
      case 'Favourites':
        return <Heart className="h-4 w-4" />;
      default:
        return null;
    }
  }, []);

  const categoryCounts = useMemo(() => {
    const counts: Record<(typeof CATEGORIES)[number], number> = {
      'TV Shows': 0,
      Movies: 0,
      Upcoming: 0,
      'Currently Watching': 0,
      Favourites: favourites.length,
    };
    const now = new Date();
    watchlist.forEach((item) => {
      if (item.category === 'TV Shows' || item.category === 'Movies') {
        counts[item.category]++;
      }
      if (item.release_date && new Date(item.release_date) > now) {
        counts['Upcoming']++;
      } else if (
        item.category === 'TV Shows' &&
        item.seasons &&
        item.seasons.some(
          (s) => s.release_date && new Date(s.release_date) > now,
        )
      ) {
        counts['Upcoming']++;
      }

      if (item.category === 'TV Shows') {
        const autoStatus = getAutoStatus(item);
        if (autoStatus === 'Watching') {
          counts['Currently Watching']++;
        }
      }
    });
    return counts;
  }, [watchlist, favourites, getAutoStatus]);

  // Reset visible count when filters change
  useEffect(() => {
    setVisibleCount(48);
  }, [
    selectedCategory,
    searchQuery,
    selectedPlatform,
    selectedGenre,
    selectedStatus,
    sortOrder,
    hideCompleted,
  ]);

  // Setup intersection observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((prev) =>
            Math.min(prev + 48, filteredWatchlist.length),
          );
        }
      },
      { rootMargin: '100px' },
    );

    const currentTarget = observerTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [filteredWatchlist.length, visibleCount]);

  const visibleWatchlist = useMemo(() => {
    return filteredWatchlist.slice(0, visibleCount);
  }, [filteredWatchlist, visibleCount]);

  return (
    <div className="min-h-screen bg-background">
      <div className="wide-container">
        <Header title="Watchlist" subtitle="What I'm watching" />

        <div className="px-4 md:px-0 pt-6 space-y-4">
          <div className="flex flex-wrap items-start gap-2 justify-between">
            <div className="flex flex-wrap items-center gap-2 md:gap-4">
              {CATEGORIES.map((cat, index) => (
                <div key={cat} className="flex items-center gap-2 md:gap-4">
                  <button
                    onClick={() => {
                      setSelectedCategory(cat);
                      setShowSchedule(false);
                      setSelectedPlatform(null);
                      setSelectedGenre(null);
                      setSelectedStatus(null);
                    }}
                    className={cn(
                      'nav-link relative py-1 flex items-center gap-1.5',
                      selectedCategory === cat && 'nav-link-active',
                    )}
                  >
                    <span className="shrink-0">{getCategoryIcon(cat)}</span>
                    <DotMatrixText text={cat.toUpperCase()} size="xs" />
                    <span className="text-xs text-muted-foreground/60">
                      ({categoryCounts[cat]})
                    </span>
                  </button>
                  {index < CATEGORIES.length - 1 && (
                    <span className="text-muted-foreground/30 hidden md:inline">
                      ·
                    </span>
                  )}
                </div>
              ))}
            </div>
            <div className="flex flex-col sm:flex-row sm:items-start gap-2 w-full sm:w-auto">
              {/* Syncing is the cron's job. The manual trigger lives inside
                  this panel rather than on the toolbar, so the page does not
                  advertise a button nobody should normally need. */}
              {isAdmin && (
                <Button
                  variant={showSyncLog ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setShowSyncLog(!showSyncLog)}
                  className="gap-1.5 h-8 sm:h-9 flex-1 sm:flex-initial"
                >
                  <History className={cn('h-4 w-4', syncing && 'animate-spin')} />
                  <DotMatrixText
                    text={syncing ? `SYNCING ${syncProgress}%` : 'SYNC'}
                    size="xs"
                    wrap={false}
                  />
                </Button>
              )}
              <Button
                variant={showSchedule ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setShowSchedule(!showSchedule)}
                className="gap-1.5 h-8 sm:h-9 flex-1 sm:flex-initial"
              >
                <CalendarDays className="h-4 w-4" />
                <DotMatrixText text="WEEKLY SCHEDULE" size="xs" wrap={false} />
              </Button>
            </div>
          </div>

          {/* Sync Log Panel */}
          {isAdmin && showSyncLog && (
            <div className="rounded-lg border border-border bg-card/50 backdrop-blur-sm px-3 py-2 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold flex items-center gap-1.5 text-muted-foreground">
                  <History className="h-3 w-3" />
                  <DotMatrixText text="SYNC HISTORY" size="xs" />
                </h3>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => syncWatchlist('manual')}
                    disabled={syncing}
                    className="gap-1.5 relative overflow-hidden h-7"
                  >
                    {syncing && (
                      <div
                        className="absolute left-0 top-0 bottom-0 bg-primary/20 transition-[width] duration-300 ease-out"
                        style={{ width: `${syncProgress}%` }}
                      />
                    )}
                    <span className="relative z-10 flex items-center gap-1.5">
                      <RefreshCcw className={cn('h-3.5 w-3.5', syncing && 'animate-spin')} />
                      <DotMatrixText
                        text={syncing ? `${syncProgress}%` : 'SYNC NOW'}
                        size="xs"
                        wrap={false}
                      />
                    </span>
                  </Button>
                  {syncing && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={cancelSync}
                      className="h-7 px-2 text-muted-foreground hover:text-destructive"
                      title="Stop sync"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowSyncLog(false)}
                    className="h-5 w-5 p-0"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              {syncLog.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-2">
                  No sync history yet
                </p>
              ) : (
                <div
                  className="space-y-1 overflow-y-auto pr-0.5"
                  style={{ maxHeight: '96px' }}
                >
                  {syncLog.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between gap-2 text-xs py-1 px-1.5 rounded bg-secondary/30"
                    >
                      <div className="flex items-center gap-1.5">
                        {entry.status === 'success' ? (
                          <CheckCircle className="h-2.5 w-2.5 text-green-500 flex-shrink-0" />
                        ) : (
                          <XCircle className="h-2.5 w-2.5 text-red-500 flex-shrink-0" />
                        )}
                        <span
                          className={cn(
                            'px-1 py-px rounded text-xs font-semibold tracking-wide',
                            entry.sync_type === 'auto'
                              ? 'bg-purple-500/20 text-purple-400'
                              : entry.sync_type === 'daily'
                                ? 'bg-blue-500/20 text-blue-400'
                                : 'bg-orange-500/20 text-orange-400',
                          )}
                        >
                          {entry.sync_type === 'auto'
                            ? 'AUTO'
                            : entry.sync_type === 'daily'
                              ? 'DAILY'
                              : 'MAN'}
                        </span>
                        <span className="text-muted-foreground">
                          {entry.items_synced} items ·{' '}
                          {(entry.duration_ms / 1000).toFixed(1)}s
                        </span>
                      </div>
                      <span className="text-muted-foreground text-xs whitespace-nowrap">
                        {new Date(entry.synced_at).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <div className="text-xs text-muted-foreground border-t border-border/50 pt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1">
                {lastSyncTime && <span>Last synced: {relativeTime(lastSyncTime)}</span>}
                {autoSyncEnabled && (
                  <span className="flex items-center gap-1">
                    <Timer className="h-2.5 w-2.5" />
                    Next auto-sync:{' '}
                    {new Date(nextAutoSyncTime).toLocaleString([], {
                      weekday: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                )}
              </div>
            </div>
          )}

          {!showSchedule && selectedCategory !== 'Favourites' && (
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
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 hover:bg-transparent"
                        onClick={() => setSearchQuery('')}
                      >
                        <X className="w-4 h-4 text-muted-foreground" />
                      </Button>
                    )}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <Select
                    value={selectedPlatform || 'all'}
                    onValueChange={(v) =>
                      setSelectedPlatform(v === 'all' ? null : v)
                    }
                  >
                    <SelectTrigger className="w-full sm:w-[180px] h-9 text-xs">
                      <div className="flex items-center gap-2 truncate">
                        <Filter className="h-3 w-3 opacity-50" />
                        <SelectValue placeholder="Platform" />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Platforms</SelectItem>
                      {ALL_PLATFORMS.filter((p) => getPlatformCount(p) > 0).map(
                        (p) => (
                          <SelectItem key={p} value={p}>
                            <div className="flex items-center justify-between gap-4 w-full">
                              <span>{p}</span>
                              <span className="text-xs opacity-50">
                                ({getPlatformCount(p)})
                              </span>
                            </div>
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>

                  <Select
                    value={selectedGenre || 'all'}
                    onValueChange={(v) =>
                      setSelectedGenre(v === 'all' ? null : v)
                    }
                  >
                    <SelectTrigger className="w-full sm:w-[180px] h-9 text-xs">
                      <div className="flex items-center gap-2 truncate">
                        <Filter className="h-3 w-3 opacity-50" />
                        <SelectValue placeholder="Genre" />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Genres</SelectItem>
                      {ALL_GENRES.filter((g) => getGenreCount(g) > 0).map(
                        (g) => (
                          <SelectItem key={g} value={g}>
                            <div className="flex items-center justify-between gap-4 w-full">
                              <span>{g}</span>
                              <span className="text-xs opacity-50">
                                ({getGenreCount(g)})
                              </span>
                            </div>
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>

                  {selectedCategory === 'TV Shows' && Object.keys(statusCounts).length > 0 && (
                    <Select
                      value={selectedStatus || 'all'}
                      onValueChange={(v) =>
                        setSelectedStatus(v === 'all' ? null : v)
                      }
                    >
                      <SelectTrigger className="w-full sm:w-[150px] h-9 text-xs">
                        <div className="flex items-center gap-2 truncate">
                          <Filter className="h-3 w-3 opacity-50" />
                          <SelectValue placeholder="Status" />
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        {Object.keys(statusCounts)
                          .sort()
                          .map((status) => (
                            <SelectItem key={status} value={status}>
                              <div className="flex items-center justify-between gap-4 w-full">
                                <span>{status === 'Canceled' ? 'Cancelled' : status}</span>
                                <span className="text-xs opacity-50">
                                  ({getStatusCount(status)})
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  )}

                  {selectedCategory === 'TV Shows' && (
                    <Button
                      variant={hideCompleted ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setHideCompleted(!hideCompleted)}
                      className="h-9 px-3 text-xs whitespace-nowrap"
                    >
                      {hideCompleted ? (
                        <DotMatrixText text="SHOW ALL" size="xs" wrap={false} />
                      ) : (
                        <DotMatrixText text="HIDE COMPLETED" size="xs" wrap={false} />
                      )}
                    </Button>
                  )}

                  {(selectedCategory === 'Movies' ||
                    selectedCategory === 'TV Shows') && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSortOrder(
                          sortOrder === 'alphabetical'
                            ? 'recent'
                            : 'alphabetical',
                        );
                      }}
                      className="h-9 px-3 text-xs whitespace-nowrap gap-1.5"
                    >
                      {sortOrder === 'alphabetical' && (
                        <>
                          <ArrowDownAZ className="h-3.5 w-3.5" />
                          <DotMatrixText text="A-Z" size="xs" />
                        </>
                      )}
                      {sortOrder === 'recent' && (
                        <>
                          <Clock className="h-3.5 w-3.5" />
                          <DotMatrixText text="RECENT" size="xs" />
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {loading
                ? '...'
                : selectedCategory === 'Favourites'
                  ? `${favourites.length} favourites`
                  : `${filteredWatchlist.length} ${selectedCategory.toLowerCase()}`}
            </p>
            {isAdmin && selectedCategory === 'Favourites' && (
              <TmdbSearchDialog
                open={favDialogOpen}
                onOpenChange={setFavDialogOpen}
                triggerLabel="Add Favourite"
                title="Add to Favourites"
                description="Search and add movies or TV shows to your favourites."
                searchLabel="Search Movies & TV Shows"
                placeholder="Type a movie or TV show name..."
                query={favSearchQuery}
                onQueryChange={setFavSearchQuery}
                results={searchResults}
                loading={searchLoading}
                getPosterUrl={getPosterUrl}
                resultKey={(r) => `${r.media_type}-${r.id}`}
                isDisabled={(r) => favAddedItems.has(`${r.media_type}-${r.id}`)}
                onSelect={handleAddFavourite}
                renderStatus={(r) => (
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'text-xs px-2 py-0.5 rounded font-medium',
                        r.media_type === 'movie'
                          ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                          : 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
                      )}
                    >
                      {r.media_type === 'movie' ? 'Movie' : 'TV Show'}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded font-medium bg-muted text-muted-foreground border border-border">
                      Auto: {favouriteCategoryFor(r)}
                    </span>
                    {favAddedItems.has(`${r.media_type}-${r.id}`) && (
                      <span className="text-xs font-bold text-green-500 uppercase tracking-wider">
                        Added
                      </span>
                    )}
                  </div>
                )}
              />
            )}
            {isAdmin && selectedCategory !== 'Favourites' && (
              <TmdbSearchDialog
                open={open}
                onOpenChange={setOpen}
                triggerLabel="Add Item"
                title="Add to Watchlist"
                description="Search and add items to your watchlist."
                searchLabel={`Search ${selectedCategory}`}
                placeholder={`Type a ${selectedCategory.toLowerCase().slice(0, -1)} name...`}
                query={title}
                onQueryChange={setTitle}
                results={searchResults}
                loading={searchLoading}
                getPosterUrl={getPosterUrl}
                resultKey={(r) => String(r.id)}
                searchDisabled={
                  selectedCategory === 'Upcoming' ||
                  selectedCategory === 'Currently Watching'
                }
                isDisabled={(r) =>
                  addedItems.has(r.id) || pendingResultIds.has(r.id)
                }
                onSelect={handleAddWatchlistItem}
                renderStatus={(r) =>
                  pendingResultIds.has(r.id) ? (
                    <span className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Adding...
                    </span>
                  ) : addedItems.has(r.id) ? (
                    <span className="text-xs font-bold text-green-500 uppercase tracking-wider">
                      Item Added
                    </span>
                  ) : null
                }
              />
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
            onRemoveWatchlist={isAdmin ? removeWatchlistItemAndSchedule : undefined}
            addToSchedule={isAdmin ? addToSchedule : undefined}
            isInSchedule={isInSchedule}
            onMoveToFavourites={isAdmin ? handleOpenMoveDialog : undefined}
          />
        ) : selectedCategory === 'Favourites' ? (
          <div className="px-4 md:px-0 py-6 space-y-8">
            {loading ? (
              <div className={CARD_GRID}>
                {[...Array(12)].map((_, i) => (
                  <Skeleton key={i} className="h-64 rounded-lg" />
                ))}
              </div>
            ) : favourites.length === 0 ? (
              <p className="text-center py-16 text-muted-foreground">
                No favourites yet
              </p>
            ) : (
              <>
                {/* Category Sections */}
                {FAV_CATEGORIES.map((cat) => {
                  const catFavs = favourites.filter((f) => f.category === cat);
                  if (catFavs.length === 0) return null;

                  const catMovies = catFavs.filter((f) => f.media_type === 'movie');
                  const catTVShows = catFavs.filter((f) => f.media_type === 'tv');

                  return (
                    <div key={cat} className="space-y-4 border-b border-border/40 pb-6 last:border-b-0">
                      <div className="flex items-center gap-2">
                        <DotMatrixText text={cat.toUpperCase()} size="xs" />
                        <span className="text-xs text-muted-foreground/60 text-sm font-semibold">
                          ({catFavs.length})
                        </span>
                      </div>

                      {catMovies.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground/80 font-medium pl-1">
                            <Film className="h-3.5 w-3.5" />
                            <span>Movies ({catMovies.length})</span>
                          </div>
                          <div className={CARD_GRID}>
                            {catMovies.map((fav) => (
                              <div key={fav.id} className="item-card group">
                                <div className="aspect-[2/3] bg-muted relative overflow-hidden">
                                  {fav.poster ? (
                                    <img
                                      src={fav.poster}
                                      alt={fav.title}
                                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                      loading="lazy"
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-secondary/30">
                                      <Heart className="h-8 w-8 text-muted-foreground/30" />
                                    </div>
                                  )}
                                  {isAdmin && (
                                    <div
                                      className="absolute top-2 right-2 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <Button
                                        variant="secondary"
                                        size="icon"
                                        className="h-7 w-7 bg-background/80 backdrop-blur-sm"
                                        onClick={() => removeFavourite(fav.id)}
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    </div>
                                  )}
                                </div>
                                <div className="p-3">
                                  <h3 className="font-serif text-sm font-medium leading-tight">
                                    <span className="line-clamp-2" style={{ textWrap: 'balance' as any }}>{fav.title}</span>
                                  </h3>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {catTVShows.length > 0 && (
                        <div className="space-y-2 pt-2">
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground/80 font-medium pl-1">
                            <Tv className="h-3.5 w-3.5" />
                            <span>TV Shows ({catTVShows.length})</span>
                          </div>
                          <div className={CARD_GRID}>
                            {catTVShows.map((fav) => (
                              <div key={fav.id} className="item-card group">
                                <div className="aspect-[2/3] bg-muted relative overflow-hidden">
                                  {fav.poster ? (
                                    <img
                                      src={fav.poster}
                                      alt={fav.title}
                                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                      loading="lazy"
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-secondary/30">
                                      <Heart className="h-8 w-8 text-muted-foreground/30" />
                                    </div>
                                  )}
                                  {isAdmin && (
                                    <div
                                      className="absolute top-2 right-2 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <Button
                                        variant="secondary"
                                        size="icon"
                                        className="h-7 w-7 bg-background/80 backdrop-blur-sm"
                                        onClick={() => removeFavourite(fav.id)}
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    </div>
                                  )}
                                </div>
                                <div className="p-3">
                                  <h3 className="font-serif text-sm font-medium leading-tight">
                                    <span className="line-clamp-2" style={{ textWrap: 'balance' as any }}>{fav.title}</span>
                                  </h3>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </div>
        ) : (
          <div className="px-4 md:px-0 py-6">
            <div className={CARD_GRID}>
              {loading ? (
                [...Array(12)].map((_, i) => (
                  <Skeleton key={i} className="h-64 rounded-lg" />
                ))
              ) : filteredWatchlist.length === 0 ? (
                <p className="col-span-full text-center py-16 text-muted-foreground">
                  No items in {selectedCategory.toLowerCase()} yet
                </p>
              ) : (
                visibleWatchlist.map((item) => (
                  <WatchlistCard
                    key={item.id}
                    item={item}
                    onRemove={isAdmin ? removeWatchlistItemAndSchedule : undefined}
                    getCategoryIcon={getCategoryIcon}
                    toggleEpisodeWatched={
                      isAdmin ? toggleEpisodeWatched : undefined
                    }
                    toggleSeasonWatched={
                      isAdmin ? toggleSeasonWatched : undefined
                    }
                    isEpisodeWatched={isEpisodeWatched}
                    isSeasonWatched={isSeasonWatched}
                    getAutoStatus={getAutoStatus}
                    addToSchedule={isAdmin ? addToSchedule : undefined}
                    removeFromSchedule={
                      isAdmin ? removeFromScheduleByWatchlistId : undefined
                    }
                    isInSchedule={isInSchedule}
                    onMoveToFavourites={isAdmin ? handleOpenMoveDialog : undefined}
                    onResync={isAdmin ? syncSingleItem : undefined}
                    syncing={syncing}
                  />
                ))
              )}
            </div>
            {visibleCount < filteredWatchlist.length && (
              <div ref={observerTarget} className="h-20 w-full" />
            )}
          </div>
        )}

        {/* Move to Favourites Dialog */}
        <Dialog open={moveDialogOpen} onOpenChange={setMoveDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-serif">
                Move to Favourites
              </DialogTitle>
              <DialogDescription className="sr-only">
                Add this item to favourites and optionally remove it from your watchlist.
              </DialogDescription>
            </DialogHeader>
            {moveItem && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Add <span className="font-medium text-foreground">"{moveItem.title}"</span> to your favourites.
                </p>

                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select
                    value={selectedFavCategory}
                    onValueChange={(value) =>
                      setSelectedFavCategory(value as any)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FAV_CATEGORIES.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setMoveDialogOpen(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={async () => {
                      const mediaType = moveItem.category === 'Movies' ? 'movie' : 'tv';
                      const posterUrl = moveItem.image_url || undefined;

                      try {
                        await addFavourite({
                          title: moveItem.title,
                          poster: posterUrl,
                          media_type: mediaType,
                          tmdb_id: moveItem.tmdb_id,
                          category: selectedFavCategory,
                        });

                        await removeWatchlistItem(moveItem.id);
                        if (isInSchedule(moveItem.id)) {
                          removeFromScheduleByWatchlistId(moveItem.id);
                        }
                        setMoveDialogOpen(false);
                      } catch (error) {
                        console.error('Error moving item to favourites:', error);
                      }
                    }}
                    className="flex-1 gap-1.5"
                  >
                    <Heart className="h-4 w-4 fill-current" />
                    Move
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Footer />
      </div>
    </div>
  );
};

export default Watchlist;
