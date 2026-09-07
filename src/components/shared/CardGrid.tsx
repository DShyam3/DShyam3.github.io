import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { CARD_GRID } from '@/theme/layout';

/**
 * The shell is pinned at every width now, but fitting the cards to the slice
 * it leaves is only worth it above this: a phone's slice is half a viewport
 * and the cards it would have to draw to fill it are too small to read. Below
 * it they keep their natural size and `<main>` scrolls past them.
 */
const FIT_TO_SLICE = '(min-width: 768px)';

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
 * Publishes `--card-fit`: the widest a card can be and still leave a whole
 * number of rows above the fold. `.card-grid` caps the card at it -- see the
 * comment there.
 *
 *   fit(rows) = ((available - (rows + 1) * gap) / rows - text) * aspect
 *
 * Two rows is what we want, one row is the fallback, and the floor is what
 * is left. A window can be short enough that two rows will not fit however
 * small the cards get -- a half-height window on a wide monitor -- and there
 * the old behaviour was to give up and size on width alone, which drew cards
 * so tall the footer cut through the middle of the first one. Sizing to
 * whatever does fit is the honest answer to that screen.
 *
 * The sum is here rather than in the stylesheet because the space available
 * cannot be expressed in CSS: the header, the filter bar, the count row and,
 * on the watchlist, a whole set of category tabs sit between the top of the
 * scroll area and the first card, and each changes height with the viewport.
 *
 * Every grid on the page measures from the FIRST grid's offset, not its own.
 * A grouped collection is several grids -- one per section -- and sizing each
 * to the space left under its own heading gave one page several answers:
 * Inventory's "Compute" drew 220px cards and "General Homelab", starting
 * lower, drew 152px ones, with the titles clipped in the second and not the
 * first. A card is a card; the wall should not change gauge halfway down.
 * Measuring them all from the top grid also makes the answer independent of
 * how tall the sections above happen to be, so it does not shift as items
 * are added.
 *
 * If even the first grid's sliver holds no whole row, the whole scroll area
 * is used instead -- by the time you have scrolled to a wall, it IS the wall
 * you can see.
 *
 * Only while the shell is pinned. Below md the middle is not a fixed slice of
 * the viewport but a column as tall as its contents, so measuring it and then
 * sizing its children from the measurement is a feedback loop: bigger cards
 * make a taller column makes bigger cards.
 */
/** What the sum comes back with: how wide a card may be, and which of the two
 *  text blocks that width was solved for. */
interface Answer {
  width: number;
  compact: boolean;
}

