import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

const STORAGE_KEY = 'display-mode';
const WIDE_STORAGE_KEY = 'wide-layout-mode';

export type WideLayoutMode = 'auto' | 'centered';

interface DisplayModeValue {
  largerDisplay: boolean;
  toggleDisplaySize: () => void;
  wideMode: WideLayoutMode;
  toggleWideMode: () => void;
}

const DisplayModeContext = createContext<DisplayModeValue>({
  largerDisplay: false,
  toggleDisplaySize: () => {},
  wideMode: 'auto',
  toggleWideMode: () => {},
});

/** Explicit reading-size and ultrawide layout preferences; resolution alone cannot reveal viewing distance or preference. */
export function DisplayModeProvider({ children }: { children: ReactNode }) {
  const [largerDisplay, setLargerDisplay] = useState(() => {
    try { return ['larger', 'tv'].includes(localStorage.getItem(STORAGE_KEY) ?? ''); } catch { return false; }
  });
  const [wideMode, setWideMode] = useState<WideLayoutMode>(() => {
    try { return localStorage.getItem(WIDE_STORAGE_KEY) === 'centered' ? 'centered' : 'auto'; } catch { return 'auto'; }
  });

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

  return (
    <DisplayModeContext.Provider
      value={{
        largerDisplay,
        toggleDisplaySize: () => setLargerDisplay(value => !value),
        wideMode,
        toggleWideMode: () => setWideMode(value => (value === 'auto' ? 'centered' : 'auto')),
      }}
    >
      {children}
    </DisplayModeContext.Provider>
  );
}

export const useDisplayMode = () => useContext(DisplayModeContext);
