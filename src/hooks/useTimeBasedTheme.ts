import { useEffect, useRef } from 'react';
import { useTheme } from 'next-themes';

/**
 * Automatically sets the theme based on time of day, following the sun cycle.
 *
 * Schedule:
 *   - Light mode: 7:00 AM → 7:00 PM (daytime)
 *   - Dark mode:  7:00 PM → 7:00 AM (nighttime)
 *
 * Behaviour:
 *   - On first visit (no stored preference), sets theme based on current time.
 *   - If the user manually toggles the theme, their choice is stored in
 *     sessionStorage so it's respected for the current session.
 *   - On new sessions (new tab / page reload), the time-based default reapplies.
 *   - Re-checks every minute so if the user leaves the tab open across the
 *     transition boundary, it switches automatically.
 */

const SUNRISE_HOUR = 7; // 7 AM
const SUNSET_HOUR = 19; // 7 PM
const MANUAL_OVERRIDE_KEY = 'theme-manual-override';

function getTimeBasedTheme(): 'light' | 'dark' {
  const hour = new Date().getHours();
  return hour >= SUNRISE_HOUR && hour < SUNSET_HOUR ? 'light' : 'dark';
}

export function useTimeBasedTheme() {
  const { theme, setTheme } = useTheme();
  const hasInitialised = useRef(false);

  // On mount: set theme based on time if no manual override exists this session
  useEffect(() => {
    if (hasInitialised.current) return;
    hasInitialised.current = true;

    const manualOverride = sessionStorage.getItem(MANUAL_OVERRIDE_KEY);
    if (!manualOverride) {
      const timeTheme = getTimeBasedTheme();
      setTheme(timeTheme);
    }
  }, [setTheme]);

  // Periodic check: re-evaluate every 60 seconds in case the boundary is crossed
  useEffect(() => {
    const interval = setInterval(() => {
      const manualOverride = sessionStorage.getItem(MANUAL_OVERRIDE_KEY);
      if (!manualOverride) {
        const timeTheme = getTimeBasedTheme();
        if (theme !== timeTheme) {
          setTheme(timeTheme);
        }
      }
    }, 60_000); // check every minute

    return () => clearInterval(interval);
  }, [theme, setTheme]);
}

/**
 * Call this when the user manually toggles the theme so their preference
 * is respected for the current session.
 */
export function markManualOverride() {
  sessionStorage.setItem(MANUAL_OVERRIDE_KEY, 'true');
}
