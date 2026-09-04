import { useCallback, useState, type ReactNode } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export interface DeleteConfirmRequest {
  /** Name of the thing being deleted, quoted back in the prompt. */
  name?: string;
  /** Overrides the "Delete X" heading. */
  title?: string;
  /** Overrides the whole body sentence. */
  description?: ReactNode;
  /** What the destructive button says. Defaults to "Delete". */
  confirmLabel?: string;
  onConfirm: () => void | Promise<void>;
}

/**
 * One confirmation step in front of every destructive action.
 *
 * Deletes used to fire on the first click, so a mis-click on a card's trash
 * icon destroyed the row with no undo -- which is how a recipe was lost. Rather
 * than reimplementing the watchlist's inline confirm dialog at each of the
 * ~30 call sites, this hook owns the dialog and the pending request:
 *
 *   const { askDelete, deleteDialog } = useDeleteConfirm();
 *   ...
 *   <Button onClick={() => askDelete({ name: item.title, onConfirm: () => remove(item.id) })} />
 *   ...
 *   {deleteDialog}
 *
 * Guarding the shared handler rather than each button means every trigger that
 * routes through it is covered, including ones added later.
 */
export function useDeleteConfirm() {
  const [pending, setPending] = useState<DeleteConfirmRequest | null>(null);
  const [busy, setBusy] = useState(false);

  const askDelete = useCallback((request: DeleteConfirmRequest) => {
    setPending(request);
  }, []);

  const close = useCallback(() => {
    setPending(null);
    setBusy(false);
  }, []);

  const confirm = useCallback(async () => {
    if (!pending) return;
    setBusy(true);
    try {
      await pending.onConfirm();
    } finally {
      close();
    }
  }, [pending, close]);

  const deleteDialog = (
    <Dialog
      open={pending !== null}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-serif">
            {pending?.title ?? (pending?.name ? `Delete "${pending.name}"` : 'Delete')}
          </DialogTitle>
          <DialogDescription>
            {pending?.description ?? (
              <>
                Are you sure you want to delete
                {pending?.name ? (
                  <>
                    {' '}
                    <span className="font-medium text-foreground">"{pending.name}"</span>
                  </>
                ) : (
                  ' this'
                )}
                ? This action cannot be undone.
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-2 pt-2">
          <Button variant="outline" onClick={close} className="flex-1" disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={confirm}
            className="flex-1 gap-1.5"
            disabled={busy}
          >
            <Trash2 className="h-4 w-4" />
            {pending?.confirmLabel ?? 'Delete'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );

  return { askDelete, deleteDialog };
}
