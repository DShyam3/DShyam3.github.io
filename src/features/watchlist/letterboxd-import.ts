import { parseDelimitedRows } from '@/lib/finance/statement-import';
import { isCalendarDate, todayLocal } from './watched-when';

export const LETTERBOXD_MAX_BYTES = 10 * 1024 * 1024; // per file
export const LETTERBOXD_MAX_ROWS = 20000; // per file
export type LetterboxdFileKind = 'diary' | 'reviews' | 'watched' | 'ratings' | 'unknown';
export interface LetterboxdFilm {
  key: string; // `${normaliseTitle(name)}|${year ?? ''}`
  name: string; // as first seen, trimmed
  year: number | null;
  watchedDates: string[]; // YYYY-MM-DD, unique, ascending, from diary/reviews Watched Date only
  firstWatched: string | null; // watchedDates[0] ?? null
  rating: number | null; // 1..10 = stars * 2
}
export interface LetterboxdParseResult {
  films: LetterboxdFilm[]; // sorted by name then year
  files: { name: string; kind: LetterboxdFileKind; rows: number }[];
  skipped: { file: string; row: number; reason: string }[]; // row = 1-based data row
}

const MB = 1024 * 1024;
const normaliseHeader = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');

export function normaliseTitle(title: string): string {
  return title
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * watchlist.csv and likes/*.csv share watched.csv's header but are films the
 * user has NOT necessarily seen, so they must never be read as watched.
 */
function isUnwatchedList(fileName: string): boolean {
  const parts = fileName.toLowerCase().split(/[\\/]/).map(part => part.replace(/\.[^.]*$/, '').trim());
  const base = parts.pop() ?? '';
  return base === 'watchlist' || base === 'likes' || parts.includes('likes') || parts.includes('watchlist');
}

export function detectLetterboxdFile(fileName: string, headers: string[]): LetterboxdFileKind {
  if (isUnwatchedList(fileName)) return 'unknown';
  const base = (fileName.split(/[\\/]/).pop() ?? '').toLowerCase().replace(/\.[^.]*$/, '').trim();
  if (base === 'diary' || base === 'reviews' || base === 'watched' || base === 'ratings') return base;
  const names = new Set(headers.map(normaliseHeader));
  if (names.has('watched date')) return 'diary';
  if (names.has('rating')) return 'ratings';
  if (names.has('name') && names.has('year')) return 'watched';
  return 'unknown';
}

const parseRating = (value: string): number | null => {
  const text = value.trim();
  if (!/^\d+(\.\d+)?$/.test(text)) return null;
  const stars = Number(text);
  if (stars < 0.5 || stars > 5 || (stars * 2) % 1 !== 0) return null;
  return Math.round(stars * 2);
};

interface Draft {
  name: string;
  year: number | null;
  dates: Set<string>;
  ratingsFile: number | null;
  diaryRating: { date: string; rating: number } | null;
}

export function parseLetterboxdFiles(files: { name: string; text: string }[], options: { today?: string } = {}): LetterboxdParseResult {
  if (files.length === 0) throw new Error('Choose at least one Letterboxd CSV file.');
  const today = options.today ?? todayLocal();
  const maxYear = Number(today.slice(0, 4)) + 5;
  const drafts = new Map<string, Draft>();
  const result: LetterboxdParseResult = { films: [], files: [], skipped: [] };

  for (const file of files) {
    if (new TextEncoder().encode(file.text).length > LETTERBOXD_MAX_BYTES) throw new Error(`${file.name} is larger than ${LETTERBOXD_MAX_BYTES / MB} MB.`);
    const [rawHeaders = [], ...records] = parseDelimitedRows(file.text.replace(/^\uFEFF/, ''), ',');
    if (records.length > LETTERBOXD_MAX_ROWS) throw new Error(`${file.name} has more than ${LETTERBOXD_MAX_ROWS.toLocaleString('en-GB')} rows.`);
    const headers = rawHeaders.map(normaliseHeader);
    const kind = detectLetterboxdFile(file.name, rawHeaders);
    if (kind === 'unknown') {
      result.files.push({ name: file.name, kind, rows: 0 });
      result.skipped.push({ file: file.name, row: 0, reason: isUnwatchedList(file.name) ? 'a watchlist or likes list, not films you have watched' : 'not a Letterboxd export file' });
      continue;
    }
    result.files.push({ name: file.name, kind, rows: records.length });
    const column = (name: string) => headers.indexOf(name);
    const nameAt = column('name'), yearAt = column('year'), ratingAt = column('rating'), watchedAt = column('watched date');

    records.forEach((record, index) => {
      const row = index + 1;
      const skip = (reason: string) => result.skipped.push({ file: file.name, row, reason });
      const name = (record[nameAt] ?? '').trim();
      if (!name) { skip('missing name'); return; }
      const yearText = (record[yearAt] ?? '').trim();
      const yearValue = /^\d{4}$/.test(yearText) ? Number(yearText) : null;
      const year = yearValue !== null && yearValue >= 1870 && yearValue <= maxYear ? yearValue : null;
      const key = `${normaliseTitle(name)}|${year ?? ''}`;
      let draft = drafts.get(key);
      if (!draft) { draft = { name, year, dates: new Set(), ratingsFile: null, diaryRating: null }; drafts.set(key, draft); }
      const rating = ratingAt >= 0 ? parseRating(record[ratingAt] ?? '') : null;
      if (kind === 'ratings') {
        if (rating !== null) draft.ratingsFile = rating;
        return;
      }
      if (kind === 'watched') return;
      const watched = watchedAt >= 0 ? (record[watchedAt] ?? '').trim() : '';
      let watchedDate = '';
      if (watched) {
        if (isCalendarDate(watched) && watched <= today) { draft.dates.add(watched); watchedDate = watched; }
        else skip('invalid watched date');
      }
      if (rating !== null && (!draft.diaryRating || watchedDate >= draft.diaryRating.date)) draft.diaryRating = { date: watchedDate, rating };
    });
  }

  result.films = [...drafts.entries()].map(([key, draft]) => {
    const watchedDates = [...draft.dates].sort();
    return { key, name: draft.name, year: draft.year, watchedDates, firstWatched: watchedDates[0] ?? null, rating: draft.ratingsFile ?? draft.diaryRating?.rating ?? null };
  }).sort((a, b) => a.name.localeCompare(b.name) || (a.year ?? 0) - (b.year ?? 0));
  return result;
}
