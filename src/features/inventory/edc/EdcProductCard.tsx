import { useRef, useState } from 'react';
import { Package } from 'lucide-react';
import { CardDetailDialog } from '@/components/cards/CardDetailDialog';
import { edcCategoryLabel } from './categories';
import type { InventoryRow } from '@/collections/inventory';
import type { CollectionConfig } from '@/collections/types';

interface EdcProductCardProps {
  item: InventoryRow;
  config: CollectionConfig<InventoryRow>;
}

export function EdcProductCard({ item, config }: EdcProductCardProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [failedImage, setFailedImage] = useState<string | null>(null);
  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setDetailOpen(true)}
        aria-label={`${item.name} — view details`}
        className="item-card group flex flex-col overflow-hidden rounded-lg border border-border bg-card text-left transition-shadow hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <div className="flex aspect-square w-full items-center justify-center bg-muted/40 p-4">
          {item.image && failedImage !== item.image ? (
            <img src={item.image} alt="" loading="lazy" className="h-full w-full object-contain" onError={() => setFailedImage(item.image)} />
          ) : <Package className="h-10 w-10 text-muted-foreground" aria-hidden="true" />}
        </div>
        <div className="w-full space-y-1 p-3">
          <h3 className="text-sm font-medium">{item.name}</h3>
          {item.brand && <p className="text-xs text-muted-foreground">{item.brand}</p>}
          {item.is_wishlist && <span className="inline-block rounded bg-muted px-2 py-1 text-xs text-muted-foreground">Wishlist</span>}
        </div>
      </button>
      <CardDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          triggerRef.current?.focus();
        }}
        title={item.name}
        subtitle={item.brand || edcCategoryLabel(item)}
        imageUrl={item.image ?? undefined}
        link={item.link ?? undefined}
        imageIsContent={false}
        downloadName={item.name}
      >
        {config.renderDetail?.(item)}
      </CardDetailDialog>
    </>
  );
}
