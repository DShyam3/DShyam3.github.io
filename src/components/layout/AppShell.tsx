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
   * else scrolls its middle.
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
 */
export function AppShell({
  title,
  subtitle,
  children,
  scrollable = true,
  toolbar,
}: AppShellProps) {
  return (
    // Phones get an ordinary scrolling document. The pinned shell divides a
    // viewport between chrome and content, and on a phone the chrome alone is
    // taller than the screen -- the grid was left a ~30px slot and the page
    // was unusable. The shell is a desktop and tablet idea, so it starts at md.
    <div className="min-h-[100dvh] md:h-[100dvh] flex flex-col bg-background md:overflow-hidden">
      <div className="md:shrink-0 wide-container">
        <Header title={title} subtitle={subtitle} />
        {toolbar}
      </div>

      <main
        className={cn(
          'md:flex-1 md:min-h-0 wide-container',
          scrollable
            ? 'app-scroll md:overflow-y-auto'
            : 'md:overflow-hidden md:flex md:flex-col',
        )}
      >
        {children}
      </main>

      <div className="md:shrink-0 wide-container">
        <Footer />
      </div>
    </div>
  );
}
