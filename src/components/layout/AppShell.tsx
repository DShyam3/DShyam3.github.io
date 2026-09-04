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
    <div className="h-[100dvh] flex flex-col bg-background overflow-hidden">
      <div className="shrink-0 wide-container">
        <Header title={title} subtitle={subtitle} />
        {toolbar}
      </div>

      <main
        className={cn(
          'flex-1 min-h-0 wide-container',
          scrollable ? 'overflow-y-auto app-scroll' : 'overflow-hidden flex flex-col',
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
