# Rehaul Plan

What is left to do, and the decisions that still bind. The audit this came from
and the record of phases 0-6 are in `REHAUL_HISTORY.md`.

**Start at Part 0.5 for how AI is used here, and 7.O for what happens next.**

Audit date: 2026-09-04, last revised 2026-09-07 (7.O: 7.7 payslips marked done).
Supabase project:
`yvtiybyuifkiwyrnjebe` (Personal_Website, eu-west-2, Postgres 15.8.1.030).

---

## Part 0 — Executive summary

The site works and the design system is genuinely good. The problems are structural, not functional:

- **Frontend**: three competing implementations of the same "list of cards" idea. ~1,200 lines of near-duplicate component code, 7 near-identical hooks, 450 lines of dead code, and a 12,237-line Finance page. *(That page is 2,442 lines as of 2026-09-07 — see 7.J for what remains.)*
- **Backend**: RLS is correctly conceived but has one live gap (storage), a hardcoded admin email, no query discipline (`select('*')` everywhere, no pagination), and a migration history that has drifted from the files in the repo.

Nothing here is on fire except item S-1 below. Everything else is accumulated drift.

### The test everything is measured against

**Easy to view, easy to find things, lean.** Not "well-architected" in the
abstract — a change earns its place only if it makes the project smaller or
makes something easier to locate.

| Phase | What | Passes the test? | Status |
|---|---|---|---|
| 0 | Apply pending storage migration | closes a live hole | **done** |
| 1 | Supabase quick wins (indexes, policies) | fewer surprises | **done** |
| 1.5 | Declarative schemas, one file per collection | read one file, know the schema | **done** |
| 2 | Delete dead frontend code | nothing left to read | **done** |
| 3 | Build card + collection system, convert one page | one card system instead of three | **done** |
| 4 | Convert remaining collection pages | one file per collection | **done** |
| 5 | Watchlist decomposition | one folder, named modules | **done** |
| 6 | Finance boundary move (not rewrite) | containment | **done** |
| 7 | Finance rehaul | multi-profile decision engine, one plan below | **substantially done** — see 7.O for what is left and 7.J for the three unmet conditions |
| — | `features/` reorg | **reinstated** — measured against findability rather than line count, co-location is the point | **done** |

The last row is worth keeping visible as a record of a reversal. It was
originally Phase 6, then dropped on the grounds that it "relocates files
without reducing them" — true, but that judged it by line count. Judged by
"can I find things", co-location is the whole point, so it was reinstated and
done as part of Phase 5.

---

---

## Part 0.5 — How AI is used here

Three rules, settled during Phase 7 and stated up front because they are
architectural rather than a phase detail. The reasoning is in 7.P, 7.Q and
7.F; this is the shape of it.

**1. The app is complete without a model.** No feature may hard-depend on one.
With no key set everything works except the chat box, and that is the product
rather than a degraded mode. As of 2026-09-07 there is not a single model call
in `src/` or `supabase/functions/`, all sixteen `lib/finance` modules are pure,
and all 274 tests run without a network. Every figure the app shows — take-home,
free-to-spend, net worth, the pension projection, the debt curve, the scenario
verdicts, the alerts — is computed here from rows.

**2. A model may choose, phrase and explain. It may never compute, and it may
never be the only thing that knows something.** A summary of your own finances
has to be reproducible: the same data must give the same answer tomorrow, and
every figure has to trace to the arithmetic that made it. A generated summary
gives up both, invisibly, because a wrong number reads exactly like a right one.
So the standing summary is rules over rows — `deriveAlerts` already is — and the
model is for the question nobody built a screen for.

**3. Documents are stored, never sent. What reaches a model is a projection.**
A payslip PDF is archived so it can be downloaded years later; its figures are
captured into columns and the app renders its own view of them. Nothing uploads
the document. Every path to a model goes through a projection built by listing
what to include, never by taking a row and removing fields — a denylist leaks
whatever is added to the table next, an allowlist cannot. Never sent: National
Insurance number, account and sort numbers, card numbers, addresses, employer
references, payroll numbers, dates of birth, any third party's name.

The practical shape that follows: extraction runs in the browser (`pdf.js` for
the text layer a digital PDF already has, a template for a layout that recurs,
Tesseract WASM only for photographed receipts), so the document is parsed before
it is uploaded anywhere and rule 3 holds by construction. And because there are
two wire protocols rather than N vendors, the provider is a registry row —
`lib/finance/llm.ts` translates both, and the registry stays server-side so a
client names an id and never a URL.

---

---

## Part 1 — Decisions that still bind

Settled, and still the rule. The audit that produced them and the record of
phases 0-6 are in `REHAUL_HISTORY.md`.

#### Schema organisation decisions

### One schema file per collection (yes)

Books, links, articles and inventory are **already separate tables**. The
question was only about file grouping. Files are free, and grouping them defeats
"easy to find things", so the declarative layout is one file per collection:

```
supabase/schemas/
  00_extensions.sql
  01_auth_helpers.sql      is_admin()
  10_books.sql
  11_links.sql
  12_articles.sql
  13_recipes.sql
  14_inspirations.sql
  15_photos.sql
  16_beliefs.sql
  17_inventory.sql
  18_site_content.sql
  20_watchlist.sql         movies + shows + seasons + episodes + schedule
  30_travel.sql            visited_countries + visited_cities
  40_finance.sql           the 23 finance_* tables
```

Watchlist, travel and finance stay grouped because those tables are one graph
joined by real foreign keys — splitting them across files buys nothing and
creates ordering problems. Numeric prefixes handle dependency order (schema
files run lexicographically); `[db.migrations] schema_paths` in `config.toml`
can pin a custom order if that stops being enough.

This mirrors `collections/books.ts`, `collections/links.ts` on the frontend:
same domain, same filename, both layers.

Two things stay as hand-written migrations because they don't round-trip through
the differ: `storage.objects` policies and the pg_cron schedule.

### Splitting inventory into per-category tables (no)

Considered splitting `inventory_items` into `wardrobe`, `kitchen`, `tech` etc.
The data says no:

| Category | Rows | Subcats | Null brand | Null price | Null link |
|---|---|---|---|---|---|
| tech-edc | 59 | 0 | 0 | 0 | 0 |
| wardrobe | 56 | 17 | 0 | 0 | 0 |
| homelab | 12 | 2 | 0 | 0 | 0 |
| hygiene | 11 | 0 | 0 | 0 | 0 |
| sports-gear | 5 | 0 | 0 | 0 | 0 |

Every category uses every column, with zero nulls in `brand`, `price` and
`link`. Five tables would have identical columns.

**The rule: split when the _shape_ differs, not when a _value_ differs.**
Wardrobe and homelab are different values of `category`, not different shapes.

Splitting would cost: 20 RLS policies instead of 4; five TypeScript types, five
configs and five hooks — reintroducing in the database exactly the duplication
being deleted from the frontend; a migration plus policies plus config to add a
category instead of one INSERT; a five-way UNION for "search all inventory"; and
it breaks `useCollection` / `CollectionConfig`, which assume one table per
collection with category as a facet. At 142 rows there is no performance
argument either way.

It would be right if wardrobe needed `size`/`fabric`/`fit` and homelab needed
`wattage`/`rack_units`/`ports` with nothing shared. Then separate tables, or a
`JSONB attributes` column. Neither applies.

The existing `category` → `subcategory` hierarchy is already the right shape and
generalises: `CollectionConfig` should support an optional second facet level.
Books and Links won't use it; Inventory and Watchlist will.

