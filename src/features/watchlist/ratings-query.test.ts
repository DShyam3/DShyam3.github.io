import { describe, expect, it, vi } from 'vitest';

// The pure helpers only; the query itself is not run here.
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
import { applyRatings, withRating, type RatingRow } from './ratings-query';
import type { WatchlistItem } from './WatchlistContext';

const film: WatchlistItem = { id: '5', title: 'Film', category: 'Movies', created_at: '' };
const show: WatchlistItem = {
  id: '5', title: 'Show', category: 'TV Shows', created_at: '',
  seasons: [{ id: 50, season_number: 1, episodes: [{ id: 500, episode_number: 1, title: '' }, { id: 501, episode_number: 2, title: '' }] }],
};
const row = (overrides: Partial<RatingRow>): RatingRow => ({ movie_id: null, tv_show_id: null, season_id: null, episode_id: null, rating: 7, ...overrides });

describe('applyRatings', () => {
  it('keeps a film and a show that share an id apart', () => {
    const [ratedFilm, ratedShow] = applyRatings([film, show], [row({ movie_id: 5, rating: 9 })]);
    expect(ratedFilm.personal_rating).toBe(9);
    expect(ratedShow.personal_rating).toBeUndefined();
  });
  it('lays scores onto the show, its season and its episode', () => {
    const [rated] = applyRatings([show], [row({ tv_show_id: 5, rating: 8 }), row({ season_id: 50, rating: 7.5 }), row({ episode_id: 501, rating: 10 })]);
    expect(rated.personal_rating).toBe(8);
    expect(rated.seasons?.[0].personal_rating).toBe(7.5);
    expect(rated.seasons?.[0].episodes.map((episode) => episode.personal_rating)).toEqual([undefined, 10]);
  });
  it('returns the library untouched when there are no scores', () => {
    const library = [film, show];
    expect(applyRatings(library, [])).toBe(library);
  });
});

describe('withRating', () => {
  it('sets, replaces and clears one target without touching the others', () => {
    const rows = [row({ movie_id: 5, rating: 6 }), row({ episode_id: 500, rating: 4 })];
    expect(withRating(rows, { movie_id: 5 }, 9).find((r) => r.movie_id === 5)?.rating).toBe(9);
    expect(withRating(rows, { movie_id: 5 }, null).map((r) => r.episode_id)).toEqual([500]);
    expect(withRating(rows, { tv_show_id: 5 }, 8)).toHaveLength(3);
  });
});
