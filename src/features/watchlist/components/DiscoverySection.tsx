import { useEffect, useState, type ReactNode } from 'react';
import { Check, EyeOff, Loader2, Plus, Search, X } from 'lucide-react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { CardGrid } from '@/components/shared/CardGrid';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DotMatrixText } from '@/components/dot-matrix/DotMatrixText';
import { useAuth } from '@/contexts/AuthContext';
import { useWatchlist } from '../useWatchlist';
import { useTMDB } from '../useTMDB';
import type { TMDBResult } from '../useTMDB';
import { newItemFromDetails } from '../new-item';
import { findExistingTitle } from '../existing-title';
import { discoveryDate, discoveryKey, type DiscoveryItem, type DiscoveryMedia } from '../discovery';
import { SKIP_DAYS } from '../discovery-answers';
import { useDiscovery, type DiscoveryFranchiseGroup } from '../useDiscovery';
import { discoveryAddPayload } from '../discovery-add';
import type { OrderEntryView } from '../franchise';
import type { LibraryType } from '../library-state';
import type { WatchedWhen } from '../watched-when';
import { todayLocal } from '../watched-when';
import { EntryList } from './franchise/EntryList';
import { EntryPreviewDialog } from './franchise/EntryPreviewDialog';
import { FranchiseCard } from './franchise/FranchiseCard';
import { useAddToLibrary } from './franchise/useAddToLibrary';
import { PlatformBadge } from './PlatformLogo';
import { PosterCard } from './PosterCard';
import { TrailerButton } from './TrailerButton';
import { TmdbSearchDialog } from './TmdbSearchDialog';
import { WatchedWhenMenu } from './WatchedWhenMenu';
import { WatchlistDetailDialog } from './WatchlistDetailDialog';
import { CreditsList, RuntimeRow, SeriesStatusPill } from './WatchlistDetailParts';

type Detail = NonNullable<Awaited<ReturnType<ReturnType<typeof useTMDB>['getMovieDetails']>>>;

const titleOf = (item: DiscoveryItem) => item.title || item.name || 'Untitled';
const mediaLabel = (item: DiscoveryItem) => (item.media === 'movie' ? 'Film' : 'Series');

/** "2014 · Film" for the back catalogue, "Thu 27 Nov · Film" (with year if another year) for what is coming. */
function metaLine(item: DiscoveryItem): string {
  const date = discoveryDate(item);
  if (!date) return mediaLabel(item);
  if (item.kind === 'upcoming') {
    const parsed = new Date(`${date.slice(0, 10)}T12:00:00`);
    const includeYear = parsed.getFullYear() !== new Date().getFullYear();
    const when = parsed.toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      ...(includeYear && { year: 'numeric' }),
    });
    return `${when} · ${mediaLabel(item)}`;
  }
  return `${date.slice(0, 4)} · ${mediaLabel(item)}`;
}

/**
 * Add, or add as already seen. Details come from TMDB first, the same way the
 * library's own add search builds a row.
 */
function useAddSuggestion(item: DiscoveryItem) {
  const { addWatchlistItem } = useWatchlist();
  const { getMovieDetails } = useTMDB();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState<Detail | null>(null);
  const fetchDetail = async () => {
    const data = detail ?? await getMovieDetails(item.id, item.media);
    if (!data) throw new Error('Unavailable');
    setDetail(data);
    return data;
  };
  const run = async (action: () => Promise<void>, failure: string) => {
    setPending(true); setError('');
    try { await action(); } catch { setError(failure); } finally { setPending(false); }
  };
  const add = (watched: boolean, watchedWhen?: WatchedWhen) => run(async () => {
    const data = await fetchDetail();
    await addWatchlistItem(discoveryAddPayload(item, data, watched), { watchedWhen, seasons: data.seasons });
    // The library refresh removes this suggestion once the save succeeds.
  }, 'Could not add this title. Please try again.');
  const loadDetail = () => run(async () => { await fetchDetail(); }, 'Could not load details. Try again.');
  return { pending, error, detail, add, loadDetail };
}

