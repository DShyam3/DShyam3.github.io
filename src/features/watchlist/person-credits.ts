import {
  LIBRARY_SHELVES,
  MORE_SHELVES,
  libraryShelf,
  type LibraryShelf,
} from './library-state';
import type { WatchlistItem } from './WatchlistContext';

export interface TmdbPersonProfile {
  id: number;
  name: string;
  knownForDepartment?: string;
  profileUrl?: string;
}

export interface TmdbPersonCredit {
  key: string;
  tmdbId: number;
  mediaType: 'movie' | 'tv';
  title: string;
  releaseDate: string | null;
  year: number | null;
  posterUrl?: string;
  roles: string[];
  upcoming: boolean;
}

export interface TmdbPersonFilmography {
  person: TmdbPersonProfile;
  credits: TmdbPersonCredit[];
}

export interface PersonShelfGroup {
  shelf: LibraryShelf;
  items: WatchlistItem[];
}

const SHELF_ORDER: readonly LibraryShelf[] = [
  'Watching',
  'Upcoming',
  'To watch',
  'Up to date',
  'Finished',
  ...MORE_SHELVES,
];

const isoDay = (day: Date) =>
  `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;

/** Group a person's library titles into shelf buckets in display order. */
export function groupLibraryItemsByShelf(
  items: WatchlistItem[],
  isAdmin: boolean,
  today = new Date(),
): PersonShelfGroup[] {
  const buckets = new Map<LibraryShelf, WatchlistItem[]>();
  const hiddenShelves = new Set<string>(MORE_SHELVES);

  for (const item of items) {
    const shelf = libraryShelf(item, today);
    if (!isAdmin && hiddenShelves.has(shelf)) continue;
    const list = buckets.get(shelf) ?? [];
    list.push(item);
    buckets.set(shelf, list);
  }

  return SHELF_ORDER
    .filter((shelf) => (isAdmin || (LIBRARY_SHELVES as readonly string[]).includes(shelf)) && buckets.has(shelf))
    .map((shelf) => ({
      shelf,
      items: (buckets.get(shelf) ?? []).slice().sort((a, b) => a.title.localeCompare(b.title)),
    }));
}

export interface RawTmdbCreditEntry {
  id?: number;
  media_type?: string;
  title?: string;
  name?: string;
  release_date?: string | null;
  first_air_date?: string | null;
  poster_path?: string | null;
  character?: string | null;
  job?: string | null;
  department?: string | null;
}

/**
 * Deduplicate TMDB combined_credits cast + crew into unique titles, merging
 * multiple roles on the same film/series (e.g. Director + Writer).
 */
export function normalizeCombinedCredits(
  cast: RawTmdbCreditEntry[],
  crew: RawTmdbCreditEntry[],
  today = new Date(),
): TmdbPersonCredit[] {
  const date = isoDay(today);
  const byKey = new Map<string, TmdbPersonCredit>();

  const ingest = (entry: RawTmdbCreditEntry, roleText: string | null) => {
    if (
      typeof entry.id !== 'number' ||
      !Number.isInteger(entry.id) ||
      entry.id <= 0 ||
      (entry.media_type !== 'movie' && entry.media_type !== 'tv')
    ) {
      return;
    }
    const title = (entry.title ?? entry.name ?? '').trim();
    if (!title) return;

    const rawDate = (entry.release_date ?? entry.first_air_date ?? '').slice(0, 10);
    const releaseDate = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : null;
    const year = releaseDate ? Number(releaseDate.slice(0, 4)) : null;
    const key = `${entry.media_type}:${entry.id}`;

    const existing = byKey.get(key);
    const cleanRole = roleText?.trim() || null;
    if (existing) {
      if (cleanRole && !existing.roles.includes(cleanRole)) {
        existing.roles.push(cleanRole);
      }
      return;
    }

    byKey.set(key, {
      key,
      tmdbId: entry.id,
      mediaType: entry.media_type,
      title,
      releaseDate,
      year,
      posterUrl: entry.poster_path ? `https://image.tmdb.org/t/p/w342${entry.poster_path}` : undefined,
      roles: cleanRole ? [cleanRole] : [],
      upcoming: !!releaseDate && releaseDate > date,
    });
  };

  for (const c of crew) ingest(c, c.job ?? c.department ?? null);
  for (const c of cast) ingest(c, c.character ? `as ${c.character}` : 'Cast');

  return [...byKey.values()].sort((a, b) => {
    if (a.upcoming !== b.upcoming) return a.upcoming ? -1 : 1;
    if (a.releaseDate && b.releaseDate) {
      return a.upcoming
        ? a.releaseDate.localeCompare(b.releaseDate)
        : b.releaseDate.localeCompare(a.releaseDate);
    }
    if (a.releaseDate) return -1;
    if (b.releaseDate) return 1;
    return a.title.localeCompare(b.title);
  });
}

/**
 * Cross-reference TMDB credits against the user's library. Any library item
 * matched by TMDB ID is merged into `inLibrary` (catching supporting roles
 * beyond the stored top-3 cast); the rest remain in `notInLibrary`.
 */
export function mergePersonFilmography(
  libraryMatches: WatchlistItem[],
  tmdbCredits: TmdbPersonCredit[],
  watchlist: WatchlistItem[],
): { inLibrary: WatchlistItem[]; notInLibrary: TmdbPersonCredit[] } {
  const byTitleKey = new Map<string, WatchlistItem>();
  for (const item of watchlist) {
    if (item.tmdb_id) {
      const media = item.category === 'Movies' ? 'movie' : 'tv';
      byTitleKey.set(`${media}:${item.tmdb_id}`, item);
    }
  }

  const seenLibraryIds = new Set<string>();
  const inLibrary: WatchlistItem[] = [];
  for (const item of libraryMatches) {
    const k = `${item.category}:${item.id}`;
    if (!seenLibraryIds.has(k)) {
      seenLibraryIds.add(k);
      inLibrary.push(item);
    }
  }

  const notInLibrary: TmdbPersonCredit[] = [];
  for (const credit of tmdbCredits) {
    const match = byTitleKey.get(credit.key);
    if (match) {
      const k = `${match.category}:${match.id}`;
      if (!seenLibraryIds.has(k)) {
        seenLibraryIds.add(k);
        inLibrary.push(match);
      }
    } else {
      notInLibrary.push(credit);
    }
  }

  return { inLibrary, notInLibrary };
}
