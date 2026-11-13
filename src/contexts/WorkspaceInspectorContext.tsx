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
import { useMediaQuery } from '@/hooks/use-media-query';

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
  /** The record shown. The content remounts when it changes. */
  id: string;
  eyebrow: string;
  title: string;
  /** The user dismissed the detail: close, and return focus. */
  onClose: () => void;
  /**
   * Another record took the inspector: close, but leave focus where the click
   * that opened the other record put it. Falls back to onClose.
   */
  onReplaced?: () => void;
  node: ReactNode;
}

interface WorkspaceInspectorContextValue {
  /** The selected record, or null when nothing is selected. */
  target: WorkspaceInspectorTarget | null;
  selectTarget: (next: WorkspaceInspectorTarget) => void;
  resetTarget: () => void;
  dockedDetail: DockedInspectorDetail | null;
  /** Show a detail, or clear it, whoever holds the inspector. */
  setDockedDetail: (detail: DockedInspectorDetail | null) => void;
  /** The user closed the docked detail: its onClose runs, then it clears. */
  dismissDockedDetail: () => void;
  /**
   * For a dialog several of which can be open at once -- every card owns its
   * own. `owner` names the dialog instance. Claim on opening: the dialog that
   * held the inspector is told it was replaced. Update while open: ignored once
   * another dialog has claimed it, so a stale dialog re-rendering cannot take
   * it back. Release on closing: only the owner's own detail is cleared.
   */
  claimDockedDetail: (owner: string, detail: DockedInspectorDetail) => void;
  updateDockedDetail: (owner: string, detail: DockedInspectorDetail) => void;
  releaseDockedDetail: (owner: string) => void;
  inspectorSheetOpen: boolean;
  /**
   * What had focus when the current selection was made: the card or row that
   * opened it. The sheet returns focus here when it has no better opener,
   * because a sheet that opens on a resize opens with focus wherever it was.
   */
  selectionOpener: () => HTMLElement | null;
  commandOpen: boolean;
  setCommandOpen: (open: boolean) => void;
}

const WorkspaceInspectorContext = createContext<WorkspaceInspectorContextValue | null>(null);

// Whether a detail is docked, apart from the detail itself, for the pages that
// may not call useWorkspaceInspector (see there).
const DockedDetailOpenContext = createContext(false);

/**
 * When the inspector has its own column, rather than opening as a sheet. The
 * same query shows `.workspace-right-inspector` in src/theme/responsive.css.
 */
const RIGHT_RAIL_QUERY = '(min-width: 1280px) and (min-height: 600px)';

/** The element that has focus, unless that is nothing in particular. */
const focusedElement = (): HTMLElement | null => {
  const active = typeof document === 'undefined' ? null : document.activeElement;
  return active instanceof HTMLElement && active !== document.body ? active : null;
};

