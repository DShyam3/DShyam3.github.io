import { useImageCacheWorker, type ImageJob } from '@/lib/images/image-cache';
import { cn } from '@/lib/utils';

/**
 * Runs the owner's background copying of card images and says how far it has
 * got. Its own component so the count, which changes with every image, only
 * re-renders this line and not the collection's cards.
 *
 * The live region stays mounted and only its text changes, which is what a
 * screen reader announces; the count itself is hidden from it, since reading
 * out every step would drown everything else.
 */
export function ImageCacheStatus({ jobs }: { jobs: ImageJob[] }) {
  const { remaining } = useImageCacheWorker(jobs, true);
  return (
    <span
      role="status"
      className={cn('whitespace-nowrap text-xs text-muted-foreground', remaining > 0 ? 'px-2' : 'sr-only')}
    >
      {remaining > 0 && (
        <>
          Cleaning images<span aria-hidden="true"> · {remaining} left</span>
        </>
      )}
    </span>
  );
}
