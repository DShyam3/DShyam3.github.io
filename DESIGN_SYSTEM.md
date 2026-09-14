# Digital Garden — visual design system

Status: foundation implemented locally; further page composition is planned below.
The instrument-panel direction added on 11 September 2026 is **direction, not
implementation** — nothing in it has shipped yet.
Updated: 11 September 2026.

## Direction

A personal digital garden with calm, colourful dashboards: soft surfaces,
rounded cards, precise information and occasional depth. The interface should
feel considered and tactile while retaining Dhyan's existing dot-matrix identity.

**RonDesignLab is the primary register.** It sets the surface, the composition
and the mood of nearly every page: near-white ground, large-radius cards, one
or two gradient focal tiles, an oversized figure, and a lot of air. When a
decision is contested, this is the reference that wins.

| Reference | What to borrow | Where it fits |
|---|---|---|
| Light health dashboard (Superpower) | Gradient focal tiles carrying one big figure, white supporting cards on a near-white ground, generous radius, a left icon rail | Finance overview, About, collection summaries |
| Credit dashboard (Health Karma) | Oversized numeral with a smaller unit/decimal suffix, pill tab row, small circular action affordance per card, two-tone gradient pairs | Finance summary cards, net worth, any single-metric tile |
| Floating credit detail panel | Frosted surface, grouped details, a timeline of marks, a clear bottom action | Detail dialogs, account and debt inspectors |
| Sleep dashboard | Warm atmosphere and restrained glass over a meaningful scene | Selected immersive views |
| Anatomy dashboard | A dominant object with biomarker cards beside it: figure, unit, threshold marker, one status word | Investments, health-shaped data, any "many measures of one subject" view |
| Traffic management | Dark map as the whole canvas, metrics railed down one side, one floating glass card over the scene | Travel |

A second, *smaller* set from @srotimi_ui supplies the instrumentation — the
ruled, bracketed, monospace grammar that sits inside those surfaces. It is an
accent, not a competing direction. Where the two disagree, RonDesignLab wins.

| Reference | What to borrow | Where it fits |
|---|---|---|
| Craft configurator (wireframe hull, bracketed side panels) | Corner-bracketed panel frames, a measured rail of readouts beside one dominant object, tabular figures | Travel globe, investment portfolio, a single collection "spec sheet" view |
| Terrain/threat mesh dashboard | Wireframe overlay on a real scene, markers that carry a label rather than only a colour, a thin activity strip along the bottom | Travel map, finance activity over time |
| Warehouse/routing isometric | Muted scene, live rows pinned to one side, status as text plus mark | Not yet sited — hold until a page needs it |
| Compass/radar and micro-bar clusters | The *grammar* of dense readouts: monospace figures, fixed decimals, ruled ticks | Finance summary strips, import and sync status |

These are visual references, not product specifications. Their imagery, data,
tiny labels and interaction assumptions should not be copied directly.

**The mix, stated as a ratio.** Roughly four parts RonDesignLab to one part
@srotimi_ui. Soft gradient surface is the default a page starts from; the
instrument grammar is what a *measured* panel inside it gets. A page that reads
as a control room has overshot. This site already owns the instrument half for
free — Doto and Space Mono make every figure a technical figure without any new
chrome — which is exactly why the deliberate work goes into the soft half.

Two further things the references share, worth naming because they are cheap
here and expensive elsewhere:

- **The dot-matrix halftone inside the gradient tiles is our identity already.**
  Ron's focal cards fade out through a dot grid. Doto is a dot-matrix face. The
  same motif, one already in the font stack.
- **Near-white, not white.** The ground in those shots is a shade below the
  cards sitting on it, which is what lets a shadow-free card read as a card.
  `--background: 48 25% 95%` against `--card: 0 0% 100%` already does this.

**Keep the original fonts.** Doto and Space Mono are part of the site's identity.
The colour refresh must not replace either family with a general sans-serif.

## The design vocabulary

### Glassmorphism

Translucent surfaces let a little of the background show through, while blur,
an edge and a shadow separate the foreground layer.

- Use glass for floating navigation, dialogs and future contextual inspectors.
- Keep reading surfaces substantially opaque. The implemented navigation and
  dialog fill is 96% opaque, with a 24px backdrop blur and a subtle colour wash.