function SuggestionActions({ item, onDismiss, onNotSeen, actions, layout }: {
  item: DiscoveryItem;
  onDismiss: () => void;
  /** Only under HAVE YOU ALREADY WATCHED?, which asks whether you have seen it. */
  onNotSeen?: () => void;
  actions: ReturnType<typeof useAddSuggestion>;
  layout: 'tile' | 'row';
}) {
  const { isAdmin } = useAuth();
  const title = titleOf(item);
  // Only a released title can already have been seen; recommendations can
  // be dated in the future too.
  const date = discoveryDate(item).slice(0, 10);
  const released = item.kind !== 'upcoming' && (!date || date <= new Date().toLocaleDateString('en-CA'));
  // Seen it asks when, as Mark as watched does: a title seen years ago must
  // not land in the Diary as watched today.
  const seenIt = (children: ReactNode, style: { size: ButtonProps['size']; className: string; label?: string }) => (
    <WatchedWhenMenu
      releaseDate={date || undefined}
      releaseText={item.media === 'tv' ? 'On each episode\'s air date' : undefined}
      disabled={actions.pending}
      onPick={(when) => { void actions.add(true, when); }}
      variant="outline"
      {...style}
    >
      {children}
    </WatchedWhenMenu>
  );
  if (layout === 'row') {
    return (
      <div className="flex flex-wrap gap-2">
        {isAdmin && <Button onClick={() => { void actions.add(false); }} disabled={actions.pending}><Plus className="h-4 w-4" />Add to watchlist</Button>}
        {isAdmin && released && seenIt(<><Check className="h-4 w-4" />Seen it</>, { size: 'default', className: 'min-h-11 text-sm' })}
        {onNotSeen && <Button variant="outline" onClick={onNotSeen} disabled={actions.pending}><EyeOff className="h-4 w-4" />Not seen</Button>}
        <Button variant="ghost" onClick={onDismiss} disabled={actions.pending}><X className="h-4 w-4" />Not interested</Button>
      </div>
    );
  }
  // Under the card's text, never over the artwork (DESIGN_SYSTEM.md); aligned
  // footer bar matching Library's schedule action row, with 44px touch targets.
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-1 border-t px-2 py-1.5">
      {isAdmin && (
        <Button variant="outline" size="icon" className="h-11 w-11" onClick={() => { void actions.add(false); }} disabled={actions.pending} aria-label={`Add ${title} to watchlist`} title="Add to watchlist">
          <Plus className="h-4 w-4" />
        </Button>
      )}
      {isAdmin && released && seenIt(<Check className="h-4 w-4" />, { size: 'icon', className: 'h-11 w-11', label: `Add ${title} as already watched` })}
      {onNotSeen && (
        <Button variant="ghost" size="icon" className="h-11 w-11 text-muted-foreground" onClick={onNotSeen} disabled={actions.pending} aria-label={`Mark ${title} as not seen`} title="Not seen">
          <EyeOff className="h-4 w-4" />
        </Button>
      )}
      <Button variant="ghost" size="icon" className="h-11 w-11 text-muted-foreground" onClick={onDismiss} disabled={actions.pending} aria-label={`Not interested in ${title}`} title="Not interested">
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

function SuggestionTile({ item, onDismiss, onNotSeen }: { item: DiscoveryItem; onDismiss: () => void; onNotSeen?: () => void }) {
  const { getPosterUrl } = useTMDB();
  const actions = useAddSuggestion(item);
  const [open, setOpen] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const title = titleOf(item);
  const poster = item.poster_path && !imageFailed ? getPosterUrl(item.poster_path) : null;
  const openDetail = () => { setOpen(true); if (!actions.detail) void actions.loadDetail(); };
  return (
    <>
      <PosterCard
        title={title}
        poster={poster}
        onOpen={openDetail}
        subtitle={metaLine(item)}
        meta={
          <>
            {item.kind === 'recommendation' ? (
              <span className="truncate text-xs text-muted-foreground" title={item.reason}>
                {item.shortReason ?? item.reason}
              </span>
            ) : item.shortReason ? (
              <span className="truncate text-xs font-medium text-primary" title={item.reason}>
                {item.shortReason}
              </span>
            ) : <span />}
            {actions.pending ? (
              <span role="status" className="truncate text-xs text-muted-foreground">Adding…</span>
            ) : actions.error && !open ? (
              <span role="alert" className="truncate text-xs text-destructive">{actions.error}</span>
            ) : null}
          </>
        }
        footer={<SuggestionActions item={item} onDismiss={onDismiss} onNotSeen={onNotSeen} actions={actions} layout="tile" />}
      />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          {poster && (
            <div className="flex justify-center">
              <img src={poster} alt={title} className="max-h-52 w-auto rounded-lg object-contain" onError={() => setImageFailed(true)} />
            </div>
          )}
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              {[
                metaLine(item),
                actions.detail?.season_count ? `${actions.detail.season_count} season${actions.detail.season_count === 1 ? '' : 's'}` : null,
                actions.detail?.genres?.length ? actions.detail.genres.join(', ') : null,
              ].filter(Boolean).join(' · ')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {(actions.detail?.platform || actions.detail?.series_status) && (
              <div className="flex flex-wrap items-center gap-2">
                <PlatformBadge platform={actions.detail?.platform} size={20} />
                {actions.detail?.series_status && <SeriesStatusPill status={actions.detail.series_status} className="px-2.5 py-1" />}
              </div>
            )}
            {item.kind === 'recommendation' && <p className="text-sm">{item.reason}</p>}
            {item.kind === 'upcoming' && item.shortReason && (
              <p className="text-sm font-medium text-primary">{item.reason}</p>
            )}
            <p className="text-sm leading-relaxed text-muted-foreground">
              {actions.detail?.overview || item.overview || (actions.pending ? 'Loading…' : 'No synopsis available.')}
            </p>
            <CreditsList
              kind={item.media}
              leads={item.media === 'tv' ? actions.detail?.creators ?? undefined : actions.detail?.directors ?? undefined}
              cast={actions.detail?.top_cast ?? undefined}
            />
            {item.media === 'movie' && actions.detail?.runtime ? (
              <RuntimeRow runtime={actions.detail.runtime} className="text-muted-foreground" iconClassName="text-muted-foreground" />
            ) : null}
            <TrailerButton trailerKey={actions.detail?.trailer_key} title={title} />
            {actions.detail && !actions.detail.trailer_key && <p className="text-xs text-muted-foreground">No trailer available yet.</p>}
            {actions.error && <p role="alert" className="text-xs text-destructive">{actions.error}</p>}
            <SuggestionActions
              item={item}
              onDismiss={() => { setOpen(false); onDismiss(); }}
              onNotSeen={onNotSeen && (() => { setOpen(false); onNotSeen(); })}
              actions={actions}
              layout="row"
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function TileGrid({ items, onDismiss, onNotSeen }: {
  items: DiscoveryItem[];
  onDismiss: (media: DiscoveryMedia, id: number) => void;
  onNotSeen?: (media: DiscoveryMedia, id: number) => void;
}) {
  return (
    <CardGrid>
      {items.map((item) => (
        <SuggestionTile
          key={discoveryKey(item.media, item.id)}
          item={item}
          onDismiss={() => onDismiss(item.media, item.id)}
          onNotSeen={onNotSeen && (() => onNotSeen(item.media, item.id))}
        />
      ))}
    </CardGrid>
  );
}

function DiscoveryFranchiseCard({
  group,
  onOpen,
  onAddToLibrary,
  onSeenIt,
  onDismiss,
  isAdding,
}: {
  group: DiscoveryFranchiseGroup;
  onOpen: (entry: OrderEntryView) => void;
  onAddToLibrary?: (entry: OrderEntryView) => void;
  onSeenIt?: (entry: OrderEntryView, when: WatchedWhen) => void;
  onDismiss: (entry: OrderEntryView) => void;
  isAdding: (key: string) => boolean;
}) {
  const [open, setOpen] = useState(false);
  const { view } = group;
  return (
    <FranchiseCard
      name={group.name}
      summary={[
        `${view.watched} of ${view.total} watched`,
        `${group.missingCount} not in library`,
        group.hasGap ? 'Gap in series' : null,
      ].filter(Boolean).join(' · ')}
      nextUp={view.nextUp?.title}
      strip={view.entries.map((e) => ({
        key: e.key,
        poster: e.poster,
        mediaType: e.mediaType,
        watched: e.state === 'watched',
      }))}
      open={open}
      onToggle={() => setOpen((v) => !v)}
    >
      <EntryList
        view={view}
        onOpen={onOpen}
        onAddToLibrary={onAddToLibrary}
        onSeenIt={onSeenIt}
        onDismiss={onDismiss}
        isAdding={isAdding}
      />
    </FranchiseCard>
  );
}

/** A direct lookup for titles that did not surface among Discover's suggestions. */
function DiscoverAddSearch({ type }: { type: LibraryType }) {
  const { watchlist, loading: libraryLoading, addWatchlistItem } = useWatchlist();
  const { results, search, searchMulti, clearSearch, getPosterUrl, getMovieDetails, loading } = useTMDB();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [pending, setPending] = useState<Set<string>>(new Set());

  const existingFor = (result: TMDBResult) => findExistingTitle(watchlist, result);

  const alreadyWatched = (result: TMDBResult) => {
    const existing = existingFor(result);
    if (!existing) return false;
    if (existing.category === 'Movies') return existing.watched === true;
    const aired = (existing.seasons ?? []).filter((season) => season.season_number > 0)
      .flatMap((season) => season.episodes)
      .filter((episode) => !!episode.release_date && episode.release_date.slice(0, 10) <= todayLocal());
    return aired.length > 0 && aired.every((episode) => episode.watched);
  };

  useEffect(() => {
    if (!open) {
      setQuery('');
      clearSearch();
      return;
    }
    if (query.trim().length < 2) return;
    const timer = setTimeout(() => {
      const yearMatch = query.match(/\((\d{4})\)\s*$/);
      const year = yearMatch ? Number(yearMatch[1]) : undefined;
      const title = query.replace(/\s*\(\d{4}\)\s*$/, '').trim();
      if (type === 'all') void searchMulti(title);
      else void search(title, type === 'tv' ? 'TV Shows' : 'Movies', year);
    }, 500);
    return () => clearTimeout(timer);
  }, [open, query, type, search, searchMulti, clearSearch]);

  const add = async (result: TMDBResult, watchedWhen: WatchedWhen) => {
    const key = `${result.media_type}-${result.id}`;
    if (libraryLoading || pending.has(key) || existingFor(result)) return;
    setPending((current) => new Set(current).add(key));
    try {
      const details = await getMovieDetails(result.id, result.media_type);
      if (!details) return;
      await addWatchlistItem(
        { ...newItemFromDetails(details, result.media_type === 'tv' ? 'TV Shows' : 'Movies'), watched: true },
        { seasons: details.seasons, watchedWhen },
      );
    } catch {
      // The watchlist mutation shows its own failure toast.
    } finally {
      setPending((current) => {
        const next = new Set(current);
        next.delete(key);
        return next;
      });
    }
  };

  return (
    <TmdbSearchDialog
      open={open}
      onOpenChange={setOpen}
      triggerLabel="Search watched titles"
      trigger={
        <Button variant="outline" className="h-auto min-h-14 w-full justify-start gap-3 rounded-xl border-border/60 bg-card px-4 py-3 text-left text-muted-foreground hover:text-foreground">
          <Search className="h-5 w-5 shrink-0" />
          <span className="min-w-0 flex-1">Search for a film or series you watched…</span>
          <Plus className="h-4 w-4 shrink-0" />
        </Button>
      }
      title="Log a watched title"
      description="Search for a film or TV series and choose when you watched it."
      searchLabel={type === 'movie' ? 'Search films' : type === 'tv' ? 'Search series' : 'Search films and series'}
      placeholder={type === 'movie' ? 'Type a film name…' : type === 'tv' ? 'Type a series name…' : 'Type a film or series name…'}
      query={query}
      onQueryChange={(value) => { clearSearch(); setQuery(value); }}
      results={results}
      loading={loading}
      getPosterUrl={getPosterUrl}
      resultKey={(result) => `${result.media_type}-${result.id}`}
      isDisabled={(result) => pending.has(`${result.media_type}-${result.id}`) || !!existingFor(result)}
      renderActions={(result) => {
        if (existingFor(result)) return null;
        const key = `${result.media_type}-${result.id}`;
        const releaseDate = result.release_date || result.first_air_date;
        const notOutYet = !!releaseDate && releaseDate.slice(0, 10) > todayLocal();
        return (
          <div className="mt-3">
            <WatchedWhenMenu
              releaseDate={releaseDate || undefined}
              releaseText={result.media_type === 'tv' ? "On each episode's air date" : undefined}
              disabled={libraryLoading || notOutYet || pending.has(key)}
              onPick={(when) => { void add(result, when); }}
              size="default"
              className="min-h-11"
            >
              {libraryLoading ? 'Checking library…' : notOutYet ? 'Not out yet' : 'Seen it · choose when'}
            </WatchedWhenMenu>
          </div>
        );
      }}
      renderStatus={(result) => {
        const key = `${result.media_type}-${result.id}`;
        const existing = existingFor(result);
        return pending.has(key) ? (
          <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />Adding…
          </span>
        ) : existing ? (
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{alreadyWatched(result) ? 'Already watched' : 'Already in library'}</span>
        ) : null;
      }}
    />
  );
}

/** Discover: what is coming that you do not follow, grouped franchises/spin-offs you have started, then "more like this". */
export function DiscoverySection({ type }: { type: LibraryType }) {
  const discovery = useDiscovery(type);
  const { isAdmin } = useAuth();
  const { watchlist, getAutoStatus, isEpisodeWatched, isSeasonWatched, toggleEpisodeWatched } = useWatchlist();
  const { addToLibrary, isAdding } = useAddToLibrary();
  const [selected, setSelected] = useState<{ id: string; category: 'Movies' | 'TV Shows' } | null>(null);
  const [previewEntry, setPreviewEntry] = useState<OrderEntryView | null>(null);
  const [resetFailed, setResetFailed] = useState(false);
  const comingSoon = discovery.upcoming.slice(0, 12);
  const resetAnswers = async () => {
    setResetFailed(false);
    try { await discovery.resetDismissed(); } catch { setResetFailed(true); }
  };

  const openEntry = (entry: OrderEntryView) => {
    if (entry.libraryId) {
      setSelected({ id: entry.libraryId, category: entry.mediaType === 'movie' ? 'Movies' : 'TV Shows' });
    } else {
      setPreviewEntry(entry);
    }
  };
  const selectedItem = selected && watchlist.find((i) => i.category === selected.category && i.id === selected.id);

  return (
    <div className="ultrawide-discover-grid">
      {isAdmin && <div style={{ gridColumn: '1 / -1' }}><DiscoverAddSearch type={type} /></div>}
      <section className="space-y-4 min-w-0" aria-labelledby="discover-coming-soon">
        <div className="space-y-1">
          <h2 id="discover-coming-soon"><DotMatrixText text="COMING SOON" size="sm" /></h2>
          <p className="text-sm text-muted-foreground">Outside your library, over the next six months. Dates can change, and a cinema release is not streaming.</p>
        </div>
        {(discovery.upcomingLoading || (comingSoon.length === 0 && discovery.upcomingLoadingMore)) && (
          <p role="status" className="text-sm text-muted-foreground">Finding new releases…</p>
        )}
        {discovery.upcomingFailed && <p role="status" className="text-sm text-muted-foreground">Some new releases couldn’t load.</p>}
        {!discovery.upcomingLoading && !discovery.upcomingLoadingMore && !discovery.upcomingFailed && comingSoon.length === 0 && (
          <p className="text-sm text-muted-foreground">Nothing new among the most popular releases of the next six months.</p>
        )}
        {comingSoon.length > 0 && <TileGrid items={comingSoon} onDismiss={(media, id) => discovery.dismiss(media, id, 'coming_soon')} />}
      </section>

      <section className="space-y-4 min-w-0" aria-labelledby="discover-already-watched">
        <div className="space-y-1">
          <h2 id="discover-already-watched"><DotMatrixText text="HAVE YOU ALREADY WATCHED?" size="sm" /></h2>
          <p className="text-sm text-muted-foreground">
            Film collections, shared universes such as the Marvel Cinematic Universe, and connected TV spin-offs you have started, each in release order, so you can log what you’ve seen or add the rest.
          </p>
          <p className="text-xs text-muted-foreground">
            Most recent first, by the last time you added, watched, unwatched or re-dated a title in it, or changed its Library visibility. Release dates don’t count.
          </p>
        </div>
        {discovery.franchisesLoading && (
          <p className="text-sm text-muted-foreground">
            {/* Announced once; the count beside it changes every batch and stays quiet. */}
            <span role="status">Checking your series and collections…</span>
            {discovery.collectionsTotal > 0 && (
              <span className="tabular-nums"> {discovery.collectionsChecked} of {discovery.collectionsTotal} collections</span>
            )}
          </p>
        )}
        {discovery.franchisesFailed && (
          <div role="status" className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <p>Some series and collections couldn’t load (TMDB rate limit or network error). Wait a moment and retry.</p>
            <Button variant="outline" size="sm" onClick={discovery.retryFranchises}>Retry</Button>
          </div>
        )}
        {!discovery.franchisesLoading && !discovery.franchisesFailed && !discovery.likelySeenLoading && discovery.franchises.length === 0 && discovery.likelySeen.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No incomplete series, spin-offs or likely seen titles found in this view.
          </p>
        )}
        {discovery.franchises.length > 0 && (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,22rem),1fr))] items-start gap-3">
            {discovery.franchises.map((group) => (
              <DiscoveryFranchiseCard
                key={group.key}
                group={group}
                onOpen={openEntry}
                onAddToLibrary={isAdmin ? (entry) => void addToLibrary(entry) : undefined}
                onSeenIt={isAdmin ? (entry, when) => void addToLibrary(entry, { watched: true, watchedWhen: when }) : undefined}
                onDismiss={(entry) => discovery.dismiss(entry.mediaType, entry.tmdbId, 'franchise')}
                isAdding={isAdding}
              />
            ))}
          </div>
        )}
        {discovery.hasMoreFranchises && (
          <div className="flex justify-center pt-1">
            <Button variant="outline" onClick={discovery.loadMoreFranchises}>
              Show more series &amp; collections
            </Button>
          </div>
        )}
        {discovery.likelySeenLoading && (
          <p role="status" className="pt-2 text-sm text-muted-foreground">Finding titles you may have seen…</p>
        )}
        {discovery.likelySeen.length > 0 && (
          <div className="space-y-3 pt-2">
            <div className="space-y-0.5">
              <h3 className="text-sm font-medium">Likely seen</h3>
              <p className="text-xs text-muted-foreground">
                {type === 'tv'
                  ? 'Series recommended across several titles in your library, and widely watched ones.'
                  : 'Well-known films by the directors and actors you watch most, titles recommended across several in your library, and widely watched ones.'}
              </p>
            </div>
            <TileGrid
              items={discovery.likelySeen}
              onDismiss={(media, id) => discovery.dismiss(media, id, 'likely_seen')}
              onNotSeen={discovery.markNotSeen}
            />
          </div>
        )}
      </section>

      <section className="space-y-4" aria-labelledby="discover-might-like">
        <div className="space-y-1">
          <h2 id="discover-might-like"><DotMatrixText text="YOU MIGHT LIKE" size="sm" /></h2>
          <p className="text-sm text-muted-foreground">Discover new films and series outside the collections above, based on what you rate highly, favourite and watch.</p>
        </div>
        {discovery.loading && <p role="status" className="text-sm text-muted-foreground">Finding films and shows for you…</p>}
        {!discovery.loading && discovery.loadingMore && discovery.recommendations.length === 0 && (
          <p role="status" className="text-sm text-muted-foreground">Finding more suggestions…</p>
        )}
        {discovery.failed && (
          <div role="status" className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <p>Suggestions couldn’t load.</p>
            <Button variant="outline" onClick={discovery.retry}>Retry</Button>
          </div>
        )}
        {discovery.partlyFailed && <p role="status" className="text-sm text-muted-foreground">A few suggestions couldn’t load; Show more keeps looking.</p>}
        {discovery.recommendations.length > 0 && <TileGrid items={discovery.recommendations} onDismiss={(media, id) => discovery.dismiss(media, id, 'you_might_like')} />}
        {!discovery.loading && !discovery.loadingMore && discovery.recommendations.length === 0 && !discovery.failed && (
          <p className="text-sm text-muted-foreground">
            {discovery.hasMore
              ? 'Nothing new in the suggestions checked so far. Show more keeps looking.'
              : 'No more suggestions to show.'}
          </p>
        )}
        {!discovery.loading && (discovery.recommendations.length > 0 || discovery.hasMore) && (
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            {discovery.recommendations.length > 0 && (
              <Button
                variant="ghost"
                disabled={discovery.loadingMore}
                onClick={() => {
                  discovery.skipMany(discovery.recommendations);
                  if (discovery.hasMore && !discovery.loadingMore) discovery.loadMore();
                }}
              >
                <X className="h-4 w-4" />
                Skip these
              </Button>
            )}
            {discovery.hasMore && (
              <Button variant="outline" onClick={discovery.loadMore} disabled={discovery.loadingMore}>
                {discovery.loadingMore ? 'Loading…' : 'Show more suggestions'}
              </Button>
            )}
          </div>
        )}
      </section>

      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span>
          Suggestions from TMDB. “Not interested” hides a title across Discover; “Skip these” hides a page of suggestions for {SKIP_DAYS} days, but not from “Have you already watched?”; “Not seen” stops a title being asked about in Likely seen. All are {discovery.synced ? 'saved across your devices' : 'remembered on this browser'}.
        </span>
        {discovery.dismissedCount > 0 && <Button variant="ghost" onClick={() => { void resetAnswers(); }}>Reset Discover answers</Button>}
        {resetFailed && <p role="alert" className="text-destructive">Couldn’t reset your answers. Try again.</p>}
      </div>

      {selectedItem && (
        <WatchlistDetailDialog
          open
          onOpenChange={(open) => {
            if (!open) setSelected(null);
          }}
          item={selectedItem}
          status={getAutoStatus(selectedItem)}
          toggleEpisodeWatched={isAdmin ? toggleEpisodeWatched : undefined}
          isEpisodeWatched={isEpisodeWatched}
          isSeasonWatched={isSeasonWatched}
        />
      )}
      {previewEntry && (
        <EntryPreviewDialog
          entry={previewEntry}
          onOpenChange={(open) => {
            if (!open) setPreviewEntry(null);
          }}
          onAddToLibrary={isAdmin ? (entry) => addToLibrary(entry) : undefined}
          onSeenIt={isAdmin ? (entry, when) => addToLibrary(entry, { watched: true, watchedWhen: when }) : undefined}
          onDismiss={(entry) => discovery.dismiss(entry.mediaType, entry.tmdbId, 'franchise')}
          adding={isAdding(previewEntry.key)}
        />
      )}
    </div>
  );
}
