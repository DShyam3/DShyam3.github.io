import { cn } from '@/lib/utils';
import { BookCategory } from '@/types/books';
import { DotMatrixText } from '../DotMatrixText';

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
    <nav className="flex flex-wrap items-center justify-center gap-2 md:gap-4 py-4 px-4 border-b border-border/50">
      {categories.map((category, index) => (
        <div key={category.key} className="flex items-center gap-2 md:gap-4">
          <button
            onClick={() => onCategoryChange(category.key)}
            className={cn(
              'nav-link relative py-1',
              activeCategory === category.key && 'nav-link-active'
            )}
          >
            <DotMatrixText text={category.label.toUpperCase()} size="xs" />
            <span className="ml-1.5 text-xs text-muted-foreground/60">
              ({getCategoryCount(category.key)})
            </span>
            {activeCategory === category.key && (
              <span className="absolute -bottom-1 left-0 right-0 h-px bg-foreground" />
            )}
          </button>
          {index < categories.length - 1 && (
            <span className="text-muted-foreground/30 hidden md:inline">·</span>
          )}
        </div>
      ))}
    </nav>
  );
}
