import { describe, expect, it } from 'vitest';
import type { WatchlistItem } from './WatchlistContext';
import { computeCoolFacts, type CreditsRow } from './cool-facts';

function makeMovie(overrides: Partial<WatchlistItem>): WatchlistItem {
  return {
    id: '1',
    title: 'Movie',
    category: 'Movies',
    watched: true,
    runtime: 120,
    year: 2022,
    genres: ['Action'],
    streaming_platform: 'Netflix',
    created_at: '2022-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('computeCoolFacts', () => {
  it('ranks most watched cast, directors, and creators across watched titles only', () => {
    const m1 = makeMovie({ id: '1', title: 'Film A', watched: true });
    const m2 = makeMovie({ id: '2', title: 'Film B', watched: true, runtime: 90, year: 2018 });
    const unwatched = makeMovie({ id: '3', title: 'Unwatched', watched: false });
    const show: WatchlistItem = {
      id: '10',
      title: 'Series A',
      category: 'TV Shows',
      year: 2024,
      genres: ['Drama'],
      streaming_platform: 'Prime Video',
      created_at: '2024-01-01T00:00:00Z',
      seasons: [
        {
          id: 1,
          season_number: 1,
          episodes: [
            { id: 1, episode_number: 1, title: 'Ep 1', watched: true, runtime: 50 },
            { id: 2, episode_number: 2, title: 'Ep 2', watched: true, runtime: 50 },
            { id: 3, episode_number: 3, title: 'Ep 3', watched: false, runtime: 50 },
          ],
        },
      ],
    };

    const credits = new Map<string, CreditsRow>([
      ['Movies:1', { key: 'Movies:1', directors: ['Dir A'], top_cast: ['Actor X', 'Actor Y'] }],
      ['Movies:2', { key: 'Movies:2', directors: ['Dir A'], top_cast: ['Actor X'] }],
      ['Movies:3', { key: 'Movies:3', directors: ['Dir B'], top_cast: ['Actor Z'] }],
      ['TV Shows:10', { key: 'TV Shows:10', creators: ['Creator C'], top_cast: ['Actor X', 'Actor Y'] }],
    ]);

    const facts = computeCoolFacts([m1, m2, unwatched, show], credits);

    expect(facts.watchedMoviesCount).toBe(2);
    expect(facts.watchedShowsCount).toBe(1);
    expect(facts.completedShowsCount).toBe(0);
    expect(facts.watchedEpisodesCount).toBe(2);
    expect(facts.totalWatchedMinutes).toBe(310);
    expect(facts.movieWatchedMinutes).toBe(210);
    expect(facts.showWatchedMinutes).toBe(100);
    expect(facts.averageMovieMinutes).toBe(105);
    expect(facts.longestWatchedMovie).toMatchObject({ title: 'Film A', minutes: 120, year: 2022 });
    expect(facts.mostWatchedShow).toMatchObject({ title: 'Series A', episodes: 2, minutes: 100 });
    expect(facts.topCast[0]).toMatchObject({ name: 'Actor X', titleCount: 3, movieCount: 2, showCount: 1, episodeCount: 2 });
    expect(facts.topCast[1]).toMatchObject({ name: 'Actor Y', titleCount: 2 });
    expect(facts.topDirectors.map((d) => d.name)).toEqual(['Dir A']);
    expect(facts.topCreators.map((c) => c.name)).toEqual(['Creator C']);
  });

  it('tracks completed shows when all regular-season episodes are watched', () => {
    const completedShow: WatchlistItem = {
      id: '20',
      title: 'Finished Mini-Series',
      category: 'TV Shows',
      year: 2023,
      created_at: '2023-01-01T00:00:00Z',
      seasons: [
        {
          id: 1,
          season_number: 1,
          episodes: [
            { id: 1, episode_number: 1, title: 'Part 1', watched: true, runtime: 60 },
            { id: 2, episode_number: 2, title: 'Part 2', watched: true, runtime: 60 },
          ],
        },
      ],
    };

    const facts = computeCoolFacts([completedShow], new Map());
    expect(facts.watchedShowsCount).toBe(1);
    expect(facts.completedShowsCount).toBe(1);
    expect(facts.mostWatchedShow).toMatchObject({ title: 'Finished Mini-Series', episodes: 2, minutes: 120 });
    expect(facts.longestWatchedMovie).toBeNull();
  });
});
