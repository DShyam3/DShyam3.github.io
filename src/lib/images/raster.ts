import { cutout, type CutoutResult, type Raster, type Tone } from './cutout';
import type { CutoutReply, CutoutRequest } from './cutout.worker';

/**
 * The browser half of a cleaned card image: decode the source, hand its
 * pixels to `cutout`, and encode what comes back. Kept out of `cutout.ts` so
 * that module stays pure and testable without a canvas.
 */

/** Longest side the background is removed at: plenty for a card, quick to flood fill. */
export const WORK_SIZE = 800;
/** Longest side stored. A card is ~200 CSS px wide, the detail view ~224 px tall; this covers both at 2x. */
export const OUTPUT_SIZE = 600;
/** WebP quality: indistinguishable from the source at card size, ~20-40 KB a product shot. */
const QUALITY = 0.86;

export interface CleanedImage {
  blob: Blob;
  /** File extension matching `blob.type`: WebP where the browser encodes it, PNG where it does not. */
  ext: 'webp' | 'png';
  width: number;
  height: number;
  transparent: boolean;
  removed: boolean;
  tone: Tone;
  /** The studio background's colour, when there is one; see `CutoutResult.backdrop`. */
  backdrop: string | null;
}

type Drawable = { source: CanvasImageSource; width: number; height: number; release: () => void };

/**
 * An SVG arriving untyped -- the `item-image` function sends every image as
 * octet-stream -- typed as one. An <img> sniffs raster formats from their
 * bytes but draws SVG only when told it is SVG.
 */
async function asSvgIfSvg(blob: Blob): Promise<Blob> {
  if (blob.type === 'image/svg+xml') return blob;
  const start = (await blob.slice(0, 1024).text()).replace(/^\uFEFF/, '').trimStart();
  return /^(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*(<!DOCTYPE svg[^>]*>\s*)?<svg[\s>]/i.test(start)
    ? new Blob([blob], { type: 'image/svg+xml' })
    : blob;
}

let worker: Worker | null | undefined;
let nextId = 0;
const waiting = new Map<number, { resolve: (result: CutoutResult) => void; reject: (error: Error) => void }>();

/** The shared cutout worker, or null where workers cannot run (the cutout then runs on the main thread). */
function cutoutWorker(): Worker | null {
  if (worker !== undefined) return worker;
  try {
    worker = new Worker(new URL('./cutout.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<CutoutReply>) => {
      const pending = waiting.get(event.data.id);
      if (!pending) return;
      waiting.delete(event.data.id);
      if (event.data.result) pending.resolve(event.data.result);
      else pending.reject(new Error(event.data.error ?? 'The cutout failed'));
    };
    worker.onerror = () => {
      // A worker that cannot start fails what is in flight; later images
      // are cut on the main thread.
      for (const pending of waiting.values()) pending.reject(new Error('The cutout worker stopped'));
      waiting.clear();
      worker?.terminate();
      worker = null;
    };
  } catch {
    worker = null;
  }
  return worker;
}

/** `cutout` in the worker, the pixels transferred there and back rather than copied. */
function runCutout(raster: Raster, keepBackground: boolean): Promise<CutoutResult> {
  const target = cutoutWorker();
  if (!target) return Promise.resolve(cutout(raster, { keepBackground }));
  const id = nextId++;
  return new Promise((resolve, reject) => {
    waiting.set(id, { resolve, reject });
    target.postMessage({ id, raster, keepBackground } satisfies CutoutRequest, [raster.data.buffer]);
  });
}

/**
 * Decodes any image the browser can draw. `createImageBitmap` takes raster
 * formats; SVG and ICO need an <img>, which also runs no script in an SVG.
 */
async function decode(input: Blob | HTMLImageElement): Promise<Drawable> {
  if (input instanceof HTMLImageElement) {
    return { source: input, width: input.naturalWidth || 512, height: input.naturalHeight || 512, release: () => {} };
  }
  const blob = await asSvgIfSvg(input);
  try {
    const bitmap = await createImageBitmap(blob);
    return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
  } catch {
    // Fall through to an <img>.
  }
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.decoding = 'async';
  img.src = url;
  try {
    await img.decode();
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
  // An SVG with no width or height of its own decodes at 0x0 in some browsers.
  const width = img.naturalWidth || 512;
  const height = img.naturalHeight || 512;
  return { source: img, width, height, release: () => URL.revokeObjectURL(url) };
}

function canvas(width: number, height: number): CanvasRenderingContext2D {
  const element = document.createElement('canvas');
  element.width = width;
  element.height = height;
  const context = element.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Canvas 2D is unavailable');
  context.imageSmoothingQuality = 'high';
  return context;
}

const fit = (width: number, height: number, max: number) => {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
};

function toBlob(element: HTMLCanvasElement, type: string, quality?: number): Promise<Blob | null> {
  return new Promise((resolve) => element.toBlob(resolve, type, quality));
}

/**
 * Decodes `input` -- bytes, or an <img> already loaded in CORS mode -- removes
 * its background unless told not to, and encodes the result.
 */
export async function cleanImage(
  input: Blob | HTMLImageElement,
  options: { keepBackground?: boolean } = {},
): Promise<CleanedImage> {
  const image = await decode(input);
  let work: CanvasRenderingContext2D;
  try {
    const size = fit(image.width, image.height, WORK_SIZE);
    work = canvas(size.width, size.height);
    work.drawImage(image.source, 0, 0, size.width, size.height);
  } finally {
    image.release();
  }
  const pixels = work.getImageData(0, 0, work.canvas.width, work.canvas.height);
  const source: Raster = { data: pixels.data, width: pixels.width, height: pixels.height };
  const result = await runCutout(source, Boolean(options.keepBackground));

  const trimmed = canvas(result.raster.width, result.raster.height);
  trimmed.putImageData(new ImageData(result.raster.data, result.raster.width, result.raster.height), 0, 0);
  const size = fit(result.raster.width, result.raster.height, OUTPUT_SIZE);
  const output = canvas(size.width, size.height);
  output.drawImage(trimmed.canvas, 0, 0, size.width, size.height);

  // Safari before 17 ignores the WebP request and returns PNG; say so in the extension.
  let encoded = await toBlob(output.canvas, 'image/webp', QUALITY);
  if (!encoded || encoded.type !== 'image/webp') encoded = await toBlob(output.canvas, 'image/png');
  if (!encoded) throw new Error('The image could not be encoded');
  return {
    blob: encoded,
    ext: encoded.type === 'image/webp' ? 'webp' : 'png',
    width: size.width,
    height: size.height,
    transparent: result.transparent,
    removed: result.removed,
    tone: result.tone,
    backdrop: result.backdrop,
  };
}

/** Lowercase hex SHA-256 of `text`: the cache key for a source URL. */
export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Resolves true if an <img> can show `src` -- which needs no CORS, unlike reading its pixels. */
export function imageLoads(src: string, timeoutMs = 10_000): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    const timer = window.setTimeout(() => done(false), timeoutMs);
    function done(ok: boolean) {
      window.clearTimeout(timer);
      img.onload = null;
      img.onerror = null;
      resolve(ok);
    }
    img.onload = () => done(true);
    img.onerror = () => done(false);
    img.src = src;
  });
}
