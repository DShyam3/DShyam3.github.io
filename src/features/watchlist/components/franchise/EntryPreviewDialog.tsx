import { useQuery } from '@tanstack/react-query';
import { Check, Loader2, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useTMDB } from '@/features/watchlist/useTMDB';
import type { OrderEntryView } from '@/features/watchlist/franchise';
import type { WatchedWhen } from '@/features/watchlist/watched-when';
import { PlatformBadge } from '@/features/watchlist/components/PlatformLogo';
import { TitleScores } from '@/features/watchlist/components/TitleScores';
import { TrailerButton } from '@/features/watchlist/components/TrailerButton';
import { WatchedWhenMenu } from '@/features/watchlist/components/WatchedWhenMenu';
import { CreditsList, RuntimeRow, SeriesStatusPill } from '@/features/watchlist/components/WatchlistDetailParts';

type Detail = NonNullable<Awaited<ReturnType<ReturnType<typeof useTMDB>['getMovieDetails']>>>;

/** TMDB preview dialog for a franchise/collection entry that is not in the library yet. */
export function EntryPreviewDialog({
  entry,
  onOpenChange,
  onAddToLibrary,
  onSeenIt,
  onDismiss,
  adding = false,
}: {
  entry: OrderEntryView;
  onOpenChange: (open: boolean) => void;
  onAddToLibrary?: (entry: OrderEntryView) => Promise<void> | void;
  onSeenIt?: (entry: OrderEntryView, when: WatchedWhen) => Promise<void> | void;
  onDismiss?: (entry: OrderEntryView) => void;
  adding?: boolean;
}) {
  const { getMovieDetails } = useTMDB();
  const { data: detail = null, isPending: loading, isError: error } = useQuery<Detail>({
    queryKey: ['watchlist', 'tmdb-details', entry.mediaType, entry.tmdbId],
    staleTime: 30 * 60 * 1000,
    queryFn: async () => {
      const details = await getMovieDetails(entry.tmdbId, entry.mediaType);
      if (!details) throw new Error('TMDB details unavailable');
      return details;
    },
  });

  const poster = detail?.poster || entry.poster;
  const year = detail?.release_year?.toString() || entry.releaseDate?.slice(0, 4);
  const mediaLabel = entry.mediaType === 'tv' ? 'Series' : 'Film';
  const releaseDate = detail?.release_date?.slice(0, 10) || entry.releaseDate?.slice(0, 10) || '';
  const todayIso = new Date().toLocaleDateString('en-CA');
  const released = !releaseDate || releaseDate <= todayIso;

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {poster && (
          <div className="flex justify-center">
            <img src={poster} alt={entry.title} className="max-h-52 w-auto rounded-lg object-contain" />
          </div>
        )}
        <DialogHeader>
          <DialogTitle>{entry.title}</DialogTitle>
          <DialogDescription>
            {[
              [year, mediaLabel].filter(Boolean).join(' · '),
              entry.mediaType === 'tv' && detail?.season_count
                ? `${detail.season_count} season${detail.season_count === 1 ? '' : 's'}`
                : null,
              detail?.genres?.length ? detail.genres.join(', ') : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {(detail?.platform || detail?.series_status) && (
            <div className="flex flex-wrap items-center gap-2">
              <PlatformBadge platform={detail?.platform} size={20} />
              {detail?.series_status && <SeriesStatusPill status={detail.series_status} className="px-2.5 py-1" />}
            </div>
          )}
          <p className="text-sm leading-relaxed text-muted-foreground">
            {detail?.overview || (loading ? 'Loading…' : error ? 'Could not load details from TMDB.' : 'No synopsis available.')}
          </p>
          <CreditsList
            kind={entry.mediaType}
            leads={entry.mediaType === 'tv' ? detail?.creators ?? undefined : detail?.directors ?? undefined}
            cast={detail?.top_cast ?? undefined}
          />
          {entry.mediaType === 'movie' && detail?.runtime ? (
            <RuntimeRow runtime={detail.runtime} className="text-muted-foreground" iconClassName="text-muted-foreground" />
          ) : null}
          <TitleScores
            tmdbRating={detail?.tmdb_rating ?? undefined}
            tmdbVotes={detail?.tmdb_votes ?? undefined}
          />
          <TrailerButton trailerKey={detail?.trailer_key} title={entry.title} />
          {detail && !detail.trailer_key && <p className="text-xs text-muted-foreground">No trailer available yet.</p>}
          {(onAddToLibrary || onSeenIt || onDismiss) && (
            <div className="flex flex-wrap gap-2 pt-1">
              {onAddToLibrary && (
                <Button
                  type="button"
                  disabled={adding}
                  onClick={async () => {
                    await onAddToLibrary(entry);
                    onOpenChange(false);
                  }}
                >
                  {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  {adding ? 'Adding…' : 'Add to watchlist'}
                </Button>
              )}
              {onSeenIt && released && (
                <WatchedWhenMenu
                  releaseDate={releaseDate || undefined}
                  releaseText={entry.mediaType === 'tv' ? "On each episode's air date" : undefined}
                  disabled={adding}
                  onPick={async (when) => {
                    await onSeenIt(entry, when);
                    onOpenChange(false);
                  }}
                  variant="outline"
                  size="default"
                  className="min-h-10 text-sm"
                >
                  <Check className="h-4 w-4" />
                  Seen it
                </WatchedWhenMenu>
              )}
              {onDismiss && (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={adding}
                  onClick={() => {
                    onDismiss(entry);
                    onOpenChange(false);
                  }}
                >
                  <X className="h-4 w-4" />
                  Not interested
                </Button>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
