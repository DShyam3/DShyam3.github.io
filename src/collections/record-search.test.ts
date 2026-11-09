import { describe, expect, it } from 'vitest';
import { searchRecords, type RecordSearchSource } from './record-search';
import type { CollectionConfig, CollectionRow } from './types';

function source(
  path: string,
  rows: CollectionRow[] | undefined,
  searchFields?: string[],
): RecordSearchSource {
  const config = {
    table: path.slice(1),
    path,
    title: path.slice(1),
    subtitle: '',
    noun: { singular: 'item', plural: 'items' },
    searchFields,
    facets: [],
    card: {
      variant: 'text',
      title: (row: CollectionRow) => String(row.title ?? ''),
      subtitle: (row: CollectionRow) => (row.author ? `by ${String(row.author)}` : undefined),
    },
  } as unknown as CollectionConfig<CollectionRow>;
  return { config, rows };
}

const books = source(
  '/books',
  [
    { id: '1', title: 'Meditations', author: 'Marcus Aurelius' },
    { id: '2', title: 'On Meditations', author: 'Someone' },
    { id: '3', title: 'Letters', author: 'Seneca on meditations' },
    { id: '4', title: '', author: 'Nobody' },
  ],
  ['title', 'author'],
);
const articles = source('/articles', [{ id: '1', title: 'Meditations at dawn' }], ['title']);
// No search fields, and a card title that falls back to a label.
const photos = source('/photos', [{ id: '1', title: 'Untitled' }]);

describe('searchRecords', () => {
  it('returns nothing for a query shorter than two characters', () => {
    expect(searchRecords([books], '')).toEqual([]);
    expect(searchRecords([books], ' m ')).toEqual([]);
  });

  it('ranks a title prefix, then a title match, then another field', () => {
    const hits = searchRecords([books], 'meditations');
    expect(hits.map((hit) => hit.key)).toEqual(['/books:1', '/books:2', '/books:3']);
  });

  it('needs every word, across the search fields', () => {
    expect(searchRecords([books], 'marcus meditations').map((hit) => hit.key)).toEqual([
      '/books:1',
    ]);
    expect(searchRecords([books], 'marcus seneca')).toEqual([]);
  });

  it('keeps ids from different collections apart', () => {
    const keys = searchRecords([books, articles], 'meditations').map((hit) => hit.key);
    expect(keys).toContain('/books:1');
    expect(keys).toContain('/articles:1');
  });

  it('matches the stored columns, not the words a card adds around them', () => {
    // The subtitle reads "by Marcus Aurelius"; "by" is not in any column.
    expect(searchRecords([books], 'by marcus')).toEqual([]);
    expect(searchRecords([books], 'marcus')[0].subtitle).toBe('by Marcus Aurelius');
  });

  it('skips a collection that has no search fields', () => {
    expect(searchRecords([photos], 'untitled')).toEqual([]);
  });

  it('skips untitled rows and sources that have not loaded', () => {
    expect(searchRecords([books], 'nobody')).toEqual([]);
    expect(searchRecords([source('/links', undefined, ['title'])], 'anything')).toEqual([]);
  });

  it('caps the number of hits', () => {
    expect(searchRecords([books, articles], 'meditations', 2)).toHaveLength(2);
  });
});
