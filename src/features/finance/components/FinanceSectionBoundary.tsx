import { Component, useEffect, useState, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { isLoadFailure } from '@/components/layout/RouteErrorBoundary';

/** Module loading is separate from database loading; neither may hide a failure forever. */
export function FinanceSectionLoading() {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), 15_000);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div role="status" className="py-16 text-center text-sm font-sans space-y-3">
      <p className="text-muted-foreground">{slow ? 'This section is taking too long to load.' : 'Loading section…'}</p>
      {slow && <Button variant="outline" onClick={() => window.location.reload()}>Reload page</Button>}
    </div>
  );
}

export class FinanceSectionBoundary extends Component<{ children: ReactNode }, { failed: boolean; loadFailure: boolean }> {
  state = { failed: false, loadFailure: false };

  static getDerivedStateFromError(error: unknown) {
    return { failed: true, loadFailure: isLoadFailure(error) };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Could not display finance section:', error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" className="py-16 text-center text-sm font-sans space-y-3">
        <p className="font-semibold">{this.state.loadFailure ? 'This finance section could not load.' : 'This finance section ran into a problem.'}</p>
        <p className="text-muted-foreground">Reload the page to try again. Your saved records are unchanged.</p>
        <Button variant="outline" onClick={() => window.location.reload()}>Reload page</Button>
      </div>
    );
  }
}
