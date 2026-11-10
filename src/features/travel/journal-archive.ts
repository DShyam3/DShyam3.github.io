import { buildTravelBackup, validateTravelBackup, type TravelBackup } from './journal-import';
import type { TravelJournal } from './journal-types';

export const MAX_ARCHIVE_BYTES = 60 * 1024 * 1024;
export interface TravelArchive { archive_version: 1; journal: TravelBackup; photos: Record<string, string> }
const photoPaths = (journal: TravelJournal) => [...new Set(journal.memories.flatMap(row => row.photo_path ? [row.photo_path] : []))];

function encode(bytes: Uint8Array): string {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  return btoa(binary);
}
export function decodeArchivePhoto(value: string): Uint8Array {
  if (value.length > 12 * 1024 * 1024 || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) throw new Error('Invalid photo in backup.');
  const bytes = Uint8Array.from(atob(value), character => character.charCodeAt(0));
  if (bytes.length < 4 || bytes[0] !== 255 || bytes[1] !== 216 || bytes[2] !== 255) throw new Error('Invalid photo in backup.');
  return bytes;
}

/** Transport is injected so portability and link preservation can be tested without storage. */
export async function buildTravelArchive(journal: TravelJournal, download: (path: string) => Promise<Uint8Array>): Promise<string> {
  const metadata = validateTravelBackup(buildTravelBackup(journal));
  const photos: Record<string, string> = {};
  let size = new TextEncoder().encode(JSON.stringify(metadata)).length;
  for (const path of photoPaths(journal)) {
    const bytes = await download(path);
    const encoded = encode(bytes);
    decodeArchivePhoto(encoded);
    size += encoded.length + path.length + 8;
    if (size > MAX_ARCHIVE_BYTES - 1024) throw new Error('This archive exceeds 60 MB. Export metadata and download photos separately.');
    photos[path] = encoded;
  }
  return JSON.stringify({ archive_version: 1, journal: metadata, photos });
}

export function parseTravelArchive(text: string): TravelArchive {
  if (new TextEncoder().encode(text).length > MAX_ARCHIVE_BYTES) throw new Error('Choose an archive smaller than 60 MB.');
  const source = JSON.parse(text);
  if (source?.archive_version !== 1 || !source.photos || typeof source.photos !== 'object' || Array.isArray(source.photos)) throw new Error('Choose a complete travel archive with photos.');
  const journal = validateTravelBackup(JSON.stringify(source.journal));
  const photos: Record<string, string> = {};
  const paths = photoPaths(journal);
  if (Object.keys(source.photos).length !== paths.length) throw new Error('Photo manifest does not match the journal.');
  for (const path of paths) {
    const encoded: unknown = source.photos[path];
    if (typeof encoded !== 'string') throw new Error('A photo is missing from this backup.');
    decodeArchivePhoto(encoded);
    photos[path] = encoded;
  }
  return { archive_version: 1, journal, photos };
}

/** Re-upload derivatives, remap paths, and retain stable record IDs/relationships. */
export async function prepareArchiveRestore(archive: TravelArchive, ownerId: string, upload: (bytes: Uint8Array) => Promise<string>): Promise<TravelBackup> {
  const paths = new Map<string, string>();
  for (const [path, bytes] of Object.entries(archive.photos)) paths.set(path, await upload(decodeArchivePhoto(bytes)));
  return { version: 1,
    trips: archive.journal.trips.map(row => ({ ...row, owner_id: ownerId })),
    visits: archive.journal.visits.map(row => ({ ...row, owner_id: ownerId })),
    itinerary: archive.journal.itinerary.map(row => ({ ...row, owner_id: ownerId })),
    memories: archive.journal.memories.map(row => ({ ...row, owner_id: ownerId, photo_path: row.photo_path ? paths.get(row.photo_path)! : null })),
  };
}
