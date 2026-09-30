import { useRef, useState } from 'react';
import { Check, ChevronDown, Package, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { edcCategoryLabel } from './categories';
import type { InventoryRow } from '@/collections/inventory';

interface EdcBuilderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus?: (event: Event) => void;
  allItems: InventoryRow[];
  updateItem: (id: string, updates: Partial<InventoryRow>) => Promise<unknown>;
}

export function EdcBuilderDialog({ open, onOpenChange, onCloseAutoFocus, allItems, updateItem }: EdcBuilderDialogProps) {
  const queryClient = useQueryClient();
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const pending = useRef(false);
  const categories = [...new Set(allItems.map(edcCategoryLabel))].sort();
  const query = search.trim().toLowerCase();
  const filteredItems = allItems.filter((item) =>
    (category === 'all' || edcCategoryLabel(item) === category)
    && (!query || [item.name, item.brand, edcCategoryLabel(item), item.subcategory]
      .some((value) => value?.toLowerCase().includes(query))),
  ).sort((a, b) => a.name.localeCompare(b.name));

  const toggleEdc = async (item: InventoryRow) => {
    if (pending.current) return;
    pending.current = true;
    setSavingId(item.id);
    try {
      await updateItem(item.id, { is_edc: !item.is_edc });
      queryClient.setQueriesData<InventoryRow[]>({ queryKey: ['inventory_items'] }, (current) =>
        current?.map((row) => row.id === item.id ? { ...row, is_edc: !item.is_edc } : row),
      );
      await queryClient.invalidateQueries({ queryKey: ['inventory_items'] }, { cancelRefetch: false });
      toast.success(`${item.is_edc ? 'Removed' : 'Added'} ${item.name} ${item.is_edc ? 'from' : 'to'} EDC`);
    } catch {
      toast.error(`Could not update ${item.name}. Please try again.`);
    } finally {
      pending.current = false;
      setSavingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" onCloseAutoFocus={onCloseAutoFocus}>
        <DialogHeader>
          <DialogTitle>Edit EDC</DialogTitle>
          <DialogDescription>Choose your everyday carry from your inventory. Changes save automatically.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="min-w-0 space-y-2 text-sm">
            <span>Search inventory</span>
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name or brand" />
          </label>
          <label className="min-w-0 space-y-2 text-sm">
            <span>Category</span>
            <div className="relative">
              <select value={category} onChange={(event) => setCategory(event.target.value)} className="block h-11 w-full min-w-0 appearance-none rounded-md border border-input bg-background pl-3 pr-10 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <option value="all">All inventory</option>
                {categories.map((label) => <option key={label} value={label}>{label}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            </div>
          </label>
        </div>
        {filteredItems.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {allItems.length === 0 ? 'Your inventory is empty. Add inventory items before choosing your EDC.' : 'No inventory items match. Try another search or category.'}
          </p>
        ) : (
          <ul className="space-y-2">
            {filteredItems.map((item) => (
              <li key={item.id} className={cn('flex items-center gap-3 rounded-lg border p-3', item.is_edc ? 'border-primary bg-primary/5' : 'border-border')}>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted p-1">
                  {item.image ? <img src={item.image} alt="" loading="lazy" className="h-full w-full object-contain" /> : <Package className="h-4 w-4 text-muted-foreground" aria-hidden="true" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="break-words text-sm font-medium">{item.name}</p>
                  <p className="break-words text-xs text-muted-foreground">{[item.brand, edcCategoryLabel(item)].filter(Boolean).join(' · ')}</p>
                  {item.is_wishlist && <p className="text-xs text-muted-foreground">Wishlist</p>}
                  {item.is_edc && <p className="text-xs text-primary">In EDC</p>}
                </div>
                <Button size="sm" variant={item.is_edc ? 'secondary' : 'outline'} disabled={savingId !== null} aria-pressed={Boolean(item.is_edc)} aria-label={`${item.is_edc ? 'Remove' : 'Add'} ${item.name} ${item.is_edc ? 'from' : 'to'} EDC`} onClick={() => void toggleEdc(item)}>
                  {item.is_edc ? <Check className="h-4 w-4" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}
                  {savingId === item.id ? 'Saving…' : item.is_edc ? 'Remove' : 'Add'}
                </Button>
              </li>
            ))}
          </ul>
        )}
        <DialogFooter><Button onClick={() => onOpenChange(false)}>Done</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
