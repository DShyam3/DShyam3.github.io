import { useState, useEffect, useMemo, useCallback } from 'react';
import { Heart, RefreshCcw, Search, Trash2, X } from 'lucide-react';
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
import { useDeleteConfirm } from '@/hooks/useDeleteConfirm';
import { cn } from '@/lib/utils';
import {
  useWatchlist,
  type FavouriteItem,
} from '@/features/watchlist/useWatchlist';
import { useTMDB, type TMDBResult } from '@/features/watchlist/useTMDB';
import { WatchlistNav } from '@/features/watchlist/components/WatchlistNav';
import { SegmentedControl } from '@/features/watchlist/components/SegmentedControl';
import { TmdbSearchDialog } from '@/features/watchlist/components/TmdbSearchDialog';
import { LanguageGroupedSections } from '@/features/watchlist/components/LanguageGroupedSections';
import {
  LIBRARY_CATEGORIES,
  libraryCategories,
  type LibraryCategory,
} from '@/features/watchlist/library-categories';
import {
  resolveFavouriteCategory,
  type TmdbFacts,
} from '@/features/watchlist/favourite-category';
import { groupByLanguage } from '@/features/watchlist/language-groups';
import {
  LIBRARY_TYPE_OPTIONS,
  type LibraryType,
} from '@/features/watchlist/library-state';

const favouriteAutoCategories = (favourite: FavouriteItem) =>
  libraryCategories({
    category: favourite.media_type === 'tv' ? 'TV Shows' : 'Movies',
    ...favourite.facts,
  });

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

