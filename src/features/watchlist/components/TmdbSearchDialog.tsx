import type { ReactNode } from 'react';
import { Plus, Search, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { TMDBResult } from '@/features/watchlist/useTMDB';

interface TmdbSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Label on the button that opens the dialog. */
  triggerLabel: string;
  title: string;
  /** Screen-reader description of what the dialog does. */
  description: string;
  searchLabel: string;
  placeholder: string;
  query: string;
  onQueryChange: (value: string) => void;
  results: TMDBResult[];
  loading: boolean;
  /** Stable key per result -- favourites key on media type too. */
  resultKey: (result: TMDBResult) => string;
  onSelect: (result: TMDBResult) => void;
  /** Greys the row out and blocks clicks, e.g. while adding or once added. */
  isDisabled?: (result: TMDBResult) => boolean;
  /** Right-hand status area: media-type tags, "Adding...", "Added". */
  renderStatus?: (result: TMDBResult) => ReactNode;
  /** Hides the result list entirely, e.g. for categories with no search. */
  searchDisabled?: boolean;
  getPosterUrl: (path: string) => string | null;
}

const yearOf = (result: TMDBResult) => {
  const date = result.release_date || result.first_air_date;
  return date ? new Date(date).getFullYear() : 'N/A';
};

/**
 * The TMDB lookup dialog, shared by "Add to Watchlist" and "Add to Favourites".
 *
 * Both were written out separately in WatchlistPage -- roughly 340 lines of
 * near-identical markup differing only in what a click does and what appears
 * on the right of each row. Those are the two props that vary.
 */
export function TmdbSearchDialog({
  open,
  onOpenChange,
  triggerLabel,
  title,
  description,
  searchLabel,
  placeholder,
  query,
  onQueryChange,
  results,
  loading,
  resultKey,
  onSelect,
  isDisabled,
  renderStatus,
  searchDisabled,
  getPosterUrl,
}: TmdbSearchDialogProps) {
  const showResults =
    !searchDisabled && query.length >= 2 && (results.length > 0 || loading);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          {triggerLabel}
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-3xl h-[600px] max-h-[90vh] flex flex-col p-0">
        <div className="p-6 pb-0">
          <DialogHeader>
            <DialogTitle className="font-serif">{title}</DialogTitle>
            <DialogDescription className="sr-only">{description}</DialogDescription>
          </DialogHeader>
        </div>

        <div className="flex-1 flex flex-col min-h-0 p-6 pt-4">
          <div className="space-y-2 flex-shrink-0 mb-2">
            <Label htmlFor="tmdb-search">{searchLabel} *</Label>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                id="tmdb-search"
                value={query}
                onChange={(e) => onQueryChange(e.target.value)}
                required
                placeholder={placeholder}
                autoComplete="off"
                className="h-14 text-base pl-12 pr-12"
              />
              {query && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 hover:bg-transparent"
                  onClick={() => onQueryChange('')}
                >
                  <X className="w-5 h-5 text-muted-foreground" />
                </Button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto min-h-0 mt-4 -mx-6 px-6 border-t border-b border-border/50 bg-secondary/5">
            {showResults ? (
              <div className="divide-y divide-border/50">
                {loading ? (
                  <div className="p-12 text-base text-muted-foreground text-center animate-pulse">
                    Searching TMDB...
                  </div>
                ) : (
                  results.map((result) => (
                    <div
                      key={resultKey(result)}
                      className={cn(
                        'flex items-start gap-5 py-6 hover:bg-secondary/40 cursor-pointer transition-[background-color] duration-200 -mx-6 px-6',
                        isDisabled?.(result) && 'pointer-events-none opacity-60',
                      )}
                      onClick={(e) => {
                        e.preventDefault();
                        if (isDisabled?.(result)) return;
                        onSelect(result);
                      }}
                    >
                      <div className="h-32 w-20 flex-shrink-0 bg-secondary rounded-md overflow-hidden shadow-md">
                        {result.poster_path ? (
                          <img
                            src={getPosterUrl(result.poster_path) || ''}
                            alt={result.title || result.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-[10px] text-muted-foreground p-2 text-center bg-muted">
                            No Poster
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col min-w-0 py-1 flex-1">
                        <div className="flex items-baseline justify-between gap-2 mb-1">
                          <div className="flex items-baseline gap-2">
                            <span className="text-lg font-semibold truncate leading-tight tracking-tight">
                              {result.title || result.name}
                            </span>
                            <span className="text-sm text-muted-foreground whitespace-nowrap">
                              ({yearOf(result)})
                            </span>
                          </div>
                          {renderStatus?.(result)}
                        </div>
                        {result.overview && (
                          <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed">
                            {result.overview}
                          </p>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm p-12 text-center">
                {query.length < 2
                  ? 'Start typing to see recommendations...'
                  : 'No recommendations found'}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
