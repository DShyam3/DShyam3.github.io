import type { ReactNode } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/**
 * A number that knows it might not have arrived yet.
 *
 * Since 7.3b removed the localStorage cache, finance state starts at its
 * defaults, so anything rendered before the first fetch shows £0.00 and then
 * snaps to the real value — which reads as the page being wrong rather than
 * slow. This renders a skeleton of roughly the figure's width instead, so the
 * layout does not move when the number lands.
 */
export function Figure({
  loading,
  className,
  skeletonClassName,
  children,
}: {
  loading?: boolean;
  className?: string;
  skeletonClassName?: string;
  children: ReactNode;
}) {
  if (loading) {
    return <Skeleton className={cn('inline-block h-6 w-28 rounded-sm align-middle', skeletonClassName)} />;
  }
  return <span className={className}>{children}</span>;
}
