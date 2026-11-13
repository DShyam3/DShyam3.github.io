import { useEffect, useState } from 'react';

const matchesNow = (query: string) =>
  typeof window !== 'undefined' && Boolean(window.matchMedia?.(query).matches);

/**
 * Whether a CSS media query matches, followed live as the window changes.
 * Right on the first render, so a layout keyed on it does not flash the other
 * way first. False where `matchMedia` is missing.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => matchesNow(query));
  useEffect(() => {
    const list = window.matchMedia?.(query);
    if (!list) return;
    const onChange = () => setMatches(list.matches);
    onChange();
    list.addEventListener('change', onChange);
    return () => list.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}
