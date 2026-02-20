import { InventoryItem, WARDROBE_SUBCATEGORIES } from '@/types/inventory';
import { ItemCard } from './ItemCard';
import { useMemo } from 'react';
import { DotMatrixText } from './DotMatrixText';

interface ItemGridProps {
  items: InventoryItem[];
  onRemove?: (id: string) => void;
  onUpdate?: (id: string, updates: Partial<Omit<InventoryItem, 'id' | 'createdAt'>>) => void;
  groupBySubcategory?: boolean;
}

export function ItemGrid({ items, onRemove, onUpdate, groupBySubcategory = false }: ItemGridProps) {
  const ownedItems = useMemo(() => items.filter(i => !i.isWishlist), [items]);
  const wishlistItems = useMemo(() => items.filter(i => i.isWishlist), [items]);

  // Group items by subcategory when needed
  const groupedItems = useMemo(() => {
    if (!groupBySubcategory) return null;

    const groups: { key: string; label: string; items: InventoryItem[] }[] = [];

    WARDROBE_SUBCATEGORIES.forEach((sub) => {
      const categoryItems = ownedItems.filter(item => item.subcategory === sub.key);
      if (categoryItems.length > 0) {
        groups.push({
          key: sub.key,
          label: sub.label,
          items: categoryItems,
        });
      }
    });

    // Add items without subcategory at the end
    const uncategorized = ownedItems.filter(item => !item.subcategory);
    if (uncategorized.length > 0) {
      groups.push({
        key: 'uncategorized',
        label: 'Uncategorized',
        items: uncategorized,
      });
    }

    return groups;
  }, [ownedItems, groupBySubcategory]);

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

  let globalIndex = 0;

  return (
    <div className="space-y-8 pt-6 pb-4">
      {/* Owned Items */}
      {groupBySubcategory && groupedItems ? (
        <div className="space-y-8">
          {groupedItems.map((group) => (
            <section key={group.key}>
              <div className="flex items-center gap-4 mb-5">
                <h3 className="text-lg font-semibold text-foreground tracking-wide whitespace-nowrap">
                  <DotMatrixText text={group.label.toUpperCase()} size="xs" />
                </h3>
                <div className="h-px bg-border flex-1" />
                <span className="text-sm text-muted-foreground">
                  {group.items.length}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-5 md:gap-6">
                {group.items.map((item) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    onRemove={onRemove}
                    onUpdate={onUpdate}
                    index={globalIndex++}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : ownedItems.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-5 md:gap-6">
          {ownedItems.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              onRemove={onRemove}
              onUpdate={onUpdate}
              index={globalIndex++}
            />
          ))}
        </div>
      ) : null}

      {/* Wishlist Section */}
      {wishlistItems.length > 0 && (
        <section className={`pt-8 ${ownedItems.length > 0 ? 'mt-8 border-t border-border' : ''}`}>
          <div className="flex items-center gap-4 mb-5">
            <h3 className="text-lg font-semibold text-foreground tracking-wide whitespace-nowrap">
              <DotMatrixText text="WISHLIST" size="xs" />
            </h3>
            <div className="h-px bg-border flex-1" />
            <span className="text-sm text-muted-foreground">
              {wishlistItems.length}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-5 md:gap-6">
            {wishlistItems.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                onRemove={onRemove}
                onUpdate={onUpdate}
                index={globalIndex++}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

