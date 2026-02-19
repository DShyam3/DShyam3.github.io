import { Category } from '@/types/inventory';
import { cn } from '@/lib/utils';
import { DotMatrixText } from './DotMatrixText';

interface CategoryNavProps {
  categories: { key: Category; label: string }[];
  activeCategory: Category;
  onCategoryChange: (category: Category) => void;
  getCategoryCount: (category: Category) => number;
}

export function CategoryNav({
  categories,
  activeCategory,
  onCategoryChange,
  getCategoryCount,
}: CategoryNavProps) {
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
