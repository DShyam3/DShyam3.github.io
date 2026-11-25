import { useState, useMemo, useCallback } from 'react';
import { Search, X } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { CountLabel } from '@/components/shared/CountLabel';
import { CardGrid } from '@/components/shared/CardGrid';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { useDockedDetailOpen } from '@/contexts/WorkspaceInspectorContext';
import { cn } from '@/lib/utils';
import { useWatchlist, type WatchlistItem } from '@/features/watchlist/useWatchlist';
import { useSchedule } from '@/features/watchlist/useSchedule';
import { titleKey, type TitleRef } from '@/features/watchlist/title-ref';
import { WatchlistNav } from '@/features/watchlist/components/WatchlistNav';
import { WatchlistCard } from '@/features/watchlist/components/WatchlistCard';
import { SegmentedControl } from '@/features/watchlist/components/SegmentedControl';
import { LanguageGroupedSections } from '@/features/watchlist/components/LanguageGroupedSections';
import { LibraryFiltersPopover } from '@/features/watchlist/components/LibraryFiltersPopover';
import type { LibraryCategory } from '@/features/watchlist/library-categories';
import { groupByLanguage } from '@/features/watchlist/language-groups';
import {
  LIBRARY_TYPE_OPTIONS,
  libraryShelf,
  matchesLibraryType,
  type LibraryType,
} from '@/features/watchlist/library-state';
import {
  SHELF_HINTS,
  SHELF_SORTS,
  SORT_LABELS,
  buildSortKeys,
  computeAutoCategoryCounts,
  computeGenreCounts,
  computePlatformCounts,
  computeStatusCounts,
  favouritePayloadFor,
  filterAndSortWatchlist,
  findFavouriteFor,
  readStoredType,
  writeStoredType,
  type LibrarySort,
} from '@/features/watchlist/watchlist-shelves';

const EMPTY_FINISH_TIMES = new Map();

