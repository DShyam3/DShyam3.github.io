import { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { OrderEntryInput, OrderEntryView, OrderView } from '@/features/watchlist/franchise';
import type { StoredOrder } from '@/features/watchlist/viewing-orders-query';
import { AddEntryDialog } from './AddEntryDialog';
import { EntryList } from './EntryList';
import { FranchiseCard } from './FranchiseCard';

export interface OrderActions {
  /** Each of these resolves to an error message, or null once saved. */
  onRename: (name: string) => Promise<string | null>;
  onDelete: () => void;
  onAdd: (entry: OrderEntryInput) => Promise<string | null>;
  onRemove: (entryId: number) => void;
  onNote: (entryId: number, note: string) => Promise<string | null>;
  onMove: (entryIds: number[], from: number, to: number) => void;
}

export function OrderCard({
  order,
  view,
  actions,
  busy = false,
  onOpen,
  onAddToLibrary,
  isAdding,
}: {
  order: StoredOrder;
  view: OrderView;
  /** Present for the admin only. */
  actions?: OrderActions;
  /** A change to this order, or the read that follows it, is in flight. */
  busy?: boolean;
  onOpen: (entry: OrderEntryView) => void;
  onAddToLibrary?: (entry: OrderEntryView) => void;
  isAdding?: (key: string) => boolean;
}) {
  const [open, setOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(order.name);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [renameBusy, setRenameBusy] = useState(false);
  const entryIds = order.entries.map((e) => e.entryId);

  return (
    <FranchiseCard
      name={order.name}
      summary={`${view.watched} of ${view.total} watched`}
      nextUp={view.nextUp?.title}
      strip={view.entries.map((e) => ({ key: e.key, poster: e.poster, mediaType: e.mediaType, watched: e.state === 'watched' }))}
      open={open}
      onToggle={() => setOpen((value) => !value)}
    >
      {actions && (
        <div className="flex flex-wrap items-center gap-2">
          {renaming ? (
            <form
              className="flex min-w-0 flex-1 basis-56 flex-wrap items-center gap-2"
              onSubmit={async (event) => {
                event.preventDefault();
                if (!draft.trim()) return;
                setRenameBusy(true);
                setRenameError(null);
                try {
                  const failure = await actions.onRename(draft);
                  if (failure) setRenameError(failure);
                  else setRenaming(false);
                } finally {
                  setRenameBusy(false);
                }
              }}
            >
              <label className="sr-only" htmlFor={`rename-${order.id}`}>Order name</label>
              <Input id={`rename-${order.id}`} value={draft} maxLength={120} required onChange={(e) => setDraft(e.target.value)} className="min-w-0 flex-1 basis-40" />
              <Button type="submit" disabled={renameBusy || busy}>Save</Button>
              <Button type="button" variant="ghost" onClick={() => setRenaming(false)}>Cancel</Button>
              {renameError && <p role="alert" className="basis-full text-sm text-destructive">{renameError}</p>}
            </form>
          ) : (
            <>
              <Button type="button" variant="outline" className="gap-1.5" disabled={busy} onClick={() => { setDraft(order.name); setRenameError(null); setRenaming(true); }}>
                <Pencil className="h-4 w-4" aria-hidden="true" />Rename
              </Button>
              <AddEntryDialog existingKeys={new Set(order.entries.map((e) => e.key))} onAdd={actions.onAdd} disabled={busy} />
              <Button type="button" variant="outline" className="gap-1.5 text-destructive" disabled={busy} onClick={actions.onDelete}>
                <Trash2 className="h-4 w-4" aria-hidden="true" />Delete
              </Button>
            </>
          )}
        </div>
      )}
      <EntryList
        view={view}
        onOpen={onOpen}
        onAddToLibrary={onAddToLibrary}
        isAdding={isAdding}
        edits={actions && {
          busy,
          onMove: (from, to) => actions.onMove(entryIds, from, to),
          onRemove: (i) => actions.onRemove(entryIds[i]),
          onNote: (i, note) => actions.onNote(entryIds[i], note),
        }}
      />
    </FranchiseCard>
  );
}
