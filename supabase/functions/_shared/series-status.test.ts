import { assertJsonEquals } from './test-assert.ts'
import { syncedSeriesStatus } from './series-status.ts'

Deno.test('a manual Ended status survives unchanged TMDB data', () => {
  assertJsonEquals(syncedSeriesStatus('Ended', 'Returning Series', 'Returning Series'), {
    status: 'Ended', tmdbStatus: 'Returning Series', changed: false,
  })
})

Deno.test('a genuine TMDB change replaces the manual status', () => {
  assertJsonEquals(syncedSeriesStatus('Ended', 'Returning Series', 'In Production'), {
    status: 'In Production', tmdbStatus: 'In Production', changed: true,
  })
})

Deno.test('missing TMDB status preserves both values', () => {
  assertJsonEquals(syncedSeriesStatus('Ended', 'Returning Series', null), {
    status: 'Ended', tmdbStatus: 'Returning Series', changed: false,
  })
})
