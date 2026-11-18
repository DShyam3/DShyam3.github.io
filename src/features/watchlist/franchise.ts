/**
 * Viewing orders: films and shows in a chosen order, with what has been
 * watched. Pure; the caller supplies the library lookup.
 */

import type { WatchlistItem } from './WatchlistContext';
import type { WikidataTvSpinoffLink } from './tmdb-types';
import { daysUntil, isSpecialsSeason } from './watchlist-utils';

export interface OrderEntryInput {
  key: string;
  mediaType: 'movie' | 'tv';
  tmdbId: number;
  title: string;
  releaseDate: string | null;
  poster: string | null;
  note?: string | null;
}

export interface LibraryLookup {
  /** Keyed by TMDB id. */
  movies: Map<number, { id: string; watched: boolean }>;
  /** Keyed by TMDB id; specials excluded by `libraryLookup`. */
  shows: Map<number, { id: string; airedEpisodes: number; watchedEpisodes: number }>;
}

/**
 * The lookup the order views read, from the library. A show's aired count
 * skips specials (`isSpecialsSeason`) and counts an episode as aired when it
 * has a release date that is not after `today` -- `daysUntil(...) <= 0`,
 * mirroring `timeToFinish` in time-to-finish.ts (which does not export it).
 */
export function libraryLookup(watchlist: WatchlistItem[], today: Date): LibraryLookup {
  const movies: LibraryLookup['movies'] = new Map();
  const shows: LibraryLookup['shows'] = new Map();
  for (const item of watchlist) {
    if (item.tmdb_id == null) continue;
    if (item.category === 'Movies') {
      movies.set(item.tmdb_id, { id: item.id, watched: !!item.watched });
    } else if (item.category === 'TV Shows') {
      let airedEpisodes = 0;
      let watchedEpisodes = 0;
      for (const season of item.seasons ?? []) {
        if (isSpecialsSeason(season.season_number)) continue;
        for (const ep of season.episodes) {
          const age = daysUntil(ep.release_date, today);
          if (age === null || age > 0) continue;
          airedEpisodes++;
          if (ep.watched) watchedEpisodes++;
        }
      }
      shows.set(item.tmdb_id, { id: item.id, airedEpisodes, watchedEpisodes });
    }
  }
  return { movies, shows };
}

export type EntryState = 'watched' | 'in-progress' | 'unwatched' | 'not-in-library';

export interface OrderEntryView extends OrderEntryInput {
  state: EntryState;
  libraryId: string | null;
  progress: { watched: number; aired: number } | null;
}

export interface OrderView {
  entries: OrderEntryView[];
  total: number;
  watched: number;
  inLibrary: number;
  nextUp: OrderEntryView | null;
}

export function entryState(
  entry: OrderEntryInput,
  library: LibraryLookup,
): { state: EntryState; libraryId: string | null; progress: { watched: number; aired: number } | null } {
  if (entry.mediaType === 'movie') {
    const movie = library.movies.get(entry.tmdbId);
    if (!movie) return { state: 'not-in-library', libraryId: null, progress: null };
    return { state: movie.watched ? 'watched' : 'unwatched', libraryId: movie.id, progress: null };
  }
  const show = library.shows.get(entry.tmdbId);
  if (!show) return { state: 'not-in-library', libraryId: null, progress: null };
  const progress = { watched: show.watchedEpisodes, aired: show.airedEpisodes };
  const state: EntryState =
    show.airedEpisodes > 0 && show.watchedEpisodes >= show.airedEpisodes
      ? 'watched'
      : show.watchedEpisodes > 0
        ? 'in-progress'
        : 'unwatched';
  return { state, libraryId: show.id, progress };
}

/** Keeps input order; nextUp is the first entry not yet watched. */
export function buildOrderView(entries: OrderEntryInput[], library: LibraryLookup): OrderView {
  const views = entries.map((e): OrderEntryView => ({ ...e, ...entryState(e, library) }));
  return {
    entries: views,
    total: views.length,
    watched: views.filter((v) => v.state === 'watched').length,
    inLibrary: views.filter((v) => v.state !== 'not-in-library').length,
    nextUp: views.find((v) => v.state !== 'watched') ?? null,
  };
}

/** New array; ascending date, undated last, then title. */
export function sortByRelease<T extends { releaseDate: string | null; title: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    if (a.releaseDate !== b.releaseDate) {
      if (!a.releaseDate) return 1;
      if (!b.releaseDate) return -1;
      return a.releaseDate < b.releaseDate ? -1 : 1;
    }
    return a.title.localeCompare(b.title);
  });
}

export interface CollectionFilm {
  id: string;
  tmdbId: number;
  title: string;
  watched: boolean;
  releaseDate: string | null;
  poster: string | null;
}

export interface CollectionSummary {
  collectionId: number;
  name: string;
  films: CollectionFilm[];
  watched: number;
}

