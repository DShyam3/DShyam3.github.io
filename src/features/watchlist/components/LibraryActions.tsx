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
  const { setMovieWatched, setLibraryState, setPersonalRating, ratingsStatus, favourites, addFavourite, removeFavourite } = useWatchlist();
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [skipped, setSkipped] = useState(false);
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
          <Button size="sm" className="min-h-11" variant="outline" aria-pressed={!!favourite} disabled={saving} onClick={() => void save(() => favourite ? removeFavourite(favourite.id) : addFavourite({ title: item.title, poster: item.image_url, media_type: mediaType, tmdb_id: item.tmdb_id }))}>
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
        {item.category === 'Movies' && item.watched && (
          <p className="text-xs text-muted-foreground">{describeWatchedAt(item.watched_at, true)}</p>
        )}
        <p className="text-xs text-muted-foreground">Your progress and ratings stay saved when you hide or finish a title.</p>
        {failed && <p role="alert" className="text-xs text-destructive">Could not save this change. Please try again.</p>}
      </>
    </section>
  );
}
