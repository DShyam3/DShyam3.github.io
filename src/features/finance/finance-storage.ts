/**
 * The only path to the finance-documents bucket.
 *
 * One module rather than scattered `supabase.storage.from(...)` calls, so the
 * transport can move if Supabase is ever self-hosted (REHAUL_PLAN.md 7.I), and
 * so the rules below are applied everywhere rather than at each call site.
 *
 * The bucket is private. Nothing here produces a public URL — reads go through
 * a short-lived signed URL, and the bucket's own policies gate that on
 * `is_admin()` for select as well as write (7.E).
 */

import { supabase } from '@/integrations/supabase/client';
import { asTypedBlob, readFileSignature } from '@/lib/file-signature';

export const FINANCE_BUCKET = 'finance-documents';

/** Signed URLs last minutes, not hours: long enough to open, not to leak. */
const SIGNED_URL_TTL_SECONDS = 300;

/**
 * Kinds accepted, checked by the bytes a file starts with rather than by its
 * name or the browser's guess (src/lib/file-signature.ts). This is not a
 * defence against a hostile admin -- they own the bucket -- but it does stop a
 * renamed or truncated file being archived as a payslip and discovered to be
 * unusable years later, which is the failure that actually matters here.
 */
const ACCEPTED_KINDS = ['pdf', 'png', 'jpeg'] as const;

export interface UploadResult {
  path: string;
  mime: string;
}

/**
 * Store a document and return the path to record against the row.
 *
 * The name is generated, never taken from the file: an uploaded filename is
 * user input, and one carrying `../` or a colleague's name has no business
 * becoming an object key. Foldered by profile so a profile's documents can be
 * found and removed together.
 */
export async function uploadFinanceDocument(
  file: File,
  profileId: string,
): Promise<UploadResult> {
  const sniffed = await readFileSignature(file, ACCEPTED_KINDS);
  if (!sniffed) {
    throw new Error('That file is not a PDF, PNG or JPEG.');
  }

  const path = `${profileId}/${crypto.randomUUID()}.${sniffed.ext}`;
  // Typed from the bytes: the original File would go up with the browser's
  // filename-based guess, since supabase-js ignores `contentType` for a Blob.
  const { error } = await supabase.storage.from(FINANCE_BUCKET).upload(path, asTypedBlob(file, sniffed), {
    upsert: false,
  });
  if (error) throw new Error(error.message);
  return { path, mime: sniffed.mime };
}

/** A short-lived URL for opening one document, or null if it cannot be signed. */
export async function signedDocumentUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(FINANCE_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error) {
    console.warn('could not sign document url', error.message);
    return null;
  }
  return data?.signedUrl ?? null;
}

/**
 * Remove a document.
 *
 * Deliberately quiet on failure: this is called when a row is deleted, and a
 * missing object should not stop the row going. An orphaned file costs
 * nothing; a row that will not delete is a bug the user has to work around.
 */
export async function deleteFinanceDocument(path: string): Promise<void> {
  const { error } = await supabase.storage.from(FINANCE_BUCKET).remove([path]);
  if (error) console.warn('could not delete document', error.message);
}
