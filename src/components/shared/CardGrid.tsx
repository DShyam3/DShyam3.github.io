import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { CARD_GRID } from '@/theme/layout';

/** Below this the shell is an ordinary scrolling document -- see AppShell. */
const PINNED_SHELL = '(min-width: 768px)';

/**
 * Publishes the height the grid actually has to play with as `--card-avail-h`,
 * which `.card-grid` in src/index.css turns into a card width -- see the
 * comment there for the arithmetic.
 *
 * It has to be measured rather than written in CSS because the space above a
 * grid is not knowable from a stylesheet: the header, the filter bar, the
 * count row and, on the watchlist, a whole set of category tabs all sit
 * between the top of the scroll area and the first card, and each of them
 * changes height with the viewport.
 *
 * A grid that starts below the fold -- the second and later sections of a
 * grouped collection -- gets the full scroll area instead of the sliver left
 * beneath its own offset, which would otherwise shrink those sections to the
 * minimum card size. The rule is about the wall you can see, not every wall
 * on the page.
 *
 * Only while the shell is pinned. Below md the middle is not a fixed slice of
 * the viewport but a column as tall as its contents, so measuring it and then
 * sizing its children from the measurement is a feedback loop: bigger cards
 * make a taller column makes bigger cards.
 */
function useCardGridFit(ref: React.RefObject<HTMLDivElement>) {
  // The last value written, so a resize that rounds to the same pixel does
  // not touch the DOM.
  const published = useRef<number | null>(null);

  useEffect(() => {
    const grid = ref.current;
    if (!grid) return;

    const scroller = grid.closest('main');
    if (!scroller) return;

    const media = window.matchMedia(PINNED_SHELL);

    const publish = () => {
      if (!media.matches) {
        if (published.current !== null) {
          grid.style.removeProperty('--card-avail-h');
          published.current = null;
        }
        return;
      }

      const slice = scroller.clientHeight;
      const offset =
        grid.getBoundingClientRect().top -
        scroller.getBoundingClientRect().top +
        scroller.scrollTop;
      const available = offset < slice ? slice - offset : slice;

      const height = Math.round(available);
      if (height === published.current) return;
      published.current = height;
      grid.style.setProperty('--card-avail-h', `${height}px`);
    };

    // The scroller for the slice, the grid for its own offset -- the toolbar
    // above it reflows on its own (the watchlist's tabs wrap at some widths)
    // without the scroller changing size at all.
    const observer = new ResizeObserver(publish);
    observer.observe(scroller);
    observer.observe(grid);
    media.addEventListener('change', publish);
    publish();

    return () => {
      observer.disconnect();
      media.removeEventListener('change', publish);
    };
  }, [ref]);
}

interface CardGridProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/**
 * The wall of cards, on every page that has one. See `.card-grid` in
 * src/index.css for the shape and CARD_GRID in src/theme/layout.ts.
 */
export function CardGrid({ children, className, style }: CardGridProps) {
  const ref = useRef<HTMLDivElement>(null);
  useCardGridFit(ref);

  return (
    <div ref={ref} className={cn(CARD_GRID, className)} style={style}>
      {children}
    </div>
  );
}
