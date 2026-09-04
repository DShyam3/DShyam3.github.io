import { Globe } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Official provider artwork, downloaded from TMDB by
 * `scripts/fetch-platform-logos.mjs` and committed under public/platform-logos.
 * Anything not listed here (including the "Online" catch-all) falls back to a
 * neutral globe tile so the badge shape stays consistent.
 */
const PLATFORM_LOGOS: Record<string, string> = {
  Netflix: '/platform-logos/netflix.png',
  'Prime Video': '/platform-logos/prime-video.png',
  'Disney+': '/platform-logos/disney-plus.png',
  'Apple TV+': '/platform-logos/apple-tv-plus.png',
  'BBC iPlayer': '/platform-logos/bbc-iplayer.png',
  ITVX: '/platform-logos/itvx.png',
};

export const hasPlatformLogo = (platform?: string) =>
  !!platform && platform in PLATFORM_LOGOS;

interface PlatformLogoProps {
  platform?: string;
  /** Tile edge length in pixels. */
  size?: number;
  className?: string;
}

/** Square, rounded brand tile for a streaming platform. */
export function PlatformLogo({
  platform,
  size = 20,
  className,
}: PlatformLogoProps) {
  const src = platform ? PLATFORM_LOGOS[platform] : undefined;

  if (!src) {
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
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      className={cn(
        'rounded-[4px] object-contain shrink-0 ring-1 ring-border/40',
        className,
      )}
      style={{ width: size, height: size }}
    />
  );
}

interface PlatformBadgeProps {
  platform?: string;
  /** Show the platform name next to the logo. Off by default: the mark speaks. */
  showLabel?: boolean;
  size?: number;
  className?: string;
}

/**
 * Platform indicator used on cards and in the detail dialog. Platforms with a
 * real logo show the logo alone (named for screen readers and on hover);
 * everything else keeps a plain text pill.
 */
export function PlatformBadge({
  platform,
  showLabel = false,
  size = 20,
  className,
}: PlatformBadgeProps) {
  if (!platform) return null;

  const logo = hasPlatformLogo(platform);

  if (!logo && !showLabel) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground whitespace-nowrap',
          className,
        )}
      >
        <PlatformLogo platform={platform} size={size * 0.7} />
        {platform}
      </span>
    );
  }

  return (
    <span
      className={cn('inline-flex items-center gap-2 whitespace-nowrap', className)}
      title={platform}
    >
      <PlatformLogo platform={platform} size={size} />
      {showLabel && (
        <span className="text-xs font-medium text-foreground">{platform}</span>
      )}
      {!showLabel && <span className="sr-only">{platform}</span>}
    </span>
  );
}
