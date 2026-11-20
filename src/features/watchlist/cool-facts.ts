import type { WatchlistItem } from './WatchlistContext';

export interface CreditsRow {
  key: string;
  directors?: string[] | null;
  creators?: string[] | null;
  top_cast?: string[] | null;
}

export interface SampleTitlePoster {
  title: string;
  imageUrl?: string;
}

export interface WatchedPersonStat {
  name: string;
  titleCount: number;
  movieCount: number;
  showCount: number;
  episodeCount: number;
  sampleItems: SampleTitlePoster[];
}

export interface LabelCount {
  label: string;
  count: number;
}

export interface CoolFactsSummary {
  watchedMoviesCount: number;
  watchedShowsCount: number;
  watchedEpisodesCount: number;
  totalWatchedMinutes: number;
  topCast: WatchedPersonStat[];
  topDirectors: WatchedPersonStat[];
  topCreators: WatchedPersonStat[];
  topGenres: LabelCount[];
  topPlatforms: LabelCount[];
  topDecades: LabelCount[];
}

function watchedEpisodesForShow(item: WatchlistItem): { count: number; minutes: number } {
  let count = 0;
  let minutes = 0;
  for (const season of item.seasons ?? []) {
    if (season.season_number <= 0) continue;
    for (const ep of season.episodes) {
      if (!ep.watched) continue;
      count += 1;
      minutes += ep.runtime ?? 0;
    }
  }
  return { count, minutes };
}

function addPersonCounts(
  map: Map<string, WatchedPersonStat>,
  names: string[] | null | undefined,
  item: WatchlistItem,
  episodeCount: number,
) {
  if (!names?.length) return;
  const seenInTitle = new Set<string>();
  for (const raw of names) {
    const name = raw.trim();
    if (!name || seenInTitle.has(name)) continue;
    seenInTitle.add(name);

    const existing = map.get(name) ?? {
      name,
      titleCount: 0,
      movieCount: 0,
      showCount: 0,
      episodeCount: 0,
      sampleItems: [],
    };
    existing.titleCount += 1;
    if (item.category === 'Movies') {
      existing.movieCount += 1;
    } else {
      existing.showCount += 1;
      existing.episodeCount += episodeCount;
    }
    if (existing.sampleItems.length < 4) {
      existing.sampleItems.push({ title: item.title, imageUrl: item.image_url });
    }
    map.set(name, existing);
  }
}

function rankPeople(map: Map<string, WatchedPersonStat>, limit = 10): WatchedPersonStat[] {
  return [...map.values()]
    .sort(
      (a, b) =>
        b.titleCount - a.titleCount ||
        b.episodeCount - a.episodeCount ||
        a.name.localeCompare(b.name),
    )
    .slice(0, limit);
}

function incrementBucket(map: Map<string, number>, rawLabel: string | null | undefined) {
  const label = rawLabel?.trim();
  if (!label) return;
  map.set(label, (map.get(label) ?? 0) + 1);
}

function rankBuckets(map: Map<string, number>, limit: number): LabelCount[] {
  return [...map.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, limit);
}

/**
 * Compute deterministic "Cool facts" over watched titles in the library,
 * joining `watchlist` with per-title `directors`, `creators`, and `top_cast`.
 */
export function computeCoolFacts(
  watchlist: WatchlistItem[],
  creditsByKey: Map<string, CreditsRow>,
): CoolFactsSummary {
  let watchedMoviesCount = 0;
  let watchedShowsCount = 0;
  let watchedEpisodesCount = 0;
  let totalWatchedMinutes = 0;

  const castMap = new Map<string, WatchedPersonStat>();
  const directorMap = new Map<string, WatchedPersonStat>();
  const creatorMap = new Map<string, WatchedPersonStat>();
  const genreMap = new Map<string, number>();
  const platformMap = new Map<string, number>();
  const decadeMap = new Map<string, number>();

  for (const item of watchlist) {
    if (item.library_state === 'hidden') continue;

    const isMovie = item.category === 'Movies';
    let episodesWatched = 0;
    if (isMovie) {
      if (!item.watched) continue;
      watchedMoviesCount += 1;
      totalWatchedMinutes += item.runtime ?? 0;
    } else {
      const epStats = watchedEpisodesForShow(item);
      if (epStats.count === 0) continue;
      episodesWatched = epStats.count;
      watchedShowsCount += 1;
      watchedEpisodesCount += epStats.count;
      totalWatchedMinutes += epStats.minutes;
    }

    const key = `${item.category}:${item.id}`;
    const credits = creditsByKey.get(key);
    addPersonCounts(castMap, credits?.top_cast ?? item.top_cast, item, episodesWatched);
    if (isMovie) {
      addPersonCounts(directorMap, credits?.directors ?? item.directors, item, 0);
    } else {
      addPersonCounts(creatorMap, credits?.creators ?? item.creators, item, episodesWatched);
    }

    for (const genre of item.genres ?? []) incrementBucket(genreMap, genre);
    incrementBucket(platformMap, item.streaming_platform);
    if (item.year && item.year > 1880) {
      const decade = `${Math.floor(item.year / 10) * 10}s`;
      incrementBucket(decadeMap, decade);
    }
  }

  return {
    watchedMoviesCount,
    watchedShowsCount,
    watchedEpisodesCount,
    totalWatchedMinutes,
    topCast: rankPeople(castMap, 10),
    topDirectors: rankPeople(directorMap, 10),
    topCreators: rankPeople(creatorMap, 10),
    topGenres: rankBuckets(genreMap, 6),
    topPlatforms: rankBuckets(platformMap, 6),
    topDecades: rankBuckets(decadeMap, 5),
  };
}
