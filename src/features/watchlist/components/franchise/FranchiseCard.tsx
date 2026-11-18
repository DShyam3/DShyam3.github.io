import { useId, type ReactNode } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Poster } from './EntryList';

export interface StripItem {
  key: string;
  poster: string | null;
  mediaType: 'movie' | 'tv';
  watched: boolean;
}

/**
 * One card for a saved order or a series from the library: name, a one-line
 * summary, what is next, a poster strip with a tick on what is watched, and a
 * body that opens beneath. The strip is decoration -- the summary says the same
 * in words.
 */
export function FranchiseCard({
  name,
  summary,
  nextUp,
  strip,
  open,
  onToggle,
  children,
}: {
  name: string;
  summary: string;
  nextUp?: string | null;
  strip: StripItem[];
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const bodyId = useId();
  return (
    <Card className="min-w-0 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={bodyId}
        className="flex w-full items-start gap-3 p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <span className="min-w-0 flex-1 space-y-1.5">
          <span className="block break-words font-serif text-lg font-medium leading-snug">{name}</span>
          <span className="block text-sm text-muted-foreground">{summary}</span>
          {nextUp && <span className="block break-words text-sm">Next up: {nextUp}</span>}
          {strip.length > 0 && (
            <span className="flex gap-1 overflow-hidden pt-1" aria-hidden="true">
              {strip.slice(0, 14).map((item) => (
                <span key={item.key} className="relative shrink-0">
                  <Poster src={item.poster} mediaType={item.mediaType} className="w-9" />
                  {item.watched && (
                    <span className="absolute bottom-0.5 right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Check className="h-3 w-3" />
                    </span>
                  )}
                </span>
              ))}
            </span>
          )}
        </span>
        <ChevronDown className={cn('mt-1 h-5 w-5 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} aria-hidden="true" />
      </button>
      <div id={bodyId} hidden={!open} className="space-y-3 border-t border-border/50 px-4 pb-4 pt-3">
        {open && children}
      </div>
    </Card>
  );
}
