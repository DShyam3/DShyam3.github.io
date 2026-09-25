import { describe, expect, it } from 'vitest';
import {
  cashFlowSankey,
  monthlyCashFlow,
  summariseCashFlow,
  type CashFlowMonth,
  type CashFlowTransaction,
} from './cash-flow';

const tx = (overrides: Partial<CashFlowTransaction> = {}): CashFlowTransaction => ({
  id: 'tx',
  date: '2026-03-05',
  name: 'Tesco',
  amount: 10,
  category: 'Groceries',
  accountId: 'acc-1',
  ...overrides,
});

const month = (overrides: Partial<CashFlowMonth> = {}): CashFlowMonth => ({
  year: 2026,
  month: 0,
  key: '2026-01',
  isFuture: false,
  isCurrent: false,
  income: 0,
  spend: 0,
  net: 0,
  categories: [],
  incomeItems: [],
  ...overrides,
});

describe('monthlyCashFlow', () => {
  it('returns one zero bucket for an empty ledger', () => {
    const months = monthlyCashFlow([], '2026-03', '2026-03', '2026-03');
    expect(months).toEqual([{
      year: 2026, month: 2, key: '2026-03', isFuture: false, isCurrent: true,
      income: 0, spend: 0, net: 0, categories: [], incomeItems: [],
    }]);
  });

  it('returns [] when start is after end', () => {
    expect(monthlyCashFlow([tx()], '2026-04', '2026-03', '2026-04')).toEqual([]);
  });

  it('returns [] for a malformed startMonth or endMonth', () => {
    expect(monthlyCashFlow([], 'not-a-month', '2026-03', '2026-03')).toEqual([]);
    expect(monthlyCashFlow([], '2026-03', 'not-a-month', '2026-03')).toEqual([]);
    expect(monthlyCashFlow([], '2026-13', '2026-13', '2026-13')).toEqual([]);
  });

  it('sums spending in integer pence so 0.1 + 0.2 lands on 0.3', () => {
    const months = monthlyCashFlow([
      tx({ id: 'a', date: '2026-03-05', amount: 0.1 }),
      tx({ id: 'b', date: '2026-03-06', amount: 0.2 }),
    ], '2026-03', '2026-03', '2026-03');
    expect(months[0].spend).toBe(0.3);
    expect(months[0].categories).toEqual([{ name: 'Groceries', amount: 0.3 }]);
  });

  it('counts a refund in a spending category as income, not negative spending', () => {
    const months = monthlyCashFlow([
      tx({ id: 'refund', date: '2026-03-10', amount: -15, category: 'Shopping', name: 'Zara refund' }),
    ], '2026-03', '2026-03', '2026-03');
    expect(months[0].income).toBe(15);
    expect(months[0].spend).toBe(0);
    expect(months[0].categories).toEqual([]);
    expect(months[0].incomeItems).toEqual([{
      id: 'refund', date: '2026-03-10', name: 'Zara refund', accountId: 'acc-1', amount: 15,
    }]);
  });

  it('ignores a row whose date does not exist on the calendar, and a row that is not a date at all', () => {
    const months = monthlyCashFlow([
      tx({ id: 'good', date: '2026-03-05', amount: 40 }),
      tx({ id: 'bad-day', date: '2026-02-30', amount: 999 }),
      tx({ id: 'not-a-date', date: 'yesterday', amount: 999 }),
    ], '2026-02', '2026-03', '2026-03');
    expect(months.find(m => m.key === '2026-03')?.spend).toBe(40);
    expect(months.find(m => m.key === '2026-02')?.spend).toBe(0);
  });

  it('ignores a zero-amount row', () => {
    const months = monthlyCashFlow([tx({ amount: 0 })], '2026-03', '2026-03', '2026-03');
    expect(months[0].spend).toBe(0);
    expect(months[0].categories).toEqual([]);
  });

  it('zeroes a future month even when rows are dated in it, but counts the current month', () => {
    const months = monthlyCashFlow([
      tx({ id: 'feb', date: '2026-02-14', amount: 50 }),
      tx({ id: 'mar', date: '2026-03-15', amount: 100 }),
    ], '2026-01', '2026-04', '2026-02');

    const jan = months.find(m => m.key === '2026-01')!;
    const feb = months.find(m => m.key === '2026-02')!;
    const mar = months.find(m => m.key === '2026-03')!;
    const apr = months.find(m => m.key === '2026-04')!;

    expect(feb.isCurrent).toBe(true);
    expect(feb.isFuture).toBe(false);
    expect(feb.spend).toBe(50);

    expect(mar.isFuture).toBe(true);
    expect(mar.spend).toBe(0);
    expect(mar.categories).toEqual([]);

    expect(jan.isFuture).toBe(false);
    expect(apr.isFuture).toBe(true);
  });

  it('buckets a range crossing a year boundary in order', () => {
    const months = monthlyCashFlow([], '2025-11', '2026-02', '2026-02');
    expect(months.map(m => m.key)).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
    expect(months.map(m => m.year)).toEqual([2025, 2025, 2026, 2026]);
  });

  it('files a missing or blank category under Other', () => {
    const months = monthlyCashFlow([
      tx({ id: 'a', date: '2026-03-05', amount: 20, category: undefined }),
      tx({ id: 'b', date: '2026-03-06', amount: 5, category: '   ' }),
    ], '2026-03', '2026-03', '2026-03');
    expect(months[0].categories).toEqual([{ name: 'Other', amount: 25 }]);
  });

  it('handles a single negative row as income', () => {
    const months = monthlyCashFlow([tx({ amount: -100 })], '2026-03', '2026-03', '2026-03');
    expect(months[0].income).toBe(100);
    expect(months[0].spend).toBe(0);
    expect(months[0].net).toBe(100);
  });

  it('sorts categories by amount desc, then name asc on a tie', () => {
    const months = monthlyCashFlow([
      tx({ id: 'a', amount: 10, category: 'Zebra' }),
      tx({ id: 'b', amount: 10, category: 'Apple' }),
      tx({ id: 'c', amount: 50, category: 'Housing' }),
    ], '2026-03', '2026-03', '2026-03');
    expect(months[0].categories).toEqual([
      { name: 'Housing', amount: 50 },
      { name: 'Apple', amount: 10 },
      { name: 'Zebra', amount: 10 },
    ]);
  });

  it('sorts income items by date desc, then id asc on a tie', () => {
    const months = monthlyCashFlow([
      tx({ id: 'b', date: '2026-03-05', amount: -10 }),
      tx({ id: 'a', date: '2026-03-05', amount: -10 }),
      tx({ id: 'later', date: '2026-03-20', amount: -5 }),
    ], '2026-03', '2026-03', '2026-03');
    expect(months[0].incomeItems.map(i => i.id)).toEqual(['later', 'a', 'b']);
  });
});

