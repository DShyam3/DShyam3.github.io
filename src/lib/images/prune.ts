import { useEffect } from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { inChunks } from '@/lib/in-chunks';
import { MAX_PERSISTED_AGE_MS } from '@/lib/query-cache-persistence';
import { IMAGE_BUCKET, imageCacheQuery, withImageCacheLock, type ImageCacheRow } from './image-cache';
import { sha256Hex } from './raster';

/**
 * Clearing out copies nothing shows any more. The index only grows otherwise:
 * a record whose picture changes leaves its old source's row and copy behind,
 * a redone copy (a new cutout version, the owner's background choice) leaves
 * its old file, and a replacement found for one record but refused by it
 * leaves a copy no record names.
 *
 * Run in the owner's browser rather than a scheduled job, for two reasons.
 * What a card shows is worked out in the browser (`card.image`: a link with no
 * icon shows a favicon address built from its URL), so only the browser knows
 * every source in use. And a stored file can only be deleted through the
 * Storage API, never by SQL, so a database job could drop rows but not files.
 */

/**
 * How long a copy outlives its last use. Covers two races: a record added, or
 * a copy made, while the prune is reading; and a visitor whose saved index
 * (kept up to a day, `MAX_PERSISTED_AGE_MS`) or open tab still shows a copy
 * the owner has just stopped using or redone.
 */
export const PRUNE_GRACE_MS = 2 * MAX_PERSISTED_AGE_MS;
/** At most one prune a day per browser: it reads two collections, the index and the bucket listing. */
export const PRUNE_EVERY_MS = 24 * 60 * 60 * 1000;
/**
 * More than this share of the index unused is taken as a wrong reading (a
 * source list cut short, a change to how a card picks its picture), not as
 * real disuse: no unused rows are dropped and a warning is logged.
 */
export const MAX_PRUNE_SHARE = 0.5;
/** Waits for the page to settle before reading anything. */
const PRUNE_DELAY_MS = 5_000;
const LAST_PRUNE_KEY = 'image-cache:pruned-at';
const UNUSED_SINCE_KEY = 'image-cache:unused-since';
const LIST_PAGE = 1_000;
const DELETE_CHUNK = 100;

