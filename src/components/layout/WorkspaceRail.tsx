import { Link, useLocation } from 'react-router-dom';
import { Columns3, Monitor, Terminal, Type } from 'lucide-react';
import { useSiteNavLinks } from './navLinks';
import { useWorkspaceInspector } from '@/contexts/WorkspaceInspectorContext';
import { useDisplayMode } from '@/contexts/DisplayModeContext';
import { DotMatrixText } from '@/components/dot-matrix/DotMatrixText';
import { cn } from '@/lib/utils';

export function WorkspaceRail() {
  const links = useSiteNavLinks();
  const location = useLocation();
  const { setCommandOpen } = useWorkspaceInspector();
  const { largerDisplay, toggleDisplaySize, wideMode, toggleWideMode } = useDisplayMode();

  return (
    <aside
      aria-label="Workspace sections"
      className="workspace-left-rail flex-col justify-between rounded-2xl border border-border/60 bg-card/65 p-3 app-scroll overflow-y-auto min-h-0"
    >
      <div className="space-y-1">
        <p className="readout-label px-2 pb-2">
          Sections
        </p>
        <nav aria-label="Primary workspace navigation" className="flex flex-col gap-1">
          {links.map((link, index) => {
            const active =
              location.pathname === link.to ||
              (link.to !== '/' && location.pathname.startsWith(`${link.to}/`));
            const numberBadge = String(index + 1).padStart(2, '0');

            return (
              <Link
                key={link.to}
                to={link.to}
                data-section={link.to.slice(1) || 'about'}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'group flex items-center justify-between gap-2 rounded-xl border border-transparent px-2.5 py-2 text-xs transition-colors',
                  active
                    ? 'bg-primary/10 border-primary/35 text-foreground font-medium'
                    : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground',
                )}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <DotMatrixText
                    text={numberBadge}
                    size="ui"
                    wrap={false}
                    className={cn(
                      'tabular-nums transition-colors shrink-0',
                      active
                        ? 'text-primary'
                        : 'text-muted-foreground/75 group-hover:text-foreground',
                    )}
                  />
                  <span className="min-w-0 truncate">
                    <DotMatrixText text={link.label} size="ui" wrap={false} />
                  </span>
                </span>
                {active ? (
                  <span
                    aria-hidden="true"
                    className="h-1.5 w-1.5 rounded-full bg-primary shrink-0"
                  />
                ) : null}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="mt-4 pt-3 border-t border-border/50 space-y-2">
        <button
          type="button"
          onClick={toggleDisplaySize}
          aria-pressed={largerDisplay}
          aria-label={largerDisplay ? 'Display: Larger. Switch to Standard.' : 'Display: Standard. Switch to Larger.'}
          className={cn(
            'w-full flex items-center justify-between gap-2 rounded-xl border px-2.5 py-2 text-xs transition-colors',
            largerDisplay
              ? 'border-primary/40 bg-primary/10 text-foreground font-medium'
              : 'border-border/60 bg-background/60 text-muted-foreground hover:text-foreground hover:border-primary/40',
          )}
        >
          <span className="flex items-center gap-1.5 min-w-0 truncate">
            <Type className="h-3.5 w-3.5 text-primary shrink-0" aria-hidden="true" />
            <span className="truncate">
              <DotMatrixText
                text={largerDisplay ? 'Text: Large' : 'Text: Std'}
                size="ui"
                wrap={false}
              />
            </span>
          </span>
        </button>

        <button
          type="button"
          onClick={toggleWideMode}
          aria-pressed={wideMode === 'centered'}
          aria-label={wideMode === 'centered' ? 'Layout: Centered. Switch to Ultrawide.' : 'Layout: Ultrawide. Switch to Centered.'}
          title={wideMode === 'auto' ? 'Using full ultrawide cockpit when screen is wide. Click to center.' : 'Centered at standard wide width. Click for automatic ultrawide cockpit.'}
          className={cn(
            'hidden min-[1920px]:flex w-full items-center justify-between gap-2 rounded-xl border px-2.5 py-2 text-xs transition-colors',
            wideMode === 'centered'
              ? 'border-primary/40 bg-primary/10 text-foreground font-medium'
              : 'border-border/60 bg-background/60 text-muted-foreground hover:text-foreground hover:border-primary/40',
          )}
        >
          <span className="flex items-center gap-1.5 min-w-0 truncate">
            {wideMode === 'centered'
              ? <Monitor className="h-3.5 w-3.5 text-primary shrink-0" aria-hidden="true" />
              : <Columns3 className="h-3.5 w-3.5 text-primary shrink-0" aria-hidden="true" />}
            <span className="truncate">
              <DotMatrixText
                text={wideMode === 'centered' ? 'Wide: Center' : 'Wide: Auto'}
                size="ui"
                wrap={false}
              />
            </span>
          </span>
        </button>

        <button
          type="button"
          onClick={() => setCommandOpen(true)}
          className="w-full flex items-center justify-between gap-2 rounded-xl border border-border/60 bg-background/60 px-2.5 py-2 text-xs text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
        >
          <span className="flex items-center gap-1.5 min-w-0 truncate">
            <Terminal className="h-3.5 w-3.5 text-primary shrink-0" aria-hidden="true" />
            <DotMatrixText text="Search" size="ui" wrap={false} />
          </span>
          <kbd className="rounded border border-border/70 bg-card/80 px-1.5 py-0.5 text-xs font-mono text-muted-foreground">
            ⌘K
          </kbd>
        </button>
      </div>
    </aside>
  );
}
