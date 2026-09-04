import { DotMatrixText } from '@/components/dot-matrix/DotMatrixText';
import { cn } from '@/lib/utils';

interface CountLabelProps {
  /** How many things. Pass undefined while the query is still running. */
  count?: number;
  /** Shown after the number, e.g. "items". Already plural-correct. */
  noun?: string;
  className?: string;
}

/**
 * The "59 items" line that sits above every grid.
 *
 * It reads as a label rather than prose, so it is set in the dot-matrix face
 * like the category nav above it instead of the body font. One component
 * because the same line appears on every collection page and on Watchlist,
 * and they drifted apart when each page wrote its own <p>.
 */
export function CountLabel({ count, noun, className }: CountLabelProps) {
  return (
    <DotMatrixText
      text={count === undefined ? '...' : `${count} ${noun ?? ''}`.trim()}
      size="xs"
      wrap={false}
      className={cn('text-muted-foreground', className)}
    />
  );
}