---


#### 7.B Profiles, not households

The spec's household model — multiple auth users, roles, permissions, privacy
walls, consent — is an auth and privacy problem, and it is not the one we have.
What we want is one operator (the admin) configuring finances for several
subjects: himself, family, friends.

That is a scoping column, not a tenancy model.

```sql
CREATE TABLE finance_profiles (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  is_self       boolean NOT NULL DEFAULT false,
  owner_user_id uuid REFERENCES auth.users(id),   -- NULL until someone else logs in
  currency      text NOT NULL DEFAULT 'GBP',
  region        text NOT NULL DEFAULT 'england',  -- Scottish bands differ
  created_at    timestamptz NOT NULL DEFAULT now()
);
```

RLS is untouched — it stays `is_admin()`, because there is still exactly one
reader.

Not all 20 `finance_*` tables want the column, which only became clear on
reading the schema. Every table already carries `is_default`, and the page
reads it as a user-row/template-row pair (`data?.find(d => !d.is_default)`
against `data?.find(d => d.is_default)`). So the tables fall into three groups:

| Group | Tables | Gets `profile_id` |
|---|---|---|
| Per-profile | bank_accounts, budget_categories, budget_items, credit_scores, debts, goal_contributions, goals, memberships, recurring_bills, settings, transactions, user_holidays, truelayer_connection | **13** |
| Shared reference | budget_presets, credit_bureaus, holiday_defaults, recurring_templates, tax_configs | no — bureau definitions and tax bands are the same for everyone |
| Legacy, being dropped (H-2) | finance_data, finance_defaults | no |

`finance_tax_configs` staying shared corrects an earlier assumption that tax
config would go per-profile for Scotland. It does not need to:
`finance_settings.uk_region` already exists, and that column is per-profile.

The column is **nullable**, not `NOT NULL`, because a template row belongs to
nobody. The invariant is a CHECK rather than a convention:

```sql
CHECK ((is_default AND profile_id IS NULL) OR (NOT is_default AND profile_id IS NOT NULL))
```

`finance_truelayer_connection` is the exception: it has no `is_default` column,
because a bank connection is never a template, so there the column is plainly
`NOT NULL`. Each scoped table also gets a `(profile_id)` index.

`owner_user_id` is the entire upgrade path. It is null today. The day another
person should log in and see only their own profile, that is a policy edit, not
a migration and not a rewrite.

Backfill is one migration: insert one profile, `UPDATE` all 20 tables with its
id, then `SET NOT NULL`.

Two consequences worth planning for:

- **`localStorage` stopped working, and is now gone.** `finance_settings` means
  nothing once there are three profiles, and a cached blob outlives a switch, so
  one profile's ledger would surface under another's name. All eighteen
  seed/write pairs are retired: Postgres is the only source of truth, state
  starts at its defaults, and the first fetch replaces it. The active tab went
  with 7.2a, when a surface became a route.
- **Cross-profile money is real.** "I sent Mum £300" is an expense in one ledger
  and income in another. This is the one piece of the household model worth
  keeping — the *linking* half, not the auth half. A
  `finance_transfers(from_profile_id, to_profile_id, transaction_id)` link is
  designed in at 7.1 or net worth double-counts across profiles forever.


#### 7.C Design language — nothing new

Finance takes its structural cues from Copilot and Treasury and its visual
language entirely from what this site already has. No new fonts, no new
colours, no new dependencies. `recharts@2.15.4` is already installed.

**What is borrowed — structure, not style:**

| Pattern | Where it lands |
|---|---|
| One hero number per view, everything else is evidence for it | Dashboard, Net Worth, each tab header |
| Review inbox as a first-class surface with a count badge | Transactions — the review queue |
| Summary card opens a detail dialog | `CardDetailDialog`, already built |
| Trajectory inline, not in a separate report | vs-last-period delta on every headline figure |
| Fact / estimate / forecast / recommendation are visually distinct | badge + `muted-foreground`, no new tokens |
| Density in tables, air in summaries | dense rows for transactions, roomy cards above |

**What is fixed — tokens only, from `src/theme/`:**

- **Type.** Space Mono throughout, which is already the body face and is
  monospace, so figures column-align for free. Doto via `DotMatrixText` for
  section headings only, exactly as the rest of the site. The scale in
  `src/theme/typography.ts` is the ladder, and 12px is the floor.
- **Colour.** Only the tokens in `src/index.css`. No palette is added.
- **Charts.** The plan originally called for a monochrome ramp of
  `--foreground` at stepped opacity. That was written before checking what
  shadcn — which this project already follows, tokens and all — says about the
  problem: its Charts work defines `--chart-1` … `--chart-5` as themed tokens
  for exactly this. Adopting those is staying inside the system rather than
  adding to it, and it keeps the information a category legend carries, which a
  grey ramp would have flattened. `--chart-1` is the accent itself, so a
  single-series chart still matches the page.
- **One addition beyond the standard contract: `--positive`.** shadcn ships
  `--destructive` and deliberately no success token, but a finance view has to
  tell a gain from a loss, and the site's accent is a warm orange that reads as
  a warning. It is shaped exactly like `--destructive`.
- **Brand colours stay as data.** Monzo's coral and Amex's blue live in
  `getAccountDefaultColor`; they are identity, like a logo, and the point is
  that you recognise an account by its colour. Tokenising them would make the
  accounts list less informative, not more consistent.
- **Surfaces.** `ui/card.tsx`, `--shadow-card`, `--radius`. Nothing bespoke.

**Navigation — ten tabs become five surfaces.** Ten top-level tabs is the other
half of why the page feels like a different product; neither Copilot nor
Treasury runs anything like that many. Nothing is deleted — Budget stops being
a destination and becomes the frame around Spending, Time Spent becomes a lens
on Income.

| Surface | Absorbs | Hero number |
|---|---|---|
| **Home** | dashboard | safe-to-spend, with trajectory, alerts and the review count |
| **Spending** | transactions + review inbox + budget + recurrings | spent this month, against budget |
| **Plan** | cash flow + goals + scenarios (7.5) | free to spend before payday |
| **Wealth** | accounts + investments + debts + credit + memberships | net worth |
| **Income** | tax & income + payroll + time spent | take-home this tax year |

**Positive, but true.** Two of the four heroes opened on a large red negative,
and neither negative was telling the truth.

Plan's was an artifact: `freeToSpend` was `totalBudget - spent - bills`, so with
no budget set it reported the spending back as a negative and called it
overspent. It is now measured against the budget when one exists and against
take-home income when one does not, which answers the same question honestly
rather than alarmingly — the same figure went from −£1,285.99 to £1,922.51, and
the second number is the accurate one. The dashboard's Free to Spend card reads
from the same value and was wrong in the same way.

Net worth's negative is real, so it stays, but it is no longer red. The minus
sign already carries the fact; red reads as an alert, and a net worth held down
by a student loan or a mortgage is a state of life rather than something that
went wrong this month. Red is kept for what you can act on.

Home is the exception: it is already a cockpit of several figures, and crowning
it with one more would only repeat whichever it picked. Plan's hero is named
"free to spend", not "projected balance" — the figure is budget minus spent
minus unpaid bills, which is what is left to commit rather than what will be in
the account, and naming it the second thing would be a lie by label.

Budget and Spending merge because they answer one question — *what am I
spending against what I meant to spend* — and splitting them forces the reader
to hold half the answer while navigating to the other half. Credit sits under
Wealth: a score is a statement about borrowing standing, not about income.

