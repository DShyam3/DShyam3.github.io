import { useState, type ReactNode } from 'react';
import { Check, Plus, X } from 'lucide-react';
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
import { discoveryDate, discoveryKey, interleaveUpcoming, type DiscoveryItem, type DiscoveryMedia } from '../discovery';
import { useDiscovery, type DiscoveryFranchiseGroup } from '../useDiscovery';
import { discoveryAddPayload } from '../discovery-add';
import type { OrderEntryView } from '../franchise';
import type { LibraryType } from '../library-state';
import type { WatchedWhen } from '../watched-when';
import { EntryList } from './franchise/EntryList';
import { FranchiseCard } from './franchise/FranchiseCard';
import { useAddToLibrary } from './franchise/useAddToLibrary';
import { PlatformBadge } from './PlatformLogo';
import { PosterCard } from './PosterCard';
import { TrailerButton } from './TrailerButton';
import { WatchedWhenMenu } from './WatchedWhenMenu';
import { WatchlistDetailDialog } from './WatchlistDetailDialog';
import { CreditsList, RuntimeRow, SeriesStatusPill } from './WatchlistDetailParts';

type Detail = NonNullable<Awaited<ReturnType<ReturnType<typeof useTMDB>['getMovieDetails']>>>;

const titleOf = (item: DiscoveryItem) => item.title || item.name || 'Untitled';
const mediaLabel = (item: DiscoveryItem) => (item.media === 'movie' ? 'Film' : 'Series');

