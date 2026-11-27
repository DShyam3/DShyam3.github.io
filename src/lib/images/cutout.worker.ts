/// <reference lib="webworker" />
/**
 * Runs `cutout` off the main thread. One image is 40-100 ms of flood fill and
 * pixel passes; a first run over a whole collection is ~150 of them, which on
 * the main thread would be a long task every few hundred milliseconds while
 * the owner scrolls. Pixels come in and go back as transferred buffers, so
 * nothing is copied.
 */
import { cutout, type CutoutResult, type Raster } from './cutout';

export interface CutoutRequest {
  id: number;
  raster: Raster;
  keepBackground: boolean;
}

export interface CutoutReply {
  id: number;
  result?: CutoutResult;
  error?: string;
}

self.onmessage = (event: MessageEvent<CutoutRequest>) => {
  const { id, raster, keepBackground } = event.data;
  try {
    const result = cutout(raster, { keepBackground });
    self.postMessage({ id, result } satisfies CutoutReply, [result.raster.data.buffer]);
  } catch (error) {
    self.postMessage({ id, error: error instanceof Error ? error.message : String(error) } satisfies CutoutReply);
  }
};
