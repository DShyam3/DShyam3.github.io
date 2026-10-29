# State

**Updated:** 2026-10-29 · **Branch:** `codex/birthday-count-handoff` · **Deployed code:** `7baaed66`
**Hosted/local schema last recorded:** `20261027220000` · **Hosted Postgres:** 17.11.0.003 · **Local:** 15

## Deployed birthday fix

Birthday count fixes merged via [PR #12](https://github.com/DShyam3/DShyam3.github.io/pull/12) on October 29.
[Pages 40834582020](https://github.com/DShyam3/DShyam3.github.io/actions/runs/40834582020) succeeded October 29. Attach/detach and the
inline toggle adjust custom counts by the actual 0.5/1 birthday day, refusing invalid/insufficient counts.
Birthday deletion restores the first regular covering holiday; half-day badges use count. Review passes after the inline half-day correction; no schema change.
Original checkout at `28afd3da` has concurrent dirty finance/holiday/student-loan/employer/resume work; preserve it.

## Deployed and live evidence

- Shared tax engine/typed benefits `038bfe80` deployed (Pages `40589284379` succeeds).
  Birthday guards `27ca4669` and schema `20261027220000` are recorded hosted/local,
  with all four constraints validated. Newer shared-engine/holiday behaviour is not verified live.
- Calculator PR #11 merged `2fe8ff56`; Pages `40542898572` succeeded Oct 27.
  Live synthetic England £110k: tax £33,432, NI £4,210.60, take-home £72,357.40,
  marginal 62%; Scotland £70k tax £17,382.05. Hero screenshot verified at 720px.
  The 375px override was ineffective: phone layout was NOT checked.
- Current Finance verification is blocked: Chrome session expired and redirects home;
  password field is empty. User was asked to sign in; no response yet. No new live write verified.
- Books PR #10 deployed; admin unchanged-field Save and Open Library lookup verified Oct 27.

## Checks

| Check | Date | Result |
| --- | --- | --- |
| Isolated lint / both typechecks | 2026-10-28 | Pass; lint 0 errors / 0 warnings |
| Isolated tests / build | 2026-10-28 | 1,695 tests / 61 files pass; build passes |
| Isolated graph | 2026-10-28 | Refreshed: 1,919 nodes / 4,311 edges |
| Isolated ship-check | 2026-10-28 | 98/100 Beta; 9 findings, 1 high, 0 blockers |
| Review | 2026-10-28 | Pass after inline half-day correction |
| Earlier local shared-engine browser | 2026-10-27 | Scotland £60k gives £39,112 take-home on both pages; benefits and year browsing pass locally |

## Next

1. Verify deployed birthday-count behaviour after sign-in; signed-in live verification remains open.
2. Verify deployed shared engine, typed benefits and holiday controls; local checks are not live checks.
3. Plan 8.H: sick-day handling/dedupe, standalone birthday maximiser recommendation, Settings labels,
   copy accessibility, dead code and outdated long holiday-tracker description remain.
4. Tax engine follow-ups: additional tax years, student-loan threshold source and Settings band fields;
   unused calculateFinance parameters remain a review nit. Borrowed/Edit consolidation remains open.
5. Owner enrols authenticator; verify hosted auth and post-upgrade cron/edge/pg_net execution.
6. Books: 45 covers, 97 descriptions, 14 ambiguous entries; progress/series/ISBN/statistics remain planned.
7. Owner decides local Postgres 15→17 reset and deletes unused VITE_TMDB_BASE_URL Actions secret.
   Continue plan security items, schema rebuild from empty and Node 24 CI.

## Blockers and open risks

- Signed-in live writes (leave, Paid/untick/early payment, uploads/CV/links) remain unverified.
- Safari/Firefox, physical phones, 375px, 200% zoom, real HEIC and non-UK stored dates unchecked.
- Local settings/holiday rows still contain prior test fixtures; local thresholds differ from hosted.
- Authenticator flows local-only; post-upgrade execution and signed-in TrueLayer v48/logo-cache v15 unverified.
- IPv6 /64 live path unverified; finance save-safety/races and hosted read measurements remain open.
- Per-row saves retained by decision; external-image privacy, Watchlist cron CPU and sync-race verification open.
- Parser override validated for this install/tests/CSS only; CI Node 20/Ubuntu transition unchecked.
- Unmerged admin assistant remains outside this release; remaining work is in REHAUL_PLAN.md.
