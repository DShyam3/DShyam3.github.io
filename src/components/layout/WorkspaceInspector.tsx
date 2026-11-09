import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, MessageSquare, X } from 'lucide-react';
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
  onAsk: () => void;
}

function DockedDetailBody({ detail, onClose, onAsk }: DockedDetailBodyProps) {
  return (
    <>
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

        <div className="space-y-4">
          {detail.node}
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-border/50">
        <button
          type="button"
          onClick={onAsk}
          className="w-full flex items-center justify-center gap-2 rounded-xl border border-border/60 bg-background/60 px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
        >
          <MessageSquare className="h-3.5 w-3.5 text-primary shrink-0" aria-hidden="true" />
          <span>Ask about this record</span>
        </button>
      </div>
    </>
  );
}

interface InspectorBodyProps {
  target: WorkspaceInspectorTarget;
  onNavigate?: () => void;
  onAsk: () => void;
  onClose?: () => void;
}

function InspectorBody({ target, onNavigate, onAsk, onClose }: InspectorBodyProps) {
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

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="readout-label">
              Connected Backlinks ({target.backlinks.length})
            </p>
          </div>
          <div className="space-y-1.5">
            {target.backlinks.map((bl) => (
              <Link
                key={bl.id}
                to={bl.to}
                onClick={onNavigate}
                className="group flex items-center justify-between gap-2 rounded-xl border border-border/50 bg-background/50 px-2.5 py-2 text-xs transition-colors hover:border-primary/45 hover:bg-secondary/45"
              >
                <span className="flex items-center gap-2 min-w-0">
                  <span className="rounded border border-border/70 bg-card/80 px-1.5 py-0.5 font-mono text-xs font-semibold tracking-wider text-primary shrink-0">
                    {bl.code}
                  </span>
                  <span className="truncate text-foreground group-hover:text-primary transition-colors">
                    {bl.label}
                  </span>
                </span>
                <span className="flex items-center gap-1 shrink-0 text-xs text-muted-foreground">
                  {bl.meta ? <span className="hidden sm:inline">{bl.meta}</span> : null}
                  <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" aria-hidden="true" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-border/50 space-y-2">
        {(target.primaryAction?.to || target.secondaryAction?.to) ? (
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
        ) : null}

        <button
          type="button"
          onClick={onAsk}
          className="w-full flex items-center justify-center gap-2 rounded-xl border border-border/60 bg-background/60 px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
        >
          <MessageSquare className="h-3.5 w-3.5 text-primary shrink-0" aria-hidden="true" />
          <span>Ask about this record</span>
        </button>
      </div>
    </>
  );
}

export function WorkspaceInspector() {
  const {
    target,
    hasCustomTarget,
    resetTarget,
    dockedDetail,
    setDockedDetail,
    inspectorSheetOpen,
    setInspectorSheetOpen,
    openCommandWithDraft,
  } = useWorkspaceInspector();

  useEffect(() => {
    if (!inspectorSheetOpen && !dockedDetail && !hasCustomTarget) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (dockedDetail) {
          dockedDetail.onClose();
          setDockedDetail(null);
        } else if (hasCustomTarget) {
          resetTarget();
        }
        if (inspectorSheetOpen) {
          setInspectorSheetOpen(false);
        }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [
    inspectorSheetOpen,
    dockedDetail,
    hasCustomTarget,
    resetTarget,
    setDockedDetail,
    setInspectorSheetOpen,
  ]);

  if (!hasCustomTarget && !dockedDetail && !inspectorSheetOpen) return null;

  const activeTitle = dockedDetail ? dockedDetail.title : target.title;

  const handleAsk = () => {
    setInspectorSheetOpen(false);
    openCommandWithDraft(`Tell me about ${activeTitle}`);
  };

  const handleCloseDocked = () => {
    if (dockedDetail) {
      dockedDetail.onClose();
      setDockedDetail(null);
    }
    setInspectorSheetOpen(false);
  };

  return (
    <>
      <aside
        aria-label="Contextual inspector"
        className="workspace-right-inspector flex-col justify-between rounded-2xl border border-border/60 bg-popover/75 p-4 app-scroll overflow-y-auto hud-corners min-h-0"
      >
        {dockedDetail ? (
          <DockedDetailBody
            detail={dockedDetail}
            onClose={handleCloseDocked}
            onAsk={handleAsk}
          />
        ) : (
          <InspectorBody
            target={target}
            onAsk={handleAsk}
            onClose={hasCustomTarget ? resetTarget : undefined}
          />
        )}
      </aside>

      {inspectorSheetOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-background/75 backdrop-blur-sm p-3 sm:p-4"
          onClick={() => {
            if (dockedDetail) {
              handleCloseDocked();
            } else {
              setInspectorSheetOpen(false);
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
              <DockedDetailBody
                detail={dockedDetail}
                onClose={handleCloseDocked}
                onAsk={handleAsk}
              />
            ) : (
              <>
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-border/40">
                  <span className="readout-label">
                    Contextual Inspector
                  </span>
                  <button
                    type="button"
                    onClick={() => setInspectorSheetOpen(false)}
                    aria-label="Close inspector"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border/60 bg-background/60 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
                <InspectorBody
                  target={target}
                  onNavigate={() => setInspectorSheetOpen(false)}
                  onAsk={handleAsk}
                />
              </>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