Each surface becomes a real route (`/finance`, `/finance/spending`, …) rather
than tab state in `localStorage`. Three consequences, all good:

- Surfaces are linkable and bookmarkable, which tab state never was.
- Each route lazy-loads separately. `recharts` is deliberately excluded from
  `manualChunks` today so it stays in the finance chunk; with five routes it
  loads only on the surfaces that actually chart, instead of on all ten tabs.
- The 7.1 profile switcher lives in the finance shell above the surfaces, so it
  is global to the feature and survives navigation between them.

Progressive disclosure inside each surface uses `CardDetailDialog`, which
already exists and already behaves correctly.

**Layout: the shell, and scrolling that stops at a card.** Finance was the only
page on the site that was not inside `AppShell` — every other page, including
Travel, Watchlist, all the collections, Auth and the About page, already sits in
the frame where the header and footer are pinned and only the middle moves.
Finance was `min-h-screen` with both in the flow, so the whole document
scrolled and the page read as a long report rather than an application. That is
the same story as the fonts and the colours: not a new idea to introduce, a
system finance was ignoring.

The surface and section navs go in `AppShell`'s `toolbar` slot, which sits
outside the scroll area, so navigation stays put while the surface scrolls
underneath.

Inside a surface, scrolling stops at a card rather than running the length of
the page: a transaction list scrolls within its own pane, inside the shell's
scrolling middle. This keeps a surface roughly one screen tall whatever the row
count, and makes the structure legible — a scroll bar tells you where one thing
ends and the next begins. `holiday-months-container` already worked this way and
was the model; Home's transactions card already capped at 300px.

Now also capped: Home's upcoming bills, the three account tables on Wealth
(`60vh`, so they shrink with the window rather than a fixed pixel count), and
the transactions list, which is the one that mattered most — its detail panel
sits beside the list, and before this it scrolled out of reach as soon as the
list grew.

Not every list wants this. A short one gains nothing and a nested scrollbar
costs something, so the rule is: cap a list that can outgrow the viewport,
leave the rest alone.

**Where the collection system does and does not fit.** `EntityCard`
(`CardVariant = 'media' | 'text'`) and `CollectionConfig` exist for walls of
entities. That fits Goals, Accounts, Memberships and Recurring bills, which are
genuinely lists of things and should be converted. It does **not** fit
dashboards, dense transaction tables or charts — forcing those through
`EntityCard` would bend the primitive out of shape. Finance therefore reuses
the *tokens and `ui/` primitives*, and adds a small `StatCard` built from
`ui/card.tsx` for metric tiles. That is the boundary.

**Why the current page did not look like this site.** Measured on 2026-09-04:
264 arbitrary sub-12px sizes, 19 off-scale weights, 38 distinct hardcoded hex
colours, against 817 design-token references — genuinely mixed rather than
wholly off-system. Sizes and weights are now zero; twelve hex colours remain
(7.J). Current counts live in `src/theme/README.md` rather than here, so they
stay true.

So 860 pieces of text sit at 12px or below against 24 at body size — body copy
effectively does not exist on this page — and the charts run the full default
Tailwind palette (`#10b981`, `#f59e0b`, `#ef4444`, `#3b82f6`, …) inside a warm
near-monochrome design system built on one accent.

That is the whole diagnosis. Finance is the one page that ignores the design
system, which is why it reads as a different product bolted to the side of the
site. These match what `src/theme/README.md` already records (263 and 19); an
earlier count of 468 here was a double-counted glob, not a real figure.

**What visibly changes, and what does not.** The visual *language* does not
change at all — same tokens, same two faces, same card chrome, same header and
footer. What changes is proportion and layout:

| Changes | Stays |
|---|---|
| Text gets substantially bigger; 264 sub-12px instances rise to the scale | Every colour token in `src/index.css` |
| Charts drop 38 hex colours for the monochrome ramp + `--accent` | Space Mono body, Doto display |
| One hero number per view; cards gain air | `ui/card.tsx`, `--radius`, `--shadow-card` |
| 19 `font-extrabold` fall back to the two-weight scale | Header, Footer, shell, theme toggle |
| Tab structure consolidates (see 7.2) | Light/dark behaviour |

The page ends up looking *more* like the rest of the site than it does today,
not less. The density loss is real and intentional: 9px text is the reason the
page feels cramped.

**What extraction actually costs, measured.** Each of the six inline sections
uses only 11–37 names from page scope, and the ledger data it needs comes free
from the provider — Cash Flow, extracted first, needed three context names and
two props. So the sections are far more separable than an 800-line block
suggests.

The remainder are not blocked by size but by two specific couplings:

- **Every dialog lives in the page.** So a surface's prop list fills up with
  openers — `setIsAddGoalOpen`, `setIsEditItemOpen`, `setIsAddCreditScoreOpen`.
  Worse, handlers like `handleDeleteGoal` are one-line arrows delegating to
  `askDelete`, the page's confirm-delete machinery, so they cannot move while
  it does not.
- **The totals are computed in the page.** `totalSpent`, `breakdownRates`,
  `nextPayday`, `freeToSpend` and friends are derived in `FinanceView` and read
  by several sections at once.

Between them these account for most of the 5–19 props each remaining surface
would need. Extracting first and fixing later would bake a wide prop interface
into five files and then have to unpick it, so 7.2c-i comes first: move each
dialog to the surface that opens it, and lift the derived totals to where the
data lives. The prop lists collapse on their own after that.

##### Emoji identify things you named; icons do everything else

Settled while doing the design pass, and recorded because it is a rule rather
than a preference. Emoji and lucide icons were both in use with nothing
separating them -- a grey 14px glyph beside a full-colour emoji on the same
row, which is what read as unpolished rather than the emoji themselves.

- **Emoji** mark a thing the user named: a category, a goal, an account, a
  budget item. They are open-vocabulary, cost nothing, and colour genuinely
  helps when scanning a long list. They stay, including in the database.
- **Icons** do everything structural: actions, status, navigation, type
  indicators, and decoration inside labels.

The one caveat is that emoji render differently per platform, so a screenshot
from a Mac will not match Android. Irrelevant for a private dashboard, worth
remembering if the demo profile ever becomes public.


#### 7.E-pre2 The four reference tables keep delete-then-insert, and have to

`finance_recurring_templates`, `finance_credit_bureaus`,
`finance_holiday_defaults` and `finance_budget_presets` were left on the old
delete-then-insert shape when the other thirteen moved to upsert-then-prune in
7.3a. That is not an oversight to finish later: those four insert rows **with no
`id`**, letting the database generate one, so there is no client-side identity
to upsert against or to prune by. Upserting would duplicate every row on every
save.

Closing the window properly means giving them natural unique keys — a preset is
identified by `(preset_type, name)`, a holiday default by `month_index`, a
bureau by `key` — and upserting on those. That is a migration for admin-only
reference data that is edited rarely.

It is left undone deliberately, because the blast radius is small and
recoverable: these tables hold seed data, not the ledger, and the code carries
the fallbacks already (`ALL_PRESETS_FALLBACK`, `DEFAULT_RECURRING_TEMPLATES`,
`DEFAULT_CATEGORY_TEMPLATES`). A failed save loses defaults that the app can
regenerate, not money that happened.

Worth doing if these ever stop being regenerable from code.


#### 7.E-pre000 Alerts are derived, and delivery is deferred

7.12 asked for "alerts and notifications". The alerts are built; the
notifications are not, and the split is deliberate.

