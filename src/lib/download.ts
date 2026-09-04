/**
 * Save a file the browser would otherwise just navigate to.
 *
 * `<a download>` is ignored for cross-origin URLs -- a rule browsers apply so
 * a page cannot silently pull files off other sites -- and everything the site
 * offers (photos, the CV) lives in Supabase storage on another origin. So the
 * attribute did nothing and the click simply opened the file in a tab.
 *
 * Fetching the bytes first sidesteps that: a blob: URL is same-origin, so
 * `download` is honoured and the browser saves the file under the name given.
 * It costs one extra request, which is why this is only used on an explicit
 * download click.
 */
async function saveBlob(url: string, filename: string): Promise<boolean> {
  try {
    const response = await fetch(url);
    if (!response.ok) return false;

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    // Safari reads the blob after the click returns, so hold the URL a moment
    // rather than revoking it immediately.
    setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000);
    return true;
  } catch {
    // Storage without CORS, an offline tab, a blocked request: the caller has
    // already opened the file in a tab, which is the honest fallback.
    return false;
  }
}

/**
 * The extension the file actually has, taken from its URL.
 *
 * Download names come from human-facing titles -- a photo's caption, say --
 * which carry no extension, and a file saved as "Avatar Memoji" with no
 * suffix opens in nothing.
 */
function withExtension(name: string, url: string): string {
  const path = url.split('?')[0].split('#')[0];
  const match = /\.([a-z0-9]{2,5})$/i.exec(path);
  if (!match) return name;
  return name.toLowerCase().endsWith(match[0].toLowerCase()) ? name : `${name}${match[0]}`;
}

/**
 * Open a file in a new tab *and* save it.
 *
 * Both, deliberately: the tab is how you look at the thing, the save is what
 * the button says it does. Call this straight from a click handler -- the
 * window.open has to happen inside the user gesture or the popup blocker eats
 * it, and the fetch that follows does not.
 */
export function openAndDownload(url: string, name: string): void {
  window.open(url, '_blank', 'noopener,noreferrer');
  void saveBlob(url, withExtension(name, url));
}
