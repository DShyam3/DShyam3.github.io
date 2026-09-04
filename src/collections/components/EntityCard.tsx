import { useState, type ReactNode } from 'react';
import { BookOpen, ExternalLink, Image, Quote, Trash2, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CardDetailDialog } from '@/components/cards/CardDetailDialog';
import { cn } from '@/lib/utils';
import { EntityFormDialog } from './EntityFormDialog';
import { CARD_GRID } from '@/theme/layout';
import type { CardVariant, CollectionConfig, CollectionRow } from '../types';

/**
 * Everything that differs between card shapes, in one table: the grid the
 * cards sit in and the skeleton shown while loading. CollectionPage reads it
 * so the page layout and the card face can never drift apart.
 */
/**
 * Every variant shares one grid -- see CARD_GRID -- so the wall does not
 * reflow between tabs. Only the loading skeleton differs, to match the shape
 * of the image that variant renders.
 */
export const CARD_LAYOUT: Record<CardVariant, { grid: string; skeleton: string }> = {
  tile: { grid: CARD_GRID, skeleton: 'h-32 rounded-lg' },
  poster: { grid: CARD_GRID, skeleton: 'aspect-[2/3] rounded-lg' },
  square: { grid: CARD_GRID, skeleton: 'aspect-square rounded-lg' },
  feature: { grid: CARD_GRID, skeleton: 'h-48 rounded-lg' },
  text: { grid: CARD_GRID, skeleton: 'h-32 rounded-lg' },
};

interface FaceProps {
  /** Shown when an item has no image. Comes from the collection's config. */
  Fallback: LucideIcon;
  /** Right-aligned beside the title, e.g. a price. */
  meta?: string;
  title: string;
  subtitle?: string;
  image?: string;
  excerpt?: string;
  href?: string;
  index: number;
  actions: ReactNode;
  onOpen: () => void;
  /** False when the collection has no detail dialog worth opening. */
  openable: boolean;
}

