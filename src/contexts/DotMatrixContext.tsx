import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ASSETS_URL } from '@/lib/constants';

interface DotMatrixData {
  charPatterns: Record<string, number[][]>;
  iconPatterns: Record<string, number[][]>;
}

interface DotMatrixContextType {
  data: DotMatrixData | null;
  loading: boolean;
}

const DotMatrixContext = createContext<DotMatrixContextType | undefined>(undefined);

export function DotMatrixProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<DotMatrixData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${ASSETS_URL}/dot-matrix.json`)
      .then((res) => res.json())
      .then((json) => {
        setData(json);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load dot matrix data:', err);
        setLoading(false);
      });
  }, []);

  return (
    <DotMatrixContext.Provider value={{ data, loading }}>
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
