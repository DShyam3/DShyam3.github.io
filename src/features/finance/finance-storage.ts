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

export const FINANCE_BUCKET = 'finance-documents';

/** Signed URLs last minutes, not hours: long enough to open, not to leak. */
const SIGNED_URL_TTL_SECONDS = 300;

/**
 * Types accepted, keyed by the bytes a file actually starts with.
 *
 * Checked by signature rather than by filename or by the browser's guess,
 * both of which are supplied by whoever chose the file. This is not a defence
 * against a hostile admin — they own the bucket — but it does stop a renamed
 * or truncated file being archived as a payslip and discovered to be unusable
 * years later, which is the failure that actually matters for an archive.
 */
const SIGNATURES: { mime: string; ext: string; magic: number[] }[] = [
  { mime: 'application/pdf', ext: 'pdf', magic: [0x25, 0x50, 0x44, 0x46] },       // %PDF
  { mime: 'image/png', ext: 'png', magic: [0x89, 0x50, 0x4e, 0x47] },             // .PNG
  { mime: 'image/jpeg', ext: 'jpg', magic: [0xff, 0xd8, 0xff] },
];

export interface SniffResult {
  mime: string;
  ext: string;
}

/** Reads the first bytes and returns the type they declare, or null. */
export async function sniffFileType(file: File): Promise<SniffResult | null> {
  const head = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  for (const { mime, ext, magic } of SIGNATURES) {
    if (magic.every((byte, i) => head[i] === byte)) return { mime, ext };
  }
  return null;
}

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
  const sniffed = await sniffFileType(file);
  if (!sniffed) {
    throw new Error('That file is not a PDF, PNG or JPEG.');
  }

  const path = `${profileId}/${crypto.randomUUID()}.${sniffed.ext}`;
  const { error } = await supabase.storage.from(FINANCE_BUCKET).upload(path, file, {
    // The sniffed type, not `file.type`, which the browser infers from the
    // extension and therefore inherits whatever the name claimed.
    contentType: sniffed.mime,
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
