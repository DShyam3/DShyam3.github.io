import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import type { ImageCacheRow } from './image-cache';
import type { StoredFile, UnusedSince } from './prune';

/** A stand-in for the Supabase client: the index, the bucket, and what the runner asked of them. */
const server = vi.hoisted(() => {
  const state = {
    rows: [] as ImageCacheRow[],
    files: [] as StoredFile[],
    /** Hashes the delete leaves alone, as if each row were redone meanwhile. */
    spare: new Set<string>(),
    listed: 0,
    removed: [] as string[],
  };
  const supabase = {
    from: () => ({
      select: () => ({
        order: () => ({
          range: async (from: number, to: number) => ({
            data: state.rows.slice(from, to + 1),
            count: state.rows.length,
            error: null,
          }),
        }),
      }),
      delete: () => ({
        in: (_column: string, hashes: string[]) => ({
          lt: () => ({
            select: async () => ({
              data: hashes.filter((hash) => !state.spare.has(hash)).map((source_hash) => ({ source_hash })),
              error: null,
            }),
          }),
        }),
      }),
    }),
    storage: {
      from: () => ({
        list: async (_path: string, { limit, offset }: { limit: number; offset: number }) => {
          state.listed++;
          return { data: state.files.slice(offset, offset + limit), error: null };
        },
        remove: async (names: string[]) => {
          state.removed.push(...names);
          return { data: names.map((name) => ({ name })), error: null };
        },
      }),
    },
  };
  return { state, supabase };
});
vi.mock('@/integrations/supabase/client', () => ({ supabase: server.supabase }));

const { CUTOUT_VERSION } = await import('./image-cache');
const { MAX_PRUNE_SHARE, PRUNE_GRACE_MS, hashOf, prunePlan, pruneImageCache } = await import('./prune');
const { sha256Hex } = await import('./raster');

const NOW = Date.parse('2026-11-27T12:00:00Z');
const ago = (ms: number) => new Date(NOW - ms).toISOString();
const OLD = ago(PRUNE_GRACE_MS + 1);
const RECENT = ago(PRUNE_GRACE_MS - 60_000);
const LONG_UNUSED = NOW - PRUNE_GRACE_MS - 1;
const hash = (n: number) => n.toString(16).padStart(64, '0');
const path = (n: number, version = CUTOUT_VERSION) => `${hash(n)}-${version}.webp`;
const source = (n: number) => `https://shop.example/${n}.jpg`;

const row = (n: number, overrides: Partial<ImageCacheRow> = {}): ImageCacheRow => ({
  source_hash: hash(n),
  source_url: source(n),
  storage_path: path(n),
  transparent: true,
  tone: 'color',
  backdrop: '#ffffff',
  keep_background: false,
  failure: null,
  processed_at: OLD,
  ...overrides,
});
const file = (name: string, written = OLD): StoredFile => ({ name, id: `id-${name}`, created_at: written, updated_at: written });
const filesOf = (rows: ImageCacheRow[]) => rows.flatMap((r) => (r.storage_path ? [file(r.storage_path)] : []));

/** A plan where `used` are the sources in use; rows have the hash of their number, as in-use hashes do. */
const plan = (rows: ImageCacheRow[], files: StoredFile[], used: number[], unusedSince: UnusedSince = {}) =>
  prunePlan(
    { rows, files, inUse: new Set(used.map(source)), inUseHashes: new Set(used.map(hash)), unusedSince },
    NOW,
  );

