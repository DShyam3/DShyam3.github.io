# Theme

Where the site's look is defined. If you want to change a font, a colour or a
shadow, it is one of these.

For the design direction, component recipes and future page work, see
[DESIGN_SYSTEM.md](../../DESIGN_SYSTEM.md).

| What | Where |
|---|---|
| Font stacks and the self-hosted font imports | `src/theme/fonts.ts` |
| Colour tokens, shadows, radii (light + dark) | `src/index.css`, the `:root` and `.dark` blocks |
| Tailwind's view of those tokens | `tailwind.config.ts` |
| The dot-matrix look itself | `src/components/dot-matrix/` |

## Fonts

Two families, and they do different jobs:

- **Doto** — the dot-matrix display face. Headings, nav, buttons, anything
  rendered through `DotMatrixText`. This is the site's signature.
- **Space Mono** — everything you read: body copy, card text, form fields.

Both are self-hosted: `src/theme/fonts.ts` imports the `@fontsource` files and
Vite bundles them, so nothing is fetched from Google Fonts.

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

## Colour and surfaces

`src/index.css` owns the light/dark HSL tokens. `src/theme/surfaces.css`
composes them into the ambient page backgrounds, cards, navigation and dialogs.
The original Doto and Space Mono font families are retained.

The palette uses **Sovereign Folio**: warm rag parchment or obsidian-plum
foundations, antique brass trim (`--brass`), Tudor claret / burnished brass
primary controls, parchment active ribbons (`--ribbon`), and five matte enamel
route pigments (Indicolite, Gulf Blue, Tyrian Purple, Saffron Orange, and Tudor
Crimson, retaining the internal CSS token names `sage`, `sky`, `lavender`,
`peach`, and `rose` for compatibility). `AppShell` publishes `data-section`
from the route, giving related pages a consistent enamel accent:

| Slot / Pigment | Pages |
|---|---|
| `sage` (Indicolite) | About, Finance, Recipes |
| `sky` (Gulf Blue) | Travel, Links, Inventory |
| `lavender` (Tyrian Purple) | Books, Articles, Watchlist, Auth |
| `peach` (Saffron Orange) | Inspiration, Thoughts, Projects |
| `rose` (Tudor Crimson) | Photos, Beliefs |

Shared `Card` and collection `item-card` surfaces use matte opaque fills and a
solid enamel accent stripe rather than translucent radial colour washes. Focal
panels (`ambient-card` / `data-palette`) receive a double-framed antique brass
border. Ordinary rows stay quieter.

Decorative palette tokens are separate from `positive`, `destructive` and
`chart-1..5`; colours never replace a status label or calculation. Text, inputs
and popovers have their own contrast tokens in both themes. Reduced motion
disables decorative card movement.

## Radii

`--radius` is 0.375rem (6px), with Tailwind `lg`, `md` and `sm` derived from it.
Shared panels and collection cards use crisp 6px corners (4px on mobile) and
ruled controls. The card grid sizing and scroll ownership remain in
`src/index.css` and `CardGrid`.
