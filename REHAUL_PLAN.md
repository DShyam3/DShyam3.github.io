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
Postgres 17.11.0.003, upgraded in place from 15.8.1.030 on 2026-10-25).

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

### Layout containment — what is left

The middle card landed: one framed scroller per route, toolbars that pin only
where they fit, Travel's workspace mode, the income overview, and the nested
caps released (`FEATURES.md`, `DESIGN_SYSTEM.md` responsive contract; the
decisions are in `REHAUL_HISTORY.md`). Public routes were checked in the
browser. Signed-in Finance verification now covers Tax & Income and a synthetic
calculator scenario; the wider pass below remains open.

| Item | Why it is open |
|---|---|
| Signed-in pass over Finance | Income overview, compensation header, Transactions panes and released caps are covered by typecheck and tests only. Bills calendar, Forecast, recurring Paid and the Student Loan "You borrowed" figure were checked on the local stack on 2026-10-24, with test rows deleted after: tick, untick, due-day edit, Forecast at 375px, and an empty-date draw left out. Not checked: the early-payment button (its 7-day window cannot open for a monthly bill on 24 October; unit-tested only), and the wider live signed-in flows. Live Tax & Income and a synthetic calculator scenario with negative benefits cash impact render correctly; a 375px viewport has no document overflow. The category-rules loading error is cleared after migration and loader deployment, verified in a fresh signed-in tab on 2026-10-30. Light-theme smoke check passed at 1440px and dark was restored; the full cross-theme pass remains open |
| Transactions below 1024px or 720px tall | The list keeps a pane capped to the measured card height (16rem floor) so the inspector stacked under it stays in reach. Open the inspector as a sheet on selection, then drop the cap |
| Real devices | iPhone Safari toolbar and keyboard, iPad split view, Larger mode, 200% zoom. The pin rule re-measures on resize through `ResizeObserver`, which a hidden preview pane pauses, so only the on-load measurement is verified |
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
vLLM), and Anthropic speaks its own. `lib/assistant/protocol.ts` translates
both; adding a provider is a registry row — id, protocol, base URL, model,
which secret holds the key — and never an edit to that file.

The registry stays server-side. A client that could name a URL rather than an
id would be an SSRF hole with a friendly name; it names an id, and the Edge
Function resolves it.

So the gate is *a* key, not a particular vendor's:
`supabase secrets set <PROVIDER>_API_KEY=...`.

