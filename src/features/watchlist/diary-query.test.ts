import { describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { diaryQueryOptions } from './diary-query';

const database = vi.hoisted(() => ({ error: null as Error | null }));

const episodeRow = {
  id: 11,
  episode_number: 3,
  title: 'Pilot',
  runtime: 45,
  watched_at: '2026-11-12T12:00:00.000Z',
  tv_show_seasons: {
    season_number: 2,
    tv_shows: { id: 7, title: 'Lanterns', poster: 'p.jpg', genre: 'Drama, Sci-Fi', platform: 'Max' },
  },
};
const movieRow = { id: 5, title: 'Heat', poster: null, genre: null, platform: 'Netflix', runtime: null, watched_at: '2026-11-13T12:00:00.000Z' };

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => {
      const rows = table === 'movies' ? [movieRow] : [episodeRow];
      const headChain = {
        eq: () => headChain,
        is: async () => ({ data: null, error: database.error, count: table === 'movies' ? 2 : 1 }),
      };
      const chain = {
        select: (_columns: string, options?: { head?: boolean }) => (options?.head ? headChain : chain),
        eq: () => chain,
        not: () => chain,
        order: () => chain,
        range: async () => ({ data: database.error ? null : rows, error: database.error, count: rows.length }),
      };
      return chain;
    },
  },
}));

describe('diaryQueryOptions', () => {
  it('maps episodes and films to watch records', async () => {
    database.error = null;
    const { records, undated } = await new QueryClient().fetchQuery(diaryQueryOptions);
    expect(records).toHaveLength(2);
    expect(undated).toBe(3);
    expect(records[0]).toMatchObject({
      kind: 'episode', id: 11, titleId: '7', title: 'Lanterns', seasonNumber: 2, episodeNumber: 3,
      genres: ['Drama', 'Sci-Fi'], platform: 'Max', runtime: 45,
    });
    expect(records[1]).toMatchObject({ kind: 'movie', titleId: '5', watchedAt: '2026-11-13T12:00:00.000Z', genres: [], runtime: null });
  });

  it('throws when a read fails', async () => {
    database.error = new Error('boom');
    await expect(new QueryClient().fetchQuery(diaryQueryOptions)).rejects.toThrow('boom');
  });
});
