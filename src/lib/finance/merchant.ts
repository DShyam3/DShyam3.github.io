/**
 * Merchant identity: turning what a bank calls a payee into something that can
 * be keyed, coloured and drawn. Pure; see REHAUL_PLAN.md 7.I.
 *
 * Three layers sit on top of this, in falling order of fidelity:
 *
 *   1. a bundled brand mark, when the merchant is in `merchant-directory.ts`;
 *   2. a logo cached in our own storage by the merchant-logo-cache function;
 *   3. a monogram -- initials on a colour derived from the name.
 *
 * Only the third is guaranteed, so it is the one that has to be good. It is a
 * pure function of the merchant string: the same shop is the same colour on
 * every device, every reload, with nothing fetched and nothing stored.
 */

import { MERCHANT_DIRECTORY } from './merchant-directory';

/**
 * Payment processors that prefix the merchant they collected for: PayPal,
 * Square, SumUp, Zettle and friends all bill as `PAYPAL *SPOTIFY`. The part
 * after the star is the merchant; the part before is plumbing.
 */
const PROCESSOR_PREFIX = /^(paypal|pp|sq|sqc|sumup|zettle|iz|izettle|stripe|klarna|wpy|worldpay|tsys)\s*\*+\s*/;

/** Words that carry no identity, so they neither key nor initial a merchant. */
const NOISE_WORDS = new Set([
  'and', 'the', 'of', 'ltd', 'limited', 'plc', 'inc', 'llc', 'co', 'uk', 'gb',
]);

/**
 * A merchant string reduced to the part that identifies the brand.
 *
 * Store numbers, till references and payment-processor prefixes vary between
 * two visits to the same shop, so they cannot be part of the key: `TESCO
 * STORES 2891` and `Tesco Stores` have to land on the same colour, or the
 * whole point of a deterministic monogram is lost.
 */
export const normaliseMerchant = (raw: string): string =>
  raw
    .toLowerCase()
    .trim()
    .replace(PROCESSOR_PREFIX, '')
    // A possessive belongs to the word before it. Left to the punctuation
    // strip below, "Sainsbury's" becomes two words and initials as "SS".
    .replace(/['’ʼ]s\b/g, 's')
    // A domain in the description ("help.uber.com", "APPLE.COM/BILL") is a
    // reference. Keep its first label and drop the suffix, rather than dropping
    // the lot -- for a merchant that *is* a domain, Booking.com say, the
    // suffix is the only part that carries nothing.
    .replace(/\b([a-z0-9-]+)\.(com|co\.uk|net|org|io|shop)\b/g, ' $1 ')
    .replace(/[^a-z0-9]+/g, ' ')
    // Any run of digits is a store, till or reference number. No UK high
    // street brand is identified by one, and leaving them in would give every
    // branch of the same shop its own colour.
    .replace(/\b\d+\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** The normalised name as a storage-safe key: `tesco-stores`. */
export const merchantSlug = (raw: string): string =>
  normaliseMerchant(raw).replace(/ /g, '-');

/** Significant words of a merchant name, noise dropped. */
const significantWords = (raw: string): string[] => {
  const words = normaliseMerchant(raw).split(' ').filter(Boolean);
  const kept = words.filter(w => !NOISE_WORDS.has(w));
  // A name that is *entirely* noise ("The Co Ltd") still has to show
  // something, so fall back to what was actually there.
  return kept.length > 0 ? kept : words;
};

/**
 * One or two letters for the monogram.
 *
 * Two words give two letters, the way a person's initials work. One word gives
 * one: `TE` for Tesco reads as an abbreviation nobody uses, where `T` reads as
 * a mark.
 */
export const merchantInitials = (raw: string): string => {
  const words = significantWords(raw);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0][0].toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
};

/**
 * A hue in [0, 360) derived from the merchant key, by FNV-1a.
 *
 * FNV rather than a sum of char codes because a sum collides on anagrams and,
 * worse, clusters: short names would all land in the same corner of the wheel
 * and half the list would come out the same colour.
 */
export const merchantHue = (raw: string): number => {
  const key = normaliseMerchant(raw);
  let hash = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    // The FNV-1a 32-bit prime, as shifts, because `* 16777619` overflows a
    // double's exact-integer range and stops being reproducible.
    hash = (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0;
  }
  return hash % 360;
};

/** Everything a row needs to draw a merchant, whichever layer supplies it. */
export interface MerchantVisual {
  /**
   * Canonical, storage-safe key. Every alias of a brand resolves to the same
   * one, so the bundled mark, the cached logo and the colour agree.
   */
  slug: string;
  /** Brand-cased name where known, else the string the bank gave. */
  label: string;
  initials: string;
  hue: number;
  /** True when the directory recognised the merchant, rather than guessing. */
  known: boolean;
}

/**
 * Resolve a merchant string down to what the UI draws.
 *
 * The directory supplies a canonical slug and the brand's own spelling; when
 * it has nothing, the monogram fields still stand on their own. Nothing here
 * touches the network -- the cached-logo layer is looked up separately,
 * because it is the only part that can be absent at first paint.
 *
 * The hue is taken from the canonical slug, not the raw string, so two
 * spellings of one shop cannot come out two colours.
 */
export const resolveMerchant = (raw: string): MerchantVisual => {
  const alias = merchantSlug(raw);
  const entry = MERCHANT_DIRECTORY[alias];
  const slug = entry?.slug ?? alias;
  return {
    slug,
    label: entry?.label ?? raw.trim(),
    initials: entry ? merchantInitials(entry.label) : merchantInitials(raw),
    hue: merchantHue(slug),
    known: entry !== undefined,
  };
};
