/**
 * Where the money sits in a run of text, so the finance page can paint over it.
 *
 * Figures reach the screen through `formatGBP`, local axis formatters and raw
 * `£${v}` templates in three dozen files. Matching the rendered text rather
 * than wrapping each call site means a figure added later is hidden without
 * anyone remembering to. A sign touching the pound sign is part of the figure,
 * since it gives away which way the money went.
 */
const FIGURE = /[-−+]?£\s?[-−]?\d+(?:,\d{3})*(?:\.\d+)?(?:bn|[kKmM])?/g;

/** Half-open `[start, end)` offsets of every figure in `text`. */
export function figureSpans(text: string): Array<[start: number, end: number]> {
  return Array.from(text.matchAll(FIGURE), match => [match.index, match.index + match[0].length]);
}
