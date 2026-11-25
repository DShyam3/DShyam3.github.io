import {
  Component,
  createContext,
  lazy,
  Suspense,
  useContext,
  useEffect,
  useRef,
  useState,
  type ErrorInfo,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { ErrorScreen } from '@/components/layout/ErrorScreen';
import { PageLoader } from '@/components/layout/PageLoader';
import { isLoadFailure } from '@/components/layout/RouteErrorBoundary';
import { Button } from '@/components/ui/button';
import { hasWritesInFlight, writesSettled } from '@/integrations/supabase/write-tracking-fetch';
import { prefersSavedData, whenIdle } from '@/lib/idle';

const loadFinanceHost = () => lazy(() => import('./FinancePage'));

/** How the /finance route hands its mount point up to the session. */
const FinanceSlotContext = createContext<(target: HTMLElement | null) => void>(() => {});

/** The active /finance DOM mount point, read inside FinancePortal so FinanceDataProvider never re-renders on route changes. */
const FinanceTargetContext = createContext<HTMLElement | null>(null);

export function useFinanceTarget(): HTMLElement | null {
  return useContext(FinanceTargetContext);
}

/**
 * Holds the finance data for the admin's whole session, not for one visit.
 *
 * `FinanceDataProvider` used to live inside the /finance route, so leaving the
 * page threw away some thirty tables and coming back read them all again.
 * Here it is mounted beside the routes instead: on idle from whichever page
 * the admin opened first, or at once if that page is Finance. The page's view
 * renders into the route through a portal, so it still mounts and unmounts
 * with the route while the provider -- its rows, load generations and pending
 * saves -- carries on underneath.
 *
 * Admin-only, like everything the provider reads: for anyone else nothing is
 * loaded, and signing out unmounts it, which drops the rows with it.
 */
export function FinanceSession({ children }: { children: ReactNode }) {
  const { isAdmin } = useAuth();
  const [target, setTarget] = useState<HTMLElement | null>(null);
  // Sticky once set: leaving /finance must not unmount the provider, even
  // when the page was opened before the idle warm-up got round to it.
  const [requested, setRequested] = useState(false);
  // A failed chunk import stays failed inside one lazy(), so a retry builds a
  // fresh one; the boundary is keyed on the attempt to reset with it.
  const [host, setHost] = useState(() => ({ attempt: 0, FinanceHost: loadFinanceHost() }));
  // The failed host's writes may still be in flight, and most skip its save
  // queue (FinanceDataContext). A fresh host reading before they land would
  // show the rows from before them, so it mounts once they have; until then
  // the boundary shows the loader. With none in flight it mounts at once, in
  // the same commit, so an automatic retry never paints the error.
  const [waiting, setWaiting] = useState(false);
  const waitingRef = useRef(false);
  const remount = () => setHost(h => ({ attempt: h.attempt + 1, FinanceHost: loadFinanceHost() }));
  const retry = () => {
    if (waitingRef.current) return;
    if (!hasWritesInFlight('finance_')) {
      remount();
      return;
    }
    waitingRef.current = true;
    setWaiting(true);
    void writesSettled('finance_').then(() => {
      waitingRef.current = false;
      setWaiting(false);
      remount();
    });
  };
  const { attempt, FinanceHost } = host;

  useEffect(() => {
    if (!isAdmin || prefersSavedData()) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const cancelIdle = whenIdle(() => {
      // Wait briefly past the first idle tick so the visible page (e.g. Watchlist
      // or Home) finishes its own stage-1 reads before Finance's ledger loads.
      timer = setTimeout(() => setRequested(true), 2_500);
    });
    return () => {
      cancelIdle();
      if (timer !== null) clearTimeout(timer);
    };
  }, [isAdmin]);

  useEffect(() => {
    if (target) setRequested(true);
  }, [target]);

  const hosted = isAdmin && (requested || target !== null);

  return (
    <FinanceSlotContext.Provider value={setTarget}>
      {children}
      {hosted && (
        <FinanceTargetContext.Provider value={target}>
          <FinanceHostBoundary key={attempt} target={target} waiting={waiting} onRetry={retry}>
            <Suspense fallback={target ? createPortal(<PageLoader />, target) : null}>
              <FinanceHost />
            </Suspense>
          </FinanceHostBoundary>
        </FinanceTargetContext.Provider>
      )}
    </FinanceSlotContext.Provider>
  );
}

/**
 * Keeps a finance failure inside Finance.
 *
 * The host is mounted beside every route, so without this a failed chunk
 * import on an idle warm-up -- a dropped connection, a deploy that replaced
 * the chunk -- would unmount the whole app on whatever page the admin was
 * reading. Away from /finance it renders nothing; on it, the error and a
 * retry. Opening /finance after a failure retries on its own.
 *
 * The error is an `ErrorScreen`, not AppShell: this boundary sits above every
 * route, so a second throw from its fallback would blank the whole site.
 */
class FinanceHostBoundary extends Component<
  {
    target: HTMLElement | null;
    /** A retry is waiting for the failed host's writes to land. */
    waiting: boolean;
    onRetry: () => void;
    children: ReactNode;
  },
  { failed: boolean; loadFailure: boolean }
> {
  state = { failed: false, loadFailure: false };

  static getDerivedStateFromError(error: unknown) {
    return { failed: true, loadFailure: isLoadFailure(error) };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Could not load finance:', error, info.componentStack);
  }

  componentDidUpdate(prev: { target: HTMLElement | null }) {
    if (this.state.failed && !prev.target && this.props.target) this.props.onRetry();
  }

  render() {
    if (!this.state.failed) return this.props.children;
    const { target, waiting, onRetry } = this.props;
    if (!target) return null;
    if (waiting) return createPortal(<PageLoader />, target);
    const { loadFailure } = this.state;
    return createPortal(
      <ErrorScreen
        title={loadFailure ? 'Finance could not load.' : 'Finance ran into a problem.'}
        message={`${loadFailure ? 'Check your connection and try again.' : 'Try again, or reload the page.'} Your saved records are unchanged.`}
      >
        <Button variant="outline" onClick={onRetry}>Try again</Button>
        <Button variant="ghost" asChild>
          <Link to="/">Back to home</Link>
        </Button>
      </ErrorScreen>,
      target,
    );
  }
}

/**
 * The /finance route element: an empty mount point the session's finance view
 * renders into. `display: contents` so the view lays out as if it were the
 * route element itself.
 */
export function FinanceRoute() {
  const { isAdmin, isAuthLoading } = useAuth();
  const setTarget = useContext(FinanceSlotContext);

  // Keep deep links intact while Supabase restores the saved session, and
  // redirect only once it has been resolved.
  if (isAuthLoading) return <PageLoader />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return <div ref={setTarget} className="contents" />;
}
