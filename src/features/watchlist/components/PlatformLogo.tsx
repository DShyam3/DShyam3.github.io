import { cn } from '@/lib/utils';

interface LogoSpec {
  src: string;
  /** Wordmarks are wide; the square TMDB tiles are 1:1. */
  square?: boolean;
  /**
   * Single-colour dark marks disappear on a dark background. These get drawn
   * white there, which is how both brands present themselves on dark anyway.
   */
  whiteInDark?: boolean;
  /** Height multiplier for marks that are stacked rather than wide. */
  scale?: number;
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
  'Disney+': {
    src: '/platform-logos/disney-plus.svg',
    whiteInDark: true,
    // The wordmark sits under its arc, so it needs the extra height to read.
    scale: 1.5,
  },
  'Apple TV+': { src: '/platform-logos/apple-tv-plus.svg', whiteInDark: true },
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

  if (!logo) return null;

  return (
    <img
      src={logo.src}
      alt=""
      loading="lazy"
      decoding="async"
      className={cn(
        // `no-outline` opts out of the global img outline, which is meant for
        // photos and draws a box around a transparent wordmark.
        'object-contain shrink-0 no-outline',
        logo.square && 'rounded-[4px] ring-1 ring-border/40',
        logo.whiteInDark && 'dark:brightness-0 dark:invert',
        className,
      )}
      style={{
        height: size * (logo.scale ?? 1),
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
 * Platform indicator for cards and the detail dialog: the wordmark where the
 * platform has one, otherwise its name as a plain pill. "Online" is not a
 * brand, so it reads better spelled out than as a stand-in icon.
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
          'rounded bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground whitespace-nowrap',
          className,
        )}
      >
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
