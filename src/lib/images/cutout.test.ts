import { describe, expect, it } from 'vitest';
import { borderBackground, cutout, opaqueBounds, toneOf, type Raster } from './cutout';

type Rgba = [number, number, number, number];

function raster(width: number, height: number, paint: (x: number, y: number) => Rgba): Raster {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) data.set(paint(x, y), (y * width + x) * 4);
  }
  return { data, width, height };
}

const pixel = (r: Raster, x: number, y: number): Rgba => {
  const at = (y * r.width + x) * 4;
  return [r.data[at], r.data[at + 1], r.data[at + 2], r.data[at + 3]];
};

const WHITE: Rgba = [255, 255, 255, 255];
const BLACK: Rgba = [20, 20, 20, 255];
const inside = (x: number, y: number, from: number, to: number) => x >= from && x < to && y >= from && y < to;

describe('cutout', () => {
  it('removes a white studio background and trims to the subject', () => {
    const shot = raster(40, 40, (x, y) => (inside(x, y, 10, 30) ? BLACK : WHITE));
    const result = cutout(shot);
    expect(result.removed).toBe(true);
    expect(result.transparent).toBe(true);
    expect(result.raster.width).toBe(20);
    expect(result.raster.height).toBe(20);
    expect(pixel(result.raster, 10, 10)[3]).toBe(255);
    expect(result.tone).toBe('dark');
    expect(result.backdrop).toBe('#ffffff');
  });

  it('tolerates JPEG-like noise in the background', () => {
    let seed = 7;
    const noise = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return (seed % 9) - 4;
    };
    const shot = raster(40, 40, (x, y) => {
      if (inside(x, y, 12, 28)) return [200, 30, 30, 255];
      const n = noise();
      return [250 + n, 250 + n, 251 + n, 255];
    });
    const result = cutout(shot);
    expect(result.removed).toBe(true);
    expect(result.raster.width).toBe(16);
    expect(result.tone).toBe('color');
  });

  it('turns a soft grey shadow into a translucent black one', () => {
    // A subject, and a shadow fading out to its right two luma a step: a
    // small share of the frame, as a real shadow is.
    const shot = raster(200, 100, (x, y) => {
      if (x >= 20 && x < 60 && y >= 20 && y < 60) return [180, 40, 40, 255];
      if (x >= 60 && x < 90 && y >= 50 && y < 60) {
        const v = 195 + (x - 60) * 2;
        return [v, v, v, 255];
      }
      return WHITE;
    });
    const result = cutout(shot);
    expect(result.removed).toBe(true);
    const shadow = pixel(result.raster, 40, 30);
    expect(shadow[3]).toBeGreaterThan(0);
    expect(shadow[3]).toBeLessThan(255);
    expect(shadow[0]).toBe(0);
  });

  it('keeps a shot whole when its "shadow" is a large share of it: a white subject\'s shading', () => {
    const shot = raster(100, 100, (x, y) => {
      if (x >= 30 && x < 70 && y >= 30 && y < 70) return BLACK;
      if (x >= 5 && x < 95 && y >= 10 && y < 90) {
        const v = 250 - Math.abs(50 - x);
        return [v, v, v, 255];
      }
      return WHITE;
    });
    const result = cutout(shot);
    expect(result.removed).toBe(false);
    expect(result.backdrop).toBe('#ffffff');
  });

  it('keeps white enclosed by the subject, since a hole and a white stripe look alike', () => {
    // A thick dark ring with white inside it: a carabiner's opening, or the
    // white stripes on a black sandal.
    const shot = raster(100, 100, (x, y) => (inside(x, y, 20, 80) && !inside(x, y, 46, 54) ? BLACK : WHITE));
    const result = cutout(shot);
    expect(result.removed).toBe(true);
    expect(pixel(result.raster, 30, 30)).toEqual(WHITE);
  });

  it('keeps a shot whole when a large enclosed patch shows the backdrop', () => {
    // A dark ring around a big white opening: cut out, the opening would be a
    // white blob on the dark theme; on a plate it matches.
    const shot = raster(50, 50, (x, y) => (inside(x, y, 5, 45) && !inside(x, y, 9, 41) ? BLACK : WHITE));
    const result = cutout(shot);
    expect(result.removed).toBe(false);
    expect(result.backdrop).toBe('#ffffff');
  });

  it('keeps a white subject on white whole, with its backdrop for a plate', () => {
    // A pale grey outline around white: an AirPods case, where the edge is too
    // soft to tell subject from background.
    const shot = raster(50, 50, (x, y) => {
      if (inside(x, y, 10, 40) && !inside(x, y, 12, 38)) return [228, 228, 228, 255];
      return WHITE;
    });
    const result = cutout(shot);
    expect(result.removed).toBe(false);
    expect(result.transparent).toBe(false);
    expect(result.raster).toBe(shot);
    expect(result.backdrop).toBe('#ffffff');
  });

  it('leaves a photo with a busy border alone', () => {
    const shot = raster(30, 30, (x, y) => [(x * 37) % 255, (y * 53) % 255, ((x + y) * 19) % 255, 255]);
    const result = cutout(shot);
    expect(result.removed).toBe(false);
    expect(result.transparent).toBe(false);
    expect(result.raster).toBe(shot);
    expect(result.backdrop).toBeNull();
  });

  it('leaves a coloured backdrop alone', () => {
    const shot = raster(30, 30, (x, y) => (inside(x, y, 10, 20) ? BLACK : [30, 90, 200, 255]));
    expect(cutout(shot).removed).toBe(false);
  });

  it('keeps the background when the owner asks', () => {
    const shot = raster(40, 40, (x, y) => (inside(x, y, 10, 30) ? BLACK : WHITE));
    const result = cutout(shot, { keepBackground: true });
    expect(result.removed).toBe(false);
    expect(result.raster).toBe(shot);
  });

  it('keeps the original when removal would leave almost nothing', () => {
    const shot = raster(40, 40, (x, y) => (x === 20 && y === 20 ? BLACK : WHITE));
    const result = cutout(shot);
    expect(result.removed).toBe(false);
    expect(result.transparent).toBe(false);
  });

  it('trims an already transparent logo without removing anything', () => {
    const logo = raster(40, 40, (x, y) => (inside(x, y, 5, 15) ? [20, 20, 20, 255] : [0, 0, 0, 0]));
    const result = cutout(logo);
    expect(result.removed).toBe(false);
    expect(result.transparent).toBe(true);
    expect(result.raster.width).toBe(10);
    expect(result.tone).toBe('dark');
  });
});

