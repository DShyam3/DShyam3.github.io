import { Book } from '@/types/books';
import { BookCard } from './BookCard';

interface BookGridProps {
  books: Book[];
  onRemove: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Omit<Book, 'id' | 'created_at'>>) => void;
}

export function BookGrid({ books, onRemove, onUpdate }: BookGridProps) {
  if (books.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">No books found</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-9 2xl:grid-cols-12 gap-4 py-6">
      {books.map((book) => (
        <BookCard key={book.id} book={book} onRemove={onRemove} onUpdate={onUpdate} />
      ))}
    </div>
  );
}
