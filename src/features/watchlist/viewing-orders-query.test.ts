import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import {
  addEntry,
  createOrder,
  libraryCollectionsQueryOptions,
  moveEntry,
  reorderedIds,
  updateEntryNote,
  viewingOrdersQueryOptions,
} from './viewing-orders-query';

type Result = { data: unknown; error: Error | null; count?: number };
type Call = { table: string; op: string; args: unknown[] };

const db = vi.hoisted(() => ({
  calls: [] as { table: string; op: string; args: unknown[] }[],
  results: {} as Record<string, { data: unknown; error: Error | null; count?: number }>,
  rpcs: [] as { name: string; args: unknown }[],
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => {
      const ops: string[] = [];
      const chain: Record<string, unknown> = {};
      for (const op of ['select', 'insert', 'update', 'delete', 'eq', 'order', 'limit', 'single', 'not', 'range']) {
        chain[op] = (...args: unknown[]) => {
          ops.push(op);
          db.calls.push({ table, op, args });
          return chain;
        };
      }
      chain.then = (resolve: (r: Result) => unknown, reject: (e: unknown) => unknown) =>
        Promise.resolve(db.results[`${table}.${ops[0]}`] ?? { data: null, error: null }).then(resolve, reject);
      return chain;
    },
    rpc: async (name: string, args: unknown) => {
      db.rpcs.push({ name, args });
      return db.results.rpc ?? { data: null, error: null };
    },
  },
}));

const callsTo = (table: string, op: string): Call[] =>
  db.calls.filter((c) => c.table === table && c.op === op);

const entry = (tmdbId: number, mediaType: 'movie' | 'tv' = 'movie') => ({
  key: `${mediaType}:${tmdbId}`,
  mediaType,
  tmdbId,
  title: `Title ${tmdbId}`,
  releaseDate: '2000-01-01',
  poster: null,
});

