import type { WatchlistItem } from './useWatchlist';
import type { ScheduleItem } from './useSchedule';

export interface CalendarEvent {
  id: string;
  date: string;
  item: WatchlistItem;
  schedule?: ScheduleItem;
  label: string;
  releaseDate?: string;
  kind: 'plan' | 'suggestion';
  unreleased: boolean;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const calendarDateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const parseDate = (value: string) => new Date(`${value}T12:00:00`);
const validDate = (value?: string): value is string => !!value && /^\d{4}-\d{2}-\d{2}$/.test(value) && calendarDateKey(parseDate(value)) === value;
const addDays = (date: Date, days: number) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

export function calendarWeekStart(date: Date) {
  return addDays(new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12), -(date.getDay() + 6) % 7);
}

/** A projection of remaining work, never a write or a prediction of watched progress.
 * Rebuilding from today carries unfinished episodes forward. Saved weekday choices
 * remain dormant when caught up and resume if a later season is announced.
 */
export function buildCalendarEvents(
  schedule: ScheduleItem[],
  watchlist: WatchlistItem[],
  isEpisodeWatched: (showId: string, season: number, episode: number) => boolean,
  today: Date,
): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  const todayKey = calendarDateKey(today);
  const weekStart = calendarWeekStart(today);
  for (const entry of schedule) {
    const item = watchlist.find((title) => title.id === entry.watchlistItemId && title.category === entry.category);
    if (!item) continue;
    const push = (date: string, label: string, releaseDate?: string) => events.push({
      id: `${entry.id}:${date}`, date, item, schedule: entry, label, releaseDate,
      kind: 'plan', unreleased: !!releaseDate && releaseDate > todayKey,
    });
    if (entry.mode === 'date') {
      if (validDate(entry.scheduledDate)) push(entry.scheduledDate, 'One-off plan', validDate(item.release_date) ? item.release_date : undefined);
      continue;
    }
    let cursor = addDays(weekStart, DAYS.indexOf(entry.day));
    // Weekly movie entries are legacy manual plans, with no episode progression.
    if (item.category !== 'TV Shows') {
      if (item.status !== 'Watched' && item.status !== 'Completed') push(calendarDateKey(cursor), 'Weekly plan');
      continue;
    }
    const seasons = [...(item.seasons ?? [])].filter((season) => season.season_number > 0).sort((a, b) => a.season_number - b.season_number);
    const onReleaseWeekday = (release: string) => {
      if (calendarDateKey(cursor) < release) {
        cursor = parseDate(release);
        cursor = addDays(cursor, (DAYS.indexOf(entry.day) - (cursor.getDay() + 6) % 7 + 7) % 7);
      }
    };
    if (seasons.length === 0) {
      if (validDate(item.release_date) && item.release_date > todayKey) onReleaseWeekday(item.release_date);
      push(calendarDateKey(cursor), 'Episode schedule not announced', validDate(item.release_date) ? item.release_date : undefined);
    }
    for (const season of seasons) {
      const episodes = [...season.episodes].sort((a, b) => a.episode_number - b.episode_number);
      if (episodes.length === 0 && !season.watched) {
        const release = validDate(season.release_date) ? season.release_date : undefined;
        if (release) onReleaseWeekday(release);
        push(calendarDateKey(cursor), `Season ${season.season_number} · episode dates TBC`, release);
        cursor = addDays(cursor, 7);
      }
      for (const episode of episodes) {
        if (isEpisodeWatched(item.id, season.season_number, episode.episode_number)) continue;
        const release = validDate(episode.release_date) ? episode.release_date : undefined;
        const seasonRelease = validDate(season.release_date) ? season.release_date : undefined;
        if (release ?? seasonRelease) onReleaseWeekday((release ?? seasonRelease)!);
        const label = `S${season.season_number}E${episode.episode_number}${episode.title ? ` · ${episode.title}` : ''}`;
        push(calendarDateKey(cursor), `${label}${release ? '' : ' · release date TBC'}`, release);
        cursor = addDays(cursor, 7);
        // Without a date we cannot project subsequent episodes reliably.
        if (!release) break;
      }
    }
  }

  for (const item of watchlist) {
    if (schedule.some((entry) => entry.watchlistItemId === item.id && entry.category === item.category)) continue;
    const suggest = (date: string | undefined, label: string, suffix: string) => {
      if (!validDate(date) || date < todayKey) return;
      events.push({ id: `suggestion:${item.category}:${item.id}:${suffix}`, date, item, label, releaseDate: date, kind: 'suggestion', unreleased: date > todayKey });
    };
    if (item.category === 'TV Shows') {
      const seasons = (item.seasons ?? []).filter((season) => season.season_number > 0);
      if (seasons.length === 0) suggest(item.release_date, 'Series premiere', 'premiere');
      for (const season of seasons) {
        const premiere = season.episodes.find((episode) => episode.episode_number === 1);
        if (season.watched || (premiere && isEpisodeWatched(item.id, season.season_number, 1))) continue;
        suggest(premiere?.release_date ?? season.release_date, `Season ${season.season_number} premiere`, String(season.season_number));
      }
    } else if (item.status !== 'Watched' && item.status !== 'Completed') {
      suggest(item.release_date, 'Film release', 'release');
    }
  }
  return events.sort((a, b) => a.date.localeCompare(b.date) || a.item.title.localeCompare(b.item.title));
}
