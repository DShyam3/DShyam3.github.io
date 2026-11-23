import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';

/** A lazy page's file that did not arrive, in Chrome's, Safari's or Firefox's words, or Vite's. */
const LOAD_FAILURE = /dynamically imported module|importing a module script failed|unable to preload css/i;

export const isLoadFailure = (error: unknown): boolean =>
  error instanceof Error && LOAD_FAILURE.test(error.message);

interface BoundaryProps {
  /** The route the failure belongs to; a new one clears it. */
  resetKey: string;
  children: ReactNode;
}

interface BoundaryState {
  failed: boolean;
  /** Whether the page's file failed to arrive, rather than the page failing to render. */
  loadFailure: boolean;
  resetKey: string;
}

/**
 * Catches a page that fails to render, so the site shows why instead of a
 * blank screen. The usual cause is a lazy page whose file did not load:
 * offline, or a deploy still reaching the CDN. (A deploy that replaced the
 * file reloads the tab on its own, see `installStaleChunkReload`.) React keeps
 * a lazy import's failure, so trying again in place would fail the same way;
 * the button reloads the page instead. Opening another page clears the error.
 *
 * The fallback is plain markup that reads no page's context. Inside AppShell
 * it would also draw the inspector, whose docked content can belong to the
 * page that failed (a Watchlist detail needs WatchlistProvider), and a second
 * throw from a fallback goes past every boundary to a blank page.
 *
 * Finance has its own boundaries (`FinanceSession`), which keep a finance
 * failure inside Finance.
 */
export class RouteErrorBoundaryInner extends Component<BoundaryProps, BoundaryState> {
  constructor(props: BoundaryProps) {
    super(props);
    this.state = { failed: false, loadFailure: false, resetKey: props.resetKey };
  }

  static getDerivedStateFromError(error: unknown): Partial<BoundaryState> {
    return { failed: true, loadFailure: isLoadFailure(error) };
  }

  // Never call setState in this class: the reset relies on derived state
  // being the only writer besides getDerivedStateFromError.
  static getDerivedStateFromProps(props: BoundaryProps, state: BoundaryState): Partial<BoundaryState> | null {
    return props.resetKey === state.resetKey ? null : { failed: false, loadFailure: false, resetKey: props.resetKey };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Could not display page:', error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    const { loadFailure, resetKey } = this.state;
    return (
      <main className="min-h-[100dvh] bg-background flex items-center justify-center px-6">
        <div role="alert" className="flex max-w-md flex-col items-center gap-3 text-center text-sm font-sans">
          <h1 className="font-semibold">{loadFailure ? 'This page could not load.' : 'This page ran into a problem.'}</h1>
          <p className="text-muted-foreground">
            {loadFailure ? 'Check your connection, then reload the page.' : 'Reload the page to try again.'}
          </p>
          <div className="flex flex-wrap justify-center gap-2 pt-3">
            <Button variant="outline" onClick={() => window.location.reload()}>Reload page</Button>
            {resetKey !== '/' && (
              <Button variant="ghost" asChild>
                <Link to="/">Back to home</Link>
              </Button>
            )}
          </div>
        </div>
      </main>
    );
  }
}

/** `RouteErrorBoundaryInner`, cleared whenever the path changes. */
export function RouteErrorBoundary({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  return <RouteErrorBoundaryInner resetKey={pathname}>{children}</RouteErrorBoundaryInner>;
}
