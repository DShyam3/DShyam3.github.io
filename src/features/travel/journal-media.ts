import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { readFileSignature } from '@/lib/file-signature';

export const TRAVEL_PHOTO_BUCKET = 'travel-photos';

/** Only a resized, re-encoded image leaves the browser, never the camera original or EXIF. */
export async function uploadTravelPhoto(file: File): Promise<string> {
  if (file.size > 20 * 1024 * 1024) throw new Error('Choose a photo smaller than 20 MB.');
  const signature = await readFileSignature(file, ['jpeg', 'png', 'webp']);
  if (!signature) throw new Error('Choose a JPEG, PNG or WebP image.');
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Photo processing is unavailable in this browser.');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(
      result => result ? resolve(result) : reject(new Error('Could not prepare the photo.')), 'image/jpeg', 0.86,
    ));
    const { data, error } = await supabase.functions.invoke('travel-photo', { body: blob, headers: { 'Content-Type': 'image/jpeg' } });
    if (error || !data || typeof data.path !== 'string') throw new Error('Could not upload the photo. Please try again.');
    return data.path;
  } finally {
    bitmap.close();
  }
}

export function useTravelPhoto(path: string | null) {
  const { session, isAdmin, isAuthLoading } = useAuth();
  const result = useQuery({
    queryKey: ['travel-photo', session?.user.id ?? 'public', isAdmin, path],
    enabled: !!path && !isAuthLoading,
    staleTime: 180_000,
    gcTime: 240_000,
    queryFn: async () => {
      if (!path) return undefined;
      const { data, error } = await supabase.storage.from(TRAVEL_PHOTO_BUCKET).createSignedUrl(path, 240);
      if (error) throw new Error('Photo unavailable.');
      return data.signedUrl;
    },
  });
  return { url: isAuthLoading ? undefined : result.data, loading: result.isLoading };
}
