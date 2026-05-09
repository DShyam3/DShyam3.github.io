import { ReactNode } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ExternalLink, Trash2, CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface CardDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle?: ReactNode;
  imageUrl?: string;
  link?: string;
  children: ReactNode;
  badge?: string;
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
  onDelete,
  onSchedule,
  isScheduled,
}: CardDetailDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl h-fit max-h-[90vh] overflow-y-auto p-0 gap-0">
        {/* Mobile Layout */}
        <div className="sm:hidden">
          {imageUrl && (
            <div className="w-full h-48 relative overflow-hidden">
              <img
                src={imageUrl}
                alt={title}
                className="w-full h-full object-cover"
              />
              {badge && (
                <span className="absolute top-3 left-3 text-xs font-medium uppercase tracking-wider px-2 py-1 rounded bg-background/90 backdrop-blur-sm">
                  {badge}
                </span>
              )}
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
                  {subtitle && (
                    <div className="text-sm text-muted-foreground mt-1">{subtitle}</div>
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
            {onDelete && (
              <div className="mt-6 pt-4 border-t flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onDelete}
                  className="gap-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Desktop Layout */}
        <div className="hidden sm:flex">
          {imageUrl && (
            <div className="shrink-0 p-6 flex items-start bg-secondary/5 relative">
              <img
                src={imageUrl}
                alt={title}
                className="w-40 h-auto rounded-lg shadow-lg object-cover"
              />
              {badge && (
                <span className="absolute top-8 left-8 text-xs font-medium uppercase tracking-wider px-2 py-1 rounded bg-background/90 backdrop-blur-sm shadow-sm">
                  {badge}
                </span>
              )}
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
                  {subtitle && (
                    <div className="text-sm text-muted-foreground mt-1">{subtitle}</div>
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
            {onDelete && (
              <div className="mt-6 pt-4 border-t flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onDelete}
                  className="gap-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
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
