import { useState } from 'react';
import { Creator } from '@/types/creators';
import { Trash2, ExternalLink, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EditCreatorDialog } from './EditCreatorDialog';

interface CreatorCardProps {
  creator: Creator;
  onRemove?: (id: string) => void;
  onUpdate?: (id: string, updates: Partial<Omit<Creator, 'id' | 'created_at'>>) => void;
}

export function CreatorCard({ creator, onRemove, onUpdate }: CreatorCardProps) {
  const [showActions, setShowActions] = useState(false);

  return (
    <div
      className="item-card group relative"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className="aspect-square bg-muted relative overflow-hidden">
        {creator.image_url ? (
          <img
            src={creator.image_url}
            alt={creator.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <User className="h-12 w-12 text-muted-foreground/30" />
          </div>
        )}

        {/* Actions overlay */}
        <div
          className={`absolute top-2 right-2 flex gap-1 transition-opacity duration-200 ${showActions ? 'opacity-100' : 'opacity-0'
            }`}
        >
          {onUpdate && <EditCreatorDialog creator={creator} onUpdate={onUpdate} />}
          {onRemove && (
            <Button
              variant="secondary"
              size="icon"
              className="h-7 w-7 bg-background/80 backdrop-blur-sm"
              onClick={() => onRemove(creator.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>

        {/* Category badge */}
        <div className="absolute top-2 left-2">
          <span className="text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded bg-background/80 backdrop-blur-sm text-foreground">
            {creator.category === 'painter' ? '🎨' : creator.category === 'photographer' ? '📷' : '🖼️'}
          </span>
        </div>
      </div>

      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            {creator.link ? (
              <a
                href={creator.link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium line-clamp-1 hover:text-accent transition-colors flex items-center gap-1"
              >
                {creator.name}
                <ExternalLink className="h-3 w-3 flex-shrink-0" />
              </a>
            ) : (
              <h3 className="text-sm font-medium line-clamp-1">{creator.name}</h3>
            )}
            <p className="text-xs text-muted-foreground capitalize">{creator.category}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
