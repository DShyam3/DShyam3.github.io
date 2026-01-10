export type BookCategory = 'all' | 'favourite' | 'future';

export interface Book {
  id: string;
  title: string;
  author: string;
  cover_url?: string;
  description?: string;
  link?: string;
  category: Exclude<BookCategory, 'all'>;
  created_at: Date;
}
