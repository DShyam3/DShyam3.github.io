/**
 * High-DPI and Apple ecosystem icon resolution for the Links collection.
 *
 * - Upgrades low-resolution Google S2 favicons (`sz=32`, `sz=64`, `sz=128`)
 *   to 256px Retina resolution (`sz=256`).
 * - Supplies a crisp vector Apple glyph for generic Apple domains
 *   (`apple.com`, `apps.apple.com`, `developer.apple.com`, `icloud.com`) when
 *   only a generic domain favicon or no icon is stored.
 * - Preserves custom uploaded icons (e.g. Supabase storage or explicit app
 *   artwork URLs) untouched.
 */

const APPLE_LOGO_SVG_DATA_URI =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 170 170" fill="#1d1d1f"><path d="M132.2 121.6c-2.6 6-5.7 11.5-9.5 16.5-5 6.6-9.1 11.2-12.3 13.8-4.9 4.2-10.2 6.4-15.9 6.5-4.1 0-9-1.2-14.8-3.5-5.8-2.3-11.1-3.5-15.9-3.5-5 0-10.4 1.2-16.2 3.5-5.8 2.3-10.5 3.6-14.1 3.7-5.5.2-10.9-2-16.2-6.7-3.5-3-7.8-7.8-12.9-14.4-5.5-7.1-10-15.3-13.5-24.6-3.8-10-5.7-19.7-5.7-29.1 0-10.8 2.7-20.1 8.1-27.9 4.3-6.2 10-11.1 17.1-14.7 7.1-3.6 14.8-5.5 23-5.6 4.5 0 10.4 1.4 17.8 4.2 7.3 2.8 12 4.2 14.1 4.2 1.6 0 6.8-1.6 15.6-4.9 8.4-3 15.5-4.3 21.3-3.8 15.8 1.3 27.7 7.5 35.6 18.7-14.1 8.6-21.1 20.6-20.9 36.1.2 12 4.7 22 13.4 29.9 4 3.8 8.7 6.7 14.1 8.8-1.1 3.3-2.4 6.5-3.9 9.7zM110.5 9.2c0 9.4-3.4 18.2-10.3 26.3-8.3 9.7-18.3 15.3-29.2 14.4-.2-1.1-.3-2.3-.3-3.5 0-9 3.9-18.6 10.8-26.5 3.4-3.9 7.8-7.2 13.1-9.8 5.3-2.6 10.3-4 15.1-4.3.5 1.2.8 2.3.8 3.4z"/></svg>',
  );

const APPLE_HOSTS = new Set([
  'apple.com',
  'www.apple.com',
  'apps.apple.com',
  'itunes.apple.com',
  'developer.apple.com',
  'icloud.com',
  'www.icloud.com',
  'support.apple.com',
  'testflight.apple.com',
]);

/** Hosts whose direct asset URLs send Cross-Origin-Resource-Policy: same-origin (ERR_BLOCKED_BY_ORB). */
const ORB_BLOCKED_ICON_HOSTS = new Set([
  'code.visualstudio.com',
]);

export function parseLinkUrl(value: string): URL | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    return new URL(trimmed);
  } catch {
    try {
      return new URL(`https://${trimmed}`);
    } catch {
      return null;
    }
  }
}

export function isAppleHost(hostname: string): boolean {
  const clean = hostname.toLowerCase();
  return APPLE_HOSTS.has(clean) || clean.endsWith('.apple.com');
}

export function buildHighDpiFaviconUrl(hostname: string): string {
  if (isAppleHost(hostname)) {
    return APPLE_LOGO_SVG_DATA_URI;
  }
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=256`;
}

/**
 * Resolves the best display icon for a link row:
 * - Custom uploaded / third-party icon URLs are returned as-is.
 * - Google S2 favicon URLs are upgraded to `sz=256` (or the vector Apple mark
 *   if the domain is an Apple host).
 * - Missing icons fall back to a derived high-DPI icon from `url`.
 */
export function resolveLinkIcon(icon: string | null | undefined, url: string): string | undefined {
  const trimmedIcon = icon?.trim();
  const parsedTarget = parseLinkUrl(url);

  if (trimmedIcon) {
    try {
      const iconUrl = new URL(trimmedIcon);
      if (ORB_BLOCKED_ICON_HOSTS.has(iconUrl.hostname.toLowerCase())) {
        return buildHighDpiFaviconUrl(iconUrl.hostname);
      }
      if (
        iconUrl.hostname === 'www.google.com' &&
        iconUrl.pathname.startsWith('/s2/favicons')
      ) {
        const domain = iconUrl.searchParams.get('domain') || parsedTarget?.hostname;
        if (domain) {
          return buildHighDpiFaviconUrl(domain);
        }
      }
    } catch {
      // Relative or data: URI — keep as stored.
    }
    return trimmedIcon;
  }

  if (parsedTarget?.hostname) {
    return buildHighDpiFaviconUrl(parsedTarget.hostname);
  }

  return undefined;
}