describe('summariseCashFlow', () => {
  it('returns a deterministic zero summary for no months', () => {
    expect(summariseCashFlow([])).toEqual({
      income: 0, spend: 0, net: 0, months: 0,
      avgMonthlyIncome: 0, avgMonthlySpend: 0, avgMonthlyNet: 0,
      savingsRatePercent: null, categories: [], byYear: [],
    });
  });

  it('reports null savings rate at zero income', () => {
    const summary = summariseCashFlow([month({ income: 0, spend: 100, net: -100 })]);
    expect(summary.savingsRatePercent).toBeNull();
  });

  it('reports a negative savings rate when spend exceeds income', () => {
    const summary = summariseCashFlow([month({ income: 100, spend: 150, net: -50 })]);
    expect(summary.savingsRatePercent).toBe(-50);
  });

  it('excludes future months from every total', () => {
    const summary = summariseCashFlow([
      month({ key: '2026-01', income: 100, spend: 40, net: 60 }),
      month({ key: '2026-02', isFuture: true, income: 999, spend: 999, net: 0 }),
    ]);
    expect(summary.income).toBe(100);
    expect(summary.spend).toBe(40);
    expect(summary.months).toBe(1);
  });

  it('averages a single month over one', () => {
    const summary = summariseCashFlow([month({ income: 300, spend: 100, net: 200 })]);
    expect(summary.avgMonthlyIncome).toBe(300);
    expect(summary.avgMonthlySpend).toBe(100);
    expect(summary.avgMonthlyNet).toBe(200);
  });

  it('breaks totals down by year, newest first, each averaged over its own elapsed months', () => {
    const summary = summariseCashFlow([
      month({ year: 2025, key: '2025-11', income: 1000, spend: 600, net: 400 }),
      month({ year: 2025, key: '2025-12', income: 1000, spend: 400, net: 600 }),
      month({ year: 2026, key: '2026-01', income: 2000, spend: 1000, net: 1000 }),
      month({ year: 2026, key: '2026-02', isFuture: true, income: 5000, spend: 5000, net: 0 }),
    ]);

    expect(summary.byYear).toEqual([
      { year: 2026, income: 2000, spend: 1000, net: 1000, months: 1, avgMonthlyIncome: 2000, avgMonthlySpend: 1000, avgMonthlyNet: 1000 },
      { year: 2025, income: 2000, spend: 1000, net: 1000, months: 2, avgMonthlyIncome: 1000, avgMonthlySpend: 500, avgMonthlyNet: 500 },
    ]);
    expect(summary.months).toBe(3);
    expect(summary.income).toBe(4000);
    expect(summary.spend).toBe(2000);
    expect(summary.avgMonthlyIncome).toBe(1333.33);
    expect(summary.avgMonthlySpend).toBe(666.67);
  });

  it('merges categories across months, amount desc then name asc', () => {
    const summary = summariseCashFlow([
      month({ key: '2026-01', categories: [{ name: 'Housing', amount: 500 }, { name: 'Zebra', amount: 10 }] }),
      month({ key: '2026-02', categories: [{ name: 'Housing', amount: 100 }, { name: 'Apple', amount: 10 }] }),
    ]);
    expect(summary.categories).toEqual([
      { name: 'Housing', amount: 600 },
      { name: 'Apple', amount: 10 },
      { name: 'Zebra', amount: 10 },
    ]);
  });
});

