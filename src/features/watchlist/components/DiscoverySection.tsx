import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Check, EyeOff, Loader2, Plus, Search, X } from 'lucide-react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
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
import { useDeleteConfirm } from '@/hooks/useDeleteConfirm';
import { useWatchlist } from '../useWatchlist';
import { useTMDB } from '../useTMDB';
import type { TMDBResult } from '../useTMDB';
import { newItemFromDetails } from '../new-item';
import { findExistingTitle } from '../existing-title';
import { discoveryDate, discoveryKey, keepHeldInPlace, type DiscoveryItem, type DiscoveryMedia, type HeldTile } from '../discovery';
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
import { PersonalRating } from './PersonalRating';
import { RateWatchedEntry } from './RateWatchedEntry';
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
  const run = async <T,>(action: () => Promise<T>, failure: string): Promise<T | undefined> => {
    setPending(true); setError('');
    try { return await action(); } catch { setError(failure); return undefined; } finally { setPending(false); }
  };
  /**
   * The title as the library stores it once it is there (added, or already
   * there under that title); null if the add failed or the same add is
   * already in flight.
   */
  const add = async (watched: boolean, watchedWhen?: WatchedWhen): Promise<string | null> => (await run(async () => {
    const data = await fetchDetail();
    const payload = discoveryAddPayload(item, data, watched);
    // The library refresh removes this suggestion once the save succeeds.
    return (await addWatchlistItem(payload, { watchedWhen, seasons: data.seasons })) ? payload.title : null;
  }, 'Could not add this title. Please try again.')) ?? null;
  const loadDetail = () => run(async () => { await fetchDetail(); }, 'Could not load details. Try again.');
  return { pending, error, detail, add, loadDetail };
}

function SuggestionActions({ item, onDismiss, onSeen, onNotSeen, actions, layout }: {
  item: DiscoveryItem;
  onDismiss: () => void;
  onSeen: (when: WatchedWhen) => void;
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
      onPick={onSeen}
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
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="icon" className="h-11 w-11" onClick={() => { void actions.add(false); }} disabled={actions.pending} aria-label={`Add ${title} to watchlist`}>
              <Plus className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Add to watchlist</TooltipContent>
        </Tooltip>
      )}
      {isAdmin && released && seenIt(<Check className="h-4 w-4" />, { size: 'icon', className: 'h-11 w-11', label: `Add ${title} as already watched` })}
      {onNotSeen && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-11 w-11 text-muted-foreground" onClick={onNotSeen} disabled={actions.pending} aria-label={`Mark ${title} as not seen`}>
              <EyeOff className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Not seen</TooltipContent>
        </Tooltip>
      )}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" className="h-11 w-11 text-muted-foreground" onClick={onDismiss} disabled={actions.pending} aria-label={`Not interested in ${title}`}>
            <X className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Not interested</TooltipContent>
      </Tooltip>
    </div>
  );
}

