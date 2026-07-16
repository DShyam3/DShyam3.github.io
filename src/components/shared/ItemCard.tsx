import { useState } from 'react';
import { InventoryItem } from '@/types/inventory';
import { X, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { EditItemDialog } from './EditItemDialog';
import { CardDetailDialog, DetailSection } from '@/components/cards/CardDetailDialog';

interface ItemCardProps {
  item: InventoryItem;
  onRemove?: (id: string) => void;
  onUpdate?: (
    id: string,
    updates: Partial<Omit<InventoryItem, 'id' | 'createdAt'>>,
  ) => void;
  index: number;
}

const categoryLabels: Record<string, string> = {
  'tech-edc': 'Tech + EDC',
  'homelab': 'HomeLab',
  'wardrobe': 'Wardrobe',
  'kitchen': 'Kitchen',
  'home-decor': 'Home Decor',
  'hygiene': 'Hygiene',
  'sports-gear': 'Sports Gear',
};

function parseSpecs(description: string | undefined) {
  if (!description) return [];
  return description
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const cleanLine = line.replace(/^-\s*/, '');
      const colonIndex = cleanLine.indexOf(':');
      if (colonIndex > 0) {
        const key = cleanLine.substring(0, colonIndex).trim();
        const value = cleanLine.substring(colonIndex + 1).trim();
        return { key, value };
      }
      return { key: '', value: cleanLine };
    });
}

export function ItemCard({ item, onRemove, onUpdate, index }: ItemCardProps) {
  const [detailOpen, setDetailOpen] = useState(false);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price);
  };

  const handleDelete = () => {
    if (onRemove) {
      onRemove(item.id);
      setDetailOpen(false);
    }
  };

  return (
    <>
      <article
        className={cn('item-card group relative opacity-0 animate-fade-in cursor-pointer')}
        style={{ animationDelay: `${index * 50}ms` }}
        onClick={() => setDetailOpen(true)}
      >
        <div
          className={cn(
            'relative w-full h-full',
            item.isWishlist &&
              'opacity-50 grayscale hover:opacity-100 hover:grayscale-0 transition-[opacity,filter] duration-300',
          )}
        >
          {/* Action buttons */}
          <div className="absolute top-2 right-2 z-10 flex gap-1" onClick={(e) => e.stopPropagation()}>
            {onUpdate && <EditItemDialog item={item} onUpdate={onUpdate} />}
            {onRemove && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleDelete}
                className="opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 hover:bg-destructive hover:text-destructive-foreground w-8 h-8"
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>

          {/* Image */}
          <div className="aspect-square bg-secondary/30 overflow-hidden p-3 flex items-center justify-center">
            <img
              src={item.image}
              alt={item.name}
              className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-105 no-outline"
              loading="lazy"
            />
          </div>

          {/* Content */}
          <div className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium text-sm text-muted-foreground">
                {item.brand}
              </span>
              <span className="text-xs text-muted-foreground/70">·</span>
              <span className="text-xs text-muted-foreground/70">
                {categoryLabels[item.category] || item.category}
              </span>
            </div>
            <div className="flex flex-col items-start gap-1 w-full overflow-hidden">
              <h3 className="font-serif text-base font-medium leading-tight min-w-0 w-full block">
                {item.link && item.link.toLowerCase() !== 'n/a' ? (
                  <a
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-primary transition-colors inline-block w-full"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className="line-clamp-2" style={{ textWrap: 'balance' }}>
                      {item.name}
                      <ExternalLink className="inline-block w-3 h-3 opacity-50 ml-1 mb-0.5 -mt-0.5 align-middle" />
                    </span>
                  </a>
                ) : (
                  <span className="line-clamp-2" style={{ textWrap: 'balance' }}>{item.name}</span>
                )}
              </h3>
              <span className="text-sm text-muted-foreground shrink-0 whitespace-nowrap">
                {formatPrice(item.price)}
              </span>
            </div>
          </div>
        </div>
      </article>

      <CardDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        title={item.name}
        subtitle={`${item.brand} · ${categoryLabels[item.category] || item.category}`}
        imageUrl={item.image}
        link={item.link}
        badge={item.isWishlist ? 'Wishlist' : undefined}
        onDelete={onRemove ? handleDelete : undefined}
      >
        <div className="space-y-4">
          <DetailSection label="Price">
            <span className="text-base font-semibold">{formatPrice(item.price)}</span>
          </DetailSection>
          {item.description && (
            <DetailSection label="Specifications">
              <div className="mt-2 border border-border/50 rounded-lg overflow-hidden bg-secondary/5 divide-y divide-border/30">
                {parseSpecs(item.description).map((spec, i) => (
                  <div key={i} className="flex flex-col sm:flex-row p-3 text-sm gap-1 sm:gap-4 hover:bg-secondary/10 transition-colors">
                    {spec.key ? (
                      <>
                        <span className="sm:w-1/3 text-muted-foreground font-medium text-xs sm:text-sm uppercase tracking-wider sm:normal-case sm:tracking-normal shrink-0">{spec.key}</span>
                        <span className="sm:w-2/3 text-foreground break-words">{spec.value}</span>
                      </>
                    ) : (
                      <span className="w-full text-foreground break-words">{spec.value}</span>
                    )}
                  </div>
                ))}
              </div>
            </DetailSection>
          )}
        </div>
      </CardDetailDialog>
    </>
  );
}

