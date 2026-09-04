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
/**
 * One grid and one card shape -- see CARD_GRID and the CardVariant docs. Only
 * the loading skeleton differs, and only because a text card has no image.
 */
export const CARD_LAYOUT: Record<CardVariant, { grid: string; skeleton: string }> = {
  media: { grid: CARD_GRID, skeleton: 'aspect-[3/4] rounded-lg' },
  text: { grid: CARD_GRID, skeleton: 'h-40 rounded-lg' },
};

interface FaceProps {
  /** Shown when an item has no image. Comes from the collection's config. */
  Fallback: LucideIcon;
  imageFit: 'cover' | 'contain';
  aspect: string;
  title: string;
  subtitle?: string;
  image?: string;
  excerpt?: string;
  /** Right-aligned beside the title, e.g. a price. */
  meta?: string;
  href?: string;
  actions: ReactNode;
  onOpen: () => void;
  /** False when the collection has no detail dialog worth opening. */
  openable: boolean;
}

/**
 * A 3:4 image with a fixed text block beneath it.
 *
 * The text block reserves room for two lines of title, one of subtitle and two
 * of excerpt whether or not they are all used, so every card is exactly the
 * same height. Without that, a two-line title made one card taller than its
 * neighbours and the wall lost its rhythm.
 */
function MediaFace({
  Fallback, imageFit, aspect, title, subtitle, image, excerpt, meta, href, actions, onOpen, openable,
}: FaceProps) {
  // Stored image URLs go stale -- a cover moves, a shop takes a product photo
  // down -- and a broken <img> renders as alt text on a grey box. Falling back
  // to the collection's icon costs nothing and needs no pre-flight request,
  // which a HEAD check would (and CORS would usually block anyway).
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = image && !imageFailed;

  return (
    <div
      className={cn(
        'item-card group relative h-full flex flex-col overflow-hidden',
        openable && 'cursor-pointer',
      )}
      onClick={openable ? onOpen : undefined}
    >
      <div
        className="bg-muted relative overflow-hidden shrink-0"
        style={{ aspectRatio: aspect }}
      >
        {showImage ? (
          <img
            src={image}
            alt={title}
            className={cn(
              'w-full h-full',
              imageFit === 'contain' ? 'object-contain p-4' : 'object-cover',
            )}
            loading="lazy"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Fallback className="h-10 w-10 text-muted-foreground/30" />
          </div>
        )}

        <div
          className="absolute top-2 right-2 flex gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          {actions}
        </div>
      </div>

      <div className="p-3 flex flex-col gap-1 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-medium line-clamp-2 min-h-[2.5rem] min-w-0">
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
        <p className="text-xs text-muted-foreground line-clamp-1 min-h-[1rem]">
          {subtitle ?? '\u00a0'}
        </p>
        <p className="text-xs text-muted-foreground/80 line-clamp-2 min-h-[2rem]">
          {excerpt ?? '\u00a0'}
        </p>
      </div>
    </div>
  );
}

/** No image: the text is the content. Beliefs. */
function TextFace({ title, subtitle, actions, onOpen, openable }: FaceProps) {
  return (
    <div
      className={cn(
        'item-card p-6 group relative h-full flex flex-col',
        openable && 'cursor-pointer',
      )}
      onClick={openable ? onOpen : undefined}
    >
      <Quote className="h-6 w-6 text-muted-foreground/20 absolute top-4 left-4" />
      <p className="text-base font-serif italic pl-8 line-clamp-4 flex-1">"{title}"</p>
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
  media: MediaFace,
  text: TextFace,
};

/** Used when a collection does not name its own fallback icon. */
const DEFAULT_FALLBACK: Record<CardVariant, LucideIcon> = {
  media: Image,
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
      {onRemove && (
        <Button
          variant="secondary"
          size="icon"
          className="h-7 w-7 bg-background/80 backdrop-blur-sm"
          onClick={() => onRemove(item.id)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      )}
    </>
  );

  return (
    <>
      <div className={cn(dimmed && 'opacity-60 hover:opacity-100 transition-opacity')}>
        <Face
          Fallback={card.fallbackIcon ?? DEFAULT_FALLBACK[card.variant]}
          imageFit={card.imageFit ?? 'cover'}
          aspect={card.aspect ?? '1 / 1'}
          title={title}
          subtitle={subtitle}
          image={image}
          excerpt={excerpt}
          meta={meta}
          href={href}
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
