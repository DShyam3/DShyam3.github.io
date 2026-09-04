/**
 * The site's typefaces, in one place.
 *
 * Two families, both loaded from Google Fonts in index.html:
 *
 *   Doto        the dot-matrix display face. Headings, nav, buttons, the
 *               DotMatrixText component. This is the site's signature.
 *   Space Mono  everything you actually read: body copy, card text, form
 *               fields, tables.
 *
 * Consumed three ways, all of which have to agree:
 *   - CSS custom properties in src/index.css (--font-matrix, --font-body)
 *   - Tailwind's fontFamily in tailwind.config.ts, so `font-serif` etc. work
 *   - This file, for anything that needs the stack in TypeScript
 *
 * If you change a family, change it in all three, and update the Google Fonts
 * <link> in index.html.
 */

export const FONT_STACKS = {
  /** Dot-matrix display face. */
  matrix: "'Doto', monospace",
  /** Body and UI text. */
  body: "'Space Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
} as const;

/**
 * The Google Fonts request index.html makes. Kept here so the weights the
 * site actually uses are visible next to the stacks that use them.
 */
export const GOOGLE_FONTS_HREF =
  'https://fonts.googleapis.com/css2' +
  '?family=Doto:wght@400;500;600;700;800;900' +
  '&family=Space+Mono:ital,wght@0,400;0,700;1,400;1,700' +
  '&display=swap';
