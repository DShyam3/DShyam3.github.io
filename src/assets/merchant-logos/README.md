# Bundled merchant marks

Route B of the transaction-logo work. Drop an SVG here named for a merchant's
**canonical slug** — the `slug` field of its row in
`src/lib/finance/merchant-directory.ts` — and that merchant renders with its
own mark, with no code change. `tesco.svg`, `co-op.svg`, `marks-and-spencer.svg`.

Nothing here is fetched at runtime: the files are bundled, hashed and served
from our own origin, so a logo costs no request to anybody else and reveals
nothing about who shops where. That is the whole reason this layer exists
above the cached-logo one.

Rules for a file that goes in:

- **SVG, single colour or brand colour, square-ish viewBox.** They render into
  a 32px tile, so anything with fine detail or baked-in padding reads as mush.
- **No `<script>`, no external `<image href>`, no remote `<use>`.** These are
  inlined into the bundle by URL, not sanitised.
- **Source it from the brand's own press or brand-assets page.** Marks are
  trademarks; using one to identify the merchant a payment went to is
  nominative use, altering it is not. Do not recolour or redraw.
- **Under ~10KB.** Run it through SVGO first.

A merchant with no file here still gets its directory label, its stable colour
and its monogram, which is the honest default rather than a gap.