describe('viewing orders', () => {
  beforeEach(() => {
    db.calls = [];
    db.results = {};
    db.rpcs = [];
  });

  it('reads orders with their entries ordered by position then id', async () => {
    db.results['viewing_orders.select'] = {
      error: null,
      data: [{
        id: 1, name: 'X-Men', description: null, tmdb_collection_id: 748,
        entries: [{ id: 9, media_type: 'tv', tmdb_id: 5, title: 'Show', release_date: null, poster: null, note: 'hi', position: 1 }],
      }],
    };
    const client = new QueryClient();
    const orders = await client.fetchQuery(viewingOrdersQueryOptions);
    expect(orders[0]).toMatchObject({ id: 1, tmdbCollectionId: 748 });
    expect(orders[0].entries[0]).toMatchObject({ entryId: 9, mediaType: 'tv', tmdbId: 5, note: 'hi' });
    const orderBy = callsTo('viewing_orders', 'order').map((c) => c.args);
    expect(orderBy).toContainEqual(['position', { referencedTable: 'viewing_order_entries', ascending: true }]);
    expect(orderBy).toContainEqual(['id', { referencedTable: 'viewing_order_entries', ascending: true }]);
  });

  it('throws when the read fails', async () => {
    db.results['viewing_orders.select'] = { data: null, error: new Error('nope') };
    await expect(new QueryClient().fetchQuery(viewingOrdersQueryOptions)).rejects.toThrow('nope');
  });

  it('creates an order, then its entries at positions 1..n', async () => {
    db.results['viewing_orders.insert'] = { data: { id: 7 }, error: null };
    const id = await createOrder({ name: ' Saga ', tmdbCollectionId: 3, entries: [entry(10), entry(11, 'tv')] });
    expect(id).toBe(7);
    expect(callsTo('viewing_orders', 'insert')[0].args[0]).toMatchObject({ name: 'Saga', tmdb_collection_id: 3 });
    const rows = callsTo('viewing_order_entries', 'insert')[0].args[0] as { position: number; order_id: number }[];
    expect(rows.map((r) => r.position)).toEqual([1, 2]);
    expect(rows.every((r) => r.order_id === 7)).toBe(true);
  });

  it('removes the order again when its entries fail to save', async () => {
    db.results['viewing_orders.insert'] = { data: { id: 7 }, error: null };
    db.results['viewing_order_entries.insert'] = { data: null, error: new Error('entries failed') };
    await expect(createOrder({ name: 'Saga', entries: [entry(10)] })).rejects.toThrow('entries failed');
    expect(callsTo('viewing_orders', 'delete')).toHaveLength(1);
  });

  it('reports the rollback failure too when the empty order cannot be removed', async () => {
    db.results['viewing_orders.insert'] = { data: { id: 7 }, error: null };
    db.results['viewing_order_entries.insert'] = { data: null, error: new Error('entries failed') };
    db.results['viewing_orders.delete'] = { data: null, error: new Error('delete failed') };
    await expect(createOrder({ name: 'Saga', entries: [entry(10)] })).rejects.toThrow(/entries failed.*delete failed/);
  });

  it('reads library films that belong to a collection', async () => {
    db.results['movies.select'] = {
      error: null,
      count: 2,
      data: [
        { id: 'a', tmdb_id: 1, collection_id: 10, collection_name: 'Saga' },
        { id: 'b', tmdb_id: null, collection_id: 10, collection_name: null },
      ],
    };
    const rows = await new QueryClient().fetchQuery(libraryCollectionsQueryOptions);
    expect(rows).toEqual([
      { id: 'a', tmdbId: 1, collectionId: 10, collectionName: 'Saga' },
      { id: 'b', tmdbId: null, collectionId: 10, collectionName: null },
    ]);
    expect(callsTo('movies', 'not')[0].args).toEqual(['collection_id', 'is', null]);
  });

  it('throws when the collections read fails', async () => {
    db.results['movies.select'] = { data: null, error: new Error('nope'), count: 0 };
    await expect(new QueryClient().fetchQuery(libraryCollectionsQueryOptions)).rejects.toThrow('nope');
  });

  it('adds an entry after the current last position', async () => {
    db.results['viewing_order_entries.select'] = { data: [{ position: 4 }], error: null };
    await addEntry(2, entry(30));
    expect(callsTo('viewing_order_entries', 'insert')[0].args[0]).toMatchObject({ order_id: 2, position: 5 });
  });

  it('adds the first entry at position 1', async () => {
    db.results['viewing_order_entries.select'] = { data: [], error: null };
    await addEntry(2, entry(30));
    expect(callsTo('viewing_order_entries', 'insert')[0].args[0]).toMatchObject({ position: 1 });
  });

  it('stores a blank note as null', async () => {
    await updateEntryNote(4, '   ');
    expect(callsTo('viewing_order_entries', 'update')[0].args[0]).toEqual({ note: null });
  });

  it('computes the new id order without changing the input', () => {
    const ids = [1, 2, 3, 4];
    expect(reorderedIds(ids, 0, 2)).toEqual([2, 3, 1, 4]);
    expect(reorderedIds(ids, 3, 1)).toEqual([1, 4, 2, 3]);
    expect(ids).toEqual([1, 2, 3, 4]);
  });

  it('moves through the reorder RPC and ignores out-of-range moves', async () => {
    await moveEntry(5, [10, 11, 12], 2, 1);
    expect(db.rpcs).toEqual([{ name: 'reorder_viewing_order', args: { p_order_id: 5, p_entry_ids: [10, 12, 11] } }]);
    await moveEntry(5, [10, 11, 12], 0, -1);
    await moveEntry(5, [10, 11, 12], 2, 3);
    expect(db.rpcs).toHaveLength(1);
  });

  it('throws when the RPC fails', async () => {
    db.results.rpc = { data: null, error: new Error('rpc failed') };
    await expect(moveEntry(5, [10, 11], 0, 1)).rejects.toThrow('rpc failed');
  });
});