- Use one glass layer over a scene. Nested cards should use ordinary fills.
- Keep forms and long passages on quiet backgrounds. Imagery must not show
  through enough to compete with their contents.
- Without blur support, the high-opacity fill must still be usable. Honour
  reduced-transparency preferences with opaque surfaces.

The aim is frosted depth. Refractive lens effects, moving highlights and heavy
blur on every card are outside the current design.

### Bento layouts

Bento describes the composition: differently sized cards grouped into a clear,
aligned grid. A large card answers the main question; smaller cards support it.

- Give each dashboard one dominant card or visual.
- Use wider cards for charts and prose, compact cards for a single metric.
- Align edges and use consistent gaps; avoid making every tile equally loud.
- Let content set the required height. Do not clip text to force symmetry.
- Keep collection grids uniform where comparing covers or objects is the task.
  A library does not need an irregular magazine layout to share this design.
- On narrow screens, stack in reading order: summary, supporting information,
  then actions or detailed records.

The About page now uses portrait, introduction and education across the first
row at desktop widths of 1280px and above. Experience and projects occupy the
second row. It uses two columns on tablets and one on phones.

### Soft minimalism

Soft minimalism provides the restraint: warm foundations, comfortable spacing,
simple controls, fine borders and a clear reading order.

- Keep the existing content and personality; simplify its presentation.
- Use whitespace to group related information before adding another divider.
- Prefer one obvious primary action per card or dialog.
- Make selected states visible through a fill and text treatment, with an
  appropriate programmatic state such as `aria-current` or `aria-pressed`.
- Reserve strong colour for primary actions and a small number of focal cards.
- Avoid decorative empty panels, excessive all-caps labels and icon-only
  actions whose purpose is unclear.

### Ambient gradients

Broad, static pools of colour provide atmosphere. They should feel like light
falling across a surface, with no harsh bands behind text.

- Use the route's accent in the page background, supported by peach and lavender.
- Use a single accent on most cards; a focal card may combine two.
- Keep dark-mode washes weaker so white and muted text stay readable.
- Use CSS gradients for these effects. A large generated image is unnecessary.

**When a gradient may carry meaning.** RonDesignLab's own note on these shots
says the soft gradients "help communicate status, progress, and overall
wellbeing at a glance" — which contradicts the rule this document has carried,
that gradients mean nothing. Both are half right, so the rule is now split:

- **Page and panel washes carry identity only.** The route accent behind About
  or Finance says *where you are*, never *how you are doing*. Unchanged.
- **A focal metric tile may carry status**, on three conditions: the stop
  colours are picked by a computed threshold and not by hand; a text label
  states the same status in words; and the figure itself is present and
  readable. Colour is then the third telling of a fact, which is what the
  accessibility rule below actually asks for.
- **Never a spectrum.** Two or three named stops mapped to named bands. A
  continuous green-to-red ramp implies a precision the underlying figure does
  not have, and is unreadable to a large minority of viewers.
- Status gradients use the status tokens, not `sage`/`peach`/`rose`. A rose
  photo card and a red debt card must not be the same red.

### Gradient metric cards

The single most characteristic element in the references: a large-radius tile
filled with a soft two-colour mesh gradient, one oversized figure sitting on
it, and almost nothing else.

- **One figure per tile.** The figure is the content. A label above it, a unit
  or short qualifier after it, and at most one supporting line.
- **The figure is large and light.** Scale up, do not embolden. Ron's `70`,
  `730`, `832`, `$137,036` are all large and thin over colour.
- **Suffix at a smaller size, baseline-aligned.** `$137` then `,036` smaller;
  `12,340` then the minor unit smaller. This is where tabular numerals earn
  their keep — a figure that changes must not shuffle its own decimal point.
- **Mesh, not linear.** Two or three radial stops bleeding into each other,
  soft-focus, no visible band. A linear gradient reads as a progress bar.
- **Fade the tile out through a dot grid**, not through opacity. The halftone
  motif is Doto's; it belongs here and nowhere else on the card.
- **One small circular action per tile, top-right**, only if the tile has a
  real destination. An arrow that leads nowhere is the commonest failure in
  these shots.
- **Text over gradient is checked at the tile's brightest point**, not its
  average. Most of the reference tiles fail this; ours must not.
- **Two per view, maximum.** Their whole effect depends on the white cards
  around them. Six gradient tiles is a screensaver.

