import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ThemeToggle } from '@/components/ThemeToggle';
import { NavMenu } from './NavMenu';
import { DotMatrixText } from '@/components/dot-matrix/DotMatrixText';
import { DotMatrixIcon } from '@/components/dot-matrix/DotMatrixIcon';
import { socialIcons } from '@/components/icons/SocialIcons';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ASSETS_URL } from '@/lib/constants';


interface HeaderProps {
  title?: string;
  subtitle?: string;
}

export function Header({
  title = "Dhyan's website",
  subtitle = 'My Digital Garden',
}: HeaderProps) {
  const [socialOpen, setSocialOpen] = useState(false);
  const navigate = useNavigate();

  const socialLinks = useMemo(
    () => [
      {
        label: 'LinkedIn',
        href: 'https://www.linkedin.com/in/dhyan-shyam/',
        icon: 'linkedin' as const,
      },
      { label: 'GitHub', href: 'https://github.com/DShyam3', icon: 'github' as const },
      { label: 'Email', href: 'mailto:d.shyam1256@gmail.com', icon: 'mail' as const },
    ],
    [],
  );

  // Secret admin link handler
  const handleTitleClick = () => {
    navigate('/auth');
  };

  return (
    // `relative` is what NavMenu's panel hangs off: it spans the header's
    // full width from the bottom edge, so it has to resolve against the
    // header rather than the right-hand cluster the button sits in.
    <header className="app-header relative pt-5 pb-4 md:pt-6 md:pb-5 border-b border-border/50">
      <div className="px-4 md:px-0">
        {/* One row: identity on the left, page title and controls on the
            right. The nav strip that used to sit underneath is now the menu
            button in that right-hand cluster. */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          {/* Left side: Profile with social links */}
          <div className="flex items-start md:items-center justify-between w-full md:w-auto gap-2 md:gap-3">
            <div
              className="flex items-center gap-3 flex-shrink-0 cursor-pointer select-none transition-opacity hover:opacity-80 md:w-auto"
              onClick={() => navigate('/')}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  navigate('/');
                }
              }}
            >
              <img
                src={`${ASSETS_URL}/memoji.png`}
                alt="Dhyan Shyam memoji avatar"
                className="h-10 w-10 md:h-12 md:w-12 rounded-xl bg-secondary object-cover flex-shrink-0"
                loading="eager"
              />

              <div className="flex flex-col items-start gap-0.5 leading-none">
                <DotMatrixText
                  text="DHYAN SHYAM"
                  size="md"
                  className="text-foreground"
                />
                <DotMatrixText
                  text="ROBOTIC ENGINEER"
                  size="xs"
                  className="text-muted-foreground"
                />
              </div>
            </div>

            <div className="flex items-center gap-1 md:gap-3 flex-shrink-0">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 order-2 md:order-1 flex-shrink-0"
                onClick={() => setSocialOpen((v) => !v)}
                aria-label="Open social links"
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

              {/* Social links - appear horizontally to the side */}
              <div
                className={cn(
                  'flex items-center gap-1 md:gap-2 overflow-hidden transition-[max-width,opacity,margin] duration-200 order-1 md:order-2 justify-end md:justify-start',
                  socialOpen
                    ? 'max-w-[200px] opacity-100 mr-1 md:mr-0'
                    : 'max-w-0 opacity-0 mr-0',
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
                      className="p-1.5 md:p-2 text-foreground hover:bg-secondary/50 rounded transition-colors flex-shrink-0"
                    >
                      <Icon className="h-5 w-5 md:h-6 md:w-6" />
                    </a>
                  );
                })}
              </div>
            </div>
          </div>

          {/* `justify-between` is for the phone, where this cluster is its own
              full-width row: the title takes the left edge and the two
              controls the right, rather than all three bunching at the left
              with the leftover width trailing off the end. From md the row is
              only as wide as its contents and the property does nothing. */}
          <div className="flex items-center justify-between gap-3 md:gap-4">
            <div
              className="text-left md:text-right cursor-pointer select-none active:opacity-70 transition-opacity"
              onClick={handleTitleClick}
            >
              <div>
                <DotMatrixText
                  text={title.toUpperCase()}
                  size="sm"
                  className="text-foreground justify-start md:justify-end"
                />
              </div>
              <div>
                <DotMatrixText
                  text={subtitle.toUpperCase()}
                  size="xs"
                  className="text-muted-foreground justify-start md:justify-end mt-1"
                />
              </div>
            </div>
            {/* After the title rather than before it. On its own between the
                two identity blocks the button had nothing to line up with:
                both neighbours are two stacked lines of Doto and it is one
                line of it, centred in the gap. Kept with the theme toggle it
                joins the only other control on this side, and the pair read
                as a control cluster pinned to the right edge instead of one
                label adrift in the whitespace. */}
            <div className="flex flex-shrink-0 items-center gap-2 md:gap-4">
              <NavMenu />
              <ThemeToggle />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