/** "2014 · Film" for the back catalogue, "Thu 27 Nov · Film" for what is coming. */
function metaLine(item: DiscoveryItem): string {
  const date = discoveryDate(item);
  if (!date) return mediaLabel(item);
  const when = item.kind === 'upcoming'
    ? new Date(`${date.slice(0, 10)}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
    : date.slice(0, 4);
  return `${when} · ${mediaLabel(item)}`;
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
    await addWatchlistItem(discoveryAddPayload(item, data, watched), { watchedWhen });
    // The library refresh removes this suggestion once the save succeeds.
  }, 'Could not add this title. Please try again.');
  const loadDetail = () => run(async () => { await fetchDetail(); }, 'Could not load details. Try again.');
  return { pending, error, detail, add, loadDetail };
}

function SuggestionActions({ item, onDismiss, actions, layout }: {
  item: DiscoveryItem;
  onDismiss: () => void;
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
        {isAdmin && released && seenIt(<><Check className="h-4 w-4" />Seen it</>, { size: 'default', className: 'min-h-10 text-sm' })}
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
      <Button variant="ghost" size="icon" className="h-11 w-11 text-muted-foreground" onClick={onDismiss} disabled={actions.pending} aria-label={`Not interested in ${title}`} title="Not interested">
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

function SuggestionTile({ item, onDismiss }: { item: DiscoveryItem; onDismiss: () => void }) {
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
            ) : <span />}
            {actions.pending ? (
              <span role="status" className="truncate text-xs text-muted-foreground">Adding…</span>
            ) : actions.error && !open ? (
              <span role="alert" className="truncate text-xs text-destructive">{actions.error}</span>
            ) : null}
          </>
        }
        footer={<SuggestionActions item={item} onDismiss={onDismiss} actions={actions} layout="tile" />}
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
            <SuggestionActions item={item} onDismiss={() => { setOpen(false); onDismiss(); }} actions={actions} layout="row" />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function TileGrid({ items, onDismiss }: { items: DiscoveryItem[]; onDismiss: (media: DiscoveryMedia, id: number) => void }) {
  return (
    <CardGrid>
      {items.map((item) => <SuggestionTile key={discoveryKey(item.media, item.id)} item={item} onDismiss={() => onDismiss(item.media, item.id)} />)}
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
      summary={`${view.watched} of ${view.total} watched · ${group.missingCount} not in library`}
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

/** Discover: what is coming that you do not follow, grouped franchises/spin-offs you have started, then "more like this". */
export function DiscoverySection({ type }: { type: LibraryType }) {
  const discovery = useDiscovery(type);
  const { isAdmin } = useAuth();
  const { watchlist, getAutoStatus, isEpisodeWatched, isSeasonWatched, toggleEpisodeWatched } = useWatchlist();
  const { addToLibrary, isAdding } = useAddToLibrary();
  const [selected, setSelected] = useState<{ id: string; category: 'Movies' | 'TV Shows' } | null>(null);
  const comingSoon = interleaveUpcoming(discovery.upcoming).slice(0, 12);

  const openEntry = (entry: OrderEntryView) => {
    if (entry.libraryId) setSelected({ id: entry.libraryId, category: entry.mediaType === 'movie' ? 'Movies' : 'TV Shows' });
  };
  const selectedItem = selected && watchlist.find((i) => i.category === selected.category && i.id === selected.id);

  return (
    <div className="space-y-10">
      <section className="space-y-4" aria-labelledby="discover-coming-soon">
        <div className="space-y-1">
          <h2 id="discover-coming-soon"><DotMatrixText text="COMING SOON" size="sm" /></h2>
          <p className="text-sm text-muted-foreground">Outside your library, over the next six months. Dates can change, and a cinema release is not streaming.</p>
        </div>
        {discovery.upcomingLoading && <p role="status" className="text-sm text-muted-foreground">Finding new releases…</p>}
        {discovery.upcomingFailed && <p role="status" className="text-sm text-muted-foreground">Some new releases couldn’t load.</p>}
        {comingSoon.length > 0 && <TileGrid items={comingSoon} onDismiss={discovery.dismiss} />}
      </section>

      <section className="space-y-4" aria-labelledby="discover-already-watched">
        <div className="space-y-1">
          <h2 id="discover-already-watched"><DotMatrixText text="HAVE YOU ALREADY WATCHED?" size="sm" /></h2>
          <p className="text-sm text-muted-foreground">
            Film trilogies, collections and connected TV spin-offs from what is already in your library, grouped in release order so you can log what you’ve seen or add the rest.
          </p>
        </div>
        {discovery.franchisesLoading && discovery.franchises.length === 0 && (
          <p role="status" className="text-sm text-muted-foreground">Checking series, trilogies and spin-offs…</p>
        )}
        {!discovery.franchisesLoading && discovery.franchises.length === 0 && (
          <p className="text-sm text-muted-foreground">No incomplete series or spin-off groups found in this view.</p>
        )}
        {discovery.franchises.length > 0 && (
          <div className="space-y-3">
            {discovery.franchises.map((group) => (
              <DiscoveryFranchiseCard
                key={group.key}
                group={group}
                onOpen={openEntry}
                onAddToLibrary={isAdmin ? (entry) => void addToLibrary(entry) : undefined}
                onSeenIt={isAdmin ? (entry, when) => void addToLibrary(entry, { watched: true, watchedWhen: when }) : undefined}
                onDismiss={(entry) => discovery.dismiss(entry.mediaType, entry.tmdbId)}
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
      </section>

      <section className="space-y-4" aria-labelledby="discover-might-like">
        <div className="space-y-1">
          <h2 id="discover-might-like"><DotMatrixText text="YOU MIGHT LIKE" size="sm" /></h2>
          <p className="text-sm text-muted-foreground">Discover new films and series outside the collections above, based on what you rate highly, favourite and watch.</p>
        </div>
        {discovery.loading && <p role="status" className="text-sm text-muted-foreground">Finding films and shows for you…</p>}
        {discovery.failed && (
          <div role="status" className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <p>Suggestions couldn’t load.</p>
            <Button variant="outline" onClick={discovery.retry}>Retry</Button>
          </div>
        )}
        {discovery.partlyFailed && <p role="status" className="text-sm text-muted-foreground">A few suggestions couldn’t load; Show more keeps looking.</p>}
        {discovery.recommendations.length > 0 && <TileGrid items={discovery.recommendations} onDismiss={discovery.dismiss} />}
        {!discovery.loading && discovery.recommendations.length === 0 && !discovery.failed && (
          <p className="text-sm text-muted-foreground">Nothing new on this page. Show more to keep looking.</p>
        )}
        {!discovery.loading && (discovery.recommendations.length > 0 || discovery.hasMore) && (
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            {discovery.recommendations.length > 0 && (
              <Button
                variant="ghost"
                disabled={discovery.loadingMore}
                onClick={() => {
                  discovery.dismissMany(discovery.recommendations);
                  if (discovery.hasMore && !discovery.loadingMore) discovery.loadMore();
                }}
              >
                <X className="h-4 w-4" />
                None of these
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
        <span>Suggestions from TMDB. “Not interested” {discovery.synced ? 'is saved across your devices' : 'is remembered on this browser'}.</span>
        {discovery.dismissedCount > 0 && <Button variant="ghost" onClick={() => { void discovery.resetDismissed(); }}>Reset dismissed suggestions</Button>}
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
    </div>
  );
}