/** Wide row: small icon on the left, text on the right. Links, inventory. */
function TileFace({ Fallback, title, subtitle, image, excerpt, href, index, actions, onOpen }: FaceProps) {
  return (
    <article
      className="group relative bg-card rounded-lg p-5 opacity-0 animate-fade-in transition-[box-shadow] duration-300 cursor-pointer hover:shadow-md [box-shadow:var(--shadow-border)]"
      style={{ animationDelay: `${Math.min(index, 20) * 50}ms` }}
      onClick={onOpen}
    >
      <div className="absolute top-3 right-3 flex gap-1" onClick={(e) => e.stopPropagation()}>
        {actions}
      </div>

      <div className="flex gap-4 items-start">
        <div className="w-14 h-14 rounded-lg bg-secondary/50 overflow-hidden flex-shrink-0 flex items-center justify-center">
          {image ? (
            <img src={image} alt={title} className="w-full h-full object-cover" loading="lazy" />
          ) : (
            <Fallback className="w-6 h-6 text-muted-foreground" />
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
          {excerpt && <p className="text-sm text-muted-foreground line-clamp-2">{excerpt}</p>}
        </div>
      </div>
    </article>
  );
}

/** 2:3 cover with text beneath, actions overlaid on the image. Books, photos. */
function PosterFace({ Fallback, title, subtitle, image, excerpt, actions, onOpen }: FaceProps) {
  return (
    <div className="item-card group relative cursor-pointer" onClick={onOpen}>
      <div className="aspect-[2/3] bg-muted relative overflow-hidden">
        {image ? (
          <img src={image} alt={title} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Fallback className="h-12 w-12 text-muted-foreground/30" />
          </div>
        )}

        <div
          className={cn(
            'absolute top-2 right-2 flex gap-1 transition-opacity duration-200',
            'opacity-100 lg:opacity-0 lg:group-hover:opacity-100',
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {actions}
        </div>
      </div>

      <div className="p-4">
        <h3 className="text-sm font-medium">
          <span className="line-clamp-2" style={{ textWrap: 'balance' }}>
            {title}
          </span>
        </h3>
        {subtitle && (
          <p className="text-xs text-muted-foreground line-clamp-1 mt-1">{subtitle}</p>
        )}
        {excerpt && (
          <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{excerpt}</p>
        )}
      </div>
    </div>
  );
}

/**
 * Image on top, text beneath, in a card-shaped box. `square` uses a 1:1 crop
 * (recipes, inspiration); `feature` uses a fixed-height banner (articles).
 */
function mediaFace(shape: 'square' | 'feature') {
  return function MediaFace({
    Fallback, title, subtitle, image, excerpt, meta, href, actions, onOpen, openable,
  }: FaceProps) {
    const box = shape === 'square' ? 'aspect-square' : 'h-40';
    return (
      <div
        className={cn('item-card group relative', openable && 'cursor-pointer')}
        onClick={openable ? onOpen : undefined}
      >
        <div className={cn(box, 'bg-muted relative overflow-hidden')}>
          {image ? (
            <img src={image} alt={title} className="w-full h-full object-cover" loading="lazy" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Fallback className="h-14 w-14 text-muted-foreground/30" />
            </div>
          )}
          <div
            className="absolute top-2 right-2 flex gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            {actions}
          </div>
        </div>
        <div className="p-4">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-medium line-clamp-2 min-w-0">
              {/* When the card does not open, the title is the way out. */}
              {!openable && href ? (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-primary transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  {title}
                </a>
              ) : (
                title
              )}
            </h3>
            {meta && (
              <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0 tabular-nums">
                {meta}
              </span>
            )}
          </div>
          {subtitle && (
            <p className="text-xs text-muted-foreground line-clamp-1 mt-1">{subtitle}</p>
          )}
          {excerpt && (
            <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{excerpt}</p>
          )}
        </div>
      </div>
    );
  };
}

/** No image: the text is the content. Beliefs. */
function TextFace({ title, subtitle, actions, onOpen }: FaceProps) {
  return (
    <div className="item-card p-6 group relative cursor-pointer" onClick={onOpen}>
      <Quote className="h-6 w-6 text-muted-foreground/20 absolute top-4 left-4" />
      <p className="text-base font-serif italic pl-8 line-clamp-4">"{title}"</p>
      {subtitle && <p className="text-sm text-muted-foreground mt-2 pl-8">— {subtitle}</p>}
      <div
        className="flex items-center justify-end gap-1 mt-4 pl-8"
        onClick={(e) => e.stopPropagation()}
      >
        {actions}
      </div>
    </div>
  );
}

const FACES: Record<CardVariant, (props: FaceProps) => JSX.Element> = {
  tile: TileFace,
  poster: PosterFace,
  square: mediaFace('square'),
  feature: mediaFace('feature'),
  text: TextFace,
};

/** Used when a collection does not name its own fallback icon. */
const DEFAULT_FALLBACK: Record<CardVariant, LucideIcon> = {
  tile: ExternalLink,
  poster: BookOpen,
  square: Image,
  feature: Image,
  text: Quote,
};

interface EntityCardProps<T extends CollectionRow, R> {
  item: T;
  config: CollectionConfig<T, R>;
  index: number;
  onUpdate?: (id: string, updates: Partial<T>) => void;
  onRemove?: (id: string) => void;
}

/**
 * The shell every card shares: detail-open state, admin actions, and the
 * detail dialog. Only the face differs, and which face comes from the config.
 *
 * The detail dialog is CardDetailDialog, which already worked this way across
 * seven call sites. This applies the same idea to the face, which had been
 * copy-pasted into BookCard, LinkCard, ItemCard and CreatorCard.
 */
export function EntityCard<T extends CollectionRow, R>({
  item,
  config,
  index,
  onUpdate,
  onRemove,
}: EntityCardProps<T, R>) {
  const [detailOpen, setDetailOpen] = useState(false);

  const { card } = config;
  const title = card.title(item);
  const subtitle = card.subtitle?.(item);
  const image = card.image?.(item);
  const href = card.href?.(item);
  const excerpt = card.excerpt?.(item);
  const badge = card.badge?.(item);
  const meta = card.meta?.(item);
  const openable = card.openable !== false;
  const dimmed = card.dimmed?.(item) ?? false;

  const isOverlay = card.variant !== 'tile' && card.variant !== 'text';
  const Face = FACES[card.variant];

  const actions = (
    <>
      {onUpdate && (
        <EntityFormDialog
          mode="edit"
          config={config}
          item={item}
          onSubmit={(values) => onUpdate(item.id, values as Partial<T>)}
        />
      )}
      {onRemove &&
        (isOverlay ? (
          <Button
            variant="secondary"
            size="icon"
            className="h-8 w-8 bg-background/80 backdrop-blur-sm"
            onClick={() => onRemove(item.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onRemove(item.id)}
            className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity bg-background/80 hover:bg-destructive hover:text-destructive-foreground w-8 h-8"
          >
            <X className="w-4 h-4" />
          </Button>
        ))}
    </>
  );

  return (
    <>
      <div className={cn(dimmed && 'opacity-60 hover:opacity-100 transition-opacity')}>
        <Face
          Fallback={card.fallbackIcon ?? DEFAULT_FALLBACK[card.variant]}
          title={title}
          subtitle={subtitle}
          image={image}
          excerpt={excerpt}
          meta={meta}
          href={href}
          index={index}
          actions={actions}
          openable={openable}
          onOpen={() => setDetailOpen(true)}
        />
      </div>

      {openable && (
      <CardDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        title={title}
        subtitle={subtitle}
        imageUrl={image}
        link={href}
        badge={badge}
        onDelete={
          onRemove
            ? () => {
                onRemove(item.id);
                setDetailOpen(false);
              }
            : undefined
        }
      >
        {config.renderDetail?.(item)}
      </CardDetailDialog>
      )}
    </>
  );
}
