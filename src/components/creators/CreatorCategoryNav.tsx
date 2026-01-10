import { cn } from '@/lib/utils';
import { CreatorCategory } from '@/types/creators';

interface CreatorCategoryNavProps {
  categories: { key: CreatorCategory; label: string }[];
  activeCategory: CreatorCategory;
  onCategoryChange: (category: CreatorCategory) => void;
  getCategoryCount: (category: CreatorCategory) => number;
}

export function CreatorCategoryNav({
  categories,
  activeCategory,
  onCategoryChange,
  getCategoryCount,
}: CreatorCategoryNavProps) {
  return (
    <nav className="flex justify-center gap-2 flex-wrap px-4 md:px-0">
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
