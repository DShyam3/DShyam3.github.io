import { Navigate, useSearchParams } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { DotMatrixText } from '@/components/dot-matrix/DotMatrixText';
import { CountLabel } from '@/components/shared/CountLabel';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useWatchlist, WatchlistItem } from '@/features/watchlist/useWatchlist';
import { useSchedule } from '@/features/watchlist/useSchedule';
import { useTMDB, type TMDBResult } from '@/features/watchlist/useTMDB';
import { newItemFromDetails } from '@/features/watchlist/new-item';
import { WatchlistNav } from '@/features/watchlist/components/WatchlistNav';
import { LIBRARY_CATEGORIES, type LibraryCategory } from '@/features/watchlist/library-categories';
import { groupByLanguage } from '@/features/watchlist/language-groups';
import { LanguageGroupedSections } from '@/features/watchlist/components/LanguageGroupedSections';
import { useAuth } from '@/contexts/AuthContext';
import { titleKey, type TitleRef } from './title-ref';
import { buildDisplaySyncLog, formatSyncPart, type DisplaySyncLogEntry } from '@/features/watchlist/sync-logic';
import { SyncDetailDialog } from '@/features/watchlist/components/SyncDetailDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertTriangle,
  Bell,
  Bookmark,
  CalendarClock,
  CheckCircle,
  Eye,
  EyeOff,
  Filter,
  History,
  Library,
  Loader2,
  PauseCircle,
  RefreshCcw,
  Search,
  Timer,
  X,
  XCircle,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { formatRelativeTime } from '@/lib/format-date';
import { formatCooldownEnd } from '@/hooks/useCooldown';
import { SyncHistoryIcon } from '@/components/shared/SyncHistoryIcon';
import { WatchlistCard } from '@/features/watchlist/components/WatchlistCard';
import { CardGrid } from '@/components/shared/CardGrid';
import { useDockedDetailOpen } from '@/contexts/WorkspaceInspectorContext';
import { TmdbSearchDialog } from '@/features/watchlist/components/TmdbSearchDialog';
import { SegmentedControl } from '@/features/watchlist/components/SegmentedControl';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { PlatformLogo, hasPlatformLogo, platformLabel } from '@/features/watchlist/components/PlatformLogo';
import {
  LIBRARY_TYPE_OPTIONS,
  MORE_SHELVES,
  libraryShelf,
  shelfFromParam,
  type LibraryType,
} from '@/features/watchlist/library-state';
import {
  ALL_GENRES,
  ALL_PLATFORMS,
  MAIN_SHELVES,
  SHELF_HINTS,
  SHELF_SORTS,
  SHELVES,
  SORT_LABELS,
  buildSortKeys,
  computeAutoCategoryCounts,
  computeFinishTimes,
  computeGenreCounts,
  computePlatformCounts,
  computeShelfCounts,
  computeStatusCounts,
  favouritePayloadFor,
  filterAndSortWatchlist,
  findFavouriteFor,
  formatItemTimeLeft,
  formatNextAutoSync,
  formatSyncTimestamp,
  readStoredType,
  selectCategoryItems,
  syncEntryFailureBadge,
  syncEntryTypeLabel,
  writeStoredType,
  type LibrarySort,
  type Shelf,
} from '@/features/watchlist/watchlist-shelves';

export {
  ALL_GENRES,
  ALL_PLATFORMS,
  MAIN_SHELVES,
  SHELF_HINTS,
  SHELF_SORTS,
  SHELVES,
  SORT_LABELS,
  readStoredType,
  type LibrarySort,
  type Shelf,
};

