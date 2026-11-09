import { type ReactNode, useEffect, useId, useRef } from 'react';
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
            <div className="flex justify-center rounded-xl border border-border/50 bg-background/50 p-2">
              <img
                src={imageUrl}
                alt={title}
                className="max-h-56 w-auto object-contain rounded-lg"
              />
            </div>
          ) : null}

          <div className="space-y-1.5">
            <div className="flex items-start justify-between gap-2">
              <h2 className="font-serif text-base font-semibold text-foreground leading-snug">
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