export default function WatchlistFavourites() {
  const { isAdmin } = useAuth();
  const {
    favourites,
    addFavourite,
    removeFavourite,
    loading,
    syncing,
    syncProgress,
    syncFavouriteFacts,
  } = useWatchlist();
  const {
    results: searchResults,
    searchMulti: tmdbSearchMulti,
    clearSearch: clearTmdbSearch,
    getPosterUrl,
    loading: searchLoading,
  } = useTMDB();
  const { askDelete, deleteDialog } = useDeleteConfirm();

  const [libraryType, setLibraryType] = useState<LibraryType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAutoCategory, setSelectedAutoCategory] =
    useState<LibraryCategory | null>(null);
  const [favDialogOpen, setFavDialogOpen] = useState(false);
  const [favSearchQuery, setFavSearchQuery] = useState('');
  const [favAddedItems, setFavAddedItems] = useState<Set<string>>(new Set());

  const searching = searchQuery.trim() !== '';

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

  // Reset favourites dialog when it closes
  useEffect(() => {
    if (!favDialogOpen) {
      setFavSearchQuery('');
      setFavAddedItems(new Set());
    }
  }, [favDialogOpen]);

  // TMDB search for adding favourites
  useEffect(() => {
    const timer = setTimeout(() => {
      if (favSearchQuery.length >= 2) {
        tmdbSearchMulti(favSearchQuery);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [favSearchQuery, tmdbSearchMulti]);

  const favouriteCategoryCounts = useMemo(() => {
    const counts = Object.fromEntries(
      LIBRARY_CATEGORIES.map((category) => [category, 0]),
    ) as Record<LibraryCategory, number>;
    favourites
      .filter(
        (favourite) =>
          libraryType === 'all' || favourite.media_type === libraryType,
      )
      .forEach((favourite) =>
        favouriteAutoCategories(favourite).forEach((category) => {
          counts[category]++;
        }),
      );
    return counts;
  }, [favourites, libraryType]);

  const filteredFavourites = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    return favourites.filter(
      (favourite) =>
        (libraryType === 'all' || favourite.media_type === libraryType) &&
        (!selectedAutoCategory ||
          favouriteAutoCategories(favourite).includes(selectedAutoCategory)) &&
        (!normalizedQuery ||
          favourite.title.toLowerCase().includes(normalizedQuery)),
    );
  }, [favourites, libraryType, selectedAutoCategory, searchQuery]);

  const favouriteGroups = useMemo(
    () =>
      groupByLanguage(
        filteredFavourites,
        (fav) => ({
          original_language: fav.facts.original_language,
          genre_ids: fav.facts.genre_ids,
          mediaType: fav.media_type,
        }),
        { minGroupSize: 1, otherLabel: 'Language unknown' },
      ),
    [filteredFavourites],
  );

  const toolbar = (
    <div className="watchlist-toolbar watchlist-library-toolbar space-y-2 py-2">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <WatchlistNav current="favourites" />
        {isAdmin && (
          <div className="ml-auto flex items-center gap-2">
            <TmdbSearchDialog
              open={favDialogOpen}
              onOpenChange={setFavDialogOpen}
              triggerLabel="Add"
              title="Add to Favourites"
              description="Search and add movies or TV shows to your favourites."
              searchLabel="Search Movies & TV Shows"
              placeholder="Type a movie or TV show name..."
              query={favSearchQuery}
              onQueryChange={(value) => {
                clearTmdbSearch();
                setFavSearchQuery(value);
              }}
              results={searchResults}
              loading={searchLoading}
              getPosterUrl={getPosterUrl}
              resultKey={(r) => `${r.media_type}-${r.id}`}
              isDisabled={(r) =>
                favAddedItems.has(`${r.media_type}-${r.id}`)
              }
              onSelect={handleAddFavourite}
              renderStatus={(r) => (
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2 py-0.5 rounded font-medium bg-secondary text-muted-foreground">
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
            aria-label="Search favourites"
            placeholder="Search favourites…"
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
        <Select
          value={selectedAutoCategory ?? 'all'}
          onValueChange={(value) =>
            setSelectedAutoCategory(
              value === 'all' ? null : (value as LibraryCategory),
            )
          }
        >
          <SelectTrigger
            aria-label="Automatic category"
            className="h-11 w-[180px] shrink-0 text-sm"
          >
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {LIBRARY_CATEGORIES.filter(
              (category) =>
                favouriteCategoryCounts[category] > 0 ||
                selectedAutoCategory === category,
            ).map((category) => (
              <SelectItem key={category} value={category}>
                {category} ({favouriteCategoryCounts[category]})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );

  return (
    <AppShell title="Watchlist" subtitle="Favourites" toolbar={toolbar}>
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2 py-3">
          <div className="space-y-1">
            <CountLabel
              count={loading ? undefined : filteredFavourites.length}
              noun={
                searching
                  ? filteredFavourites.length === 1
                    ? 'result'
                    : 'results'
                  : 'favourites'
              }
            />
            <p className="text-sm text-muted-foreground">
              {searching
                ? `Searching favourites for “${searchQuery.trim()}”.`
                : 'Titles you have hearted. A favourite also stays on its own shelf in Library.'}
            </p>
          </div>
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              onClick={syncFavouriteFacts}
              disabled={syncing}
            >
              <RefreshCcw
                className={cn('mr-2 h-4 w-4', syncing && 'animate-spin')}
              />
              {syncing && syncProgress !== null
                ? `Refreshing ${syncProgress}%`
                : 'Refresh favourite details'}
            </Button>
          )}
        </div>
        <div className="px-4 md:px-0 py-6 space-y-8">
          {loading ? (
            <CardGrid>
              {[...Array(12)].map((_, i) => (
                <Skeleton key={i} className="h-64 rounded-lg" />
              ))}
            </CardGrid>
          ) : filteredFavourites.length === 0 ? (
            <p className="text-center py-16 text-muted-foreground">
              {searching
                ? `No favourites${selectedAutoCategory ? ` in ${selectedAutoCategory}` : ''} match “${searchQuery.trim()}”`
                : selectedAutoCategory
                  ? `No favourites in ${selectedAutoCategory}`
                  : 'No favourites yet'}
            </p>
          ) : (
            <LanguageGroupedSections
              groups={favouriteGroups}
              forceExpand={searching || Boolean(selectedAutoCategory)}
              renderGrid={(items) => (
                <CardGrid>
                  {items.map((fav) => (
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
                              aria-label={`Remove ${fav.title} from favourites`}
                              className="h-11 w-11 bg-background/80 backdrop-blur-sm"
                              onClick={() =>
                                askDelete({
                                  name: fav.title,
                                  onConfirm: () => removeFavourite(fav.id),
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
              )}
            />
          )}
        </div>
      </div>

      {deleteDialog}
    </AppShell>
  );
}
