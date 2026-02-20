import { InventoryItem } from '@/types/inventory';
import { X, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { EditItemDialog } from './EditItemDialog';

interface ItemCardProps {
  item: InventoryItem;
  onRemove?: (id: string) => void;
  onUpdate?: (id: string, updates: Partial<Omit<InventoryItem, 'id' | 'createdAt'>>) => void;
  index: number;
}

const categoryLabels: Record<string, string> = {
  technology: 'Technology',
  wardrobe: 'Wardrobe',
  kitchen: 'Kitchen',
  wishlist: 'Wishlist',
};

export function ItemCard({ item, onRemove, onUpdate, index }: ItemCardProps) {
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 0,
    }).format(price);
  };

  return (
    <article
      className={cn(
        'item-card group relative opacity-0 animate-fade-in'
      )}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className={cn("relative w-full h-full", item.isWishlist && "opacity-50 grayscale hover:opacity-100 hover:grayscale-0 transition-all duration-300")}>
        {/* Action buttons */}
        <div className="absolute top-2 right-2 z-10 flex gap-1">
          {onUpdate && <EditItemDialog item={item} onUpdate={onUpdate} />}
          {onRemove && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onRemove(item.id)}
              className="opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 hover:bg-destructive hover:text-destructive-foreground w-7 h-7"
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>

        {/* Image */}
        <div className="aspect-square bg-secondary/30 overflow-hidden">
          <img
            src={item.image}
            alt={item.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        </div>

        {/* Content */}
        <div className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <span className="font-medium">{item.brand}</span>
            <span>·</span>
            <span>{categoryLabels[item.category]}</span>
          </div>
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-serif text-base font-medium leading-tight">
              {item.link && item.link.toLowerCase() !== 'n/a' ? (
                <a
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-primary transition-colors inline-flex items-center gap-1"
                >
                  {item.name}
                  <ExternalLink className="w-3 h-3 opacity-50" />
                </a>
              ) : (
                item.name
              )}
            </h3>
            <span className="text-sm text-muted-foreground shrink-0">
              {formatPrice(item.price)}
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}
