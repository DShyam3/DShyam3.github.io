# State

Volatile. Rewritten, never appended. Over ~60 lines means a task finished
without being closed — move it into `REHAUL_HISTORY.md` and delete the lines.

**Updated:** 2026-09-15 · **Branch:** `feat/watchlist-news-finance-transfers`

## Uncommitted work — three items

All three remain in the working tree, not yet committed or deployed.
`main` at `45083ad1` (deployed 2026-09-14).

1. **Finance surface nav on tablet (768–1023px).** All five surfaces fit on one line
   beside the profile picker. Verified at 768px via viewport emulation on mock nav;
   unverified on the signed-in page. Files: `src/features/finance/FinancePage.tsx`,
   `src/index.css`.

2. **Travel page on tablet (768–1023px).** Map takes a full-width row at top
   (clamp(16rem, 36vh, 24rem)), country list fills below with independent scroll.
   Verified at 768x1024. Files: `src/pages/Index.css`.

3. **Data fix on LIVE Supabase.** Already applied to yvtiybyuifkiwyrnjebe:
   `site_content` row exp_4bd1cb74-ee46-48ad-b50a-bdda1af6c4c0 (Lodestar Space)
   metadata.start_date "Ma 2025" → "May 2025". Not local, no FEATURES entry.

## Resolved, uncommitted

These two closed decisions remain uncommitted:

1. **Links categories.** Reorganised to: All, Dev Setup, Websites, iPhone, iPad, Mac.
   At 768px portrait the chips wrap to two lines — user accepted. Files:
   `src/collections/links.tsx`.

2. **About page layout.** Below 1280px, Experience spans full row; Education and Projects
   sit side by side beneath. At 768x1024: Experience text 600px, Education and Projects
   both 330px tall. Education entries still wrap at 216px text column — accepted. Files:
   `src/pages/Index.tsx`. FEATURES.md updated.

## Checks — green

2026-09-15:
- `npm run lint`: 0 errors, 0 warnings ✓
- `npm run typecheck` ✓
- `npm run build` ✓

Unverified:
- `npm run typecheck:functions`
- `npm run ship-check`
- Physical iPad (all layout checks via desktop viewport emulation)

## Next

Commit all changes
