import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { readFileSignature } from '@/lib/file-signature';

export const TRAVEL_PHOTO_BUCKET = 'travel-photos';
const SIGNED_URL_TTL_SECONDS = 240;
const PHOTO_STALE_MS = 180_000;
const PHOTO_GC_MS = 240_000;

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
    staleTime: PHOTO_STALE_MS,
    gcTime: PHOTO_GC_MS,
    queryFn: async () => {
      if (!path) return undefined;
      const { data, error } = await supabase.storage.from(TRAVEL_PHOTO_BUCKET).createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
      if (error) throw new Error('Photo unavailable.');
      return data.signedUrl;
    },
  });
  return { url: isAuthLoading ? undefined : result.data, loading: result.isLoading };
}

/**
 * Batch-signs all visible travel photo paths in a single Storage request
 * (replacing N per-tile `createSignedUrl` calls) and populates the individual
 * `['travel-photo', ...]` cache entries so dialogs reuse the same signed URLs.
 */
export function useTravelPhotos(paths: readonly (string | null | undefined)[]) {
  const { session, isAdmin, isAuthLoading } = useAuth();
  const queryClient = useQueryClient();
  const userScope = session?.user.id ?? 'public';

  const uniquePaths = useMemo(
    () => [...new Set(paths.filter((p): p is string => Boolean(p)))].sort(),
    [paths],
  );
  const pathsKey = uniquePaths.join('\0');

  const result = useQuery<ReadonlyMap<string, string>>({
    queryKey: ['travel-photo-batch', userScope, isAdmin, pathsKey],
    enabled: uniquePaths.length > 0 && !isAuthLoading,
    staleTime: PHOTO_STALE_MS,
    gcTime: PHOTO_GC_MS,
    queryFn: async () => {
      const urls = new Map<string, string>();
      const missing: string[] = [];
      const now = Date.now();

      for (const path of uniquePaths) {
        const key = ['travel-photo', userScope, isAdmin, path];
        const state = queryClient.getQueryState<string | undefined>(key);
        if (state?.data && now - state.dataUpdatedAt < PHOTO_STALE_MS) {
          urls.set(path, state.data);
        } else {
          missing.push(path);
        }
      }

      if (missing.length > 0) {
        const { data, error } = await supabase.storage
          .from(TRAVEL_PHOTO_BUCKET)
          .createSignedUrls(missing, SIGNED_URL_TTL_SECONDS);
        if (error) throw new Error('Photos unavailable.');
        for (const entry of data ?? []) {
          if (entry.path && entry.signedUrl) {
            urls.set(entry.path, entry.signedUrl);
            queryClient.setQueryData(['travel-photo', userScope, isAdmin, entry.path], entry.signedUrl);
          }
        }
      }

      return urls;
    },
  });

  return {
    urls: isAuthLoading ? undefined : result.data,
    loading: isAuthLoading || result.isLoading,
  };
}
