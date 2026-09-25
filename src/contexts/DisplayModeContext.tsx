import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

const STORAGE_KEY = 'display-mode';
const DisplayModeContext = createContext({ largerDisplay: false, toggleDisplaySize: () => {} });
export const useDisplayMode = () => useContext(DisplayModeContext);

/** An explicit reading-size preference; resolution cannot reveal viewing distance. */
export function DisplayModeProvider({ children }: { children: ReactNode }) {
  const [largerDisplay, setLargerDisplay] = useState(() => {
    try { return ['larger', 'tv'].includes(localStorage.getItem(STORAGE_KEY) ?? ''); } catch { return false; }
  });
  useEffect(() => {
    document.documentElement.dataset.display = largerDisplay ? 'larger' : 'standard';
    try { localStorage.setItem(STORAGE_KEY, largerDisplay ? 'larger' : 'standard'); } catch { /* Storage may be disabled. */ }
    return () => { delete document.documentElement.dataset.display; };
  }, [largerDisplay]);
  return <DisplayModeContext.Provider value={{ largerDisplay, toggleDisplaySize: () => setLargerDisplay(value => !value) }}>{children}</DisplayModeContext.Provider>;
}
