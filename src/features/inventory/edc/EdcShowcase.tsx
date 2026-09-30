import { useRef, useState } from 'react';
import { Package, SlidersHorizontal } from 'lucide-react';
import { CardGrid } from '@/components/shared/CardGrid';
import { Button } from '@/components/ui/button';
import { EdcProductCard } from './EdcProductCard';
import { EdcBuilderDialog } from './EdcBuilderDialog';
import { edcCategoryLabel } from './categories';
import type { InventoryRow } from '@/collections/inventory';
import type { CollectionConfig } from '@/collections/types';

interface EdcShowcaseProps {
  items: InventoryRow[];
  allItems: InventoryRow[];
  config: CollectionConfig<InventoryRow>;
  isAdmin: boolean;
}

export function EdcShowcase({ items, allItems, config, isAdmin }: EdcShowcaseProps) {
  const selectedItems = allItems.filter((item) => item.is_edc);
  const groups = new Map<string, InventoryRow[]>();
  for (const item of items.filter((item) => item.is_edc)) {
    const label = edcCategoryLabel(item);
    const group = groups.get(label) ?? [];
    group.push(item);
    groups.set(label, group);
  }

  if (groups.size === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        <Package className="mx-auto mb-3 h-8 w-8" aria-hidden="true" />
        <p className="text-sm">{selectedItems.length ? 'No EDC items match your filters.' : 'No everyday carry selected yet.'}</p>
        <p className="mt-2 text-xs">
          {selectedItems.length ? 'Try another search or filter.' : isAdmin ? 'Use Edit EDC to choose items from your inventory.' : 'Selected everyday carry items will appear here.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {[...groups].sort(([a], [b]) => a.localeCompare(b)).map(([label, items]) => (
        <section key={label} className="space-y-3" aria-label={label}>
          <h2 className="text-lg font-medium">{label}</h2>
          <CardGrid>
            {items.map((item) => (
              <EdcProductCard key={item.id} item={item} config={config} />
            ))}
          </CardGrid>
        </section>
      ))}
    </div>
  );
}

export function EdcToolbarButton({ allItems, updateItem }: {
  allItems: InventoryRow[];
  updateItem: (id: string, updates: Partial<InventoryRow>) => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <Button ref={triggerRef} size="sm" onClick={() => setOpen(true)}>
        <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
        Edit EDC
      </Button>
      {open && (
        <EdcBuilderDialog
          open={open}
          onOpenChange={setOpen}
          allItems={allItems}
          updateItem={updateItem}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            triggerRef.current?.focus();
          }}
        />
      )}
    </>
  );
}