- **7.6 assistant — site-wide, decided 2026-10-08.** One chat for the whole
  site, not a finance box: the questions worth asking ("what is in my PC",
  "what comes out this year", "how much did I make last month") cross
  features. The shape that keeps Part 1 intact:
  - **Admin-only.** The launcher renders only for an administrator, and only
    when the function reports a provider with a key, so without a key the
    site is unchanged.
  - **Read-only tools.** No write tool: a model's mistake stays a wrong
    sentence rather than a lost row.
  - **Tools run in the browser, as pure functions over rows already read,**
    each with a paired test and an allowlisted projection. The arithmetic
    stays in the one tested implementation instead of a Deno mirror.
  - **The Edge Function is a thin key-holding proxy:** JWT and `is_admin()`
    first, a server-side provider registry, the body rebuilt and capped, a
    per-user rate limit that fails closed, generic errors.
  - **Finance answers only on the Finance page.** Its data lives in a
    provider with twenty-odd reads and its save paths; the page hands over
    the context it already computes instead of the panel mounting a second
    copy. Lifting that limit means a read-only finance loader, not a second
    provider.
  - **Append-only history, constant system prompt.** A model's thinking is
    bound to an unchanged prefix, so the per-question date and page ride on
    the question, and a full history restarts rather than being trimmed.

  Built in the tree, not deployed. Left: deploy `assistant` no later than
  the site build that carries it (an undeployed function makes each admin
  page load log one failed preflight), set a key, then a signed-in pass over
  the three target questions on a live model. That first call also settles
  the unverified wire names: the Anthropic row sends `fallbacks: "default"`
  under `anthropic-beta: server-side-fallback-2026-07-01` (if the API refuses
  either, every call fails as a generic 502), and the function lets a
  `fallback` block back in when a reply carrying one is echoed (if the API
  names it otherwise, the question after a fallback is refused; the function
  log names the refused type).

  **Open, the owner's call:** goal names and spending-category names are
  sent. They are the owner's own labels and the answers need them, but the
  never-sent list says no third party's name, and a goal called "Mum's 60th"
  is one. Confirm that as a deliberate exception, or switch both to neutral
  labels. Debt and card names are already withheld.

  **Open:** the history cap counts messages, not what one question adds.
  On the OpenAI protocol every parallel tool result is its own message, so
  23 history messages, the system prompt and a question, then four rounds of
  nine or more calls, pass the Edge Function's 64-message cap
  (`LIMITS.maxMessages`, `assistant/providers.ts`). The function answers a
  generic 400 and the history is discarded. Check the count before sending,
  and restart the conversation rather than send a request that will be refused.

  **Open, the owner's call:** the Cash Flow page's monthly average. The
  assistant's `get_cash_flow` averages only complete months of records
  (`completeRecordedMonths` in `src/lib/finance/cash-flow.ts`), but
  `src/features/finance/surfaces/CashFlowSurface.tsx` still divides by every
  started month ("across N months"), including the month in progress and the
  months before the ledger starts, so the page and the assistant can give
  different averages for the same range. Dividing by partial or unrecorded
  months understates the average. Either the page adopts
  `completeRecordedMonths`, labelling its span and any empty months, or it
  keeps the wider divisor with a stated reason.

  **Open, the owner's call:** the phone header's height at 320px. It is
  184–226px tall at 320px wide on a 568px-tall screen (129–185px from 360px up),
  measured in Chrome emulation on 2026-10-09 and unchanged on the header
  merged from main on 2026-10-30; real phones are unmeasured. One
  option is dropping the role line below 360px. The role renders only in the
  header (`SITE.role` in `src/components/layout/Header.tsx`), so the cut would
  touch no other surface. Also optional: rename /auth's title. "Authentication"
  is the only page title that drops the controls to their own line at 375–390px.
- **7.9 embeddings — not needed for 7.6 v1.** The target questions are
  structured lookups over columns (a month's totals, a date range, a text
  match on a few hundred items), which a query answers exactly. Retrieval is
  worth building only when a question needs meaning over free text that no
  column holds; it still needs an embedding key or a self-hosted model, and
  embeds extracted records, per Part 1.
- **7.K tax news** — tax *rates* are data and shipped; tax *news* is content,
  needs a source and a model, and must not be conflated with the ledger.

Automated document extraction is the one capability that genuinely differs
between vendors, so it wants checking against whichever model is chosen rather
than assumed to port. Nothing else waits on this: payslips and credit reports
extract in the browser.

### Needs a decision, not a keyboard

| Question | Why it is stuck |
|---|---|
| FCA framing | Recommending specific financial products to UK consumers is a regulated activity. Guidance built so far is phrased as information only (names debt rates, spare cash and utilisation, never steers); this row now matters only for a product catalogue or public profile feature |

### Left-over from provider and save-safety work (2026-09-27)

- **Shared default rows — transactions and bank accounts only** — Transactions and bank accounts refuse to write shared rows. Latent: no profile shows shared rows in these tables today. Decide: treat shared rows as read-only in the UI, or materialise them per profile as the budget does.
- **`handleEditItem` in BudgetSurface** — pre-existing: drops `linkedAccountId` on save, unlike `handleAddItem`. Owner's call whether to preserve it.
- **Preset provider names** — existing items like "Streaming (Netflix)" fold provider into the name (transactions match by name); the `provider` column is separate. Owner decided not to split existing names into the provider field. Existing and new items can diverge on this point.

### Row-level save follow-ups (what is left)

- **Four reference tables delete-then-insert.** `finance_recurring_templates`, `finance_credit_bureaus`, `finance_holiday_defaults` and `finance_budget_presets` insert rows with no `id`. A failed or aborted insert leaves no rows. Closing it means natural unique keys and a migration.
- **The load waits on the deadline-wrapped save chain, not the raw request.** A request still running after its deadline can land after the load read, so the load gets old state that the save will overwrite.
- **A timed-out delete in TransactionsTab / BankAccountsSection reloads immediately, inside the grace window, and shows the row again.**
- **The sync still overwrites a category set mid-sync on a row that had none.**
- **A token refresh on a dead link is not limited.** supabase-js refreshes through `/auth/v1/` before the request is made, so the 25 s limit never starts; a save key timed out meanwhile stays held until the refresh settles or the page reloads. Do not time out the refresh itself: aborting one the server already rotated can end the session.