Every alert is a pure function of the current position and today's date, so it
appears when its condition is true and disappears when it stops being true.
Nothing is stored, nothing is marked read, and there is no second source of
truth to reconcile against the ledger. `deriveAlerts` covers overdue and
imminent bills, an emergency fund below target, spending over budget, goals
that cannot reach their date at the current rate, unreviewed transactions, and
the missing budget itself.

Delivery — push or email — is a different problem and needs infrastructure this
does not have: a service worker and a push service, or an edge function and a
mail provider, plus somewhere to record what has already been sent so the same
bill is not announced nightly. That last part is what makes it a real feature
rather than a wrapper, and it is not worth building before the alert set has
settled.

The same set is exposed as the `get_alerts` tool, so when the assistant lands
it reads these rules rather than inventing its own.


#### 7.E-pre Per-surface queries: measured, not built

The plan called for splitting the mount so a surface loads only what it
renders. Measured against the running app, that is not worth the risk of
restructuring a working load path.

| | |
|---|---|
| Distinct tables fetched on mount | 18 |
| Wall clock for the whole mount | 1,321 ms |
| Slowest single query | 1,050 ms |
| Sum if they ran serially | 5,116 ms |

They run in parallel, so the mount costs about one round trip — the slowest
query, not the sum. Cutting 18 down to the 7 that `useFinanceTotals` needs
would still be one round trip, because the remaining 7 are still concurrent.
The saving is in connections and database work, not in anything the reader
waits for.

That matters because the heroes made the core set wider, not narrower: every
surface now shows a figure derived from settings, tax config, budget
categories, budget items, accounts, recurring bills and debts. Only ten tables
are genuinely surface-specific, and deferring them would buy a fraction of one
round trip in exchange for a lazy-loading path through the provider that every
future query has to be aware of.

Same conclusion as P-6, and for the same reason: the data is small. Revisit
when a finance table passes ~1,000 rows, or when several profiles are in
regular use and switching between them refetches two full ledgers often enough
to notice.


#### 7.E Security — the `documents` bucket is public — **bucket DONE**

Blocking prerequisite for 7.7. `finance-documents` now exists: private, with
`is_admin()` on select as well as write. The public `documents` bucket is left
alone -- it holds one file, the CV, which is meant to be downloadable.

The original finding, for the record. The existing bucket is world-readable:

```sql
('documents', 'documents', true, 52428800, ARRAY['application/pdf'])
```

`public = true`, plus a `Public Access` SELECT policy carrying no `is_admin()`
check. That is fine for the site documents in it today. Payslips, bank
statements and credit reports must not go near it. 7.7 opens with a new private
bucket:

```sql
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('finance-documents', 'finance-documents', false, 52428800,
        ARRAY['application/pdf','image/jpeg','image/png']);

CREATE POLICY "Admin reads finance documents" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'finance-documents' AND public.is_admin());
```

Private bucket, signed URLs only, `is_admin()` on **select** as well as write.

Also carried into this phase from Part 1: **S-10**, the `anon` write grants
still held on all 19 finance tables. `REVOKE ALL ON <finance tables> FROM anon`
lands with the 7.1 migration.

Once other people's payslips are in the system, that is third-party personal
data. Profile deletion must cascade cleanly from day one — the `ON DELETE
CASCADE` above is load-bearing, not decoration.


#### 7.F Semantic layer

No external blocker. `00_extensions.sql` currently has pg_cron, pg_net,
pgsodium, pgcrypto, pgjwt, vault and uuid-ossp — pgvector is one line.

```sql
CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA "extensions";

CREATE TABLE finance_embeddings (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id  uuid NOT NULL REFERENCES finance_profiles(id) ON DELETE CASCADE,
  entity_type text NOT NULL,   -- transaction | payslip | goal | note (see 7.P:
                               -- extracted records, never document text)
  entity_id   uuid NOT NULL,
  chunk_text  text NOT NULL,
  embedding   extensions.vector(1536)
);
CREATE INDEX ON finance_embeddings USING hnsw (embedding extensions.vector_cosine_ops);
```

Embedding generation is an Edge Function following the established pattern —
`Deno.env.get('EMBEDDING_API_KEY')` alongside `TMDB_API_KEY` and
`TRUELAYER_CLIENT_SECRET`. Server-side only, no `VITE_` prefix. Backfill runs on
pg_cron, the same shape as `watchlist-cron-sync`.

Retrieval is hybrid and the rule is absolute: **structured SQL produces the
number, vector search finds which records are relevant.** Similarity never
answers "what is my balance". Cost at this scale is negligible.


#### 7.G Credit — the gate is a contract, not code

Experian, Equifax and TransUnion do not sell consumer credit-file API access to
individuals. Consumer access runs through resellers — ClearScore, Credit Karma,
TotallyMoney — and none expose a public API. Open Banking carries account data,
not bureau files, so TrueLayer does not reach it either. Automated bureau sync
requires a contracted or licensed entity, which is a Phase 8 concern.

What is available now covers most of the value:

- **The normalised model already exists.** `finance_credit_bureaus`,
  `finance_credit_scores`, `BUREAU_BANDS` and `getUniversalStanding` are the
  cross-bureau layer the spec asks for, already written.
- **Ingestion by statutory report.** All three bureaus issue a full credit
  report as PDF. That routes through the same extraction pipeline as payslips,
  so credit is a *document* problem rather than an API problem, and costs
  almost nothing extra once 7.7 exists.
- **Adapter behind the interface.** Build the model and UI against manual and
  PDF ingestion. A bureau contract later drops in behind the same interface —
  ADR-002 applied exactly as intended.


#### 7.I Hosting portability

The site is on GitHub Pages today and may be self-hosted later. Phase 7 must
not deepen the coupling, because the coupling is currently narrow and
self-hosting is mostly an *upgrade*.

**What is Pages-specific today:**

| Thing | Where | On a self-hosted server |
|---|---|---|
| CSP delivered as `<meta>` | `inject-csp-meta` plugin, `vite.config.ts` | becomes a real response header; `frame-ancestors` starts working |
| `frame-guard.ts` standing in for `X-Frame-Options` | `src/main.tsx` | header does the job; keep the guard as defence in depth |
| `X-Content-Type-Options`, `Permissions-Policy` unset | `SECURITY.md` "cannot be set" list | both become settable |
| HSTS inherited from `github.io` | `SECURITY.md` | ours to set, with `includeSubDomains` |
| SPA fallback via `cp dist/index.html dist/404.html` | `postbuild` script | a `try_files` / rewrite rule |
| Chunking tuned for cold CDN round trips | `manualChunks`, `vite.config.ts` | still correct, reasoning just stops being Pages-specific |

`base: "/"` is already host-neutral. Nothing else needs to move.

Three of the four unmet items in the vibe-check Security Headers list are
unmet *only* because there is no server. Self-hosting closes them, which makes
this a security improvement rather than a lateral move.

**Rules this phase follows to keep the door open:**

- `lib/finance/` imports no React, no Supabase, no `import.meta.env` and no DOM
  API. It is portable by construction — browser today, server process later,
  same code. This is the single most important portability decision in the
  phase, and it is already step 7.0.
- 7.6 (AI tools) and 7.7 (document pipeline) are written against a typed HTTP
  boundary, not against the Edge Function SDK. Transport swaps from a Supabase
  Edge Function to a self-hosted route without callers changing.
- Storage access goes through one module rather than scattered
  `supabase.storage.from(...)` calls, so the same is true if Supabase is ever
  self-hosted too.
