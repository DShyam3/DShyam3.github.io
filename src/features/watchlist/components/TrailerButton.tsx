import { useRef, useState } from 'react';
import { ExternalLink, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { trailerEmbedUrl, trailerWatchUrl } from '@/features/watchlist/trailer';

interface TrailerButtonProps {
  /** A YouTube video id from TMDB. Nothing renders unless it is a valid one. */
  trailerKey: string | null | undefined;
  /** What the trailer is for, e.g. "Severance" or "Severance, Season 2". */
  title: string;
  /** Button text; defaults to "Watch trailer". */
  label?: string;
  className?: string;
}

/**
 * A button that plays a title's trailer in a dialog. The iframe is mounted
 * only while the dialog is open, so nothing is requested from YouTube until
 * the button is pressed, and closing the dialog stops playback.
 */
export function TrailerButton({ trailerKey, title, label = 'Watch trailer', className }: TrailerButtonProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const embedUrl = trailerKey ? trailerEmbedUrl(trailerKey) : null;
  const watchUrl = trailerKey ? trailerWatchUrl(trailerKey) : null;
  if (!embedUrl || !watchUrl) return null;

  return (
    <>
      <Button
        ref={triggerRef}
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className={cn('gap-1.5 text-xs justify-center', className)}
        aria-label={`${label}: ${title}`}
      >
        <Play className="h-3.5 w-3.5" />
        {label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="max-w-4xl"
          // Radix would focus the iframe, the first focusable child. Focus
          // inside a cross-origin frame takes the keyboard with it, so
          // Escape would reach YouTube and never close the dialog.
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            (event.currentTarget as HTMLElement | null)?.focus();
          }}
          // The button is not a Radix trigger, so focus is handed back here.
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            triggerRef.current?.focus();
          }}
        >
          <DialogHeader className="pr-10">
            <DialogTitle className="font-serif text-base">{title}</DialogTitle>
            <DialogDescription className="text-xs">
              Trailer from YouTube.{' '}
              <a
                href={watchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-foreground"
              >
                Open on YouTube
                <ExternalLink className="h-3 w-3" />
              </a>
            </DialogDescription>
          </DialogHeader>
          {open ? (
            <div className="aspect-video w-full overflow-hidden rounded-xl bg-black">
              <iframe
                src={embedUrl}
                title={`Trailer: ${title}`}
                className="h-full w-full border-0"
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
                // YouTube refuses to play an embed that sends no referrer.
                referrerPolicy="strict-origin-when-cross-origin"
                sandbox="allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox"
              />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
