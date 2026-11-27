import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react';
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { FunctionsHttpError, type PostgrestError } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { selectAllPages } from '@/integrations/supabase/select-all-pages';
import type { Tone } from './cutout';
import { cleanImage, imageLoads, sha256Hex } from './raster';

/**
 * Cleaned card images: a copy of each Inventory and Links picture, with its
 * studio background removed, kept in our own bucket.
 *
 * Two problems, one fix. A retailer's product shot sits on white, which is a
 * white square on the dark theme; and it is hotlinked, so it breaks when the
 * shop moves it. Once a copy is stored here, neither matters: the card shows
 * the copy, on the theme, whatever happens to the original.
 *
 * The owner's browser does the work -- there is no server that can decode
 * every format a shop serves -- a few images at a time, whenever the owner
 * has a collection open and a card's picture has no copy yet. Visitors only
 * read the copies. When a picture has already stopped loading, the item's own
 * page is asked for its current one (`item-image` function), and the record
 * is pointed at it.
 */

export const IMAGE_BUCKET = 'item-images';
/** Part of every stored name: bump it when `cutout` changes enough that stored copies should be redone. */
export const CUTOUT_VERSION = 'v5';
/** A picture that could not be copied is tried again after this long. */
export const RETRY_AFTER_MS = 7 * 24 * 60 * 60 * 1000;
/** The longest source the index takes (its CHECK): a longer data: URI is shown as it is, never copied. */
export const MAX_SOURCE_LENGTH = 16_384;
/** Images worked on at once. Each is a fetch, a decode and an upload. */
const CONCURRENCY = 2;

export type ImageFailure = 'unreachable' | 'not_image' | 'undecodable' | 'too_large';

export interface ImageCacheRow {
  source_hash: string;
  source_url: string;
  storage_path: string | null;
  transparent: boolean;
  tone: Tone | null;
  backdrop: string | null;
  keep_background: boolean;
  failure: ImageFailure | null;
  processed_at: string;
}

const COLUMNS = 'source_hash, source_url, storage_path, transparent, tone, backdrop, keep_background, failure, processed_at';

export const imageCacheQuery = {
  queryKey: ['image_cache'] as const,
  // Copies change only when the owner's browser makes one, and that browser
  // writes straight into this cache.
  staleTime: 10 * 60 * 1000,
  // A card holds its picture until the index answers, so a failing index
  // gives up quickly and stays given up: cards then show the originals,
  // rather than "Loading artwork…" through every retry and every new card.
  retry: 1,
  retryOnMount: false,
  queryFn: async (): Promise<ImageCacheRow[]> => {
    // Every row, past the server's 1,000-row page: a row outlives its source's
    // last use until the daily prune (prune.ts) clears it.
    const { data, error } = await selectAllPages(
      (from, to) =>
        supabase.from('image_cache').select(COLUMNS, { count: 'exact' }).order('source_hash').range(from, to),
      (row) => row.source_hash,
    );
    if (error) throw new Error(error.message);
    return data as ImageCacheRow[];
  },
};

/** One index per fetched list, shared by every card that reads it. */
const indexes = new WeakMap<ImageCacheRow[], Map<string, ImageCacheRow>>();
function indexOf(rows: ImageCacheRow[]): Map<string, ImageCacheRow> {
  let index = indexes.get(rows);
  if (!index) {
    index = new Map(rows.map((row) => [row.source_url, row]));
    indexes.set(rows, index);
  }
  return index;
}

export const storedImageUrl = (path: string): string =>
  supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path).data.publicUrl;

/** The stored name for a copy of the source hashed to `hash`. */
export const storagePathFor = (hash: string, keepBackground: boolean, ext: 'webp' | 'png'): string =>
  `${hash}-${CUTOUT_VERSION}${keepBackground ? '-keep' : ''}.${ext}`;

const isCurrent = (path: string): boolean => path.includes(`-${CUTOUT_VERSION}.`) || path.includes(`-${CUTOUT_VERSION}-`);

