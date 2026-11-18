import { describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import {
  recentAnnouncementsQuery,
  recentEpisodesQuery,
  recentMoviesQuery,
  upcomingEpisodesQuery,
  upcomingMoviesQuery,
  watchlistEventsQuery,
} from './useWatchlistNews';

const tables = vi.hoisted(() => ({ rows: {} as Record<string, unknown[]> }));

// Every chained filter returns the builder; awaiting it (or .range) yields the table.
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => {
      const data = () => tables.rows[table] ?? [];
      const builder: Record<string, unknown> = {
        range: async () => ({ data: data(), error: null, count: data().length }),
        then: (resolve: (value: unknown) => unknown) => resolve({ data: data(), error: null }),
      };
      for (const method of ['select', 'gte', 'lte', 'gt', 'order', 'limit', 'in']) builder[method] = () => builder;
      return builder;
    },
  },
}));

const run = <T,>(options: { queryKey: readonly unknown[]; queryFn?: unknown }) =>
  new QueryClient().fetchQuery(options as never) as Promise<T>;

const episode = (id: number, library_state: string) => ({
  id, episode_number: 1, title: 'Ep', release_date: '2026-11-10', watched: false,
  tv_show_seasons: { season_number: 1, tv_show_id: id, tv_shows: { title: `Show ${id}`, poster: null, platform: 'X', library_state } },
});

describe('News queries drop dropped shows and watched films', () => {
  it('recent and upcoming episodes drop dropped shows, keep paused', async () => {
    tables.rows.tv_show_episodes = [episode(1, 'active'), episode(2, 'stopped'), episode(3, 'paused')];
    for (const options of [recentEpisodesQuery(30), upcomingEpisodesQuery]) {
      const rows = await run<{ tv_show_id: number }[]>(options);
      expect(rows.map((row) => row.tv_show_id)).toEqual([1, 3]);
    }
  });

  it('recent movies drop watched films; upcoming movies keep them', async () => {
    tables.rows.movies = [
      { id: 1, title: 'A', poster: null, platform: null, release_date: '2026-11-10', watched: false },
      { id: 2, title: 'B', poster: null, platform: null, release_date: '2026-11-10', watched: true },
    ];
    expect((await run<{ id: number }[]>(recentMoviesQuery(30))).map((row) => row.id)).toEqual([1]);
    expect((await run<{ id: number }[]>(upcomingMoviesQuery)).map((row) => row.id)).toEqual([1, 2]);
  });

  it('events drop dropped shows and watched films', async () => {
    const event = (id: number, entity_type: string, entity_id: number) => ({
      id, entity_type, entity_id, kind: 'status_change', occurred_at: '2026-11-10T00:00:00Z', payload: {},
    });
    tables.rows.watchlist_events = [event(1, 'tv_show', 1), event(2, 'tv_show', 2), event(3, 'movie', 1), event(4, 'movie', 2)];
    tables.rows.tv_shows = [
      { id: 1, title: 'S1', poster: null, platform: null, library_state: 'paused' },
      { id: 2, title: 'S2', poster: null, platform: null, library_state: 'stopped' },
    ];
    tables.rows.movies = [
      { id: 1, title: 'M1', poster: null, platform: null, watched: false },
      { id: 2, title: 'M2', poster: null, platform: null, watched: true },
    ];
    const events = await run<{ id: number }[]>(watchlistEventsQuery(30));
    expect(events.map((row) => row.id)).toEqual([1, 3]);
  });

  it('announcements drop dropped shows', async () => {
    const created_at = '2026-11-17T00:00:00Z';
    tables.rows.tv_show_seasons = [
      { id: 1, tv_show_id: 1, season_number: 2, created_at, tv_shows: { title: 'A', poster: null, platform: null, library_state: 'active' } },
      { id: 2, tv_show_id: 2, season_number: 2, created_at, tv_shows: { title: 'B', poster: null, platform: null, library_state: 'stopped' } },
    ];
    tables.rows.tv_show_episodes = [episode(2, 'stopped')];
    const result = await run<{ announcements: { tv_show_id: number }[] }>(recentAnnouncementsQuery(7));
    expect(result.announcements.map((row) => row.tv_show_id)).toEqual([1]);
  });
});
