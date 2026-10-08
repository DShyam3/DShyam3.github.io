/**
 * `search_inventory`: what is in the inventory, and what it cost.
 *
 * Pure. The rows arrive already read (`INVENTORY_COLUMNS` is the whole of
 * what is selected), and this matches, ranks and projects them. Prices are
 * added up here, in pence, so "what did my PC cost" is answered from a sum
 * this file made rather than one a model guessed at.
 *
 * Owned and wishlist items are totalled apart. Added together they answer
 * neither "what has this cost me" nor "what would it cost", and the model is
 * told never to do the subtraction itself.
 */

import type { ToolSchema } from '@/lib/assistant/protocol';
import { looksLikeSpecs, parseSpecPrice, parseSpecs, specsPriceTotal } from '@/collections/inventory-specs';

/** The columns read for this tool, and nothing else. */
export const INVENTORY_COLUMNS = 'id, name, brand, category, subcategory, price, specs, description, is_wishlist, is_edc';

export interface InventoryToolRow {
  id: string;
  name: string;
  brand: string | null;
  category: string;
  subcategory: string | null;
  /** In pounds, as the inventory page shows it. */
  price: number | null;
  specs: string | null;
  description: string | null;
  is_wishlist: boolean | null;
  is_edc: boolean | null;
}

export interface InventorySpecProjection {
  label: string | null;
  /** The part as written, without its link. */
  value: string;
  price: number | null;
  /** The symbol the price was written with, e.g. "£". */
  currency: string | null;
}

export interface InventoryItemProjection {
  name: string;
  brand: string | null;
  category: string;
  subcategory: string | null;
  /** The item's own price in pounds, as entered. */
  price: number | null;
  /** True for something owned, false for a wishlist entry. */
  owned: boolean;
  /** In the everyday carry, whatever its category. */
  inEdc: boolean;
  description: string | null;
  specs: InventorySpecProjection[];
  /** The priced spec lines added up -- a build list's parts total. Null across currencies. */
  partsTotal: number | null;
  partsCurrency: string | null;
}

export interface InventoryTotals {
  /** Matched items in this group. */
  count: number;
  /** How many of them carry a price, so a total with gaps is visible. */
  pricedCount: number;
  /** Their own prices added up, in pounds. */
  total: number;
}

export interface InventorySearchResult {
  query: string;
  category: string | null;
  /** Every item that matched, before the list was capped. */
  matched: number;
  /** Over every match, not only those listed. */
  owned: InventoryTotals;
  wishlist: InventoryTotals;
  items: InventoryItemProjection[];
}

export type InventoryToolResult =
  | { tool: 'search_inventory'; data: InventorySearchResult }
  | { tool: 'search_inventory'; error: string };

export const SEARCH_INVENTORY_SCHEMA = {
  name: 'search_inventory',
  description:
    'Searches the inventory: things owned and on the wishlist, with brand, category, price, '
    + 'description and specs. A PC or other build lists its parts as specs, each with its own '
    + 'price, and partsTotal is those parts already added up. Use for "what is in my PC", "what '
    + 'headphones do I have" or "what did X cost". owned and wishlist each carry a total over '
    + 'every match; never add or subtract prices yourself. Categories are edc (the everyday '
    + 'carry), tech, homelab, wardrobe, kitchen, home-decor, hygiene and sports-gear.',
  input_schema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Words to find in the name, brand, category, description or specs. May be empty when a category is given.',
      },
      category: { type: 'string', description: 'Optional category to search within, e.g. tech, or edc for the everyday carry.' },
    },
    required: ['query'],
  },
} as const satisfies ToolSchema;

/** Items returned in full. Totals still cover every match. */
export const MAX_INVENTORY_ITEMS = 10;
const MAX_SPEC_LINES = 40;
const MAX_DESCRIPTION_CHARS = 500;

/** Words that only make the question sound like a question. */
const STOPWORDS = new Set(['a', 'an', 'the', 'my', 'in', 'of', 'what', 'whats', 'is', 'do', 'i', 'have', 'own', 'and']);

const normalise = (value: string): string => value.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');

/** "Headphones" finds "headphone": a trailing s is dropped from longer words. */
const terms = (query: string): string[] =>
  normalise(query)
    .split(/[^a-z0-9]+/)
    .filter(word => word.length > 0 && !STOPWORDS.has(word))
    .map(word => (word.length > 3 && word.endsWith('s') ? word.slice(0, -1) : word));

