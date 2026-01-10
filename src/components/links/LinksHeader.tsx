import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ThemeToggle } from '../ThemeToggle';
import { SiteNav } from '../SiteNav';

interface LinksHeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export function LinksHeader({ searchQuery, onSearchChange }: LinksHeaderProps) {
  return (
    <header className="pt-12 pb-8 md:pt-16 md:pb-10 text-center relative">
      <div className="absolute top-4 right-4 md:top-8 md:right-0">
        <ThemeToggle />
      </div>
      
      <SiteNav />
      
      <h1 className="inventory-title mb-2">The Links</h1>
      <p className="inventory-subtitle">Apps & Sites I Love</p>
      
      <div className="mt-8 max-w-xs mx-auto relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search links..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10 bg-secondary/50 border-transparent focus:border-border focus:bg-card transition-all"
        />
      </div>
    </header>
  );
}
