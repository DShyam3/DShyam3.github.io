import { type ReactNode, useEffect, useId, useRef, useState } from 'react';
import { ExternalLink, Trash2, CalendarDays, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { openAndDownload } from '@/lib/download';
import { safeHref } from '@/lib/safe-url';
import { useWorkspaceInspector } from '@/contexts/WorkspaceInspectorContext';

interface CardDetailDialogProps {
  /**
   * Render the image large instead of as a thumbnail, with a download link.
   * For collections where the picture is the point rather than a cover.
   */
  imageIsContent?: boolean;
  /** Filename offered when downloading. Defaults to the title. */
  downloadName?: string;
  /** Sit the image on a logo's white plate, without the photo hairline. */
  imageIsLogo?: boolean;
  /** Whoever can fix the record is told when its image has stopped loading. */
  canEdit?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus?: (event: Event) => void;
  title: string;
  subtitle?: ReactNode;
  imageUrl?: string;
  link?: string;
  children: ReactNode;
  badge?: string;
  /**
   * Opens the edit form. The pencil over a card is a small target that only
   * appears on hover, and once a card opens a dialog that is where you are when
   * you notice the typo -- so editing lives here too.
   */
  editAction?: ReactNode;
  onDelete?: () => void;
  onSchedule?: () => void;
  isScheduled?: boolean;
}

export function CardDetailDialog({
  open,
  onOpenChange,
  onCloseAutoFocus,
  title,
  subtitle,
  imageUrl,
  link: rawLink,
  children,
  badge,
  imageIsContent,
  downloadName,
  imageIsLogo,
  canEdit,
  editAction,
  onDelete,
  onSchedule,
  isScheduled,
}: CardDetailDialogProps) {
  const instanceId = useId();
  const { setDockedDetail } = useWorkspaceInspector();
  const wasOpenRef = useRef(false);
  const link = safeHref(rawLink);

  useEffect(() => {
    if (!open) {
      if (wasOpenRef.current) {
        wasOpenRef.current = false;
        setDockedDetail(null);
      }
      return;
    }

    wasOpenRef.current = true;
    setDockedDetail({
      id: instanceId,
      eyebrow: badge || 'Collection Record',
      title,
      onClose: () => {
        onOpenChange(false);
        onCloseAutoFocus?.(new Event('close'));
      },
      node: (
        <div className="space-y-4">
          {imageUrl ? (
            // Keyed by URL so a replaced image starts clean rather than
            // inheriting the last one's failure.
            <DetailImage
              key={imageUrl}
              src={imageUrl}
              alt={title}
              logo={Boolean(imageIsLogo)}
              canEdit={Boolean(canEdit)}
            />
          ) : null}

          <div className="space-y-1.5">
            <div className="flex items-start justify-between gap-2">
              {/* A flex item keeps its longest word as a floor, so a title that
                  is one long word or URL would run past the panel, which no
                  longer scrolls sideways. Same pattern as DialogTitle. */}
              <h2 className="min-w-0 [overflow-wrap:anywhere] font-serif text-base font-semibold text-foreground leading-snug">
                {link ? (
                  <a
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-primary transition-colors inline-flex items-center gap-1.5"
                  >
                    <span>{title}</span>
                    <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-70" />
                  </a>
                ) : (
                  title
                )}
              </h2>
              {onSchedule ? (
                <Button
                  variant={isScheduled ? 'default' : 'ghost'}
                  size="icon"
                  onClick={onSchedule}
                  aria-label={isScheduled ? 'Edit schedule' : 'Schedule'}
                  className={cn(
                    'h-8 w-8 shrink-0',
                    isScheduled ? 'text-primary-foreground' : 'text-muted-foreground',
                  )}
                >
                  <CalendarDays className="h-4 w-4" />
                </Button>
              ) : null}
            </div>

            {(subtitle || badge) ? (
              <div className="flex flex-wrap items-center gap-2">
                {subtitle ? (
                  <span className="text-xs text-muted-foreground">{subtitle}</span>
                ) : null}
                {badge ? (
                  <span className="text-xs font-medium uppercase tracking-wider px-2 py-0.5 rounded bg-secondary text-muted-foreground">
                    {badge}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="space-y-3 text-xs leading-relaxed">
            {children}
          </div>

          {imageIsContent && imageUrl ? (
            <div>
              <DownloadLink href={imageUrl} name={downloadName || title} />
            </div>
          ) : null}

          {(editAction || onDelete) ? (
            <div className="pt-3 border-t border-border/50 flex flex-wrap justify-end gap-2">
              {editAction}
              {onDelete ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onDelete}
                  className="gap-1.5 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      ),
    });
  }, [
    open,
    instanceId,
    badge,
    title,
    subtitle,
    imageUrl,
    link,
    children,
    imageIsContent,
    downloadName,
    imageIsLogo,
    canEdit,
    editAction,
    onDelete,
    onSchedule,
    isScheduled,
    onOpenChange,
    onCloseAutoFocus,
    setDockedDetail,
  ]);

  useEffect(() => {
    return () => {
      if (wasOpenRef.current) {
        wasOpenRef.current = false;
        setDockedDetail(null);
      }
    };
  }, [setDockedDetail]);

  return null;
}

/**
 * The record's image in the detail view. A stored URL that has stopped
 * loading leaves no broken-image box: a visitor sees nothing, and whoever can
 * edit the record is told to replace it.
 */
function DetailImage({
  src,
  alt,
  logo,
  canEdit,
}: {
  src: string;
  alt: string;
  logo: boolean;
  canEdit: boolean;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return canEdit ? (
      <p className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
        Image no longer loads. Edit to replace it.
      </p>
    ) : null;
  }

  return (
    <div
      className={cn(
        'flex justify-center rounded-xl border border-border/50 p-2',
        logo ? 'bg-white' : 'bg-background/50',
      )}
    >
      <img
        src={src}
        alt={alt}
        onError={() => setFailed(true)}
        className={cn('max-h-56 w-auto object-contain rounded-lg', logo && 'no-outline')}
      />
    </div>
  );
}

function DownloadLink({ href, name }: { href: string; name: string }) {
  return (
    <button
      type="button"
      onClick={() => openAndDownload(href, name)}
      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
    >
      <Download className="h-3.5 w-3.5" />
      Download
    </button>
  );
}

interface DetailSectionProps {
  label: string;
  children: ReactNode;
  className?: string;
}

export function DetailSection({ label, children, className }: DetailSectionProps) {
  return (
    <div className={cn('space-y-1', className)}>
      <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </h4>
      <div className="text-sm">{children}</div>
    </div>
  );
}
