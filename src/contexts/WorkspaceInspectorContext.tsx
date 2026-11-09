import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useLocation } from 'react-router-dom';

export interface InspectorMetadataRow {
  label: string;
  value: string;
  tone?: 'default' | 'accent' | 'amber' | 'sky';
}

export interface InspectorAction {
  label: string;
  to?: string;
}

/**
 * A record shown in the inspector. Every row is a figure read from data; there
 * is no "related records" list, because nothing stores a relationship between
 * records yet.
 */
export interface WorkspaceInspectorTarget {
  id: string;
  eyebrow: string;
  title: string;
  summary: string;
  rows: InspectorMetadataRow[];
  primaryAction?: InspectorAction;
  secondaryAction?: InspectorAction;
}

export interface DockedInspectorDetail {
  id: string;
  eyebrow: string;
  title: string;
  onClose: () => void;
  node: ReactNode;
}

interface WorkspaceInspectorContextValue {
  /** The selected record, or null when nothing is selected. */
  target: WorkspaceInspectorTarget | null;
  selectTarget: (next: WorkspaceInspectorTarget) => void;
  resetTarget: () => void;
  dockedDetail: DockedInspectorDetail | null;
  setDockedDetail: (detail: DockedInspectorDetail | null) => void;
  inspectorSheetOpen: boolean;
  commandOpen: boolean;
  setCommandOpen: (open: boolean) => void;
}

const WorkspaceInspectorContext = createContext<WorkspaceInspectorContextValue | null>(null);

/** Whether the inspector has its own column, rather than opening as a sheet. */
const isRightRailVisible = () =>
  typeof window !== 'undefined' &&
  Boolean(window.matchMedia?.('(min-width: 1280px) and (min-height: 600px)').matches);

export function WorkspaceInspectorProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();

  const [target, setTarget] = useState<WorkspaceInspectorTarget | null>(null);
  const [dockedDetail, setDockedDetailState] = useState<DockedInspectorDetail | null>(null);
  const [inspectorSheetOpen, setInspectorSheetOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);

  // A selection belongs to the page it was made on.
  useEffect(() => {
    setTarget(null);
    setDockedDetailState(null);
    setInspectorSheetOpen(false);
  }, [pathname]);

  // What the inspector holds now, readable from callbacks without making them
  // change identity on every selection.
  const targetRef = useRef(target);
  const dockedRef = useRef(dockedDetail);
  useEffect(() => {
    targetRef.current = target;
    dockedRef.current = dockedDetail;
  }, [target, dockedDetail]);

  const selectTarget = useCallback((next: WorkspaceInspectorTarget) => {
    // Tell the dialog that owns the docked detail it has closed. Dropping the
    // detail silently leaves that dialog open in its own state, and its later
    // cleanup would then close an inspector it no longer owns.
    dockedRef.current?.onClose();
    setDockedDetailState(null);
    setTarget(next);
    if (!isRightRailVisible()) {
      setInspectorSheetOpen(true);
    }
  }, []);

  const resetTarget = useCallback(() => {
    setTarget(null);
    setDockedDetailState(null);
    setInspectorSheetOpen(false);
  }, []);

  const setDockedDetail = useCallback((detail: DockedInspectorDetail | null) => {
    setDockedDetailState(detail);
    if (!detail) {
      // The sheet stays if it has moved on to showing a selected record.
      if (!targetRef.current) setInspectorSheetOpen(false);
    } else if (!isRightRailVisible()) {
      setInspectorSheetOpen(true);
    }
  }, []);

  const value = useMemo<WorkspaceInspectorContextValue>(
    () => ({
      target,
      selectTarget,
      resetTarget,
      dockedDetail,
      setDockedDetail,
      inspectorSheetOpen,
      commandOpen,
      setCommandOpen,
    }),
    [
      target,
      selectTarget,
      resetTarget,
      dockedDetail,
      setDockedDetail,
      inspectorSheetOpen,
      commandOpen,
    ],
  );

  return (
    <WorkspaceInspectorContext.Provider value={value}>
      {children}
    </WorkspaceInspectorContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useWorkspaceInspector(): WorkspaceInspectorContextValue {
  const ctx = useContext(WorkspaceInspectorContext);
  if (!ctx) {
    throw new Error('useWorkspaceInspector must be used inside WorkspaceInspectorProvider');
  }
  return ctx;
}
