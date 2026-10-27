import { useEffect, useId, useRef, useState } from 'react';
import { BookOpen, Loader2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useGoogleBooks, type GoogleBookResult } from '@/hooks/useGoogleBooks';
import { bookshopLinks, completeBookMetadata } from '@/lib/book-metadata';
import { safeHref } from '@/lib/safe-url';
import type { FormValues } from '../types';

/** Preview a matching edition before filling empty metadata in the editor. */
export function BookMetadataLookup({ values, onChange }: {
  values: FormValues;
  onChange: (values: FormValues) => void;
}) {
  const id = useId();
  const [query, setQuery] = useState('');
  const [started, setStarted] = useState(false);
  const [picked, setPicked] = useState(false);
  const [pending, setPending] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const currentValues = useRef(values);
  const request = useRef<AbortController | null>(null);
  useEffect(() => { currentValues.current = values; }, [values]);
  useEffect(() => () => request.current?.abort(), []);
  const { results, loading, error, search } = useGoogleBooks();
  const currentCover = safeHref(values.cover_url);

  const find = () => {
    const term = started ? query : [values.title, values.author].filter(Boolean).join(' ');
    setQuery(term);
    setStarted(true);
    setPicked(false);
    search(term);
  };

  const fillMissing = async (result: GoogleBookResult) => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    const requestedTitle = values.title;
    const requestedAuthor = values.author;
    setPending(true);
    setLookupError('');
    try {
      const completed = await completeBookMetadata(result, controller.signal);
      if (controller.signal.aborted) return;
      const info = completed.volumeInfo;
      const latest = currentValues.current;
      if (latest.title !== requestedTitle || latest.author !== requestedAuthor) {
        setLookupError('The title or author changed. Search again for the updated book.');
        return;
      }
      const cover = safeHref(info.imageLinks?.thumbnail?.replace(/^http:/, 'https:'));
      const updates: FormValues = {};
      if (!latest.description?.trim() && info.description) updates.description = info.description;
      if (!latest.cover_url?.trim() && cover) updates.cover_url = cover;
      if (!latest.link?.trim()) updates.link = bookshopLinks(latest.title, latest.author).amazon;
      onChange(updates);
      setPicked(true);
    } catch {
      if (!controller.signal.aborted) setLookupError('Could not load these details. Try again or enter them manually below.');
    } finally {
      if (!controller.signal.aborted) setPending(false);
    }
  };

  return (
    <div className="space-y-3 rounded-lg border bg-secondary/20 p-4">
      <div className="flex items-start gap-4">
        {currentCover && <img src={currentCover} alt="Current book cover" className="h-24 w-16 shrink-0 rounded object-contain" />}
        <div className="min-w-0 space-y-2">
          <p className="text-sm font-medium">Find cover & details</p>
          <p className="text-xs text-muted-foreground">Choose a matching edition to fill missing artwork, description and purchase link. Existing details stay as entered. You can also edit them manually below.</p>
          {!started && <Button type="button" variant="outline" size="sm" onClick={find} disabled={!values.title?.trim()}><Search className="mr-2 h-4 w-4" />Find details</Button>}
        </div>
      </div>
      {started && !picked && <>
        <Label htmlFor={id}>Search by title and author</Label>
        <div className="flex gap-2">
          <Input id={id} value={query} onChange={(event) => { setQuery(event.target.value); search(''); setPicked(false); }} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); find(); } }} />
          <Button type="button" variant="outline" onClick={find} disabled={pending || loading || query.trim().length < 2}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}Search
          </Button>
        </div>
        <div className="space-y-3" aria-live="polite" aria-busy={loading}>
          {lookupError && <p role="alert" className="text-sm text-destructive">{lookupError}</p>}
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          {loading && <p className="text-sm text-muted-foreground">Finding matching editions…</p>}
          {!loading && results.slice(0, 5).map((result) => {
            const info = result.volumeInfo;
            const cover = safeHref(info.imageLinks?.thumbnail?.replace(/^http:/, 'https:'));
            return (
              <div key={result.id} className="flex items-start gap-4 border-t pt-3">
                <div className="flex h-24 w-16 shrink-0 items-center justify-center rounded bg-secondary">
                  {cover ? <img src={cover} alt="" className="h-full w-full object-contain" /> : <BookOpen className="h-6 w-6 text-muted-foreground" />}
                </div>
                <div className="min-w-0 space-y-2">
                  <p className="text-sm font-semibold">{info.title}</p>
                  <p className="text-xs text-muted-foreground">{[info.authors?.join(', '), info.publisher, info.publishedDate?.slice(0, 4), result.source === 'openlibrary' ? 'Open Library' : 'Google Books'].filter(Boolean).join(' · ')}</p>
                  {info.description && <p className="line-clamp-3 text-xs text-muted-foreground">{info.description}</p>}
                  <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => void fillMissing(result)}>{pending ? 'Loading details…' : 'Use missing details'}</Button>
                </div>
              </div>
            );
          })}
          {!loading && !error && results.length === 0 && <p className="text-sm text-muted-foreground">Search for a matching edition, or enter the details manually below.</p>}
        </div>
      </>}
      {picked && <div className="space-y-2">
        <p role="status" className="text-sm text-muted-foreground">Missing details filled. Review the fields below, then choose Save Changes to apply them. The purchase link searches Amazon UK.</p>
        <Button type="button" variant="outline" size="sm" onClick={() => setPicked(false)}>Search again</Button>
      </div>}
    </div>
  );
}