describe('prunePlan', () => {
  it('drops a row unused for longer than the grace, with its file, and keeps what is in use', () => {
    const rows = [row(1), row(2), row(3)];
    const result = plan(rows, filesOf(rows), [1, 3], { [hash(2)]: LONG_UNUSED });
    expect(result).toMatchObject({ rows: [hash(2)], files: [path(2)], refused: false });
  });

  it('first only notes a row as unused, and drops it a grace later', () => {
    const rows = [row(1), row(2), row(3)];
    const first = plan(rows, filesOf(rows), [1, 3]);
    expect(first.rows).toEqual([]);
    expect(first.unusedSince).toEqual({ [hash(2)]: NOW });
    expect(plan(rows, filesOf(rows), [1, 3], { [hash(2)]: NOW - PRUNE_GRACE_MS }).rows).toEqual([hash(2)]);
  });

  it('forgets a row once it is in use again', () => {
    const rows = [row(1), row(2)];
    expect(plan(rows, filesOf(rows), [1, 2], { [hash(2)]: LONG_UNUSED }).unusedSince).toEqual({});
  });

  it('keeps a row written within the grace, however long its source has been unused', () => {
    const rows = [row(1), row(2), row(3, { processed_at: RECENT })];
    expect(plan(rows, filesOf(rows), [1, 2], { [hash(3)]: LONG_UNUSED }).rows).toEqual([]);
  });

  it('drops an unused failure, which has no file', () => {
    const rows = [row(1), row(2, { storage_path: null, failure: 'unreachable' }), row(3)];
    expect(plan(rows, filesOf(rows), [1, 3], { [hash(2)]: LONG_UNUSED }).rows).toEqual([hash(2)]);
  });

  it('drops a row in use whose file is missing, so it is copied again', () => {
    const rows = [row(1), row(2), row(3)];
    expect(plan(rows, [file(path(1)), file(path(3))], [1, 2, 3]).rows).toEqual([hash(2)]);
  });

  it('drops every row whose file is missing, however many, but not one just written', () => {
    const rows = [row(1), row(2), row(3, { processed_at: RECENT })];
    expect(plan(rows, [], [1, 2, 3])).toMatchObject({ rows: [hash(1), hash(2)], refused: false });
  });

  it('drops a file no row names once it is old, never one just written', () => {
    const result = plan([row(1)], [file(path(1)), file(path(7)), file(path(8), RECENT)], [1]);
    expect(result.files).toEqual([path(7)]);
  });

  it('keeps a redone copy\'s old file while a saved index may still name it', () => {
    const files = [file(path(1)), file(path(1, 'v4'))];
    expect(plan([row(1, { processed_at: RECENT })], files, [1]).files).toEqual([]);
    expect(plan([row(1)], files, [1]).files).toEqual([path(1, 'v4')]);
  });

  it('never drops a file of a source in use that has no row', () => {
    expect(plan([row(1)], [file(path(1)), file(path(5))], [1, 5]).files).toEqual([]);
  });

  it('refuses to drop rows when most of the index would go, but still clears files no row names', () => {
    const rows = [row(1), row(2), row(3)];
    const unused = { [hash(2)]: LONG_UNUSED, [hash(3)]: LONG_UNUSED };
    const result = plan(rows, [...filesOf(rows), file(path(9))], [1], unused);
    expect(2 / 3).toBeGreaterThan(MAX_PRUNE_SHARE);
    expect(result).toMatchObject({ rows: [], files: [path(9)], refused: true });
  });

  it('never drops a folder or a file of unknown age', () => {
    const folder: StoredFile = { name: 'nested', id: null };
    const undated: StoredFile = { name: path(9), id: 'x', created_at: null, updated_at: null };
    expect(plan([row(1)], [file(path(1)), folder, undated], [1]).files).toEqual([]);
  });

  it('reads the source hash a stored name starts with', () => {
    expect(hashOf(path(5, 'v5-keep'))).toBe(hash(5));
    expect(hashOf('nested')).toBeUndefined();
  });
});

describe('pruneImageCache', () => {
  /** Rows keyed by the real hash of their source, as the runner hashes the sources in use. */
  const hashedRow = async (n: number): Promise<ImageCacheRow> => {
    const h = await sha256Hex(source(n));
    return row(n, { source_hash: h, storage_path: `${h}-${CUTOUT_VERSION}.webp` });
  };
  const memoryWith = (value: UnusedSince) => {
    let stored = value;
    return { read: () => stored, write: (next: UnusedSince) => void (stored = next) };
  };
  const inUse = (...ns: number[]) => () => Promise.resolve(new Set(ns.map(source)));
  const client = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    Object.assign(server.state, { rows: [], files: [], spare: new Set(), listed: 0, removed: [] });
  });
  afterEach(() => vi.useRealTimers());

  it('removes the files of rows it deleted, and not of a row the server spared', async () => {
    const rows = await Promise.all([1, 2, 3, 4, 5].map(hashedRow));
    server.state.rows = rows;
    server.state.files = filesOf(rows);
    server.state.spare = new Set([rows[1].source_hash]);
    const memory = memoryWith({ [rows[1].source_hash]: LONG_UNUSED, [rows[2].source_hash]: LONG_UNUSED });

    expect(await pruneImageCache(client(), inUse(1, 4, 5), memory)).toEqual({ rows: 1, files: 1 });
    expect(server.state.removed).toEqual([rows[2].storage_path]);
  });

  it('deletes nothing, and lists nothing, when the sources in use are in doubt', async () => {
    server.state.rows = [await hashedRow(1)];
    server.state.files = filesOf(server.state.rows);
    expect(await pruneImageCache(client(), () => Promise.resolve(null), memoryWith({}))).toEqual({ rows: 0, files: 0 });
    expect(server.state.listed).toBe(0);
  });

  it('deletes nothing when the index comes back empty but the bucket does not', async () => {
    server.state.files = [file(path(7)), file(path(8))];
    expect(await pruneImageCache(client(), inUse(1), memoryWith({}))).toEqual({ rows: 0, files: 0 });
    expect(server.state.removed).toEqual([]);
  });
});
