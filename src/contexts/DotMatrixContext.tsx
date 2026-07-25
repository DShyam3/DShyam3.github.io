import { createContext, useContext, ReactNode } from 'react';
import dotMatrixData from '@/data/dot-matrix.json';

interface DotMatrixData {
  charPatterns: Record<string, number[][]>;
  iconPatterns: Record<string, number[][]>;
}

interface DotMatrixContextType {
  data: DotMatrixData | null;
  loading: boolean;
}

// Bundled at build time instead of fetched from Supabase storage at runtime --
// this data is static and small, and fetching it on every page load blocked
// all text (nav, header, titles) behind a network round trip before anything
// could render.
const DotMatrixContext = createContext<DotMatrixContextType | undefined>(undefined);

// Fully static, so this can live at module scope -- one stable object
// reference for the lifetime of the app, no re-render ever changes it.
const contextValue: DotMatrixContextType = { data: dotMatrixData as DotMatrixData, loading: false };

export function DotMatrixProvider({ children }: { children: ReactNode }) {
  return (
    <DotMatrixContext.Provider value={contextValue}>
      {children}
    </DotMatrixContext.Provider>
  );
}

export function useDotMatrix() {
  const context = useContext(DotMatrixContext);
  if (context === undefined) {
    throw new Error('useDotMatrix must be used within a DotMatrixProvider');
  }
  return context;
}
