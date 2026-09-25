import { describe, expect, it } from 'vitest';
import { buildCalendarEvents, calendarDateKey, calendarWeekStart } from './calendar';
import type { WatchlistItem } from './useWatchlist';
import type { ScheduleItem } from './useSchedule';

const today = new Date(2026, 8, 24, 12);
const show: WatchlistItem = {
  id: '1', title: 'Lanterns', category: 'TV Shows', created_at: '',
  seasons: [{ season_number: 1, episodes: Array.from({ length: 8 }, (_, index) => ({
    episode_number: index + 1, title: `Episode ${index + 1}`,
    release_date: calendarDateKey(new Date(2026, 7, 16 + index * 7, 12)),
  })) }],
};
const weekly: ScheduleItem = { id: 'plan', watchlistItemId: '1', category: 'TV Shows', day: 'Sunday', mode: 'weekly' };
const watchedThrough = (count: number) => (_id: string, _season: number, episode: number) => episode <= count;

describe('calendar episode plans', () => {
  it('projects only remaining episodes on chosen weekdays and stops after the finale', () => {
    const events = buildCalendarEvents([weekly], [show], watchedThrough(3), today);
    expect(events.map((event) => [event.date, event.label])).toEqual([
      ['2026-09-27', 'S1E4 · Episode 4'], ['2026-10-04', 'S1E5 · Episode 5'],
      ['2026-10-11', 'S1E6 · Episode 6'], ['2026-10-18', 'S1E7 · Episode 7'],
      ['2026-10-25', 'S1E8 · Episode 8'],
    ]);
    expect(events.some((event) => event.date.startsWith('2027'))).toBe(false);
  });
  it('removes a caught-up completed run without deleting the saved preference', () => {
    expect(buildCalendarEvents([weekly], [show], watchedThrough(8), today)).toEqual([]);
    expect(weekly.day).toBe('Sunday');
  });
  it('carries unfinished episodes into the current week, then advances after a watched change', () => {
    const later = new Date(2027, 1, 22, 12);
    expect(buildCalendarEvents([weekly], [show], watchedThrough(7), later)[0].date).toBe('2027-02-28');
    const events = buildCalendarEvents([weekly], [show], watchedThrough(4), today);
    expect(events[0].label).toContain('S1E5');
    expect(events[0].date).toBe('2026-09-27');
  });
  it('never projects an episode before release, including a chosen day earlier in the week', () => {
    const events = buildCalendarEvents([{ ...weekly, day: 'Thursday' }], [show], watchedThrough(6), today);
    expect(events.map((event) => event.date)).toEqual(['2026-10-01', '2026-10-08']);
    expect(events.every((event) => event.unreleased)).toBe(true);
  });
  it('resumes for an announced later season without filling the hiatus', () => {
    const returning: WatchlistItem = { ...show, seasons: [...show.seasons!, { season_number: 2, release_date: '2027-02-23', episodes: [] }] };
    const events = buildCalendarEvents([weekly], [returning], watchedThrough(8), today);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ date: '2027-02-28', label: 'Season 2 · episode dates TBC' });
  });
  it('keeps an unknown release as TBC, without inventing an endless weekly run', () => {
    const unknown: WatchlistItem = { ...show, seasons: [{ season_number: 1, episodes: [{ episode_number: 1, title: '' }, { episode_number: 2, title: '' }] }] };
    expect(buildCalendarEvents([weekly], [unknown], watchedThrough(0), today)).toMatchObject([
      { date: '2026-09-27', label: 'S1E1 · release date TBC' },
    ]);
  });
  it('retains an explicit one-off date', () => {
    const events = buildCalendarEvents([{ ...weekly, mode: 'date', scheduledDate: '2027-03-02' }], [show], watchedThrough(8), today);
    expect(events).toMatchObject([{ date: '2027-03-02', label: 'One-off plan' }]);
  });
});

describe('calendar release suggestions', () => {
  it('adds dated premieres and films without treating them as saved plans', () => {
    const upcoming: WatchlistItem = { ...show, seasons: [{ season_number: 2, release_date: '2027-01-07', episodes: [] }] };
    const movie: WatchlistItem = { id: '1', title: 'Film', category: 'Movies', created_at: '', release_date: '2027-01-08' };
    const events = buildCalendarEvents([], [upcoming, movie], watchedThrough(0), today);
    expect(events.map((event) => [event.kind, event.date, event.label])).toEqual([
      ['suggestion', '2027-01-07', 'Season 2 premiere'], ['suggestion', '2027-01-08', 'Film release'],
    ]);
    expect(events.every((event) => event.schedule === undefined)).toBe(true);
  });
  it('avoids duplicate suggestions for scheduled titles while distinguishing film and TV IDs', () => {
    const movie: WatchlistItem = { ...show, category: 'Movies', release_date: '2026-10-01' };
    const events = buildCalendarEvents([weekly], [show, movie], watchedThrough(8), today);
    expect(events).toHaveLength(1);
    expect(events[0].item.category).toBe('Movies');
  });
  it('omits unknown, invalid, past and already-watched premieres', () => {
    const invalid: WatchlistItem = { ...show, category: 'Movies', release_date: '2027-02-30' };
    expect(buildCalendarEvents([], [show, invalid], watchedThrough(8), today)).toEqual([]);
  });
  it('uses the premiere episode date over a season date and skips specials', () => {
    const item: WatchlistItem = { ...show, seasons: [
      { season_number: 0, release_date: '2026-12-01', episodes: [] },
      { season_number: 2, release_date: '2026-12-01', episodes: [{ episode_number: 1, title: '', release_date: '2026-12-03' }] },
    ] };
    expect(buildCalendarEvents([], [item], watchedThrough(0), today)).toMatchObject([{ date: '2026-12-03', label: 'Season 2 premiere' }]);
  });
  it('keeps Monday-first local weeks across year and daylight-saving boundaries', () => {
    expect(calendarDateKey(calendarWeekStart(new Date(2027, 0, 1, 12)))).toBe('2026-12-28');
    expect(calendarDateKey(calendarWeekStart(new Date(2026, 9, 25, 12)))).toBe('2026-10-19');
  });
});
