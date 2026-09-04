# Theme

Where the site's look is defined. If you want to change a font, a colour or a
shadow, it is one of these.

| What | Where |
|---|---|
| Font stacks and the Google Fonts request | `src/theme/fonts.ts` |
| Colour tokens, shadows, radii (light + dark) | `src/index.css`, the `:root` and `.dark` blocks |
| Tailwind's view of those tokens | `tailwind.config.ts` |
| The dot-matrix look itself | `src/components/dot-matrix/` |

## Fonts

Two families, and they do different jobs:

- **Doto** — the dot-matrix display face. Headings, nav, buttons, anything
  rendered through `DotMatrixText`. This is the site's signature.
- **Space Mono** — everything you read: body copy, card text, form fields.

Both load from Google Fonts via a single `<link>` in `index.html`.

A font is named in three places and they have to agree:

1. `src/index.css` — `--font-matrix`, `--font-body`
2. `tailwind.config.ts` — so `font-serif` / `font-sans` resolve
3. `src/theme/fonts.ts` — for TypeScript, and as the written record

Changing one without the others is the failure mode this folder exists to
prevent. It had already happened once: `--font-serif` named JetBrains Mono for
months while `index.html` only ever loaded Doto, so every piece of body text on
the site silently fell back to the system monospace default.

## Colours

Colour tokens live in `src/index.css` as HSL triples, with a `:root` block for
light and a `.dark` block for dark. Tailwind reads them through
`hsl(var(--token))`, which is why `bg-background` works in both themes without
a second definition.

They are not in this folder because Tailwind's `@layer base` needs them in the
stylesheet it processes. `src/index.css` is the source of truth for colour;
this README is the signpost to it.
