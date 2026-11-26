import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

const STORAGE_KEY = 'display-mode';
const WIDE_STORAGE_KEY = 'wide-layout-mode';
const RAIL_STORAGE_KEY = 'app-rail-collapsed';

export type WideLayoutMode = 'auto' | 'centered';

interface DisplayModeValue {
  largerDisplay: boolean;
  toggleDisplaySize: () => void;
  wideMode: WideLayoutMode;
  toggleWideMode: () => void;
  railCollapsed: boolean;
  toggleRail: () => void;
}

const DisplayModeContext = createContext<DisplayModeValue>({
  largerDisplay: false,
  toggleDisplaySize: () => {},
  wideMode: 'auto',
  toggleWideMode: () => {},
  railCollapsed: false,
  toggleRail: () => {},
});

/** Parses `?standalone=1|true` (collapse rail) or `?standalone=0|false` (show rail). */
export function parseStandaloneParam(search: string): boolean | null {
  const raw = new URLSearchParams(search).get('standalone');
  if (raw === null) return null;
  const normalized = raw.trim().toLowerCase();
  if (normalized === '1' || normalized === 'true' || normalized === '') return true;
  if (normalized === '0' || normalized === 'false') return false;
  return null;
}

/** Explicit reading-size, ultrawide, and standalone app-rail preferences. */
export function DisplayModeProvider({ children }: { children: ReactNode }) {
  const { search } = useLocation();
  const [largerDisplay, setLargerDisplay] = useState(() => {
    try { return ['larger', 'tv'].includes(localStorage.getItem(STORAGE_KEY) ?? ''); } catch { return false; }
  });
  const [wideMode, setWideMode] = useState<WideLayoutMode>(() => {
    try { return localStorage.getItem(WIDE_STORAGE_KEY) === 'centered' ? 'centered' : 'auto'; } catch { return 'auto'; }
  });
  const [railCollapsed, setRailCollapsed] = useState(() => {
    const fromUrl = parseStandaloneParam(search);
    if (fromUrl !== null) return fromUrl;
    try { return localStorage.getItem(RAIL_STORAGE_KEY) === 'true'; } catch { return false; }
  });

  useEffect(() => {
    const fromUrl = parseStandaloneParam(search);
    if (fromUrl !== null) setRailCollapsed(fromUrl);
  }, [search]);

  useEffect(() => {
    document.documentElement.dataset.display = largerDisplay ? 'larger' : 'standard';
    try { localStorage.setItem(STORAGE_KEY, largerDisplay ? 'larger' : 'standard'); } catch { /* Storage may be disabled. */ }
    return () => { delete document.documentElement.dataset.display; };
  }, [largerDisplay]);

  useEffect(() => {
    document.documentElement.dataset.wideMode = wideMode;
    try { localStorage.setItem(WIDE_STORAGE_KEY, wideMode); } catch { /* Storage may be disabled. */ }
    return () => { delete document.documentElement.dataset.wideMode; };
  }, [wideMode]);

  useEffect(() => {
    try { localStorage.setItem(RAIL_STORAGE_KEY, railCollapsed ? 'true' : 'false'); } catch { /* Storage may be disabled. */ }
  }, [railCollapsed]);

  return (
    <DisplayModeContext.Provider
      value={{
        largerDisplay,
        toggleDisplaySize: () => setLargerDisplay(value => !value),
        wideMode,
        toggleWideMode: () => setWideMode(value => (value === 'auto' ? 'centered' : 'auto')),
        railCollapsed,
        toggleRail: () => setRailCollapsed(value => !value),
      }}
    >
      {children}
    </DisplayModeContext.Provider>
  );
}

export const useDisplayMode = () => useContext(DisplayModeContext);
