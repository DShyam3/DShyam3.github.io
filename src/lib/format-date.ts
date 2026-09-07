/**
 * Dates, written the way they are written here.
 *
 * The UK writes 28/08/2026. Rendering an ISO string raw gives 2026-08-28, and
 * a stray `en-US` locale gives 8/28/2026 — which is not merely unfamiliar but
 * genuinely ambiguous, since 05/06 is two different days depending on who
 * wrote it.
 *
 * One place, so the answer is the same everywhere.
 */

/** Accepts an ISO string, a timestamp, or a Date; returns null for nonsense. */
const asDate = (value: string | number | Date | null | undefined): Date | null => {
  if (value === null || value === undefined || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

/** 28/08/2026. The default for anything showing a specific day. */
export const formatDate = (value: string | number | Date | null | undefined): string => {
  const date = asDate(value);
  if (!date) return '';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${date.getFullYear()}`;
};

/** 28 August 2026, for places with room and a reason to be readable. */
export const formatDateLong = (value: string | number | Date | null | undefined): string => {
  const date = asDate(value);
  if (!date) return '';
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
};

/** Aug 2026, for axis ticks and group headings. */
export const formatMonthYear = (value: string | number | Date | null | undefined): string => {
  const date = asDate(value);
  if (!date) return '';
  return date.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
};
