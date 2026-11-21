import { ratedEpisodes, seasonsToKeep, type OwnerDataReader } from './owner-data.ts'
import { assertJsonEquals } from './test-assert.ts'

type Row = Record<string, number | boolean | null>
type Query = ReturnType<ReturnType<OwnerDataReader['from']>['select']>

interface Fake {
  tables: Record<string, Row[]>
  /** Table whose reads fail. */
  failOn?: string
  /** Rows the server returns at most, as max_rows does, while still counting them all. */
  cap?: number
}

/**
 * Just enough of supabase-js for `from().select(…, { count: 'exact' }).in()`
 * over in-memory rows, including the one embed the module uses: an episode's
 * `watchlist_ratings(id)`, one object or null.
 */
function fakeClient({ tables, failOn, cap }: Fake): OwnerDataReader {
  return {
    from(table) {
      return {
        select(columns) {
          const picked = columns.split(/,(?![^(]*\))/).map((c) => c.trim())
          const filters: [string, number[]][] = []
          const run = () => {
            if (table === failOn) return { data: null, error: new Error(`read of ${table} failed`), count: null }
            const matched = (tables[table] ?? [])
              .filter((row) => filters.every(([column, values]) => values.includes(row[column] as number)))
              .map((row) => Object.fromEntries(picked.map((c) => {
                if (c === 'watchlist_ratings(id)') {
                  const rating = (tables.watchlist_ratings ?? []).find((r) => r.episode_id === row.id)
                  return ['watchlist_ratings', rating ? { id: rating.id } : null]
                }
                return [c, row[c] ?? null]
              })))
            return { data: cap == null ? matched : matched.slice(0, cap), error: null, count: matched.length }
          }
          const query: Query = {
            in(column, values) {
              filters.push([column, values])
              return query
            },
            then(onfulfilled, onrejected) {
              return Promise.resolve(run()).then(onfulfilled, onrejected)
            },
          }
          return query
        },
      }
    },
  }
}

const sorted = (set: Set<number> | null) => (set ? [...set].sort((a, b) => a - b) : null)

const library: Record<string, Row[]> = {
  tv_show_episodes: [
    { id: 11, season_id: 1, watched: true },
    { id: 21, season_id: 2, watched: false },
    { id: 31, season_id: 3, watched: null },
    { id: 41, season_id: 4, watched: false },
  ],
  watchlist_ratings: [
    { id: 1, season_id: 2, episode_id: null },
    { id: 2, season_id: null, episode_id: 31 },
    // A season with no episodes left, rated.
    { id: 3, season_id: 6, episode_id: null },
  ],
}

Deno.test('keeps a season with a watched episode, its own rating, or a rated episode', async () => {
  // Season 4 has only an unwatched, unrated episode and season 5 has none:
  // both may go.
  assertJsonEquals(sorted(await seasonsToKeep(fakeClient({ tables: library }), [1, 2, 3, 4, 5, 6])), [1, 2, 3, 6])
})

Deno.test('keeps every season when the server returned fewer rows than it counted', async () => {
  assertJsonEquals(await seasonsToKeep(fakeClient({ tables: library, cap: 2 }), [1, 2, 3, 4]), null)
})

Deno.test('a failed season read throws instead of answering', async () => {
  let threw = false
  try {
    await seasonsToKeep(fakeClient({ tables: library, failOn: 'watchlist_ratings' }), [1])
  } catch {
    threw = true
  }
  assertJsonEquals(threw, true)
})

Deno.test('reports which episodes carry a rating', async () => {
  const admin = fakeClient({ tables: library })
  assertJsonEquals(sorted(await ratedEpisodes(admin, [31, 41])), [31])
  assertJsonEquals(sorted(await ratedEpisodes(admin, [])), [])
})

Deno.test('keeps every episode when the ratings read may be incomplete, and throws when it fails', async () => {
  const many: Row[] = Array.from({ length: 5 }, (_, i) => ({ id: i + 1, season_id: null, episode_id: 100 + i }))
  assertJsonEquals(await ratedEpisodes(fakeClient({ tables: { watchlist_ratings: many }, cap: 3 }), [100, 101, 102, 103, 104]), null)
  let threw = false
  try {
    await ratedEpisodes(fakeClient({ tables: library, failOn: 'watchlist_ratings' }), [31])
  } catch {
    threw = true
  }
  assertJsonEquals(threw, true)
})