/** A file in the bucket, as the Storage API lists it. A folder has no id. */
export interface StoredFile {
  name: string;
  id: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

/** When each unused row's source was first seen unused, by `source_hash`, in ms. */
export type UnusedSince = Record<string, number>;

export interface PruneInput {
  /** Every index row. */
  rows: readonly ImageCacheRow[];
  /** Every file in the bucket. */
  files: readonly StoredFile[];
  /** Every source a card shows, and the hash of each. */
  inUse: ReadonlySet<string>;
  inUseHashes: ReadonlySet<string>;
  /** From the last prune in this browser. */
  unusedSince: UnusedSince;
}

export interface PrunePlan {
  /** `source_hash` of each index row to delete. */
  rows: string[];
  /** Bucket paths to delete. */
  files: string[];
  /** Unused rows were held back by `MAX_PRUNE_SHARE`; rows with missing files, and files no row names, still go. */
  refused: boolean;
  /** To keep for the next prune: the unused rows, each with when it was first seen unused. */
  unusedSince: UnusedSince;
}

const age = (now: number, iso: string | null | undefined): number => {
  const at = iso ? Date.parse(iso) : NaN;
  // An unknown time is treated as just now: never old enough to delete.
  return Number.isNaN(at) ? 0 : now - at;
};

/** The source hash a stored name starts with (`storagePathFor`). */
export const hashOf = (name: string): string | undefined => /^([0-9a-f]{64})-/.exec(name)?.[1];

/**
 * What can go.
 *
 * A row: when no card has shown its source for `PRUNE_GRACE_MS` (as far as
 * this browser has seen), or when its file is missing -- dropped so the worker
 * copies it again rather than every visitor seeing a broken picture. Either
 * way only once it was last written more than `PRUNE_GRACE_MS` ago.
 *
 * A file: when no remaining row names it, it was written more than
 * `PRUNE_GRACE_MS` ago, and the row for its source, if one remains, moved off
 * it more than `PRUNE_GRACE_MS` ago. Never a file of a source in use that has
 * no row: the index read is what is in doubt then, not the file.
 */
export function prunePlan({ rows, files, inUse, inUseHashes, unusedSince }: PruneInput, now: number): PrunePlan {
  const listed = new Set(files.filter((file) => file.id).map((file) => file.name));
  const seen: UnusedSince = {};
  const unused: string[] = [];
  const missing: string[] = [];
  for (const row of rows) {
    const used = inUse.has(row.source_url);
    if (!used) seen[row.source_hash] = Math.min(unusedSince[row.source_hash] ?? now, now);
    if (age(now, row.processed_at) < PRUNE_GRACE_MS) continue;
    if (row.storage_path !== null && !listed.has(row.storage_path)) missing.push(row.source_hash);
    else if (!used && now - seen[row.source_hash] >= PRUNE_GRACE_MS) unused.push(row.source_hash);
  }
  // Missing files are not held back by the share: the listing is the owner's
  // own reading of the bucket, and however many are gone, a row naming a
  // missing file only ever shows a broken picture.
  const refused = unused.length > rows.length * MAX_PRUNE_SHARE;
  const dropped = new Set([...missing, ...(refused ? [] : unused)]);
  const kept = rows.filter((row) => !dropped.has(row.source_hash));

  const named = new Set(kept.map((row) => row.storage_path).filter((path): path is string => Boolean(path)));
  const keptByHash = new Map(kept.map((row) => [row.source_hash, row]));
  const deletable = files.filter((file) => {
    if (!file.id || named.has(file.name)) return false;
    if (age(now, file.updated_at ?? file.created_at) < PRUNE_GRACE_MS) return false;
    const hash = hashOf(file.name);
    const owner = hash ? keptByHash.get(hash) : undefined;
    if (owner) return age(now, owner.processed_at) >= PRUNE_GRACE_MS;
    return !(hash && inUseHashes.has(hash));
  });

  return { rows: [...dropped], files: deletable.map((file) => file.name), refused, unusedSince: seen };
}

/** Every file in the bucket, page by page until a page comes back empty. */
async function listFiles(): Promise<StoredFile[]> {
  const files: StoredFile[] = [];
  for (let offset = 0; ; ) {
    const { data, error } = await supabase.storage
      .from(IMAGE_BUCKET)
      .list('', { limit: LIST_PAGE, offset, sortBy: { column: 'name', order: 'asc' } });
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) return files;
    files.push(...data);
    offset += data.length;
  }
}

/** Where a browser keeps what it saw unused at its last prune. */
export interface PruneMemory {
  read(): UnusedSince;
  write(value: UnusedSince): void;
}

/** In localStorage. Without it nothing is remembered, so no row is ever old enough to drop. */
const browserMemory: PruneMemory = {
  read() {
    try {
      const parsed: unknown = JSON.parse(window.localStorage.getItem(UNUSED_SINCE_KEY) ?? '{}');
      if (!parsed || typeof parsed !== 'object') return {};
      return Object.fromEntries(
        Object.entries(parsed).filter((entry): entry is [string, number] => typeof entry[1] === 'number'),
      );
    } catch {
      return {};
    }
  },
  write(value) {
    try {
      window.localStorage.setItem(UNUSED_SINCE_KEY, JSON.stringify(value));
    } catch {
      // Nothing remembered: see read().
    }
  },
};

const NOTHING = { rows: 0, files: 0 };

/**
 * Deletes what `prunePlan` allows, holding the copies' lock throughout.
 * `loadInUse` returns every source a card shows, read fresh, or null if it
 * cannot be sure it has them all -- in which case nothing is deleted. So is
 * nothing when the index or the listing comes back empty while the other does
 * not: one of them could not be read. Returns what went.
 */
