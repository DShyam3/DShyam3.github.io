/**
 * Experience and education as one timeline, newest first.
 *
 * Dates are stored the way a CV writes them -- "May 2025", "September 2020" --
 * and are parsed here only to order the rows; what renders is still the stored
 * text. A date that does not parse ("Ma 2025", "Present", blank) sorts after
 * every dated row, in the order it was stored, rather than guessing a month.
 */

const MONTHS = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
];

/**
 * Months since year 0 for "Month YYYY" (full name or at least three letters)
 * or a bare "YYYY", which counts as January. Anything else is null.
 */
export function monthIndex(date: string | null | undefined): number | null {
  const value = (date ?? '').trim();

  const monthYear = value.match(/^([a-z]+)\.?\s+(\d{4})$/i);
  if (monthYear) {
    const name = monthYear[1].toLowerCase();
    if (name.length < 3) return null;
    const month = MONTHS.findIndex((m) => m.startsWith(name));
    return month === -1 ? null : Number(monthYear[2]) * 12 + month;
  }

  const year = value.match(/^(\d{4})$/);
  return year ? Number(year[1]) * 12 : null;
}

export type ResumeEntry<E, D> =
  | { kind: 'experience'; item: E }
  | { kind: 'education'; item: D };

/**
 * Every role and degree in one list, by start date, newest first. Entries
 * starting in the same month keep experience ahead of education.
 */
export function buildResumeTimeline<
  E extends { start_date: string },
  D extends { start_date: string },
>(experience: E[], education: D[]): ResumeEntry<E, D>[] {
  const entries: ResumeEntry<E, D>[] = [
    ...experience.map((item) => ({ kind: 'experience' as const, item })),
    ...education.map((item) => ({ kind: 'education' as const, item })),
  ];

  return entries
    .map((entry, position) => ({
      entry,
      position,
      start: monthIndex(entry.item.start_date),
    }))
    .sort((a, b) => {
      if (a.start === null || b.start === null) {
        if (a.start === b.start) return a.position - b.position;
        return a.start === null ? 1 : -1;
      }
      return b.start - a.start || a.position - b.position;
    })
    .map(({ entry }) => entry);
}
