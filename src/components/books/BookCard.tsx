import { useState } from 'react';
import { Book } from '@/types/books';
import { Trash2, ExternalLink, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EditBookDialog } from './EditBookDialog';
import { CardDetailDialog, DetailSection } from '@/components/cards/CardDetailDialog';

interface BookCardProps {
  book: Book;
  onRemove?: (id: string) => void;
  onUpdate?: (id: string, updates: Partial<Omit<Book, 'id' | 'created_at'>>) => void;
}

export function BookCard({ book, onRemove, onUpdate }: BookCardProps) {
  const [showActions, setShowActions] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);

  const handleDelete = () => {
    onRemove(book.id);
    setDetailOpen(false);
  };

  return (
    <>
      <div
        className="item-card group relative cursor-pointer"
        onMouseEnter={() => setShowActions(true)}
        onMouseLeave={() => setShowActions(false)}
        onClick={() => setDetailOpen(true)}
      >
        <div className="aspect-[2/3] bg-muted relative overflow-hidden">
          {book.cover_url ? (
            <img
              src={book.cover_url}
              alt={book.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <BookOpen className="h-12 w-12 text-muted-foreground/30" />
            </div>
          )}

          {/* Actions overlay */}
          <div
            className={`absolute top-2 right-2 flex gap-1 transition-opacity duration-200 ${showActions ? 'opacity-100' : 'opacity-0'
              }`}
            onClick={(e) => e.stopPropagation()}
          >
            {onUpdate && <EditBookDialog book={book} onUpdate={onUpdate} />}
            {onRemove && (
              <Button
                variant="secondary"
                size="icon"
                className="h-8 w-8 bg-background/80 backdrop-blur-sm"
                onClick={() => onRemove(book.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>

        </div>

        <div className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-medium line-clamp-2">{book.title}</h3>
              <p className="text-xs text-muted-foreground line-clamp-1 mt-1">{book.author}</p>
            </div>
          </div>
          {book.description && (
            <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{book.description}</p>
          )}
        </div>
      </div>

      <CardDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        title={book.title}
        subtitle={`by ${book.author}`}
        imageUrl={book.cover_url}
        link={book.link}
        badge={book.category === 'favourite' ? 'Favourite' : 'To Read'}
        onDelete={onRemove ? handleDelete : undefined}
      >
        {book.description && (
          <DetailSection label="Description">
            <p className="whitespace-pre-wrap">{book.description}</p>
          </DetailSection>
        )}
      </CardDetailDialog>
    </>
  );
}
