/**
 * Lifts a product shot or logo off its studio background, so a card can sit
 * it on the theme instead of on a white square.
 *
 * Deterministic and model-free: the background is whatever uniform, light,
 * neutral colour fills the image's border, removed by a flood fill from the
 * edges. Retail product shots are composited onto exactly that, which is why
 * a flood fill is enough -- and anything else (a lifestyle photo, a coloured
 * backdrop, a busy border) is left as it is rather than guessed at.
 *
 * The one case a flood fill cannot judge is a white subject on white: where
 * the white of an AirPods case meets the white behind it, nothing says which
 * is which, and the fill eats into the case. So when most of the edge it
 * found is soft -- barely darker than the background -- the shot is kept
 * whole, and its backdrop colour is reported so a card can show it on a
 * matching plate instead.
 *
 * Pure: pixels in, pixels out. Decoding and encoding live in `raster.ts`.
 */

/** RGBA pixels, row-major, like `ImageData` but constructible anywhere. */
export interface Raster {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

/** What the opaque pixels look like, so a monochrome logo can be inverted on the theme it would vanish into. */
export type Tone = 'dark' | 'light' | 'color';

export interface CutoutResult {
  /** The output: trimmed to its content when its background is transparent. */
  raster: Raster;
  /** The output has a transparent background (removed here, or already so). */
  transparent: boolean;
  /** A background was removed here. */
  removed: boolean;
  tone: Tone;
  /**
   * The studio background's colour as `#rrggbb`, when there is one -- removed
   * or not. A shot kept whole shows on a plate of this colour, so its own
   * background runs to the edge of the tile rather than ending in a square.
   */
  backdrop: string | null;
}

/** RGB distance within which a pixel counts as the background itself. */
export const SEED_DISTANCE = 26;
/** Share of the border that must be the background colour before anything is removed. */
export const BORDER_SHARE = 0.7;
/** The background must be at least this light (0-255)... */
export const MIN_BACKGROUND_LUMA = 200;
/** ...and at most this saturated (max - min channel). */
export const MAX_BACKGROUND_CHROMA = 28;
/** A soft shadow is followed while each step changes luma by at most this much... */
export const SHADOW_STEP = 3;
/** ...stays this neutral... */
export const SHADOW_CHROMA = 14;
/** ...and gets no darker than this below the background. */
export const SHADOW_DEPTH = 70;
/** An edge whose subject side is less than this much darker than the background is soft: it may be white on white... */
export const SOFT_EDGE_DROP = 40;
/**
 * ...and when more than this share of the edge is soft, the shot is kept
 * whole. Measured on the shop images behind Inventory: a black sandal on a
 * pale grey sweep, its reflection beneath it, is 0.48; a chair on grey with a
 * white floor box, 0.71.
 */
export const MAX_SOFT_EDGE = 0.6;
/**
 * A shadow is a small share of a product shot -- under 0.5% across the shop
 * images behind Inventory. A "shadow" larger than this is the fill running
 * down the smooth shading of a white subject (an AirPods case: 32%), and the
 * shot is kept whole.
 */
export const MAX_SHADOW_SHARE = 0.05;
/** A pixel this close to the backdrop (RGB distance) is the backdrop showing through... */
export const ENCLOSED_DISTANCE = 8;
/**
 * ...and an enclosed patch of it this large is kept whole, on a plate where
 * the patch matches. Nothing tells the opening in a carabiner (3.9% of the
 * Heroclip shot) from a white label (1.3% on a cream tube), so only a patch
 * too large to leave as a white blob counts.
 */
export const MAX_ENCLOSED_SHARE = 0.03;
/** Removal that leaves less than this share of opaque pixels has eaten the subject: keep the original. */
export const MIN_SUBJECT_SHARE = 0.02;
/** Alpha below which a pixel does not count towards the trimmed bounds. */
export const TRIM_ALPHA = 24;

const luma = (r: number, g: number, b: number): number => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const chroma = (r: number, g: number, b: number): number => Math.max(r, g, b) - Math.min(r, g, b);

function distanceSquared(data: Uint8ClampedArray, at: number, bg: readonly number[]): number {
  const dr = data[at] - bg[0];
  const dg = data[at + 1] - bg[1];
  const db = data[at + 2] - bg[2];
  return dr * dr + dg * dg + db * db;
}

const hex = (color: readonly number[]): string =>
  `#${color.map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`;

/** Indices (pixel, not byte) of every border pixel, each once. */
function borderPixels(width: number, height: number): number[] {
  const out: number[] = [];
  for (let x = 0; x < width; x++) {
    out.push(x);
    if (height > 1) out.push((height - 1) * width + x);
  }
  for (let y = 1; y < height - 1; y++) {
    out.push(y * width);
    if (width > 1) out.push(y * width + width - 1);
  }
  return out;
}

/** The 4-neighbours of `pixel`, or -1 where the image ends. */
function neighbours(pixel: number, width: number, size: number): [number, number, number, number] {
  const x = pixel % width;
  return [
    x > 0 ? pixel - 1 : -1,
    x < width - 1 ? pixel + 1 : -1,
    pixel >= width ? pixel - width : -1,
    pixel < size - width ? pixel + width : -1,
  ];
}

/**
 * The border's dominant colour and the share of the border it covers, or
 * null when most of the border is already transparent.
 */
export function borderBackground(raster: Raster): { color: number[]; share: number } | null {
  const { data, width, height } = raster;
  const border = borderPixels(width, height);
  const buckets = new Map<number, number[]>();
  let opaque = 0;
  for (const pixel of border) {
    const at = pixel * 4;
    if (data[at + 3] < 16) continue;
    opaque++;
    const key = ((data[at] >> 4) << 8) | ((data[at + 1] >> 4) << 4) | (data[at + 2] >> 4);
    const sum = buckets.get(key);
    if (sum) {
      sum[0] += data[at];
      sum[1] += data[at + 1];
      sum[2] += data[at + 2];
      sum[3]++;
    } else {
      buckets.set(key, [data[at], data[at + 1], data[at + 2], 1]);
    }
  }
  if (opaque < border.length / 2) return null;

  let best: number[] = [0, 0, 0, 0];
  for (const sum of buckets.values()) if (sum[3] > best[3]) best = sum;
  const color = [best[0] / best[3], best[1] / best[3], best[2] / best[3]];

  const limit = SEED_DISTANCE * SEED_DISTANCE;
  let near = 0;
  for (const pixel of border) {
    const at = pixel * 4;
    if (data[at + 3] >= 16 && distanceSquared(data, at, color) <= limit) near++;
  }
  return { color, share: near / opaque };
}

/** A removable studio background: uniform across the border, light and neutral. */
export function isStudioBackground(found: { color: number[]; share: number }): boolean {
  const [r, g, b] = found.color;
  return (
    found.share >= BORDER_SHARE &&
    luma(r, g, b) >= MIN_BACKGROUND_LUMA &&
    chroma(r, g, b) <= MAX_BACKGROUND_CHROMA
  );
}

/** `backgroundMask` values: not background, the background colour itself, a soft shadow on it. */
export const SUBJECT = 0;
export const BACKDROP = 1;
export const SHADOW = 2;

/**
 * Marks the background: a flood fill from the border through pixels close to
 * `bg` (BACKDROP), carried on along soft shadows -- neutral, darker, changing
 * gently (SHADOW). Only what the border reaches: an enclosed patch of
 * background colour stays, since nothing tells the hole in a carabiner from
 * the white stripes on a sandal (see MAX_ENCLOSED_SHARE).
 */
export function backgroundMask(raster: Raster, bg: readonly number[]): Uint8Array {
  const { data, width, height } = raster;
  const size = width * height;
  const mask = new Uint8Array(size);
  const queue = new Int32Array(size);
  let head = 0;
  let tail = 0;
  const seedLimit = SEED_DISTANCE * SEED_DISTANCE;
  const bgLuma = luma(bg[0], bg[1], bg[2]);

  for (const pixel of borderPixels(width, height)) {
    if (mask[pixel]) continue;
    if (distanceSquared(data, pixel * 4, bg) <= seedLimit) {
      mask[pixel] = BACKDROP;
      queue[tail++] = pixel;
    }
  }

  const classify = (from: number, to: number): number => {
    const at = to * 4;
    if (distanceSquared(data, at, bg) <= seedLimit) return BACKDROP;
    const r = data[at];
    const g = data[at + 1];
    const b = data[at + 2];
    if (chroma(r, g, b) > SHADOW_CHROMA) return SUBJECT;
    const toLuma = luma(r, g, b);
    if (toLuma > bgLuma + 2 || toLuma < bgLuma - SHADOW_DEPTH) return SUBJECT;
    const fromAt = from * 4;
    const step = Math.abs(toLuma - luma(data[fromAt], data[fromAt + 1], data[fromAt + 2]));
    return step <= SHADOW_STEP ? SHADOW : SUBJECT;
  };

  while (head < tail) {
    const pixel = queue[head++];
    for (const next of neighbours(pixel, width, size)) {
      if (next < 0 || mask[next]) continue;
      const kind = classify(pixel, next);
      if (kind !== SUBJECT) {
        mask[next] = kind;
        queue[tail++] = next;
      }
    }
  }
  return mask;
}

/**
 * The share of the subject's edge against the backdrop that is soft. Each
 * edge pixel is judged with its subject neighbours, one step in, because
 * anti-aliasing makes even a black product's outermost pixels pale: a dark
 * subject is dark a pixel in, a white one is still white. Edges against a
 * shadow are left out: a shadow fades into its subject by nature.
 */
export function softEdgeShare(raster: Raster, mask: Uint8Array, bg: readonly number[]): number {
  const { data, width } = raster;
  const size = mask.length;
  const bgLuma = luma(bg[0], bg[1], bg[2]);
  const drop = (pixel: number) => {
    const at = pixel * 4;
    return bgLuma - luma(data[at], data[at + 1], data[at + 2]);
  };
  let edge = 0;
  let soft = 0;
  for (let pixel = 0; pixel < size; pixel++) {
    if (mask[pixel] !== SUBJECT) continue;
    const around = neighbours(pixel, width, size);
    if (!around.some((next) => next >= 0 && mask[next] === BACKDROP)) continue;
    edge++;
    let deepest = drop(pixel);
    for (const next of around) {
      if (next >= 0 && mask[next] === SUBJECT) deepest = Math.max(deepest, drop(next));
    }
    if (deepest < SOFT_EDGE_DROP) soft++;
  }
  return edge === 0 ? 0 : soft / edge;
}

/** The largest patch of near-backdrop colour the fill did not reach, as a share of all pixels. */
export function largestEnclosedShare(raster: Raster, mask: Uint8Array, bg: readonly number[]): number {
  const { data, width } = raster;
  const size = mask.length;
  const limit = ENCLOSED_DISTANCE * ENCLOSED_DISTANCE;
  const seen = new Uint8Array(size);
  const queue = new Int32Array(size);
  let largest = 0;
  for (let start = 0; start < size; start++) {
    if (mask[start] !== SUBJECT || seen[start] || distanceSquared(data, start * 4, bg) > limit) continue;
    let count = 0;
    let read = 0;
    queue[count++] = start;
    seen[start] = 1;
    while (read < count) {
      for (const next of neighbours(queue[read++], width, size)) {
        if (next < 0 || seen[next] || mask[next] !== SUBJECT || distanceSquared(data, next * 4, bg) > limit) continue;
        seen[next] = 1;
        queue[count++] = next;
      }
    }
    if (count > largest) largest = count;
  }
  return largest / size;
}

/**
 * Colour-to-alpha against `bg`, counting only channels darker than it: the
 * least opacity that, composited over `bg`, reproduces the pixel, and the
 * colour that needs. A soft grey shadow on white becomes a translucent black
 * shadow, which reads right on any theme. Lighter deviations are noise in an
 * off-white backdrop, and counting them would leave white specks.
 */
function colorToAlpha(data: Uint8ClampedArray, at: number, bg: readonly number[]): void {
  let alpha = 0;
  for (let c = 0; c < 3; c++) {
    const value = data[at + c];
    const base = bg[c];
    const a = value < base ? (base - value) / (base || 1) : 0;
    if (a > alpha) alpha = a;
  }
  alpha = Math.min(1, alpha) * (data[at + 3] / 255);
  if (alpha <= 0) {
    data.fill(0, at, at + 4);
    return;
  }
  for (let c = 0; c < 3; c++) {
    data[at + c] = Math.round(bg[c] + (data[at + c] - bg[c]) / alpha);
  }
  data[at + 3] = Math.round(alpha * 255);
}

/** The opaque pixels' tone: a logo that is all near-black or all near-white. */
export function toneOf(raster: Raster): Tone {
  const { data } = raster;
  let opaque = 0;
  let dark = 0;
  let light = 0;
  for (let at = 0; at < data.length; at += 4) {
    if (data[at + 3] < 200) continue;
    opaque++;
    const r = data[at];
    const g = data[at + 1];
    const b = data[at + 2];
    if (chroma(r, g, b) >= 40) continue;
    const l = luma(r, g, b);
    if (l < 80) dark++;
    else if (l > 190) light++;
  }
  // One colour only: GitHub's black disc with a white cat is not a black mark,
  // and inverting it would make it a white disc.
  if (opaque === 0) return 'color';
  if (dark / opaque >= 0.85 && light / opaque < 0.05) return 'dark';
  if (light / opaque >= 0.85 && dark / opaque < 0.05) return 'light';
  return 'color';
}

/** The smallest rectangle holding every pixel at or above `TRIM_ALPHA`, or null if there is none. */
export function opaqueBounds(raster: Raster): { x: number; y: number; width: number; height: number } | null {
  const { data, width, height } = raster;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] < TRIM_ALPHA) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return null;
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

