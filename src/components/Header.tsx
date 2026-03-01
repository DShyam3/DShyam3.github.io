import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ThemeToggle } from './ThemeToggle';
import { SiteNav } from './SiteNav';
import { DotMatrixText } from './DotMatrixText';
import { DotMatrixIcon } from './DotMatrixIcon';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

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
    navigate('/admin');
  };

  return (
    <header className="pt-8 pb-6 md:pt-10 md:pb-8 border-b border-border/50">
      <div className="px-4 md:px-0">
        {/* Top row: Profile on left, Theme on right */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
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
                src="/memoji.png"
                alt="Dhyan Shyam memoji avatar"
                className="h-10 w-10 md:h-12 md:w-12 rounded-full bg-secondary object-cover flex-shrink-0"
                loading="eager"
              />

              <div className="flex flex-col gap-1">
                <DotMatrixText
                  text="DHYAN SHYAM"
                  size="md"
                  className="text-muted-foreground"
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
                {socialLinks.map(({ label, href, icon }) => (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    className="p-1.5 md:p-2 hover:bg-secondary/50 rounded transition-colors flex-shrink-0"
                  >
                    <img
                      src={`/${icon === 'mail' ? 'gmail' : icon}.svg`}
                      alt={label}
                      className="h-5 w-5 md:h-6 md:w-6 dark:invert dark:brightness-0 dark:contrast-200"
                    />
                  </a>
                ))}
              </div>
            </div>
          </div>

          {/* Right side: Title (secret admin link) + Theme toggle */}
          <div className="flex items-center gap-4">
            <div
              className="text-right cursor-default select-none"
              onClick={handleTitleClick}
              role="button"
              tabIndex={-1}
            >
              <div>
                <DotMatrixText
                  text={title.toUpperCase()}
                  size="sm"
                  className="text-foreground justify-end"
                />
              </div>
              <div>
                <DotMatrixText
                  text={subtitle.toUpperCase()}
                  size="xs"
                  className="text-muted-foreground justify-end mt-1"
                />
              </div>
            </div>
            <ThemeToggle />
          </div>
        </div>

        {/* Bottom row: Navigation links */}
        <div className="flex items-center">
          <SiteNav align="start" className="mb-0 px-0 flex-1" />
        </div>
      </div>
    </header>
  );
}