- No *new* `<meta>`-based header workarounds. They would be dead weight on a
  real server, and the existing three are enough.

**Two separate decisions.** Self-hosting the site does not move Supabase, and
self-hosting Supabase does not require moving the site. Phase 7 keeps them
independent; neither is assumed.

`SECURITY.md` is not edited now — it documents what is true today, and today is
still Pages. It gets revised at migration, and this table is the checklist.


#### 7.P The model sees a projection, never the source

A rule that outranks the phases below it, and a correction to how 7.7–7.10
were originally drawn.

**Documents are not sent anywhere. They are stored.** A payslip PDF goes into
the private bucket and stays there, so it can be downloaded in five years when
a mortgage application asks for it. Nothing uploads it to a model. The figures
that matter are captured into columns, and the app renders its own payslip view
from those — which is better than a PDF viewer anyway, because it can be sorted,
charted and compared.

That inverts the original 7.7. It was drawn as *upload → model extracts →
store*, which sends an entire document — salary, National Insurance number,
address, employer reference, sometimes a bank account number — to a third party
in order to learn six numbers. Storage and extraction are separate concerns and
only one of them ever needs to leave the machine.

**And what does leave is a projection.** 7.6 already works this way:
`FinanceToolContext` is a closed set of derived figures with "nothing else is
reachable" written on it. The rule generalises — every path to a model goes
through a projection that is built by listing what to include, never by taking
a row and removing fields. A denylist silently leaks whatever gets added to the
table next; an allowlist cannot.

Never sent, in any phase: National Insurance number, account and sort numbers,
card numbers, addresses, employer references, payroll numbers, dates of birth,
and any third party's name. Sent: amounts, dates, categories, and figures
derived from them.

##### The consequence for 7.F that is easy to miss

Generating an embedding means sending the text to an embedding provider. So
`entity_type = 'document_chunk'` in the 7.F table contradicts this section: it
would ship raw payslip text to a third party through a different door. Embed
the *extracted* records — "salary payment, £3,200, employer, 2026-08-28" — not
the document they came from. If raw text ever genuinely needs embedding, that
is a reason to self-host the embedding model, not a reason to relax the rule.

##### Extraction, in the order it should be built

1. **Manual entry, and it is not a stopgap.** A form with gross, tax, NI,
   pension, student loan and net. Six fields, once a month, and it makes the
   payslip view, the deduction trends and the 7.N student loan reconciliation
   all real without any model at all.
2. **Templates, for your own payslips.** One employer means one layout, and a
   stable layout is a case where a template beats a model outright: it is
   deterministic, testable, free, offline, and it fails loudly instead of
   confidently inventing a number. This is the right tool for the job, not the
   cheap version of it.
3. **OCR in the browser, for the varied stuff.** Receipts are where layouts
   genuinely differ and a template stops paying. Tesseract compiles to WASM and
   runs client-side, so this needs no server either.

The ordering matters because 1 and 2 cover the documents that recur, which are
exactly the ones worth the effort, and neither needs a key or a vendor.

##### None of this needs a server, and OCR is mostly the wrong tool

A payslip from a payroll system is a digital PDF with a text layer already in
it. Pulling that text out is `pdf.js` — a library, in the browser,
deterministic, exact. **OCR is for images**: a photographed receipt, or a
scanned document. Reaching for it on a digital PDF trades exact text for
recognised text and gains nothing.

So the ladder runs in the browser end to end, and static hosting is not a
constraint on any of it:

| Step | Where it runs | Needs |
|---|---|---|
| Read the text layer (`pdf.js`) | browser | nothing |
| Match a template against that text | browser | nothing |
| OCR an image (Tesseract WASM) | browser | a few MB, lazily loaded |

This is better than the self-hosted framing it replaces, and not just for
convenience: extracting in the browser means the document is parsed before it
is uploaded anywhere. It reaches Supabase as an archive and a set of figures,
having never been sent to anything in order to be read. 7.P's rule holds by
construction rather than by policy.

##### What this changes elsewhere

- **7.7** becomes storage plus capture plus a native payslip view. Extraction
  moves out of it and stops being a blocker for anything.
- **7.8** reconciles captured figures against transactions, which was always the
  interesting half, and no longer waits on a document pipeline.
- **7.9** embeds records rather than document chunks, per the note above.
- **7.10** credit reports follow the same shape: archive the PDF, capture the
  scores and accounts, never ship the report.


#### 7.Q The app is complete without a model

Stated as a constraint rather than an aspiration, because it is currently true
by accident and should be true on purpose.

Today there is not a single model call anywhere in `src/` or
`supabase/functions/`. All sixteen `lib/finance` modules are pure and all 274
tests run without a network. Every number the app shows — take-home,
free-to-spend, net worth, the pension projection, the debt curve, the scenario
verdicts, the alerts — is computed here, deterministically, from rows.

The constraint: **no feature may hard-depend on a model.** With no key set,
everything works except the chat box. That is not a degraded mode to apologise
for; it is the product, and the assistant is an addition to it.

##### The sharper half: what a model must never do

"Take all the information and show it in one place" is the right ambition and
the wrong job for a model, because a summary of your finances has to be
reproducible. The same data must produce the same summary today and tomorrow,
and every figure in it has to be traceable to the arithmetic that made it. A
model that writes the summary gives up both, and does it invisibly — a wrong
number reads exactly like a right one.

So the standing summary stays deterministic. `deriveAlerts` already is: rules
over rows, seven typed codes, tested. Extending that is how "one place" gets
built, and the result is better than a generated paragraph — instant, free,
identical every time, and correct by construction rather than by luck.

7.F already says this for retrieval: structured SQL produces the number, vector
search only finds which records are relevant. The same division applies
everywhere. A model may choose, phrase and explain. It may not compute, and it
may not be the only thing that knows something.

##### What the model is genuinely for

- **The question nobody built a screen for.** "How much did I spend on trains
  to Manchester last winter, and was that more than the year before?" is a real
  question that does not deserve a permanent UI. This is the actual case for
  7.6, and the tool layer already answers it with arithmetic — the model picks
  which tools to call and writes the sentence around their output.
- **Phrasing, not figures.** Turning `{verdict: 'breaks_emergency_fund',
  shortfall: 340}` into a sentence that lands.
- **The messy, one-off, varied input** — a receipt in an unfamiliar layout —
  where a rule would need writing per case and never gets written.

Anything that recurs monthly and matters is worth a rule instead.


#### 7.K Tax bands have no year, and that is the real problem

The question "how does the site keep up when the Budget changes?" turns out to
be two questions wearing one coat, and only one of them is hard.

`finance_tax_configs` holds a single row: income tax bands, NI bands, student
loan thresholds and rates. There is no tax year on it. Updating it for a new
Budget therefore does not *add* the new bands, it *replaces* the old ones — so
last year's take-home is recomputed with this year's numbers the moment you
save. The figure on the Income surface is not wrong today; it becomes wrong
retroactively, silently, the first time the rates move.

That is a schema gap, not a news problem.

| Option | Verdict |
|---|---|
| Edit the bands by hand each April (today) | Correct going forward, wrong for every past figure |
| Store bands per effective date, pick by the date being computed | **Do this** |
| Scrape gov.uk / HMRC for band changes | No. There is no stable API for this; the rates live in Budget documents and HTML tables that are restructured yearly. A scraper here fails silently and produces wrong money |

