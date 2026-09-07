/**
 * Spend rolled up by year and by month.
 *
 * Both series were computed inline in the budget surface's render body -- a
 * date walk, a filter and a reduce, recomputed on every keystroke in an
 * unrelated dialog and impossible to check without opening the page. The
 * arithmetic is the part worth being sure about, so it lives here.
 *
 * Recurring bills arrive as a callback rather than a list: whether a bill
 * falls in a given month is the caller's rule (frequency, due month, category
 * filter), and duplicating it here would be a second copy to keep in step.
 *
 * `today` is a parameter, like everywhere else in lib/finance, so a year
 * boundary is something the tests can walk up to rather than wait for.
 */

export interface DatedAmount {
  /** ISO `YYYY-MM-DD`; only the year and month prefix is read. */
  date: string;
  amount: number;
}

/** Total of the bills due in `month` (1-12), already narrowed by the caller. */
export type RecurringTotalForMonth = (month: number) => number;

export interface YearSpend {
  year: number;
  spentPerYear: number;
  avgMonthlySpend: number;
  /** Elapsed months in `year`: the full twelve, or the year so far. */
  monthsElapsed: number;
}

/**
 * Years to offer, newest first: this year, last year, and any year the
 * transactions themselves mention. Last year is included even when empty so
 * the comparison is always there to switch to.
 */
export function spendYears(transactions: readonly DatedAmount[], today: Date): number[] {
  const thisYear = today.getFullYear();
  const fromData = transactions
    .map(tx => parseInt(tx.date.split('-')[0], 10))
    .filter(y => Number.isFinite(y));
  return Array.from(new Set([thisYear, thisYear - 1, ...fromData])).sort((a, b) => b - a);
}

export function yearlySpend(
  years: readonly number[],
  transactions: readonly DatedAmount[],
  recurringTotalForMonth: RecurringTotalForMonth,
  today: Date,
): YearSpend[] {
  const thisYear = today.getFullYear();
  const thisMonthIndex = today.getMonth();

  return years.map(year => {
    // A past year has run its course; the current one has only reached this
    // month, and averaging over twelve would flatter it.
    const monthsElapsed = year === thisYear ? thisMonthIndex + 1 : 12;

    const fromTransactions = transactions
      .filter(tx => tx.date.startsWith(`${year}-`))
      .reduce((sum, tx) => sum + (tx.amount || 0), 0);

    let fromRecurring = 0;
    for (let month = 1; month <= monthsElapsed; month++) {
      fromRecurring += recurringTotalForMonth(month);
    }

    const spentPerYear = fromTransactions + fromRecurring;
    return {
      year,
      spentPerYear,
      avgMonthlySpend: monthsElapsed > 0 ? spentPerYear / monthsElapsed : 0,
      monthsElapsed,
    };
  });
}

export interface MonthSpend {
  /** "Mar 2026", for the tooltip. */
  monthLabel: string;
  /** "M", for the axis, which has no room for more. */
  tickLabel: string;
  spent: number;
  budget: number;
}

/**
 * The trailing `months` months ending with the current one, oldest first.
 *
 * `monthNames` is passed in rather than derived from a locale so the chart
 * reads the same wherever it renders.
 */
export function monthlySpend(
  transactions: readonly DatedAmount[],
  recurringTotalForMonth: RecurringTotalForMonth,
  budget: number,
  monthNames: readonly string[],
  today: Date,
  months = 24,
): MonthSpend[] {
  const series: MonthSpend[] = [];
  const cursor = new Date(today.getFullYear(), today.getMonth(), 1);
  cursor.setMonth(cursor.getMonth() - (months - 1));

  for (let i = 0; i < months; i++) {
    const year = cursor.getFullYear();
    const monthIndex = cursor.getMonth();
    const prefix = `${year}-${String(monthIndex + 1).padStart(2, '0')}-`;

    const fromTransactions = transactions
      .filter(tx => tx.date.startsWith(prefix))
      .reduce((sum, tx) => sum + (tx.amount || 0), 0);

    const spent = fromTransactions + recurringTotalForMonth(monthIndex + 1);

    series.push({
      monthLabel: `${monthNames[monthIndex].slice(0, 3)} ${year}`,
      tickLabel: monthNames[monthIndex].slice(0, 1),
      // Rounded here rather than at the axis: the chart compares these to a
      // budget, and a long float renders as a long float in the tooltip.
      spent: parseFloat(spent.toFixed(2)),
      budget,
    });

    cursor.setMonth(cursor.getMonth() + 1);
  }

  return series;
}
