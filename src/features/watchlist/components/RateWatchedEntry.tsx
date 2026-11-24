import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Film, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useMediaQuery } from '@/hooks/use-media-query';
import { useReturnFocus } from '@/components/layout/useReturnFocus';
import { useWatchlist } from '../useWatchlist';
import type { WatchlistItem } from '../WatchlistContext';
import { PERSONAL_RATING_SCORES, matchesLibraryType, type LibraryType } from '../library-state';
import { titleKey } from '../title-ref';
import { describeWatchedAt } from '../watched-when';
import { pruneSkips, ratingQueue, readSkips, writeSkips } from '../rating-queue';

/** "Watched 3 Sep 2026" for a film; a series by its last watched episode. */
function watchedLine(item: WatchlistItem): string {
  if (item.category === 'Movies') return describeWatchedAt(item.watched_at, true);
  if (!item.watched_at) return 'Watched · dates unknown';
  return describeWatchedAt(item.watched_at, true).replace('Watched', 'Last watched');
}

const unratedLabel = (count: number, type: LibraryType) => {
  if (type === 'tv') return `${count} series unrated`;
  const noun = type === 'movie' ? 'film' : 'title';
  return `${count} ${noun}${count === 1 ? '' : 's'} unrated`;
};

/**
 * The owner's way into rating what they have watched: a button beside
 * Discover's "Search for a film or series you watched…" that opens a queue
 * of the watched titles with no rating (`ratingQueue`), one at a time, for
 * the tab in view. Hidden for visitors, until the scores have loaded (an
 * unrated title may only look unrated), and once nothing is left.
 */
export function RateWatchedEntry({ type }: { type: LibraryType }) {
  const { isAdmin } = useAuth();
  const { watchlist, ratingsStatus } = useWatchlist();
  const [open, setOpen] = useState(false);
  const [skips, setSkips] = useState(readSkips);
  const entryRef = useRef<HTMLButtonElement>(null);
  const waiting = useMemo(() => ratingQueue(watchlist, skips), [watchlist, skips]);
  const queue = useMemo(() => waiting.filter((item) => matchesLibraryType(item, type)), [waiting, type]);
  if (!isAdmin || ratingsStatus !== 'ready') return null;
  if (queue.length === 0 && !open) return null;
  return (
    <>
      <Button
        ref={entryRef}
        variant="outline"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="h-auto min-h-14 w-full justify-start gap-3 rounded-xl border-border/60 bg-card px-4 py-3 text-left text-muted-foreground hover:text-foreground"
      >
        <Star className="h-5 w-5 shrink-0" />
        <span className="min-w-0 flex-1">Rate what you’ve watched</span>
        <span className="shrink-0 text-xs tabular-nums">{unratedLabel(queue.length, type)}</span>
      </Button>
      {open && (
        <RateWatchedDialog
          queue={queue}
          onSkip={(item) => {
            // Skips of titles since rated, or no longer rateable, are dropped.
            const next = pruneSkips(skips, new Set(waiting.map(titleKey))).set(titleKey(item), Date.now());
            writeSkips(next);
            setSkips(next);
          }}
          onClose={() => setOpen(false)}
          entry={() => entryRef.current}
        />
      )}
    </>
  );
}

/**
 * One title at a time from the queue as it stood when the dialog opened, so
 * a rating or a skip moves on rather than reshuffling what is left. A title
 * rated somewhere else meanwhile is passed over.
 */