export interface ShownImage {
  /** What the <img> should load. */
  src: string;
  /** The copy has a transparent background, so it can sit on the theme. */
  transparent: boolean;
  tone: Tone | null;
  /**
   * The studio background's colour, removed or not. A copy kept whole shows
   * on a plate of it (`plateProps`); a cut-out copy had it removed, which is
   * what the owner's background choice can undo.
   */
  backdrop: string | null;
  /** There is a stored copy (and so a background choice to offer the owner). */
  stored: boolean;
  keepBackground: boolean;
}

const original = (src: string): ShownImage => ({
  src,
  transparent: false,
  tone: null,
  backdrop: null,
  stored: false,
  keepBackground: false,
});

/** Stored copies that would not load in this tab; cards show their originals instead. */
const brokenCopies = new Set<string>();
const brokenListeners = new Set<() => void>();
let brokenVersion = 0;
const subscribeBroken = (listener: () => void) => {
  brokenListeners.add(listener);
  return () => {
    brokenListeners.delete(listener);
  };
};
const brokenSnapshot = () => brokenVersion;

/**
 * For an <img>'s onError. A stored copy that will not load -- pruned while a
 * visitor's saved index still named it, lost from the bucket -- is swapped
 * for its original on every card that shows it, rather than a fallback icon.
 * Any other address is ignored: the card's own fallback handles it.
 */
export function reportImageError(src: string | undefined): void {
  if (!src || brokenCopies.has(src) || !src.startsWith(storedImageUrl(''))) return;
  brokenCopies.add(src);
  brokenVersion++;
  for (const listener of brokenListeners) listener();
}

/**
 * What a card should show for `source`: the stored copy when there is one,
 * else the source. `pending` while the index is first loading, so a card
 * does not load the original only to swap it a moment later. If the index
 * cannot be read, or the copy would not load, the source is shown, as before
 * copies existed.
 */
export function useShownImage(source: string | undefined, enabled: boolean): { image?: ShownImage; pending: boolean } {
  useSyncExternalStore(subscribeBroken, brokenSnapshot);
  const { data: row, isPending, isError, failureCount } = useQuery({
    ...imageCacheQuery,
    enabled: enabled && Boolean(source),
    // Each card watches its own row, so a copy landing re-renders the card it
    // is for rather than every card on the page.
    select: (rows: ImageCacheRow[]) => (source ? (indexOf(rows).get(source) ?? null) : null),
  });
  if (!source) return { pending: false };
  if (!enabled || isError || failureCount > 0) return { image: original(source), pending: false };
  if (isPending) return { pending: true };
  const copy = row?.storage_path ? storedImageUrl(row.storage_path) : undefined;
  if (row && copy && !brokenCopies.has(copy)) {
    return {
      image: {
        src: copy,
        transparent: row.transparent,
        tone: row.tone,
        backdrop: row.backdrop,
        stored: true,
        keepBackground: row.keep_background,
      },
      pending: false,
    };
  }
  return { image: original(source), pending: false };
}

/** Props for the tile behind a copy kept whole: a plate in its own backdrop colour (see `.media-plate`). */
export function plateProps(image: Pick<ShownImage, 'backdrop' | 'transparent'> | undefined) {
  if (!image?.backdrop || image.transparent) return undefined;
  return { className: 'media-plate', style: { '--plate': image.backdrop } as CSSProperties };
}

/**
 * Classes for a picture that sits on the theme's stage (`.media-stage`), or
 * undefined when it keeps its plain tile or a plate.
 *
 * A copy with a transparent background: a product gets a soft shadow; a
 * one-colour logo is inverted on the theme it would vanish into, so GitHub's
 * black mark is white in the dark theme. A logo that is its own square of
 * colour edge to edge -- Linear's blue tile -- sits on the stage as an app
 * icon, rounded, rather than on a white plate.
 */
export function shownImageClass(
  image: Pick<ShownImage, 'tone' | 'transparent' | 'stored' | 'backdrop'>,
  logo: boolean,
): string | undefined {
  if (!image.transparent) return logo && image.stored && !image.backdrop ? 'no-outline rounded-[22%]' : undefined;
  if (!logo) return 'no-outline media-cutout';
  if (image.tone === 'dark') return 'no-outline logo-tone-dark';
  if (image.tone === 'light') return 'no-outline logo-tone-light';
  return 'no-outline';
}

