/**
 * What an uploaded file really is, read from its first bytes.
 *
 * A file's name and its browser-reported `type` both come from whoever chose
 * the file, so neither says what the bytes are. Every browser upload checks
 * here, each passing the kinds its bucket accepts. (merchant-logo-cache keeps
 * its own copy: it runs on Deno.)
 *
 * This is a browser check. Server-side, only the bucket's MIME allowlist and
 * the `is_admin()` write policies apply -- which is why uploads go up as a Blob
 * typed from these bytes rather than as the original File (`asTypedBlob`).
 */
export type FileKind = 'pdf' | 'png' | 'jpeg' | 'gif' | 'webp' | 'heic';

export interface FileSignature {
  kind: FileKind;
  mime: string;
  ext: string;
}

const TYPES: Record<FileKind, Omit<FileSignature, 'kind'>> = {
  pdf: { mime: 'application/pdf', ext: 'pdf' },
  png: { mime: 'image/png', ext: 'png' },
  jpeg: { mime: 'image/jpeg', ext: 'jpg' },
  gif: { mime: 'image/gif', ext: 'gif' },
  webp: { mime: 'image/webp', ext: 'webp' },
  heic: { mime: 'image/heic', ext: 'heic' },
};

/** Enough for every signature here, including an ftyp box's brand list. */
export const SIGNATURE_BYTES = 32;

const ascii = (bytes: Uint8Array, start: number, end: number): string =>
  String.fromCharCode(...bytes.subarray(start, Math.min(end, bytes.length)));

/** HEVC-coded HEIF brands. */
const HEIC_BRANDS = new Set(['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'hevm', 'hevs']);
/** Generic HEIF brands: AVIF and JPEG-in-HEIF use them too, so they need a HEIC brand alongside. */
const GENERIC_HEIF_BRANDS = new Set(['mif1', 'msf1']);

/** An ftyp box's major brand and compatible brands, as far as `bytes` reaches. */
const ftypBrands = (bytes: Uint8Array): { major: string; compatible: string[] } | undefined => {
  if (bytes.length < 12 || ascii(bytes, 4, 8) !== 'ftyp') return undefined;
  const boxSize = ((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]) >>> 0;
  const end = Math.min(boxSize, bytes.length);
  const compatible: string[] = [];
  for (let at = 16; at + 4 <= end; at += 4) compatible.push(ascii(bytes, at, at + 4));
  return { major: ascii(bytes, 8, 12), compatible };
};

const isHeic = (bytes: Uint8Array): boolean => {
  const brands = ftypBrands(bytes);
  if (!brands) return false;
  if (HEIC_BRANDS.has(brands.major)) return true;
  return GENERIC_HEIF_BRANDS.has(brands.major) && brands.compatible.some((b) => HEIC_BRANDS.has(b));
};

const MATCHES: Record<FileKind, (bytes: Uint8Array) => boolean> = {
  pdf: (b) => ascii(b, 0, 5) === '%PDF-',
  png: (b) => ascii(b, 0, 8) === '\x89PNG\r\n\x1a\n',
  jpeg: (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  gif: (b) => ascii(b, 0, 6) === 'GIF87a' || ascii(b, 0, 6) === 'GIF89a',
  webp: (b) => ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 12) === 'WEBP',
  heic: isHeic,
};

/** The first of `accept` that `bytes` begins with, or undefined. */
export const sniffFileSignature = (
  bytes: Uint8Array,
  accept: readonly FileKind[],
): FileSignature | undefined => {
  const kind = accept.find((k) => MATCHES[k](bytes));
  return kind ? { kind, ...TYPES[kind] } : undefined;
};

/** Reads a file's first bytes and sniffs them against `accept`. */
export const readFileSignature = async (
  file: Blob,
  accept: readonly FileKind[],
): Promise<FileSignature | undefined> =>
  sniffFileSignature(new Uint8Array(await file.slice(0, SIGNATURE_BYTES).arrayBuffer()), accept);

/**
 * The file's bytes as a Blob typed from its signature. supabase-js sends a
 * Blob body as multipart form data and the part's type is the Blob's own
 * `type`; its `contentType` option is ignored for a Blob. So the original
 * File would go up with the browser's filename-based guess.
 */
export const asTypedBlob = (file: Blob, signature: FileSignature): Blob =>
  new Blob([file], { type: signature.mime });
