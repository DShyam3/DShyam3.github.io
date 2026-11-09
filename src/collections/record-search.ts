import type { CollectionConfig, CollectionRow } from './types';

/** One collection and the rows already read for it. */
export interface RecordSearchSource {
  // Row types differ per collection, so the list of sources is heterogeneous.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  config: CollectionConfig<any, any>;
  rows: CollectionRow[] | undefined;
}

export interface RecordHit {
  /** Unique across collections. */
  key: string;
  /** The row's id within its collection. */
  id: string;
  title: string;
  subtitle?: string;
  collectionTitle: string;
  path: string;
}

/** Below this, a query matches too much to be useful. */
export const MIN_RECORD_QUERY_LENGTH = 2;

/**
 * Records whose search fields contain every word of the query.
 *
 * It matches the columns the collection's own search box matches, read from
 * the row, so a display fallback such as "Untitled" is never searched. A
 * collection with no search fields is skipped.
 *
 * Titles that start with the query come first, then titles that contain it,
 * then matches found in another field. Order within each group follows the
 * order of the sources and their rows, so the result is stable.
 */
export function searchRecords(
  sources: RecordSearchSource[],
  query: string,
  limit = 12,
): RecordHit[] {
  const normalized = query.trim().toLowerCase();
  if (normalized.length < MIN_RECORD_QUERY_LENGTH) return [];
  const words = normalized.split(/\s+/);

  const ranked: { rank: number; hit: RecordHit }[] = [];
  for (const { config, rows } of sources) {
    const fields = config.searchFields;
    if (!fields?.length) continue;
    for (const row of rows ?? []) {
      const haystack = fields
        .map((field) => String(row[field] ?? ''))
        .join(' ')
        .toLowerCase();
      if (!words.every((word) => haystack.includes(word))) continue;

      const title = config.card.title(row)?.trim();
      if (!title) continue;
      const lowerTitle = title.toLowerCase();
      const rank = lowerTitle.startsWith(normalized)
        ? 0
        : lowerTitle.includes(normalized)
          ? 1
          : 2;
      ranked.push({
        rank,
        hit: {
          key: `${config.path}:${row.id}`,
          id: row.id,
          title,
          subtitle: config.card.subtitle?.(row)?.trim() || undefined,
          collectionTitle: config.title,
          path: config.path,
        },
      });
    }
  }

  return ranked
    .map((entry, index) => ({ ...entry, index }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .slice(0, limit)
    .map((entry) => entry.hit);
}
