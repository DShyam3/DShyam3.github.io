import { describe, expect, it, vi } from 'vitest';
import { PAGE_ROWS, selectAllPages } from './select-all-pages';

type Row = { id: string };
const rowsOf = (ids: number[]): Row[] => ids.map(id => ({ id: String(id) }));
const keyOf = (row: Row) => row.id;

/** Serves `ids` the way the Data API serves a range, `cap` rows at most. */
const table = (ids: () => number[], cap = PAGE_ROWS) => vi.fn(async (from: number, to: number) => {
  const all = ids();
  return { data: rowsOf(all.slice(from, Math.min(to + 1, from + cap))), error: null, count: all.length };
});
const range = (n: number) => Array.from({ length: n }, (_, i) => i);

describe('selectAllPages', () => {
  it('reads past the per-response cap until it has every row', async () => {
    const page = table(() => range(2 * PAGE_ROWS + 770));
    const { data, error } = await selectAllPages(page, keyOf);

    expect(error).toBeNull();
    expect(data).toHaveLength(2 * PAGE_ROWS + 770);
    expect(page.mock.calls).toEqual([
      [0, PAGE_ROWS - 1],
      [PAGE_ROWS, 2 * PAGE_ROWS - 1],
      [2 * PAGE_ROWS, 3 * PAGE_ROWS - 1],
    ]);
  });

  it('makes one request for a table smaller than a page, and for an exact page', async () => {
    const small = table(() => range(143));
    expect((await selectAllPages(small, keyOf)).data).toHaveLength(143);
    expect(small).toHaveBeenCalledTimes(1);

    const exact = table(() => range(PAGE_ROWS));
    expect((await selectAllPages(exact, keyOf)).data).toHaveLength(PAGE_ROWS);
    expect(exact).toHaveBeenCalledTimes(1);
  });

  it('keeps reading when the server caps pages below PAGE_ROWS', async () => {
    const page = table(() => range(1200), 500);
    expect((await selectAllPages(page, keyOf)).data).toHaveLength(1200);
    expect(page.mock.calls.map(([from]) => from)).toEqual([0, 500, 1000]);
  });

  it('rereads when an insert ahead of the read position shifts the pages', async () => {
    let served = 0;
    const page = vi.fn(async (from: number, to: number) => {
      // A sync re-imports an older row between the first and second page.
      const all = served++ === 0 ? range(1500) : [-1, ...range(1500)];
      return { data: rowsOf(all.slice(from, to + 1)), error: null, count: all.length };
    });

    const { data } = await selectAllPages(page, keyOf);
    expect(data).toHaveLength(1501);
    expect(new Set(data?.map(keyOf)).size).toBe(1501);
  });

  it('retries once when the count moves mid-read, then succeeds on a stable table', async () => {
    let ids = range(1500);
    let calls = 0;
    const page = vi.fn(async (from: number, to: number) => {
      if (calls++ === 1) ids = range(1499); // A delete between pages of the first read.
      return { data: rowsOf(ids.slice(from, to + 1)), error: null, count: ids.length };
    });

    const { data, error } = await selectAllPages(page, keyOf);
    expect(error).toBeNull();
    expect(data).toHaveLength(1499);
  });

  it('retries a failed page once, and never returns a partial ledger', async () => {
    const failure = { message: 'The database did not answer in time.' };
    const flaky = vi.fn()
      .mockResolvedValueOnce({ data: rowsOf(range(PAGE_ROWS)), error: null, count: 1500 })
      .mockResolvedValueOnce({ data: null, error: failure })
      .mockResolvedValueOnce({ data: rowsOf(range(PAGE_ROWS)), error: null, count: 1500 })
      .mockResolvedValueOnce({ data: rowsOf(range(1500).slice(PAGE_ROWS)), error: null, count: 1500 });
    expect((await selectAllPages(flaky, keyOf)).data).toHaveLength(1500);

    const down = vi.fn(async (from: number) => (
      from === 0
        ? { data: rowsOf(range(PAGE_ROWS)), error: null, count: 1500 }
        : { data: null, error: failure }
    ));
    expect(await selectAllPages(down, keyOf)).toEqual({ data: null, error: failure });
    expect(down).toHaveBeenCalledTimes(4);
  });

  it('refuses a page without an exact count', async () => {
    const page = vi.fn(async () => ({ data: rowsOf(range(10)), error: null }));
    expect((await selectAllPages(page, keyOf)).error).toEqual({ message: 'A paged read needs an exact row count.' });
  });
});
