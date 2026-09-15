# State

Volatile. Rewritten, never appended. Over ~60 lines means a task finished
without being closed — move it into `REHAUL_HISTORY.md` and delete the lines.

**Updated:** 2026-09-15 · **Branch:** `feat/watchlist-news-finance-transfers`

## Local work

`main` at `45083ad1` (deployed 2026-09-14).

**Local commit 8f350d6e** — responsive layouts and component refinements for
tablet and mobile. User decision resolved: kept. Gitlink removed from index.

**Uncommitted on top of 8f350d6e:**

1. **Home page: experience and education as one timeline.** Newest first, roles
   and degrees interleaved by start date. Undated entries sort last in stored
   order. Education add button shown to admins. Projects card spans full row on
   tablets. Files: `src/pages/Index.tsx`, new `src/lib/resume-timeline.ts` and
   `src/lib/resume-timeline.test.ts` (8 tests). Verified at 768x1024 and 1440x900.

2. **Data fix on LIVE Supabase:** row exp_4bd1cb74-ee46-48ad-b50a-bdda1af6c4c0
   (Lodestar Space) metadata.start_date "Ma 2025" → "May 2025".

## Changes from reviewer (Opus, 2026-09-15)

**Fixed before commit:**
- src/pages/Index.tsx: timeline admin edit/delete in flex flow, visible below
  lg (hover-reveal from lg), aria-labels name rows; comment corrected
- src/features/watchlist/WatchlistPage.tsx: Sync aria-label carries progress;
  title attributes removed (tripped 44px coarse-pointer button[title] rule)

**Open risks (carry forward):**
- src/components/ui/dismiss-on-release.ts:33 — touchend on any backdrop touch;
  needs start-point + movement threshold
- src/pages/WatchlistNews.tsx:102 — <h3> inside <button>
- src/pages/WatchlistNews.tsx:57 — NewsPosterCard duplicates WatchlistCard body
- src/components/shared/CountdownCard.tsx:25 — unused `compact` size
- src/collections/components/EntityFormDialog.tsx:408 — use useId() for form id

## Checks — green (2026-09-15)

- npm run lint: 0 errors, 0 warnings ✓
- npm run typecheck ✓
- npm run build ✓
- vitest src/lib/resume-timeline.test.ts: 8/8 ✓

Unverified:
- npm run typecheck:functions
- npm run ship-check
- Physical iPad
- Finance nav on real signed-in page
- Admin timeline controls on touch device

Known data typo (awaiting user):
- Ocean Infinity location "Southmapton, UK"

## Next

Push branch and open PR when user asks; address open review risks after.
