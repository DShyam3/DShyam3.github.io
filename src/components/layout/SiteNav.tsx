import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { DotMatrixText } from '@/components/dot-matrix/DotMatrixText';

interface SiteNavProps {
  align?: 'start' | 'center' | 'end';
  className?: string;
}

export function SiteNav({ align = 'center', className }: SiteNavProps) {
  const location = useLocation();
  const { isAdmin } = useAuth();

  const allLinks = [
    { to: '/', label: 'About' },
    { to: '/finance', label: 'Finance', requiresAuth: true },
    { to: '/travel', label: 'Travel' },
    { to: '/inventory', label: 'Inventory' },
    { to: '/links', label: 'Links' },
    { to: '/books', label: 'Books' },
    { to: '/articles', label: 'Articles' },
    { to: '/inspiration', label: 'Inspiration' },
    { to: '/photos', label: 'Photos' },
    { to: '/recipes', label: 'Recipes' },
    { to: '/beliefs', label: 'Beliefs', requiresAuth: true },
    { to: '/thoughts', label: 'Thoughts' },
    { to: '/watchlist', label: 'Watchlist' },
  ];

  // Filter out links that require auth when not logged in
  const links = allLinks.filter((link) => !link.requiresAuth || isAdmin);

  const justifyClass =
    align === 'start'
      ? 'justify-start'
      : align === 'end'
        ? 'justify-end'
        : 'justify-center';

  return (
    <nav
      className={cn(
        // -mx-1.5 plus 6px of inline padding keeps the first item visually
        // flush with the
        // container edge while moving the overflow clip 6px further out. The
        // active link is font-bold, so its glyphs are wider, and the first
        // item was losing its leading pixels to the scroll container's edge.
        //
        // The padding is deliberately not something a caller can override:
        // cn() runs tailwind-merge, so a consumer passing px-0 silently
        // deleted it and the clipping came straight back.
        //
        // flex-nowrap at every width: wrapping put thirteen links on five
        // lines on a phone, and the nav alone was half the screen. It scrolls
        // sideways instead.
        'flex flex-nowrap gap-4 md:gap-3 lg:gap-4 xl:gap-6 -mx-1.5 overflow-x-auto scrollbar-hide py-1',
        justifyClass,
        className,
      )}
      style={{ paddingLeft: 6, paddingRight: 6 }}
    >
      {links.map((link) => (
        <Link
          key={link.to}
          to={link.to}
          className={cn(
            'nav-link relative shrink-0',
            location.pathname === link.to && 'nav-link-active'
          )}
        >
          <DotMatrixText
            text={link.label.toUpperCase()}
            size="xs"
            className="nav-label"
          />
        </Link>
      ))}
    </nav>
  );
}
