import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { BookCategoryNav } from '@/components/books/BookCategoryNav';
import { BookGrid } from '@/components/books/BookGrid';
import { AddBookDialog } from '@/components/books/AddBookDialog';
import { useBooks } from '@/hooks/useBooks';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';

const Books = () => {
  const { isAdmin } = useAuth();
  const {
    books,
    activeCategory,
    setActiveCategory,
    searchQuery,
    setSearchQuery,
    addBook,
    removeBook,
    updateBook,
    categories,
    getCategoryCount,
    loading,
  } = useBooks();

  return (
    <div className="min-h-screen bg-background">
      <div className="wide-container">
        <Header
          title="Books"
          subtitle="Reading list"
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Search books..."
        />

        <BookCategoryNav
          categories={categories}
          activeCategory={activeCategory}
          onCategoryChange={setActiveCategory}
          getCategoryCount={getCategoryCount}
        />

        <div className="flex items-center justify-between px-4 md:px-0 pt-6">
          <p className="text-sm text-muted-foreground">
            {loading ? '...' : `${books.length} ${books.length === 1 ? 'book' : 'books'}`}
          </p>
          {isAdmin && <AddBookDialog onAdd={addBook} />}
        </div>

        <div className="px-4 md:px-0">
          {loading ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-9 2xl:grid-cols-12 gap-4 py-6">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="aspect-[2/3] rounded-lg" />
              ))}
            </div>
          ) : (
            <BookGrid books={books} onRemove={isAdmin ? removeBook : undefined} onUpdate={isAdmin ? updateBook : undefined} />
          )}
        </div>

        <Footer />
      </div>
    </div>
  );
};

export default Books;