export function crop(raster: Raster, box: { x: number; y: number; width: number; height: number }): Raster {
  const out = new Uint8ClampedArray(box.width * box.height * 4);
  for (let row = 0; row < box.height; row++) {
    const from = ((box.y + row) * raster.width + box.x) * 4;
    out.set(raster.data.subarray(from, from + box.width * 4), row * box.width * 4);
  }
  return { data: out, width: box.width, height: box.height };
}

function trimmed(raster: Raster): Raster {
  const box = opaqueBounds(raster);
  return box ? crop(raster, box) : raster;
}

/**
 * Removes the background when there is a studio one to remove safely, trims
 * a transparent result to its subject, and reports the tone and backdrop.
 *
 * `keepBackground` is the owner's override for a shot this gets wrong: the
 * image comes back untouched.
 */
export function cutout(source: Raster, options: { keepBackground?: boolean } = {}): CutoutResult {
  const found = borderBackground(source);
  if (found === null) {
    const raster = trimmed(source);
    return { raster, transparent: true, removed: false, tone: toneOf(raster), backdrop: null };
  }
  const studio = isStudioBackground(found);
  const backdrop = studio ? hex(found.color) : null;
  const kept: CutoutResult = { raster: source, transparent: false, removed: false, tone: toneOf(source), backdrop };
  if (options.keepBackground || !studio) return kept;

  const { color } = found;
  const mask = backgroundMask(source, color);
  let shadow = 0;
  for (const kind of mask) if (kind === SHADOW) shadow++;
  if (shadow / mask.length > MAX_SHADOW_SHARE) return kept;
  if (softEdgeShare(source, mask, color) > MAX_SOFT_EDGE) return kept;
  if (largestEnclosedShare(source, mask, color) >= MAX_ENCLOSED_SHARE) return kept;

  const data = new Uint8ClampedArray(source.data);
  const { width, height } = source;
  const size = width * height;
  let subject = 0;
  for (let pixel = 0; pixel < size; pixel++) {
    if (mask[pixel] === BACKDROP) {
      data.fill(0, pixel * 4, pixel * 4 + 4);
      continue;
    }
    if (mask[pixel] === SHADOW) {
      colorToAlpha(data, pixel * 4, color);
      continue;
    }
    // A subject pixel on the boundary is anti-aliased into the background:
    // unmix it too, so no pale fringe is left around the subject.
    if (neighbours(pixel, width, size).some((next) => next >= 0 && mask[next] !== SUBJECT)) {
      colorToAlpha(data, pixel * 4, color);
    } else {
      subject++;
    }
  }

  if (subject / size < MIN_SUBJECT_SHARE) return kept;
  const raster = trimmed({ data, width, height });
  return { raster, transparent: true, removed: true, tone: toneOf(raster), backdrop };
}
