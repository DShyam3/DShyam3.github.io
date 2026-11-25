import { createElement } from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Season } from '@/features/watchlist/useWatchlist';

let mockIsAdmin = false;

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ isAdmin: mockIsAdmin }),
}));

import { SeasonEpisodeList } from './SeasonEpisodeList';

const multiSeasonFixture: Season[] = [
  {
    id: 101,
    season_number: 1,
    release_date: '2024-01-10',
    personal_rating: 9,
    episodes: [
      {
        id: 1001,
        episode_number: 1,
        title: 'Pilot',
        release_date: '2024-01-10',
        runtime: 52,
        watched: true,
        personal_rating: 8.5,
        imdb_rating: 8.7,
        tmdb_rating: 8.3,
        tmdb_votes: 12000,
      },
      {
        id: 1002,
        episode_number: 2,
        title: 'Second Hour',
        release_date: '2024-01-17',
        runtime: 48,
        watched: false,
        imdb_rating: 0,
        tmdb_rating: 0,
      },
      {
        id: 1003,
        episode_number: 3,
        title: 'Third Hour',
        release_date: '2024-01-24',
        runtime: 50,
        watched: false,
        imdb_rating: 9.1,
        tmdb_rating: 7.9,
      },
    ],
  },
  {
    id: 102,
    season_number: 2,
    release_date: '2025-02-01',
    episodes: [
      {
        id: 2001,
        episode_number: 1,
        title: 'Return',
        release_date: '2025-02-01',
        watched: false,
        imdb_rating: 7.2,
        tmdb_rating: 6.8,
      },
      {
        id: 2002,
        episode_number: 2,
        title: 'Aftermath',
        release_date: '2025-02-08',
        watched: false,
        imdb_rating: 7.6,
        tmdb_rating: 7.4,
      },
    ],
  },
];

function renderList({
  seasons = multiSeasonFixture,
  selectedSeason = 1,
  onRate,
  watchedKeys = new Set<string>(['42-s1-e1']),
}: {
  seasons?: Season[];
  selectedSeason?: number;
  onRate?: (rating: number | null, seasonNumber: number, episodeNumber?: number) => Promise<void>;
  watchedKeys?: ReadonlySet<string>;
} = {}) {
  return renderToStaticMarkup(
    createElement(SeasonEpisodeList, {
      seasons,
      showId: '42',
      selectedSeason,
      onSelectSeason: () => {},
      onRate,
      isEpisodeWatched: (id, s, e) => watchedKeys.has(`${id}-s${s}-e${e}`),
      isSeasonWatched: (id, season) =>
        season.episodes.length > 0 &&
        season.episodes.every((ep) => watchedKeys.has(`${id}-s${season.season_number}-e${ep.episode_number}`)),
    }),
  );
}

describe('SeasonEpisodeList', () => {
  beforeEach(() => {
    mockIsAdmin = false;
  });

  it('displays compact episode IMDb and TMDB scores when positive and omits missing or zero scores', () => {
    const markup = renderList({
      seasons: [
        {
          id: 10,
          season_number: 1,
          release_date: '2024-01-10',
          episodes: [
            {
              id: 1,
              episode_number: 1,
              title: 'Scored Episode',
              release_date: '2024-01-10',
              imdb_rating: 8.7,
              tmdb_rating: 8.3,
              tmdb_votes: 12400,
            },
            {
              id: 2,
              episode_number: 2,
              title: 'Zero Episode',
              release_date: '2024-01-17',
              imdb_rating: 0,
              tmdb_rating: 0,
            },
            {
              id: 3,
              episode_number: 3,
              title: 'Unscored Episode',
              release_date: '2024-01-24',
            },
          ],
        },
      ],
    });

    // Season average + EP 1 compact chips both show 8.7 and 8.3, while EP 2 (0) and EP 3 (missing) add none.
    expect(markup.match(/>IMDb</g)).toHaveLength(2);
    expect(markup.match(/>TMDB</g)).toHaveLength(2);
    expect(markup).toContain('>8.7<');
    expect(markup).toContain('>8.3<');
    expect(markup).not.toContain('>0.0<');
    // Compact episode chips omit vote counts so narrow rows stay clean.
    expect(markup).not.toContain('12k');
    expect(markup).toContain('px-1.5 py-0.5');
  });

  it('computes derived season IMDb and TMDB averages and updates when switching seasons', () => {
    const seasonOneMarkup = renderList({ selectedSeason: 1 });
    // Season 1: IMDb avg of [8.7, 0 (ignored), 9.1] = 8.9; TMDB avg of [8.3, 0 (ignored), 7.9] = 8.1
    expect(seasonOneMarkup).toContain('>8.9<');
    expect(seasonOneMarkup).toContain('>8.1<');
    expect(seasonOneMarkup).toContain('IMDb episode average out of 10');
    expect(seasonOneMarkup).toContain('TMDB episode average out of 10');
    expect(seasonOneMarkup.match(/>avg</g)).toHaveLength(2);

    const seasonTwoMarkup = renderList({ selectedSeason: 2 });
    // Season 2: IMDb avg of [7.2, 7.6] = 7.4; TMDB avg of [6.8, 7.4] = 7.1
    expect(seasonTwoMarkup).toContain('>7.4<');
    expect(seasonTwoMarkup).toContain('>7.1<');
    expect(seasonTwoMarkup).not.toContain('>8.9<');
    expect(seasonTwoMarkup).not.toContain('>8.1<');
  });

  it('shows read-only My score for visitors and PersonalRating without duplicating My score for admins', () => {
    mockIsAdmin = false;
    const visitorMarkup = renderList({ selectedSeason: 1 });
    expect(visitorMarkup).toContain('My score 9');
    expect(visitorMarkup).toContain('My score 8.5');

    mockIsAdmin = true;
    const adminMarkup = renderList({
      selectedSeason: 1,
      onRate: async () => {},
    });
    expect(adminMarkup).not.toContain('My score');
    expect(adminMarkup).toContain('Season 1 overall rating: 9/10');
    expect(adminMarkup).toContain('Episode 1 rating: 8.5/10');
  });

  it('renders worst-case data (empty season, missing dates and titles, long unbreakable title) cleanly', () => {
    const unbreakableTitle = 'Supercalifragilisticexpialidocious'.repeat(8);
    const emptySeasonMarkup = renderList({
      selectedSeason: 1,
      seasons: [
        {
          id: 99,
          season_number: 1,
          episodes: [],
        },
      ],
    });
    expect(emptySeasonMarkup).toContain('Released: TBA');
    expect(emptySeasonMarkup).toContain('0 episodes');
    expect(emptySeasonMarkup).not.toContain('episode average out of 10');

    const worstEpisodeMarkup = renderList({
      selectedSeason: 1,
      seasons: [
        {
          id: 100,
          season_number: 1,
          episodes: [
            {
              id: 501,
              episode_number: 1,
              title: '',
            },
            {
              id: 502,
              episode_number: 2,
              title: unbreakableTitle,
              release_date: '2024-05-01',
              watched: true,
            },
          ],
        },
      ],
      watchedKeys: new Set(['42-s1-e2']),
    });
    expect(worstEpisodeMarkup).toContain('Title unavailable');
    expect(worstEpisodeMarkup).toContain(unbreakableTitle);
    expect(worstEpisodeMarkup).toContain('min-w-0 break-words');
    expect(worstEpisodeMarkup).toContain('Watched');
  });
});
