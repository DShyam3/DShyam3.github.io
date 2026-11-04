import {
  Component,
  createContext,
  lazy,
  Suspense,
  useContext,
  useEffect,
  useState,
  type ErrorInfo,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { AppShell } from '@/components/layout/AppShell';
import { PageLoader } from '@/components/layout/PageLoader';
import { Button } from '@/components/ui/button';
import { prefersSavedData, whenIdle } from '@/lib/idle';

const loadFinanceHost = () => lazy(() => import('./FinancePage'));

/** How the /finance route hands its mount point up to the session. */
const FinanceSlotContext = createContext<(target: HTMLElement | null) => void>(() => {});

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
  const retry = () => setHost(h => ({ attempt: h.attempt + 1, FinanceHost: loadFinanceHost() }));
  const { attempt, FinanceHost } = host;

  useEffect(() => {
    if (!isAdmin || prefersSavedData()) return;
    return whenIdle(() => setRequested(true));
  }, [isAdmin]);

  useEffect(() => {
    if (target) setRequested(true);
  }, [target]);

  const hosted = isAdmin && (requested || target !== null);

  return (
    <FinanceSlotContext.Provider value={setTarget}>
      {children}
      {hosted && (
        <FinanceHostBoundary key={attempt} target={target} onRetry={retry}>
          <Suspense fallback={target ? createPortal(<PageLoader />, target) : null}>
            <FinanceHost target={target} />
          </Suspense>
        </FinanceHostBoundary>
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
 */
class FinanceHostBoundary extends Component<
  { target: HTMLElement | null; onRetry: () => void; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Could not load finance:', error, info.componentStack);
  }

  componentDidUpdate(prev: { target: HTMLElement | null }) {
    if (this.state.failed && !prev.target && this.props.target) this.props.onRetry();
  }

  render() {
    if (!this.state.failed) return this.props.children;
    const { target, onRetry } = this.props;
    if (!target) return null;
    return createPortal(
      <AppShell title="Finance" subtitle="Income & tax">
        <div role="alert" className="py-16 text-center text-sm font-sans space-y-3">
          <p className="font-semibold">Finance could not load.</p>
          <p className="text-muted-foreground">Check your connection and try again. Your saved records are unchanged.</p>
          <Button variant="outline" onClick={onRetry}>Try again</Button>
        </div>
      </AppShell>,
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
