import { describe, expect, it } from 'vitest';
import { RouteErrorBoundaryInner, isLoadFailure } from './RouteErrorBoundary';

const props = (resetKey: string) => ({ resetKey, children: null });

describe('isLoadFailure', () => {
  it('knows a lazy page file that did not arrive, in each browser’s words', () => {
    expect(isLoadFailure(new TypeError('Failed to fetch dynamically imported module: https://x/assets/Dev-B.js'))).toBe(true);
    expect(isLoadFailure(new TypeError('Importing a module script failed.'))).toBe(true);
    expect(isLoadFailure(new TypeError('error loading dynamically imported module: https://x/assets/Dev-B.js'))).toBe(true);
    expect(isLoadFailure(new Error('Unable to preload CSS for /assets/Dev-B.css'))).toBe(true);
  });

  it('does not take a render bug for one', () => {
    expect(isLoadFailure(new TypeError("Cannot read properties of null (reading 'title')"))).toBe(false);
    expect(isLoadFailure('Failed to fetch dynamically imported module')).toBe(false);
  });
});

describe('RouteErrorBoundaryInner', () => {
  it('fails on an error thrown below it, and says which kind', () => {
    expect(RouteErrorBoundaryInner.getDerivedStateFromError(new TypeError('Importing a module script failed.')))
      .toEqual({ failed: true, loadFailure: true });
    expect(RouteErrorBoundaryInner.getDerivedStateFromError(new TypeError('x is undefined')))
      .toEqual({ failed: true, loadFailure: false });
  });

  it('keeps the failure while the path stays the same, and clears it on a new one', () => {
    const failed = { failed: true, loadFailure: true, resetKey: '/dev' };
    expect(RouteErrorBoundaryInner.getDerivedStateFromProps(props('/dev'), failed)).toBeNull();
    expect(RouteErrorBoundaryInner.getDerivedStateFromProps(props('/'), failed))
      .toEqual({ failed: false, loadFailure: false, resetKey: '/' });
  });
});
