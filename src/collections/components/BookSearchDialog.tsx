import { useRef, useState } from 'react';
import { BookOpen, Check, Loader2, Plus, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import { ActionButton } from '@/components/shared/ActionButton';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useGoogleBooks, type GoogleBookResult } from '@/hooks/useGoogleBooks';
import { bookshopLinks } from '@/lib/book-metadata';
import type { BookRow } from '../books';
import { BOOK_CATEGORY_OPTIONS } from '../book-categories';
import type { CollectionConfig, FormValues } from '../types';
import { EntityFormDialog } from './EntityFormDialog';

const bookKey = (title: string, author: string) => {
  const normalize = (value: string) => value.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  return `${normalize(title)}:${normalize(author)}`;
};

interface BookSearchDialogProps {
  config: CollectionConfig<BookRow>;
  books: BookRow[];
  onAdd: (values: Record<string, unknown>) => Promise<unknown>;
}

/** Google Books quick add, following the Watchlist search dialog. */
export function BookSearchDialog({ config, books, onAdd }: BookSearchDialogProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('future');
  const [genre, setGenre] = useState('Uncategorized');
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [added, setAdded] = useState<Set<string>>(new Set());
  const pendingRef = useRef(new Set<string>());
  const addedRef = useRef(new Set<string>());
  const { results, loading, error, search } = useGoogleBooks();
  const existing = new Set(books.map((book) => bookKey(book.title, book.author)));

  const changeQuery = (value: string) => {
    setQuery(value);
    search(value);
  };

  const save = async (values: FormValues) => {
    const key = bookKey(values.title, values.author);
    if (existing.has(key) || addedRef.current.has(key)) throw new Error('This book is already in your library.');
    if (pendingRef.current.has(key)) throw new Error('This book is already being added.');
    pendingRef.current.add(key);
    setPending(new Set(pendingRef.current));
    try {
      await onAdd({ ...values, genre: values.genre === 'Uncategorized' ? null : values.genre });
      addedRef.current.add(key);
      setAdded(new Set(addedRef.current));
    } finally {
      pendingRef.current.delete(key);
      setPending(new Set(pendingRef.current));
    }
  };

  const quickAdd = async (result: GoogleBookResult) => {
    const info = result.volumeInfo;
    try {
      await save({
        title: info.title,
        author: info.authors?.join(', ') || 'Unknown author',
        description: info.description ?? '',
        cover_url: info.imageLinks?.thumbnail?.replace('http:', 'https:') ?? '',
        link: bookshopLinks(info.title, info.authors?.join(', ') || '').amazon,
        category: status,
        genre,
      });
    } catch {
      toast.error('Could not add this book. It may already be in your library; otherwise try again.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => {
      setOpen(next);
      addedRef.current.clear();
      setAdded(new Set());
      if (!next) changeQuery('');
    }}>
      <DialogTrigger asChild><ActionButton icon={Plus} label="Add Book" /></DialogTrigger>
      <DialogContent className="sm:max-w-3xl p-6 max-h-[85dvh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="font-serif">Add Books</DialogTitle>
          <DialogDescription>Search book catalogues and add titles to your reading list.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="book-reading-status">Reading status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger id="book-reading-status"><SelectValue /></SelectTrigger>
              <SelectContent>{config.facets.find((facet) => facet.key === 'category')?.options.map((option) => <SelectItem key={option.key} value={option.key}>{option.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="book-subject">Category</Label>
            <Select value={genre} onValueChange={setGenre}>
              <SelectTrigger id="book-subject"><SelectValue /></SelectTrigger>
              <SelectContent>{BOOK_CATEGORY_OPTIONS.map((option) => <SelectItem key={option.key} value={option.key}>{option.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="book-search">Search by title or author</Label>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input id="book-search" value={query} onChange={(event) => changeQuery(event.target.value)} placeholder="Search by title or author..." autoComplete="off" className="h-14 text-base pl-12 pr-12" />
            {query && <Button type="button" variant="ghost" size="icon" aria-label="Clear book search" className="absolute right-2 top-1/2 -translate-y-1/2" onClick={() => changeQuery('')}><X className="h-5 w-5" /></Button>}
          </div>
        </div>
        <div className="divide-y divide-border/50 border-y border-border/50 flex-1 overflow-y-auto max-h-[45dvh] overscroll-contain pr-1" aria-live="polite" aria-busy={loading}>
          {loading ? <p className="p-12 text-center text-muted-foreground animate-pulse">Searching book catalogues...</p>
            : error ? <p role="alert" className="p-6 text-sm text-destructive">{error}</p>
            : results.length ? results.map((result) => {
              const info = result.volumeInfo;
              const author = info.authors?.join(', ') || 'Unknown author';
              const key = bookKey(info.title, author);
              const isAdded = existing.has(key) || added.has(key);
              const isPending = pending.has(key);
              return (
                <div key={result.id} className="flex items-start gap-4 py-6">
                  <div className="h-32 w-20 shrink-0 bg-secondary rounded-md overflow-hidden">
                    {info.imageLinks?.thumbnail ? <img src={info.imageLinks.thumbnail.replace('http:', 'https:')} alt="" className="h-full w-full object-contain" /> : <div className="h-full flex items-center justify-center"><BookOpen className="h-6 w-6 text-muted-foreground" /></div>}
                  </div>
                  <div className="min-w-0 flex-1 space-y-2">
                    <p className="text-lg font-semibold leading-tight break-words">{info.title}</p>
                    <p className="text-sm text-muted-foreground">{author}{info.publishedDate && ` · ${info.publishedDate.slice(0, 4)}`}</p>
                    {info.description && <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed">{info.description}</p>}
                    <Button type="button" variant="outline" size="sm" disabled={isAdded || isPending} aria-label={`${isAdded ? 'Added' : isPending ? 'Adding' : 'Add'} ${info.title}`} onClick={() => void quickAdd(result)}>
                      {isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : isAdded ? <Check className="h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                      {isPending ? 'Adding...' : isAdded ? 'Added' : 'Add'}
                    </Button>
                  </div>
                </div>
              );
            }) : <p className="p-12 text-center text-sm text-muted-foreground">{query.trim().length < 2 ? 'Enter at least two characters to search.' : 'No books found. Try another title or use Manual entry.'}</p>}
        </div>
        <EntityFormDialog mode="add" config={config} onSubmit={save} trigger={<Button type="button" variant="outline">Manual entry</Button>} />
      </DialogContent>
    </Dialog>
  );
}
