import { describe, expect, it } from 'vitest';
import { isValidPersonalRating, libraryShelf, libraryStatus, matchesLibraryType, nextAirDate, shelfFromParam } from './library-state';
import type { WatchlistItem } from './WatchlistContext';
const today = new Date(2026, 10, 17, 12);
const show: WatchlistItem = {
  id: '1', title: 'Example', category: 'TV Shows', created_at: '', series_status: 'Returning Series',
  seasons: [{ season_number: 1, episodes: [
    { title: 'One', episode_number: 1, watched: true, release_date: '2026-11-16' },
    { title: 'Two', episode_number: 2, watched: false, release_date: '2026-11-18' },
  ] }],
};
describe('library progress', () => {
  it('keeps a series caught up until its next episode airs', () => {
    expect(libraryStatus(show, today)).toBe('Caught up');
    expect(libraryStatus(show, new Date(2026, 10, 18, 12))).toBe('Watching');
  });
  it('ignores unwatched specials when deciding caught up', () => {
    expect(libraryStatus({ ...show, seasons: [...show.seasons!, { season_number: 0, episodes: [{ title: 'Special', episode_number: 1, release_date: '2025-01-01' }] }] }, today)).toBe('Caught up');
  });
  it('distinguishes completed from caught up and never completes an empty show', () => {
    expect(libraryStatus({ ...show, series_status: 'Ended', seasons: [{ season_number: 1, episodes: [show.seasons![0].episodes[0]] }] }, today)).toBe('Completed');
    expect(libraryStatus({ ...show, series_status: 'Ended', seasons: [] }, today)).toBe('To Watch');
    expect(libraryStatus({ ...show, series_status: 'Ended' }, today)).toBe('Caught up');
  });
  it('never assumes an unknown release date has aired', () => {
    expect(libraryStatus({ ...show, seasons: [{ season_number: 1, episodes: [{ title: 'TBA', episode_number: 1 }] }] }, today)).toBe('To Watch');
  });
  it('preserves a watched film while hidden and restores its history', () => {
    const movie: WatchlistItem = { ...show, category: 'Movies', watched: true, library_state: 'hidden' };
    expect(libraryStatus(movie, today)).toBe('Hidden');
    expect(libraryShelf(movie, today)).toBe('Hidden');
    expect(libraryShelf({ ...movie, library_state: 'active' }, today)).toBe('Finished');
    expect(libraryStatus({ ...show, library_state: 'stopped' }, today)).toBe('Stopped watching');
  });
});
describe('library shelves', () => {
  const ended: WatchlistItem = { ...show, series_status: 'Ended', seasons: [{ season_number: 1, episodes: [show.seasons![0].episodes[0]] }] };
  it('keeps a running series you are caught up on out of Finished', () => {
    expect(libraryShelf(show, today)).toBe('Up to date');
    expect(libraryShelf(show, new Date(2026, 10, 18, 12))).toBe('Watching');
  });
  it('finishes an ended series only once every episode is watched', () => {
    expect(libraryShelf(ended, today)).toBe('Finished');
    const unfinished = { ...ended, seasons: [{ season_number: 1, episodes: [{ ...show.seasons![0].episodes[0], watched: false }] }] };
    expect(libraryShelf(unfinished, today)).toBe('To watch');
  });
  it('splits films into to watch, upcoming and finished', () => {
    const film: WatchlistItem = { id: '2', title: 'Film', category: 'Movies', created_at: '' };
    expect(libraryShelf({ ...film, release_date: '2026-11-17' }, today)).toBe('To watch');
    expect(libraryShelf({ ...film, release_date: '2026-11-18' }, today)).toBe('Upcoming');
    expect(libraryShelf({ ...film, release_date: '2026-11-18', watched: true }, today)).toBe('Finished');
    expect(libraryShelf(film, today)).toBe('To watch');
  });
  it('treats a series with nothing aired as upcoming, and one with unknown dates as to watch', () => {
    const fresh = { ...show, seasons: [{ season_number: 1, release_date: '2027-01-01', episodes: [{ title: 'Pilot', episode_number: 1, release_date: '2027-01-01' }] }] };
    expect(libraryShelf(fresh, today)).toBe('Upcoming');
    expect(libraryShelf({ ...show, seasons: [{ season_number: 1, episodes: [{ title: 'TBA', episode_number: 1 }] }] }, today)).toBe('To watch');
    const started = { ...show, seasons: [{ season_number: 1, episodes: [{ title: 'One', episode_number: 1, release_date: '2026-11-01' }, { title: 'Two', episode_number: 2, release_date: '2026-12-01' }] }] };
    expect(libraryShelf(started, today)).toBe('To watch');
  });
  it('does not let an undated episode of an ended series hold it off Finished', () => {
    const undated: WatchlistItem = { ...ended, seasons: [{ season_number: 1, episodes: [show.seasons![0].episodes[0], { title: 'Lost pilot', episode_number: 2 }] }] };
    expect(libraryShelf(undated, today)).toBe('Finished');
    expect(libraryShelf({ ...undated, series_status: 'Returning Series' }, today)).toBe('Up to date');
  });
  it('keeps hidden and stopped titles off every other shelf', () => {
    expect(libraryShelf({ ...show, library_state: 'stopped' }, today)).toBe('Stopped watching');
    expect(libraryShelf({ ...ended, library_state: 'hidden' }, today)).toBe('Hidden');
  });
  it('orders by the soonest known future air date', () => {
    expect(nextAirDate(show, today)).toBe('2026-11-18');
    expect(nextAirDate(ended, today)).toBeNull();
  });
  it('filters by type and maps old category links', () => {
    expect(matchesLibraryType(show, 'all')).toBe(true);
    expect(matchesLibraryType(show, 'movie')).toBe(false);
    expect(matchesLibraryType(show, 'tv')).toBe(true);
    expect(shelfFromParam('tv-shows')).toEqual({ shelf: 'To watch', type: 'tv' });
    expect(shelfFromParam('watched')).toEqual({ shelf: 'Finished' });
    expect(shelfFromParam('favourites')).toEqual({ shelf: 'Favourites' });
    expect(shelfFromParam('nonsense')).toBeNull();
  });
});
describe('personal scores', () => {
  it('accepts half-points and an explicit unrated value', () => {
    for (const value of [null, 0.5, 1, 7.5, 10]) expect(isValidPersonalRating(value)).toBe(true);
  });
  it('rejects zero, arbitrary fractions and non-finite scores', () => {
    for (const value of [0, -1, 10.5, 7.25, NaN, Infinity]) expect(isValidPersonalRating(value)).toBe(false);
  });
});
