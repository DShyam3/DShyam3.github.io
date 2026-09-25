# Rehaul Plan

What is left, and the decisions behind it.

Phases 0-6 are done. Phase 7 — the finance rehaul — has largely landed: every
condition in its own definition of done is met, and what remains is listed in
Part 2. Phase 8 — the collections feature layer, covering the five surfaces
Phase 7 did not touch — is opened in Part 3 and has not started.

| Read this | For |
|---|---|
| `STATE.md` | where things stand *right now* — branch, last green checks, the task in hand. Short and volatile; this file wins wherever the two disagree |
| `AGENTS.md` | the rules that bind every change |
| `FEATURES.md` | what the site actually does today |
| `REHAUL_HISTORY.md` | the 2026-09-04 audit, phases 0-6, and every Phase 7 decision that has closed — including the reasoning behind the rules summarised in Part 1 |
| `DESIGN_SYSTEM.md` | how the UI is built |
| `SECURITY.md` | what is set, what cannot be, and why |

**Section numbers are stable, the file they live in is not.** Code and
migration comments cite `REHAUL_PLAN.md 7.B`, `7.C`, `7.D`, `7.N`, `7.P` and
Part 0.5. Those sections closed and moved to `REHAUL_HISTORY.md` Part 4 under
the same numbers, so the reference still resolves — look there first if a
number is not below.

Audit date: 2026-09-04. Plan cut back to what is left on 2026-09-12; Phase 8
added the same day.
Supabase project: `yvtiybyuifkiwyrnjebe` (Personal_Website, eu-west-2,
Postgres 15.8.1.030).

---

## Part 1 — Decisions that still bind

Settled, and still the rule. Each one is stated here in the form that governs
the next change; the argument that produced it is in `REHAUL_HISTORY.md` Part 4
under the same number.

### The test everything is measured against

**Easy to view, easy to find things, lean.** Not "well-architected" in the
abstract — a change earns its place only if it makes the project smaller or
makes something easier to locate. Judged by findability rather than line count:
that is why the `features/` reorg was reinstated after being dropped for
relocating files without reducing them.

### The model boundary (7.P, 7.Q, 7.F)

Stated as rules in `AGENTS.md` → *How AI is used in this project*, which is the
copy to read before writing code. The reasoning is in history. Three
consequences bind future work rather than describing past work:

- **No feature may hard-depend on a model.** With no key set, everything works
  except the chat box. Any new figure is computed here, from rows, and tested.
- **A model may choose, phrase and explain; it may never compute.** Anything
  reproducible — a balance, a projection, the standing summary — is rules over
  rows. Extending `deriveAlerts` is how "everything in one place" gets built.
- **7.F embeds extracted records, never document text.** `entity_type =
  'document_chunk'` would ship raw payslip text to a third party through a
  different door than the one 7.P closed. If raw text ever genuinely needs
  embedding, that is a reason to self-host the embedding model, not to relax
  the rule.

### Open Banking gives a window; the local store is the record (7.M)

Consent lapses and provider depth varies, so bank-sourced rows are **upserted
and never pruned**. Two facts that shape any future work on the integration:

- The deep history fetch has to happen while the customer is present — at
  connect, and again after each re-consent. Several providers return a short
  window to background polling and their full retained history to an attended
  session. A nightly cron gets the short window by design.
- TrueLayer transaction ids are not stable across the pending-to-settled
  transition, so ingest settled rows only. Deduping on a pending id
  double-counts.

True cursor pagination would mean moving to the Data API v3 connected-accounts
product — client credentials, a different connection lifecycle. That is an
integration migration, not a query-string addition.

### Hosting portability (7.I)

The site is on GitHub Pages and may be self-hosted later. The coupling is
narrow and self-hosting is mostly an *upgrade* — three of the four unmet items
in the vibe-check Security Headers list are unmet only because there is no
server. Keep it that way:

| Thing | Where | On a self-hosted server |
|---|---|---|
| CSP delivered as `<meta>` | `inject-csp-meta` plugin, `vite.config.ts` | becomes a real response header; `frame-ancestors` starts working |
| `frame-guard.ts` standing in for `X-Frame-Options` | `src/main.tsx` | header does the job; keep the guard as defence in depth |
| `X-Content-Type-Options`, `Permissions-Policy` unset | `SECURITY.md` "cannot be set" list | both become settable |
| HSTS inherited from `github.io` | `SECURITY.md` | ours to set, with `includeSubDomains` |
| SPA fallback via `cp dist/index.html dist/404.html` | `postbuild` script | a `try_files` / rewrite rule |
| Chunking tuned for cold CDN round trips | `manualChunks`, `vite.config.ts` | still correct, reasoning just stops being Pages-specific |

