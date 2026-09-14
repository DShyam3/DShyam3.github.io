/**
 * Per-provider *search* URLs, not deep links.
 *
 * TMDB's `watch/providers` only returns `results.GB.link`, a JustWatch page --
 * it does not expose the provider-specific ids a real deep link
 * (`netflix.com/title/{id}`) would need, and this site has no other source
 * for them. The buildable version is a search page on the provider's own
 * site, built from the platform `sync-logic.ts` already resolves and the
 * title already stored. It lands a viewer one click from playing, but it
 * does not open the title itself -- do not describe it as doing so anywhere
 * this is surfaced (see REHAUL_PLAN.md 8.C).
 *
 * Keyed off the exact display names `PLATFORM_ALLOWLIST` in `sync-logic.ts`
 * produces. `'Online'` and anything not on that allowlist have no known
 * search URL and return `null`.
 */

const PROVIDER_SEARCH_URLS: Record<string, (encodedTitle: string) => string> = {
  Netflix: (title) => `https://www.netflix.com/search?q=${title}`,
  'Prime Video': (title) => `https://www.amazon.co.uk/s?k=${title}&i=instant-video`,
  'Disney+': (title) => `https://www.disneyplus.com/search?q=${title}`,
  'Apple TV+': (title) => `https://tv.apple.com/search?term=${title}`,
  'BBC iPlayer': (title) => `https://www.bbc.co.uk/iplayer/search?q=${title}`,
  ITVX: (title) => `https://www.itv.com/search?query=${title}`,
};

/**
 * A search URL for `title` on `platform`, or `null` when the platform has no
 * known provider search page ('Online', or anything off the allowlist).
 */
export function providerSearchUrl(
  platform: string | undefined | null,
  title: string,
): string | null {
  if (!platform) return null;
  const buildUrl = PROVIDER_SEARCH_URLS[platform];
  if (!buildUrl) return null;
  return buildUrl(encodeURIComponent(title));
}
