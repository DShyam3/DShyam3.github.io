/**
 * Reading the snapshot series back.
 *
 * 7.4 started recording net worth nightly precisely because history cannot be
 * reconstructed after the fact. This is the other half: turning that series
 * into the answer to "what changed?".
 *
 * Pure, as everything in this module is — the caller supplies the rows and
 * today's date, so the same series gives the same answer whenever it is asked.
 */

export interface NetWorthPoint {
  /** YYYY-MM-DD */
  capturedOn: string;
  netWorth: number;
  assets: number;
  liabilities: number;
}

export interface NetWorthChange {
  /** The most recent point, or null when nothing has been recorded yet. */
  latest: NetWorthPoint | null;
  /** The point being compared against, or null when there is only one. */
  previous: NetWorthPoint | null;
  absolute: number;
  /** Null rather than Infinity when the earlier figure was zero. */
  percent: number | null;
  direction: 'up' | 'down' | 'flat' | 'unknown';
  /** Days between the two points, so the UI can say what it is comparing. */
  spanDays: number;
}

const EMPTY: NetWorthChange = {
  latest: null, previous: null, absolute: 0, percent: null, direction: 'unknown', spanDays: 0,
};

const daysBetween = (a: string, b: string) =>
  Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

/**
 * Compares the newest snapshot against the oldest one on or after `since`.
 *
 * Anchoring on the oldest point in the window rather than simply the previous
 * row means a gap in the series — a missed cron run, a period the app was not
 * open — widens the comparison rather than silently comparing across it as if
 * it were a day.
 */
export const netWorthChangeSince = (
  points: NetWorthPoint[],
  since: string,
): NetWorthChange => {
  if (points.length === 0) return EMPTY;

  const sorted = [...points].sort((a, b) => a.capturedOn.localeCompare(b.capturedOn));
  const latest = sorted[sorted.length - 1];
  const inWindow = sorted.filter(p => p.capturedOn >= since);
  const previous = inWindow.length > 1 ? inWindow[0] : null;

  if (!previous) {
    return { ...EMPTY, latest, spanDays: 0 };
  }

  const absolute = Math.round((latest.netWorth - previous.netWorth) * 100) / 100;
  return {
    latest,
    previous,
    absolute,
    percent:
      previous.netWorth === 0
        ? null
        : Math.round((absolute / Math.abs(previous.netWorth)) * 1000) / 10,
    direction: absolute > 0 ? 'up' : absolute < 0 ? 'down' : 'flat',
    spanDays: daysBetween(previous.capturedOn, latest.capturedOn),
  };
};

/** First day of the month a date falls in, as YYYY-MM-DD. */
export const startOfMonth = (isoDate: string): string => `${isoDate.slice(0, 7)}-01`;
