/**
 * Reading an inventory item's specs text.
 *
 * A spec line is written as "Label: value", one per line, and the values that
 * came out of a build list carry two extras worth pulling apart rather than
 * printing raw: a markdown link around the part name, and a trailing "(£372.00)".
 *
 *   - GPU: [MSI GeForce RTX 5080](https://...) (£1179.90)
 *
 * Left as text that reads as a wall of URLs. Split into label, linked value and
 * price, it reads as a parts table -- on the inventory page, and for the
 * assistant's `search_inventory`, which adds the prices up here rather than
 * leaving the sum to a model.
 *
 * Pure: no React, so both read the same parser.
 */

export interface SpecSegment {
  text: string;
  href?: string;
}

export interface SpecLine {
  label: string | null;
  value: SpecSegment[];
  /** As written, e.g. "£372.00". */
  price: string | null;
}

/** "(£372.00)" or "($42)" at the end of a line. */
const TRAILING_PRICE = /\s*\(\s*([£$€]\s*[\d,]+(?:\.\d+)?)\s*\)\s*$/;
/** Markdown link: [text](url). */
const MARKDOWN_LINK = /\[([^\]]+)\]\(([^)\s]+)\)/g;

/**
 * Only treat text before a colon as a label when it looks like one: short, and
 * free of the brackets and slashes that mean the colon belongs to a URL.
 */
const splitLabel = (line: string): [string | null, string] => {
  const colon = line.indexOf(':');
  if (colon <= 0) return [null, line];
  const label = line.slice(0, colon);
  if (label.length > 28 || /[[\](/]/.test(label)) return [null, line];
  return [label.trim(), line.slice(colon + 1).trim()];
};

const linkify = (value: string): SpecSegment[] => {
  const segments: SpecSegment[] = [];
  let cursor = 0;
  for (const match of value.matchAll(MARKDOWN_LINK)) {
    const start = match.index ?? 0;
    if (start > cursor) segments.push({ text: value.slice(cursor, start) });
    segments.push({ text: match[1], href: match[2] });
    cursor = start + match[0].length;
  }
  if (cursor < value.length) segments.push({ text: value.slice(cursor) });
  return segments.length > 0 ? segments : [{ text: value }];
};

export const parseSpecs = (specs: string): SpecLine[] =>
  specs
    .split('\n')
    .map((line) => line.trim().replace(/^[-*•]\s+/, ''))
    .filter(Boolean)
    .map((line) => {
      const priceMatch = line.match(TRAILING_PRICE);
      const price = priceMatch ? priceMatch[1].replace(/\s+/, '') : null;
      const rest = priceMatch ? line.slice(0, priceMatch.index) : line;
      const [label, value] = splitLabel(rest);
      return { label, value: linkify(value), price };
    });

/**
 * Descriptions predate the specs column, and some of them -- the build lists --
 * were already written in this shape. Render those as a table too rather than
 * as a paragraph of markdown source; a real paragraph stays a paragraph.
 */
export const looksLikeSpecs = (text: string) => {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) return false;
  return lines.every((line) => /^[-*•]\s+/.test(line) || splitLabel(line)[0] !== null);
};

/** "£1,179.90" to { symbol: '£', pence: 117990 }; null when it is not a price. */
export const parseSpecPrice = (price: string): { symbol: string; pence: number } | null => {
  const symbol = price.slice(0, 1);
  const amount = Number(price.slice(1).replace(/,/g, ''));
  if (!Number.isFinite(amount)) return null;
  return { symbol, pence: Math.round(amount * 100) };
};

/**
 * What the priced lines add up to, summed in integer pence so a long build
 * list cannot drift. Null when no line carries a price, and null when the
 * lines are in more than one currency: £449 and $42 have no total without an
 * exchange rate, and showing "£491" would be a figure nobody paid.
 */
export const specsPriceTotal = (lines: SpecLine[]): { symbol: string; amount: number } | null => {
  const prices = lines
    .map((line) => (line.price ? parseSpecPrice(line.price) : null))
    .filter((price): price is { symbol: string; pence: number } => price !== null);
  if (prices.length < 1) return null;
  if (prices.some((price) => price.symbol !== prices[0].symbol)) return null;
  const pence = prices.reduce((total, price) => total + price.pence, 0);
  return { symbol: prices[0].symbol, amount: pence / 100 };
};
