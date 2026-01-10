import { cn } from '@/lib/utils';
import { BookCategory } from '@/types/books';

interface BookCategoryNavProps {
  categories: { key: BookCategory; label: string }[];
  activeCategory: BookCategory;
  onCategoryChange: (category: BookCategory) => void;
  getCategoryCount: (category: BookCategory) => number;
}

export function BookCategoryNav({
  categories,
  activeCategory,
  onCategoryChange,
  getCategoryCount,
}: BookCategoryNavProps) {
  return (
    <nav className="flex justify-center gap-2 flex-wrap px-4 md:px-0 mt-4 mb-4">
      {categories.map((category) => (
        <button
          key={category.key}
          onClick={() => onCategoryChange(category.key)}
          className={cn(
            'px-4 py-2 text-sm font-medium rounded-full transition-all duration-200',
            activeCategory === category.key
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          )}
        >
          {category.label}
          <span className="ml-1.5 text-xs opacity-60">
            {getCategoryCount(category.key)}
          </span>
        </button>
      ))}
    </nav>
  );
}
