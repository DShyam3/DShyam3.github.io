import { useEffect, useId, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, Loader2, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useWorkspaceInspector } from '@/contexts/WorkspaceInspectorContext';
import { useTMDB } from '@/features/watchlist/useTMDB';
import type { OrderEntryView } from '@/features/watchlist/franchise';
import type { WatchedWhen } from '@/features/watchlist/watched-when';
import { PlatformBadge } from '@/features/watchlist/components/PlatformLogo';
import { TitleScores } from '@/features/watchlist/components/TitleScores';
import { TrailerButton } from '@/features/watchlist/components/TrailerButton';
import { WatchedWhenMenu } from '@/features/watchlist/components/WatchedWhenMenu';
import { CreditsList, RuntimeRow, SeriesStatusPill } from '@/features/watchlist/components/WatchlistDetailParts';

type Detail = NonNullable<Awaited<ReturnType<ReturnType<typeof useTMDB>['getMovieDetails']>>>;

/** TMDB preview inspector for a franchise/collection entry that is not in the library yet. */
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
  const instanceId = useId();
  const { claimDockedDetail, updateDockedDetail, releaseDockedDetail } = useWorkspaceInspector();
  const claimedKeyRef = useRef<string | null>(null);
  const { getMovieDetails } = useTMDB();
  const { data: detail = null, isPending: loading, isError: error } = useQuery<Detail>({
    // Not getMovieDetails' own key: a fetchQuery on the key this query is
    // fetching joins its own in-flight promise and never settles, and the
    // Add / Seen it lookup on that key would hang with it.
    queryKey: ['watchlist', 'entry-preview-details', entry.mediaType, entry.tmdbId],
    staleTime: 30 * 60 * 1000,
    queryFn: async () => {
      const details = await getMovieDetails(entry.tmdbId, entry.mediaType);
      if (!details) throw new Error('TMDB details unavailable');
      return details;
    },
  });

  const isTVShow = entry.mediaType === 'tv';
  const entryKey = `${entry.mediaType}:${entry.tmdbId}`;
  const poster = detail?.poster || entry.poster;
  const year = detail?.release_year?.toString() || entry.releaseDate?.slice(0, 4);
  const releaseDate = detail?.release_date?.slice(0, 10) || entry.releaseDate?.slice(0, 10) || '';
  const todayIso = new Date().toLocaleDateString('en-CA');
  const released = !releaseDate || releaseDate <= todayIso;

  useEffect(() => {
    const dock = claimedKeyRef.current === entryKey ? updateDockedDetail : claimDockedDetail;
    claimedKeyRef.current = entryKey;
    dock(instanceId, {
      id: `entry-preview-${entry.mediaType}-${entry.tmdbId}-${instanceId}`,
      eyebrow: isTVShow ? 'TV Series Inspector' : 'Movie Inspector',
      title: entry.title,
      onClose: () => onOpenChange(false),
      onReplaced: () => onOpenChange(false),
      node: (
        <div className="space-y-4">
          {poster ? (
            <div className="flex justify-center">
              <img
                src={poster}
                alt={entry.title}
                className="max-h-52 w-auto rounded-lg object-contain"
              />
            </div>
          ) : null}

          <div className="space-y-2">
            <h2 className="font-serif text-base font-semibold text-foreground leading-snug">
              {entry.title}
            </h2>

            <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-1.5">
              <span className="uppercase tracking-wider font-medium">
                {isTVShow ? 'TV Show' : 'Movie'}
              </span>
              {year ? <span>• {year}</span> : null}
              {isTVShow && detail?.season_count ? (
                <span>
                  • {detail.season_count} season{detail.season_count === 1 ? '' : 's'}
                </span>
              ) : null}
              {detail?.genres && detail.genres.length > 0 ? (
                <span>• {detail.genres.join(', ')}</span>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <PlatformBadge platform={detail?.platform} size={20} />
              {detail?.series_status ? (
                <SeriesStatusPill status={detail.series_status} className="px-2.5 py-1" />
              ) : null}
              <span className="rounded-full border border-dashed border-border px-2.5 py-1 text-xs font-medium text-muted-foreground">
                Not in library
              </span>
            </div>
          </div>

          <p className="text-sm leading-relaxed text-muted-foreground">
            {detail?.overview || (loading ? 'Loading…' : error ? 'Could not load details from TMDB.' : 'No synopsis available.')}
          </p>

          <CreditsList
            kind={entry.mediaType}
            leads={isTVShow ? detail?.creators ?? undefined : detail?.directors ?? undefined}
            cast={detail?.top_cast ?? undefined}
          />

          <TrailerButton
            trailerKey={detail?.trailer_key}
            title={entry.title}
            className="w-full"
          />
          {detail && !detail.trailer_key ? (
            <p className="text-xs text-muted-foreground">No trailer available yet.</p>
          ) : null}

          <TitleScores
            tmdbRating={detail?.tmdb_rating ?? undefined}
            tmdbVotes={detail?.tmdb_votes ?? undefined}
          />

          {!isTVShow && detail?.runtime ? (
            <RuntimeRow
              runtime={detail.runtime}
              className="text-muted-foreground"
              iconClassName="text-muted-foreground"
            />
          ) : null}

          {(onAddToLibrary || onSeenIt || onDismiss) ? (
            <div className="flex flex-wrap gap-2 border-t border-border/50 pt-3">
              {onAddToLibrary ? (
                <Button
                  type="button"
                  size="sm"
                  className="min-h-10"
                  disabled={adding}
                  onClick={async () => {
                    await onAddToLibrary(entry);
                    onOpenChange(false);
                  }}
                >
                  {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  {adding ? 'Adding…' : 'Add to watchlist'}
                </Button>
              ) : null}
              {onSeenIt && released ? (
                <WatchedWhenMenu
                  releaseDate={releaseDate || undefined}
                  releaseText={isTVShow ? "On each episode's air date" : undefined}
                  disabled={adding}
                  onPick={async (when) => {
                    await onSeenIt(entry, when);
                    onOpenChange(false);
                  }}
                  variant="outline"
                  size="sm"
                  className="min-h-10 text-sm"
                >
                  <Check className="h-4 w-4" />
                  Seen it
                </WatchedWhenMenu>
              ) : null}
              {onDismiss ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="min-h-10"
                  disabled={adding}
                  onClick={() => {
                    onDismiss(entry);
                    onOpenChange(false);
                  }}
                >
                  <X className="h-4 w-4" />
                  Not interested
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      ),
    });
  }, [
    instanceId,
    entryKey,
    entry,
    isTVShow,
    poster,
    year,
    releaseDate,
    released,
    detail,
    loading,
    error,
    adding,
    onOpenChange,
    onAddToLibrary,
    onSeenIt,
    onDismiss,
    claimDockedDetail,
    updateDockedDetail,
  ]);

  useEffect(() => {
    return () => {
      claimedKeyRef.current = null;
      releaseDockedDetail(instanceId);
    };
  }, [instanceId, releaseDockedDetail]);

  return null;
}
