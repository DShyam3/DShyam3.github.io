/**
 * Viewing orders: films and shows in a chosen order, with what has been
 * watched. Pure; the caller supplies the library lookup.
 */

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
  /** Keyed by TMDB id; specials excluded by the caller. */
  shows: Map<number, { id: string; airedEpisodes: number; watchedEpisodes: number }>;
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
