import type { WatchlistItem } from './WatchlistContext';
import { normaliseTitle, type LetterboxdFilm } from './letterboxd-import';
import type { TraktParseResult, TraktTitleRef } from './trakt-import';
import { localNoonIso } from './watched-when';

/** The RPC takes at most 5000 elements an array; stay well inside it. */
export const IMPORT_BATCH_SIZE = 1000;

export interface ImportFilm {
  key: string;
  name: string;
  year: number | null;
  tmdbId: number | null;
  /** ISO timestamp, or null for "watched, date unknown". */
  watchedAt: string | null;
  rating: number | null;
}
export interface ImportShowRef { tmdbId: number | null; title: string; year: number | null }
export interface ImportEpisode { show: ImportShowRef; season: number; episode: number; watchedAt: string | null }
export interface ImportRating { kind: 'show' | 'season'; show: ImportShowRef; season?: number; rating: number }

export interface Candidate { id: number; title: string; year: number | null; poster: string | null }

export type Resolution =
  | { status: 'library'; libraryId: string; include: boolean }
  | { status: 'new'; tmdbId: number; title: string; year: number | null; poster: string | null; include: boolean }
  | { status: 'unsure'; candidates: Candidate[]; chosen: number | null }
  | { status: 'missing' };

export interface PlannedFilm { film: ImportFilm; resolution: Resolution }
export interface PlannedShow { ref: ImportShowRef; resolution: Resolution }
export interface ImportPlan {
  films: PlannedFilm[];
  shows: PlannedShow[];
  episodes: ImportEpisode[];
  ratings: ImportRating[];
}

export interface ImportPayload {
  p_episodes: { id: number; watched_at: string | null }[];
  p_movies: { id: number; watched_at: string | null; rating: number | null }[];
  p_shows: { id: number; rating: number }[];
  p_seasons: { id: number; rating: number }[];
  notFound: { episodes: number; films: number; ratings: number };
}

// ---- Library index -------------------------------------------------------

const YEAR_SUFFIX = /\s*\((\d{4})\)\s*$/;

/** Library film titles are stored "Title (Year)"; split that back apart. */
export function splitTitleYear(title: string, year?: number | null): { base: string; year: number | null } {
  const match = YEAR_SUFFIX.exec(title);
  return { base: match ? title.replace(YEAR_SUFFIX, '') : title, year: year ?? (match ? Number(match[1]) : null) };
}

export const titleYearKey = (title: string, year: number | null) => `${normaliseTitle(title)}|${year ?? ''}`;

export interface LibraryIndex {
  filmByTmdb: Map<number, string>;
  filmByTitle: Map<string, string>;
  showByTmdb: Map<number, string>;
  showByTitle: Map<string, string>;
  episodeId: (showLibraryId: string, season: number, episode: number) => number | undefined;
  seasonId: (showLibraryId: string, season: number) => number | undefined;
}

export function buildLibraryIndex(watchlist: WatchlistItem[]): LibraryIndex {
  const filmByTmdb = new Map<number, string>();
  const filmByTitle = new Map<string, string>();
  const showByTmdb = new Map<number, string>();
  const showByTitle = new Map<string, string>();
  const episodes = new Map<string, number>();
  const seasons = new Map<string, number>();
  const setFirst = <K,>(map: Map<K, string>, key: K, id: string) => { if (!map.has(key)) map.set(key, id); };

  for (const item of watchlist) {
    const { base, year } = splitTitleYear(item.title, item.year);
    const key = titleYearKey(base, year);
    if (item.category === 'Movies') {
      if (item.tmdb_id) setFirst(filmByTmdb, item.tmdb_id, item.id);
      setFirst(filmByTitle, key, item.id);
    } else if (item.category === 'TV Shows') {
      if (item.tmdb_id) setFirst(showByTmdb, item.tmdb_id, item.id);
      setFirst(showByTitle, key, item.id);
      for (const season of item.seasons ?? []) {
        if (season.id !== undefined) seasons.set(`${item.id}|${season.season_number}`, season.id);
        for (const ep of season.episodes) {
          if (ep.id !== undefined) episodes.set(`${item.id}|${season.season_number}|${ep.episode_number}`, ep.id);
        }
      }
    }
  }
  return {
    filmByTmdb, filmByTitle, showByTmdb, showByTitle,
    episodeId: (showId, season, episode) => episodes.get(`${showId}|${season}|${episode}`),
    seasonId: (showId, season) => seasons.get(`${showId}|${season}`),
  };
}

// ---- Source normalisation --------------------------------------------------

export function filmsFromLetterboxd(films: LetterboxdFilm[]): ImportFilm[] {
  return films.map(film => ({
    key: `t:${film.key}`,
    name: film.name,
    year: film.year,
    tmdbId: null,
    watchedAt: film.firstWatched ? localNoonIso(film.firstWatched) : null,
    rating: film.rating,
  }));
}