### Database follow-ups found in the 2026-10-24 schema repair

One item, schema files only. It is also described in `supabase/schemas/40_finance.sql`, which points here.

- **`schemas/` cannot rebuild the database from empty.** `finance_bank_accounts_id_profile_id_key` and `idx_finance_transactions_profile_id_id` exist only in migrations, so the composite foreign keys in 40_finance.sql fail on a schemas-only build (first at `finance_transfer_links_profile_outflow_fkey`). Audit schemas/ against a migrated database object by object and add what is missing; no migration for objects that already exist.

### Security audit and scan, 2026-10-24 — what is left

The audit (`security/AI-CHECKLIST.md`) found nothing critical or high; its
MEDIUM comes from dashboard auth alone. The scan on `9568b7d4` reports no
dependency advisory. The LOWs below are the audit's unless marked. What was
checked, and how, is in `SECURITY.md`.

**Owner, outside the code:**

- Enrol the administrator's authenticator on `/auth` (signed in, "Set up two-factor"). Hosted TOTP was already enabled on 2026-10-25; until a verified factor exists the second step does not apply (REHAUL_HISTORY.md, 2026-10-25).
- Local stack reset, then `major_version` 15 → 17 in `supabase/config.toml`. The local stack is still Postgres 15, and a 17 config cannot start on the existing PG15 volume, so the bump goes in the same change as the reset, once the owner decides on the reset.
- Delete the `VITE_TMDB_BASE_URL` GitHub Actions secret; no workflow reads it.

**Code:**

- `schemas/90_privileges.sql`: default privileges still give `anon` rights on
  new sequences and functions.
- `file-signature.ts` reads 32 bytes. A HEIC with a generic major brand (`mif1`
  or `msf1`) is refused when its HEVC brand is fifth or later in the compatible
  list, or when its `ftyp` box size is 0. It fails safe; widen the read only if a
  real file trips it (`553b08e3`).
- The Umami tag the build injects (`vite.config.ts`, from `site.json`) lacks
  `data-exclude-search`. Umami also loads on `/finance`, where the OAuth
  callback query is probably sent before `replaceState` clears it
  (unconfirmed).

**Doc drift:**

- README does not list the `SITE_ORIGIN` secret.

**Unverified.** Not checked, and not to be read as passed: a real authenticated
run of `truelayer-sync` v48 and `watchlist-cron-sync` v14 (the 2026-10-25 probes
had no admin session); the `verify_jwt` setting on `truelayer-sync` v48 (read
back before v48 was deployed; the deploy flags keep it false); whether
`SITE_ORIGIN` is set on hosted; live response headers; a signed-in upload or
saved link on the live site (checked on the local stack only); a real HEIC file
(the tests use synthetic `ftyp` boxes). Since the Postgres 17 upgrade
(2026-10-25): the first scheduled cron runs (the next is 02:10 UTC), the edge
functions and their pg_net calls, and a signed-in admin session. The cron jobs
were checked in the catalogue only.

### Sync and profile switch interactions

**A table that fails to load on profile switch keeps the previous profile's rows visible.** Writes are blocked (collections marked incomplete), but the display is not cleared. User sees the old profile's data with editing disabled, which is confusing. The fix clears the table on a failed load, or renders an error state. Low priority — writes are safe, reading stale data is the symptom of a network failure, and error states are not yet defined for tables.

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

### CI runtime

The workflows (`.github/workflows/ci.yml`, `deploy.yml`) run on `ubuntu-latest`
and pin their Actions to major versions 3 and 4. An earlier handoff recorded that
GitHub will run Actions on Node 24 and move `ubuntu-latest` to 26. That was not
checked against GitHub's announcement on 2026-10-24. Confirm it, then move the
Actions and the Node version before the change is enforced.

### Deferred by choice

7.2e (measured, not worth building), 7.12 delivery, 7.13 contacts and
settlements, 7.14 property, bureau API adapters (7.G — needs a contract, not
code).

### The order

