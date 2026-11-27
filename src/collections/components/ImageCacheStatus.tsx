import { useImageCacheWorker, type ImageJob } from '@/lib/images/image-cache';
import { useImageCachePrune } from '@/lib/images/prune';
import { cn } from '@/lib/utils';
import { imageSourcesInUse } from '../image-sources';

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
  const { remaining, idle } = useImageCacheWorker(jobs, true);
  // Once the copying is done, clear out copies no card has shown for a while.
  useImageCachePrune(imageSourcesInUse, idle);
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
