import {
  fetchTvSpinoffs,
  filmUniverseCacheRow,
  parseSpinoffSeedIds,
  spinoffSeedIds,
  tvSpinoffCacheRow,
  visitorTvSeedIds,
} from './wikidata-lookups.ts'
import { assertEquals, assertJsonEquals } from './test-assert.ts'

const AT = '2026-11-22T06:20:00.000Z'

Deno.test('reads the proxy ids parameter as it always has', () => {
  assertJsonEquals(parseSpinoffSeedIds(' 3, 1,x,1, -2, 2.5,0,7 '), [3, 1, 7])
  assertJsonEquals(parseSpinoffSeedIds(null), [])
  assertEquals(parseSpinoffSeedIds(Array.from({ length: 1050 }, (_, i) => i + 1).join(',')).length, 1000)
  assertJsonEquals(spinoffSeedIds([5, 5, 2]), [5, 2])
})

Deno.test('builds the seed list a signed-out visitor sends', () => {
  assertJsonEquals(
    visitorTvSeedIds([
      { tmdb_id: 30, library_state: null },
      { tmdb_id: 10, library_state: 'watching' },
      { tmdb_id: 20, library_state: 'hidden' },
      { tmdb_id: 40, library_state: 'stopped' },
      { tmdb_id: 10 },
      { tmdb_id: null },
      { tmdb_id: 1.5 },
    ]),
    [10, 30],
  )
})

Deno.test('cache rows hold the whole seed list and the answer as given', () => {
  const links = [{
    seedTmdbId: 1,
    seedTitle: 'A',
    franchiseId: null,
    franchiseName: null,
    relatedMediaType: 'tv' as const,
    relatedTmdbId: 2,
    relatedTitle: 'B',
    releaseDate: null,
    posterPath: null,
  }]
  assertJsonEquals(tvSpinoffCacheRow([1, 9], links, AT), { lookup: 'tv-spinoffs', seed_ids: [1, 9], results: links, synced_at: AT })
  assertJsonEquals(filmUniverseCacheRow([], AT), { lookup: 'film-universes', seed_ids: [], results: [], synced_at: AT })
})

Deno.test('an empty seed list asks nothing and is complete', async () => {
  const original = globalThis.fetch
  let calls = 0
  globalThis.fetch = () => {
    calls++
    return Promise.reject(new Error('no call expected'))
  }
  try {
    assertJsonEquals(await fetchTvSpinoffs([]), { links: [], complete: true, siblings: 'not asked' })
    assertEquals(calls, 0)
  } finally {
    globalThis.fetch = original
  }
})

Deno.test('the caller signal ends the lookup', async () => {
  const original = globalThis.fetch
  globalThis.fetch = (_input, init) => {
    const signal = (init as { signal?: AbortSignal } | undefined)?.signal
    return signal?.aborted ? Promise.reject(signal.reason) : Promise.reject(new Error('signal not passed'))
  }
  try {
    let message = ''
    try {
      await fetchTvSpinoffs([1], { signal: AbortSignal.abort(new Error('run ceiling')) })
    } catch (error) {
      message = (error as Error).message
    }
    assertEquals(message, 'run ceiling')
  } finally {
    globalThis.fetch = original
  }
})
