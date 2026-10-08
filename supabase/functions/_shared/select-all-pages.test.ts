import { PAGE_ROWS, selectAllPages } from './select-all-pages.ts'

function assertEquals(actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a !== e) throw new Error(`Expected ${e}, received ${a}`)
}

type Row = { id: string }
type Page = { data: Row[] | null; error: { message: string } | null; count?: number }
const rowsOf = (ids: number[]): Row[] => ids.map((id) => ({ id: String(id) }))
const keyOf = (row: Row) => row.id
const range = (n: number) => Array.from({ length: n }, (_, i) => i)

/** Wraps a page function, recording the ranges it was asked for. */
function recorded(serve: (from: number, to: number, call: number) => Page | Promise<Page>) {
  const calls: [number, number][] = []
  const page = (from: number, to: number) => {
    calls.push([from, to])
    return Promise.resolve(serve(from, to, calls.length - 1))
  }
  return { page, calls }
}

/** Serves `ids` the way the Data API serves a range, `cap` rows at most. */
const table = (ids: () => number[], cap = PAGE_ROWS) => recorded((from, to) => {
  const all = ids()
  return { data: rowsOf(all.slice(from, Math.min(to + 1, from + cap))), error: null, count: all.length }
})

Deno.test('reads past the per-response cap until it has every row', async () => {
  const { page, calls } = table(() => range(2 * PAGE_ROWS + 770))
  const { data, error } = await selectAllPages(page, keyOf)

  assertEquals(error, null)
  assertEquals(data?.length, 2 * PAGE_ROWS + 770)
  assertEquals(calls, [
    [0, PAGE_ROWS - 1],
    [PAGE_ROWS, 2 * PAGE_ROWS - 1],
    [2 * PAGE_ROWS, 3 * PAGE_ROWS - 1],
  ])
})

Deno.test('makes one request for a table smaller than a page, and for an exact page', async () => {
  const small = table(() => range(143))
  assertEquals((await selectAllPages(small.page, keyOf)).data?.length, 143)
  assertEquals(small.calls.length, 1)

  const exact = table(() => range(PAGE_ROWS))
  assertEquals((await selectAllPages(exact.page, keyOf)).data?.length, PAGE_ROWS)
  assertEquals(exact.calls.length, 1)
})

Deno.test('keeps reading when the server caps pages below PAGE_ROWS', async () => {
  const { page, calls } = table(() => range(1200), 500)
  assertEquals((await selectAllPages(page, keyOf)).data?.length, 1200)
  assertEquals(calls.map(([from]) => from), [0, 500, 1000])
})

Deno.test('rereads when an insert ahead of the read position shifts the pages', async () => {
  let served = 0
  const { page } = recorded((from, to) => {
    // A sync re-imports an older row between the first and second page.
    const all = served++ === 0 ? range(1500) : [-1, ...range(1500)]
    return { data: rowsOf(all.slice(from, to + 1)), error: null, count: all.length }
  })

  const { data } = await selectAllPages(page, keyOf)
  assertEquals(data?.length, 1501)
  assertEquals(new Set(data?.map(keyOf)).size, 1501)
})

Deno.test('retries once when the count moves mid-read, then succeeds on a stable table', async () => {
  let ids = range(1500)
  const { page } = recorded((from, to, call) => {
    if (call === 1) ids = range(1499) // A delete between pages of the first read.
    return { data: rowsOf(ids.slice(from, to + 1)), error: null, count: ids.length }
  })

  const { data, error } = await selectAllPages(page, keyOf)
  assertEquals(error, null)
  assertEquals(data?.length, 1499)
})

Deno.test('retries a failed page once, and never returns a partial ledger', async () => {
  const failure = { message: 'The database did not answer in time.' }
  const scripted: Page[] = [
    { data: rowsOf(range(PAGE_ROWS)), error: null, count: 1500 },
    { data: null, error: failure },
    { data: rowsOf(range(PAGE_ROWS)), error: null, count: 1500 },
    { data: rowsOf(range(1500).slice(PAGE_ROWS)), error: null, count: 1500 },
  ]
  const flaky = recorded((_from, _to, call) => scripted[call])
  assertEquals((await selectAllPages(flaky.page, keyOf)).data?.length, 1500)

  const down = recorded((from) => (
    from === 0
      ? { data: rowsOf(range(PAGE_ROWS)), error: null, count: 1500 }
      : { data: null, error: failure }
  ))
  assertEquals(await selectAllPages(down.page, keyOf), { data: null, error: failure })
  assertEquals(down.calls.length, 4)
})

Deno.test('refuses a page without an exact count', async () => {
  const { page } = recorded(() => ({ data: rowsOf(range(10)), error: null }))
  assertEquals((await selectAllPages(page, keyOf)).error, { message: 'A paged read needs an exact row count.' })
})