function useCardGridFit(ref: React.RefObject<HTMLDivElement>) {
  // The last answer written, so a resize that lands on the same one does not
  // touch the DOM.
  const published = useRef<Answer | null>(null);

  useEffect(() => {
    const grid = ref.current;
    if (!grid) return;

    const scroller = grid.closest('main');
    if (!scroller) return;

    const media = window.matchMedia(FIT_TO_SLICE);

    const clear = () => {
      if (published.current === null) return;
      grid.style.removeProperty('--card-fit');
      delete grid.dataset.cardBody;
      published.current = null;
    };

    const publish = () => {
      if (!media.matches) {
        clear();
        return;
      }

      const slice = scroller.clientHeight;
      // The top grid on the page sets the gauge for all of them.
      const lead = scroller.querySelector(`.${CARD_GRID}`) ?? grid;
      const offset =
        lead.getBoundingClientRect().top -
        scroller.getBoundingClientRect().top +
        scroller.scrollTop;
      const sliver = offset < slice ? slice - offset : slice;

      // Read with --card-fit removed, so the gap and the aspect are this
      // grid's own values and not ones derived from the last answer.
      const style = getComputedStyle(grid);
      const rootPx = parseFloat(getComputedStyle(document.documentElement).fontSize);
      const gap = parseFloat(style.rowGap) || 0;
      const columnGap = parseFloat(style.columnGap) || gap;
      const text = lengthOf(style, '--card-text-h', rootPx);
      const compactText = lengthOf(style, '--card-text-h-compact', rootPx) || text;
      const floor = lengthOf(style, '--card-floor', rootPx);
      const [width, height] = style
        .getPropertyValue('--card-aspect')
        .split('/')
        .map((part) => parseFloat(part));
      const aspect = width && height ? width / height : 2 / 3;

      // How many cards the wall actually holds, across every grid on the page
      // -- a grouped collection is several grids and the wall is all of them.
      const cards = [...scroller.querySelectorAll(`.${CARD_GRID}`)].reduce(
        (total, one) => total + one.childElementCount,
        0,
      );
      // Whether a second row is worth sizing for. Shrinking the cards to fit
      // two rows of a wall that only has one row of items buys nothing and
      // costs a lot: four books drew 135px covers under 400px of empty page
      // where they could have drawn 313px ones.
      const worthTwoRows = (width: number) => {
        const columns = Math.max(1, Math.floor((grid.clientWidth + columnGap) / (width + columnGap)));
        return cards > columns;
      };

      // Two rows if they can be had at a size worth looking at, one if not,
      // and the floor if even one row will not fit -- on a window that short
      // nothing is going to be whole, and the smallest card is the one that
      // leaves the least of itself under the fold.
      const fitIn = (space: number): Answer | undefined => {
        const widthFor = (rows: number, block: number) =>
          Math.floor(((space - gap * (rows + 1)) / rows - block) * aspect);
        // Two answers per row count, because the card has two text blocks:
        // the full one and the compact body -- see [data-card-body] in
        // src/index.css. The full block is tried first and kept whenever it
        // clears the floor: the compact body drops a line the card is better
        // off keeping when there is room for it. Only when the full block
        // leaves nothing worth looking at -- a laptop, where two rows of
        // full-bodied cards want an 88px poster -- is the shorter block worth
        // the line it costs.
        const answerFor = (rows: number): Answer => {
          const full = widthFor(rows, text);
          if (full >= floor) return { width: full, compact: false };
          return { width: widthFor(rows, compactText), compact: true };
        };
        return [2, 1]
          .map(answerFor)
          .find(
            (answer, index) =>
              answer.width >= floor && (index === 1 || worthTwoRows(answer.width)),
          );
      };
      // The sliver first, the whole slice when nothing whole fits in it.
      const answer = fitIn(sliver) ?? fitIn(slice) ?? { width: floor, compact: true };

      if (answer.width === published.current?.width && answer.compact === published.current?.compact)
        return;
      published.current = answer;
      grid.style.setProperty('--card-fit', `${answer.width}px`);
      if (answer.compact) grid.dataset.cardBody = 'compact';
      else delete grid.dataset.cardBody;
    };

    // The scroller's height settles a frame after a resize on some layouts --
    // the header and the toolbar above it are still reflowing when the
    // observer first fires -- so every trigger measures again on the next
    // frame and keeps the later answer.
    let queued = 0;
    const schedule = () => {
      cancelAnimationFrame(queued);
      publish();
      queued = requestAnimationFrame(publish);
    };

    // The scroller gives the slice; the grid gives its own offset, and that
    // moves without the scroller ever resizing -- the display font arriving
    // grows every label in the toolbar above it, which on a fresh page load
    // is the difference between two rows and one. Watching the grid is safe
    // even though the callback writes to it: the answer depends on where the
    // grid starts, never on how tall it is, so a write can only provoke one
    // further measurement that agrees with the last and stops.
    const observer = new ResizeObserver(schedule);
    observer.observe(scroller);
    observer.observe(grid);
    const lead = scroller.querySelector(`.${CARD_GRID}`);
    if (lead && lead !== grid) observer.observe(lead);
    window.addEventListener('resize', schedule);
    media.addEventListener('change', schedule);
    document.fonts?.ready.then(schedule).catch(() => {});
    schedule();

    return () => {
      cancelAnimationFrame(queued);
      observer.disconnect();
      window.removeEventListener('resize', schedule);
      media.removeEventListener('change', schedule);
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