/** Groups films by TMDB collection. Names are TMDB's, kept as-is. */
export function collectionsFromLibrary(
  movies: {
    id: string;
    tmdbId: number | null;
    title: string;
    watched: boolean;
    releaseDate: string | null;
    poster: string | null;
    collectionId: number | null;
    collectionName: string | null;
  }[],
): CollectionSummary[] {
  const groups = new Map<number, { name: string | null; films: CollectionFilm[] }>();
  for (const m of movies) {
    if (m.collectionId == null || m.tmdbId == null) continue;
    const group = groups.get(m.collectionId) ?? { name: null, films: [] };
    if (!group.name && m.collectionName) group.name = m.collectionName;
    group.films.push({
      id: m.id,
      tmdbId: m.tmdbId,
      title: m.title,
      watched: m.watched,
      releaseDate: m.releaseDate,
      poster: m.poster,
    });
    groups.set(m.collectionId, group);
  }
  return [...groups.entries()]
    .map(([collectionId, g]) => {
      const films = sortByRelease(g.films);
      return {
        collectionId,
        name: g.name || `Collection ${collectionId}`,
        films,
        watched: films.filter((f) => f.watched).length,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function collectionPartsToEntries(
  parts: { id?: number; title?: string; release_date?: string | null; poster_path?: string | null }[],
  posterBase: string,
): OrderEntryInput[] {
  const seen = new Set<number>();
  const entries: OrderEntryInput[] = [];
  for (const p of parts) {
    const id = p.id;
    if (typeof id !== 'number' || !Number.isInteger(id) || id <= 0) continue;
    const title = p.title?.trim();
    if (!title || seen.has(id)) continue;
    seen.add(id);
    entries.push({
      key: `movie:${id}`,
      mediaType: 'movie',
      tmdbId: id,
      title,
      releaseDate: p.release_date || null,
      poster: p.poster_path ? posterBase + p.poster_path : null,
    });
  }
  return sortByRelease(entries);
}

export interface TvFranchiseSummary {
  /** Stable identifier: the earliest entry's key, e.g. `tv:1418`. */
  key: string;
  name: string;
  entries: OrderEntryInput[];
}

const stripTrailingYear = (title: string): string =>
  title.replace(/\s*\((?:19|20)\d{2}\)\s*$/, '').trim();

/**
 * Groups TV spin-off links from Wikidata into connected TV franchise universes
 * (e.g. The Big Bang Theory -> Young Sheldon -> Georgie & Mandy's First Marriage).
 * Pure: merges library metadata (posters, release dates, clean titles) with the
 * connected Wikidata nodes and sorts each group chronologically by release date.
 */
export function tvFranchisesFromLinks(
  links: WikidataTvSpinoffLink[],
  watchlist: WatchlistItem[],
): TvFranchiseSummary[] {
  if (links.length === 0) return [];

  const libraryByKey = new Map<string, { title: string; releaseDate: string | null; poster: string | null }>();
  for (const item of watchlist) {
    if (item.tmdb_id == null) continue;
    const mediaType = item.category === 'Movies' ? 'movie' : 'tv';
    libraryByKey.set(`${mediaType}:${item.tmdb_id}`, {
      title: stripTrailingYear(item.title),
      releaseDate: item.release_date?.slice(0, 10) || null,
      poster: item.image_url ?? null,
    });
  }

  const nodes = new Map<string, OrderEntryInput>();
  const adjacency = new Map<string, Set<string>>();
  const franchiseNames = new Map<string, string>();

  const ensureNode = (mediaType: 'movie' | 'tv', tmdbId: number, fallbackTitle: string, fallbackDate: string | null): string => {
    const key = `${mediaType}:${tmdbId}`;
    const lib = libraryByKey.get(key);
    const existing = nodes.get(key);
    nodes.set(key, {
      key,
      mediaType,
      tmdbId,
      title: lib?.title || existing?.title || stripTrailingYear(fallbackTitle),
      releaseDate: lib?.releaseDate || existing?.releaseDate || fallbackDate || null,
      poster: lib?.poster || existing?.poster || null,
    });
    if (!adjacency.has(key)) adjacency.set(key, new Set());
    return key;
  };

  for (const link of links) {
    if (!Number.isInteger(link.seedTmdbId) || link.seedTmdbId <= 0) continue;
    if (!Number.isInteger(link.relatedTmdbId) || link.relatedTmdbId <= 0) continue;
    const seedKey = ensureNode('tv', link.seedTmdbId, link.seedTitle, null);
    const relatedKey = ensureNode(link.relatedMediaType, link.relatedTmdbId, link.relatedTitle, link.releaseDate);
    if (seedKey === relatedKey) continue;
    // Skip same-title international remakes (e.g. Shameless UK/US) unless Wikidata names a shared franchise.
    const seedTitle = nodes.get(seedKey)!.title.toLowerCase();
    const relatedTitle = nodes.get(relatedKey)!.title.toLowerCase();
    if (seedTitle === relatedTitle && !link.franchiseName) continue;

    adjacency.get(seedKey)!.add(relatedKey);
    adjacency.get(relatedKey)!.add(seedKey);
    if (link.franchiseName) {
      franchiseNames.set(seedKey, link.franchiseName);
      franchiseNames.set(relatedKey, link.franchiseName);
    }
  }

  const visited = new Set<string>();
  const groups: TvFranchiseSummary[] = [];

  for (const startKey of nodes.keys()) {
    if (visited.has(startKey)) continue;
    const queue = [startKey];
    visited.add(startKey);
    const component: string[] = [];
    while (queue.length > 0) {
      const current = queue.shift()!;
      component.push(current);
      for (const neighbour of adjacency.get(current) ?? []) {
        if (!visited.has(neighbour)) {
          visited.add(neighbour);
          queue.push(neighbour);
        }
      }
    }
    if (component.length < 2) continue;
    const entries = sortByRelease(component.map((k) => nodes.get(k)!));
    const explicitName = component.map((k) => franchiseNames.get(k)).find((n): n is string => Boolean(n));
    const baseName = explicitName || entries[0].title;
    const name = /universe|franchise|collection|chronicles/i.test(baseName)
      ? baseName
      : `${baseName} Universe`;
    groups.push({
      key: entries[0].key,
      name,
      entries,
    });
  }

  return groups.sort((a, b) => a.name.localeCompare(b.name));
}
