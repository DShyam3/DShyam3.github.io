import { useState } from 'react';
import { Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import { useAuth } from '@/contexts/AuthContext';
import { useWatchlist, type WatchlistItem } from '../useWatchlist';
import { libraryStatus, type LibraryState } from '../library-state';
import { describeWatchedAt } from '../watched-when';
import { WatchedWhenMenu } from './WatchedWhenMenu';
import { PersonalRating } from './PersonalRating';

export function LibraryActions({ item }: { item: WatchlistItem }) {
  const { isAdmin } = useAuth();
  const { watchlist, setMovieWatched, setLibraryState, setFranchise, editAdditionalFranchise, setSeriesStatus, setPersonalRating, ratingsStatus, favourites, addFavourite, removeFavourite } = useWatchlist();
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [skipped, setSkipped] = useState(false);
  const [franchiseDraft, setFranchiseDraft] = useState(item.franchise ?? '');
  const [extraFranchiseDraft, setExtraFranchiseDraft] = useState('');
  const franchiseOptions = Array.from(
    new Set(
      watchlist
        .flatMap((w) => [w.franchise, ...(w.additional_franchises ?? [])].map((name) => name?.trim()))
        .filter((f): f is string => Boolean(f)),
    ),
  ).sort((a, b) => a.localeCompare(b));
  if (!isAdmin) return null;
  const isMovie = item.category === 'Movies';
  const unrated = item.personal_rating == null;
  const prompt = skipped || !unrated
    ? undefined
    : isMovie && item.watched
      ? 'Watched — rate it?'
      : !isMovie && libraryStatus(item) === 'Completed'
        ? 'Finished — rate the show?'
        : undefined;
  const mediaType = item.category === 'TV Shows' ? 'tv' : 'movie';
  const favourite = favourites.find((candidate) => candidate.media_type === mediaType && (item.tmdb_id ? candidate.tmdb_id === item.tmdb_id : candidate.title === item.title));
  const save = async (action: () => Promise<void>) => {
    setSaving(true);
    setFailed(false);
    try { await action(); } catch { setFailed(true); } finally { setSaving(false); }
  };
  return (
    <section aria-label="Your history and rating" className="space-y-3 rounded-xl border border-border/60 bg-card p-3">
      {ratingsStatus === 'ready' ? (
        <PersonalRating
          label="Your overall rating"
          value={item.personal_rating}
          onChange={(rating) => setPersonalRating(item, rating)}
          prompt={prompt}
          onSkip={prompt ? () => setSkipped(true) : undefined}
        />
      ) : (
        // Until the scores are in, an unrated title may only look unrated.
        <p role="status" className="text-xs text-muted-foreground">
          {ratingsStatus === 'failed' ? 'Ratings could not load. Reload the page to try again.' : 'Loading your ratings…'}
        </p>
      )}
      <>
        <div className="flex flex-wrap gap-2">
          {item.category === 'Movies' && (item.watched ? (
            <Button size="sm" className="min-h-11" variant="secondary" disabled={saving} onClick={() => void save(() => setMovieWatched(item, false))}>Watched · undo</Button>
          ) : (
            // Asks when: just now, on its release date, date unknown or a
            // picked day, so a film seen years ago is not dated today.
            <WatchedWhenMenu releaseDate={item.release_date} disabled={saving} className="min-h-11" onPick={(when) => void save(() => setMovieWatched(item, true, when))}>
              Mark as watched
            </WatchedWhenMenu>
          ))}
          <Button size="sm" className="min-h-11" variant="outline" aria-pressed={!!favourite} disabled={saving} onClick={() => void save(() => {
            if (favourite) return removeFavourite(favourite.id);
            const hasFacts =
              item.genre_ids !== undefined ||
              item.original_language !== undefined ||
              item.origin_country !== undefined;
            return addFavourite({
              title: item.title,
              poster: item.image_url,
              media_type: mediaType,
              tmdb_id: item.tmdb_id,
              facts: hasFacts
                ? {
                    genre_ids: item.genre_ids ?? null,
                    original_language: item.original_language ?? null,
                    origin_country: item.origin_country ?? null,
                  }
                : undefined,
            });
          })}>
            <Heart className={favourite ? 'fill-current' : ''} />{favourite ? 'Favourited' : 'Favourite'}
          </Button>
        </div>
        <label className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          Library visibility
          <NativeSelect
            wrapperClassName="min-w-0 max-w-full"
            className="rounded-lg border border-border bg-background text-sm text-foreground"
            value={item.library_state ?? 'active'}
            disabled={saving}
            onChange={(event) => { const state = event.target.value as LibraryState; void save(() => setLibraryState(item, state)); }}
          >
            <option value="active">In library</option>
            {item.category === 'TV Shows' && <option value="paused">Paused (out of Your Week)</option>}
            <option value="hidden">Hidden</option>
            <option value="stopped">Stopped watching</option>
          </NativeSelect>
        </label>
        {item.category === 'TV Shows' && (
          <label className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            Series status
            <NativeSelect
              aria-label="Series status"
              className="min-h-11 min-w-44 rounded-lg border border-border bg-background text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              value={item.series_status ?? ''}
              disabled={saving}
              onChange={(event) => void save(() => setSeriesStatus(item, event.target.value as NonNullable<WatchlistItem['series_status']>))}
            >
              {!item.series_status && <option value="" disabled>Choose a status</option>}
              <option value="Returning Series">Returning series</option>
              <option value="In Production">In production</option>
              <option value="Ended">Ended</option>
              <option value="Canceled">Canceled</option>
              {item.series_status === 'Cancelled' && <option value="Cancelled">Cancelled</option>}
            </NativeSelect>
          </label>
        )}
        {item.category === 'TV Shows' && (
          <p className="text-xs text-muted-foreground">Your choice stays until TMDB reports a different status.</p>
        )}
        <form
          className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"
          onSubmit={(event) => {
            event.preventDefault();
            void save(() => setFranchise(item, franchiseDraft));
          }}
        >
          <label htmlFor={`franchise-${item.category}-${item.id}`}>Franchise</label>
          <div className="flex items-center gap-1.5 min-w-0">
            <input
              id={`franchise-${item.category}-${item.id}`}
              list="watchlist-franchise-options"
              value={franchiseDraft}
              onChange={(event) => setFranchiseDraft(event.target.value)}
              placeholder="None"
              disabled={saving}
              className="h-8 w-44 rounded-lg border border-border bg-background px-2 text-xs text-foreground"
            />
            <Button
              type="submit"
              size="sm"
              variant="outline"
              className="h-8 px-2.5 text-xs"
              disabled={saving || (franchiseDraft.trim() || null) === (item.franchise?.trim() || null)}
            >
              Save
            </Button>
            {item.franchise ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 px-2 text-xs"
                disabled={saving}
                onClick={() => {
                  setFranchiseDraft('');
                  void save(() => setFranchise(item, null));
                }}
              >
                Clear
              </Button>
            ) : null}
          </div>
          <datalist id="watchlist-franchise-options">
            {franchiseOptions.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </form>
        <div className="space-y-2 text-xs text-muted-foreground">
          <p>Other franchises</p>
          {(item.additional_franchises ?? []).length > 0 && (
            <div className="flex flex-wrap gap-2">
              {item.additional_franchises?.map((name) => (
                <Button
                  key={name}
                  type="button"
                  size="sm"
                  variant="outline"
                  className="min-h-11 max-w-full break-words text-left"
                  aria-label={`Remove ${name} from ${item.title}`}
                  disabled={saving}
                  onClick={() => void save(() => editAdditionalFranchise(item, name, false))}
                >
                  {name} <span aria-hidden="true">×</span>
                </Button>
              ))}
            </div>
          )}
          <form
            className="flex flex-wrap gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const name = extraFranchiseDraft.trim();
              if (!name || name === item.franchise?.trim() || item.additional_franchises?.includes(name)) return;
              void save(async () => {
                await editAdditionalFranchise(item, name, true);
                setExtraFranchiseDraft('');
              });
            }}
          >
            <input
              aria-label="Add another franchise"
              autoComplete="off"
              list="watchlist-franchise-options"
              value={extraFranchiseDraft}
              onChange={(event) => setExtraFranchiseDraft(event.target.value)}
              maxLength={80}
              placeholder="Add another franchise…"
              disabled={saving}
              className="min-h-11 min-w-0 flex-1 basis-44 rounded-lg border border-border bg-background px-3 text-base text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            />
            <Button
              type="submit"
              size="sm"
              variant="outline"
              className="min-h-11"
              disabled={saving || (item.additional_franchises?.length ?? 0) >= 20 || !extraFranchiseDraft.trim() || extraFranchiseDraft.trim() === item.franchise?.trim() || item.additional_franchises?.includes(extraFranchiseDraft.trim())}
            >
              Add
            </Button>
          </form>
          <p>A title can belong to several Library Franchises.</p>
        </div>
        {item.category === 'Movies' && item.watched && (
          <p className="text-xs text-muted-foreground">{describeWatchedAt(item.watched_at, true)}</p>
        )}
        <p className="text-xs text-muted-foreground">Your progress and ratings stay saved when you hide or finish a title.</p>
        {failed && <p role="alert" className="text-xs text-destructive">Could not save this change. Please try again.</p>}
      </>
    </section>
  );
}
