import { InventoryItem } from '@/types/inventory';
import { ItemCard } from './ItemCard';

interface ItemGridProps {
  items: InventoryItem[];
  onRemove: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Omit<InventoryItem, 'id' | 'createdAt'>>) => void;
}

export function ItemGrid({ items, onRemove, onUpdate }: ItemGridProps) {
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
