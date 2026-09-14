# State

Volatile. Rewritten, never appended. Over ~60 lines means a task finished
without being closed — move it into `REHAUL_HISTORY.md` and delete the lines.

**Updated:** 2026-09-14 · **Branch:** `feat/watchlist-news-finance-transfers` · **Head:** 4 commits over `eed35ab8`, not pushed

## Checks — run 2026-09-14 against the working tree

`lint` 0/0 · `typecheck` clean · `typecheck:functions` clean · `test` 573
passing in 37 files · `build` clean.

## Applied where

Migrations through `20260913090000_watchlist_created_at_unbackfill` are applied
to the remote project, which `.env` also points the dev server at. Nothing
unapplied. Platform-change trigger verified by the 2026-09-14 06:00 cron.

## Done — committed on the branch, not pushed

Four commits over `eed35ab8`: subagent rosters; finance transfer detection,
`admin_users` and merchant logo hardening; the watchlist News page; docs.
`reviewer` ran first and found no commit blocker. Detail in
`REHAUL_HISTORY.md` Part 5.

- **Watchlist News** — verified in the browser at 1440px and 375px.
- **Platform and status change tracking** — verified by the 2026-09-14 cron.
- **Transfer detection** and the image-fetch SSRF fix — verified locally.

## Next

1. **The two high review findings** — the brand search in `merchant-logo-cache`
   follows redirects to any host; `00_admin_users.sql` cannot build from empty.
   Every finding: `REHAUL_PLAN.md` Part 2, review findings.
2. **One forward migration** for the applied-migration findings:
   `watchlist_events` insert path, `GRANT ALL` on `finance_transfer_links`, the
   view's missing `REVOKE` and its season-0 filter.
3. **Medium findings** — News hooks show fetch failures as empty; `text-[10px]`;
   `select('*')` on `finance_profiles`; silently stale transfer links.
4. **Still open from the 2026-09-12 review** — `merchant.ts:118` wrong logos;
   `AuthContext.tsx:22` comment vs literal. **Transfer gaps** (plan 8.H):
   dashboard and budget spend still count transfers; single legs undetected.
5. **Push and open a PR** once item 1 is fixed; then regenerate types.
6. **Landscape backdrops** for dark-topped posters. **Not built:** pin UI,
   trailers, stalled-show detection, a watched state for films.

## Open findings

Budget legend mixes currency with percent; `memoji.png` retries unboundedly;
`40_finance.sql` REVOKE staleness. Everything else found is in
`REHAUL_PLAN.md` Part 2, review findings.

## Unverified

Watchlist: a genuine announcement and the pinned Countdown have never been seen with data. Favourite sync never run. Review-queue keyboard loop inconclusive. Budget dialog, goal picker, design-pass sizes: unseen.

## Blocked

7.6 / 7.9 / 7.K need any model key. Decisions: card radius, public demo
profile, FCA framing. `BRANDFETCH_CLIENT_ID` unset on production.
