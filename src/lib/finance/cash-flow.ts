/**
 * Cash Flow: monthly income, spending and category totals, computed once so
 * the headline card and the Sankey diagram always read the same numbers.
 *
 * This used to be a date walk inside the surface component that invented a
 * synthetic 'Gusto Payroll' row whenever a month had no income, and added
 * every recurring bill to spend even when the bank payment for that bill was
 * already a transaction on the ledger. Both were figures nobody entered --
 * see AGENTS.md, "How AI is used in this project": a figure this module
 * reports comes from a ledger row that actually happened, or it does not
 * appear. No bill, budget or recurring charge is summed here; the caller
 * that wants "money left to pay" is a different question from "money that
 * moved".
 *
 * Ledger sign convention, unchanged from the surface this replaces: amount
 * > 0 is money out (spending), amount < 0 is money in (income). A refund is
 * a negative row filed under a spending category -- it still reduces what
 * left the account rather than adding a new spend, so it counts as income
 * here, not negative spending. The caller passes a ledger with confirmed
 * transfers already removed (useSpendingLedger); this module has no opinion
 * on what counts as a transfer.
 *
 * Money is summed in integer pence and converted back once at the end, so
 * 0.1 + 0.2 comes out 0.3 rather than 0.30000000000000004 -- the same
 * convention as payslip-reconciliation.ts's `pence` helper.
 */

import { resolveMerchant } from './merchant';

export interface CashFlowTransaction {
  id: string;
  /** YYYY-MM-DD. Rows whose date does not match are ignored. */
  date: string;
  name: string;
  amount: number;
  category?: string;
  accountId: string | null;
  /** Who paid, for grouping income sources. Falls back to `name`. */
  payer?: string;
}

export interface CashFlowCategoryTotal { name: string; amount: number }

export interface CashFlowIncomeItem {
  id: string;
  date: string;
  name: string;
  accountId: string | null;
  /** Positive. */
  amount: number;
}

export interface CashFlowMonth {
  year: number;
  /** 0-11. */
  month: number;
  /** YYYY-MM. */
  key: string;
  isFuture: boolean;
  isCurrent: boolean;
  income: number;
  spend: number;
  net: number;
  /** Spending by category, amount desc then name asc. Empty category -> 'Other'. */
  categories: CashFlowCategoryTotal[];
  /** Income rows, date desc then id asc. */
  incomeItems: CashFlowIncomeItem[];
}

export interface CashFlowYear {
  year: number;
  income: number;
  spend: number;
  net: number;
  /** Elapsed (non-future) months of this year inside the range. */
  months: number;
  avgMonthlyIncome: number;
  avgMonthlySpend: number;
  avgMonthlyNet: number;
}

export interface CashFlowSummary {
  income: number;
  spend: number;
  net: number;
  /** Elapsed (non-future) months in the range. */
  months: number;
  avgMonthlyIncome: number;
  avgMonthlySpend: number;
  avgMonthlyNet: number;
  /** (income - spend) / income * 100, 1dp; null when income is 0. */
  savingsRatePercent: number | null;
  /** Across elapsed months, amount desc then name asc. */
  categories: CashFlowCategoryTotal[];
  /** Years present in the range, newest first. */
  byYear: CashFlowYear[];
}

export type CashFlowSankeyNodeKind = 'source' | 'hub' | 'category' | 'kept' | 'drawn';

export interface CashFlowSankeyNode {
  id: string;
  label: string;
  kind: CashFlowSankeyNodeKind;
  amount: number;
}

export interface CashFlowSankeyLink {
  /** Indexes into `nodes`. */
  source: number;
  target: number;
  value: number;
}

export interface CashFlowSankey {
  nodes: CashFlowSankeyNode[];
  links: CashFlowSankeyLink[];
  income: number;
  spend: number;
}

/** A pounds amount to integer pence, so running totals cannot drift. */
const toPence = (amount: number): number => Math.round(amount * 100);

/** Integer pence back to a pounds amount, at 2dp. */
const fromPence = (pence: number): number => pence / 100;

const round2 = (amount: number): number => Math.round(amount * 100) / 100;

const round1 = (amount: number): number => Math.round(amount * 10) / 10;

interface MonthKey { year: number; month0: number }

const MONTH_KEY_RE = /^(\d{4})-(\d{2})$/;

/** Parses a strict 'YYYY-MM', rejecting a month outside 01-12. */
const parseMonthKey = (value: string): MonthKey | undefined => {
  const match = MONTH_KEY_RE.exec(value);
  if (!match) return undefined;
  const month = Number(match[2]);
  if (month < 1 || month > 12) return undefined;
  return { year: Number(match[1]), month0: month - 1 };
};