/** A term counts at the start of a word, so "pc" finds "PC" but not "spec". */
const hasTerm = (text: string, term: string): boolean =>
  new RegExp(`(^|[^a-z0-9])${term}`).test(text);

interface Scored { row: InventoryToolRow; score: number; all: boolean }

const score = (row: InventoryToolRow, words: string[]): Scored => {
  const strong = normalise(`${row.name} ${row.brand ?? ''}`);
  const middle = normalise(`${row.category} ${row.subcategory ?? ''}`);
  const weak = normalise(`${row.description ?? ''} ${row.specs ?? ''}`);
  let total = 0;
  let found = 0;
  for (const word of words) {
    const points = hasTerm(strong, word) ? 3 : hasTerm(middle, word) ? 2 : hasTerm(weak, word) ? 1 : 0;
    total += points;
    if (points > 0) found += 1;
  }
  return { row, score: total, all: found === words.length };
};

/** The EDC facet on the inventory page reads the flag, not the category. */
const inCategory = (row: InventoryToolRow, category: string): boolean =>
  category === 'edc' ? row.is_edc === true : row.category.toLowerCase() === category;

const projectItem = (row: InventoryToolRow): InventoryItemProjection => {
  const description = row.description?.trim() || null;
  // A build list written before the specs column existed lives in the
  // description, and the page renders it as a parts table. So does this.
  const specsText = row.specs?.trim() || (description && looksLikeSpecs(description) ? description : null);
  const lines = specsText ? parseSpecs(specsText) : [];
  const total = specsPriceTotal(lines);
  const prose = specsText === description ? null : description;
  return {
    name: row.name,
    brand: row.brand,
    category: row.category,
    subcategory: row.subcategory,
    price: row.price,
    owned: row.is_wishlist !== true,
    inEdc: row.is_edc === true,
    description: prose && prose.length > MAX_DESCRIPTION_CHARS ? `${prose.slice(0, MAX_DESCRIPTION_CHARS)}…` : prose,
    specs: lines.slice(0, MAX_SPEC_LINES).map(line => {
      const price = line.price ? parseSpecPrice(line.price) : null;
      return {
        label: line.label,
        value: line.value.map(segment => segment.text).join('').trim(),
        price: price ? price.pence / 100 : null,
        currency: price ? price.symbol : null,
      };
    }),
    partsTotal: total ? total.amount : null,
    partsCurrency: total ? total.symbol : null,
  };
};

const totals = (rows: readonly InventoryToolRow[]): InventoryTotals => {
  const priced = rows.filter(row => typeof row.price === 'number' && Number.isFinite(row.price));
  const pence = priced.reduce((sum, row) => sum + Math.round((row.price as number) * 100), 0);
  return { count: rows.length, pricedCount: priced.length, total: pence / 100 };
};

export function searchInventory(input: Record<string, unknown>, rows: readonly InventoryToolRow[]): InventoryToolResult {
  const query = typeof input.query === 'string' ? input.query.trim() : '';
  const category = typeof input.category === 'string' && input.category.trim() !== ''
    ? input.category.trim().toLowerCase()
    : null;
  const words = terms(query);

  const pool = category ? rows.filter(row => inCategory(row, category)) : [...rows];

  let matches: InventoryToolRow[];
  if (words.length === 0) {
    if (!category) return { tool: 'search_inventory', error: 'give a query, a category, or both' };
    matches = pool.slice().sort((a, b) => a.name.localeCompare(b.name));
  } else {
    const scored = pool.map(row => score(row, words)).filter(s => s.score > 0);
    // Every word found beats some words found. Only when nothing has every
    // word does a partial match count at all.
    const ranked = scored.some(s => s.all) ? scored.filter(s => s.all) : scored;
    matches = ranked
      .sort((a, b) => b.score - a.score || a.row.name.localeCompare(b.row.name))
      .map(s => s.row);
  }

  return {
    tool: 'search_inventory',
    data: {
      query,
      category,
      matched: matches.length,
      owned: totals(matches.filter(row => row.is_wishlist !== true)),
      wishlist: totals(matches.filter(row => row.is_wishlist === true)),
      items: matches.slice(0, MAX_INVENTORY_ITEMS).map(projectItem),
    },
  };
}
