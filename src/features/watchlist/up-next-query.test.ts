import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { invalidateWatchDerived, persistWatchedProgress } from './up-next-query';

const database = vi.hoisted(() => ({
  watched: new Set<number>(),
  writeError: null as Error | null,
  readError: null as Error | null,
  returnedIds: null as number[] | null,
  writes: 0,
  rpcCalls: [] as { fn: string; args: Record<string, unknown> }[],
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: async (fn: string, args: Record<string, unknown>) => {
      database.writes++;
      database.rpcCalls.push({ fn, args });
      if (database.writeError) return { data: null, error: database.writeError };
      const ids = (args.p_ids as number[] | undefined) ?? [];
      ids.forEach((id) => database.watched.add(id));
      return { data: null, error: null };
    },
    from: (table: string) => {
      if (table === 'tv_show_episodes') {
        return {
          update: ({ watched }: { watched: boolean }) => ({
            in: (_column: string, ids: number[]) => ({
              select: async () => {
                database.writes++;
                if (database.writeError) return { data: null, error: database.writeError };
                const updated = database.returnedIds ?? ids;
                updated.forEach((id) => {
                  if (watched) database.watched.add(id);
                  else database.watched.delete(id);
                });
                return { data: updated.map((id) => ({ id })), error: null };
              },
            }),
          }),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    },
  },
}));

const diaryQueryOptions = {
  queryKey: ['watchlist', 'diary'] as const,
  queryFn: async () => {
    if (database.readError) throw database.readError;
    return Array.from(database.watched).sort((a, b) => a - b);
  },
  retry: false,
};

const newsQueryOptions = {
  queryKey: ['watchlist', 'news'] as const,
  queryFn: async () => {
    if (database.readError) throw database.readError;
    return { count: database.watched.size };
  },
  retry: false,
};

describe('persistWatchedProgress and invalidateWatchDerived', () => {
  let client: QueryClient;
  let unsubscribeDiary: () => void;

  beforeEach(async () => {
    database.watched = new Set([1, 2, 3]);
    database.writeError = null;
    database.readError = null;
    database.returnedIds = null;
    database.writes = 0;
    database.rpcCalls = [];
    client = new QueryClient({ defaultOptions: { queries: { staleTime: 60_000, gcTime: Infinity } } });
    await client.fetchQuery(diaryQueryOptions);
    const observer = new QueryObserver(client, diaryQueryOptions);
    unsubscribeDiary = observer.subscribe(() => {});
  });

  afterEach(() => {
    unsubscribeDiary();
    client.clear();
  });

  it('writes watched and unwatched episodes and refreshes the diary query', async () => {
    expect(client.getQueryData(diaryQueryOptions.queryKey)).toEqual([1, 2, 3]);
    await persistWatchedProgress(client, [4], true);
    expect(database.watched.has(4)).toBe(true);
    expect(client.getQueryData(diaryQueryOptions.queryKey)).toEqual([1, 2, 3, 4]);
    await persistWatchedProgress(client, [4], false);
    expect(database.watched.has(4)).toBe(false);
    expect(client.getQueryData(diaryQueryOptions.queryKey)).toEqual([1, 2, 3]);
  });

  it('refreshes after a whole season is marked watched or unwatched', async () => {
    await persistWatchedProgress(client, [1, 2, 3, 4, 5], true);
    expect(client.getQueryData(diaryQueryOptions.queryKey)).toEqual([1, 2, 3, 4, 5]);
    await persistWatchedProgress(client, [1, 2, 3, 4, 5], false);
    expect(client.getQueryData(diaryQueryOptions.queryKey)).toEqual([]);
  });

  it('routes non-now watched timestamps through set_watched rpc', async () => {
    await persistWatchedProgress(client, [4], true, { mode: 'unknown' });
    expect(database.rpcCalls).toHaveLength(1);
    expect(database.rpcCalls[0].fn).toBe('set_watched');
    expect(client.getQueryData(diaryQueryOptions.queryKey)).toEqual([1, 2, 3, 4]);
  });

  it('does not update or invalidate when saving fails', async () => {
    database.writeError = new Error('Save failed');
    await expect(persistWatchedProgress(client, [4], true)).rejects.toThrow('Save failed');
    expect(database.watched.has(4)).toBe(false);
    expect(client.getQueryData(diaryQueryOptions.queryKey)).toEqual([1, 2, 3]);
  });

  it('rejects missing IDs before writing and rejects silently denied updates', async () => {
    await expect(persistWatchedProgress(client, [], true)).rejects.toThrow('Missing episode IDs');
    await expect(persistWatchedProgress(client, [undefined], true)).rejects.toThrow('Missing episode IDs');
    expect(database.writes).toBe(0);
    database.returnedIds = [];
    await expect(persistWatchedProgress(client, [4], true)).rejects.toThrow('Episode update incomplete');
    expect(client.getQueryData(diaryQueryOptions.queryKey)).toEqual([1, 2, 3]);
  });

  it('marks an inactive diary query stale so returning to Diary fetches fresh progress', async () => {
    unsubscribeDiary();
    await persistWatchedProgress(client, [4], true);
    expect(client.getQueryState(diaryQueryOptions.queryKey)?.isInvalidated).toBe(true);
    const rows = await client.fetchQuery(diaryQueryOptions);
    expect(rows).toEqual([1, 2, 3, 4]);
  });

  it('keeps a successful save successful if the subsequent diary fetch fails', async () => {
    database.readError = new Error('Read failed');
    await expect(persistWatchedProgress(client, [4], true)).resolves.toBeUndefined();
    expect(database.watched.has(4)).toBe(true);
    expect(client.getQueryState(diaryQueryOptions.queryKey)?.status).toBe('error');
  });

  it('invalidates both news and diary queries via invalidateWatchDerived', async () => {
    unsubscribeDiary();
    await client.fetchQuery(newsQueryOptions);
    await invalidateWatchDerived(client);
    expect(client.getQueryState(newsQueryOptions.queryKey)?.isInvalidated).toBe(true);
    expect(client.getQueryState(diaryQueryOptions.queryKey)?.isInvalidated).toBe(true);
  });
});