const formatMonthKey = ({ year, month0 }: MonthKey): string =>
  `${year}-${String(month0 + 1).padStart(2, '0')}`;

const nextMonthKey = (key: MonthKey): MonthKey =>
  key.month0 === 11 ? { year: key.year + 1, month0: 0 } : { year: key.year, month0: key.month0 + 1 };

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Validates a YYYY-MM-DD date actually exists on the calendar (rejects
 * 2026-02-30, matching change-summary.ts's parseIsoDate) and returns its
 * YYYY-MM month key.
 */
const monthKeyOfDate = (date: string): string | undefined => {
  const match = ISO_DATE_RE.exec(date);
  if (!match) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year
    || parsed.getUTCMonth() !== month - 1
    || parsed.getUTCDate() !== day
  ) return undefined;
  return `${match[1]}-${match[2]}`;
};

/**
 * One bucket per calendar month from `startMonth` to `endMonth` inclusive,
 * ascending, with each ledger row filed under its own date's month.
 *
 * `currentMonth` is compared to each bucket's key as a plain string, exactly
 * as the formula below reads it -- it is not re-validated as a month key, so
 * a malformed `currentMonth` degrades to every bucket comparing as whichever
 * side of "future" the string happens to fall on, rather than throwing.
 * `startMonth`/`endMonth` are validated, because they are what decides
 * whether any buckets exist at all.
 */
export function monthlyCashFlow(
  transactions: readonly CashFlowTransaction[],
  startMonth: string,
  endMonth: string,
  currentMonth: string,
): CashFlowMonth[] {
  const start = parseMonthKey(startMonth);
  const end = parseMonthKey(endMonth);
  if (!start || !end) return [];
  if (formatMonthKey(start) > formatMonthKey(end)) return [];

  const endKey = formatMonthKey(end);
  const keys: string[] = [];
  const meta: { year: number; month0: number; isFuture: boolean; isCurrent: boolean }[] = [];

  let cursor = start;
  for (;;) {
    const key = formatMonthKey(cursor);
    keys.push(key);
    meta.push({
      year: cursor.year,
      month0: cursor.month0,
      isFuture: key > currentMonth,
      isCurrent: key === currentMonth,
    });
    if (key === endKey) break;
    cursor = nextMonthKey(cursor);
  }

  const indexByKey = new Map(keys.map((key, index) => [key, index]));
  const incomePence = new Array(keys.length).fill(0) as number[];
  const spendPence = new Array(keys.length).fill(0) as number[];
  const categoryPence: Map<string, number>[] = keys.map(() => new Map());
  const incomeRows: CashFlowIncomeItem[][] = keys.map(() => []);

  for (const tx of transactions) {
    const monthKey = monthKeyOfDate(tx.date);
    if (!monthKey) continue;
    const index = indexByKey.get(monthKey);
    if (index === undefined || meta[index].isFuture) continue;
    if (!Number.isFinite(tx.amount) || tx.amount === 0) continue;

    const amountPence = toPence(tx.amount);
    // Sub-penny noise rounds to nothing; skipping it here keeps a £0.00 row
    // out of the lists, and matches the Sankey's own grouping below.
    if (amountPence === 0) continue;
    if (amountPence < 0) {
      // Money in. A refund is a negative row filed under a spending
      // category -- it counts here too, the same rule the surface has
      // always used.
      const incomePenceRow = -amountPence;
      incomePence[index] += incomePenceRow;
      incomeRows[index].push({
        id: tx.id,
        date: tx.date,
        name: tx.name,
        accountId: tx.accountId,
        amount: fromPence(incomePenceRow),
      });
    } else {
      spendPence[index] += amountPence;
      const category = tx.category?.trim() || 'Other';
      const map = categoryPence[index];
      map.set(category, (map.get(category) ?? 0) + amountPence);
    }
  }

  return meta.map((m, index) => {
    const income = fromPence(incomePence[index]);
    const spend = fromPence(spendPence[index]);
    const categories: CashFlowCategoryTotal[] = Array.from(categoryPence[index], ([name, pence]) => ({ name, pence }))
      .sort((a, b) => b.pence - a.pence || a.name.localeCompare(b.name))
      .map(({ name, pence }) => ({ name, amount: fromPence(pence) }));
    const incomeItems = incomeRows[index]
      .slice()
      .sort((a, b) => (a.date === b.date ? a.id.localeCompare(b.id) : (a.date > b.date ? -1 : 1)));

    return {
      year: m.year,
      month: m.month0,
      key: keys[index],
      isFuture: m.isFuture,
      isCurrent: m.isCurrent,
      income,
      spend,
      net: round2(income - spend),
      categories,
      incomeItems,
    };
  });
}

