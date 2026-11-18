import { useState } from 'react';
import { Check, Film, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { useDiscovery } from '../useDiscovery';
import { discoveryAddPayload } from '../discovery-add';
import type { LibraryType } from '../library-state';
import { TrailerButton } from './TrailerButton';

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
  const add = (watched: boolean) => run(async () => {
    const data = await fetchDetail();
    await addWatchlistItem(discoveryAddPayload(item, data, watched));
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
  if (layout === 'row') {
    return (
      <div className="flex flex-wrap gap-2">
        {isAdmin && <Button onClick={() => { void actions.add(false); }} disabled={actions.pending}><Plus className="h-4 w-4" />Add to watchlist</Button>}
        {isAdmin && released && <Button variant="outline" onClick={() => { void actions.add(true); }} disabled={actions.pending}><Check className="h-4 w-4" />Seen it</Button>}
        <Button variant="ghost" onClick={onDismiss} disabled={actions.pending}><X className="h-4 w-4" />Not interested</Button>
      </div>
    );
  }
  // Under the tile's text, never over the artwork (DESIGN_SYSTEM.md); icon
  // buttons at the 44px touch size, wrapping on a narrow phone tile.
  return (
    <div className="flex flex-wrap gap-1">
      {isAdmin && (
        <Button variant="outline" size="icon" className="h-11 w-11" onClick={() => { void actions.add(false); }} disabled={actions.pending} aria-label={`Add ${title} to watchlist`} title="Add to watchlist">
          <Plus className="h-4 w-4" />
        </Button>
      )}
      {isAdmin && released && (
        <Button variant="outline" size="icon" className="h-11 w-11" onClick={() => { void actions.add(true); }} disabled={actions.pending} aria-label={`Add ${title} as already watched`} title="Seen it">
          <Check className="h-4 w-4" />
        </Button>
      )}
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
    <article className="flex min-w-0 flex-col gap-2">
      <button type="button" onClick={openDetail} className="aspect-[2/3] w-full overflow-hidden rounded-2xl bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Details and trailer for ${title}`}>
        {poster ? <img src={poster} alt="" loading="lazy" className="h-full w-full object-cover" onError={() => setImageFailed(true)} /> : <Film className="mx-auto h-8 w-8 text-muted-foreground" />}
      </button>
      <div className="min-w-0 space-y-0.5 px-0.5">
        <h3 className="line-clamp-2 text-sm font-medium leading-snug">{title}</h3>
        <p className="text-xs text-muted-foreground">{metaLine(item)}</p>
        {item.kind === 'recommendation' && <p className="line-clamp-2 text-xs text-muted-foreground" title={item.reason}>{item.shortReason ?? item.reason}</p>}
        {actions.pending && <p role="status" className="text-xs text-muted-foreground">Adding…</p>}
        {actions.error && !open && <p role="alert" className="text-xs text-destructive">{actions.error}</p>}
      </div>
      <SuggestionActions item={item} onDismiss={onDismiss} actions={actions} layout="tile" />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{metaLine(item)}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {item.kind === 'recommendation' && <p className="text-sm">{item.reason}</p>}
            <p className="text-sm leading-relaxed text-muted-foreground">
              {actions.detail?.overview || item.overview || (actions.pending ? 'Loading…' : 'No synopsis available.')}
            </p>
            <TrailerButton trailerKey={actions.detail?.trailer_key} title={title} />
            {actions.detail && !actions.detail.trailer_key && <p className="text-xs text-muted-foreground">No trailer available yet.</p>}
            {actions.error && <p role="alert" className="text-xs text-destructive">{actions.error}</p>}
            <SuggestionActions item={item} onDismiss={() => { setOpen(false); onDismiss(); }} actions={actions} layout="row" />
          </div>
        </DialogContent>
      </Dialog>
    </article>
  );
}

const TILE_GRID = 'grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6';

function TileGrid({ items, onDismiss }: { items: DiscoveryItem[]; onDismiss: (media: DiscoveryMedia, id: number) => void }) {
  return (
    <div className={TILE_GRID}>
      {items.map((item) => <SuggestionTile key={discoveryKey(item.media, item.id)} item={item} onDismiss={() => onDismiss(item.media, item.id)} />)}
    </div>
  );
}

/** Discover: what is coming that you do not follow, then an endless "more like this". */
export function DiscoverySection({ type }: { type: LibraryType }) {
  const discovery = useDiscovery(type);
  const comingSoon = interleaveUpcoming(discovery.upcoming).slice(0, 12);
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

      <section className="space-y-4" aria-labelledby="discover-might-like">
        <div className="space-y-1">
          <h2 id="discover-might-like"><DotMatrixText text="YOU MIGHT LIKE" size="sm" /></h2>
          <p className="text-sm text-muted-foreground">More like what you rate highly, favourite and watch. Each one says why it is here.</p>
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
        {discovery.hasMore && !discovery.loading && (
          <div className="flex justify-center pt-2">
            <Button variant="outline" onClick={discovery.loadMore} disabled={discovery.loadingMore}>
              {discovery.loadingMore ? 'Loading…' : 'Show more suggestions'}
            </Button>
          </div>
        )}
      </section>

      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span>Suggestions from TMDB. “Not interested” {discovery.synced ? 'is saved across your devices' : 'is remembered on this browser'}.</span>
        {discovery.dismissedCount > 0 && <Button variant="ghost" onClick={() => { void discovery.resetDismissed(); }}>Reset dismissed suggestions</Button>}
      </div>
    </div>
  );
}