Rules that keep the door open:

- `lib/finance/` imports no React, no Supabase, no `import.meta.env` and no DOM
  API. Browser today, server process later, same code.
- Anything model-facing or document-facing is written against a typed HTTP
  boundary, not the Edge Function SDK.
- Storage access goes through one module, not scattered
  `supabase.storage.from(...)` calls.
- **No new `<meta>`-based header workarounds.** They are dead weight on a real
  server and the existing three are enough.

Self-hosting the site does not move Supabase, and self-hosting Supabase does
not require moving the site. Neither is assumed. `SECURITY.md` documents what
is true today; it gets revised at migration, and the table above is the
checklist.

### Consumer credit files have no API (7.G)

Experian, Equifax and TransUnion do not sell consumer credit-file API access to
individuals, the resellers expose no public API, and Open Banking carries
account data rather than bureau files. Automated bureau sync needs a contracted
or licensed entity — a later phase, if ever.

The normalised model, manual capture and PDF evidence are built, so an adapter
drops in behind the same interface when a contract exists. ADR-002 applied as
intended.

### Three deliberate non-builds

Each was measured or reasoned rather than skipped, and each carries the
condition that would reopen it.

- **Per-surface queries (7.E-pre).** Eighteen tables load on mount, in
  parallel, so the mount costs one round trip rather than the sum. Cutting to
  seven would still be one round trip — the saving is in database work, not in
  anything the reader waits for. *Revisit* when a finance table passes ~1,000
  rows, or when switching profiles refetches two full ledgers often enough to
  notice.
- **Alert delivery (7.E-pre000).** Every alert is a pure function of the
  current position and today's date, so it appears and disappears on its own
  with nothing stored and no second source of truth. Push or email needs a
  service worker or a mail provider *plus* a record of what has already been
  sent, and that last part is what makes it a feature rather than a wrapper.
  Not worth building before the alert set settles.
- **Four reference tables keep delete-then-insert (7.E-pre2).**
  `finance_recurring_templates`, `finance_credit_bureaus`,
  `finance_holiday_defaults` and `finance_budget_presets` insert rows with no
  `id`, so there is no client-side identity to upsert against — upserting would
  duplicate every row on every save. Closing it means natural unique keys
  (`(preset_type, name)`, `month_index`, `key`) and a migration. Left undone
  because the blast radius is seed data the code can regenerate
  (`ALL_PRESETS_FALLBACK`, `DEFAULT_RECURRING_TEMPLATES`,
  `DEFAULT_CATEGORY_TEMPLATES`), not money. *Revisit* if these stop being
  regenerable from code.

---

## Part 2 — What is left

### Review findings, 2026-09-14 — fix before the next feature

`reviewer` ran over the work committed as `3841f031`, `d99817ac` and
`ef50501e` and found no commit blocker. What it did find, most severe first.
Rows marked *applied* sit in migrations already run on production, so each
needs a forward migration rather than an edit.