export function WorkspaceInspectorProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();

  const [target, setTarget] = useState<WorkspaceInspectorTarget | null>(null);
  const [dockedDetail, setDockedDetailState] = useState<DockedInspectorDetail | null>(null);
  const [commandOpen, setCommandOpen] = useState(false);
  // The sheet is how a selection shows when there is no column for it. It
  // closes only by clearing the selection, so it is derived, never stored --
  // and followed live: read once on opening, a window narrowed past the
  // breakpoint hid the column with the sheet still shut, and the detail could
  // not be reached again, since its card's dialog was still open.
  const rightRailVisible = useMediaQuery(RIGHT_RAIL_QUERY);
  const inspectorSheetOpen = !rightRailVisible && (target !== null || dockedDetail !== null);

  // The docked detail and its owner, readable from callbacks without making
  // them change identity on every dock. Written in the same call that changes
  // them, not after the render: two dialogs claiming in one commit must each
  // see the other's claim.
  const dockedRef = useRef<DockedInspectorDetail | null>(null);
  const ownerRef = useRef<string | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  // Called where a selection is made, never where one is only updated.
  const recordOpener = useCallback(() => {
    openerRef.current = focusedElement();
  }, []);
  const selectionOpener = useCallback(
    () => (openerRef.current?.isConnected ? openerRef.current : null),
    [],
  );

  const writeDocked = useCallback((detail: DockedInspectorDetail | null, owner: string | null) => {
    dockedRef.current = detail;
    ownerRef.current = detail ? owner : null;
    setDockedDetailState(detail);
  }, []);

  // Tell the dialog that holds the docked detail it has been replaced. Every
  // path that drops a detail calls this first: dropping it silently leaves
  // that dialog open in its own state, so clicking its card again changes
  // nothing and the inspector never comes back to it.
  const replaceDocked = useCallback(() => {
    const previous = dockedRef.current;
    (previous?.onReplaced ?? previous?.onClose)?.();
  }, []);

  // A selection belongs to the page it was made on. Only a dialog's claimed
  // detail is told; Travel's ownerless details clear as they always have.
  useEffect(() => {
    if (ownerRef.current !== null) replaceDocked();
    setTarget(null);
    writeDocked(null, null);
  }, [pathname, replaceDocked, writeDocked]);

  const selectTarget = useCallback((next: WorkspaceInspectorTarget) => {
    recordOpener();
    replaceDocked();
    writeDocked(null, null);
    setTarget(next);
  }, [recordOpener, replaceDocked, writeDocked]);

  const resetTarget = useCallback(() => {
    if (ownerRef.current !== null) replaceDocked();
    setTarget(null);
    writeDocked(null, null);
  }, [replaceDocked, writeDocked]);

  const showDocked = useCallback((detail: DockedInspectorDetail | null, owner: string | null) => {
    writeDocked(detail, owner);
  }, [writeDocked]);

  // Travel's own details carry no owner and keep their old behaviour; only a
  // dialog's claimed detail needs telling.
  const setDockedDetail = useCallback((detail: DockedInspectorDetail | null) => {
    if (detail && dockedRef.current?.id !== detail.id) recordOpener();
    if (ownerRef.current !== null) replaceDocked();
    showDocked(detail, null);
  }, [recordOpener, replaceDocked, showDocked]);

  const dismissDockedDetail = useCallback(() => {
    dockedRef.current?.onClose();
    showDocked(null, null);
  }, [showDocked]);

  const claimDockedDetail = useCallback((owner: string, detail: DockedInspectorDetail) => {
    recordOpener();
    if (ownerRef.current !== owner) replaceDocked();
    showDocked(detail, owner);
  }, [recordOpener, replaceDocked, showDocked]);

  const updateDockedDetail = useCallback((owner: string, detail: DockedInspectorDetail) => {
    if (ownerRef.current === owner) showDocked(detail, owner);
  }, [showDocked]);

  const releaseDockedDetail = useCallback((owner: string) => {
    if (ownerRef.current === owner) showDocked(null, null);
  }, [showDocked]);

  const value = useMemo<WorkspaceInspectorContextValue>(
    () => ({
      target,
      selectTarget,
      resetTarget,
      dockedDetail,
      setDockedDetail,
      dismissDockedDetail,
      claimDockedDetail,
      updateDockedDetail,
      releaseDockedDetail,
      inspectorSheetOpen,
      selectionOpener,
      commandOpen,
      setCommandOpen,
    }),
    [
      target,
      selectTarget,
      resetTarget,
      dockedDetail,
      setDockedDetail,
      dismissDockedDetail,
      claimDockedDetail,
      updateDockedDetail,
      releaseDockedDetail,
      inspectorSheetOpen,
      selectionOpener,
      commandOpen,
    ],
  );

  return (
    <WorkspaceInspectorContext.Provider value={value}>
      <DockedDetailOpenContext.Provider value={dockedDetail !== null}>
        {children}
      </DockedDetailOpenContext.Provider>
    </WorkspaceInspectorContext.Provider>
  );
}

/**
 * The inspector's state and setters. Its value changes on every dock, so an
 * ancestor of a card's detail dialog must not call this, whatever it reads:
 * the re-render hands the open dialog new props, which docks again -- an
 * endless render loop that also starves route changes. Such a page uses
 * useDockedDetailOpen.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useWorkspaceInspector(): WorkspaceInspectorContextValue {
  const ctx = useContext(WorkspaceInspectorContext);
  if (!ctx) {
    throw new Error('useWorkspaceInspector must be used inside WorkspaceInspectorProvider');
  }
  return ctx;
}

/** Whether a docked detail is showing. Re-renders only when that changes. */
// eslint-disable-next-line react-refresh/only-export-components
export function useDockedDetailOpen(): boolean {
  return useContext(DockedDetailOpenContext);
}
