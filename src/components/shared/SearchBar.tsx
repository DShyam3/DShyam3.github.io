import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SearchBarProps {
  query: string;
  onChange: (query: string) => void;
  placeholder?: string;
  className?: string;
}

export function SearchBar({
  query,
  onChange,
  placeholder = 'Search...',
  className,
}: SearchBarProps) {
  return (
    <div className={cn('relative w-full', className)}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
      <Input
        type="text"
        placeholder={placeholder}
        value={query}
        onChange={(e) => onChange(e.target.value)}
        className="pl-10 pr-10 bg-secondary/30 md:bg-secondary/50 border-transparent focus:border-border focus:bg-card transition-[border-color,background-color] duration-200 h-9 text-sm"
      />
      {query && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 hover:bg-transparent"
          onClick={() => onChange('')}
        >
          <X className="w-4 h-4 text-muted-foreground" />
        </Button>
      )}
    </div>
  );
}
