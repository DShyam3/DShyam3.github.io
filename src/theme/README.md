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

## Type

`src/theme/typography.ts` holds the scale. The short version:

- **Sizes**: 12, 14, 16, 18, 20, 24, 30, 36, 48, 60, 72. Nothing below 12.
  Tailwind's default `text-*` classes land exactly on this ladder, so the rule
  is simply to use them and never an arbitrary `text-[11px]`.
- **Body is 16px** (`text-base`), secondary 14 (`text-sm`), fine print 12
  (`text-xs`).
- **Display steps down on mobile**: 48 to 36, 36 to 30. Body and small sizes
  stay put.
- **Two weights**: 400/500 normal, 600/700 emphasis. No `font-extrabold`,
  `font-black`, `font-light` or `font-thin` -- except a light weight is
  allowed on display text 60px and above.

The whole site is on the scale. Finance was the exception -- 263 arbitrary
sub-12px sizes and 19 off-scale weights, deferred to the Phase 7 rewrite rather
than fixed by a find-and-replace across a 12,000-line file. The rewrite cleared
the weights, and the sizes came down with it until only `text-[10px]` and
`text-[11px]` were left; those are now `text-xs`.

One thing changed shape rather than size in the process: the globe's overlay
pills read `text-[10px] sm:text-xs`, a deliberate step down on narrow screens.
There is no on-scale size below 12, so the step is gone and they are `text-xs`
throughout. They are `whitespace-nowrap` and absolutely positioned, so
they were the one real overflow risk; measured at 375px they compute to 12px
with no overflow and 82px of clearance between the two.

## Colours

Colour tokens live in `src/index.css` as HSL triples, with a `:root` block for
light and a `.dark` block for dark. Tailwind reads them through
`hsl(var(--token))`, which is why `bg-background` works in both themes without
a second definition.

They are not in this folder because Tailwind's `@layer base` needs them in the
stylesheet it processes. `src/index.css` is the source of truth for colour;
this README is the signpost to it.
