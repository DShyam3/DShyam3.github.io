import { Category } from '@/types/inventory';
import { cn } from '@/lib/utils';
import { DotMatrixText } from './DotMatrixText';
import { SearchBar } from './SearchBar';

interface CategoryNavProps {
  categories: { key: Category; label: string }[];
  activeCategory: Category;
  onCategoryChange: (category: Category) => void;
  getCategoryCount: (category: Category) => number;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
}

export function CategoryNav({
  categories,
  activeCategory,
  onCategoryChange,
  getCategoryCount,
  searchQuery,
  onSearchChange,
}: CategoryNavProps) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-border/50 px-4 md:px-0 gap-4">
      <nav className="flex flex-nowrap items-center justify-start md:justify-start gap-2 md:gap-4 py-4 overflow-x-auto scrollbar-hide flex-1">
        {categories.map((category, index) => (
          <div key={category.key} className="flex items-center gap-2 md:gap-4">
            <button
              onClick={() => onCategoryChange(category.key)}
              className={cn(
                'nav-link relative py-1',
                activeCategory === category.key && 'nav-link-active',
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

      {onSearchChange && (
        <div className="w-full md:w-[200px] lg:w-[260px] pb-4 md:pb-0">
          <SearchBar
            query={searchQuery || ''}
            onChange={onSearchChange}
            placeholder="Search category..."
          />
        </div>
      )}
    </div>
  );
}
