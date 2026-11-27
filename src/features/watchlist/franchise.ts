/**
 * Viewing orders: films and shows in a chosen order, with what has been
 * watched. Pure; the caller supplies the library lookup.
 */

import type { WatchlistItem } from './WatchlistContext';
import type { FilmUniverseMember, WikidataTvSpinoffLink } from './tmdb-types';
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
  /** Keyed by TMDB id. `lastActivityAt` is the row's `last_activity_at`. */
  movies: Map<number, { id: string; watched: boolean; stopped?: boolean; lastActivityAt?: string | null }>;
  /** Keyed by TMDB id; specials excluded by `libraryLookup`. */
  shows: Map<number, { id: string; airedEpisodes: number; watchedEpisodes: number; stopped?: boolean; lastActivityAt?: string | null }>;
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
      movies.set(item.tmdb_id, {
        id: item.id,
        watched: !!item.watched,
        ...(item.library_state === 'stopped' ? { stopped: true } : {}),
        lastActivityAt: item.last_activity_at ?? null,
      });
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
      shows.set(item.tmdb_id, {
        id: item.id,
        airedEpisodes,
        watchedEpisodes,
        ...(item.library_state === 'stopped' ? { stopped: true } : {}),
        lastActivityAt: item.last_activity_at ?? null,
      });
    }
  }
  return { movies, shows };
}

export type EntryState = 'watched' | 'in-progress' | 'unwatched' | 'not-in-library';

