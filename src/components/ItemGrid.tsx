import { InventoryItem, WARDROBE_SUBCATEGORIES } from '@/types/inventory';
import { ItemCard } from './ItemCard';
import { useMemo } from 'react';

interface ItemGridProps {
  items: InventoryItem[];
  onRemove?: (id: string) => void;
  onUpdate?: (id: string, updates: Partial<Omit<InventoryItem, 'id' | 'createdAt'>>) => void;
  groupBySubcategory?: boolean;
}

export function ItemGrid({ items, onRemove, onUpdate, groupBySubcategory = false }: ItemGridProps) {
  // Group items by subcategory when needed
  const groupedItems = useMemo(() => {
    if (!groupBySubcategory) return null;

    const groups: { key: string; label: string; items: InventoryItem[] }[] = [];

    WARDROBE_SUBCATEGORIES.forEach((sub) => {
      const categoryItems = items.filter(item => item.subcategory === sub.key);
      if (categoryItems.length > 0) {
        groups.push({
          key: sub.key,
          label: sub.label,
          items: categoryItems,
        });
      }
    });

    // Add items without subcategory at the end
    const uncategorized = items.filter(item => !item.subcategory);
    if (uncategorized.length > 0) {
      groups.push({
        key: 'uncategorized',
        label: 'Uncategorized',
        items: uncategorized,
      });
    }

    return groups;
  }, [items, groupBySubcategory]);

  if (items.length === 0) {
    return (
      <div className="py-20 text-center">
        <p className="text-muted-foreground font-serif text-lg italic">
          No items found
        </p>
        <p className="text-sm text-muted-foreground/70 mt-2">
          Try adjusting your search or add new items
        </p>
      </div>
    );
  }

  // Grouped view for wardrobe
  if (groupBySubcategory && groupedItems) {
    let globalIndex = 0;

    return (
      <div className="space-y-8 pt-6 pb-4">
        {groupedItems.map((group, groupIndex) => (
          <section key={group.key}>
            {/* Section header with divider */}
            <div className="flex items-center gap-4 mb-5">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                {group.label}
              </h3>
              <div className="h-px bg-border flex-1" />
              <span className="text-xs text-muted-foreground/60">
                {group.items.length}
              </span>
            </div>

            {/* Items grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-5 md:gap-6">
              {group.items.map((item) => {
                const index = globalIndex++;
                return (
                  <ItemCard
                    key={item.id}
                    item={item}
                    onRemove={onRemove}
                    onUpdate={onUpdate}
                    index={index}
                  />
                );
              })}
            </div>
          </section>
        ))}
      </div>
    );
  }

  // Default flat grid view
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-5 md:gap-6 pt-8 pb-4">
      {items.map((item, index) => (
        <ItemCard
          key={item.id}
          item={item}
          onRemove={onRemove}
          onUpdate={onUpdate}
          index={index}
        />
      ))}
    </div>
  );
}