| Severity | Where | Problem | Fix |
|---|---|---|---|
| Medium | `useWatchlistNews.ts`, `useUpNext.ts` | Every hook turns a failed query into "Nothing this week" | Return `error`; render a failure line |
| Medium | `CountdownCard.tsx:96,111`, `WatchlistNews.tsx:120` | `text-[10px]`, below the 12px minimum | `text-xs` |
| Low, applied | `20260912140000_watchlist_events.sql` | An admin can insert events directly; the trigger was meant to be the only writer | `SECURITY DEFINER` trigger; drop the insert policy and grant |
| Low, applied | `20260912090000_watchlist_up_next.sql:103` | The view has no `REVOKE ALL ... FROM anon` before its grant | Revoke, then grant SELECT |
| Low, applied | `20260912100000_watchlist_8c.sql:102` | The `pinned` comment claims enforcement that does not exist | Correct the comment |
| Low | `watchlist_up_next` view | No season-0 filter, so a special can lead Watch Next | `season_number > 0`, in the same forward migration |
| Low | `useWatchlistNews.ts:18` | UTC date string against local-midnight filters, off by a day 00:00–01:00 in BST | Build the date from local parts |
| Low | `AuthContext.tsx:57` | One failed `is_admin` call on token refresh drops admin mid-session | Keep the last answer per user; add a timeout |
| Low | `src/integrations/supabase/types.ts` | Hand-written blocks now stale; new tables untyped | Regenerate types; remove the casts |
| Low | `merchant-logo-cache/index.ts:491` | Index row deleted even when its storage object was not; dead `MIN_OCCURRENCES` | Delete only removed rows; drop the constant |
| Low | `useWatchlistNews.ts:393,442` | Events for deleted titles render blank; announcements query uncapped | Filter missing titles; order and limit |
| Low | `WatchlistNews.tsx:432,522` | Recent episodes fetched twice, for 7 and 30 days | Fetch 30, derive 7 |
| Low | `FEATURES.md:104` | Merchant logos claimed while `BRANDFETCH_CLIENT_ID` is unset in production | Set the secret, or qualify the line |
| Low | `README.md`, `supabase/README.md` | Still describe `is_admin()` as an email literal and an `ADMIN_EMAIL` secret | Rewrite for `admin_users` |
| Low | `.gemini/agents/*.md` | No `model:` line, so tiering does not apply to Gemini | Set verified model ids |
| Low | `WatchlistNews.tsx` `UpdatesList` | Duplicate React keys (`status-tv_show-335`, `platform-movie-1419`, seen 2026-09-25), so rows can be dropped or repeated | Key by the event's own id, or dedupe the feed |

### Layout containment — what is left

The middle card landed: one framed scroller per route, toolbars that pin only
where they fit, Travel's workspace mode, the income overview, and the nested
caps released (`FEATURES.md`, `DESIGN_SYSTEM.md` responsive contract; the
decisions are in `REHAUL_HISTORY.md`). Public routes were checked in the
browser; Finance was not, because it needs a signed-in session.

| Item | Why it is open |
|---|---|
| Signed-in pass over Finance | Income overview, compensation header, Transactions panes and released caps are covered by typecheck and tests only |
| Transactions below 1024px or 720px tall | The list keeps a pane capped to the measured card height (16rem floor) so the inspector stacked under it stays in reach. Open the inspector as a sheet on selection, then drop the cap |
| Toolbars that wrap to many rows | Inspiration's filters take four rows (291px) at 768px, so the band unpins and scrolls away. A disclosure for secondary filters would let it pin |
| Real devices | iPhone Safari toolbar and keyboard, iPad split view, Larger mode, 200% zoom. The pin rule re-measures on resize through `ResizeObserver`, which a hidden preview pane pauses, so only the on-load measurement is verified |
| Dialog audit | Statement and investment imports and the EDC builder may still nest a `vh` cap inside `.dialog-body`; payslip and benefits dialogs are done |
| Watchlist episode dialog | Deliberate split panes; audit their heights on short and narrow screens on their own |
| Further consolidation | Where a finance hero repeats its first section's figure, keep one. Audit each pair; remove nothing without a home for every figure and action |
| Home View All | Expands inline. A capped preview linking to Transactions is a product decision, not containment work |
| Extreme-height fallback | A document-flow shell for very short windows or high zoom is not built. Build it only if a measured failure needs it |

### Unblocked, and the only implementation items outstanding

A **product catalogue is a different feature** and there is no free source for
UK card terms — the comparison sites are affiliate networks under commercial
agreement, the issuers publish marketing pages. Structure it as 7.G structures
bureau data: a `finance_card_products` table seeded by hand today, fed by a
provider later, with the recommendation logic written against the table rather
than against whatever fills it.

**Open:** no account interest rates (AER) are stored; the 10% APR bound in the
costly-debt alert stands in for what cash earns. Storing AER would let the rule
compare debt against actual cash rates. Also: `finance_student_loan_rates.bank_rate_percent`
is NULL in every seeded row.

### Student loan — pending top-up and refund direction

**Still unverified:** the 6-month landing lag and refund direction (added to
balance, not deducted). Needs confirmation against owner's SLC 2026-27 adjustment
when it lands. Consider whether the pending top-up should compound interest while
awaiting landing (~2–3% lifetime understatement versus full-rate accrual, currently
documented approximation).

### Blocked on a model key — any provider

The assistant is provider-agnostic by construction. There are not N vendor
integrations to write; there are two wire protocols and a list. Almost every
vendor speaks OpenAI's `/chat/completions` shape (Moonshot/Kimi, DeepSeek,
Mistral, Groq, xAI, Together, OpenRouter, anything local behind Ollama or
vLLM), and Anthropic speaks its own. `lib/finance/llm.ts` translates both;
adding a provider is a registry row — id, protocol, base URL, model, which
secret holds the key — and never an edit to that file.

