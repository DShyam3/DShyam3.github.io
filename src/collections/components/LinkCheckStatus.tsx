import { useQuery } from '@tanstack/react-query';
import { TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ResponsivePopover } from '@/components/ui/responsive-popover';
import { supabase } from '@/integrations/supabase/client';
import { formatDayMonth } from '@/lib/format-date';
import { safeHref } from '@/lib/safe-url';
import {
  FAILING_AFTER,
  failingLinks,
  failureReason,
  lastChecked,
  overdueLinks,
  type CheckedLink,
  type LinkCheck,
} from '../link-check';

const linkChecksQuery = {
  queryKey: ['link_checks'],
  // A tab left open for days must not keep judging old results: refresh on
  // return. Staleness is judged at fetch time, not at render.
  refetchOnWindowFocus: true,
  queryFn: async (): Promise<LinkCheck[]> => {
    const { data, error } = await supabase
      .from('link_checks')
      .select('link_id, url, checked_at, check_status, check_error, check_failures, failing_since');
    if (error) throw error;
    return data;
  },
};

/**
 * The owner's view of the daily link check. Nothing while every link works
 * and the check is running; a button when links are failing, or when the
 * check itself has stopped -- silence must not be mistaken for health.
 * Render it for the owner only: `link_checks` is readable by no one else.
 */
export function LinkCheckStatus({ links }: { links: CheckedLink[] }) {
  const { data: checks, isError, isPending, dataUpdatedAt } = useQuery(linkChecksQuery);
  if (isPending) return null;

  const failing = checks ? failingLinks(links, checks) : [];
  const checked = checks ? lastChecked(checks) : null;
  const overdue = checks ? overdueLinks(links, checks, dataUpdatedAt) : [];
  const stalled = isError || overdue.length > 0;
  if (failing.length === 0 && !stalled) return null;

  const title =
    failing.length > 0
      ? `${failing.length} ${failing.length === 1 ? 'link' : 'links'} failing`
      : 'Link check stalled';
  const stallNote = isError
    ? 'The check results could not be loaded.'
    : !checked
      ? 'The check has not run yet. It runs daily at 04:40 UTC.'
      : `${overdue.length} of ${links.length} ${links.length === 1 ? 'link' : 'links'} ${overdue.length === 1 ? 'has' : 'have'} not been checked for over two days. The check runs daily, so it has stopped or is not reaching ${overdue.length === 1 ? 'it' : 'them'}.`;

  return (
    <ResponsivePopover
      title={title}
      spacing="space-y-4"
      trigger={
        <Button
          variant="outline"
          className="h-11 gap-2"
          aria-label={failing.length > 0 ? `${title} their daily check` : title}
        >
          <TriangleAlert className="h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
          {title}
        </Button>
      }
    >
      {failing.length > 0 && (
        // The whole row is the link, so it is a full touch target.
        <ul className="-mx-2 space-y-1">
          {failing.map(({ link, check }) => (
            <li key={link.id} className="min-w-0">
              <a
                href={safeHref(link.url)}
                target="_blank"
                rel="noopener noreferrer"
                className="block min-h-11 rounded-md px-2 py-1.5 transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="block break-words font-medium">{link.name}</span>
                <span className="block break-words text-sm text-muted-foreground">
                  {failureReason(check)}
                  {check.failing_since && ` · since ${formatDayMonth(check.failing_since)}`}
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
      {stalled && <p className="text-sm">{stallNote}</p>}
      <p className="text-xs text-muted-foreground">
        Every link is checked daily, and shows here after {FAILING_AFTER} failed checks in a row.
        {checked && ` Last checked ${formatDayMonth(checked)}.`}
      </p>
    </ResponsivePopover>
  );
}
