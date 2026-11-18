export const TRAKT_MAX_BYTES = 25 * 1024 * 1024; // per file
export const TRAKT_MAX_ITEMS = 100000; // total
export interface TraktTitleRef { tmdbId: number | null; title: string; year: number | null }
export interface TraktEpisodeWatch { show: TraktTitleRef; season: number; episode: number; watchedAt: string | null }
export interface TraktMovieWatch extends TraktTitleRef { watchedAt: string | null }
export interface TraktRating { kind: 'movie' | 'show' | 'season'; title: TraktTitleRef; season?: number; rating: number }
export interface TraktParseResult {
  episodes: TraktEpisodeWatch[]; // merged: one per show identity + season + episode
  movies: TraktMovieWatch[]; // merged: one per identity
  ratings: TraktRating[]; // one per kind + identity (+ season); the latest rated_at wins
  skipped: number;
  skippedReasons: Record<string, number>;
  files: { name: string; items: number }[];
}

type Obj = Record<string, unknown>;
const isObj = (value: unknown): value is Obj => !!value && typeof value === 'object' && !Array.isArray(value);
const isCount = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0;
const MIN_TIME = Date.parse('1900-01-01T00:00:00Z');

function titleRef(value: unknown): TraktTitleRef | null {
  if (!isObj(value) || typeof value.title !== 'string' || !value.title.trim()) return null;
  const ids = isObj(value.ids) ? value.ids : {};
  const tmdb = ids.tmdb;
  return {
    tmdbId: typeof tmdb === 'number' && Number.isInteger(tmdb) && tmdb > 0 ? tmdb : null,
    title: value.title.trim(),
    year: isCount(value.year) && value.year > 0 ? value.year : null,
  };
}
const identity = (ref: TraktTitleRef) => ref.tmdbId !== null ? `tmdb:${ref.tmdbId}` : `t:${ref.title.toLowerCase()}|${ref.year ?? ''}`;

export function parseTraktFiles(files: { name: string; text: string }[], options: { now?: Date } = {}): TraktParseResult {
  if (files.length === 0) throw new Error('Choose at least one Trakt JSON file.');
  const nowMs = (options.now ?? new Date()).getTime();
  const timestamp = (value: unknown): string | null => {
    if (typeof value !== 'string') return null;
    const ms = Date.parse(value);
    // Exactly the Unix epoch is how Trakt exports an unknown date.
    return Number.isFinite(ms) && ms !== 0 && ms > MIN_TIME && ms <= nowMs + 86_400_000 ? new Date(ms).toISOString() : null;
  };
  const earliest = (a: string | null, b: string | null) => (a && b ? (a <= b ? a : b) : a ?? b);

  const result: TraktParseResult = { episodes: [], movies: [], ratings: [], skipped: 0, skippedReasons: {}, files: [] };
  const episodes = new Map<string, TraktEpisodeWatch>();
  const movies = new Map<string, TraktMovieWatch>();
  const ratings = new Map<string, { value: TraktRating; ratedAt: string | null }>();
  let total = 0;

  const skip = (reason: string) => { result.skipped += 1; result.skippedReasons[reason] = (result.skippedReasons[reason] ?? 0) + 1; };
  const addEpisode = (show: TraktTitleRef, season: unknown, episode: unknown, watchedAt: string | null) => {
    if (!isCount(season) || !isCount(episode)) { skip('invalid episode numbers'); return; }
    const key = `${identity(show)}|${season}|${episode}`;
    const existing = episodes.get(key);
    if (existing) existing.watchedAt = earliest(existing.watchedAt, watchedAt);
    else episodes.set(key, { show, season, episode, watchedAt });
  };
  const addMovie = (ref: TraktTitleRef, watchedAt: string | null) => {
    const key = identity(ref);
    const existing = movies.get(key);
    if (existing) existing.watchedAt = earliest(existing.watchedAt, watchedAt);
    else movies.set(key, { ...ref, watchedAt });
  };
  const addRating = (item: Obj) => {
    const kind = item.type;
    if (kind === 'episode') { skip('episode rating'); return; }
    if (kind !== 'movie' && kind !== 'show' && kind !== 'season') { skip('unknown rating type'); return; }
    const rating = item.rating;
    if (typeof rating !== 'number' || !Number.isInteger(rating) || rating < 1 || rating > 10) { skip('invalid rating'); return; }
    const ref = titleRef(kind === 'movie' ? item.movie : item.show);
    if (!ref) { skip('rating without title'); return; }
    let season: number | undefined;
    if (kind === 'season') {
      const number = isObj(item.season) ? item.season.number : undefined;
      if (!isCount(number)) { skip('invalid season number'); return; }
      season = number;
    }
    const ratedAt = timestamp(item.rated_at);
    const key = `${kind}|${identity(ref)}|${season ?? ''}`;
    const existing = ratings.get(key);
    if (existing && !(ratedAt && (!existing.ratedAt || ratedAt >= existing.ratedAt))) return;
    ratings.set(key, { value: { kind, title: ref, ...(season !== undefined ? { season } : {}), rating }, ratedAt });
  };

  const handle = (item: unknown) => {
    if (!isObj(item)) { skip('not an object'); return; }
    if (typeof item.rating === 'number' && typeof item.type === 'string') { addRating(item); return; }
    if (isObj(item.episode) && item.show !== undefined && typeof item.watched_at === 'string') {
      const show = titleRef(item.show);
      if (!show) { skip('missing title'); return; }
      addEpisode(show, item.episode.season, item.episode.number, timestamp(item.watched_at));
    } else if (Array.isArray(item.seasons) && item.show !== undefined) {
      const show = titleRef(item.show);
      if (!show) { skip('missing title'); return; }
      for (const season of item.seasons) {
        if (!isObj(season) || !Array.isArray(season.episodes)) { skip('invalid season'); continue; }
        for (const episode of season.episodes) {
          if (!isObj(episode)) { skip('invalid episode numbers'); continue; }
          addEpisode(show, season.number, episode.number, timestamp(episode.last_watched_at));
        }
      }
    } else if (item.movie !== undefined && !('episode' in item)) {
      const movie = titleRef(item.movie);
      if (!movie) { skip('missing title'); return; }
      addMovie(movie, timestamp(item.watched_at ?? item.last_watched_at));
    } else skip('unrecognised item');
  };

  for (const file of files) {
    if (new TextEncoder().encode(file.text).length > TRAKT_MAX_BYTES) throw new Error(`${file.name} is larger than ${TRAKT_MAX_BYTES / (1024 * 1024)} MB.`);
    let parsed: unknown;
    try { parsed = JSON.parse(file.text.replace(/^\uFEFF/, '')); } catch { throw new Error(`${file.name} is not valid JSON.`); }
    const items: unknown[] = Array.isArray(parsed) ? parsed : isObj(parsed) ? Object.values(parsed).filter(Array.isArray).flat() : [];
    total += items.length;
    if (total > TRAKT_MAX_ITEMS) throw new Error(`Import at most ${TRAKT_MAX_ITEMS.toLocaleString('en-GB')} items at a time.`);
    result.files.push({ name: file.name, items: items.length });
    items.forEach(handle);
  }
  result.episodes = [...episodes.values()];
  result.movies = [...movies.values()];
  result.ratings = [...ratings.values()].map(entry => entry.value);
  return result;
}
