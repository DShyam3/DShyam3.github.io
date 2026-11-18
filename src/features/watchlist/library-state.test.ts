import { describe, expect, it } from 'vitest';
import { countdownRelease, isValidPersonalRating, libraryShelf, libraryStatus, matchesLibraryType, nextAirDate, nextRelease, releaseCountdown, shelfFromParam } from './library-state';
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
  it('puts a caught-up series with a dated next episode on Upcoming until it airs', () => {
    expect(libraryShelf(show, today)).toBe('Upcoming');
    expect(libraryShelf(show, new Date(2026, 10, 18, 12))).toBe('Watching');
  });
  it('keeps a running series caught up with no next date on Up to date, out of Finished', () => {
    const waiting: WatchlistItem = { ...show, seasons: [{ season_number: 1, episodes: [show.seasons![0].episodes[0]] }] };
    expect(libraryShelf(waiting, today)).toBe('Up to date');
    const announced: WatchlistItem = { ...waiting, seasons: [...waiting.seasons!, { season_number: 2, release_date: '2027-03-01', episodes: [] }] };
    expect(libraryShelf(announced, today)).toBe('Upcoming');
  });
  it('names the soonest future episode, ignoring specials and aired ones', () => {
    expect(nextRelease(show, today)).toEqual({ date: '2026-11-18', season: 1, episode: 2 });
    expect(nextRelease(show, new Date(2026, 10, 18, 12))).toBeNull();
    const special: WatchlistItem = { ...show, seasons: [...show.seasons!, { season_number: 0, episodes: [{ title: 'Special', episode_number: 1, release_date: '2026-11-17' }] }] };
    expect(nextRelease(special, new Date(2026, 10, 16, 12))).toEqual({ date: '2026-11-18', season: 1, episode: 2 });
  });
  it('reads a premiere as the season, on its own date or through episode 1', () => {
    const premiere: WatchlistItem = { ...show, seasons: [show.seasons![0], { season_number: 2, release_date: '2026-11-17', episodes: [
      { title: 'Opener', episode_number: 1, release_date: '2026-11-17' },
      { title: 'Second', episode_number: 2, release_date: '2026-11-24' },
    ] }] };
    // The day before: the season, not "S2E1".
    expect(nextRelease(premiere, new Date(2026, 10, 16, 12))).toEqual({ date: '2026-11-17', season: 2 });
    // Premiere day: it has come out, so the next is episode 2 -- the shelf and
    // the pill agree, whatever the time zone.
    const watchedOpener: WatchlistItem = { ...premiere, seasons: [{ ...show.seasons![0], episodes: [show.seasons![0].episodes[0]] }, { ...premiere.seasons![1], episodes: [{ ...premiere.seasons![1].episodes[0], watched: true }, premiere.seasons![1].episodes[1]] }] };
    expect(nextRelease(watchedOpener, new Date(2026, 10, 17, 1))).toEqual({ date: '2026-11-24', season: 2, episode: 2 });
    expect(libraryShelf(watchedOpener, new Date(2026, 10, 17, 1))).toBe('Upcoming');
  });
  it('counts a caught-up series to its next episode, anything else to a premiere or release', () => {
    expect(countdownRelease(show, today)).toEqual({ date: '2026-11-18', season: 1, episode: 2 });
    const notStarted: WatchlistItem = { ...show, seasons: [
      { season_number: 1, episodes: [{ title: 'One', episode_number: 1, release_date: '2026-11-10' }, { title: 'Two', episode_number: 2, release_date: '2026-11-24' }] },
      { season_number: 2, release_date: '2027-06-01', episodes: [] },
    ] };
    expect(countdownRelease(notStarted, today)).toEqual({ date: '2027-06-01', season: 2 });
    const episodeDatedPremiere: WatchlistItem = { ...show, seasons: [
      { season_number: 1, episodes: [{ title: 'Pilot', episode_number: 1, release_date: '2026-12-01' }] },
    ] };
    expect(countdownRelease(episodeDatedPremiere, today)).toEqual({ date: '2026-12-01', season: 1 });
    const film: WatchlistItem = { id: '9', title: 'Film', category: 'Movies', created_at: '', release_date: '2026-11-20' };
    expect(countdownRelease(film, today)).toEqual({ date: '2026-11-20' });
    expect(countdownRelease({ ...film, release_date: '2026-11-17' }, today)).toBeNull();
  });
  it('writes the pill in local calendar days', () => {
    expect(releaseCountdown({ date: '2026-11-18', season: 1, episode: 2 }, today)).toBe('S1E2 releases in 1 day');
    expect(releaseCountdown({ date: '2026-11-20', season: 3 }, new Date(2026, 10, 17, 23, 59))).toBe('S3 releases in 3 days');
    expect(releaseCountdown({ date: '2026-11-27' }, today)).toBe('releases in 10 days');
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
    expect(shelfFromParam('up-to-date')).toEqual({ shelf: 'Up to date' });
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