describe('cashFlowSankey', () => {
  it('returns null when there is no income and no spend', () => {
    expect(cashFlowSankey([], [])).toBeNull();
    const months = monthlyCashFlow([], '2026-01', '2026-01', '2026-01');
    expect(cashFlowSankey(months, [])).toBeNull();
  });

  it('adds a Kept node when income exceeds spend, sized to the gap', () => {
    const transactions = [
      tx({ id: 'salary', date: '2026-01-05', amount: -2000, name: 'Acme Payroll', payer: 'Acme Ltd', category: undefined }),
      tx({ id: 'food', date: '2026-01-10', amount: 500, category: 'Groceries' }),
    ];
    const months = monthlyCashFlow(transactions, '2026-01', '2026-01', '2026-01');
    const sankey = cashFlowSankey(months, transactions)!;

    expect(sankey.income).toBe(2000);
    expect(sankey.spend).toBe(500);
    const hub = sankey.nodes.find(n => n.id === 'hub')!;
    expect(hub.amount).toBe(2000);
    const kept = sankey.nodes.find(n => n.id === 'kept');
    expect(kept).toEqual({ id: 'kept', label: 'Kept', kind: 'kept', amount: 1500 });
    expect(sankey.nodes.find(n => n.id === 'drawn')).toBeUndefined();
  });

  it('adds a From balances node when spend exceeds income, sized to the gap', () => {
    const transactions = [
      tx({ id: 'salary', date: '2026-01-05', amount: -500, name: 'Acme Payroll', payer: 'Acme Ltd', category: undefined }),
      tx({ id: 'food', date: '2026-01-10', amount: 2000, category: 'Groceries' }),
    ];
    const months = monthlyCashFlow(transactions, '2026-01', '2026-01', '2026-01');
    const sankey = cashFlowSankey(months, transactions)!;

    const hub = sankey.nodes.find(n => n.id === 'hub')!;
    expect(hub.amount).toBe(2000);
    // Named for the larger side, so the label never overstates income.
    expect(hub.label).toBe('Spending');
    const drawn = sankey.nodes.find(n => n.id === 'drawn');
    expect(drawn).toEqual({ id: 'drawn', label: 'From balances', kind: 'drawn', amount: 1500 });
    expect(sankey.nodes.find(n => n.id === 'kept')).toBeUndefined();
  });

  it('adds neither node when income equals spend exactly', () => {
    const transactions = [
      tx({ id: 'salary', date: '2026-01-05', amount: -1000, name: 'Acme Payroll', payer: 'Acme Ltd', category: undefined }),
      tx({ id: 'food', date: '2026-01-10', amount: 1000, category: 'Groceries' }),
    ];
    const months = monthlyCashFlow(transactions, '2026-01', '2026-01', '2026-01');
    const sankey = cashFlowSankey(months, transactions)!;

    expect(sankey.nodes.find(n => n.id === 'kept')).toBeUndefined();
    expect(sankey.nodes.find(n => n.id === 'drawn')).toBeUndefined();
  });

  it('groups differently-worded rows from the same payer into one source', () => {
    const transactions = [
      tx({ id: 'a1', date: '2026-01-05', amount: -100, payer: 'Acme Ltd', category: undefined }),
      tx({ id: 'a2', date: '2026-01-06', amount: -50, payer: 'ACME LTD', category: undefined }),
      tx({ id: 'spend', date: '2026-01-10', amount: 20, category: 'Groceries' }),
    ];
    const months = monthlyCashFlow(transactions, '2026-01', '2026-01', '2026-01');
    const sankey = cashFlowSankey(months, transactions)!;

    const sources = sankey.nodes.filter(n => n.kind === 'source');
    expect(sources).toEqual([{ id: 'source:acme-ltd', label: 'Acme Ltd', kind: 'source', amount: 150 }]);
  });

  it('keeps only the top maxSources income groups and merges the rest into Other income', () => {
    const payers = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'];
    const amounts = [600, 500, 400, 300, 200, 100];
    const transactions: CashFlowTransaction[] = payers.map((payer, i) => tx({
      id: `income-${i}`, date: '2026-01-05', amount: -amounts[i], payer, category: undefined,
    }));
    const months = monthlyCashFlow(transactions, '2026-01', '2026-01', '2026-01');
    const sankey = cashFlowSankey(months, transactions)!;

    const sources = sankey.nodes.filter(n => n.kind === 'source');
    expect(sources).toHaveLength(6);
    expect(sources.map(s => s.id)).toEqual([
      'source:p1', 'source:p2', 'source:p3', 'source:p4', 'source:p5', 'source:other',
    ]);
    const other = sources.find(s => s.id === 'source:other')!;
    expect(other).toEqual({ id: 'source:other', label: 'Other income', kind: 'source', amount: 100 });
  });

  it('keeps Other income last even when it outweighs a named source', () => {
    const transactions = [
      tx({ id: 'big', date: '2026-01-05', amount: -900, payer: 'Big', category: undefined }),
      tx({ id: 'small', date: '2026-01-05', amount: -50, payer: 'Small', category: undefined }),
      tx({ id: 'x', date: '2026-01-05', amount: -40, payer: 'X', category: undefined }),
      tx({ id: 'y', date: '2026-01-05', amount: -40, payer: 'Y', category: undefined }),
    ];
    const months = monthlyCashFlow(transactions, '2026-01', '2026-01', '2026-01');
    const sankey = cashFlowSankey(months, transactions, { maxSources: 2 })!;

    const sources = sankey.nodes.filter(n => n.kind === 'source');
    expect(sources.map(s => s.id)).toEqual(['source:big', 'source:small', 'source:other']);
    expect(sources[2]?.amount).toBe(80);
  });

  it('skips a sub-penny row rather than listing it at £0.00', () => {
    const months = monthlyCashFlow(
      [tx({ id: 'dust', date: '2026-01-05', amount: -0.001, category: undefined })],
      '2026-01', '2026-01', '2026-01',
    );
    expect(months[0]?.incomeItems).toEqual([]);
    expect(months[0]?.income).toBe(0);
  });

  it('omits Other income when every source fits within maxSources', () => {
    const transactions = [
      tx({ id: 'a', date: '2026-01-05', amount: -10, payer: 'One', category: undefined }),
      tx({ id: 'b', date: '2026-01-05', amount: -20, payer: 'Two', category: undefined }),
    ];
    const months = monthlyCashFlow(transactions, '2026-01', '2026-01', '2026-01');
    const sankey = cashFlowSankey(months, transactions)!;
    expect(sankey.nodes.find(n => n.id === 'source:other')).toBeUndefined();
  });

  it('keeps only the top maxCategories spend categories and merges the rest into Other spending', () => {
    const transactions = [
      tx({ id: 'income', date: '2026-01-05', amount: -1000, payer: 'Acme Ltd', category: undefined }),
      tx({ id: 'a', date: '2026-01-10', amount: 300, category: 'A' }),
      tx({ id: 'b', date: '2026-01-11', amount: 200, category: 'B' }),
      tx({ id: 'c', date: '2026-01-12', amount: 100, category: 'C' }),
    ];
    const months = monthlyCashFlow(transactions, '2026-01', '2026-01', '2026-01');
    const sankey = cashFlowSankey(months, transactions, { maxCategories: 2 })!;

    const categories = sankey.nodes.filter(n => n.kind === 'category');
    expect(categories).toEqual([
      { id: 'category:A', label: 'A', kind: 'category', amount: 300 },
      { id: 'category:B', label: 'B', kind: 'category', amount: 200 },
      { id: 'category:other', label: 'Other spending', kind: 'category', amount: 100 },
    ]);
  });

  it('breaks ties on equal amount by label/name ascending', () => {
    const transactions = [
      tx({ id: 'bravo', date: '2026-01-05', amount: -100, payer: 'Bravo Co', category: undefined }),
      tx({ id: 'alpha', date: '2026-01-06', amount: -100, payer: 'Alpha Co', category: undefined }),
    ];
    const months = monthlyCashFlow(transactions, '2026-01', '2026-01', '2026-01');
    const sankey = cashFlowSankey(months, transactions)!;
    expect(sankey.nodes.filter(n => n.kind === 'source').map(n => n.label)).toEqual(['Alpha Co', 'Bravo Co']);
  });

  it('conserves flow: what enters the hub equals what leaves it, to the penny', () => {
    const transactions = [
      tx({ id: 'salary', date: '2026-01-05', amount: -733.33, payer: 'Acme Ltd', category: undefined }),
      tx({ id: 'food', date: '2026-01-10', amount: 210.1, category: 'Groceries' }),
      tx({ id: 'fuel', date: '2026-01-12', amount: 640.02, category: 'Transport' }),
    ];
    const months = monthlyCashFlow(transactions, '2026-01', '2026-01', '2026-01');
    const sankey = cashFlowSankey(months, transactions)!;

    const hub = sankey.nodes.find(n => n.id === 'hub')!;
    const hubIndex = sankey.nodes.indexOf(hub);
    const toPence = (n: number) => Math.round(n * 100);

    const into = sankey.links.filter(l => l.target === hubIndex).reduce((s, l) => s + toPence(l.value), 0);
    const out = sankey.links.filter(l => l.source === hubIndex).reduce((s, l) => s + toPence(l.value), 0);

    expect(into).toBe(toPence(hub.amount));
    expect(out).toBe(toPence(hub.amount));
  });

  it('reports the same income and spend as summariseCashFlow for the same months', () => {
    const transactions = [
      tx({ id: 'salary', date: '2026-01-05', amount: -2000, payer: 'Acme Ltd', category: undefined }),
      tx({ id: 'refund', date: '2026-01-08', amount: -15, category: 'Shopping' }),
      tx({ id: 'food', date: '2026-01-10', amount: 500, category: 'Groceries' }),
    ];
    const months = monthlyCashFlow(transactions, '2026-01', '2026-01', '2026-01');
    const sankey = cashFlowSankey(months, transactions)!;
    const summary = summariseCashFlow(months);

    expect(sankey.income).toBe(summary.income);
    expect(sankey.spend).toBe(summary.spend);
  });

  it('handles a single income transaction with no spend: all of it is Kept', () => {
    const transactions = [tx({ id: 'only', date: '2026-01-05', amount: -50, payer: 'Acme Ltd', category: undefined })];
    const months = monthlyCashFlow(transactions, '2026-01', '2026-01', '2026-01');
    const sankey = cashFlowSankey(months, transactions)!;

    expect(sankey.nodes.filter(n => n.kind === 'category')).toEqual([]);
    expect(sankey.nodes.find(n => n.id === 'kept')).toEqual({ id: 'kept', label: 'Kept', kind: 'kept', amount: 50 });
  });
});
