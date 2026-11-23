/**
 * Reload when a lazy page's file is gone because a newer build is live.
 *
 * Every deploy replaces the hashed files under /assets, so a tab opened before
 * it still asks for the old names (`Dev-Bh8fq8UC.js` after the build that
 * made `Dev-2ZNEztG4.js`), gets a 404, and the page fails to load. Vite
 * reports every failed lazy import as `vite:preloadError`, background
 * warm-ups (`warmChunk`) included, and those also fail on a network blip or
 * offline. So a failure reloads only once the site's index names a different
 * entry script from the one this page runs: a newer build is live, and the
 * reload fetches it. Offline, a blip, or the same build: no reload, and the
 * failure is handled as before.
 *
 * After a reload the page runs the build the index names, so it cannot loop.
 * At most one reload per page build besides, so two CDN edges serving
 * different builds cannot bounce the page between them.
 */

const RELOADED_FROM_KEY = 'stale-chunk-reloaded-from';

/** The first module script's src in a page's HTML: its entry. Null if none. */
export function entryOf(html: string): string | null {
  for (const [tag] of html.matchAll(/<script\b[^>]*>/gi)) {
    if (!/\btype=["']?module\b/i.test(tag)) continue;
    const src = /\bsrc=["']?([^"'\s>]+)/i.exec(tag)?.[1];
    if (src) return src;
  }
  return null;
}

/** Whether the site's index names an entry other than `entry`; false when it cannot tell. */
export async function newerBuildLive(entry: string, fetchIndex: () => Promise<Response>): Promise<boolean> {
  try {
    const response = await fetchIndex();
    if (!response.ok) return false;
    const live = entryOf(await response.text());
    return live !== null && live !== entry;
  } catch {
    return false;
  }
}

/** Records a reload from `entry`; true if this page build already reloaded once. */
function alreadyReloadedFrom(win: Window, entry: string): boolean {
  try {
    if (win.sessionStorage.getItem(RELOADED_FROM_KEY) === entry) return true;
    win.sessionStorage.setItem(RELOADED_FROM_KEY, entry);
  } catch {
    // No storage: the build check alone stops a loop.
  }
  return false;
}

export function installStaleChunkReload(
  win: Window = window,
  fetchIndex: () => Promise<Response> = () => win.fetch(import.meta.env.BASE_URL, { cache: 'no-store' }),
) {
  // Null in dev, where Vite serves modules by name and nothing goes stale.
  const entry = win.document.querySelector('script[type="module"][src]')?.getAttribute('src') ?? null;
  if (!entry) return;
  // One check at a time: a page's warm-ups can fail together.
  let checking: Promise<void> | null = null;
  win.addEventListener('vite:preloadError', () => {
    checking ??= newerBuildLive(entry, fetchIndex).then((newer) => {
      checking = null;
      if (newer && !alreadyReloadedFrom(win, entry)) win.location.reload();
    });
  });
}