/** A card image the owner's browser should make a copy of. */
export interface ImageJob {
  source: string;
  /** The item's own page, asked for its current picture when `source` no longer loads. */
  page?: string;
  want: 'product' | 'icon';
  /** Pictures to try after the page's own, e.g. a favicon service. */
  fallbacks?: string[];
  /** Points the record at a replacement picture. */
  replace?: (url: string) => Promise<unknown>;
}

/**
 * The sources with no usable copy -- never tried, tried long enough ago that
 * a failure is worth retrying, or copied by an older version of the cutout --
 * each with every job that shows it, so a replacement reaches every record
 * sharing a dead picture. None already tried this session, and no source too
 * long for the index.
 */
export function pendingJobs(
  jobs: ImageJob[],
  index: Map<string, ImageCacheRow>,
  tried: ReadonlySet<string>,
  now: number,
): ImageJob[][] {
  const groups = new Map<string, ImageJob[]>();
  const settled = new Set<string>();
  for (const job of jobs) {
    if (settled.has(job.source)) continue;
    const group = groups.get(job.source);
    if (group) {
      group.push(job);
      continue;
    }
    const row = index.get(job.source);
    const due =
      !tried.has(job.source) &&
      job.source.length <= MAX_SOURCE_LENGTH &&
      (!row ||
        (row.storage_path ? !isCurrent(row.storage_path) : now - Date.parse(row.processed_at) >= RETRY_AFTER_MS));
    if (due) groups.set(job.source, [job]);
    else settled.add(job.source);
  }
  return [...groups.values()];
}

/** Sources tried since the page loaded, across mounts: a source is tried at most once a visit. */
const triedThisVisit = new Set<string>();
/** Set once the copying service itself is missing; nothing more is tried until the next visit. */
let serviceMissing = false;

/** The copying itself cannot run -- not the owner, the function or table missing: stop. */
class ServiceUnavailable extends Error {}
/** One image's request failed in passing (a time limit, a 5xx): nothing recorded, tried again next visit. */
class RequestFailed extends Error {}
/** One image was refused for what it is: recorded as that failure. */
class Rejected extends Error {
  constructor(readonly failure: ImageFailure) {
    super(failure);
  }
}

/** 401 or 403: no longer the owner. 404: the function is not deployed. Anything else is one request. */
function functionFailure(error: Error): Error {
  const status = error instanceof FunctionsHttpError ? (error.context as Response | undefined)?.status : undefined;
  if (status !== undefined && status !== 401 && status !== 403 && status !== 404) return new RequestFailed(error.message);
  return new ServiceUnavailable(error.message);
}

/** An upload refused: too large is this image; no permission or no bucket is the service. */
function storageFailure(error: { message: string; status?: number; statusCode?: string }): Error {
  const code = Number(error.statusCode ?? error.status);
  if (code === 413) return new Rejected('too_large');
  if (code === 401 || code === 403 || code === 404) return new ServiceUnavailable(error.message);
  return new RequestFailed(error.message);
}

/** No table, no permission or no session is the service; anything else (a CHECK) is this image. */
const MISSING_TABLE_CODES = new Set(['42P01', 'PGRST205', '42501', 'PGRST301', 'PGRST302']);
function tableFailure(error: PostgrestError): Error {
  return MISSING_TABLE_CODES.has(error.code) ? new ServiceUnavailable(error.message) : new RequestFailed(error.message);
}

type Pixels = { blob: Blob } | { image: HTMLImageElement };
type Fetched = { pixels: Pixels } | { failure: ImageFailure };

function dataUriBlob(uri: string): Blob | null {
  const match = uri.match(/^data:([^;,]*)((?:;[^;,]*)*?)(;base64)?,(.*)$/s);
  if (!match) return null;
  try {
    const type = match[1] || 'application/octet-stream';
    if (match[3]) {
      const body = atob(match[4]);
      return new Blob([Uint8Array.from(body, (char) => char.charCodeAt(0))], { type });
    }
    // Percent-encoded text (an inline SVG): encode it as UTF-8, not byte by byte.
    return new Blob([new TextEncoder().encode(decodeURIComponent(match[4]))], { type });
  } catch {
    return null;
  }
}

