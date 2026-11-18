import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { DotMatrixText } from '@/components/dot-matrix/DotMatrixText';
import { CountLabel } from '@/components/shared/CountLabel';
import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from 'react';
import {
  useWatchlist,
  WatchlistItem,
  FavouriteItem,
} from '@/features/watchlist/useWatchlist';
import { useSchedule } from '@/features/watchlist/useSchedule';
import { useTMDB } from '@/features/watchlist/useTMDB';
import type { TMDBResult } from '@/features/watchlist/useTMDB';
import {
  FAVOURITE_CATEGORIES,
  resolveFavouriteCategory,
  type TmdbFacts,
} from '@/features/watchlist/favourite-category';
import { useAuth } from '@/contexts/AuthContext';
import { titleKey, type TitleRef } from './title-ref';
import {
  buildDisplaySyncLog,
  formatSyncPart,
  type DisplaySyncLogEntry,
} from '@/features/watchlist/sync-logic';
import { SyncDetailDialog } from '@/features/watchlist/components/SyncDetailDialog';
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
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Bell,
  Bookmark,
  CalendarClock,
  EyeOff,
  PauseCircle,
  X,
  Search,
  RefreshCcw,
  Tv,
  Film,
  Eye,
  History,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Timer,
  Heart,
  Trash2,
  Loader2,
  Newspaper,
  Library,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { formatRelativeTime } from '@/lib/format-date';
import { useDeleteConfirm } from '@/hooks/useDeleteConfirm';
import { formatCooldownEnd } from '@/hooks/useCooldown';
import { Filter } from 'lucide-react';
import { SyncHistoryIcon } from '@/components/shared/SyncHistoryIcon';
import { WatchlistCard } from '@/features/watchlist/components/WatchlistCard';
import { CardGrid } from '@/components/shared/CardGrid';
import { useDockedDetailOpen } from '@/contexts/WorkspaceInspectorContext';
import {
  compareTimeToFinish,
  timeToFinish,
  timeToFinishLabel,
  type TimeToFinish,
} from '@/features/watchlist/time-to-finish';
import { formatRuntime } from '@/features/watchlist/watchlist-utils';
import { TmdbSearchDialog } from '@/features/watchlist/components/TmdbSearchDialog';
import { SegmentedControl } from '@/features/watchlist/components/SegmentedControl';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  PlatformLogo,
  hasPlatformLogo,
  platformLabel,
} from '@/features/watchlist/components/PlatformLogo';
import {
  LIBRARY_SHELVES,
  LIBRARY_TYPE_OPTIONS,
  MORE_SHELVES,
  libraryShelf,
  matchesLibraryType,
  nextAirDate,
  shelfFromParam,
  type LibraryShelf,
  type LibraryType,
} from '@/features/watchlist/library-state';

/**
 * Library sort orders. `finish` ranks by time left to watch: a show's aired,
 * unwatched episodes, or a film's runtime. `watched` puts the latest watch
 * date first; titles without one follow in title order.
 */
type LibrarySort = 'alphabetical' | 'recent' | 'finish' | 'watched' | 'rating';

/** Status shelves first, then Favourites, then the two set-aside shelves. */
type Shelf = LibraryShelf | 'Favourites';
const MAIN_SHELVES: Shelf[] = [...LIBRARY_SHELVES, 'Favourites'];
const SHELVES: Shelf[] = [...MAIN_SHELVES, ...MORE_SHELVES];

/** Each shelf's own orders, default first. Upcoming and Up to date run by date. */
const SHELF_SORTS: Record<Shelf, LibrarySort[]> = {
  Watching: ['alphabetical', 'recent', 'finish'],
  'To watch': ['alphabetical', 'recent', 'finish'],
  Upcoming: [],
  'Up to date': [],
  Finished: ['watched', 'rating', 'alphabetical'],
  Favourites: [],
  'Stopped watching': ['alphabetical', 'rating'],
  Hidden: ['alphabetical'],
};

/** What each shelf holds, said once under its count. */
const SHELF_HINTS: Record<Shelf, string> = {
  Watching: 'Series you have started, with aired episodes still to watch. Films go straight from To watch to Finished.',
  'To watch': 'Out now, and not started yet.',
  Upcoming: 'Saved, with nothing released yet.',
  'Up to date': 'Series you are caught up on. Each moves back to Watching when its next episode airs.',
  Finished: 'Films you have watched, and ended series watched to the last episode.',
  Favourites: 'Titles you have hearted. A favourite also stays on its own shelf.',
  'Stopped watching': 'Set aside, with your progress and ratings kept.',
  Hidden: 'Kept off every other shelf, with your history kept.',
};

const SORT_LABELS: Record<LibrarySort, string> = {
  alphabetical: 'Title: A–Z',
  recent: 'Latest releases',
  finish: 'Quickest to finish',
  watched: 'Recently watched',
  rating: 'Your rating',
};

const LIBRARY_TYPE_KEY = 'watchlist-library-type';
const readStoredType = (): LibraryType => {
  try {
    const stored = localStorage.getItem(LIBRARY_TYPE_KEY);
    return stored === 'movie' || stored === 'tv' ? stored : 'all';
  } catch {
    return 'all';
  }
};


