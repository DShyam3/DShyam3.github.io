import { describe, expect, it } from 'vitest';
import { asTypedBlob, readFileSignature, sniffFileSignature, type FileKind } from './file-signature';

const bytes = (...parts: (number[] | string)[]): Uint8Array =>
  new Uint8Array(parts.flatMap((p) => (typeof p === 'string' ? [...p].map((c) => c.charCodeAt(0)) : p)));

const ALL: FileKind[] = ['pdf', 'png', 'jpeg', 'gif', 'webp', 'heic'];
const kindOf = (b: Uint8Array, accept: FileKind[] = ALL) => sniffFileSignature(b, accept)?.kind;

/** An ftyp box: size, 'ftyp', major brand, minor version, compatible brands. */
const ftyp = (major: string, ...compatible: string[]) =>
  bytes([0, 0, 0, 16 + 4 * compatible.length], 'ftyp', major, [0, 0, 0, 0], ...compatible);

describe('sniffFileSignature', () => {
  it('recognises each kind by its own bytes', () => {
    expect(kindOf(bytes('%PDF-1.7'))).toBe('pdf');
    expect(kindOf(bytes([0x89], 'PNG', [0x0d, 0x0a, 0x1a, 0x0a]))).toBe('png');
    expect(kindOf(bytes([0xff, 0xd8, 0xff, 0xe0], 'JFIF'))).toBe('jpeg');
    expect(kindOf(bytes('GIF89a'))).toBe('gif');
    expect(kindOf(bytes('GIF87a'))).toBe('gif');
    expect(kindOf(bytes('RIFF', [0, 0, 0, 0], 'WEBPVP8 '))).toBe('webp');
    expect(kindOf(ftyp('heic', 'mif1', 'heic'))).toBe('heic');
    expect(kindOf(ftyp('hevs'))).toBe('heic');
  });

  it('reports the mime type and extension for the kind', () => {
    expect(sniffFileSignature(bytes([0xff, 0xd8, 0xff]), ['jpeg'])).toEqual({ kind: 'jpeg', mime: 'image/jpeg', ext: 'jpg' });
  });

  it('accepts only the kinds asked for', () => {
    expect(kindOf(bytes('%PDF-1.7'), ['png', 'jpeg'])).toBeUndefined();
    expect(kindOf(bytes('GIF89a'), ['pdf'])).toBeUndefined();
  });

  it('takes a generic HEIF brand as HEIC only alongside a HEIC brand', () => {
    expect(kindOf(ftyp('mif1', 'heic'))).toBe('heic');
    expect(kindOf(ftyp('mif1', 'avif'))).toBeUndefined();
    expect(kindOf(ftyp('avif', 'mif1'))).toBeUndefined();
  });

  it('refuses SVG, HTML and near misses, whatever the file was named', () => {
    expect(kindOf(bytes('<svg xmlns="http://www.w3.org/2000/svg">'))).toBeUndefined();
    expect(kindOf(bytes('<html><script>'))).toBeUndefined();
    expect(kindOf(bytes('%PDF'))).toBeUndefined();
    expect(kindOf(bytes([0x89], 'PNG'))).toBeUndefined();
    expect(kindOf(bytes('RIFF', [0, 0, 0, 0], 'WAVEfmt '))).toBeUndefined();
    expect(kindOf(new Uint8Array())).toBeUndefined();
  });
});

describe('readFileSignature and asTypedBlob', () => {
  it('reads a renamed file by its bytes and retypes it', async () => {
    const disguised = new File([bytes([0x89], 'PNG', [0x0d, 0x0a, 0x1a, 0x0a], 'rest')], 'photo.jpg', { type: 'image/jpeg' });
    const signature = await readFileSignature(disguised, ['png', 'jpeg']);
    expect(signature?.kind).toBe('png');
    const typed = asTypedBlob(disguised, signature!);
    expect(typed.type).toBe('image/png');
    expect(typed.size).toBe(disguised.size);
  });
});
