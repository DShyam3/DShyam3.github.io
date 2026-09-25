import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { persistWatchedProgress, upNextQueryOptions } from './up-next-query';

const database = vi.hoisted(() => ({
  watched: new Set<number>(),
  writeError: null as Error | null,
  readError: null as Error | null,
  returnedIds: null as number[] | null,
  writes: 0,
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => {
      if (table === 'watchlist_up_next') {
        return {
          select: async () => {
            const next = [1, 2, 3, 4, 5].find((id) => !database.watched.has(id));
            return {
              error: database.readError,
              data: next ? [{
                tv_show_id: 123,
                title: 'Lanterns',
                season_number: 1,
                episode_number: next,
                episode_title: next === 4 ? 'The Weenie' : 'Lights Out',
                state: 'ready',
                season_in_progress: true,
                release_date: '2026-09-13',
              }] : [],
            };
          },
        };
      }
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

describe('watched progress and the active Watch Next query', () => {
  let client: QueryClient;
  let unsubscribe: () => void;

  beforeEach(async () => {
    database.watched = new Set([1, 2, 3]);
    database.writeError = null;
    database.readError = null;
    database.returnedIds = null;
    database.writes = 0;
    client = new QueryClient({ defaultOptions: { queries: { staleTime: 60_000, gcTime: Infinity } } });
    await client.fetchQuery(upNextQueryOptions);
    // A subscribed observer represents the rail remaining mounted behind the dialog.
    const observer = new QueryObserver(client, upNextQueryOptions);
    unsubscribe = observer.subscribe(() => {});
  });

  afterEach(() => {
    unsubscribe();
    client.clear();
  });

  it('advances E4 to E5 after saving, and returns to E4 when unwatched', async () => {
    expect(client.getQueryData(upNextQueryOptions.queryKey)?.[0].episode_number).toBe(4);
    await persistWatchedProgress(client, [4], true);
    expect(client.getQueryData(upNextQueryOptions.queryKey)?.[0]).toMatchObject({
      episode_number: 5, episode_title: 'Lights Out',
    });
    await persistWatchedProgress(client, [4], false);
    expect(client.getQueryData(upNextQueryOptions.queryKey)?.[0]).toMatchObject({
      episode_number: 4, episode_title: 'The Weenie',
    });
  });

  it('refreshes after a whole season is marked watched or unwatched', async () => {
    await persistWatchedProgress(client, [1, 2, 3, 4, 5], true);
    expect(client.getQueryData(upNextQueryOptions.queryKey)).toEqual([]);
    await persistWatchedProgress(client, [1, 2, 3, 4, 5], false);
    expect(client.getQueryData(upNextQueryOptions.queryKey)?.[0].episode_number).toBe(1);
  });

  it('does not advance the rail when saving fails', async () => {
    database.writeError = new Error('Save failed');
    await expect(persistWatchedProgress(client, [4], true)).rejects.toThrow('Save failed');
    expect(database.watched.has(4)).toBe(false);
    expect(client.getQueryData(upNextQueryOptions.queryKey)?.[0].episode_number).toBe(4);
  });

  it('rejects missing IDs before writing and rejects silently denied updates', async () => {
    await expect(persistWatchedProgress(client, [], true)).rejects.toThrow('Missing episode IDs');
    await expect(persistWatchedProgress(client, [undefined], true)).rejects.toThrow('Missing episode IDs');
    expect(database.writes).toBe(0);
    database.returnedIds = [];
    await expect(persistWatchedProgress(client, [4], true)).rejects.toThrow('Episode update incomplete');
    expect(client.getQueryData(upNextQueryOptions.queryKey)?.[0].episode_number).toBe(4);
  });

  it('marks an inactive rail stale so returning to News fetches fresh progress', async () => {
    unsubscribe();
    await persistWatchedProgress(client, [4], true);
    expect(client.getQueryState(upNextQueryOptions.queryKey)?.isInvalidated).toBe(true);
    const rows = await client.fetchQuery(upNextQueryOptions);
    expect(rows[0].episode_number).toBe(5);
  });

  it('keeps a successful save successful if the subsequent rail fetch fails', async () => {
    database.readError = new Error('Read failed');
    await expect(persistWatchedProgress(client, [4], true)).resolves.toBeUndefined();
    expect(database.watched.has(4)).toBe(true);
    expect(client.getQueryState(upNextQueryOptions.queryKey)?.status).toBe('error');
  });
});
