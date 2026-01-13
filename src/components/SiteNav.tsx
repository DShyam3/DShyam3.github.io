import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface SiteNavProps {
  align?: 'start' | 'center' | 'end';
  className?: string;
}

export function SiteNav({ align = 'center', className }: SiteNavProps) {
  const location = useLocation();

  const links = [
    { to: '/', label: 'About' },
    { to: '/inventory', label: 'Inventory' },
    { to: '/links', label: 'Links' },
    { to: '/books', label: 'Books' },
    { to: '/articles', label: 'Articles' },
    { to: '/inspiration', label: 'Inspiration' },
    { to: '/photos', label: 'Photos' },
    { to: '/recipes', label: 'Recipes' },
    { to: '/beliefs', label: 'Beliefs' },
    { to: '/watchlist', label: 'Watchlist' },
  ];

  const justifyClass =
    align === 'start'
      ? 'justify-start'
      : align === 'end'
        ? 'justify-end'
        : 'justify-center';

  return (
    <nav className={cn('flex flex-wrap gap-4 md:gap-6 px-4', justifyClass, className)}>
      {links.map((link) => (
        <Link
          key={link.to}
          to={link.to}
          className={cn(
            'text-sm font-medium transition-colors hover:text-foreground',
            location.pathname === link.to ? 'text-foreground' : 'text-muted-foreground'
          )}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
