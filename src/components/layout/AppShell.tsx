import type { ReactNode } from 'react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { cn } from '@/lib/utils';

interface AppShellProps {
  /** Omitted on the About page, which uses Header's own defaults. */
  title?: string;
  subtitle?: string;
  children: ReactNode;
  /**
   * False for pages that size themselves to the viewport and must never
   * scroll -- Travel, whose globe fills the space it is given. Everything
   * else scrolls its middle. Below md even these scroll, because the layout
   * stacks there and no longer fits what the shell can give it.
   */
  scrollable?: boolean;
  /** Rendered between the header and the scroll area, e.g. a filter bar. */
  toolbar?: ReactNode;
}

/**
 * The site's frame: header pinned to the top, footer pinned to the bottom,
 * and only the middle moving.
 *
 * Pages used to be `min-h-screen` with the header and footer inside the flow,
 * so both scrolled away and the site read as a long document rather than an
 * application. Here the shell owns the viewport and hands the page whatever
 * is left.
 *
 * A toolbar can sit outside the scroll area, so filters and counts stay put
 * while their results scroll underneath.
 *
 * The `<main>` element is the scroll container, which CardGrid measures
 * itself against to keep two rows of cards above the fold.
 */
export function AppShell({
  title,
  subtitle,
  children,
  scrollable = true,
  toolbar,
}: AppShellProps) {
  return (
    // The shell is exactly one viewport tall at every width, and `clip` --
    // not `hidden` -- is what keeps it that way. An `overflow: hidden` box is
    // still a scroll container: nothing drags it, but anything that calls
    // `scrollIntoView` on a descendant scrolls it, which is how the frame
    // came adrift on a tablet with no scrollbar in sight. `clip` makes no
    // scroll container at all, so there is nothing left to move.
    //
    // Phones were an ordinary scrolling document until now, back when the
    // chrome was a header, a footer and a thirteen-link nav strip and left
    // the grid a ~30px slot. The strip is a menu button today, so the chrome
    // fits and the phone gets the same frame as everything else.
    <div className="h-[100dvh] flex flex-col bg-background overflow-clip">
      {/* Thirteen nav links sit before the content on every page, so a
          keyboard user would otherwise tab through all of them on each one.
          Off-screen until focused, which is the point: it is for the people
          who will find it, not for everyone. */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-3 focus:rounded focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:ring-2 focus:ring-foreground"
      >
        Skip to content
      </a>

      <div className="shrink-0 wide-container">
        <Header title={title} subtitle={subtitle} />
        {/* Wrapped so a short viewport has something to cap: a filter bar is
            the one piece of chrome that can be taller than the content it
            filters. See `.app-toolbar` in src/index.css. */}
        {toolbar ? <div className="app-toolbar app-scroll">{toolbar}</div> : null}
      </div>

      <main
        id="main"
        tabIndex={-1}
        className={cn(
          'app-scroll flex-1 min-h-0 wide-container',
          // A page that sizes itself to the viewport still needs somewhere to
          // put its overflow on a phone, where the slice is half the height
          // and the layout stacks. It gets a scroller below md and its own
          // fixed frame above it.
          scrollable
            ? 'overflow-y-auto'
            : 'overflow-y-auto md:overflow-hidden md:flex md:flex-col',
        )}
      >
        {children}
      </main>

      <div className="shrink-0 wide-container">
        <Footer />
      </div>
    </div>
  );
}
