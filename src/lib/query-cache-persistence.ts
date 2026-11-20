import { dehydrate, hydrate, type DehydratedState, type QueryClient, type QueryKey } from '@tanstack/react-query';

const DB_NAME = 'dshyam-public-query-cache';
const STORE_NAME = 'snapshots';
const RECORD_KEY = 'v1';

/** Bump whenever a persisted query's row shape changes incompatibly. */
export const PUBLIC_CACHE_VERSION = 1;

/** Discard persisted snapshots older than 24 hours. */
export const MAX_PERSISTED_AGE_MS = 24 * 60 * 60 * 1000;

const PERSIST_DEBOUNCE_MS = 1_500;

const PUBLIC_COLLECTION_TABLES = new Set([
  'site_content',
  'books',
  'projects',
  'inventory_items',
  'articles',
  'inspirations',
  'links',
  'photos',
  'recipes',
  'thoughts',
]);

const PUBLIC_WATCHLIST_KEYS = new Set([
  'library',
  'schedule',
  'news',
  'diary',
  'viewing-orders',
  'tmdb-details',
  'tmdb-collection',
  'tmdb-spinoffs',
  'tv-spinoffs',
  'tmdb-film-universes',
  'film-universes',
]);

/**
 * Strict allowlist of query keys safe to persist in browser IndexedDB.
 *
 * Finance, Beliefs, personal Watchlist ratings/sync_log/dismissals, signed
 * Travel photo URLs, and admin Travel journal rows are never persisted to disk.
 */
export function isPersistablePublicQueryKey(queryKey: QueryKey): boolean {
  if (!Array.isArray(queryKey) || queryKey.length === 0) return false;
  const [root, second, third] = queryKey;
  if (typeof root !== 'string') return false;

  if (PUBLIC_COLLECTION_TABLES.has(root)) return true;
  if (root === 'favourites' && second === 'titles') return true;
  if (root === 'travel' && (second === 'visited-countries' || second === 'visited-cities')) return true;
  if (root === 'travel-journal' && second === 'public' && third === false) return true;
  if (root === 'watchlist' && typeof second === 'string' && PUBLIC_WATCHLIST_KEYS.has(second)) return true;

  return false;
}

interface PersistedSnapshot {
  version: number;
  savedAt: number;
  state: DehydratedState;
}

function openCacheDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function readSnapshot(): Promise<PersistedSnapshot | null> {
  const db = await openCacheDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const request = tx.objectStore(STORE_NAME).get(RECORD_KEY);
      request.onsuccess = () => {
        db.close();
        const result = request.result as PersistedSnapshot | undefined;
        resolve(result && typeof result === 'object' ? result : null);
      };
      request.onerror = () => {
        db.close();
        resolve(null);
      };
    } catch {
      db.close();
      resolve(null);
    }
  });
}

async function writeSnapshot(snapshot: PersistedSnapshot): Promise<void> {
  const db = await openCacheDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(snapshot, RECORD_KEY);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
      tx.onabort = () => {
        db.close();
        resolve();
      };
    } catch {
      db.close();
      resolve();
    }
  });
}

/** Build a dehydrated snapshot containing only successful, allowlisted public queries. */
export function buildPublicSnapshot(queryClient: QueryClient, now = Date.now()): PersistedSnapshot {
  const state = dehydrate(queryClient, {
    shouldDehydrateMutation: () => false,
    shouldDehydrateQuery: (query) =>
      query.state.status === 'success'
      && query.state.data !== undefined
      && isPersistablePublicQueryKey(query.queryKey),
  });
  return {
    version: PUBLIC_CACHE_VERSION,
    savedAt: now,
    state,
  };
}

/** Filter a persisted snapshot to fresh, allowlisted queries and hydrate into `queryClient`. */
export function hydratePublicSnapshot(
  queryClient: QueryClient,
  snapshot: PersistedSnapshot | null,
  now = Date.now(),
): number {
  if (!snapshot || snapshot.version !== PUBLIC_CACHE_VERSION) return 0;
  if (now - snapshot.savedAt > MAX_PERSISTED_AGE_MS) return 0;
  const queries = (snapshot.state?.queries ?? []).filter((entry) => {
    if (!isPersistablePublicQueryKey(entry.queryKey)) return false;
    const updatedAt = entry.state?.dataUpdatedAt ?? 0;
    if (updatedAt > 0 && now - updatedAt > MAX_PERSISTED_AGE_MS) return false;
    // Never overwrite fresher data that already landed in memory during boot.
    const existing = queryClient.getQueryState(entry.queryKey);
    if (existing && existing.dataUpdatedAt >= updatedAt && existing.data !== undefined) return false;
    return true;
  });
  if (queries.length === 0) return 0;
  hydrate(queryClient, { mutations: [], queries });
  return queries.length;
}

/**
 * Hydrates public queries from IndexedDB on startup and debounces subsequent
 * public cache updates back to IndexedDB. Safe no-op when IndexedDB is absent
 * or blocked (e.g. private browsing, tests).
 */
export function attachPublicQueryPersistence(queryClient: QueryClient): () => void {
  if (typeof indexedDB === 'undefined') return () => {};

  let disposed = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  void readSnapshot().then((snapshot) => {
    if (!disposed) hydratePublicSnapshot(queryClient, snapshot);
  });

  const schedulePersist = () => {
    if (disposed) return;
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      if (disposed) return;
      void writeSnapshot(buildPublicSnapshot(queryClient));
    }, PERSIST_DEBOUNCE_MS);
  };

  const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
    if (event.type !== 'updated' && event.type !== 'removed') return;
    if (!isPersistablePublicQueryKey(event.query.queryKey)) return;
    if (event.type === 'updated' && event.query.state.status !== 'success') return;
    schedulePersist();
  });

  return () => {
    disposed = true;
    if (timer !== null) clearTimeout(timer);
    unsubscribe();
  };
}
