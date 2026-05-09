import { supabase } from '@/integrations/supabase/client';

const PHOTOS_BUCKET = 'photos';
const DOCUMENTS_BUCKET = 'documents';

/**
 * Upload a file to Supabase Storage and return the public URL.
 * Files are stored with a unique timestamp + random suffix to avoid collisions.
 */
export async function uploadPhoto(file: File): Promise<string> {
  const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;

  const { error } = await supabase.storage
    .from(PHOTOS_BUCKET)
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (error) throw error;

  const { data: urlData } = supabase.storage
    .from(PHOTOS_BUCKET)
    .getPublicUrl(fileName);

  return urlData.publicUrl;
}

/**
 * Delete a photo from Supabase Storage by its public URL.
 * Extracts the file path from the URL automatically.
 */
export async function deletePhotoFromStorage(publicUrl: string): Promise<void> {
  // Extract the file path from the public URL
  // URL format: https://<project>.supabase.co/storage/v1/object/public/photos/<filename>
  const match = publicUrl.match(/\/storage\/v1\/object\/public\/photos\/(.+)$/);
  if (!match) return; // Not a storage URL, skip deletion

  const filePath = decodeURIComponent(match[1]);

  const { error } = await supabase.storage
    .from(PHOTOS_BUCKET)
    .remove([filePath]);

  if (error) {
    console.warn('Failed to delete photo from storage:', error.message);
  }
}

/**
 * Upload a document (like a CV) to Supabase Storage and return the public URL.
 * Overwrites if the file already exists (useful for keeping the same CV URL).
 */
export async function uploadDocument(file: File, fileName: string = 'cv.pdf'): Promise<string> {
  const { error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: true,
    });

  if (error) throw error;

  const { data: urlData } = supabase.storage
    .from(DOCUMENTS_BUCKET)
    .getPublicUrl(fileName);

  // Add a cache buster so the browser fetches the new CV if upserted
  return `${urlData.publicUrl}?t=${Date.now()}`;
}