const ALL_PLATFORMS = [
  'Netflix',
  'Prime Video',
  'Disney+',
  'Apple TV+',
  'BBC iPlayer',
  'ITVX',
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
    syncAvailableAt,
    lastSyncTime,
    lastAutoSyncTime,
    nextAutoSyncTime,
    syncLog,
    autoSyncEnabled,
    syncWatchlist,
    syncSingleItem,
    syncFavouriteFacts,
    cancelSync,
    toggleEpisodeWatched,
    toggleSeasonWatched,
    isEpisodeWatched,
    isSeasonWatched,
    getAutoStatus,
  } = useWatchlist();
  const {
    addToSchedule,
    removeFromScheduleByWatchlistId,
    isInSchedule,
  } = useSchedule();

  // removeWatchlistItem alone leaves a dangling weekly_schedule row behind
  // (watchlist and schedule are separate hooks/tables) -- always clear the
  // schedule entry too so deleting a show doesn't leave a stale "scheduled"
  // count on some day of the week.
  const { askDelete, deleteDialog } = useDeleteConfirm();

  const removeWatchlistItemAndSchedule = useCallback(
    async (ref: TitleRef) => {
      await removeWatchlistItem(ref);
      await removeFromScheduleByWatchlistId(ref);
    },
    [removeWatchlistItem, removeFromScheduleByWatchlistId],
  );

  const [open, setOpen] = useState(false);
  const [viewParams] = useSearchParams();
  // ?category=favourites opens on that shelf: the About page's favourite cards
  // link here. Old tab slugs map onto the new shelves (shelfFromParam).
  const linked = shelfFromParam(viewParams.get('category'));
  const [selectedCategory, setSelectedCategory] = useState<Shelf>(() => linked?.shelf ?? 'Watching');
  // A link opens on All unless it names a type, so the About page's
  // favourites link never hides half of them. Only a pick is remembered.
  const [libraryType, setLibraryTypeState] = useState<LibraryType>(() => (linked ? linked.type ?? 'all' : readStoredType()));
  const setLibraryType = (type: LibraryType) => {
    setLibraryTypeState(type);
    try {
      localStorage.setItem(LIBRARY_TYPE_KEY, type);
    } catch {
      // Unavailable storage only means the choice resets next visit.
    }
  };
  const [searchQuery, setSearchQuery] = useState('');
  // A search looks across every shelf, so a finished title is still found
  // from Watching.
  const searching = searchQuery.trim() !== '';
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  // Visitors never order by a rating they cannot see.
  const sortOptions = searching
    ? []
    : SHELF_SORTS[selectedCategory].filter((option) => option !== 'rating' || isAdmin);
  const [sortOrder, setSortOrder] = useState<LibrarySort>(() => SHELF_SORTS[selectedCategory][0] ?? 'alphabetical');
  const sortable = sortOptions.length > 1;
  const byTimeLeft = sortable && sortOrder === 'finish';
  const [title, setTitle] = useState('');
  // Keyed `${media_type}-${id}`: a film and a series can share a TMDB id.
  const [addedItems, setAddedItems] = useState<Set<string>>(new Set());
  // Covers the whole click-to-completion span, including the getMovieDetails
  // fetch that happens before addWatchlistItem is even called -- without
  // this, a second click during that window (or the multi-second TV season
  // fetch) could kick off a duplicate add.
  const [pendingResultIds, setPendingResultIds] = useState<Set<string>>(
    new Set(),
  );
  const [showSyncLog, setShowSyncLog] = useState(false);
  const [selectedSyncEntry, setSelectedSyncEntry] = useState<DisplaySyncLogEntry | null>(null);
  const displaySyncLog = useMemo(() => buildDisplaySyncLog(syncLog), [syncLog]);
  const showSyncPercent = syncing && syncProgress !== null;
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

  /**
   * The TMDB facts a search row already carries. `search/tv` returns all
   * three; `search/movie` omits origin_country, which the derivation covers
   * from original_language instead.
   */
  const factsFor = (result: TMDBResult): TmdbFacts => ({
    original_language: result.original_language ?? null,
    origin_country: result.origin_country ?? null,
    genre_ids: result.genre_ids ?? null,
  });

  const handleAddFavourite = useCallback(
    async (result: TMDBResult) => {
      const resultKey = `${result.media_type}-${result.id}`;
      try {
        await addFavourite({
          title: result.title || result.name || '',
          poster: result.poster_path
            ? getPosterUrl(result.poster_path) || undefined
            : undefined,
          media_type: result.media_type,
          tmdb_id: result.id,
          facts: factsFor(result),
        });
        setFavAddedItems((prev) => new Set(prev).add(resultKey));
      } catch {
        // addFavourite has already shown the failure.
      }
    },
    [addFavourite, getPosterUrl],
  );

  const handleAddWatchlistItem = useCallback(
    async (result: TMDBResult) => {
      // pendingResultIds covers the whole click-to-completion span, including
      // the getMovieDetails fetch before addWatchlistItem is even called.
      const resultKey = `${result.media_type}-${result.id}`;
      setPendingResultIds((prev) => new Set(prev).add(resultKey));
      try {
        const details = await getMovieDetails(result.id, result.media_type);
        if (!details) return;
        await addWatchlistItem({
          title: details.release_year
            ? `${details.title} (${details.release_year})`
            : details.title,
          // The result's own type: with All selected the search spans both.
          category: result.media_type === 'tv' ? 'TV Shows' : 'Movies',
          description: details.overview,
          year: details.release_year || undefined,
          image_url: details.poster || undefined,
          backdrop_url: details.backdrop || undefined,
          runtime: details.runtime || undefined,
          genres: details.genres,
          tmdb_id: details.tmdb_id,
          release_date: details.release_date,
          streaming_platform: details.platform,
          trailer_key: details.trailer_key ?? undefined,
          directors: details.directors ?? undefined,
          creators: details.creators ?? undefined,
          top_cast: details.top_cast ?? undefined,
        });
        setAddedItems((prev) => new Set(prev).add(resultKey));
      } catch {
        // addWatchlistItem has already shown the failure.
      } finally {
        setPendingResultIds((prev) => {
          const next = new Set(prev);
          next.delete(resultKey);
          return next;
        });
      }
    },
    [addWatchlistItem, getMovieDetails],
  );

  /**
   * One way to favourite, the same as the detail view's heart: a toggle. The
   * favourite's shelf section is derived from TMDB facts
   * (resolveFavouriteCategory), so nothing is asked.
   */
  const favouriteFor = useCallback(
    (item: WatchlistItem) => {
      const mediaType = item.category === 'TV Shows' ? 'tv' : 'movie';
      return favourites.find((candidate) => candidate.media_type === mediaType && (item.tmdb_id ? candidate.tmdb_id === item.tmdb_id : candidate.title === item.title));
    },
    [favourites],
  );
  const toggleFavourite = useCallback(
    (item: WatchlistItem) => {
      const existing = favouriteFor(item);
      if (existing) {
        void removeFavourite(existing.id);
        return;
      }
      void addFavourite({ title: item.title, poster: item.image_url, media_type: item.category === 'TV Shows' ? 'tv' : 'movie', tmdb_id: item.tmdb_id }).catch(() => {
        // addFavourite has already shown the failure.
      });
    },
    [addFavourite, favouriteFor, removeFavourite],
  );

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

  // The add search follows the type filter; with All it searches films and
  // series together.
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      if (title.length >= 2) {
        const yearMatch = title.match(/\((\d{4})\)\s*$/);
        const year = yearMatch ? parseInt(yearMatch[1]) : undefined;
        const cleanTitle = title.replace(/\s*\(\d{4}\)\s*$/, '').trim();
        if (libraryType === 'all') tmdbSearchMulti(cleanTitle);
        else tmdbSearch(cleanTitle, libraryType === 'tv' ? 'TV Shows' : 'Movies', year);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [open, title, libraryType, tmdbSearch, tmdbSearchMulti]);

  // One classification per title, rebuilt when the library changes.
  const shelfByItem = useMemo(
    () => new Map(watchlist.map((item) => [titleKey(item), libraryShelf(item)])),
    [watchlist],
  );

  // While a title's detail is open, titles keep the shelf they were on, so
  // marking one watched there does not pull its card off the grid and close
  // the detail (and its "rate it?" prompt) mid-use. The counts stay live;
  // the grid catches up when the detail closes.
  const detailOpen = useDockedDetailOpen();
  const [heldShelves, setHeldShelves] = useState(shelfByItem);
  if (!detailOpen && heldShelves !== shelfByItem) setHeldShelves(shelfByItem);
  const gridShelfOf = useCallback(
    (item: WatchlistItem) => (detailOpen ? heldShelves.get(titleKey(item)) : undefined) ?? shelfByItem.get(titleKey(item)),
    [detailOpen, heldShelves, shelfByItem],
  );

  const categoryItems = useMemo(() => {
    const typed = watchlist.filter((item) => matchesLibraryType(item, libraryType));
    // Hidden and Stopped watching are the owner's own shelves.
    const isPrivate = (item: WatchlistItem) => (MORE_SHELVES as readonly string[]).includes(shelfByItem.get(titleKey(item)) ?? '');
    if (!isAdmin && (MORE_SHELVES as readonly string[]).includes(selectedCategory)) return [];
    if (searching) return isAdmin ? typed : typed.filter((item) => !isPrivate(item));
    const onShelf = typed.filter((item) => gridShelfOf(item) === selectedCategory);
    if (selectedCategory !== 'Upcoming' && selectedCategory !== 'Up to date') return onShelf;
    // Soonest first; a title with no known date goes last.
    const today = new Date();
    return onShelf
      .map((item) => ({ item, date: nextAirDate(item, today) }))
      .sort((a, b) => (a.date ?? '9999').localeCompare(b.date ?? '9999') || a.item.title.localeCompare(b.item.title))
      .map(({ item }) => item);
  }, [watchlist, libraryType, searching, shelfByItem, gridShelfOf, selectedCategory, isAdmin]);

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
          rawStatus === 'Canceled' ||
          rawStatus === 'Cancelled' ||
          rawStatus === 'Ended'
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

  // Time left per show, built only while a time order is picked.
  // isEpisodeWatched is a stable callback, so this does not rebuild on its
  // account: it rebuilds because a watched toggle replaces the watchlist
  // array, and categoryItems with it.
  const finishTimes = useMemo(() => {
    const times = new Map<string, TimeToFinish>();
    if (!byTimeLeft) return times;
    const today = new Date();
    for (const item of categoryItems) {
      if (item.category !== 'TV Shows') continue;
      times.set(
        titleKey(item),
        timeToFinish(
          item.seasons,
          (seasonNumber, episodeNumber) =>
            isEpisodeWatched(item.id, seasonNumber, episodeNumber),
          today,
        ),
      );
    }
    return times;
  }, [categoryItems, byTimeLeft, isEpisodeWatched]);

  // Recently watched and Your rating sort on a title's own date and score;
  // keyed here so the hold below can freeze them too.
  const sortKeys = useMemo(() => {
    if (!sortable || (sortOrder !== 'watched' && sortOrder !== 'rating')) return null;
    return new Map(categoryItems.map((item) => [
      titleKey(item),
      sortOrder === 'watched' ? item.watched_at ?? '' : item.personal_rating ?? 0,
    ] as const));
  }, [categoryItems, sortable, sortOrder]);

  // The order is held while a title's detail is open. Marking episodes
  // watched, undoing a watch or scoring a title there would otherwise
  // re-rank the grid under it, and a card pushed past the rendered page
  // unmounts and closes its own detail. The labels stay live; the order
  // catches up when the detail closes, or at once if the sort or category
  // changes.
  const rankKey = `${selectedCategory}|${libraryType}|${sortOrder}|${byTimeLeft}`;
  const [ranking, setRanking] = useState({ key: rankKey, times: finishTimes, keys: sortKeys });
  if ((ranking.times !== finishTimes || ranking.keys !== sortKeys) && (!detailOpen || ranking.key !== rankKey)) {
    setRanking({ key: rankKey, times: finishTimes, keys: sortKeys });
  }
  const rankTimes = ranking.times;
  const heldKeys = ranking.keys;

  const filteredWatchlist = useMemo(() => {
    let result = categoryItems;
    if (selectedPlatform)
      result = result.filter(
        (item) => item.streaming_platform === selectedPlatform,
      );
    if (selectedGenre)
      result = result.filter((item) => item.genres?.includes(selectedGenre));
    if (selectedStatus) {
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
    if (searching || sortable) {
      result = [...result].sort((a, b) => {
        if (searching || sortOrder === 'alphabetical') return a.title.localeCompare(b.title);
        if (sortOrder === 'watched') {
          // ISO timestamps compare as strings; no date sorts last.
          const date = (item: WatchlistItem) => String(heldKeys?.get(titleKey(item)) ?? item.watched_at ?? '');
          const byDate = date(b).localeCompare(date(a));
          return byDate || a.title.localeCompare(b.title);
        }
        if (sortOrder === 'rating') {
          const score = (item: WatchlistItem) => Number(heldKeys?.get(titleKey(item)) ?? item.personal_rating ?? 0);
          const byRating = score(b) - score(a);
          return byRating || a.title.localeCompare(b.title);
        }
        if (byTimeLeft) {
          const ta = rankTimes.get(titleKey(a)) ?? finishTimes.get(titleKey(a));
          const tb = rankTimes.get(titleKey(b)) ?? finishTimes.get(titleKey(b));
          if (ta && tb) {
            return compareTimeToFinish(ta, tb) || a.title.localeCompare(b.title);
          }
          // A film against a film or a show, by minutes left: a film's
          // runtime, a show's minutes still to watch. No figure goes last.
          const ra = (ta ? ta.minutesLeft : a.runtime) || Infinity;
          const rb = (tb ? tb.minutesLeft : b.runtime) || Infinity;
          if (ra !== rb) return ra < rb ? -1 : 1;
          return a.title.localeCompare(b.title);
        }
        if (sortOrder === 'recent') {
          // A show by its latest season, a film by its release.
          const latest = (item: WatchlistItem) => {
            const dates = [item.release_date, ...(item.seasons ?? []).map((season) => season.release_date)]
              .filter((date): date is string => !!date)
              .map((date) => new Date(date).getTime());
            return Math.max(...dates, 0);
          };
          return latest(b) - latest(a);
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
    searching,
    sortable,
    sortOrder,
    byTimeLeft,
    finishTimes,
    rankTimes,
    heldKeys,
  ]);

  const getCategoryIcon = (shelf: Shelf) => {
    switch (shelf) {
      case 'Watching':
        return <Eye className="h-4 w-4" />;
      case 'To watch':
        return <Bookmark className="h-4 w-4" />;
      case 'Upcoming':
        return <Bell className="h-4 w-4" />;
      case 'Up to date':
        return <CalendarClock className="h-4 w-4" />;
      case 'Finished':
        return <CheckCircle className="h-4 w-4" />;
      case 'Favourites':
        return <Heart className="h-4 w-4" />;
      case 'Stopped watching':
        return <PauseCircle className="h-4 w-4" />;
      case 'Hidden':
        return <EyeOff className="h-4 w-4" />;
    }
  };

  const typedFavourites = useMemo(
    () => favourites.filter((favourite) => libraryType === 'all' || favourite.media_type === libraryType),
    [favourites, libraryType],
  );

  const categoryCounts = useMemo(() => {
    const counts = Object.fromEntries(SHELVES.map((shelf) => [shelf, 0])) as Record<Shelf, number>;
    counts.Favourites = typedFavourites.length;
    watchlist.forEach((item) => {
      const shelf = shelfByItem.get(titleKey(item));
      if (shelf && matchesLibraryType(item, libraryType)) counts[shelf]++;
    });
    return counts;
  }, [watchlist, typedFavourites, shelfByItem, libraryType]);

  // Reset visible count when filters change
  useEffect(() => {
    setVisibleCount(48);
  }, [
    selectedCategory,
    libraryType,
    searchQuery,
    selectedPlatform,
    selectedGenre,
    selectedStatus,
    sortOrder,
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

  // While a time order is picked, each card says what it is ranked by.
  const timeLeftLabel = (item: WatchlistItem): string | undefined => {
    if (!byTimeLeft) return undefined;
    const finish = finishTimes.get(titleKey(item));
    if (finish) return timeToFinishLabel(finish);
    return item.runtime ? formatRuntime(item.runtime) : undefined;
  };

  const activeFilterCount = [selectedPlatform, selectedGenre, selectedStatus].filter(Boolean).length;

  const renderCard = (item: WatchlistItem) => (
    <WatchlistCard
      key={titleKey(item)}
      item={item}
      timeLeft={timeLeftLabel(item)}
      onRemove={isAdmin ? removeWatchlistItemAndSchedule : undefined}
      toggleEpisodeWatched={isAdmin ? toggleEpisodeWatched : undefined}
      toggleSeasonWatched={isAdmin ? toggleSeasonWatched : undefined}
      isEpisodeWatched={isEpisodeWatched}
      isSeasonWatched={isSeasonWatched}
      getAutoStatus={getAutoStatus}
      addToSchedule={isAdmin ? addToSchedule : undefined}
      removeFromSchedule={isAdmin ? removeFromScheduleByWatchlistId : undefined}
      isInSchedule={isInSchedule}
      isFavourite={!!favouriteFor(item)}
      onToggleFavourite={isAdmin ? toggleFavourite : undefined}
      onResync={isAdmin ? syncSingleItem : undefined}
      syncing={syncing}
    />
  );

  const toolbar = (
    <div className="watchlist-toolbar watchlist-library-toolbar space-y-2 py-2">
      {/* Wraps rather than overflowing: past the viewport edge it widens the
          whole page on a phone. ml-auto keeps the actions right if they drop. */}
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <nav aria-label="Watchlist" className="flex items-center gap-1">
          <Button asChild variant="ghost" className="gap-2"><Link to="/watchlist"><Newspaper className="h-4 w-4" />News</Link></Button>
          <Button asChild variant="secondary" className="gap-2"><Link to="/watchlist/library" aria-current="page"><Library className="h-4 w-4" />Library</Link></Button>
        </nav>
        <div className="ml-auto flex items-center gap-1">
        {isAdmin && selectedCategory === 'Favourites' && (
          <div className="flex items-center gap-2">
            <TmdbSearchDialog
              open={favDialogOpen}
              onOpenChange={setFavDialogOpen}
              triggerLabel="Add"
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
                      'text-xs px-2 py-0.5 rounded font-medium bg-secondary text-muted-foreground',
                    )}
                  >
                    {r.media_type === 'movie' ? 'Movie' : 'TV Show'}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded font-medium bg-muted text-muted-foreground border border-border">
                    Auto: {resolveFavouriteCategory(factsFor(r))}
                  </span>
                  {favAddedItems.has(`${r.media_type}-${r.id}`) && (
                    <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                      Added
                    </span>
                  )}
                </div>
              )}
            />
          </div>
        )}
        {isAdmin && selectedCategory !== 'Favourites' && (
          <TmdbSearchDialog
            open={open}
            onOpenChange={setOpen}
            triggerLabel="Add"
            title="Add to Watchlist"
            description="Search and add items to your watchlist."
            searchLabel={libraryType === 'movie' ? 'Search films' : libraryType === 'tv' ? 'Search series' : 'Search films and series'}
            placeholder={libraryType === 'movie' ? 'Type a film name…' : libraryType === 'tv' ? 'Type a series name…' : 'Type a film or series name…'}
            query={title}
            onQueryChange={setTitle}
            results={searchResults}
            loading={searchLoading}
            getPosterUrl={getPosterUrl}
            resultKey={(r) => `${r.media_type}-${r.id}`}
            isDisabled={(r) =>
              addedItems.has(`${r.media_type}-${r.id}`) || pendingResultIds.has(`${r.media_type}-${r.id}`)
            }
            onSelect={handleAddWatchlistItem}
            renderStatus={(r) =>
              pendingResultIds.has(`${r.media_type}-${r.id}`) ? (
                <span className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Adding...
                </span>
              ) : addedItems.has(`${r.media_type}-${r.id}`) ? (
                <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                  Item Added
                </span>
              ) : null
            }
          />
        )}

          {isAdmin && (
            <Popover open={showSyncLog} onOpenChange={setShowSyncLog}>
              <PopoverTrigger asChild>
                {/* Below sm the icon stands in for "Sync" and "Syncing…". Once
                    a percentage is known it takes the icon's place instead:
                    beside the icon it would push the actions onto a second
                    line at 375px for as long as the sync runs. */}
                <Button variant="ghost" className="gap-2 px-3 sm:px-4" aria-label={syncing ? (syncProgress === null ? 'Syncing' : `Syncing ${syncProgress}%`) : 'Sync'}>
                  <SyncHistoryIcon spinning={syncing} className={cn('h-4 w-4', showSyncPercent && 'max-sm:hidden')} />
                  <span className={showSyncPercent ? 'tabular-nums' : 'sr-only sm:not-sr-only'}>{syncing ? (syncProgress === null ? 'Syncing…' : `${syncProgress}%`) : 'Sync'}</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" collisionPadding={12} className="flex w-[380px] max-w-[calc(100vw-24px)] flex-col gap-3 overflow-hidden" style={{ maxHeight: 'min(480px, var(--radix-popover-content-available-height))' }} aria-label="Sync history">
          <div className="flex shrink-0 items-center justify-between gap-2">
            <h3 className="text-xs font-semibold flex items-center gap-1.5 text-muted-foreground">
              <History className="h-3 w-3" />
              <DotMatrixText text="SYNC HISTORY" size="xs" />
            </h3>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => syncWatchlist()}
                // The server refuses a full sync inside its cooldown whatever
                // the button says; disabling it only tells you before you ask.
                disabled={syncing || syncAvailableAt !== null}
                className="gap-1.5 relative overflow-hidden h-11"
              >
                {syncing && syncProgress !== null && (
                  <div
                    className="absolute left-0 top-0 bottom-0 bg-primary/20 transition-[width] duration-300 ease-out"
                    style={{ width: `${syncProgress}%` }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-1.5">
                  <RefreshCcw
                    className={cn('h-3.5 w-3.5', syncing && 'animate-spin')}
                  />
                  <span>
                    {syncing
                      ? syncProgress === null ? 'Syncing…' : `${syncProgress}%`
                      : syncAvailableAt !== null
                        ? `Next sync ${formatCooldownEnd(syncAvailableAt)}`
                        : 'Sync now'}
                  </span>
                </span>
              </Button>
              {/* Only favourite facts can be stopped; a library sync runs server-side. */}
              {syncing && syncProgress !== null && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={cancelSync}
                  className="h-11 w-11 px-2 text-muted-foreground hover:text-destructive"
                  aria-label="Stop sync"
                  title="Stop sync"
                >
                  <XCircle className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSyncLog(false)}
                className="h-11 w-11 p-0" aria-label="Close sync history"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
          {displaySyncLog.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-2">
              No sync history yet
            </p>
          ) : (
            <div
              className="min-h-0 flex-1 space-y-1.5 overflow-y-auto overscroll-contain pr-1"
            >
              {displaySyncLog.map((entry) => {
                const failureMatch = entry.error_message?.match(
                  /^(\d+)\s*item\(s\)\s*failed/i,
                );
                const failureCountBadge = failureMatch
                  ? `${failureMatch[1]} failed`
                  : null;
                return (
                  <button
                    type="button"
                    key={entry.id}
                    onClick={() => setSelectedSyncEntry(entry)}
                    title="Click to view sync run details"
                    className={cn(
                      'flex w-full min-h-11 items-center justify-between gap-2 text-left text-xs py-2 px-1.5 rounded transition-colors',
                      entry.is_missed || entry.status === 'error'
                        ? 'bg-destructive/10 hover:bg-destructive/20 border border-destructive/20'
                        : entry.error_message
                          ? 'bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20'
                          : 'bg-secondary/30 hover:bg-secondary/60',
                    )}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      {entry.is_missed || entry.status === 'error' ? (
                        <XCircle className="h-2.5 w-2.5 text-destructive flex-shrink-0" />
                      ) : entry.error_message ? (
                        <AlertTriangle className="h-2.5 w-2.5 text-amber-500 flex-shrink-0" />
                      ) : (
                        <CheckCircle className="h-2.5 w-2.5 text-muted-foreground flex-shrink-0" />
                      )}
                      <span
                        className={cn(
                          'px-1 py-px rounded text-xs font-semibold tracking-wide flex-shrink-0',
                          entry.is_missed || entry.status === 'error'
                            ? 'bg-destructive/20 text-destructive'
                            : entry.error_message
                              ? 'bg-amber-500/20 text-amber-500'
                              : 'bg-secondary text-muted-foreground',
                        )}
                      >
                        {entry.is_missed
                          ? 'MISSED'
                          : entry.sync_type === 'auto'
                            ? 'AUTO'
                            : entry.sync_type === 'daily'
                              ? 'DAILY'
                              : 'MAN'}
                      </span>
                      <span
                        className={cn(
                          'truncate',
                          entry.is_missed
                            ? 'text-destructive font-medium'
                            : 'text-muted-foreground',
                        )}
                      >
                        {entry.is_missed
                          ? 'No execution recorded'
                          : `${entry.items_synced} items · ${(entry.duration_ms / 1000).toFixed(1)}s`}
                        {formatSyncPart(entry) && ` · ${formatSyncPart(entry)}`}
                      </span>
                      {failureCountBadge && !entry.is_missed && (
                        <span className="text-xs px-1 py-px rounded bg-destructive/15 text-destructive font-medium flex-shrink-0">
                          {failureCountBadge}
                        </span>
                      )}
                    </div>
                    <span className="text-muted-foreground text-xs whitespace-nowrap flex-shrink-0">
                      {new Date(entry.synced_at).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          <div className="shrink-0 text-xs text-muted-foreground border-t border-border/50 pt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1">
            {lastSyncTime && (
              <span>Last synced: {formatRelativeTime(lastSyncTime)}</span>
            )}
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
              </PopoverContent>
            </Popover>
          )}
        </div>
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <Select value={selectedCategory} onValueChange={(value) => {
          const shelf = value as Shelf;
          setSelectedCategory(shelf);
          setSortOrder(SHELF_SORTS[shelf][0] ?? 'alphabetical');
          setSelectedPlatform(null); setSelectedGenre(null); setSelectedStatus(null); setSearchQuery('');
        }}>
          {/* A search covers every shelf, so the picker says so; picking a
              shelf clears the search and opens that shelf. */}
          <SelectTrigger aria-label="Library shelf" className="h-11 w-[210px] shrink-0 text-sm">
            {/* Always given children: Radix portals the picked item's text in
                otherwise, and switching between the two crashes the tree. */}
            <SelectValue>
              {searching ? 'All shelves' : <span className="flex items-center gap-2">{getCategoryIcon(selectedCategory)}{selectedCategory} ({categoryCounts[selectedCategory]})</span>}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {MAIN_SHELVES.map((shelf) => (
              <SelectItem key={shelf} value={shelf}>
                <span className="flex items-center gap-2">{getCategoryIcon(shelf)}{shelf} ({categoryCounts[shelf]})</span>
              </SelectItem>
            ))}
            {isAdmin && <SelectSeparator />}
            {isAdmin && MORE_SHELVES.map((shelf) => (
              <SelectItem key={shelf} value={shelf}>
                <span className="flex items-center gap-2 text-muted-foreground">{getCategoryIcon(shelf)}{shelf} ({categoryCounts[shelf]})</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <SegmentedControl label="Show films, series or both" options={LIBRARY_TYPE_OPTIONS} value={libraryType} onChange={setLibraryType} />
        {selectedCategory !== 'Favourites' && <>
          {/* 12rem holds the whole placeholder; narrower, the box drops below the category picker. */}
          <div className="relative min-w-[12rem] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input aria-label="Search your whole library" placeholder="Search library…" value={searchQuery} onChange={event => setSearchQuery(event.target.value)} className={cn('h-11 w-full pl-9', searchQuery && 'pr-10')} />
            {searchQuery && <Button variant="ghost" size="icon" className="absolute right-0 top-0 h-11 w-11" aria-label="Clear search" onClick={() => setSearchQuery('')}><X className="h-4 w-4" /></Button>}
          </div>
          <Popover open={filtersOpen} onOpenChange={setFiltersOpen}>
            <PopoverTrigger asChild><Button variant="outline" className="h-11 gap-2"><Filter className="h-4 w-4" />Filters{activeFilterCount > 0 && ` (${activeFilterCount})`}</Button></PopoverTrigger>
            <PopoverContent align="end" collisionPadding={12} className="w-80 max-w-[calc(100vw-24px)] overflow-y-auto overscroll-contain space-y-3" style={{ maxHeight: 'min(480px, var(--radix-popover-content-available-height))' }} aria-label="Library filters">
              <div className="flex items-center justify-between"><h3 className="font-medium">Filter library</h3><Button variant="ghost" size="sm" onClick={() => { setSelectedPlatform(null); setSelectedGenre(null); setSelectedStatus(null); }}>Reset</Button></div>
              <Select
                value={selectedPlatform || 'all'}
                onValueChange={(v) =>
                  setSelectedPlatform(v === 'all' ? null : v)
                }
              >
                <SelectTrigger aria-label="Platform" className="w-full h-11 text-sm">
                  <div className="flex items-center gap-2 truncate">
                    {!selectedPlatform && (
                      <Filter className="h-3 w-3 opacity-50" />
                    )}
                    <SelectValue placeholder="Platform">
                      {!selectedPlatform ? (
                        'All Platforms'
                      ) : hasPlatformLogo(selectedPlatform) ? (
                        <PlatformLogo
                          platform={selectedPlatform}
                          size={16}
                          maxWidth={90}
                        />
                      ) : (
                        platformLabel(selectedPlatform)
                      )}
                    </SelectValue>
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Platforms</SelectItem>
                  {ALL_PLATFORMS.filter((p) => getPlatformCount(p) > 0).map(
                    (p) => (
                      <SelectItem key={p} value={p}>
                        <div className="flex items-center justify-between gap-4 w-full">
                          <span className="flex items-center gap-2">
                            <PlatformLogo platform={p} size={18} />
                            <span
                              className={cn(hasPlatformLogo(p) && 'sr-only')}
                            >
                              {platformLabel(p)}
                            </span>
                          </span>
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
                onValueChange={(v) => setSelectedGenre(v === 'all' ? null : v)}
              >
                <SelectTrigger aria-label="Genre" className="w-full h-11 text-sm">
                  <div className="flex items-center gap-2 truncate">
                    <Filter className="h-3 w-3 opacity-50" />
                    <SelectValue placeholder="Genre" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Genres</SelectItem>
                  {ALL_GENRES.filter((g) => getGenreCount(g) > 0).map((g) => (
                    <SelectItem key={g} value={g}>
                      <div className="flex items-center justify-between gap-4 w-full">
                        <span>{g}</span>
                        <span className="text-xs opacity-50">
                          ({getGenreCount(g)})
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {libraryType !== 'movie' &&
                Object.keys(statusCounts).length > 0 && (
                  <Select
                    value={selectedStatus || 'all'}
                    onValueChange={(v) =>
                      setSelectedStatus(v === 'all' ? null : v)
                    }
                  >
                    <SelectTrigger aria-label="Series status" className="w-full h-11 text-sm">
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
                              <span>
                                {status === 'Canceled' ? 'Cancelled' : status}
                              </span>
                              <span className="text-xs opacity-50">
                                ({getStatusCount(status)})
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                )}
            </PopoverContent>
          </Popover>
          {sortable && <Select value={sortOrder} onValueChange={value => setSortOrder(value as LibrarySort)}>
            <SelectTrigger aria-label="Sort library" className="h-11 w-[208px] shrink-0"><SelectValue /></SelectTrigger>
            <SelectContent>
              {sortOptions.map((option) => (
                <SelectItem key={option} value={option}>
                  {option === 'finish' && libraryType === 'movie' ? 'Shortest first' : SORT_LABELS[option]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>}
        </>}
      </div>
    </div>
  );

  if (viewParams.get('view') === 'schedule') return <Navigate to="/watchlist" replace />;

  return (
    <AppShell title="Watchlist" subtitle="What I'm watching" toolbar={toolbar}>
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2 py-3">
          <div className="space-y-1">
            <CountLabel count={loading ? undefined : selectedCategory === 'Favourites' ? typedFavourites.length : filteredWatchlist.length} noun={searching ? `${filteredWatchlist.length === 1 ? 'result' : 'results'} across your library` : selectedCategory.toLowerCase()} />
            <p className="text-sm text-muted-foreground">{searching ? 'Search looks on every shelf; each result sits under the shelf it is on.' : SHELF_HINTS[selectedCategory]}</p>
          </div>
          {isAdmin && selectedCategory === 'Favourites' && <Button variant="outline" size="sm" onClick={syncFavouriteFacts} disabled={syncing}><RefreshCcw className="mr-2 h-4 w-4" />Refresh favourite details</Button>}
        </div>
        {selectedCategory === 'Favourites' ? (
          <div className="px-4 md:px-0 py-6 space-y-8">
            {loading ? (
              <CardGrid>
                {[...Array(12)].map((_, i) => (
                  <Skeleton key={i} className="h-64 rounded-lg" />
                ))}
              </CardGrid>
            ) : typedFavourites.length === 0 ? (
              <p className="text-center py-16 text-muted-foreground">
                No favourites yet
              </p>
            ) : (
              <>
                {/* Category Sections */}
                {FAVOURITE_CATEGORIES.map((cat) => {
                  const catFavs = typedFavourites.filter((f) => f.category === cat);
                  if (catFavs.length === 0) return null;

                  const catMovies = catFavs.filter(
                    (f) => f.media_type === 'movie',
                  );
                  const catTVShows = catFavs.filter(
                    (f) => f.media_type === 'tv',
                  );

                  return (
                    <div
                      key={cat}
                      className="space-y-4 border-b border-border/40 pb-6 last:border-b-0"
                    >
                      <div className="flex items-center gap-2">
                        <DotMatrixText text={cat.toUpperCase()} size="xs" />
                        <DotMatrixText text={`(${catFavs.length})`} size="xs" />
                      </div>

                      {catMovies.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground/80 font-medium pl-1">
                            <Film className="h-3.5 w-3.5" />
                            <span>Movies ({catMovies.length})</span>
                          </div>
                          <CardGrid>
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
                                      className="card-actions absolute top-2 right-2"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <Button
                                        variant="secondary"
                                        size="icon"
                                        className="h-11 w-11 bg-background/80 backdrop-blur-sm"
                                        onClick={() =>
                                          askDelete({
                                            name: fav.title,
                                            onConfirm: () =>
                                              removeFavourite(fav.id),
                                          })
                                        }
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    </div>
                                  )}
                                </div>
                                <div className="p-3">
                                  <h3 className="font-serif text-sm font-medium leading-tight">
                                    <span
                                      className="line-clamp-2"
                                      style={{ textWrap: 'balance' }}
                                    >
                                      {fav.title}
                                    </span>
                                  </h3>
                                </div>
                              </div>
                            ))}
                          </CardGrid>
                        </div>
                      )}

                      {catTVShows.length > 0 && (
                        <div className="space-y-2 pt-2">
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground/80 font-medium pl-1">
                            <Tv className="h-3.5 w-3.5" />
                            <span>TV Shows ({catTVShows.length})</span>
                          </div>
                          <CardGrid>
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
                                      className="card-actions absolute top-2 right-2"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <Button
                                        variant="secondary"
                                        size="icon"
                                        className="h-11 w-11 bg-background/80 backdrop-blur-sm"
                                        onClick={() =>
                                          askDelete({
                                            name: fav.title,
                                            onConfirm: () =>
                                              removeFavourite(fav.id),
                                          })
                                        }
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    </div>
                                  )}
                                </div>
                                <div className="p-3">
                                  <h3 className="font-serif text-sm font-medium leading-tight">
                                    <span
                                      className="line-clamp-2"
                                      style={{ textWrap: 'balance' }}
                                    >
                                      {fav.title}
                                    </span>
                                  </h3>
                                </div>
                              </div>
                            ))}
                          </CardGrid>
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
            {loading ? (
              <CardGrid>
                {[...Array(12)].map((_, i) => (
                  <Skeleton key={i} className="h-64 rounded-lg" />
                ))}
              </CardGrid>
            ) : filteredWatchlist.length === 0 ? (
              <p className="text-center py-16 text-muted-foreground">
                {searching ? `Nothing in your library matches “${searchQuery.trim()}”` : `Nothing on ${selectedCategory} yet`}
              </p>
            ) : searching ? (
              <div className="space-y-8">
                {SHELVES.filter((shelf) => shelf !== 'Favourites').map((shelf) => {
                  // The held shelf, as on a single shelf: a title marked watched
                  // from its detail stays in its section until the detail closes.
                  const onShelf = visibleWatchlist.filter((item) => gridShelfOf(item) === shelf);
                  if (onShelf.length === 0) return null;
                  return (
                    <section key={shelf} aria-label={`${shelf}: ${onShelf.length}`} className="space-y-3">
                      <h2 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">{getCategoryIcon(shelf)}{shelf} · {onShelf.length}</h2>
                      <CardGrid>{onShelf.map(renderCard)}</CardGrid>
                    </section>
                  );
                })}
              </div>
            ) : (
              <CardGrid>{visibleWatchlist.map(renderCard)}</CardGrid>
            )}
            {visibleCount < filteredWatchlist.length && (
              <div ref={observerTarget} className="h-20 w-full" />
            )}
          </div>
        )}

      </div>

      {deleteDialog}

      <SyncDetailDialog
        entry={selectedSyncEntry}
        open={Boolean(selectedSyncEntry)}
        onOpenChange={(open) => {
          if (!open) setSelectedSyncEntry(null);
        }}
      />
    </AppShell>
  );
};

export default Watchlist;
