const ANIMATION_GENRE_ID = 16;

const languageNames = (() => {
  try {
    return new Intl.DisplayNames(['en'], { type: 'language' });
  } catch {
    return null;
  }
})();

/**
 * Converts a TMDB ISO 639-1 language code into a human-readable English name
 * via `Intl.DisplayNames`, falling back to the uppercase code or `'Other'`.
 */
export function languageDisplayName(code: string | null | undefined): string {
  const normalized = code?.trim().toLowerCase() ?? '';
  if (!normalized) return 'Other';
  try {
    const resolved = languageNames?.of(normalized);
    if (resolved && resolved.toLowerCase() !== normalized) {
      return resolved;
    }
  } catch {
    // Fall through to uppercase code for invalid/non-standard tags.
  }
  return normalized.toUpperCase();
}

export interface LanguageGroupMeta {
  original_language?: string | null;
  genre_ids?: number[] | null;
  genres?: string[] | null;
  mediaType: 'movie' | 'tv';
}

export interface LanguageGroup<T> {
  key: string;
  label: string;
  items: T[];
  movies: T[];
  tvShows: T[];
  cartoons: T[];
  defaultCollapsed: boolean;
}

export interface GroupByLanguageOptions {
  /** Languages with fewer than this many items roll into `Other`. Defaults to 2. */
  minGroupSize?: number;
  /** Sections with fewer than this many items start collapsed. Defaults to 4. */
  collapseThreshold?: number;
  /** Heading for items with no known language or below minGroupSize. */
  otherLabel?: string;
}

function isAnimated(meta: LanguageGroupMeta): boolean {
  if (meta.genre_ids?.includes(ANIMATION_GENRE_ID)) return true;
  return meta.genres?.some((g) => g.trim().toLowerCase() === 'animation') ?? false;
}

/**
 * Groups items dynamically by TMDB `original_language`, folding singleton /
 * unknown languages into `Other`, and splitting each group into live-action
 * Movies, live-action TV Shows, and Cartoons (Animation).
 */
export function groupByLanguage<T>(
  items: T[],
  getMeta: (item: T) => LanguageGroupMeta,
  options: GroupByLanguageOptions = {},
): LanguageGroup<T>[] {
  const minGroupSize = options.minGroupSize ?? 2;
  const collapseThreshold = options.collapseThreshold ?? 4;
  const otherLabel = options.otherLabel ?? 'Other';

  const byLang = new Map<string, T[]>();
  const otherItems: T[] = [];

  for (const item of items) {
    const code = getMeta(item).original_language?.trim().toLowerCase() ?? '';
    if (!code) {
      otherItems.push(item);
      continue;
    }
    const list = byLang.get(code);
    if (list) list.push(item);
    else byLang.set(code, [item]);
  }

  const namedEntries: Array<[string, T[]]> = [];
  for (const [code, list] of byLang.entries()) {
    if (list.length < minGroupSize) {
      otherItems.push(...list);
    } else {
      namedEntries.push([code, list]);
    }
  }

  namedEntries.sort((a, b) => {
    const countDiff = b[1].length - a[1].length;
    if (countDiff !== 0) return countDiff;
    return languageDisplayName(a[0]).localeCompare(languageDisplayName(b[0]));
  });

  const buildGroup = (key: string, label: string, groupItems: T[]): LanguageGroup<T> => {
    const movies: T[] = [];
    const tvShows: T[] = [];
    const cartoons: T[] = [];

    for (const item of groupItems) {
      const meta = getMeta(item);
      if (isAnimated(meta)) {
        cartoons.push(item);
      } else if (meta.mediaType === 'movie') {
        movies.push(item);
      } else {
        tvShows.push(item);
      }
    }

    return {
      key,
      label,
      items: groupItems,
      movies,
      tvShows,
      cartoons,
      defaultCollapsed: key === 'other' || groupItems.length < collapseThreshold,
    };
  };

  const groups = namedEntries.map(([code, list]) =>
    buildGroup(code, languageDisplayName(code), list),
  );

  if (otherItems.length > 0) {
    groups.push(buildGroup('other', otherLabel, otherItems));
  }

  return groups;
}
