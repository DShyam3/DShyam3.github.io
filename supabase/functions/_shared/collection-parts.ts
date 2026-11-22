/**
 * Rows for `watchlist_collection_parts`, the cache Discover's collection walk
 * reads in place of one tmdb-proxy call per collection.
 *
 * The walk must make the same groups from these rows as from TMDB's own
 * response, so a row keeps exactly what `collectionPartsToEntries`
 * (src/features/watchlist/franchise.ts) reads: id, title, release date and
 * poster, normalised the way it normalises them. A part it would always skip
 * (no valid id, no title) is not stored. A response it would read in a way a
 * row cannot repeat -- the same id twice, a release date that is not a
 * calendar date, a title too long for the column -- is not stored at all, so
 * the walk asks TMDB for that collection as it did before the cache.
 */

export interface CollectionPartRow {
  collection_id: number
  tmdb_id: number
  title: string
  release_date: string | null
  poster_path: string | null
  synced_at: string
}

/** The longest title the table's check constraint allows. */
const MAX_TITLE_LENGTH = 300

const isCalendarDate = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

/**
 * Every part of one collection as rows, or null when the response cannot be
 * stored exactly (see above). An empty array is a collection with nothing
 * the walk would show.
 */
export function collectionPartRows(
  collectionId: number,
  parts: unknown,
  syncedAt: string,
): CollectionPartRow[] | null {
  if (!Number.isSafeInteger(collectionId) || collectionId <= 0) return null
  if (parts == null) return []
  if (!Array.isArray(parts)) return null
  const rows: CollectionPartRow[] = []
  const seen = new Set<number>()
  for (const part of parts) {
    if (part === null || typeof part !== 'object') continue
    const { id, title, release_date: releaseDate, poster_path: posterPath } = part as Record<string, unknown>
    if (typeof id !== 'number' || !Number.isInteger(id) || id <= 0) continue
    if (title != null && typeof title !== 'string') return null
    const cleanTitle = typeof title === 'string' ? title.trim() : ''
    if (!cleanTitle) continue
    if (cleanTitle.length > MAX_TITLE_LENGTH) return null
    // The walk keeps the first copy of an id that it shows, and whether it
    // shows an undated one depends on the viewer's library: a row cannot
    // repeat that choice.
    if (seen.has(id)) return null
    seen.add(id)
    if (releaseDate != null && typeof releaseDate !== 'string') return null
    const cleanDate = (typeof releaseDate === 'string' ? releaseDate.trim() : '') || null
    if (cleanDate !== null && !isCalendarDate(cleanDate)) return null
    if (posterPath != null && typeof posterPath !== 'string') return null
    rows.push({
      collection_id: collectionId,
      tmdb_id: id,
      title: cleanTitle,
      release_date: cleanDate,
      poster_path: typeof posterPath === 'string' && posterPath ? posterPath : null,
      synced_at: syncedAt,
    })
  }
  return rows
}