The registry stays server-side. A client that could name a URL rather than an
id would be an SSRF hole with a friendly name; it names an id, and the Edge
Function resolves it.

So the gate is *a* key, not a particular vendor's:
`supabase secrets set <PROVIDER>_API_KEY=...`.

- **7.6 assistant** — schemas, executor, context and protocol translation are
  all written. What is missing is the Edge Function and a key.
- **7.9 embeddings** — a third-party call, so hybrid retrieval needs an
  embedding key or a self-hosted model. Embed extracted records, per Part 1.
- **7.K tax news** — tax *rates* are data and shipped; tax *news* is content,
  needs a source and a model, and must not be conflated with the ledger.

Automated document extraction is the one capability that genuinely differs
between vendors, so it wants checking against whichever model is chosen rather
than assumed to port. Nothing else waits on this: payslips and credit reports
extract in the browser.

### Needs a decision, not a keyboard

| Question | Why it is stuck |
|---|---|
| `rounded-xl` (126) vs `rounded-lg` (314) | Changes every card corner in the section. A look, not a cleanup |
| Public demo profile | Decided in principle, never scoped. Changes what the anon role may read |
| FCA framing | Recommending specific financial products to UK consumers is a regulated activity. Guidance built so far is phrased as information only (names debt rates, spare cash and utilisation, never steers); this row now matters only for a product catalogue or public profile feature |
| Hosted multi-user vs self-host template | Every RLS policy is `is_admin()`; no policy uses `auth.uid()` and `finance_profiles.owner_user_id` is read by nothing. A hosted version means per-owner policies on every table, per-user TrueLayer and document isolation; a template needs none of that |
| Live shared finance templates | The `is_default` rows are the owner's: 15 recurring templates (Netflix, Hulu, ASPCA…, each name stored twice) and 32 default budget items (Phone (O2), Sky, Crunchyroll…). They override the generic code defaults for new profiles and "reset to defaults". Replacing them is a live data change |

### Public version (UK-only) — what is left

The code no longer names the owner outside `src/config/site.json`
(REHAUL_HISTORY.md, 2026-09-24). Still open:

- Investment import reads only Trading 212 and Kraken CSVs; a column-mapped
  importer would be a feature, not a fix.
- `STUDENT_LOAN_DEFAULT_ASSUMPTIONS` in `student-loan.ts` holds dated figures
  (RPI 4.1, base rate 3.75, threshold 52,885) used when no rates row exists.
- README clone URL and admin email, SECURITY.md project ref. Applied
  migrations `20260904130000` and `20260911090000` carry the owner email; a
  fork needs its own `admin_users` seed step documented instead.
- `BankAccountsSection.tsx` `providerLogoUris` is dead code.

### Deferred by choice

7.2e (measured, not worth building), 7.12 delivery, 7.13 contacts and
settlements, 7.14 property, bureau API adapters (7.G — needs a contract, not
code).

### The order

1. **A key**, then 7.6 and 7.9.

The ordering principle: data before features, and anything that silently
produces wrong numbers before anything that produces new ones.

---

## Part 3 — Phase 8, the collections feature layer

Phase 7 made the finance section deep. Phase 8 makes the other five surfaces
useful rather than merely present. **The number is claimed here.**
`REHAUL_HISTORY.md` predates this section and uses "Phase 8, if ever" to mean
*some later phase*; read those as unscheduled, not as this. The audit that produced it was a survey of
what the comparable products do — Sequel and Trakt for the watchlist, Are.na
and Raindrop for collections, Polarsteps and Flighty for travel, Kit.co and
LighterPack for inventory — and the finding was not a feature list. It was
that **almost every headline feature in those products is a network effect**:
friend activity, public lists, leaderboards, social feeds. None of that
survives the translation to a single-user site, and none of it is below.

What does survive is the half those products build on top of data the user
already gave them. This site holds six such datasets and is the only thing that
holds all six.

### 8.0 Derive before fetch

The rule this phase adds, and the reason it is a rule rather than a preference.

TMDB exposes `next_episode_to_air`. It was nearly added to the
`append_to_response` in `useTMDB.ts` before anyone checked what
`tv_show_episodes` already stores — which is `release_date`, `watched`,
`runtime` and `title`, per episode. The TMDB field answers "what airs next for
this show"; the rows answer "what should *I* watch next", which is the actual
question and cannot be fetched from anywhere. Deriving was both cheaper and
more correct.

