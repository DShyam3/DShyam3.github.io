/**
 * Rows asked for per request. The server may return fewer -- its `max_rows`
 * (1,000, in supabase/config.toml and on the hosted project) wins -- and the
 * read below copes with that, so this only sets how few requests it takes.
 */
export const PAGE_ROWS = 1000;

/** Whole reads attempted before giving up. Reads are idempotent. */
const READ_ATTEMPTS = 2;

type ReadError = { message: string };
type PageResult<Row> = { data: Row[] | null; error: ReadError | null; count?: number | null };
type ReadResult<Row> = { data: Row[]; error: null } | { data: null; error: ReadError };

const readOnce = async <Row>(
  page: (from: number, to: number) => PromiseLike<PageResult<Row>>,
  keyOf: (row: Row) => string,
): Promise<ReadResult<Row>> => {
  const rows = new Map<string, Row>();
  let expected: number | undefined;
  for (let from = 0; expected === undefined || from < expected;) {
    const { data, error, count } = await page(from, from + PAGE_ROWS - 1);
    if (error) return { data: null, error };
    if (typeof count !== 'number') return { data: null, error: { message: 'A paged read needs an exact row count.' } };
    if (expected !== undefined && count !== expected) {
      return { data: null, error: { message: 'Rows changed while they were being read.' } };
    }
    expected = count;
    const fetched = data ?? [];
    if (fetched.length === 0) break;
    for (const row of fetched) rows.set(keyOf(row), row);
    from += fetched.length;
  }
  return rows.size === expected
    ? { data: [...rows.values()], error: null }
    : { data: null, error: { message: 'Rows changed while they were being read.' } };
};

/**
 * Reads every row a query matches, one page at a time.
 *
 * The Data API caps each response at `max_rows` and says nothing when it does:
 * a plain select of a bigger table returns the first thousand rows as if that
 * were all of them. The finance ledger passed that, and the page silently
 * worked from about a quarter of it.
 *
 * `page` builds a fresh query for each range. It must ask for
 * `count: 'exact'` and apply a total order, a unique column last. The count is
 * what ends the read, so a server cap lower than PAGE_ROWS cannot pass for
 * the end of the table. Offsets shift if rows are added or removed ahead of
 * the read position mid-read (a sync re-importing history, a delete in another
 * tab): a repeated row is dropped by `keyOf`, and a skipped one shows as a
 * count mismatch, which retries the whole read once.
 *
 * A read that still fails is returned as a failure. Part of a ledger is the
 * bug this exists to fix, so it is never returned as if it were the whole.
 */
export async function selectAllPages<Row>(
  page: (from: number, to: number) => PromiseLike<PageResult<Row>>,
  keyOf: (row: Row) => string,
): Promise<ReadResult<Row>> {
  let result = await readOnce(page, keyOf);
  for (let attempt = 1; result.error && attempt < READ_ATTEMPTS; attempt++) {
    result = await readOnce(page, keyOf);
  }
  return result;
}
