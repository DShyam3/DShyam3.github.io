import { supabase } from '@/integrations/supabase/client';
import { asTypedBlob, readFileSignature } from '@/lib/file-signature';

const PHOTOS_BUCKET = 'photos';
const DOCUMENTS_BUCKET = 'documents';

/**
 * Upload an image to Supabase Storage and return the public URL.
 *
 * The type comes from the file's own first bytes, not its name or the
 * browser's guess, and sets both the stored content type and the extension.
 * The name is a random UUID, so it neither collides nor carries anything from
 * the uploader's file name.
 */
export async function uploadPhoto(file: File): Promise<string> {
  const signature = await readFileSignature(file, ['jpeg', 'png', 'gif', 'webp', 'heic']);
  if (!signature) throw new Error('That file is not a JPEG, PNG, GIF, WebP or HEIC image.');
  const fileName = `${crypto.randomUUID()}.${signature.ext}`;

  const { error } = await supabase.storage
    .from(PHOTOS_BUCKET)
    .upload(fileName, asTypedBlob(file, signature), {
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
 * Upload a document (like a CV) to Supabase Storage and return the public URL.
 * Overwrites if the file already exists (useful for keeping the same CV URL).
 */
export async function uploadDocument(file: File, fileName: string = 'cv.pdf'): Promise<string> {
  const signature = await readFileSignature(file, ['pdf']);
  if (!signature) throw new Error('That file is not a PDF.');

  const { error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .upload(fileName, asTypedBlob(file, signature), {
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
