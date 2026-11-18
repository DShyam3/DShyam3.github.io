import { describe, expect, it } from 'vitest';
import { LETTERBOXD_MAX_ROWS, detectLetterboxdFile, normaliseTitle, parseLetterboxdFiles } from './letterboxd-import';

const today = '2026-11-18';
const diaryHead = 'Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date';
const parse = (files: { name: string; text: string }[]) => parseLetterboxdFiles(files, { today });

describe('normaliseTitle', () => {
  it('folds accents, ampersands and punctuation', () => {
    expect(normaliseTitle('Amélie')).toBe('amelie');
    expect(normaliseTitle('Fast & Furious')).toBe('fast and furious');
    expect(normaliseTitle('  Mr.  Smith: Goes   to Washington! ')).toBe('mr smith goes to washington');
  });
});

describe('detectLetterboxdFile', () => {
  it('uses the file name first, ignoring path and case', () => {
    expect(detectLetterboxdFile('export/Diary.CSV', [])).toBe('diary');
    expect(detectLetterboxdFile('reviews.csv', [])).toBe('reviews');
    expect(detectLetterboxdFile('a\\watched.csv', [])).toBe('watched');
    expect(detectLetterboxdFile('ratings.csv', [])).toBe('ratings');
  });
  it('falls back to headers', () => {
    expect(detectLetterboxdFile('x.csv', [' Name', 'Watched  Date'])).toBe('diary');
    expect(detectLetterboxdFile('x.csv', ['Name', 'Year', 'Rating'])).toBe('ratings');
    expect(detectLetterboxdFile('x.csv', ['Name', 'Year'])).toBe('watched');
    expect(detectLetterboxdFile('x.csv', ['Foo'])).toBe('unknown');
  });
});

describe('parseLetterboxdFiles', () => {
  it('strips a BOM, handles quoted commas and never uses the logged Date as a watch date', () => {
    const text = `\uFEFF${diaryHead}\n2026-01-05,"Crouching Tiger, Hidden Dragon",2000,https://boxd.it/a,4,,,\n`;
    const { films } = parse([{ name: 'diary.csv', text }]);
    expect(films).toHaveLength(1);
    expect(films[0].name).toBe('Crouching Tiger, Hidden Dragon');
    expect(films[0].watchedDates).toEqual([]);
    expect(films[0].firstWatched).toBeNull();
    expect(films[0].rating).toBe(8);
  });

  it('converts ratings', () => {
    const rows = ['A,2000,0.5', 'B,2001,4.5', 'C,2002,6', 'D,2003,', 'E,2004,3.3'].map(r => `2026-01-01,${r.split(',')[0]},${r.split(',')[1]},u,${r.split(',')[2]}`);
    const { films, skipped } = parse([{ name: 'ratings.csv', text: `Date,Name,Year,Letterboxd URI,Rating\n${rows.join('\n')}` }]);
    expect(films.map(f => f.rating)).toEqual([1, 9, null, null, null]);
    expect(skipped).toEqual([]);
  });

  it('merges files with ratings.csv taking precedence and rewatches giving several dates', () => {
    const diary = `${diaryHead}\n2026-02-01,Heat,1995,u1,3,,,2026-01-30\n2026-03-01,Heat,1995,u2,4,Yes,,2026-02-28\n2026-03-02,Heat,1995,u3,,Yes,,2026-01-30`;
    const watched = 'Date,Name,Year,Letterboxd URI\n2026-01-01,Heat,1995,u\n2026-01-01,Alien,1979,u';
    const ratings = 'Date,Name,Year,Letterboxd URI,Rating\n2026-01-01,Heat,1995,u,5';
    const out = parse([{ name: 'diary.csv', text: diary }, { name: 'watched.csv', text: watched }, { name: 'ratings.csv', text: ratings }]);
    expect(out.films.map(f => f.name)).toEqual(['Alien', 'Heat']);
    const heat = out.films[1];
    expect(heat.key).toBe('heat|1995');
    expect(heat.watchedDates).toEqual(['2026-01-30', '2026-02-28']);
    expect(heat.firstWatched).toBe('2026-01-30');
    expect(heat.rating).toBe(10);
    expect(out.films[0].watchedDates).toEqual([]);
  });

  it('uses the latest-watched rated diary row without ratings.csv', () => {
    const diary = `${diaryHead}\n2026-02-01,Heat,1995,u1,3,,,2026-01-30\n2026-03-01,Heat,1995,u2,4,,,2026-02-28\n2026-03-02,Heat,1995,u3,,,,2026-03-01`;
    expect(parse([{ name: 'diary.csv', text: diary }]).films[0].rating).toBe(8);
  });

  it('drops future or invalid watched dates but keeps the film', () => {
    const diary = `${diaryHead}\n2026-02-01,Heat,1995,u,,,,2027-01-01\n2026-02-01,Heat,1995,u,,,,2026-02-30\n2026-02-01,Heat,1995,u,,,,2026-02-03`;
    const out = parse([{ name: 'diary.csv', text: diary }]);
    expect(out.films[0].watchedDates).toEqual(['2026-02-03']);
    expect(out.skipped.map(s => s.reason)).toEqual(['invalid watched date', 'invalid watched date']);
    expect(out.skipped.map(s => s.row)).toEqual([1, 2]);
  });

  it('skips nameless rows and nulls bad years', () => {
    const out = parse([{ name: 'watched.csv', text: 'Date,Name,Year,Letterboxd URI\n2026-01-01,,1999,u\n2026-01-01,Old,1800,u\n2026-01-01,Far,2040,u' }]);
    expect(out.skipped).toEqual([{ file: 'watched.csv', row: 1, reason: 'missing name' }]);
    expect(out.films.map(f => f.year)).toEqual([null, null]);
  });

  it('records unknown files without throwing', () => {
    const out = parse([{ name: 'other.csv', text: 'Foo,Bar\n1,2' }]);
    expect(out.files).toEqual([{ name: 'other.csv', kind: 'unknown', rows: 0 }]);
    expect(out.skipped).toHaveLength(1);
  });

  it('throws on an empty list and on too many rows', () => {
    expect(() => parse([])).toThrow();
    const text = `Name,Year\n${Array.from({ length: LETTERBOXD_MAX_ROWS + 1 }, (_, i) => `F${i},2000`).join('\n')}`;
    expect(() => parse([{ name: 'watched.csv', text }])).toThrow(/rows/);
  });
});
