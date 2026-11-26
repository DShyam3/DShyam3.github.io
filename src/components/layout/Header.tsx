import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ThemeToggle } from '@/components/ThemeToggle';
import { NavMenu } from './NavMenu';
import { DotMatrixText } from '@/components/dot-matrix/DotMatrixText';
import { AppIcon } from '@/components/ui/icon';
import {
  SFMagnifyingglass,
  SFPlus,
  SFSquareGrid2x2Fill,
} from '@/components/ui/sf-symbols';
import { socialIcons } from '@/components/icons/SocialIcons';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ASSETS_URL } from '@/lib/constants';
import { SITE } from '@/config/site';
import { useWorkspaceInspector } from '@/contexts/WorkspaceInspectorContext';
import { useDisplayMode } from '@/contexts/DisplayModeContext';
import { useActiveApp } from '@/apps/useActiveApp';

interface HeaderProps {
  title?: string;
  subtitle?: string;
}

export function Header({
  title,
  subtitle,
}: HeaderProps) {
  const [socialOpen, setSocialOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { setCommandOpen } = useWorkspaceInspector();
  const { railCollapsed, toggleRail } = useDisplayMode();
  const activeApp = useActiveApp();

  const socialLinks = useMemo(() => SITE.socials, []);
  const isHome = !activeApp || activeApp.basePath === '/';

  const resolvedTitle = title ?? (isHome ? SITE.siteTitle : activeApp.name);
  const resolvedSubtitle = subtitle ?? (isHome ? SITE.tagline : activeApp.tagline);

  // Secret admin link handler. Carries the current page along so signing
  // in (or out) lands back where you were rather than on the home page.
  const handleTitleClick = () => {
    if (location.pathname === '/auth') return;
    navigate('/auth', {
      state: { from: `${location.pathname}${location.search}${location.hash}` },
    });
  };

  return (
    // `relative` is what NavMenu's panel hangs off: it spans the header's
    // full width from the bottom edge, so it has to resolve against the
    // header rather than the right-hand cluster the button sits in.
    <header
      className="app-header relative pt-5 pb-4 md:pt-6 md:pb-5 border-b border-border/50"
      data-socials-open={socialOpen || undefined}
    >
      <div>
        <div className="flex flex-row items-center justify-between gap-2 min-[700px]:gap-3 min-[700px]:flex-wrap">
          {/* Left side: Desktop Apps sidebar toggle + Owner identity + expanding social links */}
          <div className="flex flex-none items-center justify-between gap-2 md:gap-3">
            <button
              type="button"
              onClick={toggleRail}
              aria-pressed={!railCollapsed}
              aria-label={railCollapsed ? 'Show apps sidebar' : 'Hide apps sidebar (standalone mode)'}
              title={railCollapsed ? 'Show apps sidebar' : 'Hide apps sidebar (standalone mode)'}
              className={cn(
                'hidden md:inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg border transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background',
                railCollapsed
                  ? 'border-border/70 bg-secondary/40 text-muted-foreground hover:text-foreground hover:bg-secondary/70'
                  : 'border-primary/35 bg-primary/10 text-primary hover:bg-primary/15',
              )}
            >
              <AppIcon icon={SFSquareGrid2x2Fill} className="h-4 w-4" />
            </button>

            <div
              className="flex items-center gap-3 flex-shrink-0 cursor-pointer select-none transition-opacity hover:opacity-80 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background"
              onClick={() => navigate('/')}
              role="button"
              tabIndex={0}
              aria-label={`${SITE.name} home`}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  navigate('/');
                }
              }}
            >
              <img
                src={`${ASSETS_URL}/memoji.png`}
                alt={`${SITE.name} memoji avatar`}
                className="h-10 w-10 md:h-12 md:w-12 rounded-lg bg-secondary object-cover flex-shrink-0"
                loading="eager"
              />

              <div className="header-identity-text flex flex-col items-start gap-0.5 leading-none max-[699px]:hidden">
                <DotMatrixText
                  text={SITE.name.toUpperCase()}
                  size="md"
                  className="text-foreground"
                />
                <DotMatrixText
                  text={SITE.role.toUpperCase()}
                  size="xs"
                  className="text-muted-foreground"
                />
              </div>
            </div>

            <div className="relative flex items-center flex-shrink-0 max-[699px]:hidden">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-11 w-11 flex-shrink-0"
                onClick={() => setSocialOpen((v) => !v)}
                aria-label={socialOpen ? 'Close social links' : 'Open social links'}
                aria-expanded={socialOpen}
              >
                <div
                  className={cn(
                    'transition-transform duration-200 flex items-center justify-center',
                    socialOpen && 'rotate-45',
                  )}
                >
                  <AppIcon icon={SFPlus} className="h-4 w-4 text-foreground" />
                </div>
              </Button>

              {/* Social links, laid over the row rather than in it, so
                  opening them reflows nothing. They open rightward, over the
                  page title until lg, which fades out (responsive.css). */}
              <div
                className={cn(
                  'absolute top-1/2 -translate-y-1/2 left-full ml-2 md:ml-3',
                  'flex items-center gap-1 md:gap-2 overflow-hidden transition-[max-width,opacity] duration-200 justify-start',
                  socialOpen ? 'max-w-[10rem] opacity-100' : 'max-w-0 opacity-0',
                )}
              >
                {socialLinks.map(({ label, href, icon }) => {
                  const Icon = socialIcons[icon];
                  return (
                    <a
                      key={label}
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={label}
                      tabIndex={socialOpen ? 0 : -1}
                      aria-hidden={!socialOpen}
                      className="min-h-11 min-w-11 justify-center p-2 text-foreground hover:bg-secondary/50 rounded transition-colors flex-shrink-0"
                    >
                      <Icon className="h-5 w-5 md:h-6 md:w-6" />
                    </a>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right side: Active app badge + title/subtitle (opens /auth) + Search + Mobile App Switcher + Theme */}
          <div className="flex items-center justify-between gap-2 max-[699px]:min-w-0 max-[699px]:flex-1 min-[700px]:gap-3 md:gap-4">
            <div className="header-page-title min-w-0 max-[699px]:flex-1 max-[699px]:overflow-hidden text-left md:text-right">
              <div
                className="flex items-center gap-2.5 w-fit max-w-full cursor-pointer select-none active:opacity-70 md:ml-auto"
                onClick={handleTitleClick}
              >
                {!isHome && (
                  <span
                    aria-hidden="true"
                    className="hidden sm:flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-[hsl(var(--section-colour)/0.32)] bg-[hsl(var(--section-colour)/0.14)] text-[hsl(var(--section-colour))]"
                  >
                    <AppIcon icon={activeApp.icon} className="h-4 w-4" />
                  </span>
                )}
                <div className="min-w-0">
                  <h1>
                    <DotMatrixText
                      text={resolvedTitle.toUpperCase()}
                      size="sm"
                      className="text-foreground justify-start md:justify-end"
                    />
                  </h1>
                  <div className="max-[699px]:hidden">
                    <DotMatrixText
                      text={resolvedSubtitle.toUpperCase()}
                      size="xs"
                      className="text-muted-foreground justify-start md:justify-end mt-1"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-shrink-0 items-center gap-1 min-[700px]:gap-2 md:gap-4">
              <button
                type="button"
                onClick={() => setCommandOpen(true)}
                aria-label="Search apps and records"
                className="nav-link flex flex-shrink-0 items-center justify-center gap-2 rounded text-xs hover:bg-secondary/70 transition-colors max-md:h-11 max-md:w-11 md:px-2.5 md:py-1.5"
              >
                <AppIcon icon={SFMagnifyingglass} className="h-4 w-4 text-primary shrink-0 md:h-3.5 md:w-3.5" />
                <DotMatrixText text="Search" size="ui" wrap={false} className="hidden md:inline-flex" />
                <kbd className="max-md:hidden rounded border border-border/70 bg-background/70 px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                  ⌘K
                </kbd>
              </button>
              <NavMenu className="md:hidden" />
              <ThemeToggle />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
