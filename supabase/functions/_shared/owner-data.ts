/**
 * What a sync must not delete: seasons and episodes that hold something of
 * the owner's.
 *
 * watchlist-cron-sync decides what TMDB no longer lists from a snapshot read
 * at the start of its run, which can be minutes old by the time it deletes.
 * Deleting a season cascades to its episodes, and deleting either cascades to
 * its rating in `watchlist_ratings`. So each delete is checked against what
 * the tables hold at that moment: a watched episode, or a rating on the row
 * or on anything beneath it, keeps the row.
 *
 * Every read asks for an exact count. When fewer rows came back than exist --
 * the server caps a response at max_rows without saying so -- a held row
 * could look free, so the answer is null: keep everything. A failed read
 * throws, which fails the title rather than deleting blind.
 *
 * The client type is structural, so the Deno tests need no network to load
 * supabase-js; the sync passes its service-role client.
 */

interface Rows {
  data: unknown[] | null
  error: unknown
  count?: number | null
}
interface Filter extends PromiseLike<Rows> {
  in(column: string, values: number[]): Filter
}
export interface OwnerDataReader {
  from(table: string): { select(columns: string, options: { count: 'exact' }): Filter }
}

/** The rows a read returned, or null when they may be incomplete. */
async function readAll<Row>(query: PromiseLike<Rows>): Promise<Row[] | null> {
  const { data, error, count } = await query
  if (error) throw error
  const rows = (data ?? []) as Row[]
  return count === rows.length ? rows : null
}

/**
 * An embedded rating: one object or null, as `episode_id` is unique, or an
 * array should PostgREST ever see the relationship as one-to-many.
 */
const hasRating = (embedded: unknown) => (Array.isArray(embedded) ? embedded.length > 0 : embedded != null)

/**
 * The seasons among `seasonIds` that must stay: any with a watched episode,
 * a rating of its own, or a rated episode. Null keeps them all. Episode
 * ratings ride along on the episode read, so the request grows with the
 * number of seasons, not of episodes.
 */
export async function seasonsToKeep(admin: OwnerDataReader, seasonIds: number[]): Promise<Set<number> | null> {
  if (seasonIds.length === 0) return new Set()
  const [episodes, seasonRatings] = await Promise.all([
    readAll<{ season_id: number; watched: boolean | null; watchlist_ratings: unknown }>(
      admin.from('tv_show_episodes').select('season_id, watched, watchlist_ratings(id)', { count: 'exact' }).in('season_id', seasonIds),
    ),
    readAll<{ season_id: number }>(
      admin.from('watchlist_ratings').select('season_id', { count: 'exact' }).in('season_id', seasonIds),
    ),
  ])
  if (!episodes || !seasonRatings) return null
  const keep = new Set<number>()
  for (const episode of episodes) {
    if (episode.watched === true || hasRating(episode.watchlist_ratings)) keep.add(episode.season_id)
  }
  for (const rating of seasonRatings) keep.add(rating.season_id)
  return keep
}

/**
 * The episodes among `episodeIds` that carry a rating. Null keeps them all.
 * Watched ones are not read here: the delete itself filters them out, in the
 * same statement, so a watch made between this read and the delete still
 * counts.
 */
export async function ratedEpisodes(admin: OwnerDataReader, episodeIds: number[]): Promise<Set<number> | null> {
  if (episodeIds.length === 0) return new Set()
  const ratings = await readAll<{ episode_id: number }>(
    admin.from('watchlist_ratings').select('episode_id', { count: 'exact' }).in('episode_id', episodeIds),
  )
  return ratings ? new Set(ratings.map((rating) => rating.episode_id)) : null
}

/** The PostgREST filter that keeps a delete off watched episodes. */
export const UNWATCHED_ONLY = 'watched.is.null,watched.eq.false'
