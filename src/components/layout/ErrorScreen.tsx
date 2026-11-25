import { useEffect, useRef, type ReactNode } from 'react';

/**
 * An error boundary's whole-screen fallback: what went wrong and the way out.
 *
 * Plain markup that reads no context, on purpose. Inside AppShell it would
 * also draw the inspector, whose docked content can belong to what failed (a
 * Watchlist detail needs WatchlistProvider), and a second throw from a
 * fallback goes past every boundary to a blank page.
 *
 * The title takes focus when it appears: the control that had it has gone,
 * and focus would otherwise fall to the page itself.
 */
export function ErrorScreen({ title, message, children }: {
  title: string;
  message: string;
  /** The buttons. */
  children: ReactNode;
}) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    titleRef.current?.focus({ preventScroll: true });
  }, []);
  return (
    <main className="min-h-[100dvh] bg-background flex items-center justify-center px-6">
      <div className="flex max-w-md flex-col items-center gap-3 text-center text-sm font-sans">
        <div role="alert" className="space-y-3">
          <h1 ref={titleRef} tabIndex={-1} className="font-semibold">{title}</h1>
          <p className="text-muted-foreground">{message}</p>
        </div>
        <div className="flex flex-wrap justify-center gap-2 pt-3">{children}</div>
      </div>
    </main>
  );
}
