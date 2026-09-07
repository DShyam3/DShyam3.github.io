/**
 * Route B: brand marks bundled into the build.
 *
 * Files are discovered, not registered -- `src/assets/merchant-logos/tesco.svg`
 * is the mark for the merchant whose canonical slug is `tesco`, and adding one
 * needs no edit here. See that directory's README for what may go in it.
 *
 * Bundled rather than fetched because this layer's whole value is that it
 * costs nothing and tells nobody: the file ships with the app, so a row can
 * draw its logo offline, on first paint, without a request that would say
 * which shops appear in this ledger.
 */

const MARKS = import.meta.glob<string>('../../assets/merchant-logos/*.svg', {
  eager: true,
  query: '?url',
  import: 'default',
});

/** Canonical slug to the built asset URL, keyed off each file's basename. */
const BY_SLUG = new Map<string, string>(
  Object.entries(MARKS).map(([path, url]) => [
    path.split('/').pop()!.replace(/\.svg$/, ''),
    url,
  ]),
);

/** The bundled mark for a canonical merchant slug, if one shipped. */
export const bundledMerchantLogo = (slug: string): string | undefined =>
  BY_SLUG.get(slug);