/**
 * An <img> loaded in CORS mode, whose pixels a canvas may read -- only if the
 * host allows cross-origin reads, which about three quarters of the shops
 * here do. Going through an <img> rather than fetch keeps the page's
 * connect-src narrow: images may come from anywhere, requests may not.
 */
function corsImage(src: string, timeoutMs = 15_000): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.referrerPolicy = 'no-referrer';
    const timer = window.setTimeout(() => done(null), timeoutMs);
    function done(result: HTMLImageElement | null) {
      window.clearTimeout(timer);
      img.onload = null;
      img.onerror = null;
      resolve(result);
    }
    img.onload = () => done(img);
    img.onerror = () => done(null);
    img.src = src;
  });
}

const FUNCTION_FAILURES: Record<string, ImageFailure> = { not_image: 'not_image', too_large: 'too_large' };

/** The image's pixels: inline, straight from its host, or through the owner-only `item-image` function. */
async function fetchPixels(src: string): Promise<Fetched> {
  if (src.startsWith('data:')) {
    const blob = dataUriBlob(src);
    return blob ? { pixels: { blob } } : { failure: 'undecodable' };
  }
  const direct = await corsImage(src);
  if (direct) return { pixels: { image: direct } };

  const { data, error } = await supabase.functions.invoke('item-image', { body: { action: 'fetch', url: src } });
  if (error) throw functionFailure(error);
  if (data instanceof Blob) return { pixels: { blob: data } };
  const reason = (data as { reason?: string } | null)?.reason ?? '';
  return { failure: FUNCTION_FAILURES[reason] ?? 'unreachable' };
}

let lockTail: Promise<unknown> = Promise.resolve();
/**
 * The longest one holder keeps the lock. Storage requests have no deadline of
 * their own, and one left hanging (a laptop asleep mid-upload) must fail that
 * one image, not stall copying in every tab until this one closes.
 */
const LOCK_DEADLINE_MS = 60_000;

/**
 * Runs `work` alone among writes to the copies: every store and recorded
 * failure, and the whole of a prune (prune.ts). So a prune never deletes a
 * file that is being written, and never reads an index a store is half-way
 * through. Web Locks reach every tab of the site; where they are missing, a
 * promise chain covers this one.
 */
export function withImageCacheLock<T>(work: () => Promise<T>): Promise<T> {
  const bounded = () =>
    new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => reject(new RequestFailed('The image cache lock was held too long')), LOCK_DEADLINE_MS);
      work()
        .then(resolve, reject)
        .finally(() => clearTimeout(timer));
    });
  const locks = typeof navigator === 'undefined' ? undefined : navigator.locks;
  if (locks) return locks.request('image-cache', bounded);
  const run = lockTail.then(bounded, bounded);
  lockTail = run.catch(() => undefined);
  return run;
}

/** Makes, stores and records a copy of `source`; null if the pixels cannot be decoded. */
async function storeCopy(source: string, pixels: Pixels, keepBackground: boolean): Promise<ImageCacheRow | null> {
  let cleaned: Awaited<ReturnType<typeof cleanImage>>;
  try {
    cleaned = await cleanImage('blob' in pixels ? pixels.blob : pixels.image, { keepBackground });
  } catch {
    return null;
  }
  const hash = await sha256Hex(source);
  const path = storagePathFor(hash, keepBackground, cleaned.ext);
  return withImageCacheLock(async () => {
    const upload = await supabase.storage.from(IMAGE_BUCKET).upload(path, cleaned.blob, {
      contentType: cleaned.blob.type,
      // The name holds the source's hash and the cutout version, so a name's
      // content never changes: cache it for good.
      cacheControl: '31536000',
      upsert: true,
    });
    if (upload.error) throw storageFailure(upload.error);
    const row: ImageCacheRow & { width: number; height: number } = {
      source_hash: hash,
      source_url: source,
      storage_path: path,
      transparent: cleaned.transparent,
      tone: cleaned.tone,
      backdrop: cleaned.backdrop,
      keep_background: keepBackground,
      failure: null,
      processed_at: new Date().toISOString(),
      width: cleaned.width,
      height: cleaned.height,
    };
    const { error } = await supabase.from('image_cache').upsert(row);
    if (error) throw tableFailure(error);
    return row;
  });
}