describe('borderBackground', () => {
  it('finds the dominant border colour and its share', () => {
    const shot = raster(10, 10, (x) => (x === 0 ? BLACK : WHITE));
    const found = borderBackground(shot);
    expect(found?.color.map(Math.round)).toEqual([255, 255, 255]);
    expect(found?.share).toBeCloseTo(26 / 36, 5);
  });

  it('is null when the border is mostly transparent', () => {
    expect(borderBackground(raster(4, 4, () => [0, 0, 0, 0]))).toBeNull();
  });
});

describe('toneOf', () => {
  it('calls a white mark light and a mixed one colour', () => {
    expect(toneOf(raster(4, 4, () => [250, 250, 250, 255]))).toBe('light');
    expect(toneOf(raster(4, 4, (x) => (x < 2 ? [250, 250, 250, 255] : [20, 20, 20, 255])))).toBe('color');
    // Mostly black with a white mark in it: not one colour, so not inverted.
    expect(toneOf(raster(10, 10, (x, y) => (x === 5 && y < 8 ? [250, 250, 250, 255] : [20, 20, 20, 255])))).toBe('color');
  });
});

describe('opaqueBounds', () => {
  it('is null for a fully transparent raster', () => {
    expect(opaqueBounds(raster(3, 3, () => [0, 0, 0, 0]))).toBeNull();
  });
});
