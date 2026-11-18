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
  onRename: (name: string) => void;
  onDelete: () => void;
  onAdd: (entry: OrderEntryInput) => void;
  onRemove: (entryId: number) => void;
  onNote: (entryId: number, note: string) => void;
  onMove: (entryIds: number[], from: number, to: number) => void;
}

export function OrderCard({
  order,
  view,
  actions,
  onOpen,
  onAddToLibrary,
  isAdding,
}: {
  order: StoredOrder;
  view: OrderView;
  /** Present for the admin only. */
  actions?: OrderActions;
  onOpen: (entry: OrderEntryView) => void;
  onAddToLibrary?: (entry: OrderEntryView) => void;
  isAdding?: (key: string) => boolean;
}) {
  const [open, setOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(order.name);
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
              onSubmit={(event) => {
                event.preventDefault();
                if (draft.trim()) actions.onRename(draft);
                setRenaming(false);
              }}
            >
              <label className="sr-only" htmlFor={`rename-${order.id}`}>Order name</label>
              <Input id={`rename-${order.id}`} value={draft} maxLength={120} required onChange={(e) => setDraft(e.target.value)} className="min-w-0 flex-1 basis-40" />
              <Button type="submit" size="sm">Save</Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setRenaming(false)}>Cancel</Button>
            </form>
          ) : (
            <>
              <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => { setDraft(order.name); setRenaming(true); }}>
                <Pencil className="h-4 w-4" aria-hidden="true" />Rename
              </Button>
              <AddEntryDialog existingKeys={new Set(order.entries.map((e) => e.key))} onAdd={actions.onAdd} />
              <Button type="button" variant="outline" size="sm" className="gap-1.5 text-destructive" onClick={actions.onDelete}>
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
          onMove: (from, to) => actions.onMove(entryIds, from, to),
          onRemove: (i) => actions.onRemove(entryIds[i]),
          onNote: (i, note) => actions.onNote(entryIds[i], note),
        }}
      />
    </FranchiseCard>
  );
}