### Spatial UI

Spatial UI places controls around a visual that helps explain the content.
Travel's map is the clearest application: the map remains the focal point,
while selection, counts and details sit nearby.

Use this selectively. A realistic bedroom, anatomy model or 3D object would add
little to a book list or transaction table. Future depth should support an
existing task, remain usable with a keyboard and work without 3D effects.

### Instrument panels

The instrument register is for pages where the subject is *measured* — a
portfolio, a sync, a route, a map. It treats a panel as a readout: a frame with
corners, a rail of labelled figures, a dominant object the figures describe.

- **One instrument surface per page.** It is the dominant card in the bento,
  not a new default for every tile. A book list is not an instrument.
- **The frame is drawn, not filled.** Corner brackets, a hairline rule, a tick
  rail — `1px` marks at low opacity over the existing dark card fill. No new
  heavy chrome, no nested boxes three deep.
- **Figures are tabular and fixed.** `font-variant-numeric: tabular-nums`,
  consistent decimals, unit suffixed and never omitted. A column of figures must
  align on the decimal point; that alignment is the whole effect.
- **Every readout maps to a computed value.** This is the hard rule. The
  references are full of decorative telemetry that means nothing — spark bars,
  packet counts, orbit numbers. Here a number that looks like data *is* data,
  computed from rows per `AGENTS.md`. If a panel needs a filler figure to look
  right, the panel is the wrong size. Delete the slot, do not invent a metric.
- **Decorative marks are `aria-hidden`.** Brackets, ticks, grid lines and the
  rails between panels carry no meaning and must not reach a screen reader.
- **Dark is a mode, not a section.** The instrument look lives on the existing
  dark tokens. Do not hard-code a dark panel into the light theme; a panel that
  only works on one theme has not been designed, it has been screenshotted.
- **Wireframe only where it explains.** Travel's globe already earns a mesh.
  A wireframe added to a page that has no spatial subject is costume.

What is explicitly **not** borrowed: 8–10px uppercase labels, text below 4.5:1,
low-contrast grey-on-grey panel copy, multi-column figure walls that no one
reads, and any readout that exists to fill space. The references fail contrast
throughout — they are stills, not interfaces that anyone has to use.

Proposed tokens, not yet implemented, if this direction is built:

| Token | Purpose |
|---|---|
| `--rule` | Hairline panel rules, tick marks and brackets |
| `--grid-line` | Background lattice behind an instrument surface |
| `--readout-label` | The one permitted uppercase label colour, meeting 4.5:1 |

## Palette

The HSL variables in [src/index.css](src/index.css) are authoritative. Hex values
below are rounded equivalents for design tools. Decorative colours are blended
into surfaces; they are not intended as text colours by themselves.

| Role / token | Light | Dark | Use |
|---|---|---|---|
| `background` | `#F5F4EF` | `#101413` | Warm ivory / charcoal canvas |
| `foreground` | `#212C28` | `#F0F0EA` | Primary text |
| `primary` | `#325D4B` | `#CFE68E` | Primary controls and selection |
| `sage` | `#A3C884` | `#82A94C` | About, Finance, Recipes |
| `sky` | `#87C8E8` | `#3F87AB` | Travel, Inventory, Links |
| `lavender` | `#C1A7EC` | `#8660C3` | Books, Articles, Watchlist, Auth |
| `peach` | `#F5B389` | `#D57539` | Inspiration, Thoughts |
| `rose` | `#EBA2B8` | `#B95573` | Photos, Beliefs |

Keep `positive`, `destructive`, and `chart-1` through `chart-5` separate from
decorative accents. A rose photo card is not an error; a sage account card is
not proof of a healthy balance. Labels, signs and explanations convey meaning.
Charts must preserve series identity when their data is filtered or reordered.

## Typography

| Role | Typeface | Treatment |
|---|---|---|
| Signature headings, navigation, dot-matrix labels | Doto | Existing `DotMatrixText` sizes and weights |
| Body, card descriptions, form text | Space Mono | Existing body stack; comfortable line spacing |
| Figures and aligned data | Existing monospace stack | Tabular numerals, consistent decimals and units |

Use the scale in [src/theme/typography.ts](src/theme/typography.ts). Secondary
copy is generally 14px, fine print 12px, body copy 16px. Preserve existing
display scaling instead of inventing tiny captions to make a card fit.

