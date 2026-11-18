import { Link } from 'react-router-dom';
import { Library, ListOrdered, Newspaper, NotebookPen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type WatchlistView = 'news' | 'library' | 'diary' | 'franchises';

const VIEWS: { view: WatchlistView; to: string; label: string; Icon: typeof Library }[] = [
  { view: 'news', to: '/watchlist', label: 'News', Icon: Newspaper },
  { view: 'library', to: '/watchlist/library', label: 'Library', Icon: Library },
  { view: 'diary', to: '/watchlist/diary', label: 'Diary', Icon: NotebookPen },
  { view: 'franchises', to: '/watchlist/franchises', label: 'Franchises', Icon: ListOrdered },
];

/** The Watchlist's views, one row of pills. The current one is filled. */
export function WatchlistNav({ current, className }: { current: WatchlistView; className?: string }) {
  return (
    <nav aria-label="Watchlist" className={cn('flex flex-wrap items-center gap-1', className)}>
      {VIEWS.map(({ view, to, label, Icon }) => (
        <Button
          key={view}
          asChild
          variant={view === current ? 'secondary' : 'ghost'}
          className="gap-2"
        >
          <Link to={to} aria-current={view === current ? 'page' : undefined}>
            <Icon className="h-4 w-4" aria-hidden="true" />
            {label}
          </Link>
        </Button>
      ))}
    </nav>
  );
}
