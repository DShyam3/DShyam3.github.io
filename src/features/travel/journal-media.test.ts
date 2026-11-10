import { describe, it, expect } from 'vitest';
import { cleanJpeg } from '../../../supabase/functions/travel-photo/jpeg';

// Framing fixture: one small frame and scan; the parser does not decode image pixels.
const image = [0xff, 0xd8, 0xff, 0xe1, 0, 6, 71, 80, 83, 0, 0xff, 0xc0, 0, 8, 8, 0, 1, 0, 1, 0,
  0xff, 0xda, 0, 2, 1, 2, 0xff, 0, 3, 0xff, 0xd9];
describe('travel image boundary', () => {
  it('removes EXIF/application metadata and trailing payloads', () => {
    const cleaned = cleanJpeg(new Uint8Array([...image, 60, 115, 99, 114, 105, 112, 116]));
    expect(Array.from(cleaned)).not.toContain(71);
    expect(Array.from(cleaned).slice(-2)).toEqual([255, 217]);
    expect(cleaned.length).toBe(image.length - 8);
  });
  it('rejects renamed and truncated files', () => {
    expect(() => cleanJpeg(new TextEncoder().encode('<svg></svg>'))).toThrow();
    expect(() => cleanJpeg(new Uint8Array(image.slice(0, -2)))).toThrow();
  });
  it('rejects dimensions larger than the published derivative limit', () => {
    const large = [...image];
    large[15] = 10;
    expect(() => cleanJpeg(new Uint8Array(large))).toThrow();
  });
});
