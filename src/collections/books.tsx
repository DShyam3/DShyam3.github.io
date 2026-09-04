import { BookOpen } from 'lucide-react';
import { DetailSection } from '@/components/cards/CardDetailDialog';
import { useGoogleBooks, type GoogleBookResult } from '@/hooks/useGoogleBooks';
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

/**
 * The categories that actually exist in the `books` table.
 *
 * Before this file there were four disagreeing definitions: types/books.ts
 * said favourite|future, useBooks' nav offered reading|completed|wishlist,
 * both dialogs offered favourite|future, and BookCard's badge assumed
 * favourite-or-not. The live data has completed, future and wishlist, so the
 * "Reading" tab matched nothing and the one `future` book was unreachable
 * from any tab but All.
 *
 * These three match the data, so nothing is hidden. `future` and `wishlist`
 * are plainly the same idea introduced twice and should be merged, but that
 * is a data migration and a naming decision, not a refactor -- see H-7 in
 * REHAUL_PLAN.md.
 */
const CATEGORIES = [
  { key: 'completed', label: 'Completed' },
  { key: 'future', label: 'To Read' },
  { key: 'wishlist', label: 'Wishlist' },
];

const labelFor = (key: string) => CATEGORIES.find((c) => c.key === key)?.label ?? key;

export const booksCollection: CollectionConfig<BookRow, GoogleBookResult> = {
  table: 'books',
  path: '/books',
  title: 'Books',
  subtitle: 'Reading list',
  noun: { singular: 'Book', plural: 'Books' },

  searchFields: ['title', 'author'],

  facets: [{ key: 'category', field: 'category', options: CATEGORIES }],

  card: {
    variant: 'media',
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
    badge: (book) => labelFor(book.category),
  },

  // Image fields take a pasted URL or an upload; uploads go to the photos
  // bucket, which avoids depending on a third-party URL staying alive.
  uploadFile: uploadPhoto,

  fields: [
    { name: 'title', label: 'Title', type: 'text', required: true },
    { name: 'author', label: 'Author', type: 'text', required: true },
    { name: 'category', label: 'Category', type: 'select', defaultValue: 'future' },
    {
      name: 'genre',
      label: 'Genre',
      type: 'text',
      placeholder: 'Fantasy, Horror, Finance...',
    },
    { name: 'description', label: 'Description', type: 'textarea' },
    { name: 'cover_url', label: 'Cover Image URL', type: 'image' },
    { name: 'link', label: 'Purchase/Info Link', type: 'url' },
  ],

  externalSearch: {
    placeholder: 'Search Google Books...',
    useSearch: useGoogleBooks,
    resultKey: (result) => result.id,
    pickedMessage: (result) => `Selected "${result.volumeInfo.title}"`,
    toValues: (result) => {
      const info = result.volumeInfo;
      return {
        title: info.title ?? '',
        author: info.authors?.join(', ') ?? '',
        description: info.description ?? '',
        cover_url: info.imageLinks?.thumbnail?.replace('http:', 'https:') ?? '',
        link: info.infoLink ?? info.previewLink ?? '',
        // Google Books returns a list; the first is usually the useful one.
        genre: info.categories?.[0] ?? '',
      };
    },
    renderResult: (result) => {
      const info = result.volumeInfo;
      return (
        <div className="flex gap-3 items-start">
          {info.imageLinks?.smallThumbnail ? (
            <img
              src={info.imageLinks.smallThumbnail.replace('http:', 'https:')}
              alt={info.title}
              className="w-8 h-12 object-cover rounded shrink-0"
            />
          ) : (
            <div className="w-8 h-12 bg-secondary/50 rounded shrink-0" />
          )}
          <div className="min-w-0">
            <p className="text-sm font-medium line-clamp-1">{info.title}</p>
            <p className="text-xs text-muted-foreground line-clamp-1">
              {info.authors?.join(', ') ?? 'Unknown author'}
              {info.publishedDate && ` · ${info.publishedDate.slice(0, 4)}`}
            </p>
          </div>
        </div>
      );
    },
  },

  renderDetail: (book) => (
    <>
      {book.genre && <DetailSection label="Genre">{book.genre}</DetailSection>}
      {book.description && (
        <DetailSection label="Blurb">
          <p className="whitespace-pre-wrap">{book.description}</p>
        </DetailSection>
      )}
    </>
  ),
};
