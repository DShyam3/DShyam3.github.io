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
      if (colonIndex <= 0) {
        return { key: '', name: cleanLine, numericPrice: 0, link: undefined, price: undefined };
      }
      
      const key = cleanLine.substring(0, colonIndex).trim();
      let rest = cleanLine.substring(colonIndex + 1).trim();
      
      // 1. Extract price if present, e.g. (£172.00) or £172.00
      let priceStr: string | undefined = undefined;
      let numericPrice = 0;
      
      const priceRegex = /(?:\(?)\s*£\s*([0-9,]+(?:\.[0-9]+)?)\s*(?:\)?)/;
      const priceMatch = rest.match(priceRegex);
      if (priceMatch) {
        priceStr = `£${priceMatch[1]}`;
        numericPrice = parseFloat(priceMatch[1].replace(/,/g, ''));
        rest = rest.replace(priceMatch[0], '').trim();
        rest = rest.replace(/\(\s*\)/g, '').trim(); // clean empty parentheses
      }
      
      // 2. Extract markdown link if present, e.g. [NCASE Formd T1 V2.5](https://...)
      let name = rest;
      let link: string | undefined = undefined;
      
      const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/;
      const linkMatch = rest.match(linkRegex);
      if (linkMatch) {
        name = linkMatch[1].trim();
        link = linkMatch[2].trim();
      }
      
      return {
        key,
        name,
        link,
        price: priceStr,
        numericPrice: isNaN(numericPrice) ? 0 : numericPrice,
      };
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
            <DetailSection label="Specifications & Parts">
              <div className="mt-2 border border-border/50 rounded-lg overflow-x-auto bg-secondary/5">
                <table className="w-full text-sm text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border/50 bg-secondary/10 text-muted-foreground text-xs uppercase tracking-wider font-semibold">
                      <th className="p-3">Component</th>
                      <th className="p-3">Part / Model</th>
                      <th className="p-3 text-right">Price</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {parseSpecs(item.description).map((spec, i) => (
                      <tr key={i} className="hover:bg-secondary/10 transition-colors">
                        <td className="p-3 font-medium text-muted-foreground whitespace-nowrap">
                          {spec.key}
                        </td>
                        <td className="p-3 text-foreground break-words max-w-[200px] sm:max-w-xs">
                          {spec.link ? (
                            <a
                              href={spec.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline inline-flex items-center gap-1 font-medium"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {spec.name}
                              <ExternalLink className="w-3 h-3 opacity-60 inline shrink-0" />
                            </a>
                          ) : (
                            spec.name
                          )}
                        </td>
                        <td className="p-3 text-right text-foreground font-mono whitespace-nowrap">
                          {spec.numericPrice > 0 ? formatPrice(spec.numericPrice) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-border bg-secondary/10 font-semibold text-foreground">
                      <td className="p-3" colSpan={2}>Total Specifications Value</td>
                      <td className="p-3 text-right font-mono whitespace-nowrap">
                        {formatPrice(
                          parseSpecs(item.description).reduce((sum, spec) => sum + spec.numericPrice, 0)
                        )}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </DetailSection>
          )}
        </div>
      </CardDetailDialog>
    </>
  );
}