const Watchlist = () => {
  const { isAdmin, isAuthLoading } = useAuth();
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
    writeStoredType(type);
  };
  const [searchQuery, setSearchQuery] = useState('');
  const [searchAllShelves, setSearchAllShelves] = useState(true);
  // A search looks across every shelf by default, so a finished title is
  // still found from Watching; picking a shelf narrows the search without
  // clearing what was typed.
  const searching = searchQuery.trim() !== '';
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [selectedAutoCategory, setSelectedAutoCategory] = useState<LibraryCategory | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  // A visitor's link to one of the owner's own shelves opens Watching, so
  // the shelf, its count and its hint never show, and it resets filters and
  // search as the shelf picker does. Only once auth has settled: isAdmin is
  // false while it loads, and the owner's own link must hold.
  if (!isAuthLoading && !isAdmin && (MORE_SHELVES as readonly string[]).includes(selectedCategory)) {
    setSelectedCategory('Watching');
    setSelectedPlatform(null); setSelectedGenre(null); setSelectedAutoCategory(null); setSelectedStatus(null); setSearchQuery('');
  }
  // Visitors never order by a rating they cannot see.
  const sortOptions = searching
    ? []
    : SHELF_SORTS[selectedCategory].filter((option) => option !== 'rating' || isAdmin);
  const [chosenSort, setSortOrder] = useState<LibrarySort>(() => SHELF_SORTS[selectedCategory][0] ?? 'alphabetical');
  // A choice the shelf no longer offers -- Your rating after signing out --
  // falls back to the shelf's default rather than a blank picker.
  const sortOrder = sortOptions.includes(chosenSort) ? chosenSort : sortOptions[0] ?? 'alphabetical';
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
    clearSearch: clearTmdbSearch,
    getPosterUrl,
    getMovieDetails,
    loading: searchLoading,
  } = useTMDB();

  const handleAddWatchlistItem = useCallback(
    async (result: TMDBResult) => {
      // pendingResultIds covers the whole click-to-completion span, including
      // the getMovieDetails fetch before addWatchlistItem is even called.
      const resultKey = `${result.media_type}-${result.id}`;
      setPendingResultIds((prev) => new Set(prev).add(resultKey));
      try {
        const details = await getMovieDetails(result.id, result.media_type);
        if (!details) return;
        // The result's own type: with All selected the search spans both.
        await addWatchlistItem(
          newItemFromDetails(details, result.media_type === 'tv' ? 'TV Shows' : 'Movies'),
          { seasons: details.seasons },
        );
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
    (item: WatchlistItem) => findFavouriteFor(favourites, item),
    [favourites],
  );
  const toggleFavourite = useCallback(
    (item: WatchlistItem) => {
      const existing = favouriteFor(item);
      if (existing) {
        void removeFavourite(existing.id);
        return;
      }
      void addFavourite(favouritePayloadFor(item)).catch(() => {
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

  const categoryItems = useMemo(
    () =>
      selectCategoryItems({
        watchlist,
        libraryType,
        searching,
        searchAllShelves,
        shelfByItem,
        gridShelfOf,
        selectedCategory,
        isAdmin,
      }),
    [watchlist, libraryType, searching, searchAllShelves, shelfByItem, gridShelfOf, selectedCategory, isAdmin],
  );

  const platformCounts = useMemo(() => computePlatformCounts(categoryItems), [categoryItems]);
  const genreCounts = useMemo(() => computeGenreCounts(categoryItems), [categoryItems]);
  const autoCategoryCounts = useMemo(() => computeAutoCategoryCounts(categoryItems), [categoryItems]);
  const statusCounts = useMemo(() => computeStatusCounts(categoryItems), [categoryItems]);


  const getPlatformCount = (platform: string) => platformCounts[platform] || 0;
  const getGenreCount = (genre: string) => genreCounts[genre] || 0;
  const getStatusCount = (status: string) => statusCounts[status] || 0;

  // Time left per show, built only while a time order is picked.
  const finishTimes = useMemo(
    () => computeFinishTimes(categoryItems, byTimeLeft, isEpisodeWatched),
    [categoryItems, byTimeLeft, isEpisodeWatched],
  );

  // Recently watched and Your rating sort on a title's own date and score;
  // keyed here so the hold below can freeze them too.
  const sortKeys = useMemo(
    () => buildSortKeys(categoryItems, sortable, sortOrder),
    [categoryItems, sortable, sortOrder],
  );

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

  const filteredWatchlist = useMemo(
    () =>
      filterAndSortWatchlist({
        items: categoryItems,
        selectedPlatform,
        selectedGenre,
        selectedAutoCategory,
        selectedStatus,
        searchQuery,
        searching,
        sortable,
        sortOrder,
        byTimeLeft,
        finishTimes,
        rankTimes,
        heldKeys,
      }),
    [
      categoryItems,
      selectedPlatform,
      selectedGenre,
      selectedAutoCategory,
      selectedStatus,
      searchQuery,
      searching,
      sortable,
      sortOrder,
      byTimeLeft,
      finishTimes,
      rankTimes,
      heldKeys,
    ],
  );

  const SHELF_ICON: Record<Shelf, typeof Eye> = {
    Watching: Eye,
    'To watch': Bookmark,
    Upcoming: Bell,
    'Up to date': CalendarClock,
    Finished: CheckCircle,
    'Stopped watching': PauseCircle,
    Hidden: EyeOff,
  };
  const getCategoryIcon = (shelf: Shelf) => {
    const Icon = SHELF_ICON[shelf];
    return <Icon className="h-4 w-4" />;
  };

  const finishedGroups = useMemo(() => {
    if (selectedCategory !== 'Finished') return [];
    return groupByLanguage(filteredWatchlist, (item) => ({
      original_language: item.original_language,
      genre_ids: item.genre_ids,
      genres: item.genres,
      mediaType: item.category === 'Movies' ? 'movie' : 'tv',
    }));
  }, [selectedCategory, filteredWatchlist]);

  const categoryCounts = useMemo(
    () => computeShelfCounts(watchlist, shelfByItem, libraryType, searchQuery),
    [watchlist, shelfByItem, libraryType, searchQuery],
  );

  const totalSearchMatches = useMemo(() => {
    if (!searching) return 0;
    const visibleShelves = isAdmin ? SHELVES : MAIN_SHELVES;
    return visibleShelves.reduce((sum, shelf) => sum + categoryCounts[shelf], 0);
  }, [searching, isAdmin, categoryCounts]);

  // Reset visible count when filters change
  useEffect(() => {
    setVisibleCount(48);
  }, [
    selectedCategory,
    libraryType,
    searchQuery,
    selectedPlatform,
    selectedGenre,
    selectedAutoCategory,
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
  const timeLeftLabel = (item: WatchlistItem) => formatItemTimeLeft(item, byTimeLeft, finishTimes);

  const activeFilterCount = [selectedPlatform, selectedGenre, selectedAutoCategory, selectedStatus].filter(Boolean).length;

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
        <WatchlistNav current="library" />
        <div className="ml-auto flex items-center gap-1">
        {isAdmin && (
          <TmdbSearchDialog
            open={open}
            onOpenChange={setOpen}
            triggerLabel="Add"
            title="Add to Watchlist"
            description="Search and add items to your watchlist."
            searchLabel={libraryType === 'movie' ? 'Search films' : libraryType === 'tv' ? 'Search series' : 'Search films and series'}
            placeholder={libraryType === 'movie' ? 'Type a film name…' : libraryType === 'tv' ? 'Type a series name…' : 'Type a film or series name…'}
            query={title}
            onQueryChange={(value) => { clearTmdbSearch(); setTitle(value); }}
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
                const failureCountBadge = syncEntryFailureBadge(entry);
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
                        {syncEntryTypeLabel(entry)}
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
                      {formatSyncTimestamp(entry.synced_at)}
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
                Next auto-sync: {formatNextAutoSync(nextAutoSyncTime)}
              </span>
            )}
          </div>
              </PopoverContent>
            </Popover>
          )}
        </div>
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <Select
          value={searching && searchAllShelves ? '__all__' : selectedCategory}
          onValueChange={(value) => {
            if (value === '__all__') {
              setSearchAllShelves(true);
              return;
            }
            const shelf = value as Shelf;
            setSelectedCategory(shelf);
            setSortOrder(SHELF_SORTS[shelf][0] ?? 'alphabetical');
            setSelectedPlatform(null); setSelectedGenre(null); setSelectedAutoCategory(null); setSelectedStatus(null);
            if (searching) {
              setSearchAllShelves(false);
            } else {
              setSearchQuery('');
              setSearchAllShelves(true);
            }
          }}
        >
          {/* A search covers every shelf by default; picking a shelf narrows
              an active search to that shelf instead of clearing it. */}
          <SelectTrigger aria-label="Library shelf" className="h-11 w-[210px] shrink-0 text-sm">
            {/* Always given children: Radix portals the picked item's text in
                otherwise, and switching between the two crashes the tree. */}
            <SelectValue>
              {searching && searchAllShelves
                ? `All shelves (${totalSearchMatches})`
                : <span className="flex items-center gap-2">{getCategoryIcon(selectedCategory)}{selectedCategory} ({categoryCounts[selectedCategory]})</span>}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {searching && (
              <>
                <SelectItem value="__all__">
                  <span className="flex items-center gap-2 font-medium">All shelves ({totalSearchMatches})</span>
                </SelectItem>
                <SelectSeparator />
              </>
            )}
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
        {/* 12rem holds the whole placeholder; narrower, the box drops below the category picker. */}
        <div className="relative min-w-[12rem] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Search your whole library"
            placeholder="Search library…"
            value={searchQuery}
            onChange={(event) => {
              const next = event.target.value;
              if (!searching && next.trim()) setSearchAllShelves(true);
              setSearchQuery(next);
            }}
            className={cn('h-11 w-full pl-9', searchQuery && 'pr-10')}
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              className="group/clear absolute right-0 top-0 h-11 w-11 text-muted-foreground hover:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
              aria-label="Clear search"
              onClick={() => { setSearchQuery(''); setSearchAllShelves(true); }}
            >
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full transition-colors group-hover/clear:bg-secondary group-hover/clear:text-secondary-foreground group-focus-visible/clear:ring-2 group-focus-visible/clear:ring-ring">
                <X className="h-4 w-4" />
              </span>
            </Button>
          )}
        </div>
        <Popover open={filtersOpen} onOpenChange={setFiltersOpen}>
            <PopoverTrigger asChild><Button variant="outline" className="h-11 gap-2"><Filter className="h-4 w-4" />Filters{activeFilterCount > 0 && ` (${activeFilterCount})`}</Button></PopoverTrigger>
            <PopoverContent align="end" collisionPadding={12} className="w-80 max-w-[calc(100vw-24px)] overflow-y-auto overscroll-contain space-y-3" style={{ maxHeight: 'min(480px, var(--radix-popover-content-available-height))' }} aria-label="Library filters">
              <div className="flex items-center justify-between"><h3 className="font-medium">Filter library</h3><Button variant="ghost" size="sm" onClick={() => { setSelectedPlatform(null); setSelectedGenre(null); setSelectedAutoCategory(null); setSelectedStatus(null); }}>Reset</Button></div>
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

              <Select value={selectedAutoCategory ?? 'all'} onValueChange={(value) => setSelectedAutoCategory(value === 'all' ? null : value as LibraryCategory)}>
                <SelectTrigger aria-label="Automatic category" className="w-full h-11 text-sm"><SelectValue placeholder="Category" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {LIBRARY_CATEGORIES.filter((category) => autoCategoryCounts[category] > 0 || selectedAutoCategory === category).map((category) => (
                    <SelectItem key={category} value={category}>{category} ({autoCategoryCounts[category]})</SelectItem>
                  ))}
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
      </div>
    </div>
  );

  if (viewParams.get('view') === 'schedule') return <Navigate to="/watchlist" replace />;
  if (viewParams.get('category') === 'favourites') return <Navigate to="/watchlist/favourites" replace />;

  return (
    <AppShell title="Watchlist" subtitle="What I'm watching" toolbar={toolbar}>
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2 py-3">
          <div className="space-y-1">
            <CountLabel
              count={loading ? undefined : filteredWatchlist.length}
              noun={searching
                ? `${filteredWatchlist.length === 1 ? 'result' : 'results'} ${searchAllShelves ? 'across your library' : `on ${selectedCategory}`}`
                : selectedCategory.toLowerCase()}
            />
            <p className="text-sm text-muted-foreground">{searching ? (searchAllShelves ? 'Search looks on every shelf; each result sits under the shelf it is on.' : `Searching on ${selectedCategory} only.`) : SHELF_HINTS[selectedCategory]}</p>
          </div>
        </div>
        <div className="px-4 md:px-0 py-6">
          {loading ? (
            <CardGrid>
              {[...Array(12)].map((_, i) => (
                <Skeleton key={i} className="h-64 rounded-lg" />
              ))}
            </CardGrid>
          ) : filteredWatchlist.length === 0 ? (
            <p className="text-center py-16 text-muted-foreground">
              {searching ? `Nothing ${searchAllShelves ? 'in your library' : `on ${selectedCategory}`} matches “${searchQuery.trim()}”` : `Nothing on ${selectedCategory} yet`}
            </p>
          ) : searching && searchAllShelves ? (
            <div className="space-y-8">
              {SHELVES.map((shelf) => {
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
          ) : selectedCategory === 'Finished' ? (
            <LanguageGroupedSections
              groups={finishedGroups}
              forceExpand={searching || activeFilterCount > 0}
              renderGrid={(items) => <CardGrid>{items.map(renderCard)}</CardGrid>}
            />
          ) : (
            <CardGrid>{visibleWatchlist.map(renderCard)}</CardGrid>
          )}
          {selectedCategory !== 'Finished' && visibleCount < filteredWatchlist.length && (
            <div ref={observerTarget} className="h-20 w-full" />
          )}
        </div>

      </div>

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