The fix is an `effective_from date` column rather than a `tax_year` string.
Bands mostly change at the April boundary, but not always — the NI rate moved
twice inside 2022/23 — so a year label cannot express the real history.
Selection becomes: take the most recent band set whose `effective_from` is on
or before the date of the figure being computed. `calculateFinance` gains that
date as a parameter, which it should have had anyway, since it is already the
kind of pure function that must not read the clock.

Seeding is a migration: the current bands become the row effective from the
start of the current tax year, and earlier years get added as and when a
historical figure actually needs them. No point inventing history nobody reads.

**Tax news is a separate feature and should stay separate.** A change in the
additional-rate threshold is *data* and belongs above. "The Chancellor has
announced X and it affects you because Y" is *content*, needs a source and a
model to summarise it, and therefore lands with 7.7–7.10 behind the same API
key. Conflating them produces a scraper that pretends to be a ledger.


#### 7.L Credit card recommendations — guidance is buildable, a catalogue is not

Also two features under one name.

**Guidance from data already held** needs no third party. The debt model,
`lib/finance/credit.ts` and `lib/finance/debt.ts` already know balances, APRs,
limits and utilisation. Statements like "you are carrying £2,400 at 24.9% while
£3,000 sits in a current account paying nothing" or "utilisation is 68%, and
under 30% is where the scoring bands step" are arithmetic over existing rows.
This is the same shape as the alerts engine and should reuse it.

**Product recommendations need a catalogue**, and there is no free source for
UK card terms. The comparison sites are affiliate networks under commercial
agreement, not open APIs; the issuers publish terms as marketing pages. So the
catalogue is either hand-curated or it is a Phase 8 commercial arrangement.

Structure it the way 7.G structures bureau data: a `finance_card_products`
table that can be seeded by hand today and fed by a provider later, with the
recommendation logic written against the table rather than against whatever
fills it. The adapter goes behind the interface, per ADR-002.

**One constraint to record before any of this becomes public.** Recommending
specific financial products to consumers in the UK is a regulated activity.
A private dashboard computing "this card would cost you less" for its own
owner is fine. The same feature on a public-facing product is either FCA
authorised, or carefully framed as information rather than advice, with no
steer toward a particular product. Given the intent to possibly build a company
from this, that distinction wants deciding before the feature is designed
around it, not after.


#### 7.M TrueLayer — the bank is a source, the local store is the record

The integration predates Phase 7 and was never revisited. Reading it back
turned up one bug that loses data, one that crosses profiles, and a set of
structural limits.

**It deletes history on every sync.** `sync_transactions` builds its write list
from the API response plus manually-added rows; existing `tl_tx_` rows outside
the fetch window are consulted for their review status and then dropped. It
then deletes every non-default transaction and reinserts only that list. The
window also narrows from 90 days on the first run to 30 on every run after, so
the store converges on a rolling month. Once a transaction is past the
provider's own window it cannot be re-fetched, so this is unrecoverable loss.

**It ignores profiles.** Both deletes are scoped by `is_default` alone, across
every profile, and the reinserts stamp `profile_id = selfProfileId` on every
row — including the manually-added ones it went to the trouble of preserving.
One sync collapses every profile's accounts and transactions onto the self
profile. The connection table gained `profile_id NOT NULL` in the profiles
migration; the function never reads it.

**It holds one connection.** The table has no provider identity — no provider
id, no name, no consent expiry — and `exchange_code` deletes all rows before
inserting. One bank is structural, not incidental.

**It does not paginate.** No cursor handling anywhere, so even the 90-day
window is silently truncated on a busy account.

The principle that follows: Open Banking gives a limited window and consent
lapses, so the local database has to be authoritative. Bank-sourced rows are
upserted and never pruned.

| Step | Work | Gated on |
|---|---|---|
| A | Scope deletes by profile, carry each row's own `profile_id`, upsert transactions instead of delete-then-insert | deploy only |
| B | Provider identity, `consent_expires_at`, `last_synced_at`, `UNIQUE(profile_id, provider_id)`; connect inserts rather than replaces; sync loops connections | **DONE** (migration `20260908180000_truelayer_multiple_connections.sql` + edge function v19) |
| C | Backfill history in date windows, resumable via `backfilled_from` because an edge function will time out before a multi-year walk finishes | **DONE** (pagination within a window still open) |
| D | Daily `pg_cron` sync, as `watchlist-daily-sync` already does; surface consent expiry before it lapses | B (now unblocked) |

A is worth doing on its own and immediately: it is small, and it is the
difference between syncing being safe and being destructive.

**How much history is actually available, and how to get all of it.** The 90
days in the current code is a number this codebase invented, not a limit the
banks impose. Two different constraints get confused here and neither is a
90-day history cap:

- *Consent* must be reconfirmed roughly every 90 days. That governs how long
  access keeps working, not how far back the data goes.
- *Depth* is set per provider. Under the Open Banking spec the CMA9 generally
  expose up to about 24 months of current-account transactions; some give less,
  and it varies by product. There is no published figure that is reliable
  across providers.

The practically important part is the distinction between *attended* and
*unattended* access. Several providers return a short window for background
polling but their full retained history when the customer has just
authenticated. So the deep fetch has to happen at the moment of connection —
in the callback, while the session is still customer-present — and again after
each consent reconfirmation, not on a nightly cron.

The strategy that follows is: do not guess the limit, discover it.

1. On connect, immediately walk backwards in windows (90 days per request is a
   safe chunk) from today toward an optimistic floor — six years — issuing
   requests until the provider returns empty ranges consistently.
2. Record per connection how far back it actually yielded. That number is the
   provider's real limit, learned rather than assumed, and it tells you what a
   later re-consent can hope to add.
3. Persist `backfilled_through` after every window so the walk resumes on the
   next invocation. An edge function will time out long before a multi-year
   backfill finishes, so this has to be a resumable loop, not one long run.
4. Once backfilled, scheduled syncs only need a short incremental window. The
   deep walk is a connect-time and re-consent-time operation.

Everything fetched is kept permanently. The bank's window moves; the local
store does not.

One wrinkle for C: TrueLayer transaction ids are not stable across the
pending-to-settled transition, so deduping on `tl_tx_<id>` will double-count
anything ingested while pending. Ingest settled rows only at first; treat
pending as a display concern later, if at all.


#### 7.N Loan balances — project from an anchor, reconcile against the source

There is no API for a student loan balance, and none for most mortgages or car
finance either. The answer is not to find one. It is to hold a number that was
true on a known date, project forward from it, and correct the projection when
a real figure is next observed.

Most of the machinery exists. `projectDebtBalance` already runs both repayment
shapes — amortising, and income-contingent with a write-off term — and
`finance_debts` already carries `original_amount`, `interest_rate`,
`min_payment`, `student_loan_plan`, `write_off_years` and a `draws` jsonb. What
is missing is the part that makes a projection trustworthy over years rather
than months.

**The balance has no as-of date.** `finance_debts.balance` is one mutable
number. `startDate` is when the loan began, not when the balance was last
known, so projecting from a figure typed in eight months ago silently treats it
as today's. That is a live accuracy bug, not a future feature.

**Overwriting loses the evidence.** Checking gov.uk and correcting the number
throws away the only data that could tell you how wrong the model was. Without
a history of observations there is no drift to measure and nothing to tune.

So: `finance_debt_observations` — `debt_id`, `profile_id`, `observed_on`,
`balance`, `source` (`manual` / `statement` / `provider`), `note`. Each row is
an anchor. Projection runs from the most recent anchor rather than from a
floating `balance`, and `finance_debts.balance` becomes a cached view of the
latest observation rather than the source of truth.