export interface OrderEntryView extends OrderEntryInput {
  state: EntryState;
  libraryId: string | null;
  progress: { watched: number; aired: number } | null;
  stopped?: boolean;
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
): { state: EntryState; libraryId: string | null; progress: { watched: number; aired: number } | null; stopped?: boolean } {
  if (entry.mediaType === 'movie') {
    const movie = library.movies.get(entry.tmdbId);
    if (!movie) return { state: 'not-in-library', libraryId: null, progress: null };
    return { state: movie.watched ? 'watched' : 'unwatched', libraryId: movie.id, progress: null, ...(movie.stopped ? { stopped: true } : {}) };
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
  return { state, libraryId: show.id, progress, stopped: show.stopped };
}

/** Keeps input order; nextUp is the first entry not yet watched or stopped. */
export function buildOrderView(entries: OrderEntryInput[], library: LibraryLookup): OrderView {
  const views = entries.map((e): OrderEntryView => ({ ...e, ...entryState(e, library) }));
  return {
    entries: views,
    total: views.length,
    watched: views.filter((v) => v.state === 'watched').length,
    inLibrary: views.filter((v) => v.state !== 'not-in-library').length,
    nextUp: views.find((v) => v.state !== 'watched' && !v.stopped) ?? null,
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
  lastActivityAt?: string | null;
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
    lastActivityAt?: string | null;
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
      lastActivityAt: m.lastActivityAt ?? null,
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
  inLibraryMovieIds?: { has(id: number): boolean },
): OrderEntryInput[] {
  const seen = new Set<number>();
  const entries: OrderEntryInput[] = [];
  for (const p of parts) {
    const id = p.id;
    if (typeof id !== 'number' || !Number.isInteger(id) || id <= 0) continue;
    const title = p.title?.trim();
    if (!title || seen.has(id)) continue;
    const releaseDate = p.release_date?.trim() || null;
    // Skip unconfirmed / undated TBA instalments until TMDB has a release date,
    // unless the user already saved that title in their own library.
    if (!releaseDate && !inLibraryMovieIds?.has(id)) continue;
    seen.add(id);
    entries.push({
      key: `movie:${id}`,
      mediaType: 'movie',
      tmdbId: id,
      title,
      releaseDate,
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
  posterBase = '',
): TvFranchiseSummary[] {
  if (links.length === 0) return [];

  const libraryByKey = new Map<string, { title: string; releaseDate: string | null; poster: string | null; franchise: string | null }>();
  for (const item of watchlist) {
    if (item.tmdb_id == null) continue;
    const mediaType = item.category === 'Movies' ? 'movie' : 'tv';
    libraryByKey.set(`${mediaType}:${item.tmdb_id}`, {
      title: stripTrailingYear(item.title),
      releaseDate: item.release_date?.slice(0, 10) || null,
      poster: item.image_url ?? null,
      franchise: item.franchise?.trim().toLowerCase() || null,
    });
  }

  const nodes = new Map<string, OrderEntryInput>();
  const adjacency = new Map<string, Set<string>>();
  const franchiseNames = new Map<string, string>();
  const franchiseGroups = new Map<string, Set<string>>();

  const ensureNode = (
    mediaType: 'movie' | 'tv',
    tmdbId: number,
    fallbackTitle: string,
    fallbackDate: string | null,
    fallbackPosterPath?: string | null,
  ): string => {
    const key = `${mediaType}:${tmdbId}`;
    const lib = libraryByKey.get(key);
    const existing = nodes.get(key);
    const resolvedPoster =
      lib?.poster ||
      existing?.poster ||
      (fallbackPosterPath ? `${posterBase}${fallbackPosterPath}` : null);
    nodes.set(key, {
      key,
      mediaType,
      tmdbId,
      title: lib?.title || existing?.title || stripTrailingYear(fallbackTitle),
      releaseDate: lib?.releaseDate || existing?.releaseDate || fallbackDate || null,
      poster: resolvedPoster,
    });
    if (!adjacency.has(key)) adjacency.set(key, new Set());
    return key;
  };

  for (const link of links) {
    if (!Number.isInteger(link.seedTmdbId) || link.seedTmdbId <= 0) continue;
    if (!Number.isInteger(link.relatedTmdbId) || link.relatedTmdbId <= 0) continue;
    const relatedCandidateKey = `${link.relatedMediaType}:${link.relatedTmdbId}`;
    // Skip unconfirmed / undated spin-offs not already in the user's library.
    if (!libraryByKey.has(relatedCandidateKey) && !link.releaseDate?.trim()) continue;
    const seedKey = ensureNode('tv', link.seedTmdbId, link.seedTitle, null);
    const relatedKey = ensureNode(link.relatedMediaType, link.relatedTmdbId, link.relatedTitle, link.releaseDate, link.posterPath);
    if (seedKey === relatedKey) continue;
    // Skip same-title international remakes (e.g. Shameless UK/US) unless Wikidata names a shared franchise.
    const seedTitle = nodes.get(seedKey)!.title.toLowerCase();
    const relatedTitle = nodes.get(relatedKey)!.title.toLowerCase();
    if (seedTitle === relatedTitle && !link.franchiseName) continue;

    adjacency.get(seedKey)!.add(relatedKey);
    adjacency.get(relatedKey)!.add(seedKey);
    const trimmedFranchiseName = link.franchiseName?.trim() || null;
    if (trimmedFranchiseName) {
      franchiseNames.set(seedKey, trimmedFranchiseName);
      franchiseNames.set(relatedKey, trimmedFranchiseName);
    }
    const groupKey = link.franchiseId?.trim() || trimmedFranchiseName?.toLowerCase() || null;
    if (groupKey) {
      const members = franchiseGroups.get(groupKey) ?? new Set<string>();
      members.add(seedKey);
      members.add(relatedKey);
      franchiseGroups.set(groupKey, members);
    }
  }

  // Merge separate spin-off chains that belong to the same Wikidata franchise
  // (e.g. WandaVision/Agatha and Daredevil/Born Again under Marvel Cinematic Universe).
  for (const members of franchiseGroups.values()) {
    const keys = [...members];
    for (let i = 1; i < keys.length; i += 1) {
      adjacency.get(keys[0])!.add(keys[i]);
      adjacency.get(keys[i])!.add(keys[0]);
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
    const rawEntries = sortByRelease(component.map((k) => nodes.get(k)!));
    const explicitName = component.map((k) => franchiseNames.get(k)).find((n): n is string => Boolean(n));
    const baseName = explicitName || rawEntries[0].title;
    const name = /universe|franchise|collection|chronicles/i.test(baseName)
      ? baseName
      : `${baseName} Universe`;
    const normalizedName = name.trim().toLowerCase();
    // Respect explicit custom `franchise` overrides: if the owner assigned a
    // show to a different franchise (e.g. moving Daredevil to "The Defenders
    // Saga"), do not also list it in Wikidata's group.
    const entries = rawEntries.filter((entry) => {
      const override = libraryByKey.get(entry.key)?.franchise;
      return !override || override === normalizedName;
    });
    if (entries.length < 2) continue;
    groups.push({
      key: entries[0].key,
      name,
      entries,
    });
  }

  // Merge any TV show in the library whose custom `franchise` tag matches an
  // existing TV franchise card by name (e.g. tagging She-Hulk or Moon Knight
  // as "Marvel Cinematic Universe" adds it directly into the MCU TV card).
  const groupByName = new Map(groups.map((g) => [g.name.trim().toLowerCase(), g]));
  for (const item of watchlist) {
    if (item.category !== 'TV Shows' || item.tmdb_id == null) continue;
    const tag = item.franchise?.trim().toLowerCase();
    if (!tag) continue;
    const target = groupByName.get(tag);
    if (!target) continue;
    const key = `tv:${item.tmdb_id}`;
    if (target.entries.some((e) => e.key === key)) continue;
    target.entries = sortByRelease([
      ...target.entries,
      {
        key,
        mediaType: 'tv',
        tmdbId: item.tmdb_id,
        title: stripTrailingYear(item.title),
        releaseDate: item.release_date?.slice(0, 10) || null,
        poster: item.image_url ?? null,
      },
    ]);
  }

  return groups.sort((a, b) => a.name.localeCompare(b.name));
}

export interface FilmUniverseSummary {
  /** Wikidata id of the universe, e.g. `Q642878`. */
  id: string;
  name: string;
  entries: OrderEntryInput[];
  /**
   * Every film the lookup named, `movie:<id>`, including those `entries`
   * leaves out, so a collection holding one still folds into the universe.
   */
  memberKeys: string[];
  /** When the owner last touched one of its library films; see `lastTouched`. */
  touched: LastTouched;
}

/** A library film, by TMDB id, as `filmUniversesFromMembers` reads it. */
export interface UniverseLibraryFilm {
  id: string;
  title: string;
  releaseDate: string | null;
  poster: string | null;
  lastActivityAt?: string | null;
  franchise?: string | null;
}

/**
 * Shared film universes the library has started, each as one list of its
 * films in release order: one Marvel Cinematic Universe rather than an
 * Avengers and an Iron Man collection. A universe counts as started once one
 * of its films is in `library`. The lookup's title, date and poster lead, as
 * a collection's TMDB parts do; the library's fill what it lacks. A film with
 * no title is left out, and so is one with no release date that is not in
 * the library: an unannounced project. Sorted by name.
 */
export function filmUniversesFromMembers(
  members: FilmUniverseMember[],
  library: Map<number, UniverseLibraryFilm>,
  posterBase = '',
): FilmUniverseSummary[] {
  const universes = new Map<string, { name: string; entries: Map<number, OrderEntryInput>; memberKeys: Set<string>; owned: UniverseLibraryFilm[] }>();
  for (const member of members) {
    if (!member.universeId || !Number.isInteger(member.tmdbId) || member.tmdbId <= 0) continue;
    const universe = universes.get(member.universeId) ?? {
      name: member.universeName?.trim() || member.universeId,
      entries: new Map<number, OrderEntryInput>(),
      memberKeys: new Set<string>(),
      owned: [],
    };
    universes.set(member.universeId, universe);
    universe.memberKeys.add(`movie:${member.tmdbId}`);
    if (universe.entries.has(member.tmdbId)) continue;
    const owned = library.get(member.tmdbId);
    const title = member.title?.trim() || (owned ? stripTrailingYear(owned.title) : '');
    const releaseDate = member.releaseDate || owned?.releaseDate?.slice(0, 10) || null;
    if (!title || (!owned && !releaseDate)) continue;
    if (owned) universe.owned.push(owned);
    universe.entries.set(member.tmdbId, {
      key: `movie:${member.tmdbId}`,
      mediaType: 'movie',
      tmdbId: member.tmdbId,
      title,
      releaseDate,
      poster: member.posterPath ? posterBase + member.posterPath : owned?.poster ?? null,
    });
  }
  // Merge any library movie whose custom `franchise` tag matches a universe's name.
  const universeByName = new Map([...universes.values()].map((u) => [u.name.trim().toLowerCase(), u]));
  for (const [tmdbId, film] of library) {
    const tag = film.franchise?.trim().toLowerCase();
    if (!tag) continue;
    const universe = universeByName.get(tag);
    if (!universe || universe.entries.has(tmdbId)) continue;
    universe.memberKeys.add(`movie:${tmdbId}`);
    universe.owned.push(film);
    universe.entries.set(tmdbId, {
      key: `movie:${tmdbId}`,
      mediaType: 'movie',
      tmdbId,
      title: stripTrailingYear(film.title),
      releaseDate: film.releaseDate?.slice(0, 10) || null,
      poster: film.poster,
    });
  }
  return [...universes.entries()]
    .filter(([, u]) => u.owned.length > 0 && u.entries.size >= 2)
    .map(([id, u]) => ({
      id,
      name: u.name,
      entries: sortByRelease([...u.entries.values()]),
      memberKeys: [...u.memberKeys],
      touched: lastTouched(u.owned),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Collections a started universe already lists in full, such as Iron Man
 * inside the MCU, so the same films are not offered on two cards. A
 * collection with a film the universe lacks keeps its own card: Deadpool's
 * first two films are not MCU, so the Deadpool collection stays.
 */
export function collectionsInsideUniverses(
  collections: { collectionId: number; entries: Pick<OrderEntryInput, 'key'>[] }[],
  universes: Pick<FilmUniverseSummary, 'memberKeys'>[],
): Set<number> {
  const covered = new Set(universes.flatMap((u) => u.memberKeys));
  return new Set(
    collections
      .filter((c) => c.entries.length > 0 && c.entries.every((e) => covered.has(e.key)))
      .map((c) => c.collectionId),
  );
}

export interface CustomFranchiseGroup {
  name: string;
  view: OrderView;
}

/**
 * Group movies and TV shows tagged with custom franchise names in Supabase
 * into release-ordered franchise cards (zero TMDB or Wikidata calls).
 */
export function customFranchisesFromLibrary(
  items: WatchlistItem[],
  lookup: LibraryLookup,
): CustomFranchiseGroup[] {
  const byName = new Map<string, WatchlistItem[]>();
  for (const item of items) {
    if (item.library_state === 'hidden') continue;
    const names = new Set([item.franchise, ...(item.additional_franchises ?? [])]
      .map((name) => name?.trim()).filter((name): name is string => Boolean(name)));
    for (const name of names) {
      const list = byName.get(name) ?? [];
      list.push(item);
      byName.set(name, list);
    }
  }

  return [...byName.entries()]
    .filter(([, members]) => members.length >= 2)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, members]) => {
      const sorted = members.slice().sort(
        (a, b) =>
          (a.release_date ?? '9999-99-99').localeCompare(b.release_date ?? '9999-99-99') ||
          a.title.localeCompare(b.title),
      );
      const entries: OrderEntryInput[] = sorted.map((item, position) => {
        const mediaType = item.category === 'Movies' ? 'movie' : 'tv';
        return {
          key: item.tmdb_id ? `${mediaType}:${item.tmdb_id}` : `lib:${item.category}:${item.id}`,
          tmdbId: item.tmdb_id ?? Number(item.id),
          mediaType,
          title: stripTrailingYear(item.title),
          releaseDate: item.release_date ?? null,
          poster: item.image_url ?? null,
          position,
        };
      });
      return { name, view: buildOrderView(entries, lookup) };
    });
}

/**
 * When a franchise was last touched. `at` is the latest `last_activity_at`
 * among its library titles -- an add, a watch or a re-file, stamped by a
 * database trigger and never by the sync -- as epoch ms, or -1 when none
 * carries one. `id` is the newest row id, or -1 with none: the fallback for
 * titles untouched since that column was added, whose only add-order signal
 * is that rows are numbered as they are added. `created_at` on a library
 * item is its release date and never counts. Ids only compare within one
 * table; times compare across both.
 */
export interface LastTouched {
  at: number;
  id: number;
}

export function lastTouched(items: { id: string; lastActivityAt?: string | null }[]): LastTouched {
  let at = -1;
  let id = -1;
  for (const item of items) {
    const stamp = item.lastActivityAt ? Date.parse(item.lastActivityAt) : Number.NaN;
    if (Number.isFinite(stamp) && stamp > at) at = stamp;
    const rowId = Number(item.id);
    if (Number.isInteger(rowId) && rowId > id) id = rowId;
  }
  return { at, id };
}

/**
 * Most recently touched first: any time beats none, a later time beats an
 * earlier one, and with no time on either the newer row id leads. Only
 * meaningful between groups from one table; see `orderByLastTouched`.
 */
export function compareLastTouched(a: LastTouched, b: LastTouched): number {
  return b.at - a.at || b.id - a.id;
}

/**
 * The order "Have you already watched?" shows franchises in, in full. Those
 * touched since `last_activity_at` was added come first, latest first, films
 * and series together. Every such time is later than any untouched title's
 * add, so this tier always leads. The rest follow by newest row id, films and
 * series taking turns (film first), because ids from different tables do not
 * compare. Release dates never count. Name breaks a tie.
 */
export function orderByLastTouched<T extends { media: 'movie' | 'tv'; name: string; touched: LastTouched }>(groups: T[]): T[] {
  const byName = (a: T, b: T) => a.name.localeCompare(b.name);
  const recent = groups
    .filter((g) => g.touched.at >= 0)
    .sort((a, b) => b.touched.at - a.touched.at || byName(a, b));
  const byId = (a: T, b: T) => b.touched.id - a.touched.id || byName(a, b);
  const films = groups.filter((g) => g.touched.at < 0 && g.media === 'movie').sort(byId);
  const series = groups.filter((g) => g.touched.at < 0 && g.media === 'tv').sort(byId);
  const ordered: T[] = [...recent];
  for (let index = 0; index < Math.max(films.length, series.length); index++) {
    if (films[index]) ordered.push(films[index]);
    if (series[index]) ordered.push(series[index]);
  }
  return ordered;
}

/**
 * True when an earlier entry in release order is unwatched or missing from
 * the library while a later entry is already watched or in progress (e.g.
 * watched X 1 and X 3, missing X 2).
 */
export function hasWatchGap(view: OrderView): boolean {
  let lastWatchedIndex = -1;
  for (let i = view.entries.length - 1; i >= 0; i--) {
    const state = view.entries[i].state;
    if (state === 'watched' || state === 'in-progress') {
      lastWatchedIndex = i;
      break;
    }
  }
  if (lastWatchedIndex <= 0) return false;
  for (let i = 0; i < lastWatchedIndex; i++) {
    if (view.entries[i].state !== 'watched') return true;
  }
  return false;
}

/**
 * Released films in the library not yet marked watched: ones you may have
 * seen and not logged, so a Discover card asks about them as it does about
 * the titles missing from the library. A film stopped, or answered Not seen
 * (`answered`, by entry key), has been answered. Only in a franchise
 * `franchiseStarted`: one only saved is still to watch.
 */
export function unseenFilmCount(view: OrderView, todayIso: string, answered?: ReadonlySet<string>): number {
  if (!franchiseStarted(view)) return 0;
  return view.entries.filter((entry) =>
    entry.mediaType === 'movie' && entry.state === 'unwatched' && !entry.stopped && !answered?.has(entry.key)
    && !!entry.releaseDate && entry.releaseDate.slice(0, 10) <= todayIso,
  ).length;
}

/** A title in it watched, or in progress and not stopped. */
export function franchiseStarted(view: OrderView): boolean {
  return view.entries.some((entry) => entry.state === 'watched' || (entry.state === 'in-progress' && !entry.stopped));
}
