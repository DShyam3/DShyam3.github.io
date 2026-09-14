import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MERCHANT_DIRECTORY } from './merchant-directory';
import { merchantSlug } from './merchant';

/**
 * The merchant-logo-cache function carries its own copy of the alias map and,
 * separately, the domain allowlist -- Deno cannot import from `src/`, the same
 * constraint watchlist-cron-sync documents.
 *
 * A hand-maintained copy drifts silently, and the failure is invisible: a
 * merchant caches under one slug, the browser looks it up under another, and
 * the logo simply never appears. So the copy is read as text and checked.
 */
const FUNCTION_SOURCE = readFileSync(
  resolve(process.cwd(), 'supabase/functions/merchant-logo-cache/index.ts'),
  'utf8',
);

const recordLiteral = (name: string): Record<string, string> => {
  const start = FUNCTION_SOURCE.indexOf(`const ${name}: Record<string, string> = {`);
  expect(start, `${name} not found in the function`).toBeGreaterThan(-1);
  const body = FUNCTION_SOURCE.slice(start, FUNCTION_SOURCE.indexOf('\n}', start));
  return Object.fromEntries(
    [...body.matchAll(/'([^']+)':\s*'([^']+)'/g)].map(m => [m[1], m[2]]),
  );
};

const ALIASES = recordLiteral('MERCHANT_ALIASES');

const FUNCTION_CANONICAL = (() => {
  const start = FUNCTION_SOURCE.indexOf('const MERCHANT_CANONICAL = new Set<string>([');
  expect(start, 'MERCHANT_CANONICAL not found in the function').toBeGreaterThan(-1);
  const body = FUNCTION_SOURCE.slice(start, FUNCTION_SOURCE.indexOf('])', start));
  return new Set([...body.matchAll(/'([^']+)'/g)].map(m => m[1]));
})();

const canonicalSlugs = new Set(
  Object.values(MERCHANT_DIRECTORY).map(entry => entry.slug),
);

describe('merchant directory', () => {
  it('resolves every key it holds to a canonical slug it also holds', () => {
    for (const [key, entry] of Object.entries(MERCHANT_DIRECTORY)) {
      expect(canonicalSlugs.has(entry.slug), `${key} points at an unknown slug`).toBe(true);
    }
  });

  it('uses keys the normaliser can actually produce', () => {
    for (const key of Object.keys(MERCHANT_DIRECTORY)) {
      // A key that is not its own slug could never be looked up: the resolver
      // only ever asks with normaliser output.
      expect(merchantSlug(key), `${key} is not a normalised slug`).toBe(key);
    }
  });
});

describe('merchant-logo-cache, against the directory', () => {
  it('agrees with the directory on what each alias resolves to', () => {
    for (const [alias, canonical] of Object.entries(ALIASES)) {
      const entry = MERCHANT_DIRECTORY[alias];
      expect(entry, `${alias} is aliased in the function but not the directory`).toBeDefined();
      expect(entry.slug, `${alias} resolves differently either side`).toBe(canonical);
    }
  });

  it('knows exactly the canonical slugs the directory does', () => {
    // The function resolves a branch description by walking leading words
    // against this set. A canonical slug missing here is a brand it can never
    // recognise; one that is here and not in the directory is a key the
    // browser would never ask for.
    for (const slug of canonicalSlugs) {
      expect(FUNCTION_CANONICAL.has(slug), `${slug} is missing from the function`).toBe(true);
    }
    for (const slug of FUNCTION_CANONICAL) {
      expect(canonicalSlugs.has(slug), `${slug} is in the function but not the directory`).toBe(true);
    }
  });

  it('hints domains only for brands the directory names', () => {
    // A hint under an unknown slug is dead weight that reads as coverage: the
    // brand is never looked up, so the domain is never used.
    for (const slug of Object.keys(recordLiteral('MERCHANT_DOMAIN_HINTS'))) {
      expect(canonicalSlugs.has(slug), `${slug} is hinted but not a directory brand`).toBe(true);
    }
  });

  it('carries every alias the directory knows', () => {
    // The function counts occurrences per canonical slug to decide what is
    // worth looking up. An alias it does not recognise is counted as its own
    // merchant, so a brand paid five times under two spellings could fall
    // under the threshold on both and never resolve.
    for (const [alias, entry] of Object.entries(MERCHANT_DIRECTORY)) {
      if (alias === entry.slug) continue;
      expect(ALIASES[alias], `${alias} would be counted apart from ${entry.slug}`).toBe(entry.slug);
    }
  });
});
