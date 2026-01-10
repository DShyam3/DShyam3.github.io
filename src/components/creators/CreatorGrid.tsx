import { Creator } from '@/types/creators';
import { CreatorCard } from './CreatorCard';

interface CreatorGridProps {
  creators: Creator[];
  onRemove: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Omit<Creator, 'id' | 'created_at'>>) => void;
}

export function CreatorGrid({ creators, onRemove, onUpdate }: CreatorGridProps) {
  if (creators.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">No creators found</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 py-6">
      {creators.map((creator) => (
        <CreatorCard key={creator.id} creator={creator} onRemove={onRemove} onUpdate={onUpdate} />
      ))}
    </div>
  );
}
