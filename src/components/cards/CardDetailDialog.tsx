import { ReactNode } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ExternalLink, Trash2, CalendarDays, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { openAndDownload } from '@/lib/download';

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
  title,
  subtitle,
  imageUrl,
  link,
  children,
  badge,
  imageIsContent,
  downloadName,
  editAction,
  onDelete,
  onSchedule,
  isScheduled,
}: CardDetailDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl h-fit max-h-[85svh] overflow-x-hidden overflow-y-auto p-0 gap-0">
        {/* Radix wires `aria-describedby` from this, and warns when a dialog
            has none: a screen reader was announcing the title and then going
            silent about what the dialog is. It is `sr-only` rather than
            visible because the two layouts below already show the subtitle to
            anyone who can see it -- and it is declared once here, outside
            both, since two of them would fight over the same id. */}
        <DialogDescription className="sr-only">
          {subtitle ? `${title} -- ${subtitle}` : `Details for ${title}`}
        </DialogDescription>

        {/* Mobile Layout */}
        <div className="sm:hidden">
          {imageUrl && (
            <div className={cn('w-full overflow-hidden', imageIsContent ? 'max-h-[46svh]' : 'h-48')}>
              <img
                src={imageUrl}
                alt={title}
                className={cn(
                  'w-full',
                  imageIsContent ? 'h-auto object-contain' : 'h-full object-cover',
                )}
              />
            </div>
          )}
          <div className="p-6">
            <DialogHeader className="text-left">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <DialogTitle className="font-serif text-xl font-medium">
                    {link ? (
                      <a
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-primary transition-colors inline-flex items-center gap-2"
                      >
                        {title}
                        <ExternalLink className="w-4 h-4 opacity-60" />
                      </a>
                    ) : (
                      title
                    )}
                  </DialogTitle>
                  {(subtitle || badge) && (
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      {subtitle && (
                        <span className="text-sm text-muted-foreground">{subtitle}</span>
                      )}
                      {badge && (
                        <span className="text-xs font-medium uppercase tracking-wider px-2 py-0.5 rounded bg-secondary text-muted-foreground">
                          {badge}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                {onSchedule && (
                  <Button
                    variant={isScheduled ? 'default' : 'ghost'}
                    size="icon"
                    onClick={onSchedule}
                    className={cn(
                      "h-8 w-8 flex-shrink-0",
                      isScheduled ? "text-primary-foreground" : "text-muted-foreground"
                    )}
                  >
                    <CalendarDays className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </DialogHeader>
            <div className="mt-4 space-y-4">
              {children}
            </div>
            {imageIsContent && imageUrl && (
              <DownloadLink href={imageUrl} name={downloadName || title} />
            )}
            {(editAction || onDelete) && (
              <div className="mt-6 pt-4 border-t flex justify-end gap-2">
                {editAction}
                {onDelete && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onDelete}
                    className="gap-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Desktop Layout */}
        <div className="hidden sm:flex">
          {imageUrl && (
            <div
              className={cn(
                'flex items-start bg-secondary/5',
                // A content image shares the row instead of owning it: it
                // shrinks with the dialog rather than pushing the text
                // column out and giving the whole thing a sideways scroll.
                imageIsContent ? 'p-4 min-w-0 flex-1' : 'shrink-0 p-6',
              )}
            >
              <img
                src={imageUrl}
                alt={title}
                className={cn(
                  'h-auto rounded-lg shadow-lg object-contain',
                  // A recipe or a book cover is worth looking at, and at
                  // w-40 it was a thumbnail beside a column of text. The
                  // height cap is svh rather than vh so the dialog still
                  // clears an iPad's browser chrome in either orientation.
                  imageIsContent ? 'max-w-full max-h-[58svh]' : 'w-56 object-cover',
                )}
              />
            </div>
          )}
          <div className="flex-1 p-6 min-w-0 flex flex-col">
            <DialogHeader className="text-left">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <DialogTitle className="font-serif text-xl font-medium">
                    {link ? (
                      <a
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-primary transition-colors inline-flex items-center gap-2"
                      >
                        {title}
                        <ExternalLink className="w-4 h-4 opacity-60" />
                      </a>
                    ) : (
                      title
                    )}
                  </DialogTitle>
                  {(subtitle || badge) && (
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      {subtitle && (
                        <span className="text-sm text-muted-foreground">{subtitle}</span>
                      )}
                      {badge && (
                        <span className="text-xs font-medium uppercase tracking-wider px-2 py-0.5 rounded bg-secondary text-muted-foreground">
                          {badge}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                {onSchedule && (
                  <Button
                    variant={isScheduled ? 'default' : 'ghost'}
                    size="icon"
                    onClick={onSchedule}
                    className={cn(
                      "h-8 w-8 flex-shrink-0",
                      isScheduled ? "text-primary-foreground" : "text-muted-foreground"
                    )}
                  >
                    <CalendarDays className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </DialogHeader>
            <div className="mt-4 space-y-4 flex-1">
              {children}
            </div>
            {imageIsContent && imageUrl && (
              <div className="mt-4">
                <DownloadLink href={imageUrl} name={downloadName || title} />
              </div>
            )}
            {(editAction || onDelete) && (
              <div className="mt-6 pt-4 border-t flex justify-end gap-2">
                {editAction}
                {onDelete && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onDelete}
                    className="gap-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Offered whenever the image is the content rather than a cover. It lived
 * inline in the mobile branch and was simply absent from the desktop one, so
 * the download the dialog promised only existed on a phone.
 */
function DownloadLink({ href, name }: { href: string; name: string }) {
  return (
    <button
      type="button"
      // openAndDownload does both halves itself, so the click must not also
      // navigate -- a plain <a download> would be ignored anyway, the file
      // being on another origin.
      onClick={() => openAndDownload(href, name)}
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
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
