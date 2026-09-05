import { useState, type ReactNode } from 'react';
import { BookOpen, ExternalLink, Image, Pencil, Quote, Trash2, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CardDetailDialog } from '@/components/cards/CardDetailDialog';
import { useDeleteConfirm } from '@/hooks/useDeleteConfirm';
import { cn } from '@/lib/utils';
import { EntityFormDialog } from './EntityFormDialog';
import type { CardVariant, CollectionConfig, CollectionRow } from '../types';

/**
 * Every variant sits in the same grid -- CardGrid, one wall for the whole
 * site -- so nothing reflows as you move between tabs. All that is left to
 * vary is the loading skeleton, and only because a text card has no image.
 */
export const CARD_LAYOUT: Record<CardVariant, { skeleton: string }> = {
  media: { skeleton: 'aspect-[3/4] rounded-lg' },
  text: { skeleton: 'h-40 rounded-lg' },
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
  badge?: string;
  /** Right-aligned beside the title, e.g. a price. */
  meta?: string;
  href?: string;
  actions: ReactNode;
  onOpen: () => void;
  /** False when the collection has no detail dialog worth opening. */
  openable: boolean;
}

/**
 * Props that make a clickable card reachable without a mouse.
 *
 * The card was a plain <div onClick>: pointer-only, invisible to the keyboard
 * and announced as nothing. On Books, Photos, Recipes, Articles, Inspiration
 * and Thoughts that meant the dialog -- the whole point of the card -- could
 * not be opened at all without a mouse.
 *
 * role + tabIndex + Enter/Space is the pattern rather than wrapping the card
 * in a real <button>, because the card already contains a link and the
 * edit/delete buttons, and a button may not contain interactive children.
 * Those inner controls stopPropagation, so they still act on their own.
 */
function openableProps(openable: boolean, title: string, onOpen: () => void) {
  if (!openable) return {};
  return {
    role: 'button',
    tabIndex: 0,
    'aria-label': `${title} -- open details`,
    onClick: onOpen,
    onKeyDown: (event: React.KeyboardEvent) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      // Space scrolls the page otherwise, and the card is the target here.
      event.preventDefault();
      onOpen();
    },
  };
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
  Fallback, imageFit, aspect, title, subtitle, image, excerpt, badge, meta, href, actions, onOpen, openable,
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
      {...openableProps(openable, title, onOpen)}
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

        {badge && (
          <div className="absolute top-2 left-2 z-10 pointer-events-none">
            <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-background/80 text-muted-foreground backdrop-blur-sm shadow-sm border border-border/40">
              {badge}
            </span>
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
        {/* The title gets the line to itself. It used to share one with the
            price, which is `whitespace-nowrap shrink-0` and so took what it
            needed first -- on a narrow card that left the title ~40px and
            "Hades Wireless Gaming Headset" rendered as "Ha:". Letting the
            price wrap under the title instead only moved the problem: it
            landed at a different height on every card, according to how many
            lines the title above it ran to, and the wall stopped lining up.
            It sits with the brand instead, on a row that is always there. */}
        <h3 className="text-sm font-medium line-clamp-2 min-h-[2.5rem]">
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
        <div className="flex items-baseline justify-between gap-2 min-h-[1rem]">
          <p className="text-xs text-muted-foreground line-clamp-1 min-w-0">
            {subtitle ?? '\u00a0'}
          </p>
          {meta && (
            <span className="text-sm font-medium text-foreground/90 whitespace-nowrap shrink-0 tabular-nums">
              {meta}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground/80 line-clamp-2 min-h-[2rem]">
          {excerpt ?? '\u00a0'}
        </p>
      </div>
    </div>
  );
}

/** No image: the text is the content. Beliefs. */
function TextFace({ title, subtitle, badge, actions, onOpen, openable }: FaceProps) {
  return (
    <div
      className={cn(
        'item-card p-6 group relative h-full flex flex-col',
        openable && 'cursor-pointer',
      )}
      onClick={openable ? onOpen : undefined}
    >
      <Quote className="h-6 w-6 text-muted-foreground/20 absolute top-4 left-4" />
      {badge && (
        <span className="absolute top-4 right-4 text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
          {badge}
        </span>
      )}
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
  const openable =
    typeof card.openable === 'function' ? card.openable(item) : card.openable !== false;
  const dimmed = card.dimmed?.(item) ?? false;

  const Face = FACES[card.variant];

  // A card's trash icon sits over the image, a mis-click away from the card
  // itself, so it asks first.
  const { askDelete, deleteDialog } = useDeleteConfirm();
  const confirmRemove = onRemove
    ? (after?: () => void) =>
        askDelete({
          name: title,
          onConfirm: () => {
            onRemove(item.id);
            after?.();
          },
        })
    : undefined;

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
          onClick={() => confirmRemove?.()}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      )}
    </>
  );

  // The same form as the pencil over the card, wearing a label instead: inside
  // the dialog there is room for one, and no image for it to sit on top of.
  const editAction = onUpdate ? (
    <EntityFormDialog
      mode="edit"
      config={config}
      item={item}
      onSubmit={(values) => onUpdate(item.id, values as Partial<T>)}
      trigger={
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-muted-foreground hover:text-foreground"
        >
          <Pencil className="h-4 w-4" />
          Edit
        </Button>
      }
    />
  ) : undefined;

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
          badge={badge}
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
        imageIsContent={card.imageIsContent}
        downloadName={title}
        editAction={editAction}
        onDelete={
          confirmRemove ? () => confirmRemove(() => setDetailOpen(false)) : undefined
        }
      >
        {config.renderDetail?.(item)}
      </CardDetailDialog>
      )}

      {deleteDialog}
    </>
  );
}