1. **A key and a deploy** for 7.6; 7.9 only once a question needs it.

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
| Books | Reading progress for books marked Currently Reading | |
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

- **Subscription audit** — price risen, or unused for N months
- **Merchant drilldown** — spend per merchant per year, off the existing
  merchant resolution
- **Safe to spend**, **net worth milestones**, **year in review** via 8.D

**Gaps against Copilot and Treasury.** Three more, from comparing the two
products' feature sets. Unlike the list above, not all are arithmetic over rows
already held: two need a table or column, and one needs a data source.
- **Transaction splitting** — one bank row across several categories (a shop
  that is half groceries, half household). Child rows
  `finance_transaction_splits(transaction_id, category, amount)` that sum to
  the parent to the penny, enforced on save and covered by tests. Every figure
  that reads a category — Home, Budget history, Cash Flow, merchant drilldown —
  reads the splits when present, so this is calculation work across those
  modules before it is UI. Bank sync upserts the parent and never touches its
  splits; settled-only ingest (7.M) keeps the parent amount still under them.
  *Decide:* whether a split line can itself be a transfer
- **Budget rollover** — per budget item, unspent money carries into next month.
  Derive it from history rather than storing a running balance, for the same
  reason debt balances are anchored rather than floating: a month's rollover is
  the sum of budget minus spent since the item's rollover start. Needs a flag
  and a start month. *Decide:* whether overspend carries too, and whether it
  resets at the tax year or never
- **Investment prices, benchmark and allocation** — holdings carry import cost
  only, and the importer never invents a price; that rule stays. Needs a price
  source behind an Edge Function (key server-side, fixed URLs, never one the
  client names) writing a dated `finance_prices(symbol, date, close, currency,
  source)` cache, so a missing price shows as missing rather than guessed.
  Kraken's public market data covers crypto; equities and funds need a
  provider whose terms allow personal use — not chosen. Performance against a
  benchmark and allocation by account and holding are then arithmetic over
  holdings × prices, converted to GBP. Allocation by asset class or sector
  needs per-holding metadata nothing supplies today

Order within these: category rules go with the review queue; splitting,
rollover and prices stand alone. Splitting touches the most figures, so it
wants a `reviewer` pass before it lands.

**Forecast follow-ups** — day-to-day spending is not modelled; overdraft limits
are not stored, so "below zero" is the warning; the forecast totals all current
accounts rather than per account.

**Tax engine — what is left.** Tax & Income and the Tax Calculator both run
`src/lib/finance/uk-tax-calculator.ts` (decided in `REHAUL_HISTORY.md`,
2026-10-27). Still open:

- **One tax year.** The engine carries 2026/27 rules only, and no Tax & Income
  figure reads a rule set by date any more. A new tax year means editing the
  engine.
  *Decide:* whether multi-year rules come back as rows, or the engine stays
  single-year and says so.
- **`finance_tax_configs`.** Tax & Income no longer reads it for any figure. Its
  income tax bands feed nothing. Its NI bands feed only the note on the National
  Insurance row (`TaxIncomeSurface.tsx`), so an edit changes the label and not
  the amount. Settings still edits all of it under Advanced Configurations. Its
  student-loan thresholds and rates still set the Student Loan section's
  repayment threshold and the debt form's monthly figure, while the engine holds
  its own student-loan thresholds. *Decide:* where the student-loan thresholds
  live, and whether the band fields leave Settings. The table can go only after
  the first is answered.

### 8.I Still to build (the order)

1. **Links dead-link check and auto-metadata**, the highest-value pair outside
   the watchlist, and the only unblocked item here.
2. **8.D primitives**, when a second surface needs the countdown or change feed.
   Do not refactor the watchlist's implementation on spec; refactor when you
   have two callers.
3. **Recipe JSON-LD import**, after the quantity shape is settled.

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

**Films get no watched state.** Owner decision, 2026-09-29. `movies` has no
`watched` column. The News page keeps listing films after they have been
watched, the same way it did before.

---
## Library card-contained scrolling

Keep the Library page within the viewport, with search and category controls
fixed above a card-contained results scroller. Use compact controls on small
screens. Verify portrait and landscape sizes, short viewports, keyboard access
to the end of results, and no document or main-frame overflow. This remains
unimplemented.

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
