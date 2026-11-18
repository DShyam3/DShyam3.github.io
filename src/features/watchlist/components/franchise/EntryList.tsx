import { useId, useState } from 'react';
import { ArrowDown, ArrowUp, Check, Film, Loader2, Pencil, Plus, Trash2, Tv, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { EntryState, OrderEntryView, OrderView } from '@/features/watchlist/franchise';
import { WatchedWhenMenu } from '@/features/watchlist/components/WatchedWhenMenu';
import type { WatchedWhen } from '@/features/watchlist/watched-when';

/** Prefix for a TMDB poster path, as stored on an order entry. */
export const POSTER_BASE: string = import.meta.env.VITE_TMDB_IMAGE_BASE_URL ?? '';

/** Admin edits on a saved order, addressed by position in the list. */
export interface EntryEdits {
  /** Disables every control while a change to the order is in flight. */
  busy?: boolean;
  onMove: (from: number, to: number) => void;
  onRemove: (index: number) => void;
  /** Resolves to an error message, or null once saved. */
  onNote: (index: number, note: string) => Promise<string | null>;
}

export function stateLabel(entry: OrderEntryView): string {
  switch (entry.state) {
    case 'watched':
      return 'Watched';
    case 'in-progress':
      return `In progress ${entry.progress?.watched ?? 0}/${entry.progress?.aired ?? 0}`;
    case 'unwatched':
      return 'Not started';
    default:
      return 'Not in library';
  }
}

const CHIP: Record<EntryState, string> = {
  watched: 'bg-primary text-primary-foreground',
  'in-progress': 'bg-secondary text-secondary-foreground',
  unwatched: 'border border-border text-foreground',
  'not-in-library': 'border border-dashed border-border text-muted-foreground',
};

export function Poster({ src, mediaType, className }: { src: string | null; mediaType: 'movie' | 'tv'; className?: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  const Icon = mediaType === 'tv' ? Tv : Film;
  return (
    <span className={cn('block aspect-[2/3] shrink-0 overflow-hidden rounded bg-muted', className)}>
      {src && src !== failed ? (
        <img src={src} alt="" loading="lazy" onError={() => setFailed(src)} className="h-full w-full object-contain" />
      ) : (
        <span className="missing-art flex h-full w-full items-center justify-center">
          <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        </span>
      )}
    </span>
  );
}

function NoteEditor({ initial, onSave, onCancel }: { initial: string; onSave: (note: string) => Promise<string | null>; onCancel: () => void }) {
  const id = useId();
  const [draft, setDraft] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={async (event) => {
        event.preventDefault();
        setSaving(true);
        setError(null);
        try {
          const failure = await onSave(draft);
          if (failure) setError(failure);
        } finally {
          setSaving(false);
        }
      }}
    >
      <label className="sr-only" htmlFor={id}>Note</label>
      <Input
        id={id}
        value={draft}
        maxLength={200}
        onChange={(event) => setDraft(event.target.value)}
        placeholder="Why it sits here"
        className="min-w-0 flex-1 basis-48"
        autoFocus
      />
      <Button type="submit" disabled={saving}>Save</Button>
      <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
      {error && <p role="alert" className="basis-full text-sm text-destructive">{error}</p>}
    </form>
  );
}

/**
 * The full list of an order or a film series: position, poster, title, kind,
 * state and note. An in-library title opens its details. Admin controls appear
 * only when the matching callback is given.
 */
export function EntryList({
  view,
  onOpen,
  onAddToLibrary,
  onSeenIt,
  onDismiss,
  isAdding,
  edits,
}: {
  view: OrderView;
  onOpen: (entry: OrderEntryView) => void;
  onAddToLibrary?: (entry: OrderEntryView) => void;
  onSeenIt?: (entry: OrderEntryView, when: WatchedWhen) => void;
  onDismiss?: (entry: OrderEntryView) => void;
  isAdding?: (key: string) => boolean;
  edits?: EntryEdits;
}) {
  const [editing, setEditing] = useState<number | null>(null);
  const todayIso = new Date().toLocaleDateString('en-CA');

  if (view.entries.length === 0) {
    return <p className="text-sm text-muted-foreground">Nothing in this order yet.</p>;
  }

  return (
    <ol className="divide-y divide-border/50">
      {view.entries.map((entry, i) => {
        const year = entry.releaseDate?.slice(0, 4);
        const adding = isAdding?.(entry.key) ?? false;
        const releaseDate = entry.releaseDate?.slice(0, 10);
        const released = !releaseDate || releaseDate <= todayIso;
        return (
          <li key={entry.key} className="flex gap-3 py-3">
            <span className="w-6 shrink-0 pt-1 text-right text-sm tabular-nums text-muted-foreground">{i + 1}</span>
            <button
              type="button"
              onClick={() => onOpen(entry)}
              aria-label={`${entry.title} — open details`}
              className="shrink-0 self-start rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <Poster src={entry.poster} mediaType={entry.mediaType} className="w-12 transition-opacity hover:opacity-85" />
            </button>
            <div className="min-w-0 flex-1 space-y-1.5">
              <button
                type="button"
                onClick={() => onOpen(entry)}
                aria-label={`${entry.title} — open details`}
                className="block max-w-full break-words rounded text-left font-serif text-base font-medium leading-snug hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {entry.title}
              </button>
              <p className="text-sm text-muted-foreground">
                {entry.mediaType === 'tv' ? 'Series' : 'Film'}
                {year ? ` · ${year}` : ''}
              </p>
              <p>
                <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium', CHIP[entry.state])}>
                  {entry.state === 'watched' && <Check className="h-3 w-3" aria-hidden="true" />}
                  {stateLabel(entry)}
                </span>
              </p>
              {editing === i && edits ? (
                <NoteEditor
                  initial={entry.note ?? ''}
                  onCancel={() => setEditing(null)}
                  onSave={async (note) => {
                    const failure = await edits.onNote(i, note);
                    if (!failure) setEditing(null);
                    return failure;
                  }}
                />
              ) : (
                entry.note && <p className="break-words text-sm text-muted-foreground">{entry.note}</p>
              )}
              {(edits || ((onAddToLibrary || onSeenIt || onDismiss) && entry.state === 'not-in-library')) && (
                <div className="flex flex-wrap items-center gap-1 pt-1">
                  {onAddToLibrary && entry.state === 'not-in-library' && (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={adding}
                      onClick={() => onAddToLibrary(entry)}
                      className="gap-1.5"
                    >
                      {adding ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}
                      {adding ? 'Adding…' : 'Add to library'}
                    </Button>
                  )}
                  {onSeenIt && entry.state === 'not-in-library' && released && (
                    <WatchedWhenMenu
                      releaseDate={releaseDate || undefined}
                      releaseText={entry.mediaType === 'tv' ? 'On each episode\'s air date' : undefined}
                      disabled={adding}
                      onPick={(when) => onSeenIt(entry, when)}
                      variant="outline"
                      size="default"
                      className="min-h-10 gap-1.5 text-sm"
                    >
                      <Check className="h-4 w-4" aria-hidden="true" />
                      Seen it
                    </WatchedWhenMenu>
                  )}
                  {onDismiss && entry.state === 'not-in-library' && (
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={adding}
                      onClick={() => onDismiss(entry)}
                      className="gap-1.5 text-muted-foreground"
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                      Not interested
                    </Button>
                  )}
                  {edits && (
                    <>
                      <Button type="button" variant="ghost" size="icon" disabled={edits.busy || i === 0} onClick={() => edits.onMove(i, i - 1)} aria-label={`Move ${entry.title} up`}>
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button type="button" variant="ghost" size="icon" disabled={edits.busy || i === view.entries.length - 1} onClick={() => edits.onMove(i, i + 1)} aria-label={`Move ${entry.title} down`}>
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      <Button type="button" variant="ghost" size="icon" disabled={edits.busy} onClick={() => setEditing(i)} aria-label={`Edit note for ${entry.title}`}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button type="button" variant="ghost" size="icon" disabled={edits.busy} onClick={() => edits.onRemove(i)} aria-label={`Remove ${entry.title} from this order`}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