export const showKey = (ref: ImportShowRef) => ref.tmdbId !== null ? `tmdb:${ref.tmdbId}` : `t:${titleYearKey(ref.title, ref.year)}`;
const filmKey = (ref: TraktTitleRef) => ref.tmdbId !== null ? `tmdb:${ref.tmdbId}` : `t:${titleYearKey(ref.title, ref.year)}`;

/**
 * A film rated on Trakt but absent from its history is treated as watched with
 * no date: rating something implies having seen it.
 */
export function importFromTrakt(result: TraktParseResult): {
  films: ImportFilm[];
  shows: ImportShowRef[];
  episodes: ImportEpisode[];
  ratings: ImportRating[];
} {
  const films = new Map<string, ImportFilm>();
  for (const movie of result.movies) {
    const key = filmKey(movie);
    films.set(key, { key, name: movie.title, year: movie.year, tmdbId: movie.tmdbId, watchedAt: movie.watchedAt, rating: null });
  }
  const ratings: ImportRating[] = [];
  const shows = new Map<string, ImportShowRef>();
  const addShow = (ref: TraktTitleRef) => { const show = { tmdbId: ref.tmdbId, title: ref.title, year: ref.year }; shows.set(showKey(show), show); return show; };
  for (const entry of result.ratings) {
    if (entry.kind === 'movie') {
      const key = filmKey(entry.title);
      const existing = films.get(key);
      if (existing) existing.rating = entry.rating;
      else films.set(key, { key, name: entry.title.title, year: entry.title.year, tmdbId: entry.title.tmdbId, watchedAt: null, rating: entry.rating });
    } else {
      const show = addShow(entry.title);
      ratings.push({ kind: entry.kind, show, season: entry.season, rating: entry.rating });
    }
  }
  const episodes = result.episodes.map(ep => ({ show: addShow(ep.show), season: ep.season, episode: ep.episode, watchedAt: ep.watchedAt }));
  return { films: [...films.values()], shows: [...shows.values()], episodes, ratings };
}

// ---- Matching ----------------------------------------------------------------

/** A library match, a straight 'new' (Trakt gave a TMDB id), or null: needs a TMDB search. */
export function matchFilm(film: ImportFilm, index: LibraryIndex): Resolution | null {
  const libraryId = (film.tmdbId !== null ? index.filmByTmdb.get(film.tmdbId) : undefined)
    ?? index.filmByTitle.get(titleYearKey(film.name, film.year));
  if (libraryId) return { status: 'library', libraryId, include: true };
  if (film.tmdbId !== null) return { status: 'new', tmdbId: film.tmdbId, title: film.name, year: film.year, poster: null, include: false };
  return null;
}

export function matchShow(ref: ImportShowRef, index: LibraryIndex): Resolution | null {
  const libraryId = (ref.tmdbId !== null ? index.showByTmdb.get(ref.tmdbId) : undefined)
    ?? index.showByTitle.get(titleYearKey(ref.title, ref.year));
  if (libraryId) return { status: 'library', libraryId, include: true };
  if (ref.tmdbId !== null) return { status: 'new', tmdbId: ref.tmdbId, title: ref.title, year: ref.year, poster: null, include: false };
  return null;
}

export type Classification =
  | { status: 'confident'; match: Candidate }
  | { status: 'unsure'; candidates: Candidate[] }
  | { status: 'missing' };

export function classifyCandidates(query: { title: string; year: number | null }, candidates: Candidate[]): Classification {
  if (candidates.length === 0) return { status: 'missing' };
  const wanted = normaliseTitle(query.title);
  const sameTitle = (c: Candidate) => normaliseTitle(c.title) === wanted;
  const exact = candidates.filter(c => sameTitle(c) && query.year !== null && c.year === query.year);
  if (exact.length === 1) return { status: 'confident', match: exact[0] };
  const rank = (c: Candidate) => sameTitle(c) ? 0 : query.year !== null && c.year !== null && Math.abs(c.year - query.year) <= 1 ? 1 : 2;
  const ordered = candidates.map((c, i) => ({ c, i, r: rank(c) })).sort((a, b) => a.r - b.r || a.i - b.i);
  return { status: 'unsure', candidates: ordered.slice(0, 3).map(entry => entry.c) };
}

// ---- Plan -> payload -------------------------------------------------------------

export type Settled = { kind: 'library'; libraryId: string } | { kind: 'new'; tmdbId: number; title: string; year: number | null; poster: string | null };

