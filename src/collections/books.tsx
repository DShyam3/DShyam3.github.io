import { BookOpen } from 'lucide-react';
import { DetailSection } from '@/components/cards/CardDetailDialog';
import { BOOK_CATEGORY_OPTIONS } from './book-categories';
import { BookSearchDialog } from './components/BookSearchDialog';
import { BookMetadataLookup } from './components/BookMetadataLookup';
import { bookshopLinks } from '@/lib/book-metadata';
import { uploadPhoto } from '@/lib/storage';
import type { CollectionConfig, CollectionRow } from './types';

export interface BookRow extends CollectionRow {
  title: string;
  author: string;
  cover_url: string | null;
  description: string | null;
  link: string | null;
  category: string;
  genre: string | null;
  created_at: string;
}

/** Reading status is independent of the subject stored in genre. */
const CATEGORIES = [
  { key: 'completed', label: 'Completed' },
  { key: 'reading', label: 'Currently Reading' },
  { key: 'future', label: 'To Read' },
  { key: 'wishlist', label: 'Wishlist' },
];

export const booksCollection: CollectionConfig<BookRow> = {
  table: 'books',
  path: '/books',
  title: 'Books',
  subtitle: 'Reading list',
  noun: { singular: 'Book', plural: 'Books' },

  searchFields: ['title', 'author'],

  facets: [
    {
      key: 'category',
      field: 'category',
      label: 'Reading status',
      options: CATEGORIES,
      // Books read opens first; the unread piles and All sit after it.
      allLast: true,
      defaultValue: 'completed',
    },
    {
      key: 'genre',
      field: 'genre',
      label: 'Category',
      options: BOOK_CATEGORY_OPTIONS,
      match: (book, key) => key === 'Uncategorized'
        ? !BOOK_CATEGORY_OPTIONS.some((option) => option.key !== 'Uncategorized' && option.key === book.genre)
        : book.genre === key,
    },
  ],

  customToolbarActions: ({ allItems, addItem, isAdmin }) => isAdmin
    ? <BookSearchDialog config={booksCollection} books={allItems} onAdd={addItem} />
    : null,

  card: {
    variant: 'media',
    imageFit: 'contain',
    // Book covers are 2:3.
    aspect: '2 / 3',
    fallbackIcon: BookOpen,
    title: (book) => book.title,
    subtitle: (book) => book.author,
    image: (book) => book.cover_url ?? undefined,
    href: (book) => book.link ?? undefined,
    // Genre, not the blurb -- the description belongs in the dialog, where
    // there is room to read it.
    excerpt: (book) => book.genre ?? undefined,
    // The active filter already tells you the reading state. A large label on
    // the artwork took attention away from the cover, especially in the
    // default Completed view; the category remains available in its editor.
  },

  // Image fields take a pasted URL or an upload; uploads go to the photos
  // bucket, which avoids depending on a third-party URL staying alive.
  uploadFile: uploadPhoto,

  formLayout: 'wide',
  formEnhancement: ({ values, onChange, mode }) => mode === 'edit'
    ? <BookMetadataLookup values={values} onChange={onChange} />
    : null,

  fields: [
    { name: 'title', label: 'Title', type: 'text', required: true },
    { name: 'author', label: 'Author', type: 'text', required: true },
    { name: 'category', label: 'Reading status', type: 'select', defaultValue: 'future' },
    {
      name: 'genre',
      label: 'Category',
      type: 'select',
      options: BOOK_CATEGORY_OPTIONS,
      defaultValue: 'Uncategorized',
    },
    { name: 'description', label: 'Description', type: 'textarea', advanced: true },
    { name: 'cover_url', label: 'Cover Image URL', type: 'image', advanced: true },
    { name: 'link', label: 'Purchase/Info Link', type: 'url', advanced: true },
  ],

  renderDetail: (book) => (
    <>
      <DetailSection label="Find a copy">
        <div className="flex flex-wrap gap-4 text-sm">
          <a href={bookshopLinks(book.title, book.author).amazon} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-4 hover:text-primary/80">Search Amazon UK</a>
          <a href={bookshopLinks(book.title, book.author).waterstones} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-4 hover:text-primary/80">Search Waterstones</a>
        </div>
      </DetailSection>
      {book.cover_url?.startsWith('https://covers.openlibrary.org/') && <p className="text-xs text-muted-foreground">Cover from <a href="https://openlibrary.org" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">Open Library</a></p>}
      {book.genre && <DetailSection label="Category">{book.genre}</DetailSection>}
      {book.description && (
        <DetailSection label="Blurb">
          <p className="whitespace-pre-wrap">{book.description}</p>
        </DetailSection>
      )}
    </>
  ),
};