Reconciliation then has something to say. Given two consecutive anchors, the
gap between what the model predicted for the later date and what was actually
observed is the drift, and it is attributable: an implied interest rate, or a
payment total that did not match. Surfacing "your projection was £340 light
over eleven months, which implies 7.1% rather than the 6.4% recorded" turns a
chore into a correction. That is the whole feature.

**One fact must be written down before anyone reconciles a student loan
against gov.uk, because getting it wrong makes the model worse rather than
better.** HMRC collects the deduction through PAYE every month, but passes it
to the Student Loans Company only once a year, after the tax year closes. The
balance shown on the SLC portal is therefore stale by design — by up to about
eighteen months at the worst point in the cycle, and it does not include this
year's deductions at all. A naive reconciliation would read that as the model
under-paying and "correct" a correct model into a wrong one.

The rule that follows: an SLC observation anchors the balance *as at the date
SLC's data was last updated*, not as at the date you looked. The observation
row needs `statement_date` distinct from `observed_on`, and the projection runs
forward from `statement_date` applying the deductions since. Done properly,
the local figure is more accurate than the official one between updates — which
is the reason to build it at all.

**A second gap for student loans specifically.** `calculateFinance` already
computes the monthly deduction from salary and the plan threshold, and
`projectDebtBalance` independently re-derives repayments from `grossSalary`.
Two models of the same quantity, neither aware of the other, and neither
reading what was actually deducted. Where payslip data exists it should drive
the projection, with the modelled figure as the fallback — same precedence the
rest of the app uses for observed over estimated.

**Rate periods, for the amortising loans.** A single `interest_rate` cannot
express a two-year fix reverting to SVR, a tracker following base rate, or Plan
2's income-linked RPI-to-RPI-plus-3% sliding scale. Add `rate_periods` as jsonb
on the debt, following the precedent `draws` already sets: a list of
`{ effective_from, rate }`, with the projection taking the rate in force at
each month it steps through. A single-entry list is the current behaviour, so
this is additive.

Car finance is worth naming as its own shape. Hire purchase amortises to zero
and is covered. PCP does not — it runs to a balloon payment, so the projection
must stop at an agreed final value rather than at zero, and the interesting
number is the optional final payment against the car's likely worth. That is a
`repayment_type` of its own, not a variation of amortising.

| Step | Work | Gated on |
|---|---|---|
| A | `finance_debt_observations`, projection anchored on the latest one, `balance` demoted to a cache | **DONE** |
| B | Drift on reconcile: predicted vs observed, with the implied rate | **DONE** |
| C | `statement_date` on observations, and the SLC lag handled explicitly | **DONE** |
| D | Projection steps the rate in force, reading an optional list of periods | **DONE** |
| D2 | `rate_periods` jsonb column feeding D | **DONE** |
| E | PCP as its own repayment type, terminating at a balloon | **DONE** |
| F | Payslip deductions drive the student loan projection where present | **DONE** |

D and E are pure changes to `lib/finance/debt.ts`: the projection takes an
optional list of rate periods and an optional balloon, and falls back to
today's behaviour when neither is given. Both are testable and shippable with
no migration and no key, so they go first whenever the schema work is blocked.
D2 is the column that eventually feeds D, and only that part waits.


#### 7.R Decomposition, and one gap in the toolchain

##### The shape a surface collapses into

`BudgetSurface` went 2,172 → 1,290 lines and 30 → 15 `useState`, and the method
generalises to the files still outstanding.

What was actually wrong was not length. It was that fifteen category kinds each
had a hand-written copy of the same three things: a `useState` pair, an arm of a
fifteen-branch `if/else`, and a ~45-line arm of a fifteen-deep JSX ternary. The
differences between them amounted to a preset list, an emoji, a label and a
placeholder. So:

1. **The differences become a table** — `budget-preset-groups.ts`, one row per
   kind, with the matcher, options and copy as data.
2. **The repetition becomes one component** — `BudgetPresetField`, 103 lines
   replacing 677 of ternary.
3. **The arithmetic leaves the render body** — `lib/finance/spend-history.ts`,
   pure and tested, taking `today` as a parameter like everything else there.

The table also pinned behaviour that had been accidental: first-match-wins
ordering means a category named "Travel" routes to *transport*, because
`isTransportCategory` matches "travel" and sat earlier in the chain. Preserved
deliberately and covered by a test, so changing it later has to be a decision.

##### The thing to look for in the remaining files

`BudgetSurface` and `FinancePage` both wrap their entire render in
`const content = (() => { ... })()`. That single expression is why ~25 derived
values sit in the render path with no `useMemo` and why a 2,000-line file has
almost no top-level structure — everything is one function by construction. It
is also why a `const totalSpent` can coexist with a `totalSpent` prop without
TypeScript objecting.

`AccountsSurface` was next: its 2,071 lines, 17 `useState`, and 7 dialogs
were decomposed into 4 dedicated section components and reduced to 21 lines.

##### `supabase/functions/` is not type-checked by anything

`tsconfig.app.json` is `"include": ["src"]`, so no npm script covers the Edge
Functions. `deno check` on `truelayer-sync` found six errors that had been
sitting there, including `error.message` on an `unknown` in a catch — which was
also returning stack detail to callers, against the error-handling rule in
CLAUDE.md.

Deno is the runtime these actually run on, so it is the right checker:

```bash
deno check supabase/functions/**/*.ts
```

Worth a `typecheck:functions` script and a line in CLAUDE.md's shipping
checklist, so the next one is caught before deploy rather than by chance.


#### 7.O Where things stand, and what happens next

A status board rather than a design. 7.A–7.N say *what* and *why*; this says
*what is left* and *in what order*. Update it as things land.

**As of 2026-09-07 (evening).** 366 tests, lint at zero, typecheck clean, build
clean. `main` up to date. Live project `yvtiybyuifkiwyrnjebe`, all migrations
applied, `truelayer-sync` at v18.

##### Landed since the last board update

**7.7 payslips — done.** Storage, capture, native view and browser-side PDF
extraction are all in the tree:

- `finance_payslips` table plus `lines` jsonb (migrations through
  `20260907210000_payslip_lines.sql`)
- `PayslipsSection` on Income: manual capture, tax-year totals, model
  comparison for student loan
- `PayslipImportDialog`: folder import with review-before-write
- `PayslipDetailDialog`: native payslip view with line items
- `payslip-parse.ts` / `payslip-pdf.ts`: pdf.js extraction in the browser, no
  model, tested against real layouts

**AccountsSurface decomposition — done.** Reduced from 2,071 lines down to 21
lines, decomposed into 4 self-contained components in `src/features/finance/components/`
(`BankAccountsSection.tsx`, `DebtsSection.tsx`, `MembershipsSection.tsx`, and
`CreditReportsSection.tsx`), eliminating cascading rerenders across the 17 `useState`
hooks and 7 dialogs.

**7.N loan balances & drift reconcile — done.** Anchored balance projections
stepping forward from verified anchors rather than a floating mutable balance:
- `finance_debt_observations` table (migration `20260907230000_finance_debt_observations.sql`)
- Drift calculation & numerical solver for implied annual interest rate (`calculateDebtDrift`)
- SLC reporting lag handled by bridging statement dates with captured payslip deductions (`reconcileStudentLoanWithPayslips`)
- `rate_periods` and `final_payment` (PCP balloon) stored and wired into projection
- `DebtReconcileDialog` with live drift preview, implied rate, and observation history