/** What a kept resolution amounts to, or null when the user did not keep it. */
export function settle(resolution: Resolution): Settled | null {
  if (resolution.status === 'library') return resolution.include ? { kind: 'library', libraryId: resolution.libraryId } : null;
  if (resolution.status === 'new') return resolution.include ? { kind: 'new', tmdbId: resolution.tmdbId, title: resolution.title, year: resolution.year, poster: resolution.poster } : null;
  if (resolution.status === 'unsure' && resolution.chosen !== null) {
    const pick = resolution.candidates.find(c => c.id === resolution.chosen);
    return pick ? { kind: 'new', tmdbId: pick.id, title: pick.title, year: pick.year, poster: pick.poster } : null;
  }
  return null;
}

/** The titles the import must add before it can mark anything, once each. */
export function titlesToAdd(plan: ImportPlan): { category: 'Movies' | 'TV Shows'; tmdbId: number }[] {
  const seen = new Set<string>();
  const out: { category: 'Movies' | 'TV Shows'; tmdbId: number }[] = [];
  const collect = (category: 'Movies' | 'TV Shows', resolution: Resolution) => {
    const settled = settle(resolution);
    if (settled?.kind !== 'new' || seen.has(`${category}:${settled.tmdbId}`)) return;
    seen.add(`${category}:${settled.tmdbId}`);
    out.push({ category, tmdbId: settled.tmdbId });
  };
  plan.films.forEach(p => collect('Movies', p.resolution));
  plan.shows.forEach(p => collect('TV Shows', p.resolution));
  return out;
}

export function summarisePlan(plan: ImportPlan) {
  const films = plan.films.filter(p => settle(p.resolution));
  const keptShows = new Set(plan.shows.filter(p => settle(p.resolution)).map(p => showKey(p.ref)));
  return {
    films: films.length,
    dated: films.filter(p => p.film.watchedAt).length,
    episodes: plan.episodes.filter(ep => keptShows.has(showKey(ep.show))).length,
    ratings: films.filter(p => p.film.rating !== null).length + plan.ratings.filter(r => keptShows.has(showKey(r.show))).length,
    adds: titlesToAdd(plan).length,
  };
}

export function chunk<T>(items: T[], size: number = IMPORT_BATCH_SIZE): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

const earlier = (a: string | null, b: string | null) => (a && b ? (a <= b ? a : b) : a ?? b);

export function buildImportPayload(plan: ImportPlan, freshLibrary: WatchlistItem[]): ImportPayload {
  const index = buildLibraryIndex(freshLibrary);
  const notFound = { episodes: 0, films: 0, ratings: 0 };
  const resolveId = (settled: Settled, kind: 'film' | 'show'): string | undefined => {
    if (settled.kind === 'library') return settled.libraryId;
    return (kind === 'film' ? index.filmByTmdb : index.showByTmdb).get(settled.tmdbId);
  };

  const movies = new Map<number, { id: number; watched_at: string | null; rating: number | null }>();
  for (const { film, resolution } of plan.films) {
    const settled = settle(resolution);
    if (!settled) continue;
    const id = Number(resolveId(settled, 'film'));
    if (!Number.isInteger(id)) { notFound.films += 1; continue; }
    const existing = movies.get(id);
    if (existing) {
      existing.watched_at = earlier(existing.watched_at, film.watchedAt);
      existing.rating = existing.rating ?? film.rating;
    } else movies.set(id, { id, watched_at: film.watchedAt, rating: film.rating });
  }

  const showIds = new Map<string, string>();
  for (const { ref, resolution } of plan.shows) {
    const settled = settle(resolution);
    const id = settled ? resolveId(settled, 'show') : undefined;
    if (id) showIds.set(showKey(ref), id);
  }

  const episodes = new Map<number, { id: number; watched_at: string | null }>();
  for (const ep of plan.episodes) {
    const showId = showIds.get(showKey(ep.show));
    if (!showId) continue;
    const id = index.episodeId(showId, ep.season, ep.episode);
    if (id === undefined) { notFound.episodes += 1; continue; }
    const existing = episodes.get(id);
    if (existing) existing.watched_at = earlier(existing.watched_at, ep.watchedAt);
    else episodes.set(id, { id, watched_at: ep.watchedAt });
  }

  const shows = new Map<number, { id: number; rating: number }>();
  const seasons = new Map<number, { id: number; rating: number }>();
  for (const entry of plan.ratings) {
    const showId = showIds.get(showKey(entry.show));
    if (!showId) continue;
    if (entry.kind === 'show') { shows.set(Number(showId), { id: Number(showId), rating: entry.rating }); continue; }
    const id = index.seasonId(showId, entry.season ?? -1);
    if (id === undefined) notFound.ratings += 1;
    else seasons.set(id, { id, rating: entry.rating });
  }

  return {
    p_episodes: [...episodes.values()],
    p_movies: [...movies.values()],
    p_shows: [...shows.values()],
    p_seasons: [...seasons.values()],
    notFound,
  };
}
