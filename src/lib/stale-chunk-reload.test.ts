import { describe, expect, it, vi } from 'vitest';
import { entryOf, installStaleChunkReload, newerBuildLive } from './stale-chunk-reload';

const indexFor = (entry: string) =>
  `<!doctype html><html><head><script defer src="https://cloud.umami.is/script.js"></script>`
  + `<script type="module" crossorigin src="${entry}"></script></head><body><div id="root"></div></body></html>`;
const respond = (html: string, status = 200) => () => Promise.resolve(new Response(html, { status }));
const offline = () => Promise.reject(new TypeError('Failed to fetch'));

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => { values.delete(key); },
    setItem: (key, value) => { values.set(key, String(value)); },
  };
}

/** A window running `entry`, with sessionStorage, or one that throws on read. */
function fakeWindow(entry: string | null, storage: Storage | null = memoryStorage()) {
  const target = new EventTarget();
  const reload = vi.fn();
  Object.defineProperties(target, {
    document: { value: { querySelector: () => (entry ? { getAttribute: () => entry } : null) } },
    location: { value: { reload } },
    sessionStorage: {
      get(): Storage {
        if (!storage) throw new DOMException('blocked', 'SecurityError');
        return storage;
      },
    },
  });
  return { win: target as unknown as Window, reload };
}

const preloadError = () => new Event('vite:preloadError', { cancelable: true });
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('entryOf', () => {
  it('finds the first module script, whatever the attribute order', () => {
    expect(entryOf(indexFor('/assets/index-B.js'))).toBe('/assets/index-B.js');
    expect(entryOf('<script src=/assets/index-C.js type=module></script>')).toBe('/assets/index-C.js');
  });

  it('finds none in a page that is not the site’s index', () => {
    expect(entryOf('<html><body>Sign in to the Wi-Fi</body></html>')).toBeNull();
    expect(entryOf('<script type="application/ld+json">{}</script>')).toBeNull();
  });
});

describe('newerBuildLive', () => {
  it('is true only when the index names another entry', async () => {
    expect(await newerBuildLive('/assets/index-A.js', respond(indexFor('/assets/index-B.js')))).toBe(true);
    expect(await newerBuildLive('/assets/index-A.js', respond(indexFor('/assets/index-A.js')))).toBe(false);
  });

  it('is false when it cannot tell: offline, an error status, or a page with no entry', async () => {
    expect(await newerBuildLive('/assets/index-A.js', offline)).toBe(false);
    expect(await newerBuildLive('/assets/index-A.js', respond(indexFor('/assets/index-B.js'), 503))).toBe(false);
    expect(await newerBuildLive('/assets/index-A.js', respond('<html>Sign in to the Wi-Fi</html>'))).toBe(false);
  });
});

describe('installStaleChunkReload', () => {
  it('reloads when a newer build is live, and lets the error reach the page', async () => {
    const { win, reload } = fakeWindow('/assets/index-A.js');
    installStaleChunkReload(win, respond(indexFor('/assets/index-B.js')));
    const event = preloadError();
    win.dispatchEvent(event);
    await settle();
    expect(reload).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(false);
  });

  it('does not reload for the same build, or offline: a failed warm-up stays quiet', async () => {
    for (const fetchIndex of [respond(indexFor('/assets/index-A.js')), offline]) {
      const { win, reload } = fakeWindow('/assets/index-A.js');
      installStaleChunkReload(win, fetchIndex);
      win.dispatchEvent(preloadError());
      await settle();
      expect(reload).not.toHaveBeenCalled();
    }
  });

  it('checks once for failures that arrive together', async () => {
    const { win, reload } = fakeWindow('/assets/index-A.js');
    const fetchIndex = vi.fn(respond(indexFor('/assets/index-B.js')));
    installStaleChunkReload(win, fetchIndex);
    for (let i = 0; i < 20; i++) win.dispatchEvent(preloadError());
    await settle();
    expect(fetchIndex).toHaveBeenCalledTimes(1);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('reloads at most once from a page build, so mismatched edges cannot bounce it', async () => {
    const storage = memoryStorage();
    for (let load = 0; load < 2; load++) {
      // An edge still serving build A after the reload: A runs again, the index says B.
      const { win, reload } = fakeWindow('/assets/index-A.js', storage);
      installStaleChunkReload(win, respond(indexFor('/assets/index-B.js')));
      win.dispatchEvent(preloadError());
      await settle();
      expect(reload).toHaveBeenCalledTimes(load === 0 ? 1 : 0);
    }
  });

  it('still reloads for a newer build without sessionStorage', async () => {
    const { win, reload } = fakeWindow('/assets/index-A.js', null);
    installStaleChunkReload(win, respond(indexFor('/assets/index-B.js')));
    win.dispatchEvent(preloadError());
    await settle();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('does nothing in dev, where there is no entry script', async () => {
    const { win, reload } = fakeWindow(null);
    const fetchIndex = vi.fn(respond(indexFor('/assets/index-B.js')));
    installStaleChunkReload(win, fetchIndex);
    win.dispatchEvent(preloadError());
    await settle();
    expect(fetchIndex).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });
});
