import { useState, useMemo } from 'react';
import { Book, BookCategory } from '@/types/books';
import { useSupabaseTable } from './useSupabaseTable';

export function useBooks() {
  const { data: books, loading, addItem, removeItem, updateItem } = useSupabaseTable<Book>('books');
  const [activeCategory, setActiveCategory] = useState<BookCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredBooks = useMemo(() => {
    let filtered = books;
    if (activeCategory !== 'all') {
      filtered = filtered.filter((b) => b.category === activeCategory);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (b) =>
          b.title.toLowerCase().includes(q) ||
          b.author.toLowerCase().includes(q),
      );
    }
    return filtered;
  }, [books, activeCategory, searchQuery]);

  const categories: { key: BookCategory; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'reading', label: 'Reading' },
    { key: 'completed', label: 'Completed' },
    { key: 'wishlist', label: 'To Read' },
  ];

  const getCategoryCount = (category: BookCategory) =>
    category === 'all'
      ? books.length
      : books.filter((b) => b.category === category).length;

  return {
    books: filteredBooks,
    allBooks: books,
    activeCategory,
    setActiveCategory,
    searchQuery,
    setSearchQuery,
    addBook: addItem,
    removeBook: removeItem,
    updateBook: (id: string, updates: Partial<Book>) => updateItem({ id, updates }),
    categories,
    getCategoryCount,
    loading,
  };
}
