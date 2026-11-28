import type { CSSProperties } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useSiteNavLinks, type SiteNavLink } from './navLinks';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspaceInspector } from '@/contexts/WorkspaceInspectorContext';
import { useDisplayMode } from '@/contexts/DisplayModeContext';
import { DotMatrixText } from '@/components/dot-matrix/DotMatrixText';
import { AppIcon, getSectionIcon } from '@/components/ui/icon';
import {
  SFAppleTerminalFill,
  SFArrowLeft,
  SFDisplay,
  SFRectangleSplit3x1,
  SFTextformatSize,
  SFWaveformPathEcg,
} from '@/components/ui/sf-symbols';
import { cn } from '@/lib/utils';

export function WorkspaceRail() {
  const links = useSiteNavLinks();
  const { isAdmin } = useAuth();
  const location = useLocation();
  const { setCommandOpen } = useWorkspaceInspector();
  const { largerDisplay, toggleDisplaySize, wideMode, toggleWideMode, toggleRail } = useDisplayMode();
  const devActive = location.pathname === '/dev' || location.pathname.startsWith('/dev/');

  const renderLink = (link: SiteNavLink) => {
    const active =
      location.pathname === link.to ||
      (link.to !== '/' && location.pathname.startsWith(`${link.to}/`));
    const SectionIcon = getSectionIcon(link.to);
    const accentStyle = link.accentHsl
      ? ({ '--section-colour': link.accentHsl } as CSSProperties)
      : undefined;

    return (
      <Link
        key={link.to}
        to={link.to}
        data-section={link.id}
        style={accentStyle}
        aria-current={active ? 'page' : undefined}
        className={cn(
          't-press group flex items-center justify-between gap-2 rounded-xl border border-transparent h-8 px-3 [@media(pointer:coarse)]:h-11 text-xs transition-colors',
          active
            ? 'bg-primary/10 border-primary/35 text-foreground font-medium'
            : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground',
        )}
      >
        <span className="flex items-center gap-2 min-w-0">
          <AppIcon
            icon={SectionIcon}
            active={active}
            className={cn(
              'h-3.5 w-3.5',
              active
                ? 'text-primary'
                : 'text-[hsl(var(--section-colour))] opacity-80 group-hover:opacity-100',
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
  };

  return (
    <aside
      aria-label="App switcher"
      className="workspace-left-rail flex-col rounded-2xl border border-border/60 bg-card/65 overflow-hidden min-h-0"
    >
      <div className="flex-1 min-h-0 overflow-y-auto app-scroll p-3 flex flex-col justify-between">
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2 px-3 pb-1">
            <p className="readout-label">Apps</p>
            <button
              type="button"
              onClick={toggleRail}
              aria-label="Hide apps sidebar"
              title="Hide apps sidebar (standalone mode)"
              className="flex h-8 w-8 [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:w-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary/60 hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <AppIcon icon={SFArrowLeft} className="h-3.5 w-3.5" />
            </button>
          </div>

          <nav aria-label="Primary app navigation" className="flex flex-col gap-1">
            {links.map(renderLink)}
          </nav>
        </div>

        <div className="mt-3 pt-3 border-t border-border/50 space-y-2">
          {isAdmin && (
            <Link
              to="/dev"
              data-section="dev"
              aria-current={devActive ? 'page' : undefined}
              className={cn(
                'w-full flex items-center justify-between gap-2 rounded-xl border h-8 px-3 [@media(pointer:coarse)]:h-11 text-xs transition-colors',
                devActive
                  ? 'border-primary/40 bg-primary/10 text-foreground font-medium'
                  : 'border-border/60 bg-background/60 text-muted-foreground hover:text-foreground hover:border-primary/40',
              )}
            >
              <span className="flex items-center gap-2 min-w-0 truncate">
                <AppIcon icon={SFWaveformPathEcg} className="h-3.5 w-3.5 text-primary shrink-0" />
                <DotMatrixText text="Dev" size="ui" wrap={false} />
              </span>
              {devActive ? (
                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
              ) : null}
            </Link>
          )}

          <button
            type="button"
            onClick={toggleDisplaySize}
            aria-pressed={largerDisplay}
            aria-label={largerDisplay ? 'Display: Larger. Switch to Standard.' : 'Display: Standard. Switch to Larger.'}
            className={cn(
              'w-full flex items-center justify-between gap-2 rounded-xl border h-8 px-3 text-xs transition-colors',
              largerDisplay
                ? 'border-primary/40 bg-primary/10 text-foreground font-medium'
                : 'border-border/60 bg-background/60 text-muted-foreground hover:text-foreground hover:border-primary/40',
            )}
          >
            <span className="flex items-center gap-2 min-w-0 truncate">
              <AppIcon icon={SFTextformatSize} className="h-3.5 w-3.5 text-primary shrink-0" />
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
              'hidden min-[1920px]:flex w-full items-center justify-between gap-2 rounded-xl border h-8 px-3 text-xs transition-colors',
              wideMode === 'centered'
                ? 'border-primary/40 bg-primary/10 text-foreground font-medium'
                : 'border-border/60 bg-background/60 text-muted-foreground hover:text-foreground hover:border-primary/40',
            )}
          >
            <span className="flex items-center gap-2 min-w-0 truncate">
              {wideMode === 'centered'
                ? <AppIcon icon={SFDisplay} className="h-3.5 w-3.5 text-primary shrink-0" />
                : <AppIcon icon={SFRectangleSplit3x1} className="h-3.5 w-3.5 text-primary shrink-0" />}
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
            className="w-full flex items-center justify-between gap-2 rounded-xl border border-border/60 bg-background/60 h-8 px-3 text-xs text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
          >
            <span className="flex items-center gap-2 min-w-0 truncate">
              <AppIcon icon={SFAppleTerminalFill} className="h-3.5 w-3.5 text-primary shrink-0" />
              <DotMatrixText text="Search" size="ui" wrap={false} />
            </span>
            <kbd className="inline-flex h-5 items-center rounded border border-border/70 bg-card/80 px-1 text-xs font-mono text-muted-foreground">
              ⌘K
            </kbd>
          </button>
        </div>
      </div>
    </aside>
  );
}
