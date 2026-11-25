import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ErrorScreen } from './ErrorScreen';

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
 * The fallback is `ErrorScreen`, plain markup that reads no page's context.
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
      <ErrorScreen
        title={loadFailure ? 'This page could not load.' : 'This page ran into a problem.'}
        message={loadFailure ? 'Check your connection, then reload the page.' : 'Reload the page to try again.'}
      >
        <Button variant="outline" onClick={() => window.location.reload()}>Reload page</Button>
        {resetKey !== '/' && (
          <Button variant="ghost" asChild>
            <Link to="/">Back to home</Link>
          </Button>
        )}
      </ErrorScreen>
    );
  }
}

/** `RouteErrorBoundaryInner`, cleared whenever the path changes. */
export function RouteErrorBoundary({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  return <RouteErrorBoundaryInner resetKey={pathname}>{children}</RouteErrorBoundaryInner>;
}
