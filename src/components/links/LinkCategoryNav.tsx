import { cn } from '@/lib/utils';
import { LinkCategory } from '@/types/links';

interface LinkCategoryNavProps {
  categories: { key: LinkCategory; label: string }[];
  activeCategory: LinkCategory;
  onCategoryChange: (category: LinkCategory) => void;
  getCategoryCount: (category: LinkCategory) => number;
}

export function LinkCategoryNav({
  categories,
  activeCategory,
  onCategoryChange,
  getCategoryCount,
}: LinkCategoryNavProps) {
  return (
    <nav className="flex flex-wrap justify-center gap-4 md:gap-8 py-6 border-b border-border/50">
      {categories.map((cat) => (
        <button
          key={cat.key}
          onClick={() => onCategoryChange(cat.key)}
          className={cn(
            'nav-link flex items-center gap-1.5',
            activeCategory === cat.key && 'nav-link-active'
          )}
        >
          <span>{cat.label}</span>
          <span className="text-xs text-muted-foreground/70">
            ({getCategoryCount(cat.key)})
          </span>
        </button>
      ))}
    </nav>
  );
}