function SuggestionTile({ item, onDismiss, onNotSeen, onHold, onRelease }: {
  item: DiscoveryItem;
  onDismiss: () => void;
  onNotSeen?: () => void;
  /** Keeps the tile in its place once its title joins the library, until `onRelease`. */
  onHold: () => void;
  onRelease: () => void;
}) {
  const { getPosterUrl } = useTMDB();
  const { watchlist, setPersonalRating, ratingsStatus } = useWatchlist();
  const actions = useAddSuggestion(item);
  const [open, setOpen] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  // Logged with Seen it: the tile offers the rating in place of its actions,
  // and goes once rated or skipped. `title` is the library's, for finding
  // the row the way the add matched it.
  const [logged, setLogged] = useState<{ title: string; focus: boolean } | null>(null);
  const posterRef = useRef<HTMLButtonElement>(null);
  const title = titleOf(item);
  const poster = item.poster_path && !imageFailed ? getPosterUrl(item.poster_path) : null;
  const openDetail = () => { setOpen(true); if (!actions.detail) void actions.loadDetail(); };
  const category = item.media === 'movie' ? 'Movies' : 'TV Shows';
  const libraryItem = logged
    ? watchlist.find((row) => row.category === category && (row.tmdb_id === item.id || row.title.toLowerCase() === logged.title.toLowerCase()))
    : undefined;
  // Only once the scores are in: until then an unrated title may only look
  // unrated, and a save onto a failed read would leave every other title
  // looking unrated too.
  const offer = !!logged && ratingsStatus === 'ready' && !!libraryItem && libraryItem.personal_rating == null;
  const prompt = item.media === 'movie' ? 'Watched — rate it?' : 'Seen it — rate the show?';
  const letGo = () => { setLogged(null); onRelease(); };
  // Nothing to offer for good: the scores failed to load, or the title
  // already has one (a library row found by its title).
  useEffect(() => {
    if (logged && (ratingsStatus === 'failed' || libraryItem?.personal_rating != null)) letGo();
  });
  const seen = async (when: WatchedWhen) => {
    // The Seen it menu's item, drawn outside the tile, holds focus until the save lands.
    const picked = document.activeElement;
    onHold();
    setOpen(false);
    const stored = await actions.add(true, when);
    if (stored === null) { onRelease(); return; }
    // Rate takes focus only from a control this tile is about to take away,
    // never from somewhere the owner has moved on to.
    const active = document.activeElement;
    setLogged({
      title: stored,
      focus: !active || active === document.body || active === picked || !!posterRef.current?.closest('article')?.contains(active),
    });
  };
  return (
    <>
      <PosterCard
        title={title}
        poster={poster}
        onOpen={openDetail}
        cardRef={posterRef}
        subtitle={metaLine(item)}
        meta={
          <>
            {/* A wildcard is labelled like a franchise release: it is not a seed's suggestion. */}
            {offer ? (
              <span className="truncate text-xs font-medium text-primary">{prompt}</span>
            ) : item.kind === 'recommendation' && !item.wildcard ? (
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
        footer={logged ? (
          // One row, the height of the actions it replaces; the prompt is in the meta line.
          <div className="flex shrink-0 items-center gap-1 border-t px-2 py-1.5">
            {offer && libraryItem ? (
              <PersonalRating
                label={`Your rating of ${title}`}
                value={libraryItem.personal_rating}
                onChange={async (rating) => { await setPersonalRating(libraryItem, rating); letGo(); }}
                prompt={prompt}
                showLabel={false}
                onSkip={letGo}
                autoFocus={logged.focus}
              />
            ) : (
              <>
                <span role="status" className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                  {ratingsStatus === 'loading' ? 'Loading your ratings…' : 'Saving…'}
                </span>
                <Button type="button" variant="ghost" size="sm" className="min-h-11 text-xs" onClick={letGo} aria-label={`Skip rating ${title}`}>
                  Skip
                </Button>
              </>
            )}
          </div>
        ) : (
          <SuggestionActions item={item} onDismiss={onDismiss} onSeen={(when) => { void seen(when); }} onNotSeen={onNotSeen} actions={actions} layout="tile" />
        )}
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
            {!logged && (
              <SuggestionActions
                item={item}
                onDismiss={() => { setOpen(false); onDismiss(); }}
                onSeen={(when) => { void seen(when); }}
                onNotSeen={onNotSeen && (() => { setOpen(false); onNotSeen(); })}
                actions={actions}
                layout="row"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

const tileKey = (item: DiscoveryItem) => discoveryKey(item.media, item.id);

/**
 * A grid of suggestion tiles, with `heading` above it while it has any. It
 * stays mounted when `items` empties, so a tile still offering its rating
 * outlives the last of the others.
 */
function TileGrid({ items, type = 'all', onDismiss, onNotSeen, heading, footer, className }: {
  items: DiscoveryItem[];
  /** The tab: a held tile of the other media waits out of sight. */
  type?: LibraryType;
  onDismiss: (item: DiscoveryItem) => void;
  onNotSeen?: (media: DiscoveryMedia, id: number) => void;
  heading?: ReactNode;
  /** Below the grid, given the tiles shown less any still being logged with Seen it. */
  footer?: (answerable: DiscoveryItem[]) => ReactNode;
  className?: string;
}) {
  // A tile logged with Seen it leaves `items` as its title joins the library;
  // it is held where it was while it offers the rating.
  const [held, setHeld] = useState<HeldTile<DiscoveryItem>[]>([]);
  const gridRef = useRef<HTMLDivElement>(null);
  const refocus = useRef<{ key: string; index: number } | null>(null);
  // A held tile of the other media is let go on a tab change: hidden, its
  // tile would unmount and forget it was asking. Filtered here too for the
  // render before that lands.
  useEffect(() => {
    const ofType = (entry: HeldTile<DiscoveryItem>) => type === 'all' || entry.item.media === type;
    setHeld((current) => (current.every(ofType) ? current : current.filter(ofType)));
  }, [type]);
  const shown = keepHeldInPlace(items, held.filter((entry) => type === 'all' || entry.item.media === type), tileKey);
  // A release can come from an earlier render's callback (a save that
  // failed after a wait); it reads the lists as they are now.
  const latest = useRef({ items, shown });
  useLayoutEffect(() => { latest.current = { items, shown }; });
  const placeOf = (list: readonly DiscoveryItem[], key: string) => Math.max(0, list.findIndex((candidate) => tileKey(candidate) === key));
  const hold = (item: DiscoveryItem) => {
    const key = tileKey(item);
    const after = shown.slice(0, placeOf(shown, key)).map(tileKey);
    setHeld((current) => (current.some((entry) => tileKey(entry.item) === key) ? current : [...current, { item, after }]));
  };
  const release = (item: DiscoveryItem) => {
    const key = tileKey(item);
    // A tile still in `items` (its save failed) stays, and keeps its focus.
    if (!latest.current.items.some((candidate) => tileKey(candidate) === key)) {
      refocus.current = { key, index: placeOf(latest.current.shown, key) };
    }
    setHeld((current) => (current.some((entry) => tileKey(entry.item) === key) ? current.filter((entry) => tileKey(entry.item) !== key) : current));
  };
  // A released tile takes its focus with it: hand focus to the tile now in
  // its place. Saving a rating re-renders the grid once before the release
  // lands, so this waits for the render the tile is gone from.
  useEffect(() => {
    const pending = refocus.current;
    if (!pending || shown.some((item) => tileKey(item) === pending.key)) return;
    refocus.current = null;
    if (document.activeElement && document.activeElement !== document.body) return;
    const cards = gridRef.current?.querySelectorAll('article');
    if (!cards?.length) return;
    cards[Math.min(pending.index, cards.length - 1)].querySelector<HTMLElement>('button')?.focus();
  });
  if (shown.length === 0) return null;
  return (
    <div ref={gridRef} className={className}>
      {heading}
      <CardGrid>
        {shown.map((item) => (
          <SuggestionTile
            key={tileKey(item)}
            item={item}
            onDismiss={() => onDismiss(item)}
            onNotSeen={onNotSeen && (() => onNotSeen(item.media, item.id))}
            onHold={() => hold(item)}
            onRelease={() => release(item)}
          />
        ))}
      </CardGrid>
      {footer?.(shown.filter((item) => !held.some((entry) => tileKey(entry.item) === tileKey(item))))}
    </div>
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
  const { askDelete: askReset, deleteDialog: resetDialog } = useDeleteConfirm();
  // Likely seen's last "None of these", for its status line and Undo.
  const [noneMarked, setNoneMarked] = useState<{ items: DiscoveryItem[]; undo: 'idle' | 'pending' | 'failed' } | null>(null);
  const undoRef = useRef<HTMLButtonElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);
  // The grid may empty under the button while the next page loads: focus
  // goes to Undo, which stays put, rather than falling to the page.
  useEffect(() => {
    if (noneMarked?.undo === 'idle') undoRef.current?.focus();
  }, [noneMarked]);
  const noneOfThese = (items: DiscoveryItem[]) => {
    if (items.length === 0) return;
    discovery.noneOfTheseLikelySeen(items);
    setNoneMarked({ items, undo: 'idle' });
  };
  const undoNoneOfThese = async () => {
    if (!noneMarked) return;
    setNoneMarked({ ...noneMarked, undo: 'pending' });
    try {
      await discovery.unmarkNotSeen(noneMarked.items);
      setNoneMarked(null);
    } catch {
      setNoneMarked({ ...noneMarked, undo: 'failed' });
    }
  };
  const comingSoon = discovery.upcoming.slice(0, 12);
  // "films lean to Comedy, Action, Adventure · 2010s · English", per tab.
  const tasteLines = ([['movie', 'films'], ['tv', 'series']] as const)
    .filter(([media]) => type === 'all' || type === media)
    .flatMap(([media, label]) => {
      const summary = discovery.taste[media];
      if (!summary) return [];
      const leans = [summary.genres.join(', '), summary.decade, summary.languages.join(', ')].filter(Boolean).join(' · ');
      return [`${label} lean to ${leans}${summary.avoids.length > 0 ? `, away from ${summary.avoids.join(' and ')}` : ''}`];
    });
  const resetAnswers = async () => {
    setResetFailed(false);
    try { await discovery.resetDismissed(); } catch { setResetFailed(true); }
  };
  // One click forgot every answer, and the button sits under the grid where
  // a stray tap lands: ask first.
  const confirmReset = () => askReset({
    title: 'Reset Discover answers?',
    description: `Forgets your ${discovery.dismissedCount.toLocaleString('en-GB')} Not interested, Skip these and Not seen ${discovery.dismissedCount === 1 ? 'answer' : 'answers'} ${discovery.synced ? 'on every device' : 'on this browser'}, so Discover suggests those titles again. This can’t be undone.`,
    confirmLabel: 'Reset answers',
    onConfirm: resetAnswers,
    // The button leaves once nothing is left to reset.
    returnFocusTo: () => footerRef.current,
  });

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
      {isAdmin && (
        <div className="space-y-2" style={{ gridColumn: '1 / -1' }}>
          <DiscoverAddSearch type={type} />
          <RateWatchedEntry type={type} />
        </div>
      )}
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
        {comingSoon.length > 0 && <TileGrid items={comingSoon} onDismiss={(item) => discovery.dismiss(item, 'coming_soon')} />}
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
                onDismiss={(entry) => discovery.dismiss({ media: entry.mediaType, id: entry.tmdbId, release_date: entry.releaseDate }, 'franchise')}
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
        <TileGrid
          items={discovery.likelySeen}
          type={type}
          onDismiss={(item) => discovery.dismiss(item, 'likely_seen')}
          onNotSeen={discovery.markNotSeen}
          footer={(answerable) => answerable.length > 0 && (
            <div className="flex justify-center">
              <Button variant="ghost" onClick={() => noneOfThese(answerable)}>
                <EyeOff className="h-4 w-4" />
                None of these
              </Button>
            </div>
          )}
          className="space-y-3 pt-2"
          heading={
            <div className="space-y-0.5">
              <h3 className="text-sm font-medium">Likely seen</h3>
              <p className="text-xs text-muted-foreground">
                {type === 'tv'
                  ? 'Series recommended across several titles in your library, and widely watched ones.'
                  : 'Well-known films by the directors and actors you watch most, titles recommended across several in your library, and widely watched ones.'}
              </p>
            </div>
          }
        />
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          <p role="status">
            {noneMarked && (
              <>
                {noneMarked.undo === 'failed'
                  ? 'Couldn’t undo. Try again.'
                  : `Marked ${noneMarked.items.length} not seen.`}
                {noneMarked.undo !== 'failed' && discovery.likelySeenLoadingMore && ' Finding more…'}
                {noneMarked.undo !== 'failed' && !discovery.likelySeenLoadingMore && discovery.likelySeen.length === 0 && !discovery.likelySeenHasMore && ' Nothing more to ask about for now.'}
              </>
            )}
          </p>
          {noneMarked && (
            <Button
              ref={undoRef}
              variant="ghost"
              disabled={noneMarked.undo === 'pending'}
              onClick={() => { void undoNoneOfThese(); }}
            >
              {noneMarked.undo === 'pending' ? 'Undoing…' : 'Undo'}
            </Button>
          )}
        </div>
      </section>

      <section className="space-y-4" aria-labelledby="discover-might-like">
        <div className="space-y-1">
          <h2 id="discover-might-like"><DotMatrixText text="YOU MIGHT LIKE" size="sm" /></h2>
          <p className="text-sm text-muted-foreground">Discover new films and series outside the collections above, based on what you rate highly, favourite and watch.</p>
          {tasteLines.length > 0 && (
            <p className="text-xs text-muted-foreground">
              For each “Like” title, its closest fits to your taste come first. In your library, {tasteLines.join('; ')}.
            </p>
          )}
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
        <TileGrid items={discovery.recommendations} type={type} onDismiss={(item) => discovery.dismiss(item, 'you_might_like')} />
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

      <div ref={footerRef} tabIndex={-1} className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span>
          Suggestions from TMDB. “Not interested” hides a title across Discover; “Skip these” hides a page of suggestions for {SKIP_DAYS} days, but not from “Have you already watched?”; “Not seen” stops a title being asked about in Likely seen, and “None of these” answers it for every title shown there (Undo takes it back). All are {discovery.synced ? 'saved across your devices' : 'remembered on this browser'}.
        </span>
        {discovery.dismissedCount > 0 && <Button variant="ghost" onClick={confirmReset}>Reset Discover answers…</Button>}
        {resetFailed && <p role="alert" className="text-destructive">Couldn’t reset your answers. Try again.</p>}
      </div>
      {resetDialog}

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
          onDismiss={(entry) => discovery.dismiss({ media: entry.mediaType, id: entry.tmdbId, release_date: entry.releaseDate }, 'franchise')}
          adding={isAdding(previewEntry.key)}
        />
      )}
    </div>
  );
}