/** Only non-future months feed a total: a future bucket is not "elapsed". */
const elapsedOnly = (months: readonly CashFlowMonth[]): CashFlowMonth[] =>
  months.filter(m => !m.isFuture);

const sumPence = (months: readonly CashFlowMonth[], pick: (m: CashFlowMonth) => number): number =>
  months.reduce((sum, m) => sum + toPence(pick(m)), 0);

const yearTotals = (months: readonly CashFlowMonth[]): CashFlowYear[] => {
  const years = Array.from(new Set(months.map(m => m.year))).sort((a, b) => b - a);
  return years.map(year => {
    const yearMonths = months.filter(m => m.year === year);
    const income = fromPence(sumPence(yearMonths, m => m.income));
    const spend = fromPence(sumPence(yearMonths, m => m.spend));
    const net = round2(income - spend);
    const count = yearMonths.length;
    return {
      year,
      income,
      spend,
      net,
      months: count,
      avgMonthlyIncome: count > 0 ? round2(income / count) : 0,
      avgMonthlySpend: count > 0 ? round2(spend / count) : 0,
      avgMonthlyNet: count > 0 ? round2(net / count) : 0,
    };
  });
};

/**
 * Rolls the elapsed months of a `monthlyCashFlow` range into one summary:
 * totals, monthly averages, a savings rate and a per-year breakdown.
 */
export function summariseCashFlow(months: readonly CashFlowMonth[]): CashFlowSummary {
  const elapsed = elapsedOnly(months);
  const income = fromPence(sumPence(elapsed, m => m.income));
  const spend = fromPence(sumPence(elapsed, m => m.spend));
  const net = round2(income - spend);
  const count = elapsed.length;

  const categoryPence = new Map<string, number>();
  for (const month of elapsed) {
    for (const category of month.categories) {
      categoryPence.set(category.name, (categoryPence.get(category.name) ?? 0) + toPence(category.amount));
    }
  }
  const categories: CashFlowCategoryTotal[] = Array.from(categoryPence, ([name, pence]) => ({ name, pence }))
    .sort((a, b) => b.pence - a.pence || a.name.localeCompare(b.name))
    .map(({ name, pence }) => ({ name, amount: fromPence(pence) }));

  return {
    income,
    spend,
    net,
    months: count,
    avgMonthlyIncome: count > 0 ? round2(income / count) : 0,
    avgMonthlySpend: count > 0 ? round2(spend / count) : 0,
    avgMonthlyNet: count > 0 ? round2(net / count) : 0,
    savingsRatePercent: income > 0 ? round1(((income - spend) / income) * 100) : null,
    categories,
    byYear: yearTotals(elapsed),
  };
}

interface InternalNode {
  id: string;
  label: string;
  kind: CashFlowSankeyNodeKind;
  pence: number;
}

interface SourceRow { id: string; date: string; payer: string; pence: number }

/** Largest row first; ties broken by newest date, then id, so grouping a
 *  merchant's label is deterministic across runs. */
const sourceRowOrder = (a: SourceRow, b: SourceRow): number =>
  b.pence - a.pence
  || (a.date === b.date ? 0 : (a.date > b.date ? -1 : 1))
  || a.id.localeCompare(b.id);

const nodeOrder = (a: InternalNode, b: InternalNode): number =>
  b.pence - a.pence || a.label.localeCompare(b.label);

/**
 * Where the elapsed months' income and spend came from and went to, as a
 * Sankey diagram: sources -> a hub -> categories, with a 'Kept' or 'From
 * balances' node closing the gap between the two sides.
 *
 * Income sources are grouped by merchant slug from `transactions` rather
 * than `months[].incomeItems`, because a `CashFlowMonth` carries no `payer`
 * field -- but the same date/amount validation as `monthlyCashFlow` is
 * applied here, so the two totals agree exactly (covered by the "matches
 * summariseCashFlow" test in cash-flow.test.ts).
 */
