/**
 * A reproducible answer to “what changed?” in the ledger.
 *
 * This deliberately compares calendar month-to-date windows rather than a
 * rolling number of days. On 10 September, that is 1–10 September against
 * 1–10 August: the same point in each monthly cycle, without treating a
 * payday or a recurring bill as a trend by accident.
 */

export interface ChangeSummaryTransaction {
  id: string;
  date: string;
  amount: number;
  category?: string;
}

export interface ChangePeriod {
  startDate: string;
  endDate: string;
  label: string;
}

export interface ChangePeriodTotals {
  /** Money received; ledger income is stored as a negative amount. */
  income: number;
  /** Money spent; ledger spending is stored as a positive amount. */
  spending: number;
  /** Income less spending, from the actual transactions in this period. */
  net: number;
  transactionCount: number;
}

export interface SpendingCategoryChange {
  category: string;
  current: number;
  previous: number;
  /** Positive means more has been spent in the current period. */
  change: number;
}

export interface FinanceChangeSummary {
  currentPeriod: ChangePeriod;
  previousPeriod: ChangePeriod;
  current: ChangePeriodTotals;
  previous: ChangePeriodTotals;
  deltas: Pick<ChangePeriodTotals, 'income' | 'spending' | 'net'>;
  /** False until there is some preceding-period ledger history to compare. */
  hasComparison: boolean;
  largestSpendingChange?: SpendingCategoryChange;
}

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const round2 = (amount: number): number => Math.round(amount * 100) / 100;

interface Parts { year: number; month: number; day: number }

const parseIsoDate = (value: string): Parts | undefined => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return undefined;
  const [, year, month, day] = match;
  const parsed = { year: Number(year), month: Number(month), day: Number(day) };
  const timestamp = Date.UTC(parsed.year, parsed.month - 1, parsed.day);
  const date = new Date(timestamp);
  if (
    date.getUTCFullYear() !== parsed.year
    || date.getUTCMonth() !== parsed.month - 1
    || date.getUTCDate() !== parsed.day
  ) return undefined;
  return parsed;
};

const isoDate = ({ year, month, day }: Parts): string =>
  `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

const daysInMonth = (year: number, month: number): number =>
  new Date(Date.UTC(year, month, 0)).getUTCDate();

const labelForPeriod = (start: Parts, end: Parts): string => {
  if (start.year === end.year && start.month === end.month) {
    return `${start.day}–${end.day} ${MONTHS[start.month - 1]}`;
  }
  return `${start.day} ${MONTHS[start.month - 1]}–${end.day} ${MONTHS[end.month - 1]}`;
};

const periodsFor = (today: Parts): { current: ChangePeriod; previous: ChangePeriod } => {
  const currentStart = { year: today.year, month: today.month, day: 1 };
  const previousMonth = today.month === 1 ? 12 : today.month - 1;
  const previousYear = today.month === 1 ? today.year - 1 : today.year;
  const previousStart = { year: previousYear, month: previousMonth, day: 1 };
  const previousEnd = {
    year: previousYear,
    month: previousMonth,
    day: Math.min(today.day, daysInMonth(previousYear, previousMonth)),
  };
  return {
    current: {
      startDate: isoDate(currentStart),
      endDate: isoDate(today),
      label: labelForPeriod(currentStart, today),
    },
    previous: {
      startDate: isoDate(previousStart),
      endDate: isoDate(previousEnd),
      label: labelForPeriod(previousStart, previousEnd),
    },
  };
};

interface MeasuredPeriod {
  totals: ChangePeriodTotals;
  spendingByCategory: Map<string, number>;
}

const measure = (
  transactions: readonly ChangeSummaryTransaction[],
  period: ChangePeriod,
): MeasuredPeriod => {
  let income = 0;
  let spending = 0;
  let transactionCount = 0;
  const spendingByCategory = new Map<string, number>();

  for (const transaction of transactions) {
    // Fixed-width ISO dates compare chronologically as strings, but only after
    // validation: a malformed date must not silently land in a summary.
    if (!parseIsoDate(transaction.date) || transaction.date < period.startDate || transaction.date > period.endDate) continue;
    if (!Number.isFinite(transaction.amount) || transaction.amount === 0) continue;
    transactionCount += 1;
    if (transaction.amount < 0) {
      income += Math.abs(transaction.amount);
      continue;
    }

    spending += transaction.amount;
    const category = transaction.category?.trim() || 'Uncategorised';
    spendingByCategory.set(category, (spendingByCategory.get(category) ?? 0) + transaction.amount);
  }

  return {
    totals: {
      income: round2(income),
      spending: round2(spending),
      net: round2(income - spending),
      transactionCount,
    },
    spendingByCategory,
  };
};

/**
 * Summarises actual transactions up to `today`, which must be YYYY-MM-DD.
 * Invalid dates return a harmless empty comparison rather than borrowing the
 * device clock; callers keep deterministic control of the answer.
 */
export const deriveFinanceChangeSummary = (
  transactions: readonly ChangeSummaryTransaction[],
  today: string,
): FinanceChangeSummary => {
  const parsedToday = parseIsoDate(today);
  const fallback = { year: 1970, month: 1, day: 1 };
  const { current, previous } = periodsFor(parsedToday ?? fallback);
  const measuredCurrent = parsedToday ? measure(transactions, current) : measure([], current);
  const measuredPrevious = parsedToday ? measure(transactions, previous) : measure([], previous);

  const categories = new Set([
    ...measuredCurrent.spendingByCategory.keys(),
    ...measuredPrevious.spendingByCategory.keys(),
  ]);
  const largestSpendingChange = [...categories]
    .map(category => {
      const currentSpend = round2(measuredCurrent.spendingByCategory.get(category) ?? 0);
      const previousSpend = round2(measuredPrevious.spendingByCategory.get(category) ?? 0);
      return {
        category,
        current: currentSpend,
        previous: previousSpend,
        change: round2(currentSpend - previousSpend),
      };
    })
    .filter(category => category.change !== 0)
    .sort((left, right) => (
      Math.abs(right.change) - Math.abs(left.change)
      || left.category.localeCompare(right.category)
    ))[0];

  return {
    currentPeriod: current,
    previousPeriod: previous,
    current: measuredCurrent.totals,
    previous: measuredPrevious.totals,
    deltas: {
      income: round2(measuredCurrent.totals.income - measuredPrevious.totals.income),
      spending: round2(measuredCurrent.totals.spending - measuredPrevious.totals.spending),
      net: round2(measuredCurrent.totals.net - measuredPrevious.totals.net),
    },
    hasComparison: measuredPrevious.totals.transactionCount > 0,
    largestSpendingChange,
  };
};