When a label is too long, wrap it or change the layout. Do not solve density by
shrinking the whole interface or silently cutting off important information.

**Uppercase labels — the one permitted form.** The instrument references run on
8–10px uppercase mono; at that size it is texture, not text. If an uppercase
label is used here it is a single defined class, not an ad-hoc style:

- 12px minimum, never smaller, and never applied to a value — only to the label
  naming it.
- `letter-spacing: 0.08em`, `text-transform: uppercase` on sentence-case source
  text, so the accessible name and the copy in the codebase stay readable.
- 4.5:1 against the blended panel background, checked at the brightest point.
- One per panel group. A wall of uppercase labels is the thing being avoided.

Everything else stays sentence case. This is the narrow exception to “avoid
excessive all-caps labels” under *Soft minimalism*, and it settles the open
uppercase-label question that `REHAUL_PLAN.md` carried until 11 September
2026.

## Surface and component recipes

| Component | Treatment | Implementation |
|---|---|---|
| App canvas | Three broad colour washes on the theme foundation | `AppShell`, route-derived `data-section` |
| Ordinary panel | Quiet tint, fine border, shallow shadow | `Card` / `surface-card` |
| Focal panel | Stronger radial gradient with readable text | `ambient-card` or `Card` with `data-palette` |
| Collection card | Consistent image ratio, tinted text area, modest hover lift | `item-card`, `card-body` |
| Navigation | Pill control, frosted menu, coloured destination markers | `NavMenu`, `navigation-panel` |
| Filters | Wrapping pills, clearly filled selection | `FilterBar`, `collection-filters` |
| Finance summary | Large actual figure, explanation, optional secondary figure | `SurfaceHero`, `finance-hero` |
| Dialog | Frosted container over a dimmed, blurred backdrop | `DialogContent`, `glass-dialog` |
| Travel | Map framed as the main visual, separate readable list | `travel-map-col`, `travel-sidebar` |
| Gradient metric tile *(planned)* | Large radius, soft mesh gradient, oversized light figure, smaller suffix, dot-grid fade, optional circular action | Not built — extend `ambient-card` with a figure slot |
| Instrument panel *(planned)* | Dark card, hairline rule, corner brackets, tabular readout rail | Not built — extend `ambient-card`, do not fork `Card` |
| Readout rail *(planned)* | Label above figure, tabular numerals, unit always shown | Not built — compose from `MetricProgress` and existing figure styles |

Shared panels use 24px corners, reduced to 20px on phones. Collection cards use
16px corners. Controls use pills where appropriate. `--radius` is 14px for the
existing token-derived control sizes; it does not set every panel's corner.
Use 16–24px gaps and 20–32px panel padding as starting points, adjusted for the
content and available viewport.

Example using the existing primitives:

```tsx
<Card data-palette="lavender">
  <CardHeader>
    <CardTitle>Net worth</CardTitle>
  </CardHeader>
  <CardContent>{/* Render the existing calculated value here. */}</CardContent>
</Card>

<section className="ambient-card rounded-3xl p-6" data-palette="sky">
  {/* A focal panel with its existing content and interactions. */}
</section>
```

Supported palettes are `sage`, `sky`, `lavender`, `peach` and `rose`. Ordinary
panels inherit the route accent. Choose explicit accents by subject, not by
an item's position in a list, so colours do not change whenever it is sorted.

## Interaction, accessibility and performance

- Text should meet at least 4.5:1 contrast for normal sizes, 3:1 for large text.
  Check the actual blended background, including the brightest gradient region.
- Meaningful controls and focus indicators need visible contrast. Decorative
  borders do not replace focus rings.
- Colour must never be the only way to communicate a status or selection.
- Preserve keyboard navigation, dialog focus containment, Escape dismissal,
  focus restoration and the skip-to-content link.
- Prefer 44px touch targets for new controls. Audit existing compact controls
  separately; the colour pass does not establish full accessibility compliance.
- Use brief, local transitions. Existing card hover movement is disabled under
  reduced motion. Future animations must respect that preference too.
- No continuous gradient animation, scroll hijacking or parallax dependency.
- No idling telemetry. A figure that ticks, sweeps or scrolls on a timer with no
  underlying change is animation pretending to be data, and it never stops
  costing battery. Update a readout when its value updates.
