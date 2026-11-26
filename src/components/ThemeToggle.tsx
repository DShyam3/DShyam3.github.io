import { useEffect, useLayoutEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { DotMatrixIcon } from '@/components/dot-matrix/DotMatrixIcon';
import { markManualOverride } from '@/hooks/useTimeBasedTheme';

/** Both icons rise from the right and set to the left, clipped by the button. */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const night = resolvedTheme === 'dark';
  const sunRef = useRef<HTMLDivElement>(null);
  const moonRef = useRef<HTMLDivElement>(null);
  const previousTheme = useRef(resolvedTheme);
  const pageTransition = useRef<ViewTransition | null>(null);
  const requestedTheme = useRef<string | null>(null);

  useEffect(() => () => {
    pageTransition.current?.skipTransition();
  }, []);

  // Apply the starting pose before paint, so the arriving icon never flashes
  // at the center before beginning its rise.
  useLayoutEffect(() => {
    const previous = previousTheme.current;
    previousTheme.current = resolvedTheme;
    if (!previous || previous === resolvedTheme) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const incoming = night ? moonRef.current : sunRef.current;
    const outgoing = night ? sunRef.current : moonRef.current;
    const center = { transform: 'translate(0, 0) rotate(0deg)', opacity: 1 };
    // Deliberately longer than the page crossfade: the arc reads as a
    // rise and set, which needs the travel time the background change does not.
    const timing = { duration: 700, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' };

    // A single moon rise avoids the previous overshoot and backward settle.
    // Its balanced easing spreads the movement across the full duration.
    const rising = incoming?.animate(
      [
        { transform: 'translate(24px, 12px) rotate(90deg)', opacity: 0 },
        center,
      ],
      night ? { duration: 700, easing: 'cubic-bezier(0.4, 0, 0.2, 1)' } : timing,
    );
    const setting = outgoing?.animate([
      center,
      { transform: 'translate(-24px, 12px) rotate(-90deg)', opacity: 0 },
    ], timing);

    return () => {
      rising?.cancel();
      setting?.cancel();
    };
  }, [night, resolvedTheme]);

  const handleToggle = () => {
    markManualOverride();
    requestedTheme.current = (requestedTheme.current ?? resolvedTheme) === 'dark' ? 'light' : 'dark';
    // The capture callback can run after another click. Always apply the
    // latest request so a skipped capture cannot restore an older theme.
    const applyTheme = () => flushSync(() => setTheme(requestedTheme.current ?? 'dark'));
    // Rapid clicks update immediately while an existing snapshot is active.
    // This avoids overlapping captures and keeps the control responsive.
    if (pageTransition.current) {
      pageTransition.current.skipTransition();
      applyTheme();
      return;
    }
    if (!document.startViewTransition || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      applyTheme();
      requestedTheme.current = null;
      return;
    }
    const transition = document.startViewTransition(applyTheme);
    pageTransition.current = transition;
    // A skipped/hidden-page capture can reject ready, but the update still runs.
    void transition.ready.catch(() => undefined);
    void transition.finished.catch(() => undefined).finally(() => {
      if (pageTransition.current === transition) {
        pageTransition.current = null;
        requestedTheme.current = null;
      }
    });
  };

  const iconClass = 'absolute inset-0 flex items-center justify-center';

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleToggle}
      className="w-9 h-9 relative overflow-hidden"
    >
      <div ref={sunRef} className={iconClass} style={{ opacity: night ? 0 : 1 }} aria-hidden="true">
        <DotMatrixIcon icon="sun" />
      </div>
      <div ref={moonRef} className={iconClass} style={{ opacity: night ? 1 : 0 }} aria-hidden="true">
        <DotMatrixIcon icon="moon" />
      </div>
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
