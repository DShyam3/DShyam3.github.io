import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/** "New viewing order": a button that opens a one-field form. */
export function NewOrderForm({ onCreate }: { onCreate: (name: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  if (!open) {
    return (
      <Button type="button" variant="outline" className="gap-2" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" aria-hidden="true" />New viewing order
      </Button>
    );
  }
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!name.trim()) return;
        setBusy(true);
        try {
          await onCreate(name);
          setName('');
          setOpen(false);
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="sr-only" htmlFor="new-order-name">Viewing order name</label>
      <Input id="new-order-name" value={name} maxLength={120} required onChange={(e) => setName(e.target.value)} placeholder="Name, e.g. Marvel in release order" className="min-w-0 flex-1 basis-64" />
      <Button type="submit" disabled={busy}>Create</Button>
      <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
    </form>
  );
}
