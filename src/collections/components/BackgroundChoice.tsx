import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { setKeepBackground, useShownImage } from '@/lib/images/image-cache';

/**
 * The owner's way out when the cutout gets a saved picture wrong -- a white
 * product whose edges were taken for background: store it again with its
 * background kept, or removed again. In the edit form, beside the image,
 * rather than on the card, where a third button does not fit a phone's
 * half-width card.
 *
 * Shown only where there is a choice: a studio background was removed, or the
 * owner kept one. A white product the cutout declined to cut, or a logo that
 * came transparent, has nothing to toggle. The form hides it once the image
 * field is edited, since it acts on the saved picture.
 */
export function BackgroundChoice({ source }: { source: string }) {
  const queryClient = useQueryClient();
  const { image } = useShownImage(source, true);
  const [working, setWorking] = useState(false);
  if (!image?.stored || !((image.transparent && image.backdrop) || image.keepBackground)) return null;
  const keep = image.keepBackground;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
      <span role="status">
        {working
          ? 'Redoing the saved picture…'
          : keep
            ? 'The saved picture keeps its original background.'
            : 'The saved picture has its background removed, to sit on the theme.'}
      </span>
      {/* aria-disabled rather than disabled: a disabled button drops focus
          to the page for the seconds a redo takes. */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-disabled={working}
        className={working ? 'opacity-60' : undefined}
        onClick={async () => {
          if (working) return;
          setWorking(true);
          try {
            await setKeepBackground(queryClient, source, !keep);
          } catch (error) {
            toast.error(error instanceof Error ? error.message : 'The picture could not be redone.');
          } finally {
            setWorking(false);
          }
        }}
      >
        {keep ? 'Remove background' : 'Keep original background'}
      </Button>
    </div>
  );
}