export function cashFlowSankey(
  months: readonly CashFlowMonth[],
  transactions: readonly CashFlowTransaction[],
  options?: { maxSources?: number; maxCategories?: number },
): CashFlowSankey | null {
  const maxSources = options?.maxSources ?? 5;
  const maxCategories = options?.maxCategories ?? 8;

  const elapsed = elapsedOnly(months);
  const elapsedKeys = new Set(elapsed.map(m => m.key));

  let totalIncomePence = 0;
  const bySlug = new Map<string, SourceRow[]>();
  for (const tx of transactions) {
    const monthKey = monthKeyOfDate(tx.date);
    if (!monthKey || !elapsedKeys.has(monthKey)) continue;
    if (!Number.isFinite(tx.amount) || tx.amount >= 0) continue;

    const pence = toPence(-tx.amount);
    if (pence <= 0) continue;
    totalIncomePence += pence;

    const raw = (tx.payer && tx.payer.trim()) || tx.name;
    const slug = resolveMerchant(raw).slug;
    const rows = bySlug.get(slug) ?? [];
    rows.push({ id: tx.id, date: tx.date, payer: raw, pence });
    bySlug.set(slug, rows);
  }

  let totalSpendPence = 0;
  const categoryPenceMap = new Map<string, number>();
  for (const month of elapsed) {
    for (const category of month.categories) {
      const pence = toPence(category.amount);
      totalSpendPence += pence;
      categoryPenceMap.set(category.name, (categoryPenceMap.get(category.name) ?? 0) + pence);
    }
  }

  if (totalIncomePence === 0 && totalSpendPence === 0) return null;

  const sourceGroups: InternalNode[] = Array.from(bySlug, ([slug, rows]) => {
    const pence = rows.reduce((sum, row) => sum + row.pence, 0);
    const largest = rows.slice().sort(sourceRowOrder)[0];
    return { id: `source:${slug}`, label: resolveMerchant(largest.payer).label, kind: 'source' as const, pence };
  }).sort(nodeOrder);

  // The merged remainder always goes last, whatever its size: it is not a
  // payer or a category, and ranking it among them would read as one.
  const topSources = sourceGroups.slice(0, maxSources);
  const otherSourcePence = sourceGroups.slice(maxSources).reduce((sum, g) => sum + g.pence, 0);
  const sourceNodes = (otherSourcePence > 0
    ? [...topSources, { id: 'source:other', label: 'Other income', kind: 'source' as const, pence: otherSourcePence }]
    : topSources
  );

  const categoryGroups: InternalNode[] = Array.from(
    categoryPenceMap,
    ([name, pence]) => ({ id: `category:${name}`, label: name, kind: 'category' as const, pence }),
  ).sort(nodeOrder);

  const topCategories = categoryGroups.slice(0, maxCategories);
  const otherCategoryPence = categoryGroups.slice(maxCategories).reduce((sum, c) => sum + c.pence, 0);
  const categoryNodes = (otherCategoryPence > 0
    ? [...topCategories, { id: 'category:other', label: 'Other spending', kind: 'category' as const, pence: otherCategoryPence }]
    : topCategories
  );

  const hubPence = Math.max(totalIncomePence, totalSpendPence);
  // The hub carries whichever side is larger. Called "Income" when spending
  // outran it, it would show a figure bigger than the income above it.
  const hubLabel = totalSpendPence > totalIncomePence ? 'Spending' : 'Income';
  const hubNode: InternalNode = { id: 'hub', label: hubLabel, kind: 'hub', pence: hubPence };

  const keptPence = totalIncomePence > totalSpendPence ? totalIncomePence - totalSpendPence : 0;
  const drawnPence = totalSpendPence > totalIncomePence ? totalSpendPence - totalIncomePence : 0;
  const keptNode: InternalNode | undefined = keptPence > 0
    ? { id: 'kept', label: 'Kept', kind: 'kept', pence: keptPence }
    : undefined;
  const drawnNode: InternalNode | undefined = drawnPence > 0
    ? { id: 'drawn', label: 'From balances', kind: 'drawn', pence: drawnPence }
    : undefined;

  const ordered: InternalNode[] = [
    ...sourceNodes,
    ...(drawnNode ? [drawnNode] : []),
    hubNode,
    ...categoryNodes,
    ...(keptNode ? [keptNode] : []),
  ];

  const indexOf = new Map(ordered.map((node, index) => [node.id, index]));
  const hubIndex = indexOf.get('hub') as number;

  const links: CashFlowSankeyLink[] = [
    ...sourceNodes.map(node => ({ source: indexOf.get(node.id) as number, target: hubIndex, value: fromPence(node.pence) })),
    ...(drawnNode ? [{ source: indexOf.get('drawn') as number, target: hubIndex, value: fromPence(drawnNode.pence) }] : []),
    ...categoryNodes.map(node => ({ source: hubIndex, target: indexOf.get(node.id) as number, value: fromPence(node.pence) })),
    ...(keptNode ? [{ source: hubIndex, target: indexOf.get('kept') as number, value: fromPence(keptNode.pence) }] : []),
  ];

  return {
    nodes: ordered.map(node => ({ id: node.id, label: node.label, kind: node.kind, amount: fromPence(node.pence) })),
    links,
    income: fromPence(totalIncomePence),
    spend: fromPence(totalSpendPence),
  };
}
