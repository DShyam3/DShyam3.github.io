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

const DOMAINS = recordLiteral('MERCHANT_DOMAINS');
const ALIASES = recordLiteral('MERCHANT_ALIASES');

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
  it('only allowlists domains for slugs the directory knows', () => {
    for (const slug of Object.keys(DOMAINS)) {
      expect(canonicalSlugs.has(slug), `${slug} has a domain but no directory row`).toBe(true);
    }
  });

  it('agrees with the directory on what each alias resolves to', () => {
    for (const [alias, canonical] of Object.entries(ALIASES)) {
      const entry = MERCHANT_DIRECTORY[alias];
      expect(entry, `${alias} is aliased in the function but not the directory`).toBeDefined();
      expect(entry.slug, `${alias} resolves differently either side`).toBe(canonical);
    }
  });

  it('carries every alias whose brand it can fetch a logo for', () => {
    for (const [alias, entry] of Object.entries(MERCHANT_DIRECTORY)) {
      if (alias === entry.slug || !DOMAINS[entry.slug]) continue;
      expect(ALIASES[alias], `${alias} would never reach the ${entry.slug} logo`).toBe(entry.slug);
    }
  });
});
