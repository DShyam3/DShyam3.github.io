# State

Volatile. Rewritten, never appended. Over ~60 lines means a task finished
without being closed — move it into `REHAUL_HISTORY.md` and delete the lines.

**Updated:** 2026-09-15 · **Branch:** `main` · **Head:** `45083ad1`, pushed and deployed

## Checks — run 2026-09-15 against `45083ad1`

`lint` 0/0 · `typecheck` clean · `typecheck:functions` clean · `test` 573
passing in 37 files · `build` clean · `ship-check` 98/100, 0 blockers.

## Applied where

Migrations through `20260913090000_watchlist_created_at_unbackfill` are applied
to the remote project, which `.env` also points the dev server at. Nothing
unapplied. Platform-change trigger verified by the 2026-09-14 06:00 cron.

## Done — on `main` and live

`main` is at `45083ad1`: the EDC showcase commit, subagent rosters, finance
transfers with `admin_users`, the watchlist News page, docs, and the two high
review fixes. Pages deploy run `34942350787` succeeded on 2026-09-15, and the
live `/watchlist` serves the News page.

- **Watchlist News** — verified in the browser at 1440px and 375px, and live.
- **Platform and status change tracking** — verified by the 2026-09-14 cron.
- **Transfer detection** and the image-fetch SSRF fix — verified locally.
- **Both high review findings fixed.** **Not deployed:** `merchant-logo-cache`
  still runs the old code until redeployed. **Unverified:** the schema's
  from-empty build (Docker down; checked by reading).

## Next

1. **Redeploy `merchant-logo-cache`** so the redirect fix is live
   (`supabase functions deploy merchant-logo-cache`), then regenerate types.
2. **One forward migration** for the applied-migration findings:
   `watchlist_events` insert path, `GRANT ALL` on `finance_transfer_links`, the
   view's missing `REVOKE` and its season-0 filter.
3. **Medium findings** — News hooks show fetch failures as empty; `text-[10px]`;
   `select('*')` on `finance_profiles`; silently stale transfer links. Every
   finding: `REHAUL_PLAN.md` Part 2. `ship-check` also flags a possible N+1 in
   `FinanceDataContext.tsx`, a circular import and console logging.
4. **Still open from the 2026-09-12 review** — `merchant.ts:118` wrong logos;
   `AuthContext.tsx:22` comment vs literal. **Transfer gaps** (plan 8.H):
   dashboard and budget spend still count transfers; single legs undetected.
5. **Landscape backdrops** for dark-topped posters. **Not built:** pin UI,
   trailers, stalled-show detection, a watched state for films.

## Open findings

Budget legend mixes currency with percent; `memoji.png` retries unboundedly; `40_finance.sql` REVOKE staleness. Everything else found is in `REHAUL_PLAN.md` Part 2, review findings.

## Unverified

Watchlist: a genuine announcement and the pinned Countdown have never been seen with data. Favourite sync never run. Review-queue keyboard loop inconclusive. Budget dialog, goal picker, design-pass sizes: unseen.

## Blocked

7.6 / 7.9 / 7.K need any model key. Decisions: card radius, public demo profile, FCA framing. `BRANDFETCH_CLIENT_ID` unset on production.