- A wireframe, mesh or lattice is decoration over a working layout. Remove it
  entirely under reduced motion or a missing WebGL context and the page must
  still read; the figures beside it are the content.
- Keep blur on a few floating layers. Collection grids should not create a
  backdrop filter for every item.
- Keep the header/footer and main scroll ownership in `AppShell`. A visual
  change must not break touch scrolling, short viewports or the map's sizing.

## Implementation status

### Implemented in this refresh

- Light and dark palettes with separate decorative and status colours.
- Ambient route backgrounds and accents across the shared application shell.
- Original Doto and Space Mono font families preserved.
- Multicolour About bento, with the desktop composition available from 1280px.
- Shared collection card treatments, selected filter pills and menu styling.
- Frosted shared dialogs and rounded primary/secondary controls.
- Finance hero, summary cards, standard cards and custom finance panel surfaces.
- Travel map framing and list surface styling.
- Reduced-motion handling for decorative card movement and opaque fallbacks
  for the new glass surfaces under reduced transparency.

This is a presentation change. It adds no financial calculations, model
dependencies, data storage or authentication behaviour.

### Applied system rollout — 9 September 2026

The roadmap has now been applied through shared components and the existing
page flows. Doto and Space Mono are unchanged. The Apple Design Skill remains a
supplementary review reference, with no new runtime dependency or installation.

| Area | Implemented treatment |
|---|---|
| Finance overview | A dominant “Free to spend this month” hero uses `useFinanceTotals`, shows loading separately, explains its basis and links to the plan. Supporting cards retain cash flow, unpaid bills, net worth and next payday. |
| Accounts and debts | Responsive summary cards open focused inspectors. Accounts show linked bills and recent transactions; debts show repayment terms, verified balances and borrowing history. Existing edit, deletion confirmation, reconciliation and projection handlers are retained. |
| Transactions | Quiet date groups, wrapping merchant names, explicit review labels, aligned amounts, named checkboxes and directly focusable rows complement the existing review shortcuts. |
| Budget and goals | `MetricProgress` supplies a labelled value and semantic state. Over budget, no target, not started, in progress and completed states are distinct. Budget values and meters remain visible on phones. Debt meters describe outstanding/repaid balances instead of borrowing goal terminology. |
| Travel | The country list is keyboard reachable, selected places use the existing shared map/list state, the location heading receives focus and Back restores it to the country. The globe has stronger base-dot contrast in both themes. |
| Books, Watchlist, Inventory | Covers retain their proportions; unavailable artwork has a titled fallback. Watchlist detail cards support Enter/Space and restore focus after closing. Card actions remain visible when keyboard focus enters the group. |
| Photos and Inspiration | Larger gallery columns and contained images give media more room. Image controls keep an opaque backing; photo details preserve the complete image on mobile. |
| Articles, Thoughts, Beliefs | Quiet reading surfaces and comfortable detail line spacing. Beliefs show complete passages without truncation or an overlapping decorative quote. |
| Forms and dialogs | Persistent labels, linked validation errors, required-field focus, an accessible file picker, disabled pending forms and a retained-input save-error state. Dialog bodies scroll within the viewport. Dismissal does not wait for exit animations before restoring focus. |
| Shared controls | Primary/icon buttons use 44px defaults, compact controls gain touch minimums, keyboard focus is visible, and collection/travel actions have accessible names. Light-theme destructive red is darker for text contrast. |

New implementation entry points:

- `src/components/shared/RecordInspector.tsx`
- `src/components/ui/metric-progress.tsx`
- `src/features/finance/components/AccountInspector.tsx`
- `src/features/finance/components/DebtInspector.tsx`
- `src/theme/surfaces.css`

The inspectors read existing rows and reuse current handlers. No schema, ownership,
authentication, financial projection or model-provider behaviour is changed by
this design rollout. The generic collection form now awaits its existing save
promise before closing; failure preserves the entered values.

### Verification and release boundary

Automated checks rerun on 10 September 2026.

- Inspected actual public collection pages and the travel flow at desktop and
  phone sizes, with light/dark checks.
- Tested the actual inspector and form components in a temporary local harness
  with explicitly labelled illustrative data. The harness performed no financial
  writes and was removed after review.
- Confirmed required-field focus, disabled saving state, retained entries after
  a rejected save, responsive inspector scrolling and dialog focus restoration.
