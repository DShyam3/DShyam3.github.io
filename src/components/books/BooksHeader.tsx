import { ThemeToggle } from '@/components/ThemeToggle';
import { SiteNav } from '@/components/SiteNav';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

interface BooksHeaderProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
}

export function BooksHeader({ searchQuery, onSearchChange }: BooksHeaderProps) {
  return (
    <header className="py-8 md:py-12">
      <div className="flex items-center justify-end mb-6 px-4 md:px-0">
        <ThemeToggle />
      </div>
      
      <SiteNav />
      
      <div className="text-center mb-8 px-4 md:px-0">
        <h1 className="inventory-title mb-2">Books</h1>
        <p className="inventory-subtitle">My reading list and favourites</p>
      </div>

      <div className="relative max-w-md mx-auto px-4 md:px-0">
        <Search className="absolute left-7 md:left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search books..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 bg-card border-border/50"
        />
      </div>
    </header>
  );
}
