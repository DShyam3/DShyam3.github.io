import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { AppIcon } from '@/components/ui/icon';
import {
  SFBookClosedFill,
  SFBooksVerticalFill,
  SFHeart,
  SFHeartFill,
  SFListNumber,
  SFNewspaperFill,
  SFSparkles,
  type SFSymbolComponent,
} from '@/components/ui/sf-symbols';
import { DotMatrixText } from '@/components/dot-matrix/DotMatrixText';
import { SPRING_PILL } from '@/theme/motion';
import { cn } from '@/lib/utils';

export type WatchlistView = 'news' | 'library' | 'favourites' | 'diary' | 'franchises' | 'facts';

const VIEWS: { view: WatchlistView; to: string; label: string; Icon: SFSymbolComponent }[] = [
  { view: 'news', to: '/watchlist', label: 'News', Icon: SFNewspaperFill },
  { view: 'library', to: '/watchlist/library', label: 'Library', Icon: SFBooksVerticalFill },
  { view: 'favourites', to: '/watchlist/favourites', label: 'Favourites', Icon: SFHeartFill },
  { view: 'diary', to: '/watchlist/diary', label: 'Diary', Icon: SFBookClosedFill },
  { view: 'franchises', to: '/watchlist/franchises', label: 'Franchises', Icon: SFListNumber },
  { view: 'facts', to: '/watchlist/facts', label: 'Cool facts', Icon: SFSparkles },
];

/** The Watchlist's views, one row of pills. The current one glides with a shared-layout pill. */
export function WatchlistNav({ current, className }: { current: WatchlistView; className?: string }) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <nav aria-label="Watchlist" className={cn('flex flex-wrap items-center gap-1', className)}>
      {VIEWS.map(({ view, to, label, Icon }) => {
        const active = view === current;
        const ResolvedIcon = view === 'favourites' && !active ? SFHeart : Icon;
        return (
          <Button
            key={view}
            asChild
            variant={active && prefersReducedMotion ? 'secondary' : 'ghost'}
            className={cn('relative isolate gap-2', active && 'text-secondary-foreground')}
          >
            <Link to={to} aria-current={active ? 'page' : undefined}>
              {active && !prefersReducedMotion ? (
                <motion.span
                  layoutId="watchlist-nav-pill"
                  transition={SPRING_PILL}
                  aria-hidden="true"
                  className="absolute inset-0 -z-10 rounded-full bg-secondary border border-border/60"
                />
              ) : null}
              <AppIcon
                icon={ResolvedIcon}
                active={active}
                className="h-4 w-4"
              />
              <DotMatrixText text={label} size="ui" wrap={false} />
            </Link>
          </Button>
        );
      })}
    </nav>
  );
}
