/**
 * The site's typefaces, in one place.
 *
 * Two families, both self-hosted from @fontsource and bundled by Vite, so no
 * visitor's browser asks a font CDN for anything:
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
 * If you change a family, change it in all three, and swap the @fontsource
 * imports below. Imported once, from src/main.tsx.
 */

// The weights the site actually uses. Each file declares its subsets (latin,
// latin-ext; Space Mono adds vietnamese) by unicode-range, so the browser
// fetches only the subsets a page needs.
import '@fontsource/doto/400.css';
import '@fontsource/doto/500.css';
import '@fontsource/doto/600.css';
import '@fontsource/doto/700.css';
import '@fontsource/doto/800.css';
import '@fontsource/doto/900.css';
import '@fontsource/space-mono/400.css';
import '@fontsource/space-mono/700.css';
import '@fontsource/space-mono/400-italic.css';
import '@fontsource/space-mono/700-italic.css';

export const FONT_STACKS = {
  /** Dot-matrix display face. */
  matrix: "'Doto', monospace",
  /** Body and UI text. */
  body: "'Space Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
} as const;