Generalised: **before adding a field to an API call, establish that the answer
is not already in the tree.** The same check killed the snapshot table that was
going to power the announcements feed — a `created_at` default on the season
rows carries the same information, because the sync inserts the row at the
moment TMDB gains the season.

This is the 7.P boundary pointed at a different problem. There, a model may
choose but not compute. Here, a vendor may supply what only it holds, but not
what the rows already answer. Both exist because the imported answer is
impossible to audit once it is rendered.


### 8.B Two columns, and what must not be backfilled

Neither column needs a TMDB call. Both change what is derivable.

**`tv_show_episodes.watched_at timestamptz`** — the `watched` boolean records
that an episode was seen and destroys when. Without a timestamp there is no
stalled-show detection, no watch history, and no year in review. It is the
cheapest column in this phase and it gates four features.

**It must be left null for existing rows.** Backfilling to `now()` would state
that every episode ever watched was watched on the migration date, and a
fabricated timestamp reads exactly like a real one — the same failure 7.P
exists to prevent, in a column rather than a sentence. Every consumer treats
null as *watched, date unknown* and excludes it from anything time-bucketed.

**`created_at timestamptz not null default now()`** on `tv_show_seasons` and
`tv_show_episodes` — the announcements feed is `where created_at > now() -
interval '7 days'`, because the sync inserts a season row exactly when TMDB
gains the season.

The trap is the same one inverted: backfilled rows all take the migration
timestamp, so on day one the feed claims the entire library was announced at
once. Three ways out were considered — seed the backfill to the show's own
`release_date`, stamp it and gate every consumer on a fixed floor of the
migration's timestamp, or leave pre-existing rows null.

**Null won, and this paragraph originally chose the floor.** Both leave the
feed empty for a week, so they differ only in what happens afterwards. The
floor is correct exactly as long as every future consumer remembers a magic
constant that nothing enforces; null is correct by construction, because
`created_at > <cutoff>` is UNKNOWN for a null row and it drops out of a rolling
window on its own. It also makes the column agree with `watched_at` directly
above it rather than arguing against it.

One Postgres detail makes or breaks this: `ADD COLUMN ... DEFAULT now()`
backfills every existing row **even when the column is nullable**. The column
has to be added bare and given its default in a second statement, or the
fabrication arrives anyway.



### 8.D Three primitives, still to build

The watchlist news redesign ships with a countdown component built for that
surface only. The three items below are needed only when a second surface (Travel,
Finance or Inventory) needs the same mechanics.

**The countdown.** A `{ label, date, href, image }` component, serving show
releases, trip departures, warranty expiries and goal dates. The watchlist has
one; do not duplicate it elsewhere until a second surface needs one. Then write
it once, outside all surfaces, and import it three ways.

