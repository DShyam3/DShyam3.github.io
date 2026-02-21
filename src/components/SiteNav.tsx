import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { DotMatrixText } from './DotMatrixText';

interface SiteNavProps {
  align?: 'start' | 'center' | 'end';
  className?: string;
}

export function SiteNav({ align = 'center', className }: SiteNavProps) {
  const location = useLocation();
  const { isAdmin } = useAuth();

  const allLinks = [
    { to: '/', label: 'About' },
    { to: '/travel', label: 'Travel' },
    { to: '/inventory', label: 'Inventory' },
    { to: '/links', label: 'Links' },
    { to: '/books', label: 'Books' },
    { to: '/articles', label: 'Articles' },
    { to: '/inspiration', label: 'Inspiration' },
    { to: '/photos', label: 'Photos' },
    { to: '/recipes', label: 'Recipes' },
    { to: '/beliefs', label: 'Beliefs', requiresAuth: true },
    { to: '/watchlist', label: 'Watchlist' },
  ];

  // Filter out links that require auth when not logged in
  const links = allLinks.filter(link => !link.requiresAuth || isAdmin);

  const justifyClass =
    align === 'start'
      ? 'justify-start'
      : align === 'end'
        ? 'justify-end'
        : 'justify-center';

  return (
    <nav className={cn('flex flex-wrap gap-4 md:gap-3 lg:gap-4 xl:gap-6 px-4', justifyClass, className)}>
      {links.map((link) => (
        <Link
          key={link.to}
          to={link.to}
          className={cn(
            'text-sm font-medium transition-colors hover:text-foreground',
            location.pathname === link.to ? 'text-foreground' : 'text-muted-foreground'
          )}
        >
          <DotMatrixText text={link.label.toUpperCase()} size="xs" className="nav-label" />
        </Link>
      ))}
    </nav>
  );
}