export function pruneImageCache(
  queryClient: QueryClient,
  loadInUse: () => Promise<ReadonlySet<string> | null>,
  memory: PruneMemory = browserMemory,
): Promise<{ rows: number; files: number }> {
  return withImageCacheLock(async () => {
    const inUse = await loadInUse();
    if (!inUse || inUse.size === 0) return NOTHING;
    const rows = await queryClient.fetchQuery({ ...imageCacheQuery, staleTime: 0 });
    const files = await listFiles();
    // An empty listing is believed: only the owner can list the bucket, and
    // only the owner's deletes take effect, so a session that is not the
    // owner reads nothing and changes nothing. An empty index beside files is
    // not: anyone can read the index, so it is the read that failed.
    if (rows.length === 0 && files.length > 0) {
      console.warn('Card image copies: the index came back empty beside stored files, so nothing was pruned.');
      return NOTHING;
    }
    const inUseHashes = new Set(await Promise.all([...inUse].map(sha256Hex)));
    const now = Date.now();
    const plan = prunePlan({ rows, files, inUse, inUseHashes, unusedSince: memory.read() }, now);
    memory.write(plan.unusedSince);
    if (plan.refused) console.warn('Card image copies: most of the index would go, so no rows were pruned.');

    // Another device of the owner's can still write meanwhile: a row redone
    // since it was read has a newer processed_at, and is spared.
    const cutoff = new Date(now - PRUNE_GRACE_MS).toISOString();
    const deleted = new Set<string>();
    for (const chunk of inChunks(plan.rows, DELETE_CHUNK)) {
      const { data, error } = await supabase
        .from('image_cache')
        .delete()
        .in('source_hash', chunk)
        .lt('processed_at', cutoff)
        .select('source_hash');
      if (error) throw new Error(error.message);
      for (const row of data ?? []) deleted.add(row.source_hash);
    }
    if (deleted.size > 0) {
      queryClient.setQueryData<ImageCacheRow[]>(imageCacheQuery.queryKey, (old) =>
        old?.filter((row) => !deleted.has(row.source_hash)),
      );
    }

    // A spared row may have been redone into the very file the plan holds
    // for it: its files stay until the next prune.
    const spared = new Set(plan.rows.filter((hash) => !deleted.has(hash)));
    let removed = 0;
    for (const chunk of inChunks(plan.files.filter((name) => !spared.has(hashOf(name) ?? '')), DELETE_CHUNK)) {
      const { data, error } = await supabase.storage.from(IMAGE_BUCKET).remove(chunk);
      if (error) throw new Error(error.message);
      removed += data?.length ?? 0;
    }
    return { rows: deleted.size, files: removed };
  });
}

/** Started once a visit at most, whatever this browser remembers. */
let startedThisVisit = false;

function lastPruned(): number {
  try {
    return Number(window.localStorage.getItem(LAST_PRUNE_KEY)) || 0;
  } catch {
    return 0;
  }
}

function rememberPruned(now: number): void {
  try {
    window.localStorage.setItem(LAST_PRUNE_KEY, String(now));
  } catch {
    // Without storage it runs once a visit instead of once a day.
  }
}

/**
 * Prunes the copies once a day, a few seconds after `enabled` turns true and
 * stays true: the owner, on a collection that keeps copies, with the copying
 * worker idle. Copying that starts during a prune waits on its lock.
 * `loadInUse` must be stable: a module-level function, not one made in render.
 */
export function useImageCachePrune(loadInUse: () => Promise<ReadonlySet<string> | null>, enabled: boolean): void {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!enabled || startedThisVisit || Date.now() - lastPruned() < PRUNE_EVERY_MS) return;
    const timer = window.setTimeout(() => {
      if (startedThisVisit) return;
      startedThisVisit = true;
      pruneImageCache(queryClient, loadInUse)
        .then(() => rememberPruned(Date.now()))
        .catch((error: unknown) => {
          // Tried again on the next visit; nothing shown depends on it.
          console.warn('Card image copies were not pruned:', error instanceof Error ? error.message : error);
        });
    }, PRUNE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [enabled, loadInUse, queryClient]);
}
