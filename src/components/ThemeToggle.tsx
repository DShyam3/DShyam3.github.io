import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { DotMatrixIcon } from '@/components/dot-matrix/DotMatrixIcon';
import { markManualOverride } from '@/hooks/useTimeBasedTheme';

/**
 * Sun and moon trade places along an arc, the way they do over a horizon:
 * the outgoing one sets to the left and below, the incoming one rises from
 * the right and below. Both are always mounted and only ever transformed, so
 * the two halves stay in step and the swap reads as one movement rather than
 * a crossfade.
 *
 * `overflow-hidden` on the button clips the travel, so each icon appears to
 * pass behind the edge instead of floating outside it.
 */
export function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme();

  // The arc runs off this rather than off `dark:` variants. `disableTransitionOnChange`
  // strips every transition on the page for the frame the class flips -- that is what
  // stops the palette crossfading through a mid-grey where the whole page briefly goes
  // blank -- and it would strip this one with it, snapping the icons into place. A state
  // flip one frame later lands after transitions are live again, so the arc still runs.
  const [night, setNight] = useState(resolvedTheme === 'dark');

  useEffect(() => {
    const frame = requestAnimationFrame(() => setNight(resolvedTheme === 'dark'));
    return () => cancelAnimationFrame(frame);
  }, [resolvedTheme]);

  const handleToggle = () => {
    markManualOverride();
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  // A slow-out ease over a longer duration: quick to leave, settles gently.
  const arc =
    'absolute inset-0 flex items-center justify-center ' +
    'transition-[transform,opacity] duration-500 ' +
    '[transition-timing-function:cubic-bezier(0.22,1,0.36,1)] ' +
    'motion-reduce:transition-none';

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleToggle}
      className="w-9 h-9 relative overflow-hidden"
    >
      {/* Sun: on screen in light mode, sets left-and-down in dark mode. */}
      <div
        className={`${arc} ${
          night
            ? '-translate-x-6 translate-y-3 -rotate-90 opacity-0'
            : 'translate-x-0 translate-y-0 rotate-0 opacity-100'
        }`}
      >
        <DotMatrixIcon icon="sun" />
      </div>

      {/* Moon: waiting off to the right, rises into place in dark mode. The
          glyph is a bare crescent -- it used to carry a four-point star in
          its opening, which on the toggle's orange hover square read as a
          flag rather than as a moon. The star is what did that, not the
          crescent, so only the star went. */}
      <div
        className={`${arc} ${
          night
            ? 'translate-x-0 translate-y-0 rotate-0 opacity-100'
            : 'translate-x-6 translate-y-3 rotate-90 opacity-0'
        }`}
      >
        <DotMatrixIcon icon="moon" />
      </div>

      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
