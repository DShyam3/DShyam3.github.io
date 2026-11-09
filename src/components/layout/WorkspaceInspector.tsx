import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, X } from 'lucide-react';
import {
  useWorkspaceInspector,
  type DockedInspectorDetail,
  type InspectorMetadataRow,
  type WorkspaceInspectorTarget,
} from '@/contexts/WorkspaceInspectorContext';
import { cn } from '@/lib/utils';

function getRowToneClass(tone?: InspectorMetadataRow['tone']): string {
  switch (tone) {
    case 'accent':
      return 'text-primary';
    case 'amber':
      return 'text-[hsl(var(--peach))]';
    case 'sky':
      return 'text-[hsl(var(--sky))]';
    default:
      return 'text-foreground';
  }
}

interface DockedDetailBodyProps {
  detail: DockedInspectorDetail;
  onClose: () => void;
}

function DockedDetailBody({ detail, onClose }: DockedDetailBodyProps) {
  return (
    <div className="space-y-4">
      <div className="sticky -top-4 z-10 -mx-4 px-4 pt-1 pb-2.5 bg-popover/95 backdrop-blur-md border-b border-border/50 flex items-center justify-between gap-2">
        <p className="readout-label text-primary truncate">
          {detail.eyebrow}
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Clear selection"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-background/60 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="space-y-4">{detail.node}</div>
    </div>
  );
}

interface InspectorBodyProps {
  target: WorkspaceInspectorTarget;
  onNavigate?: () => void;
  onClose?: () => void;
}

function InspectorBody({ target, onNavigate, onClose }: InspectorBodyProps) {
  const hasActions = Boolean(target.primaryAction?.to || target.secondaryAction?.to);
  return (
    <>
      <div className="space-y-4">
        <div className="space-y-1.5 border-b border-border/50 pb-3">
          <div className="flex items-start justify-between gap-2">
            <p className="readout-label text-primary">
              {target.eyebrow}
            </p>
            {onClose ? (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close inspector"
                className="-mt-1 -mr-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-background/60 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            ) : null}
          </div>
          <h2 className="font-semibold text-base text-foreground leading-snug">
            {target.title}
          </h2>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {target.summary}
          </p>
        </div>

        {target.rows.length > 0 ? (
          <div className="space-y-1.5">
            <p className="readout-label">
              Readout
            </p>
            <dl className="divide-y divide-border/40 rounded-xl border border-border/50 bg-background/45 px-3 py-1">
              {target.rows.map((row) => (
                <div
                  key={row.label}
                  className="flex items-baseline justify-between gap-3 py-2 text-xs"
                >
                  <dt className="text-muted-foreground shrink-0">{row.label}</dt>
                  <dd
                    className={cn(
                      'tabular-nums text-right font-medium truncate',
                      getRowToneClass(row.tone),
                    )}
                  >
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ) : null}
      </div>

      {hasActions ? (
        <div className="mt-4 pt-3 border-t border-border/50">
          <div className="grid grid-cols-2 gap-2">
            {target.primaryAction?.to ? (
              <Link
                to={target.primaryAction.to}
                onClick={onNavigate}
                className={cn(
                  'inline-flex items-center justify-center gap-1.5 rounded-xl border border-primary/40 bg-primary/15 px-3 py-2 text-xs font-medium text-foreground hover:bg-primary/25 transition-colors text-center',
                  !target.secondaryAction?.to && 'col-span-2',
                )}
              >
                <span className="truncate">{target.primaryAction.label}</span>
                <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
              </Link>
            ) : null}
            {target.secondaryAction?.to ? (
              <Link
                to={target.secondaryAction.to}
                onClick={onNavigate}
                className={cn(
                  'inline-flex items-center justify-center gap-1.5 rounded-xl border border-border/60 bg-background/60 px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:border-border transition-colors text-center',
                  !target.primaryAction?.to && 'col-span-2',
                )}
              >
                <span className="truncate">{target.secondaryAction.label}</span>
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}

export function WorkspaceInspector() {
  const {
    target,
    resetTarget,
    dockedDetail,
    setDockedDetail,
    inspectorSheetOpen,
    commandOpen,
  } = useWorkspaceInspector();

  const hasSelection = Boolean(target) || Boolean(dockedDetail);

  useEffect(() => {
    // While the search palette is open, Escape belongs to it. A dialog that
    // handles Escape itself marks the event, and that is respected too.
    if (!hasSelection || commandOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      if (dockedDetail) {
        dockedDetail.onClose();
        setDockedDetail(null);
      } else {
        resetTarget();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [hasSelection, commandOpen, dockedDetail, resetTarget, setDockedDetail]);

  if (!hasSelection) return null;

  const handleCloseDocked = () => {
    dockedDetail?.onClose();
    setDockedDetail(null);
  };

  return (
    <>
      <aside
        aria-label="Contextual inspector"
        className="workspace-right-inspector flex-col justify-between rounded-2xl border border-border/60 bg-popover/75 p-4 app-scroll overflow-y-auto hud-corners min-h-0"
      >
        {dockedDetail ? (
          <DockedDetailBody detail={dockedDetail} onClose={handleCloseDocked} />
        ) : target ? (
          <InspectorBody target={target} onClose={resetTarget} />
        ) : null}
      </aside>

      {inspectorSheetOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-background/75 backdrop-blur-sm p-3 sm:p-4"
          onClick={() => {
            if (dockedDetail) {
              handleCloseDocked();
            } else {
              resetTarget();
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Inspector"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md max-h-[85dvh] flex flex-col justify-between rounded-2xl border border-border/75 bg-popover/95 p-4 shadow-xl app-scroll overflow-y-auto hud-corners"
          >
            {dockedDetail ? (
              <DockedDetailBody detail={dockedDetail} onClose={handleCloseDocked} />
            ) : target ? (
              <InspectorBody target={target} onNavigate={resetTarget} onClose={resetTarget} />
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