function RateWatchedDialog({ queue, onSkip, onClose, entry }: {
  queue: WatchlistItem[];
  onSkip: (item: WatchlistItem) => void;
  onClose: () => void;
  /** Where focus goes back to when nothing in particular had it on opening. */
  entry: () => HTMLElement | null;
}) {
  const { watchlist, setPersonalRating } = useWatchlist();
  const finePointer = useMediaQuery('(hover: hover) and (pointer: fine)');
  const returnFocus = useReturnFocus();
  const [order] = useState(() => queue.map(titleKey));
  const [done, setDone] = useState<ReadonlySet<string>>(() => new Set());
  const [rated, setRated] = useState(0);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [imageFailed, setImageFailed] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const byKey = useMemo(() => new Map(watchlist.map((item) => [titleKey(item), item])), [watchlist]);
  const left = order.filter((key) => !done.has(key) && byKey.has(key) && byKey.get(key)?.personal_rating == null);
  const item = left.length > 0 ? byKey.get(left[0]) : undefined;
  const ended = `${rated > 0 ? `Done: ${rated} rated. ` : ''}Nothing left to rate here.`;

  const finish = (key: string) => {
    setDone((current) => new Set(current).add(key));
    setFailed(false);
  };
  const rate = async (score: number) => {
    if (!item || saving) return;
    setSaving(true);
    setFailed(false);
    try {
      await setPersonalRating(item, score);
      setRated((count) => count + 1);
      finish(titleKey(item));
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };
  const skip = () => {
    if (!item || saving) return;
    onSkip(item);
    finish(titleKey(item));
  };
  // Whole scores from the number keys (0 is 10), S to skip; halves from the
  // grid. A held key repeats: only the first press counts, or holding 8
  // would rate every title that came up while it was held.
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.repeat || event.metaKey || event.ctrlKey || event.altKey || !item) return;
    if (/^[0-9]$/.test(event.key)) {
      event.preventDefault();
      void rate(event.key === '0' ? 10 : Number(event.key));
    } else if (event.key === 's' || event.key === 'S') {
      event.preventDefault();
      skip();
    }
  };

  const poster = item?.image_url && item.image_url !== imageFailed ? item.image_url : null;
  return (
    <Dialog open onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent
        ref={contentRef}
        className="sm:max-w-md"
        onKeyDown={onKeyDown}
        // Not on the first score: a stray Enter would rate the title 0.5. The
        // number keys and S work from here; Tab reaches the scores.
        onOpenAutoFocus={(event) => {
          returnFocus.remember(entry);
          event.preventDefault();
          contentRef.current?.focus();
        }}
        onCloseAutoFocus={returnFocus.restore}
      >
        <DialogHeader>
          <DialogTitle>Rate what you’ve watched</DialogTitle>
          <DialogDescription>
            Your ratings shape what Discover suggests: 8 and up suggest more like it, under 6 never do.
          </DialogDescription>
        </DialogHeader>
        {/* One region, mounted throughout, says what is being rated and when it is over. */}
        <p aria-live="polite" className="sr-only">{item ? `Rate ${item.title}` : ended}</p>
        {item ? (
          <div className="min-w-0 space-y-4">
            <div className="flex min-w-0 items-center gap-4">
              <div className="aspect-[2/3] w-20 shrink-0 overflow-hidden rounded-lg bg-muted">
                {poster ? (
                  <img src={poster} alt="" className="h-full w-full object-cover" onError={() => setImageFailed(poster)} />
                ) : (
                  <div className="missing-art flex h-full items-center justify-center"><Film className="h-5 w-5" aria-hidden="true" /></div>
                )}
              </div>
              <div className="min-w-0 space-y-1">
                <p className="break-words font-medium leading-snug">{item.title}</p>
                <p className="text-xs text-muted-foreground">{item.category === 'Movies' ? 'Film' : 'Series'}</p>
                <p className="text-xs text-muted-foreground">{watchedLine(item)}</p>
              </div>
            </div>
            {/* Keyed by title: a score just tapped must not stay tinted on the next one. */}
            <div key={titleKey(item)} role="group" aria-label={`Rate ${item.title} out of 10`} className="grid grid-cols-5 gap-1">
              {PERSONAL_RATING_SCORES.map((score) => (
                <button
                  key={score}
                  type="button"
                  disabled={saving}
                  aria-label={`${score} out of 10`}
                  onClick={() => void rate(score)}
                  className={cn(
                    'min-h-11 rounded-md border border-border/50 text-sm tabular-nums hover:bg-secondary disabled:opacity-50',
                    Number.isInteger(score) ? 'text-foreground' : 'text-muted-foreground',
                  )}
                >
                  {score}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground tabular-nums">
                {rated > 0 ? `${rated} rated · ` : ''}{left.length} left
              </p>
              <div className="flex gap-2">
                <Button type="button" variant="ghost" className="min-h-11" disabled={saving} onClick={skip}>Skip</Button>
                <Button type="button" variant="outline" className="min-h-11" onClick={onClose}>Done for now</Button>
              </div>
            </div>
            {finePointer && (
              <p className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                <kbd className="rounded-sm border border-border/50 bg-muted/40 px-1 leading-4">1</kbd>–
                <kbd className="rounded-sm border border-border/50 bg-muted/40 px-1 leading-4">9</kbd> rate,
                <kbd className="rounded-sm border border-border/50 bg-muted/40 px-1 leading-4">0</kbd> is 10,
                <kbd className="rounded-sm border border-border/50 bg-muted/40 px-1 leading-4">S</kbd> skips
              </p>
            )}
            {saving && <p role="status" className="text-xs text-muted-foreground">Saving…</p>}
            {failed && <p role="alert" className="text-xs text-destructive">Could not save that rating. Please try again.</p>}
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{ended}</p>
            <div className="flex justify-end">
              {/* The score buttons that had focus have gone. */}
              <Button type="button" variant="outline" className="min-h-11" onClick={onClose} autoFocus>Close</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
