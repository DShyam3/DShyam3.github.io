import { describe, expect, it } from 'vitest';
import { countdownRelease, isValidPersonalRating, libraryShelf, libraryStatus, matchesLibraryType, nextAirDate, nextRelease, nextSeasonToWatch, releaseCountdown, shelfFromParam, statusLabel } from './library-state';
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
  it('counts a series kept up with week by week as Watching, before and after the next episode airs', () => {
    expect(libraryStatus(show, today)).toBe('Watching');
    expect(libraryStatus(show, new Date(2026, 10, 18, 12))).toBe('Watching');
  });
  it('ignores unwatched specials when deciding caught up', () => {
    const waiting: WatchlistItem = { ...show, seasons: [{ season_number: 1, episodes: [show.seasons![0].episodes[0]] }] };
    expect(libraryStatus(waiting, today)).toBe('Caught up');
    expect(libraryStatus({ ...waiting, seasons: [...waiting.seasons!, { season_number: 0, episodes: [{ title: 'Special', episode_number: 1, release_date: '2025-01-01' }] }] }, today)).toBe('Caught up');
  });
  it('keeps Watching for a series part-way through a season, and sends one between seasons to To watch', () => {
    const ep = (episode_number: number, watched: boolean, release_date = '2026-01-01') => ({ title: `E${episode_number}`, episode_number, watched, release_date });
    const midSeason: WatchlistItem = { ...show, seasons: [{ season_number: 1, episodes: [ep(1, true), ep(2, true)] }, { season_number: 2, episodes: [ep(1, true), ep(2, false)] }] };
    expect(libraryStatus(midSeason, today)).toBe('Watching');
    expect(libraryShelf(midSeason, today)).toBe('Watching');
    expect(statusLabel(midSeason, today)).toBe('Watching');
    const boundary: WatchlistItem = { ...show, seasons: [{ season_number: 1, episodes: [ep(1, true), ep(2, true)] }, { season_number: 2, episodes: [ep(1, false), ep(2, false)] }] };
    expect(libraryStatus(boundary, today)).toBe('Between seasons');
    expect(libraryShelf(boundary, today)).toBe('To watch');
    expect(nextSeasonToWatch(boundary, today)).toBe(2);
    expect(statusLabel(boundary, today)).toBe('S2 next');
    expect(countdownRelease(boundary, today)).toBeNull();
    // Only a middle season ticked, as with a show started part-way: pick up
    // after the last season watched, not at season 1.
    const gap: WatchlistItem = { ...show, series_status: 'Ended', seasons: [1, 2, 3, 4, 5].map((season_number) => ({ season_number, episodes: [ep(1, season_number === 4), ep(2, season_number === 4)] })) };
    expect(libraryShelf(gap, today)).toBe('To watch');
    expect(statusLabel(gap, today)).toBe('S5 next');
    // Nothing left after the last season watched: fall back to the first gap.
    expect(nextSeasonToWatch({ ...gap, seasons: gap.seasons!.slice(0, 4) }, today)).toBe(1);
  });
  it('distinguishes completed from caught up and never completes an empty show', () => {
    expect(libraryStatus({ ...show, series_status: 'Ended', seasons: [{ season_number: 1, episodes: [show.seasons![0].episodes[0]] }] }, today)).toBe('Completed');
    expect(libraryStatus({ ...show, series_status: 'Ended', seasons: [] }, today)).toBe('To Watch');
    // An ended show with a dated episode still to air is being kept up with.
    expect(libraryStatus({ ...show, series_status: 'Ended' }, today)).toBe('Watching');
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
  it('keeps up with a show joined part-way, but treats a long break as caught up', () => {
    const ep = (episode_number: number, watched: boolean, release_date: string) => ({ title: `E${episode_number}`, episode_number, watched, release_date });
    // S1 never watched; S2 followed week by week.
    const joinedLate: WatchlistItem = { ...show, seasons: [
      { season_number: 1, episodes: [ep(1, false, '2025-01-01'), ep(2, false, '2025-01-08')] },
      { season_number: 2, episodes: [ep(1, true, '2026-11-03'), ep(2, true, '2026-11-10'), ep(3, false, '2026-11-24')] },
    ] };
    expect(libraryShelf(joinedLate, today)).toBe('Watching');
    expect(statusLabel(joinedLate, today)).toBe('S2E3 releases in 7 days');
    // A mid-season break of months is not watching now: Upcoming, counting down.
    const brk: WatchlistItem = { ...show, seasons: [{ season_number: 1, episodes: [ep(1, true, '2026-11-03'), ep(2, false, '2027-05-20')] }] };
    expect(libraryStatus(brk, today)).toBe('Caught up');
    expect(libraryShelf(brk, today)).toBe('Upcoming');
    expect(statusLabel(brk, today)).toBe('S1E2 releases in 184 days');
    // Two weeks out still counts as keeping up; fifteen days does not.
    const near = (day: string): WatchlistItem => ({ ...show, seasons: [{ season_number: 1, episodes: [ep(1, true, '2026-11-10'), ep(2, false, day)] }] });
    expect(libraryShelf(near('2026-12-01'), today)).toBe('Watching');
    expect(libraryShelf(near('2026-12-02'), today)).toBe('Upcoming');
  });
  it('keeps a title ticked before its air date off To watch', () => {
    const early: WatchlistItem = { ...show, seasons: [{ season_number: 1, episodes: [
      { title: 'Pilot', episode_number: 1, watched: true, release_date: '2026-11-18' },
      { title: 'Two', episode_number: 2, release_date: '2026-11-25' },
    ] }] };
    expect(libraryShelf(early, today)).toBe('Watching');
    expect(statusLabel(early, today)).toBe('S1E2 releases in 8 days');
  });
  it('shows no countdown for a series with something to watch now', () => {
    const ep = (episode_number: number, watched: boolean, release_date: string) => ({ title: `E${episode_number}`, episode_number, watched, release_date });
    const midSeason: WatchlistItem = { ...show, seasons: [{ season_number: 1, episodes: [ep(1, true, '2026-11-01'), ep(2, false, '2026-11-08'), ep(3, false, '2026-11-20')] }] };
    expect(countdownRelease(midSeason, today)).toBeNull();
    expect(statusLabel(midSeason, today)).toBe('Watching');
  });
  it('keeps a series kept up with week by week on Watching, counting down to its next episode', () => {
    expect(libraryShelf(show, today)).toBe('Watching');
    expect(statusLabel(show, today)).toBe('S1E2 releases in 1 day');
    expect(libraryShelf(show, new Date(2026, 10, 18, 12))).toBe('Watching');
    expect(statusLabel(show, new Date(2026, 10, 18, 12))).toBe('Watching');
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
    expect(libraryShelf(watchedOpener, new Date(2026, 10, 17, 1))).toBe('Watching');
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
  it('labels films and season premieres with a countdown, and settled titles plainly', () => {
    const film: WatchlistItem = { id: '9', title: 'Film', category: 'Movies', created_at: '', release_date: '2026-11-20' };
    expect(statusLabel(film, today)).toBe('releases in 3 days');
    expect(statusLabel({ ...film, release_date: '2026-11-01' }, today)).toBe('Released');
    expect(statusLabel({ ...film, release_date: '2026-11-01', watched: true }, today)).toBe('Watched');
    const waiting: WatchlistItem = { ...show, seasons: [{ season_number: 1, episodes: [show.seasons![0].episodes[0]] }, { season_number: 2, release_date: '2027-03-01', episodes: [] }] };
    expect(statusLabel(waiting, today)).toBe('S2 releases in 104 days');
    expect(statusLabel({ ...waiting, seasons: [waiting.seasons![0]] }, today)).toBe('Caught up');
    expect(statusLabel({ ...show, library_state: 'stopped' }, today)).toBe('Stopped watching');
    expect(statusLabel({ ...show, library_state: 'hidden' }, today)).toBe('Hidden');
    expect(statusLabel({ ...show, seasons: [] }, today)).toBe('Returning Series');
    const notStarted: WatchlistItem = { ...show, seasons: [{ season_number: 1, episodes: [{ title: 'One', episode_number: 1, release_date: '2026-11-01' }] }] };
    expect(statusLabel(notStarted, today)).toBe('To Watch');
    expect(statusLabel({ ...notStarted, series_status: 'Ended', seasons: [{ season_number: 1, episodes: [{ title: 'One', episode_number: 1, watched: true, release_date: '2026-11-01' }] }] }, today)).toBe('Completed');
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