async function recordFailure(source: string, failure: ImageFailure, keepBackground: boolean): Promise<ImageCacheRow> {
  const row: ImageCacheRow = {
    source_hash: await sha256Hex(source),
    source_url: source,
    storage_path: null,
    transparent: false,
    tone: null,
    backdrop: null,
    keep_background: keepBackground,
    failure,
    processed_at: new Date().toISOString(),
  };
  return withImageCacheLock(async () => {
    const { error } = await supabase.from('image_cache').upsert(row);
    if (error) throw tableFailure(error);
    return row;
  });
}

/** Pictures the items' pages name, then their fallbacks; never the broken source, never one the index cannot hold. */
async function replacementCandidates(jobs: ImageJob[]): Promise<string[]> {
  const found: string[] = [];
  const pages = [...new Set(jobs.map((job) => job.page).filter((page): page is string => Boolean(page)))];
  for (const page of pages) {
    if (!/^https?:\/\//i.test(page)) continue;
    const { data, error } = await supabase.functions.invoke('item-image', {
      body: { action: 'find', url: page, want: jobs[0].want },
    });
    if (error) {
      const failure = functionFailure(error);
      if (failure instanceof ServiceUnavailable) throw failure;
      continue;
    }
    const images = (data as { images?: unknown } | null)?.images;
    if (Array.isArray(images)) found.push(...images.filter((image): image is string => typeof image === 'string'));
  }
  for (const job of jobs) found.push(...(job.fallbacks ?? []));
  const source = jobs[0].source;
  return [...new Set(found)].filter((url) => url !== source && url.length <= MAX_SOURCE_LENGTH);
}

/** A replacement candidate's copy, or null if it cannot be had; only a missing service propagates. */
async function tryCandidate(url: string): Promise<ImageCacheRow | null> {
  try {
    const fetched = await fetchPixels(url);
    return 'pixels' in fetched ? await storeCopy(url, fetched.pixels, false) : null;
  } catch (error) {
    if (error instanceof ServiceUnavailable) throw error;
    return null;
  }
}

/**
 * Copies one source's picture, for every job that shows it. If it no longer
 * loads anywhere -- not through the function, not even in an <img> -- the
 * items' pages are asked for their current picture, which is copied and
 * written to each record. Returns the rows written.
 *
 * A copy made by an older cutout is redone when the source still gives its
 * pixels, and otherwise left alone: a failure is never written over a copy
 * that works, which is the case the copies exist for.
 */
async function runJob(jobs: ImageJob[], existing: ImageCacheRow | undefined): Promise<ImageCacheRow[]> {
  const { source } = jobs[0];
  const keep = existing?.keep_background ?? false;
  let failure: ImageFailure;
  try {
    const fetched = await fetchPixels(source);
    if ('pixels' in fetched) {
      const stored = await storeCopy(source, fetched.pixels, keep);
      if (stored) return [stored];
      failure = 'undecodable';
    } else {
      failure = fetched.failure;
    }
  } catch (error) {
    if (!(error instanceof Rejected)) throw error;
    failure = error.failure;
  }
  if (existing?.storage_path) return [];

  const failed = await recordFailure(source, failure, keep);
  const replaceable = jobs.filter((job) => job.replace);
  // An inline picture cannot go dead. One that still shows in an <img> is not
  // broken, only unreadable to us -- a bot wall, a size cap -- and replacing
  // it would swap a working photo for a guess.
  if (replaceable.length === 0 || source.startsWith('data:') || (await imageLoads(source))) return [failed];

  for (const candidate of await replacementCandidates(jobs)) {
    const copy = await tryCandidate(candidate);
    if (!copy) continue;
    for (const job of replaceable) {
      try {
        await job.replace?.(candidate);
      } catch {
        // That record stays as it was: changed meanwhile, or the write refused.
      }
    }
    return [failed, copy];
  }
  return [failed];
}

function mergeRows(queryClient: QueryClient, rows: ImageCacheRow[]): void {
  if (rows.length === 0) return;
  queryClient.setQueryData<ImageCacheRow[]>(imageCacheQuery.queryKey, (old) => {
    const bySource = new Map((old ?? []).map((row) => [row.source_url, row]));
    for (const row of rows) bySource.set(row.source_url, row);
    return [...bySource.values()];
  });
}

/**
 * Copies every source without a usable copy, in the background, while
 * `enabled` (the owner, on a collection that keeps copies). Returns how many
 * are left. Stops until the next visit at the first sign the service itself
 * is missing -- the function not deployed, the table not created -- rather
 * than recording every image as failed.
 *
 * Mount it where a re-render is cheap: it re-renders as the count falls.
 * `idle` once the index has loaded and nothing is being copied.
 */
export function useImageCacheWorker(jobs: ImageJob[], enabled: boolean): { remaining: number; idle: boolean } {
  const queryClient = useQueryClient();
  // Only whether the index has loaded: a copy landing must not re-render the
  // component running the worker.
  const { isSuccess } = useQuery({ ...imageCacheQuery, enabled });
  const running = useRef(false);
  const alive = useRef(true);
  const latestJobs = useRef<ImageJob[]>([]);
  const [remaining, setRemaining] = useState(0);
  // Bumped when a run ends, so jobs that arrived during it get a run of their own.
  const [round, setRound] = useState(0);

  useEffect(() => {
    latestJobs.current = jobs;
  }, [jobs]);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    if (!enabled || !isSuccess || serviceMissing || running.current) return;
    const rows = () => queryClient.getQueryData<ImageCacheRow[]>(imageCacheQuery.queryKey) ?? [];
    const left = () => pendingJobs(latestJobs.current, indexOf(rows()), triedThisVisit, Date.now());
    if (left().length === 0) return;
    running.current = true;
    let inFlight = 0;

    // Not cancelled by a re-render: a run outlives the renders its own
    // progress causes, and stops only when the page goes.
    const lane = async () => {
      while (alive.current && !serviceMissing) {
        const group = left()[0];
        if (!group) return;
        const { source } = group[0];
        triedThisVisit.add(source);
        inFlight++;
        setRemaining(left().length + inFlight);
        try {
          mergeRows(queryClient, await runJob(group, indexOf(rows()).get(source)));
        } catch (error) {
          if (error instanceof ServiceUnavailable) {
            serviceMissing = true;
            console.warn('Card images are not being copied:', error.message);
          }
          // Anything else is this one image: the rest carry on, and it is
          // tried again on the next visit.
        } finally {
          inFlight--;
        }
      }
    };

    void Promise.all(Array.from({ length: CONCURRENCY }, lane)).finally(() => {
      running.current = false;
      if (!alive.current) return;
      setRemaining(0);
      setRound((value) => value + 1);
    });
  }, [enabled, isSuccess, jobs, queryClient, round]);

  // A run sets `remaining` above zero in the same effect that starts it, so
  // `idle` is true for at most one render before a run: long enough to start
  // a timer, never long enough for one to fire.
  return { remaining, idle: enabled && isSuccess && remaining === 0 };
}

/**
 * The owner's override for a picture the cutout gets wrong: store it again
 * with its background kept, or removed again. Fetches the source anew, so it
 * fails if the source no longer loads.
 */
export async function setKeepBackground(queryClient: QueryClient, source: string, keep: boolean): Promise<void> {
  const fetched = await fetchPixels(source);
  if (!('pixels' in fetched)) throw new Error('The original picture no longer loads, so it cannot be redone.');
  const row = await storeCopy(source, fetched.pixels, keep);
  if (!row) throw new Error('The original picture could not be read, so it cannot be redone.');
  mergeRows(queryClient, [row]);
}
