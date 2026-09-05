import { useAuth } from '@/contexts/AuthContext';

export interface SiteNavLink {
  to: string;
  label: string;
  requiresAuth?: boolean;
}

const ALL_LINKS: SiteNavLink[] = [
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

/** The site's destinations, minus the ones this visitor cannot open. */
export function useSiteNavLinks(): SiteNavLink[] {
  const { isAdmin } = useAuth();
  return ALL_LINKS.filter((link) => !link.requiresAuth || isAdmin);
}
