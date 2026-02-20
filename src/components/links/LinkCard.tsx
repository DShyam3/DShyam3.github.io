import { useState } from 'react';
import { LinkItem } from '@/types/links';
import { X, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { EditLinkDialog } from './EditLinkDialog';
import { CardDetailDialog, DetailSection } from '@/components/cards/CardDetailDialog';

interface LinkCardProps {
  link: LinkItem;
  onRemove?: (id: string) => void;
  onUpdate?: (id: string, updates: Partial<Omit<LinkItem, 'id' | 'createdAt'>>) => void;
  index: number;
}

const categoryLabels: Record<string, string> = {
  websites: 'Websites',
  'iphone-apps': 'iPhone Apps',
  'ipad-apps': 'iPad Apps',
  'mac-apps': 'Mac Apps',
  'dev-setup': 'Dev Setup',
};

export function LinkCard({ link, onRemove, onUpdate, index }: LinkCardProps) {
  const [detailOpen, setDetailOpen] = useState(false);

  const handleDelete = () => {
    onRemove(link.id);
    setDetailOpen(false);
  };

  return (
    <>
      <article
        className={cn(
          'group relative bg-card rounded-lg p-5 opacity-0 animate-fade-in transition-all duration-300 hover:shadow-md border border-border/50 cursor-pointer'
        )}
        style={{ animationDelay: `${index * 50}ms` }}
        onClick={() => setDetailOpen(true)}
      >
        {/* Action buttons */}
        <div className="absolute top-3 right-3 flex gap-1" onClick={(e) => e.stopPropagation()}>
          {onUpdate && <EditLinkDialog link={link} onUpdate={onUpdate} />}
          {onRemove && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onRemove(link.id)}
              className="opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 hover:bg-destructive hover:text-destructive-foreground w-8 h-8"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>

        <div className="flex gap-4 items-start">
          {/* Icon */}
          <div className="w-14 h-14 rounded-lg bg-secondary/50 overflow-hidden flex-shrink-0 flex items-center justify-center">
            {link.icon ? (
              <img
                src={link.icon}
                alt={link.name}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            ) : (
              <ExternalLink className="w-6 h-6 text-muted-foreground" />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 pr-16">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-serif text-base font-medium leading-tight group-hover:text-primary transition-colors">
                {link.name}
              </h3>
              <ExternalLink className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
            </div>
            <span className="inline-block text-[10px] font-medium uppercase tracking-wider text-muted-foreground bg-secondary/50 px-2 py-0.5 rounded mb-2">
              {categoryLabels[link.category] || link.category}
            </span>
            <p className="text-sm text-muted-foreground line-clamp-2">
              {link.description}
            </p>
          </div>
        </div>
      </article>

      <CardDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        title={link.name}
        subtitle={categoryLabels[link.category] || link.category}
        imageUrl={link.icon}
        link={link.url}
        onDelete={onRemove ? handleDelete : undefined}
      >
        {link.description && (
          <DetailSection label="Description">
            <p className="whitespace-pre-wrap">{link.description}</p>
          </DetailSection>
        )}
        <DetailSection label="URL">
          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline break-all"
          >
            {link.url}
          </a>
        </DetailSection>
      </CardDetailDialog>
    </>
  );
}
