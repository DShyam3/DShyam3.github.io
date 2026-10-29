# State

**Updated:** 2026-10-29 · **Branch:** `main` · **Status:** Landed Categorisation review queue & category rules, leave maximiser, take-home slices.

## Landed & Committed

- **Categorisation review queue & Category rules**: Uncategorised / Needs Review transaction filter, inline Category Rule helper ("Always for this merchant"), Rules dialog with pattern matching, target category, optional merchant rename, live match counts, and impact preview. Deterministic read-time rule derivation with strict precedence.
- **Leave maximiser & Take-home slices**: Optimal Leave Maximiser, half-day holiday tracking, Birthday Day Off leave integration, Take-home by tax band slices across thresholds.

## Checks

| Check | Date | Result |
| --- | --- | --- |
| Lint / typecheck / tests | 2026-10-29 | Pass: lint 0/0, typecheck pass, vitest 1,768/1,768 passed |
| typecheck:functions / ship-check | 2026-10-29 | Pass: ship-check 98/100, 0 blockers |
| Graph | 2026-10-29 | graphify update current |

## Next

1. Subscription audit (price risen or unused for N months).
2. Merchant drilldown (spend per merchant per year off existing resolution).
3. Transaction splitting across multiple categories.
4. Budget rollover derivation from history.
5. Investment pricing cache & allocation enhancements.

## Blockers and Open Risks

- Signed-in live browser verification on production environment pending.
- Real bank sync and TrueLayer credential testing against live endpoints.