- All 61 targeted tests passed, including five new accessible-meter state tests
  and the existing deterministic debt, review and watchlist tests.
- Lint passed with zero errors/warnings, both typechecks and the production build
  passed, and the graphify code graph was refreshed.
- Authenticated finance flows still require a signed-in review with real data
  before release. Component fixtures and typechecks do not replace that review.
- The latest working-tree launch scan is **98/100, Beta only**. It flags the
  existing potential N+1 queries in finance data loading and a circular
  dependency, alongside size/logging findings. These require separate review
  before public release.

## External review reference — Apple Design Skill

Reviewed on 9 September 2026:
[dickwu/apple-design-skill](https://github.com/dickwu/apple-design-skill).

**Decision: use it as supplementary design-review guidance.** It fits the
direction here, particularly material layering, dark-mode consistency,
accessibility and interaction feedback. It is a third-party collection of
instructions and HIG-derived references, rather than a React component library
or an official Apple skill. Consulting it adds no dependency to the shipped
website. This document records the recommendation; the skill has not been
installed or copied into this project.
[Repository overview](https://github.com/dickwu/apple-design-skill#readme).

### What to use

| Guidance | Application to this website |
|---|---|
| Structured reviews with specific problems, reasons and fixes | Review a representative page and its states before spreading a new pattern across the site |
| Separation of floating controls from content | Keep stronger glass on navigation and contextual overlays; use quiet materials for reading, lists and finance cards |
| Consistent colour meaning | Preserve distinct decorative, action, chart and status tokens in both themes |
| Legibility and accessible interaction | Check zoom, text size, focus, keyboard operation and controls over changing backgrounds |

The review method starts with context, selects relevant references and orders
findings by severity. Use its [review process](https://github.com/dickwu/apple-design-skill/blob/main/SKILL.md)
and [topic lookup](https://github.com/dickwu/apple-design-skill/blob/main/references/hig-lookup.md)
to keep each review focused. Its [colour guidance](https://github.com/dickwu/apple-design-skill/blob/main/references/hig/color.md)
supports semantic consistency and checking how translucency affects adjacent colours.

### Adaptations for this project

- **Preserve Doto and Space Mono.** Assess readability through size, weight,
  contrast and layout. The reference explicitly discusses accessible custom
  fonts; adopting its principles does not require adopting San Francisco.
  [Typography reference](https://github.com/dickwu/apple-design-skill/blob/main/references/hig/typography.md).
- **Treat this as a responsive website.** Browser navigation, semantic HTML,
  keyboard focus and CSS sizing govern implementation. Native-app preferences
  for bottom tabs or sidebars are prompts for evaluation, not reasons to
  automatically replace the existing menu. Native point sizes are not CSS
  pixel requirements. [Cross-platform methodology](https://github.com/dickwu/apple-design-skill/blob/main/SKILL.md).
- **Distinguish ordinary glassmorphism from Liquid Glass.** Our gradient cards
  use standard surfaces. They are not implementations of Apple's adaptive
  material. The repository's Liquid Glass guide reserves that stronger
  treatment for the functional layer. Keep our higher-opacity reading surfaces;
  its blur and opacity examples are starting points for experiments, not
  required values. [Liquid Glass reference](https://github.com/dickwu/apple-design-skill/blob/main/references/hig/liquid-glass.md).
- **Verify accessibility claims against web standards.** The adapted reference
  contains native units and simplified rules, including a blanket double
  confirmation recommendation. Do not introduce extra confirmation steps or
  relax contrast requirements automatically. Preserve the project's existing
  behaviour and verify each proposed change in context.
  [Accessibility reference](https://github.com/dickwu/apple-design-skill/blob/main/references/hig/accessibility.md).
- **Keep the chosen composition and palette.** This skill can help assess
  clarity and usability; the supplied visual references and this document
  remain the source of the bento, gradients and personal visual identity.

### How to use it in future reviews

1. Identify the page, task and relevant states. Start with the finance overview,
   a collection/detail flow or travel's map/list flow.
2. Consult the skill's accessibility, colour, layout and typography references;
   add materials, Liquid Glass or input guidance where relevant.
3. Record each finding with its source, observed evidence, user impact and a
   concrete React/CSS fix. Distinguish measured problems from aesthetic choices.
4. Prioritise functional and accessibility issues before visual refinements,
   then verify changes in both themes and at different viewport sizes.

Suggested review brief:

> Review this responsive React website using Apple Design Skill's relevant
> guidance. Follow DESIGN_SYSTEM.md and preserve Doto, Space Mono and the chosen
> palette. Adapt native recommendations to the web. Inspect accessibility,
> glass layering, hierarchy, responsive layout and interaction states. Report
> specific evidence and prioritised fixes; flag tradeoffs before proposing a
> different navigation or visual identity.

Dhyan's instructions and the project's architectural/security requirements
take precedence over this external reference. When an adapted rule is unclear,
consult its linked Apple HIG source and the applicable web standard rather than
treating the repository as an exhaustive or authoritative compliance checklist.

## Other design skills — surveyed 11 September 2026

Searched the installed skills, the claude.ai skill catalogue and the plugin
catalogue for anything that generates this look. **Nothing in either catalogue
matches "HUD", "sci-fi interface", "instrument panel" or "telemetry dashboard",
and no skill produces a whole website in a house style.** The aesthetic comes
from the tokens in this repository; a skill can only review or assist.

What is already installed and worth using, in order of usefulness here:

| Skill | Use it for | Caveat |
|---|---|---|
| `interfaces:better-ui` | Concentric radii, optical alignment, surface depth, hit areas — exactly the details a bracketed panel gets wrong | Operates on this repo directly, unlike the Apple reference below |
| `interfaces:better-colors` | Building the `--rule` / `--grid-line` / `--readout-label` tokens and checking contrast on the dark panel | Semantic tokens only; will not invent the palette |
| `interfaces:better-typography` | The uppercase-label rule, tabular numerals, the figure scale | Must be told Doto and Space Mono are fixed |
| `dataviz` | Every readout rail, sparkline, meter and stat tile. Read it *before* writing chart code | Ships its own palette — swap for the tokens in `src/index.css`, do not adopt it wholesale |
| `interfaces:better-layout` | Bento composition, reading order, progressive disclosure | — |
| `interfaces:better-accessibility` | The 4.5:1 and `aria-hidden` obligations above | — |
| `interfaces:better-interface` | A single combined pass across all of the above | Broad; use once per page, not per change |
| `design` | Drafting an instrument panel as a canvas mockup before committing React | Produces a published Artifact, not site code |

`artifact-design` and `artifact-diagramming` govern published Artifacts only and
have no bearing on the site's own presentation.

Suggested brief for a combined pass, once a first panel exists:

> Run `interfaces:better-interface` over the finance overview and the travel
> map. Follow `DESIGN_SYSTEM.md`, especially *Instrument panels*. Doto, Space
> Mono and the palette are fixed. Judge the panel against the 12px uppercase
> floor, 4.5:1 on the blended background, tabular figure alignment, and whether
> every readout maps to a computed value. Report evidence and prioritised fixes.

## Review checklist

1. Check light and dark mode at phone, tablet and desktop widths, plus a short
   landscape viewport. Confirm content scrolls without moving the app frame.
2. Inspect real long titles, missing images, empty/loading states and error states.
3. Exercise navigation, filters, search and dialogs by keyboard and touch.
4. Check text over the strongest gradients, selected controls and chart legends.
5. Check reduced motion and reduced transparency, including the fallback when
   backdrop blur is unavailable.
6. For finance, review a signed-in session with existing data before release.
   The local visual checks used actual shared components with clearly
   labelled illustrative figures; authenticated finance flows were not tested.
7. For an instrument panel: confirm every figure traces to a computed value,
   decorative marks are `aria-hidden`, figures align on the decimal, the panel
   works in the light theme, and nothing animates without a value changing.
8. Run the project's lint, application and function typechecks, build and
   launch-readiness scan. Refresh graphify after code changes.

## Sources of truth

- [Colour tokens](src/index.css)
- [Surface composition and route accents](src/theme/surfaces.css)
- [Theme implementation guide](src/theme/README.md)
- [Font contract](src/theme/fonts.ts)
- [Typography scale](src/theme/typography.ts)
- [App frame](src/components/layout/AppShell.tsx)
- [Existing architecture and finance constraints](REHAUL_PLAN.md)

This document guides presentation. The architectural and security rules in
`AGENTS.md` and `REHAUL_PLAN.md` continue to govern behaviour and data handling.
