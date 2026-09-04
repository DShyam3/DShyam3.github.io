import { Globe } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LogoSpec {
  src: string;
  /** Wordmarks are wide; the square TMDB tiles are 1:1. */
  square?: boolean;
  /** Single-colour dark marks need flipping on a dark background. */
  invertInDark?: boolean;
}

/**
 * Provider artwork downloaded by `scripts/fetch-platform-logos.mjs` and
 * committed under public/platform-logos. Full wordmarks where one exists
 * (they read far better at badge size than an app-tile glyph); the square
 * TMDB tile is the fallback for the rest.
 */
const PLATFORM_LOGOS: Record<string, LogoSpec> = {
  Netflix: { src: '/platform-logos/netflix.svg' },
  'Prime Video': { src: '/platform-logos/prime-video.svg' },
  'Disney+': { src: '/platform-logos/disney-plus.svg' },
  'Apple TV+': { src: '/platform-logos/apple-tv-plus.svg', invertInDark: true },
  'BBC iPlayer': { src: '/platform-logos/bbc-iplayer.svg' },
  ITVX: { src: '/platform-logos/itvx.png', square: true },
};

export const hasPlatformLogo = (platform?: string) =>
  !!platform && platform in PLATFORM_LOGOS;

interface PlatformLogoProps {
  platform?: string;
  /** Logo height in pixels; wordmarks keep their aspect ratio up to `maxWidth`. */
  size?: number;
  maxWidth?: number;
  className?: string;
}

/** Official mark for a streaming platform, sized by height. */
export function PlatformLogo({
  platform,
  size = 18,
  maxWidth = 76,
  className,
}: PlatformLogoProps) {
  const logo = platform ? PLATFORM_LOGOS[platform] : undefined;

  if (!logo) {
    return (
      <span
        className={cn(
          'inline-flex items-center justify-center rounded-[4px] bg-muted text-muted-foreground shrink-0',
          className,
        )}
        style={{ width: size, height: size }}
        aria-hidden="true"
      >
        <Globe style={{ width: size * 0.6, height: size * 0.6 }} />
      </span>
    );
  }

  return (
    <img
      src={logo.src}
      alt=""
      loading="lazy"
      decoding="async"
      className={cn(
        'object-contain shrink-0',
        logo.square && 'rounded-[4px] ring-1 ring-border/40',
        logo.invertInDark && 'dark:invert',
        className,
      )}
      style={{
        height: size,
        width: logo.square ? size : 'auto',
        maxWidth: logo.square ? undefined : maxWidth,
      }}
    />
  );
}

interface PlatformBadgeProps {
  platform?: string;
  size?: number;
  maxWidth?: number;
  className?: string;
}

/**
 * Platform indicator for cards and the detail dialog. Platforms with a mark of
 * their own show it on its own (named for screen readers and on hover);
 * anything else keeps a plain text pill.
 */
export function PlatformBadge({
  platform,
  size = 18,
  maxWidth,
  className,
}: PlatformBadgeProps) {
  if (!platform) return null;

  if (!hasPlatformLogo(platform)) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground whitespace-nowrap',
          className,
        )}
      >
        <PlatformLogo platform={platform} size={size * 0.75} />
        {platform}
      </span>
    );
  }

  return (
    <span className={cn('inline-flex items-center', className)} title={platform}>
      <PlatformLogo platform={platform} size={size} maxWidth={maxWidth} />
      <span className="sr-only">{platform}</span>
    </span>
  );
}