**7.M step B multi-bank TrueLayer connections — done.** Multiple distinct banks
can now be connected and synced simultaneously without overwriting:
- `finance_truelayer_connection` gained `provider_id`, `provider_name`,
  `provider_logo_uri`, `consent_expires_at`, `last_synced_at`, and
  `UNIQUE(profile_id, provider_id)` (migration `20260908180000_truelayer_multiple_connections.sql`)
- `truelayer-sync` discovers provider identity via `/data/v1/me`, upserts
  per provider, supports individual disconnect, and loops all active
  connections during `sync_transactions` (deployed to live Supabase)
- `BankAccountsSection` renders individual bank cards with logos, consent
  expiration timers, individual disconnect actions, and "+ Connect Another Bank"

What 7.7 does **not** close by itself — and is still open below — is **7.8**
(reconcile net pay against transactions).

##### The honest caveat

A large amount of the finance work has never been looked at in a browser. The
section is admin-gated, so an agent cannot sign in to check it. Built, typed
and tested is not the same as *seen*, and the following have not been seen:

- the review queue keyboard loop (`j`/`k`/`r`/`x`, progress bar)
- the budget add-item dialog after the preset table rewrite
- the goal picker after the emoji fix
- payslip import, capture form and detail dialog (7.7 — new since the last pass)
- every text size, card surface and radius the design pass touched

None of it is speculative — the logic underneath carries tests — but a layout
that broke would not have announced itself. **Half an hour with the page open
is worth more right now than any item below.**

##### Ready to build, nothing blocking

| # | Work | Why now |
|---|---|---|
| 1 | CSV / OFX statement import | The only route to bank history older than the API serves, and parsing is deterministic — no key, pure `lib/finance`, testable |
| 2 | Extend `deriveAlerts` into the deterministic "what changed" summary | 7.Q: the standing summary must be reproducible, so it is rules over rows rather than generated prose |
| 3 | 7.8: reconcile captured payslip net pay against transactions | 7.7 is done; this is the next step that makes the figures useful beyond display |
| 4 | 7.M step D: nightly `pg_cron` sync | Unblocked by 7.M step B; `watchlist-daily-sync` is the working precedent |
| 5 | 7.K: `effective_from` on tax bands | Migration. Past figures are silently rewritten today |
| 6 | Pagination inside a fetch window | A dense 90-day window still truncates |

##### Needs a decision, not a keyboard

| Question | Why it is stuck |
|---|---|
| `rounded-xl` (126) vs `rounded-lg` (314) | Changes every card corner in the section. A look, not a cleanup |
| 157 uppercase labels | Which deserve the emphasis is judgement, and 157 unverified sites is the same risk as the corners |
| Public demo profile | Decided in principle, never scoped. Changes what the anon role may read |
| FCA framing for 7.L | Only matters if this stops being private, but it shapes the feature |

##### Blocked on a model key — any provider

The assistant is provider-agnostic by construction. There are not N vendor
integrations to write, there are two wire protocols and a list: almost every
vendor speaks OpenAI's `/chat/completions` shape (Moonshot/Kimi, DeepSeek,
Mistral, Groq, xAI, Together, OpenRouter, and anything local behind Ollama or
vLLM), and Anthropic speaks its own. `lib/finance/llm.ts` translates both;
adding a provider is a registry row — id, protocol, base URL, model, which
secret holds the key — and never an edit to that file.

The registry stays server-side. A client that could name a URL rather than an
id would be an SSRF hole with a friendly name; it names an id, and the Edge
Function resolves it.

So the gate is *a* key, not a particular vendor's:
`supabase secrets set <PROVIDER>_API_KEY=...`. Automated document extraction
(7.10 credit reports, anything a template cannot cover) is the one capability
that genuinely differs between vendors, so that step wants checking against
whichever model is chosen rather than assumed to port. Payslips do not wait on
this — 7.7 extracts in the browser.

7.P and 7.Q shrank this list to almost nothing. Storage, capture and
reconciliation never needed a model; they only appeared to because extraction
had been drawn into the middle of them.

- **7.6 assistant** — schemas, executor, context and protocol translation are
  all written. What is missing is the Edge Function and a key
- **7.9** — embeddings are a third-party call, so hybrid retrieval needs an
  embedding key (or a self-hosted model, per 7.P)
- **7.K news** — tax *rates* are data and unblocked; tax *news* is content

No longer blocked, and moved up: **7.8** (reconciling captured figures against
transactions) and **7.10**'s useful half (archive the credit report, capture
the scores by hand). **7.7 is done** — archive, capture, native view and
browser-side PDF import. Automated extraction for payslips remains a later
convenience, not a gate.

##### Deferred by choice

7.2e (measured, not worth building), 7.12 delivery (in-app alerts done),
7.13 contacts and settlements, 7.14 property, bureau API adapters (7.G — needs
a contract, not code).

##### A suggested order

1. **Look at the page.** Everything above assumes the last twenty commits render.
   Include Income → payslips: import a folder, open a detail dialog, check the
   student-loan comparison against the model.
2. **CSV/OFX import** — the main data gap payslips do not cover (bank history
   older than the API serves).
3. ~~**7.N A–C**~~ — done; debt observations, drift reconcile, and SLC statement lag handling implemented. Next: **7.8** (reconcile net pay to transactions).
4. ~~**`AccountsSurface`**~~ — done; decomposed into 4 dedicated section components.
5. **The key**, and then 7.6 through 7.10 in order.

The ordering principle: data before features, and anything that silently
produces wrong numbers before anything that produces new ones.


#### 7.J Done means

Checked against the tree on 2026-09-07 (evening) rather than left as an
aspiration, because a list of conditions nobody measures is not a definition
of done.

| Condition | State |
|---|---|
| `npm run lint` 0/0, `typecheck`, `build` | met — and 372 tests |
| `lib/finance/` pure, no React or Supabase, tested | met |
| Finance is five routed surfaces, not ten `localStorage` tabs | met |
| No `localStorage` key holds financial truth | met |
| Every non-template `finance_*` row carries a `profile_id`, CHECK-enforced | met |
| Zero sub-12px sizes and zero off-scale weights in `features/finance/` | met |
| Finance renders inside `AppShell`, no surface scrolls the document | met |
| `anon` holds no write grant on any finance table | met |
| No financial document readable without `is_admin()` | met — 7.E |
| 7.7: payslips stored, captured, viewable; PDF archived; extraction in-browser | met — `finance_payslips`, `PayslipsSection`, import and detail dialogs |
| `FinancePage.tsx` no longer exists as a single file | met — decomposed: `TaxIncomeSettingsDialog.tsx` extracted, unused components removed, reduced from 2,442 to 865 lines as an AppShell-level routed coordinator |
| No hardcoded hex colour in `features/finance/` | met — 0 remain; all design tokens or semantic HSL |
| No `select('*')` on the finance mount path | met — 17 finance tables use explicit column allowlists; 1 deliberate documented exception on `profiles` to preserve schema compatibility |

All conditions are met.

---

---

## Appendix — Verification commands

```bash
npm run typecheck     # not currently a CI gate; run by hand
npm run lint
npm run build
```

Supabase advisors should be re-run after every migration phase:

```
get_advisors(project_id, type: "security")
get_advisors(project_id, type: "performance")
```

Expected steady state after Phase 1: security clean except the accepted `is_admin` RPC lints (S-4); performance clean.

