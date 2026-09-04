import { useState } from 'react';
import { ExternalLink, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CardDetailDialog } from '@/components/cards/CardDetailDialog';
import { EntityFormDialog } from './EntityFormDialog';
import type { CollectionConfig, CollectionRow } from '../types';

interface EntityCardProps<T extends CollectionRow> {
  item: T;
  config: CollectionConfig<T>;
  index: number;
  onUpdate?: (id: string, updates: Partial<T>) => void;
  onRemove?: (id: string) => void;
}

/**
 * The card face. Chrome is fixed -- image, title, subtitle, excerpt, admin
 * actions, click-to-open -- and everything that varies comes from the config:
 * which fields those slots read, and what the detail dialog body contains.
 *
 * The detail dialog itself is CardDetailDialog, which already worked this way
 * across seven call sites. This is the same idea applied to the face, which
 * had been copy-pasted into BookCard, LinkCard, ItemCard and CreatorCard.
 *
 * Only the `tile` variant exists so far, because only Links has been converted.
 * `poster` (books, photos, watchlist) and `text` (articles, recipes) get added
 * when those pages land -- widening the union in types.ts is a compile-checked
 * change, so nothing silently falls through.
 */
export function EntityCard<T extends CollectionRow>({
  item,
  config,
  index,
  onUpdate,
  onRemove,
}: EntityCardProps<T>) {
  const [detailOpen, setDetailOpen] = useState(false);

  const { card } = config;
  const title = card.title(item);
  const subtitle = card.subtitle?.(item);
  const image = card.image?.(item);
  const href = card.href?.(item);
  const excerpt = card.excerpt?.(item);

  const handleDelete = () => {
    onRemove?.(item.id);
    setDetailOpen(false);
  };

  return (
    <>
      <article
        className="group relative bg-card rounded-lg p-5 opacity-0 animate-fade-in transition-[box-shadow] duration-300 cursor-pointer hover:shadow-md [box-shadow:var(--shadow-border)]"
        style={{ animationDelay: `${Math.min(index, 20) * 50}ms` }}
        onClick={() => setDetailOpen(true)}
      >
        <div
          className="absolute top-3 right-3 flex gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          {onUpdate && (
            <EntityFormDialog
              mode="edit"
              config={config}
              item={item}
              onSubmit={(values) => onUpdate(item.id, values as Partial<T>)}
            />
          )}
          {onRemove && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onRemove(item.id)}
              className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity bg-background/80 hover:bg-destructive hover:text-destructive-foreground w-8 h-8"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>

        <div className="flex gap-4 items-start">
          <div className="w-14 h-14 rounded-lg bg-secondary/50 overflow-hidden flex-shrink-0 flex items-center justify-center">
            {image ? (
              <img
                src={image}
                alt={title}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            ) : (
              <ExternalLink className="w-6 h-6 text-muted-foreground" />
            )}
          </div>

          <div className="flex-1 min-w-0 pr-16">
            <h3 className="font-serif text-base font-medium leading-tight group-hover:text-primary transition-colors block w-full mb-1">
              <span className="line-clamp-2" style={{ textWrap: 'balance' }}>
                {title}
                {href && (
                  <ExternalLink className="inline-block w-3 h-3 text-muted-foreground opacity-70 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity ml-2 align-baseline" />
                )}
              </span>
            </h3>
            {subtitle && (
              <span className="inline-block text-[10px] font-medium uppercase tracking-wider text-muted-foreground bg-secondary/50 px-2 py-0.5 rounded mb-2">
                {subtitle}
              </span>
            )}
            {excerpt && (
              <p className="text-sm text-muted-foreground line-clamp-2">{excerpt}</p>
            )}
          </div>
        </div>
      </article>

      <CardDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        title={title}
        subtitle={subtitle}
        imageUrl={image}
        link={href}
        onDelete={onRemove ? handleDelete : undefined}
      >
        {config.renderDetail?.(item)}
      </CardDetailDialog>
    </>
  );
}
