import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { CARD_GRID } from '@/theme/layout';

/** Below this the shell is an ordinary scrolling document -- see AppShell. */
const PINNED_SHELL = '(min-width: 768px)';

/**
 * Reads a length written on the grid as a CSS custom property. They are all
 * plain rem or px values -- see `.card-grid` in src/index.css -- because a
 * custom property comes back as the text it was written as, not as a resolved
 * length, so anything cleverer would have to be parsed here.
 */
function lengthOf(style: CSSStyleDeclaration, name: string, rootPx: number): number {
  const raw = style.getPropertyValue(name).trim();
  const value = parseFloat(raw);
  if (Number.isNaN(value)) return 0;
  return raw.endsWith('rem') ? value * rootPx : value;
}

/**
 * Publishes `--card-fit`: the card width whose two rows exactly fill the space
 * this grid has. `.card-grid` caps the card at it -- see the comment there.
 *
 *   fit = ((available - 2 * gap) / 2 - text) * aspect
 *
 * The sum is here rather than in the stylesheet for two reasons. The space
 * available cannot be expressed in CSS: the header, the filter bar, the count
 * row and, on the watchlist, a whole set of category tabs sit between the top
 * of the scroll area and the first card, and each changes height with the
 * viewport. And the answer is sometimes no answer at all -- when two readable
 * rows will not fit however small the cards get, the property is removed and
 * the grid goes back to sizing on width alone, because small cards and one
 * row is worse than big cards and one row.
 *
 * A grid that starts below the fold -- the second and later sections of a
 * grouped collection -- is measured against the whole scroll area rather than
 * the sliver left beneath its own offset. The rule is about the wall you can
 * see, not every wall on the page.
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

    const clear = () => {
      if (published.current === null) return;
      grid.style.removeProperty('--card-fit');
      published.current = null;
    };

    const publish = () => {
      if (!media.matches) {
        clear();
        return;
      }

      const slice = scroller.clientHeight;
      const offset =
        grid.getBoundingClientRect().top -
        scroller.getBoundingClientRect().top +
        scroller.scrollTop;
      const available = offset < slice ? slice - offset : slice;

      // Read with --card-fit removed, so the gap and the aspect are this
      // grid's own values and not ones derived from the last answer.
      const style = getComputedStyle(grid);
      const rootPx = parseFloat(getComputedStyle(document.documentElement).fontSize);
      const gap = parseFloat(style.rowGap) || 0;
      const text = lengthOf(style, '--card-text-h', rootPx);
      const floor = lengthOf(style, '--card-floor', rootPx);
      const [width, height] = style
        .getPropertyValue('--card-aspect')
        .split('/')
        .map((part) => parseFloat(part));
      const aspect = width && height ? width / height : 2 / 3;

      const fit = Math.floor(((available - gap * 2) / 2 - text) * aspect);
      if (fit < floor) {
        clear();
        return;
      }

      if (fit === published.current) return;
      published.current = fit;
      grid.style.setProperty('--card-fit', `${fit}px`);
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
