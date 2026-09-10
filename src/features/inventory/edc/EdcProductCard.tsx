import { useState, useRef } from 'react';
import {
  Package,
  Check,
  Plus,
  Pocket,
  Watch,
  Briefcase,
  Key,
  Layers,
  ChevronDown,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CardDetailDialog } from '@/components/cards/CardDetailDialog';
import { cn } from '@/lib/utils';
import { EDC_SLOTS } from './types';
import type { InventoryRow } from '@/collections/inventory';
import type { CollectionConfig } from '@/collections/types';

interface EdcProductCardProps {
  item: InventoryRow;
  config: CollectionConfig<InventoryRow>;
  inEdc: boolean;
  slotKey: string;
  isSaving: boolean;
  onToggleEdc: (item: InventoryRow) => Promise<void>;
  onSetSlot: (item: InventoryRow, slotKey: string) => Promise<void>;
}

const SLOT_ICONS: Record<string, typeof Pocket> = {
  pockets: Pocket,
  wrist: Watch,
  bag: Briefcase,
  keychain: Key,
  pouches: Layers,
};

const formatPrice = (value: number) =>
  new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

export function EdcProductCard({
  item,
  config,
  inEdc,
  slotKey,
  isSaving,
  onToggleEdc,
  onSetSlot,
}: EdcProductCardProps) {
  const [detailOpen, setDetailOpen] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const openable = Boolean(item.specs || item.description);
  const price = item.price != null && Number(item.price) > 0 ? formatPrice(Number(item.price)) : null;

  const originLabel =
    item.category === 'wardrobe' && item.subcategory
      ? `Wardrobe · ${item.subcategory}`
      : item.category.toUpperCase();

  const currentSlotDef = EDC_SLOTS.find((s) => s.key === slotKey) ?? EDC_SLOTS[0];
  const SlotIcon = SLOT_ICONS[slotKey] ?? Package;

  return (
    <>
      <div
        ref={cardRef}
        role={openable ? 'button' : undefined}
        tabIndex={openable ? 0 : undefined}
        aria-label={openable ? `${item.name} -- view details` : undefined}
        onClick={() => {
          if (openable) setDetailOpen(true);
        }}
        onKeyDown={(e) => {
          if (openable && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            setDetailOpen(true);
          }
        }}
        className={cn(
          'item-card group relative flex flex-col rounded-lg border overflow-hidden transition-all duration-200 text-left bg-card',
          openable && 'cursor-pointer',
          inEdc
            ? 'border-primary/60 ring-1 ring-primary/40 shadow-sm bg-primary/[0.02]'
            : 'border-border/70 hover:border-border hover:shadow-sm',
          item.is_wishlist && 'opacity-70 hover:opacity-100',
        )}
      >
        {/* Top Badges */}
        <div className="absolute top-2.5 left-2.5 right-2.5 z-10 flex items-center justify-between pointer-events-none gap-1">
          <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-background/90 text-muted-foreground border border-border/70 shadow-xs backdrop-blur-xs truncate max-w-[120px]">
            {originLabel}
          </span>
          {inEdc && (
            <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary text-primary-foreground font-semibold shadow-xs flex items-center gap-1 shrink-0">
              <Check className="w-2.5 h-2.5" />
              <span>IN CARRY</span>
            </span>
          )}
          {!inEdc && item.is_wishlist && (
            <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border/70 shadow-xs">
              Wishlist
            </span>
          )}
        </div>

        {/* Product Image */}
        <div className="bg-muted/40 relative overflow-hidden shrink-0 aspect-square flex items-center justify-center p-3 border-b border-border/50">
          {item.image && !imageFailed ? (
            <img
              src={item.image}
              alt={item.name}
              onError={() => setImageFailed(true)}
              className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <Package className="h-10 w-10 text-muted-foreground/30" aria-hidden="true" />
          )}
        </div>

        {/* Product Details */}
        <div className="p-3 flex flex-col gap-1 flex-1">
          <h3 className="text-xs sm:text-sm font-medium line-clamp-2 min-h-[2rem] text-foreground leading-snug">
            {item.name}
          </h3>

          <div className="flex items-baseline justify-between gap-2 mt-auto pt-1">
            <p className="text-[11px] text-muted-foreground truncate">
              {item.brand ?? '\u00a0'}
            </p>
            {price && (
              <span className="text-xs font-semibold text-foreground/90 whitespace-nowrap font-mono">
                {price}
              </span>
            )}
          </div>

          {/* Interactive Carry Actions Bar */}
          <div
            className="mt-2 pt-2 border-t border-border/50 flex items-center gap-1.5"
            onClick={(e) => e.stopPropagation()}
          >
            {inEdc ? (
              <div className="flex items-center justify-between gap-1.5 w-full">
                {/* Slot Selector */}
                <div className="relative flex-1 min-w-0">
                  <select
                    value={slotKey}
                    disabled={isSaving}
                    onChange={(e) => onSetSlot(item, e.target.value)}
                    className="w-full h-7 pl-6 pr-5 text-[11px] font-mono rounded border border-border/80 bg-background text-foreground appearance-none cursor-pointer hover:bg-muted/50 transition-colors truncate"
                  >
                    {EDC_SLOTS.map((s) => (
                      <option key={s.key} value={s.key}>
                        {s.shortLabel}
                      </option>
                    ))}
                  </select>
                  <SlotIcon className="w-3 h-3 absolute left-1.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  <ChevronDown className="w-2.5 h-2.5 absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none opacity-60" />
                </div>

                {/* Remove button */}
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isSaving}
                  onClick={() => onToggleEdc(item)}
                  aria-label={`Remove ${item.name} from carry`}
                  className="h-7 px-2 text-[10px] font-mono border-border/80 hover:border-destructive hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0 gap-1"
                >
                  <X className="w-3 h-3 sm:hidden" />
                  <span className="hidden sm:inline">REMOVE</span>
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                variant="outline"
                disabled={isSaving}
                onClick={() => onToggleEdc(item)}
                className="w-full h-7 text-xs font-mono gap-1.5 border-border/80 hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all duration-150"
              >
                <Plus className="w-3 h-3" />
                <span>ADD TO CARRY</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      {openable && (
        <CardDetailDialog
          open={detailOpen}
          onOpenChange={setDetailOpen}
          title={item.name}
          subtitle={item.brand ? `${item.brand} (${originLabel})` : originLabel}
          imageUrl={item.image ?? undefined}
          link={item.link ?? undefined}
          badge={inEdc ? `EDC · ${currentSlotDef.shortLabel.toUpperCase()}` : undefined}
          imageIsContent={false}
          downloadName={item.name}
        >
          {config.renderDetail?.(item)}
        </CardDetailDialog>
      )}
    </>
  );
}