**The change feed.** Snapshot or insert-timestamp, then diff. Powers watchlist
announcements today; when dead links, subscription price rises or new books in a
tracked series need signalling, `watchlist_events`'s shape scales — `{ surface,
entity_id, kind, occurred_at, payload }` — and one renderer serves them all.

**Year in review.** One statistics engine over rows, six surfaces feeding it:
episodes and hours, countries and distance, books and pages, spend, cost per
wear. It is arithmetic over rows, so 7.P applies in full — computed in
`lib/`, tested, never generated. Unblocked; this is pure function territory.

### 8.E Collections

| Surface | Item | Note |
|---|---|---|
| Links | Auto-metadata on paste — title, favicon, description, OG image | the add form asks for all of it by hand today |
| Links | Dead-link check on a cron, flag non-200 | a links page rots silently; highest value on this surface |
| Links | Archived text on save | survives the source disappearing |
| Links | Recently added rail, domain rollup | query only |
| Books | Currently reading with progress | gives the page a present tense |
| Books | Series position — book 3 of 5 | |
| Books | ISBN autofill via Open Library | free, open, no key: `openlibrary.org/isbn/{isbn}.json` |
| Books | Reading statistics — pages per month, genre split | feeds 8.D |
| Articles | Read / unread, estimated reading time from word count | |
| Articles | Text archived on save | same rot problem as Links |
| Recipes | Import from URL via `schema.org/Recipe` JSON-LD | open standard, most recipe sites emit it; the largest single win here |
| Recipes | Serving scaler | **requires quantities stored as `{amount, unit, item}`, not prose. Decide before the table fills** |
| Recipes | Cook mode — step view, screen held awake via the Wake Lock API | small, disproportionately good |
| Recipes | Made-it log — date and note per cook | turns a list into a record |
| Photos | EXIF extraction on upload — camera, lens, aperture, date, GPS | in-browser, same pattern as payslip extraction |
| Photos | Group by camera and lens; GPS feeds Travel | free once EXIF is stored |
| Thoughts | Epistemic status and last-reviewed per entry | |
| Beliefs | Belief changelog — record the change, not only the current view | the point of a Beliefs page; without it the page is a list of assertions |
| Beliefs | Backlinks between entries | |

**The recipe quantity decision is the only one here that expires.** Every other
item can be added to a populated table; a serving scaler cannot be retrofitted
onto free-text ingredients without re-entering them.

### 8.F Travel

Trips are the prerequisite: cities grouped into dated trips, which every other
item below depends on. Then route lines between a trip's stops (visual only, no
new data), statistics for 8.D — countries, continents, furthest point, distance
— a next-trip countdown from 8.D, city notes, and passport and visa expiry
against the same countdown. A flight log is worth it only at volume.

### 8.G Inventory and EDC

| Item | Note |
|---|---|
| Purchase date, price, warranty expiry | expiry feeds the 8.D countdown |
| Cost per wear or per use | price divided by uses. Arithmetic over rows, so 7.P applies: `lib/`, tested. The most interesting number on the surface |
| Active loadout — what is carried today, with history | |
| Retired rather than deleted | sold and replaced items are history |
| Total loadout weight | needs a weight field; it is the number EDC actually argues about |
| Typed specs per category | dimensions, material, capacity as columns rather than prose |
| Link an item to its finance transaction | nothing off the shelf can do this, because nothing else holds both sides |

### 8.H Finance — the gaps Phase 7 left

Phase 7 covered the ledger. These are presentation and review, and each is
arithmetic over rows already held.

- **Categorisation review queue** — surface uncertain assignments for
  confirmation rather than assigning silently. This is the 7.P-compliant shape
  of the feature Copilot ships; straight auto-categorisation is not
- **Upcoming bills calendar** — recurrings rendered forward
- **Subscription audit** — price risen, or unused for N months
- **Merchant drilldown** — spend per merchant per year, off the existing
  merchant resolution
- **Safe to spend**, **net worth milestones**, **year in review** via 8.D

### 8.I Still to build (the order)

1. **Landscape backdrops for hero and countdown cards** — portrait posters with
   dark upper halves render nearly black. Store TMDB backdrops (`backdrop_path`)
   in the sync (`watchlist-cron-sync`) and the add flow, then use them behind
   the overlaid titles.
2. **Links dead-link check and auto-metadata**, the highest-value pair outside
   the watchlist, and the only unblocked item here.
3. **8.D primitives**, when a second surface needs the countdown or change feed.
   Do not refactor the watchlist's implementation on spec; refactor when you
   have two callers.
4. **Recipe JSON-LD import**, after the quantity shape is settled.
- **Store a watched state for films.** `movies` has no `watched` column, so
  the News page cannot hide finished films the way it hides finished shows.

The pin-setting UI and trailers depend on building the primitives in 8.D.
Stalled-show detection depends on `watched_at` backfill (8.B) and seeing real
data. Trailers need the TMDB `videos` field.

### 8.J Non-builds

Social and network features in full — friend activity, public lists, comments,
follows, leaderboards. They are what the surveyed products are *for*, and they
are the reason those products need accounts. This site has one user.

Also not built: Trakt or Simkl integration. Trakt's scrobbling only reaches
media played through a server this site does not run, and Simkl's Netflix
coverage depends on a Chrome extension holding a logged-in Netflix session and
reporting history to a service whose own consent notice names 210 advertising
partners. Neither clears the bar in Part 1 for what this site sends outward.
What was worth taking from Trakt is its `last_activities` delta shape, and the
`created_at` column in 8.B is that idea at a tenth of the cost.

---
## Appendix — Verification commands

```bash
npm run lint                 # 0 errors, 0 warnings
npm run typecheck            # application TypeScript (CI gate)
npm run typecheck:functions  # Edge Function Deno check (CI gate)
npm run test
npm run build
npm run ship-check           # launch-readiness scan, writes to .should-i-ship/
```

Supabase advisors after every migration phase:

```
get_advisors(project_id, type: "security")
get_advisors(project_id, type: "performance")
```

Expected steady state: security clean except the accepted `is_admin` RPC lints
(S-4); performance clean.
