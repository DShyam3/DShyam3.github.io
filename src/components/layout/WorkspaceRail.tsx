import { Link, useLocation } from 'react-router-dom';
import { Terminal, Type } from 'lucide-react';
import { useSiteNavLinks } from './navLinks';
import { useWorkspaceInspector } from '@/contexts/WorkspaceInspectorContext';
import { useDisplayMode } from '@/contexts/DisplayModeContext';
import { cn } from '@/lib/utils';

export function WorkspaceRail() {
  const links = useSiteNavLinks();
  const location = useLocation();
  const { openCommandWithDraft } = useWorkspaceInspector();
  const { largerDisplay, toggleDisplaySize } = useDisplayMode();

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
                  <span
                    className={cn(
                      'tabular-nums text-xs tracking-wider transition-colors shrink-0',
                      active
                        ? 'text-primary font-semibold'
                        : 'text-muted-foreground/75 group-hover:text-foreground',
                    )}
                  >
                    {numberBadge}
                  </span>
                  <span className="truncate uppercase tracking-wider">{link.label}</span>
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
          className={cn(
            'w-full flex items-center justify-between gap-2 rounded-xl border px-2.5 py-2 text-xs transition-colors',
            largerDisplay
              ? 'border-primary/40 bg-primary/10 text-foreground font-medium'
              : 'border-border/60 bg-background/60 text-muted-foreground hover:text-foreground hover:border-primary/40',
          )}
        >
          <span className="flex items-center gap-1.5 truncate">
            <Type className="h-3.5 w-3.5 text-primary shrink-0" aria-hidden="true" />
            <span className="truncate">
              {largerDisplay ? 'Display: Larger' : 'Display: Standard'}
            </span>
          </span>
        </button>

        <div className="px-2 flex items-center justify-between text-xs text-muted-foreground tabular-nums">
          <span>{links.length} routes · Local-first</span>
          <span
            aria-hidden="true"
            className="h-1.5 w-1.5 rounded-full bg-primary/80"
          />
        </div>

        <button
          type="button"
          onClick={() => openCommandWithDraft('')}
          className="w-full flex items-center justify-between gap-2 rounded-xl border border-border/60 bg-background/60 px-2.5 py-2 text-xs text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
        >
          <span className="flex items-center gap-1.5 truncate">
            <Terminal className="h-3.5 w-3.5 text-primary shrink-0" aria-hidden="true" />
            <span className="truncate">Command Dock</span>
          </span>
          <kbd className="rounded border border-border/70 bg-card/80 px-1.5 py-0.5 text-xs font-mono text-muted-foreground">
            ⌘K
          </kbd>
        </button>
      </div>
    </aside>
  );
}
