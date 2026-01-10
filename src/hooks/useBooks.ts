import { useBooksContext } from '@/contexts/BooksContext';

export function useBooks() {
  const context = useBooksContext();
  if (!context) throw new Error('useBooks must be used within a BooksProvider');
  return context;
}
