import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';

/** The largest share of the middle card a pinned toolbar may take. */
const PIN_MAX_SHARE = 0.25;

interface AppShellProps {
  /** Omitted on the About page, which uses Header's own defaults. */
  title?: string;
  subtitle?: string;
  children: ReactNode;
  /**
   * `content` (the default): the middle card is the one vertical scroller.
   * `workspace`: where both width and height allow, the card stops scrolling
   * and the page's own panes scroll instead -- Travel's map beside its list.
   * Below that size a workspace falls back to content, so a stacked layout
   * always has somewhere to scroll.
   */
  layout?: 'content' | 'workspace';
  /**
   * Section controls, e.g. a filter bar. They open the middle card and pin to
   * its top where there is room for them; elsewhere they scroll away with it.
   */
  toolbar?: ReactNode;
}

/**
 * The site's frame: header and footer stay put, and every route's content
 * sits in one middle card between them that owns the scrolling.
 */
export function AppShell({
  title,
  subtitle,
  children,
  layout = 'content',
  toolbar,
}: AppShellProps) {
  const { pathname } = useLocation();
  const section = pathname.split('/')[1] || 'about';
  const mainRef = useRef<HTMLElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const hasToolbar = Boolean(toolbar);

  // Whether the toolbar pins depends on how its controls wrap, which CSS
  // cannot read: four rows of filters on a tablet would take a third of the
  // card. Pin it only from 768px and only while it takes at most a quarter of
  // the card, and publish both heights so sticky panes and scroll padding
  // clear the band instead of guessing at it.
  useLayoutEffect(() => {
    const main = mainRef.current;
    if (!main) return;
    const toolbarEl = toolbarRef.current;
    const wide = window.matchMedia?.('(min-width: 768px)');
    const publish = () => {
      const toolbarHeight = toolbarEl?.offsetHeight ?? 0;
      const pinned = Boolean(toolbarEl && wide?.matches && toolbarHeight <= main.clientHeight * PIN_MAX_SHARE);
      main.dataset.toolbarPin = pinned ? 'on' : 'off';
      main.style.setProperty('--frame-h', `${main.clientHeight}px`);
      main.style.setProperty('--toolbar-h', `${pinned ? toolbarHeight : 0}px`);
    };
    publish();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(publish);
    observer.observe(main);
    if (toolbarEl) observer.observe(toolbarEl);
    return () => observer.disconnect();
  }, [hasToolbar]);

  return (
    <div
      data-section={section}
      className="app-shell h-[100dvh] flex flex-col bg-background overflow-clip"
    >
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-3 focus:rounded focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:ring-2 focus:ring-foreground"
      >
        Skip to content
      </a>

      <div className="shrink-0 wide-container relative z-40 bg-background">
        <Header title={title} subtitle={subtitle} />
      </div>

      <div className="app-frame-slot flex-1 min-h-0 flex flex-col">
        <main
          ref={mainRef}
          id="main"
          tabIndex={-1}
          data-layout={layout}
          className="app-frame app-scroll flex-1 min-h-0 min-w-0 overflow-y-auto"
        >
          {toolbar ? <div ref={toolbarRef} className="app-toolbar">{toolbar}</div> : null}
          {/* Skip to content lands here, past the section's own controls. */}
          <span id="content" tabIndex={-1} className="block outline-none" />
          {children}
        </main>
      </div>

      <div className="shrink-0 wide-container relative z-30 bg-background">
        <Footer />
      </div>
    </div>
  );
}