export default function WatchlistFinished() {
  const { isAdmin } = useAuth();
  const {
    watchlist,
    favourites,
    removeWatchlistItem,
    addFavourite,
    removeFavourite,
    loading,
    syncing,
    syncSingleItem,
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

  const removeWatchlistItemAndSchedule = useCallback(
    async (ref: TitleRef) => {
      await removeWatchlistItem(ref);
      await removeFromScheduleByWatchlistId(ref);
    },
    [removeWatchlistItem, removeFromScheduleByWatchlistId],
  );

  const [libraryType, setLibraryTypeState] = useState<LibraryType>(() => readStoredType());
  const setLibraryType = (type: LibraryType) => {
    setLibraryTypeState(type);
    writeStoredType(type);
  };
  const [searchQuery, setSearchQuery] = useState('');
  const searching = searchQuery.trim() !== '';
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [selectedAutoCategory, setSelectedAutoCategory] = useState<LibraryCategory | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);

  const sortOptions = searching
    ? []
    : SHELF_SORTS.Finished.filter((option) => option !== 'rating' || isAdmin);
  const [chosenSort, setSortOrder] = useState<LibrarySort>(() => SHELF_SORTS.Finished[0] ?? 'watched');
  const sortOrder = sortOptions.includes(chosenSort) ? chosenSort : sortOptions[0] ?? 'alphabetical';
  const sortable = sortOptions.length > 1;

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

  const shelfByItem = useMemo(
    () => new Map(watchlist.map((item) => [titleKey(item), libraryShelf(item)])),
    [watchlist],
  );

  // Hold shelf membership while the docked detail is open so undoing a watch
  // or changing a rating there does not pull the card off the grid mid-use.
  const detailOpen = useDockedDetailOpen();
  const [heldShelves, setHeldShelves] = useState(shelfByItem);
  if (!detailOpen && heldShelves !== shelfByItem) setHeldShelves(shelfByItem);
  const gridShelfOf = useCallback(
    (item: WatchlistItem) =>
      (detailOpen ? heldShelves.get(titleKey(item)) : undefined) ?? shelfByItem.get(titleKey(item)),
    [detailOpen, heldShelves, shelfByItem],
  );

  const finishedItems = useMemo(
    () =>
      watchlist.filter(
        (item) => matchesLibraryType(item, libraryType) && gridShelfOf(item) === 'Finished',
      ),
    [watchlist, libraryType, gridShelfOf],
  );

  const platformCounts = useMemo(() => computePlatformCounts(finishedItems), [finishedItems]);
  const genreCounts = useMemo(() => computeGenreCounts(finishedItems), [finishedItems]);
  const autoCategoryCounts = useMemo(() => computeAutoCategoryCounts(finishedItems), [finishedItems]);
  const statusCounts = useMemo(() => computeStatusCounts(finishedItems), [finishedItems]);

  const sortKeys = useMemo(
    () => buildSortKeys(finishedItems, sortable, sortOrder),
    [finishedItems, sortable, sortOrder],
  );

  const rankKey = `${libraryType}|${sortOrder}`;
  const [ranking, setRanking] = useState({ key: rankKey, keys: sortKeys });
  if (ranking.keys !== sortKeys && (!detailOpen || ranking.key !== rankKey)) {
    setRanking({ key: rankKey, keys: sortKeys });
  }
  const heldKeys = ranking.keys;

  const filteredFinished = useMemo(
    () =>
      filterAndSortWatchlist({
        items: finishedItems,
        selectedPlatform,
        selectedGenre,
        selectedAutoCategory,
        selectedStatus,
        searchQuery,
        searching,
        sortable,
        sortOrder,
        byTimeLeft: false,
        finishTimes: EMPTY_FINISH_TIMES,
        rankTimes: EMPTY_FINISH_TIMES,
        heldKeys,
      }),
    [
      finishedItems,
      selectedPlatform,
      selectedGenre,
      selectedAutoCategory,
      selectedStatus,
      searchQuery,
      searching,
      sortable,
      sortOrder,
      heldKeys,
    ],
  );

  const finishedGroups = useMemo(
    () =>
      groupByLanguage(filteredFinished, (item) => ({
        original_language: item.original_language,
        genre_ids: item.genre_ids,
        genres: item.genres,
        mediaType: item.category === 'Movies' ? 'movie' : 'tv',
      })),
    [filteredFinished],
  );

  const activeFilterCount = [
    selectedPlatform,
    selectedGenre,
    selectedAutoCategory,
    selectedStatus,
  ].filter(Boolean).length;

  const renderCard = (item: WatchlistItem) => (
    <WatchlistCard
      key={titleKey(item)}
      item={item}
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
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <WatchlistNav current="finished" />
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <SegmentedControl
          label="Show films, series or both"
          options={LIBRARY_TYPE_OPTIONS}
          value={libraryType}
          onChange={setLibraryType}
        />
        <div className="relative min-w-[12rem] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Search finished"
            placeholder="Search finished…"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className={cn('h-11 w-full pl-9', searchQuery && 'pr-10')}
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              className="group/clear absolute right-0 top-0 h-11 w-11 text-muted-foreground hover:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
              aria-label="Clear search"
              onClick={() => setSearchQuery('')}
            >
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full transition-colors group-hover/clear:bg-secondary group-hover/clear:text-secondary-foreground group-focus-visible/clear:ring-2 group-focus-visible/clear:ring-ring">
                <X className="h-4 w-4" />
              </span>
            </Button>
          )}
        </div>
        <LibraryFiltersPopover
          open={filtersOpen}
          onOpenChange={setFiltersOpen}
          libraryType={libraryType}
          selectedPlatform={selectedPlatform}
          onPlatformChange={setSelectedPlatform}
          selectedAutoCategory={selectedAutoCategory}
          onAutoCategoryChange={setSelectedAutoCategory}
          selectedGenre={selectedGenre}
          onGenreChange={setSelectedGenre}
          selectedStatus={selectedStatus}
          onStatusChange={setSelectedStatus}
          platformCounts={platformCounts}
          autoCategoryCounts={autoCategoryCounts}
          genreCounts={genreCounts}
          statusCounts={statusCounts}
          onReset={() => {
            setSelectedPlatform(null);
            setSelectedGenre(null);
            setSelectedAutoCategory(null);
            setSelectedStatus(null);
          }}
          ariaLabel="Finished filters"
          heading="Filter finished"
        />
        {sortable && (
          <Select value={sortOrder} onValueChange={(value) => setSortOrder(value as LibrarySort)}>
            <SelectTrigger aria-label="Sort finished" className="h-11 w-[208px] shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sortOptions.map((option) => (
                <SelectItem key={option} value={option}>
                  {SORT_LABELS[option]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    </div>
  );

  return (
    <AppShell title="Watchlist" subtitle="Finished" toolbar={toolbar}>
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2 py-3">
          <div className="space-y-1">
            <CountLabel
              count={loading ? undefined : filteredFinished.length}
              noun={
                searching
                  ? filteredFinished.length === 1
                    ? 'result'
                    : 'results'
                  : 'finished'
              }
            />
            <p className="text-sm text-muted-foreground">
              {searching
                ? `Searching finished for “${searchQuery.trim()}”.`
                : SHELF_HINTS.Finished}
            </p>
          </div>
        </div>
        <div className="px-4 md:px-0 py-6">
          {loading ? (
            <CardGrid>
              {[...Array(12)].map((_, i) => (
                <Skeleton key={i} className="h-64 rounded-lg" />
              ))}
            </CardGrid>
          ) : filteredFinished.length === 0 ? (
            <p className="text-center py-16 text-muted-foreground">
              {searching
                ? `Nothing finished matches “${searchQuery.trim()}”`
                : activeFilterCount > 0
                  ? 'Nothing finished matches these filters'
                  : 'Nothing finished yet'}
            </p>
          ) : (
            <LanguageGroupedSections
              groups={finishedGroups}
              forceExpand={searching || activeFilterCount > 0}
              renderGrid={(items) => <CardGrid>{items.map(renderCard)}</CardGrid>}
            />
          )}
        </div>
      </div>
    </AppShell>
  );
}
