import { useRef, useState } from 'react';
import { Package } from 'lucide-react';
import { CardDetailDialog } from '@/components/cards/CardDetailDialog';
import { plateProps, shownImageClass, useShownImage } from '@/lib/images/image-cache';
import { cn } from '@/lib/utils';
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
  const shown = useShownImage(item.image ?? undefined, true);
  const image = shown.image?.src;
  const cutout = shown.image ? shownImageClass(shown.image, false) : undefined;
  const plate = plateProps(shown.image);
  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setDetailOpen(true)}
        aria-label={`${item.name} — view details`}
        className="item-card group flex flex-col overflow-hidden rounded-lg border border-border bg-card text-left transition-shadow hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <div
          className={cn('flex aspect-square w-full items-center justify-center p-4', cutout ? 'media-stage' : plate ? plate.className : 'bg-muted/40')}
          style={plate?.style}
        >
          {shown.pending ? null : image && failedImage !== image ? (
            <img src={image} alt="" loading="lazy" className={cn('h-full w-full object-contain', cutout)} onError={() => setFailedImage(image)} />
          ) : <Package className="h-10 w-10 text-muted-foreground" aria-hidden="true" />}
        </div>
        <div className="w-full space-y-1 p-3">
          <h3 className="text-sm font-medium">{item.name}</h3>
          {item.brand && <p className="text-xs text-muted-foreground">{item.brand}</p>}
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
        cleanImage
        link={item.link ?? undefined}
        imageIsContent={false}
        downloadName={item.name}
      >
        {config.renderDetail?.(item)}
      </CardDetailDialog>
    </>
  );
}
