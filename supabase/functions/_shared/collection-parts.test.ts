import { collectionPartRows } from './collection-parts.ts'
import { assertEquals, assertJsonEquals } from './test-assert.ts'

const AT = '2026-11-22T03:00:00.000Z'

Deno.test('keeps what the walk reads, normalised as it normalises it', () => {
  const rows = collectionPartRows(10, [
    { id: 1, title: '  First  ', release_date: '2001-05-04', poster_path: '/a.jpg', overview: 'dropped' },
    { id: 2, title: 'Undated', release_date: '', poster_path: '' },
    { id: 3, title: 'No date key' },
  ], AT)
  assertJsonEquals(rows, [
    { collection_id: 10, tmdb_id: 1, title: 'First', release_date: '2001-05-04', poster_path: '/a.jpg', synced_at: AT },
    { collection_id: 10, tmdb_id: 2, title: 'Undated', release_date: null, poster_path: null, synced_at: AT },
    { collection_id: 10, tmdb_id: 3, title: 'No date key', release_date: null, poster_path: null, synced_at: AT },
  ])
})

Deno.test('skips parts the walk always skips', () => {
  const rows = collectionPartRows(10, [
    { id: 0, title: 'Zero id' },
    { id: 1.5, title: 'Fractional id' },
    { id: '4', title: 'String id' },
    { id: 5, title: '   ' },
    { id: 6 },
    null,
    'junk',
    { id: 7, title: 'Kept', release_date: '2020-01-01' },
  ], AT)
  assertJsonEquals(rows?.map((row) => row.tmdb_id), [7])
})

Deno.test('stores nothing for a response a row cannot repeat exactly', () => {
  assertEquals(collectionPartRows(10, [{ id: 1, title: 'A' }, { id: 1, title: 'A again' }], AT), null)
  assertEquals(collectionPartRows(10, [{ id: 1, title: 'A', release_date: '2020' }], AT), null)
  assertEquals(collectionPartRows(10, [{ id: 1, title: 'A', release_date: '2021-02-30' }], AT), null)
  assertEquals(collectionPartRows(10, [{ id: 1, title: 'x'.repeat(301) }], AT), null)
  assertEquals(collectionPartRows(10, [{ id: 1, title: 42 }], AT), null)
  assertEquals(collectionPartRows(10, [{ id: 1, title: 'A', poster_path: 7 }], AT), null)
  assertEquals(collectionPartRows(10, 'not an array', AT), null)
  assertEquals(collectionPartRows(0, [], AT), null)
})

Deno.test('a collection with no parts is empty, not unstorable', () => {
  assertJsonEquals(collectionPartRows(10, undefined, AT), [])
  assertJsonEquals(collectionPartRows(10, [], AT), [])
})

Deno.test('a 300-character title still fits', () => {
  assertEquals(collectionPartRows(10, [{ id: 1, title: 'x'.repeat(300) }], AT)?.length, 1)
})
