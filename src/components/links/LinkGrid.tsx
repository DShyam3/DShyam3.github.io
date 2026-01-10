import { LinkItem } from '@/types/links';
import { LinkCard } from './LinkCard';

interface LinkGridProps {
  links: LinkItem[];
  onRemove: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Omit<LinkItem, 'id' | 'createdAt'>>) => void;
}

export function LinkGrid({ links, onRemove, onUpdate }: LinkGridProps) {
  if (links.length === 0) {
    return (
      <div className="py-20 text-center">
        <p className="text-muted-foreground font-serif text-lg italic">
          No links found
        </p>
        <p className="text-sm text-muted-foreground/70 mt-2">
          Try adjusting your search or add new links
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 py-8">
      {links.map((link, index) => (
        <LinkCard
          key={link.id}
          link={link}
          onRemove={onRemove}
          onUpdate={onUpdate}
          index={index}
        />
      ))}
    </div>
  );
}
