import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { NavMenu } from './NavMenu';
import { DotMatrixText } from '@/components/dot-matrix/DotMatrixText';
import { DotMatrixIcon } from '@/components/dot-matrix/DotMatrixIcon';
import { socialIcons } from '@/components/icons/SocialIcons';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ASSETS_URL } from '@/lib/constants';
import { SITE } from '@/config/site';
import { useWorkspaceInspector } from '@/contexts/WorkspaceInspectorContext';


interface HeaderProps {
  title?: string;
  subtitle?: string;
}

export function Header({
  title = SITE.siteTitle,
  subtitle = SITE.tagline,
}: HeaderProps) {
  const [socialOpen, setSocialOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { setCommandOpen } = useWorkspaceInspector();

  const socialLinks = useMemo(() => SITE.socials, []);

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
        {/* One row at every width: identity on the left, page title and
            controls on the right.

            Below 700px there is no room for the name, the page title and
            three controls on one line, and stacking them cost 185px of an
            812px screen. So a phone keeps the avatar (still the way home),
            the page title and icon-only controls; the name, role, subtitle
            and social button wait for 700px. The social links move into the
            menu panel (NavMenu). */}
        <div className="flex flex-row items-center justify-between gap-2 min-[700px]:gap-3 min-[700px]:flex-wrap">
          {/* Left side: Profile with social links */}
          <div className="flex flex-none items-center justify-between gap-2 md:gap-3">
            <div
              className="flex items-center gap-3 flex-shrink-0 cursor-pointer select-none transition-opacity hover:opacity-80"
              onClick={() => navigate('/')}
              role="button"
              tabIndex={0}
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
                aria-label={socialOpen ? "Close social links" : "Open social links"}
                aria-expanded={socialOpen}
              >
                <div
                  className={cn(
                    'transition-transform duration-200 flex items-center justify-center',
                    socialOpen && 'rotate-45',
                  )}
                >
                  <DotMatrixIcon icon="plus" />
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

          {/* On a phone this cluster takes the width the avatar leaves: the
              title has the left of it and wraps between words, the controls
              keep the right edge. From 700px it is only as wide as its
              contents. */}
          <div className="flex items-center justify-between gap-2 max-[699px]:min-w-0 max-[699px]:flex-1 min-[700px]:gap-3 md:gap-4">
            {/* Two boxes on purpose. The outer one takes the row's free width
                below 700px; the inner one is only as wide as the words, and
                only it opens the sign-in page. One box doing both made every
                stray tap on blank header space open /auth. */}
            <div className="header-page-title min-w-0 max-[699px]:flex-1 max-[699px]:overflow-hidden text-left md:text-right">
              <div
                className="w-fit max-w-full cursor-pointer select-none active:opacity-70 md:ml-auto"
                onClick={handleTitleClick}
              >
                <div>
                  <DotMatrixText
                    text={title.toUpperCase()}
                    size="sm"
                    className="text-foreground justify-start md:justify-end"
                  />
                </div>
                <div className="max-[699px]:hidden">
                  <DotMatrixText
                    text={subtitle.toUpperCase()}
                    size="xs"
                    className="text-muted-foreground justify-start md:justify-end mt-1"
                  />
                </div>
              </div>
            </div>
            {/* After the title rather than before it. On its own between the
                two identity blocks the button had nothing to line up with:
                both neighbours are two stacked lines of Doto and it is one
                line of it, centred in the gap. Kept with the theme toggle it
                joins the only other control on this side, and the pair read
                as a control cluster pinned to the right edge instead of one
                label adrift in the whitespace. */}
            <div className="flex flex-shrink-0 items-center gap-1 min-[700px]:gap-2 md:gap-4">
              <button
                type="button"
                onClick={() => setCommandOpen(true)}
                aria-label="Search sections and records"
                className="nav-link flex flex-shrink-0 items-center justify-center gap-2 rounded text-xs hover:bg-secondary/70 transition-colors max-md:h-11 max-md:w-11 md:px-2.5 md:py-1.5"
              >
                <Search className="h-4 w-4 text-primary shrink-0 md:h-3.5 md:w-3.5" aria-hidden="true" />
                <span className="hidden md:inline">Search</span>
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
