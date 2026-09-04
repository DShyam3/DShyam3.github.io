# Rehaul Plan

Audit and restructuring plan for DShyam3.github.io. Covers the frontend architecture, the Supabase backend, and a phased sequence for getting from here to there.

Audit date: 2026-09-04. Branch at time of audit: `feature/finance-page`. Supabase project: `yvtiybyuifkiwyrnjebe` (Personal_Website, eu-west-2, Postgres 15.8.1.030).

---

## Part 0 — Executive summary

The site works and the design system is genuinely good. The problems are structural, not functional:

- **Frontend**: three competing implementations of the same "list of cards" idea. ~1,200 lines of near-duplicate component code, 7 near-identical hooks, 450 lines of dead code, and a 12,237-line Finance page.
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
| 7 | Finance rehaul | separate project | next |
| — | `features/` reorg | **reinstated** — measured against findability rather than line count, co-location is the point | **done** |

The last row is worth keeping visible as a record of a reversal. It was
originally Phase 6, then dropped on the grounds that it "relocates files
without reducing them" — true, but that judged it by line count. Judged by
"can I find things", co-location is the whole point, so it was reinstated and
done as part of Phase 5.

---

## Part 1 — Supabase audit

### Security findings

**S-1 — Storage write policies are open to any authenticated user. LIVE.** — *RESOLVED, migration `20260904110337`*

Verified against the running database. Current policies on `storage.objects`:

```
"Authenticated users can upload photos"     INSERT  TO authenticated  WITH CHECK (bucket_id = 'photos')
"Authenticated users can update photos"     UPDATE  TO authenticated
"Authenticated users can delete photos"     DELETE  TO authenticated
"Authenticated users can upload documents"  INSERT  TO authenticated
"Authenticated users can update documents"  UPDATE  TO authenticated
"Authenticated users can delete documents"  DELETE  TO authenticated
"Authenticated Uploads"                     INSERT  TO public  WITH CHECK (bucket_id = 'site-assets' AND auth.role() = 'authenticated')
```

None of these check `is_admin()`. Email signup is enabled on the project, so anyone who registers an account can upload to `site-assets` and can upload, overwrite, or delete objects in `photos` and `documents`. All three buckets are public-read, which makes this defacement, CV/photo deletion, and free file hosting on the project origin.

`supabase/20260904_secure_storage_object_policies.sql` already contains the correct fix. It is untracked in git and **has not been applied** — the live policies above are the pre-fix ones. Currently there is exactly 1 row in `auth.users`, so there is no evidence of exploitation.

Action: apply the migration, commit it, and separately disable public signup (see S-6).

**S-2 — `is_admin()` hardcodes the admin email.**

```sql
CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$ SELECT auth.jwt() ->> 'email' = 'd.shyam1256@gmail.com'; $$
```

The frontend gates admin UI on `VITE_ADMIN_EMAIL`. These are two independent sources of truth that must be kept in sync by hand. README currently states the function "check[s] the caller's JWT email against `VITE_ADMIN_EMAIL`" — it does not; the value is baked into the function body.

Not a vulnerability today (both values agree). It is a footgun: changing the env var silently gives you a UI that shows admin controls whose writes the database will reject. Either accept the duplication and document it accurately, or move the admin email into a single-row config table the function reads.

The `SET search_path` on this one is correct.

**S-3 — Trigger functions have mutable `search_path`.** — *RESOLVED, migration `20260904110337`*

`public.update_episodes_watched_status` and `public.update_season_watched_status` have no `search_path` pinned. Both are `SECURITY INVOKER` so the impact is limited, but the linter flags them and the fix is one line each. Already included at the bottom of the pending `20260904_*` migration.

**S-4 — `is_admin()` is callable over RPC by `anon` and `authenticated`.**

Flagged by the linter as `anon_security_definer_function_executable`. This is expected and required — RLS policy expressions are evaluated with the querying role's privileges, so revoking `EXECUTE` from `authenticated` would break every policy on the project. The function returns only a boolean about the caller and leaks nothing.

Action: no change. Document as an accepted lint so it stops looking like an open item.

**S-5 — Leaked password protection disabled; insufficient MFA options.**

Both dashboard settings. With a single admin account, enabling HaveIBeenPwned checking and adding TOTP is cheap and meaningfully raises the bar on the one account that owns everything.

**S-6 — Public signup is enabled on a single-user project.**

There is one intended user. Every other person who can reach the project can create an account, and that account is what S-1 escalates through. Disable email signup in the dashboard (Authentication → Sign In / Providers → disable "Allow new users to sign up"). This is the structural fix; S-1's policy tightening is the defence in depth.

**S-7 — Postgres has outstanding security patches.**

Running `supabase-postgres-15.8.1.030`. Schedule an upgrade window.

**S-8 — `sync_log` is publicly readable.** — *RESOLVED, migration `20260904111858`*

```
"Allow public read access to sync_log"  SELECT  TO public  USING (true)
```

Exposes watchlist sync internals (timestamps, counts, likely error strings) to anonymous visitors. Nothing on the public site renders it. Restrict to `is_admin()`.

**S-9 — `site-assets` bucket has no size limit and no MIME allowlist.** — *RESOLVED, migration `20260904111920`*

`photos` and `documents` both have a 50 MB limit and a MIME allowlist. `site-assets` has `file_size_limit = null` and `allowed_mime_types = null`. Once S-1 lands only the admin can write to it, so this is low severity, but match the other two buckets for consistency.

### Performance findings

**P-1 — 16 tables have overlapping permissive SELECT policies.** — *RESOLVED, migration `20260904111745`*

Every content table carries both:

```
"Public Read Access"  SELECT  TO public         USING (true)
"Admin Write Access"  ALL     TO authenticated  USING (is_admin())
```

`FOR ALL` includes `SELECT`, and the `public` role includes `authenticated`, so for a signed-in user Postgres evaluates both policies on every read. Affected: `articles`, `beliefs`, `books`, `creators`, `inspirations`, `inventory_items`, `links`, `movies`, `photos`, `recipes`, `site_content`, `tv_show_episodes`, `tv_show_seasons`, `tv_shows`, `visited_countries`, `weekly_schedule`.

Fix: split `Admin Write Access` into explicit `INSERT` / `UPDATE` / `DELETE` policies and drop the `ALL`. The SELECT overlap disappears and admin write behaviour is unchanged. Do this as one migration across all 17 tables.

**P-2 — Four foreign keys have no covering index.** — *RESOLVED, migration `20260904111849`*

- `finance_budget_items.category_id`
- `finance_goal_contributions.goal_id`
- `finance_transactions.account_id`
- `weekly_schedule.movie_id`

**P-3 — Duplicate index on `tv_show_episodes`.** — *RESOLVED, migration `20260904111849`*

`episodes_unique_match` and `unique_episode_per_season` are both `UNIQUE (season_id, episode_number)`. Drop one. This is the largest table on the project (7,640 rows, 3.2 MB) so the write cost is real.

Both turned out to be UNIQUE *constraints*, not bare indexes, so the drop had to
go through `ALTER TABLE ... DROP CONSTRAINT`. Safe because both sync paths
upsert with `onConflict: 'season_id,episode_number'` — the column-list form, not
a constraint name — so the surviving constraint satisfies them.

**P-4 — No index on `created_at`, but every read orders by it.**

`useSupabaseTable` defaults to `.order('created_at', { ascending: false })` for every table. No table has an index on `created_at`. Harmless at current row counts (most content tables are under 200 rows); it becomes a real sort cost on `tv_show_episodes` and `finance_transactions` as they grow. Add the index only where the column is actually the sort key in production.

**P-5 — `select('*')` everywhere, no column projection.**

120 `.from(` call sites. The worst two:

- `WatchlistContext` fetches `tv_shows` with `*, tv_show_seasons (*, tv_show_episodes (*))` — the entire 7,640-row episode tree, on every mount of the Watchlist page, to render a grid of posters.
- `Finance.tsx:2079-2095` fires 17 parallel `select('*')` calls on mount, one per finance table.

Fix: project only the columns the view needs; fetch the episode tree lazily when a show's detail dialog opens.

**P-6 — No pagination anywhere.**

Watchlist has a client-side `visibleCount = 48`, but the network fetch is unbounded. Every collection loads its full table. Fine today, unbounded by design.

**P-7 — `useSupabaseTable` has a silent fallback that re-runs the query.**

On a sort error (`42703` / any message containing "column") it retries the whole query without ordering. That is a second round trip triggered by a schema mismatch that should be a build-time error instead. Once collections are config-driven, the sort column is known per collection and the fallback can go.

### Schema hygiene

**H-1 — Migration files are not where the CLI expects them.**

Local `.sql` files sit flat in `supabase/`, not `supabase/migrations/`. `supabase db push` does not manage them. The consequences are visible in the applied history:

| Applied version | Applied name | Local file |
|---|---|---|
| 20260817221404 | secure_content_tables_rls | `20260724_secure_content_tables_rls.sql` |
| 20260817221412 | secure_finance_tables_rls | `20260724_secure_finance_tables_rls.sql` |
| 20260817221725 | revoke_anon_select_truelayer_connection | *(no local file)* |
| — | — | `20260716_finance_relational_schema.sql` *(not in history)* |
| — | — | `20260718_add_truelayer_table.sql` *(not in history)* |
| — | — | `20260725_schedule_watchlist_sync.sql` *(not in history)* |
| — | — | `20260904_secure_storage_object_policies.sql` *(not in history)* |

Timestamps don't match, one applied migration has no file, and four files have no applied record. Migrations have been run ad hoc through the dashboard/MCP rather than through the CLI.

Fix: create `supabase/migrations/`, move the files there with correct timestamps, and reconcile with `supabase migration repair` so the history and the repo agree. From then on, `supabase db push` only.

*Partially addressed.* `supabase/migrations/` now exists and holds the five
Phase 0/1 migrations, each named with the exact version the server recorded. The
legacy flat files are still in `supabase/` and still drifted — `supabase/README.md`
documents which ones were never applied and warns against running them. Full
reconciliation happens as part of the Phase 1.5 baseline.

**H-2 — Legacy blob tables still live.**

`finance_data` (11 rows, key/value blob) and `finance_defaults` predate the relational finance schema. `20260817_secure_legacy_finance_blob_tables_rls.sql` secured them rather than removing them. Verify nothing reads them, then drop.

**H-3 — `creators` table is orphaned.**

Table exists (16 kB, ~0 rows) and the entire `src/components/creators/` folder (6 files, 411 lines) has zero importers. Drop both.

**H-4 — `config.toml` contains only `project_id`.**

No local dev stack config, no auth settings, no seed. If local development is ever wanted, this needs filling in. Low priority.

**H-5 — `inventory_items.description` is unused.**

Null in 141 of 143 rows (59/59 tech-edc, 56/56 wardrobe, 11/11 hygiene, 5/5
sports-gear, 10/12 homelab). Added by migration
`20260716182702_add_description_to_inventory_items` and effectively never
populated. Either the add-dialog never collects it or the field isn't wanted.
Decide before it gets carried into the new collection config — it is a free
deletion if unwanted.

**S-10 — `anon` holds write privileges on every table, including all 19 finance tables.**

Surfaced by the schema dump. Table-level grants (separate from RLS) are:

| Tables | `anon` privileges |
|---|---|
| all 19 `finance_*` | DELETE, INSERT, REFERENCES, TRIGGER, TRUNCATE, UPDATE |
| content + watchlist + travel | the above **plus SELECT** |
| `sync_log`, `visited_cities` | SELECT, REFERENCES, TRIGGER, TRUNCATE, UPDATE |

These are Supabase's defaults for the `public` schema, not something that was
set deliberately. SELECT was revoked on the finance tables at some point; the
write privileges were left.

**Not currently exploitable.** RLS is enabled on all 39 tables and gates
INSERT/UPDATE/DELETE to `is_admin()`, so an anonymous write matches zero rows.
PostgREST also exposes no verb that maps to TRUNCATE.

**Why it still matters:** TRUNCATE is *not* filtered by RLS — Postgres applies
row-level security to SELECT/INSERT/UPDATE/DELETE only. So the grant is a
latent privilege whose only barrier is that no API surface reaches it. Belt and
braces would be `REVOKE ALL ON <finance tables> FROM anon`, so that an RLS
mistake on a finance table cannot become data loss. Low severity, worth a
migration.

**H-7 — The `books` table has two categories meaning the same thing.**

Live data: `completed` (4), `future` (1), `wishlist` (1). `future` and
`wishlist` are plainly the same idea introduced twice.

This only became visible during the Books conversion, because four files had
four different ideas of what the categories were:

| Source | Categories |
|---|---|
| live data | `completed`, `future`, `wishlist` |
| `types/books.ts` | `favourite`, `future` |
| `useBooks` nav | `reading`, `completed`, `wishlist` |
| both dialogs | `favourite`, `future` |

So the "Reading" tab matched nothing, and the single `future` book was
unreachable from any tab except All. `BookCard` also badged every non-favourite
book "To Read", so completed books were mislabelled in the detail dialog.

`collections/books.tsx` now declares the three that exist, which fixes the
visibility and the badge. Merging `future` and `wishlist` is a data migration
plus a naming decision, so it is left for you: pick the survivor, and it is a
one-line `UPDATE` plus a one-line config change.

**H-8 — The Recipes category nav filtered on the wrong column.**

`useRecipes` offered "Personal" and "Reference" tabs and filtered
`category === 'personal' | 'reference'`. But personal-vs-reference is the
separate `is_personal` boolean; `category` holds meal types. Live data is
`main` (2), `breakfast` (2), `desserts` (1), and `is_personal` is true for all
five. So both tabs matched nothing and only "All" worked. The add dialog
compounded it by hardcoding `category: 'main'` whatever was chosen.

`collections/recipes.tsx` facets on the three real meal types, and
`is_personal` drives the card subtitle and detail badge instead of pretending
to be a category. Fixed.

**H-6 — README advertises a `kitchen` inventory category that doesn't exist.**

Live categories are `tech-edc`, `wardrobe`, `homelab`, `hygiene`, `sports-gear`.
Either stale copy or an intended category never added.

---

## Part 1b — Schema organisation decisions

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

## Part 2 — Frontend audit

### Duplication, measured

**D-1 — Seven near-identical collection hooks.**

`useBooks`, `useLinks`, `useArticles`, `useRecipes`, `useInspirations`, `usePhotos`, `useBeliefs`. Diffed the first four: identical 50-line structure, only the noun changes.

```
useSupabaseTable<T>(table)
  + useState activeCategory
  + useState searchQuery
  + useMemo filter
  + categories array
  + getCategoryCount
```

~350 lines that should be ~60 plus config.

**D-2 — Parallel component families.**

`books/`, `links/`, `creators/` each ship Card / Grid / CategoryNav / Header / AddDialog / EditDialog. `BookGrid` vs `LinkGrid` differ only in type name, empty-state copy, and grid column classes. `BookCategoryNav` vs `LinkCategoryNav` differ only in type name and whether a `SearchBar` slot exists.

**D-3 — The generic system exists and lost.**

`components/shared/` holds `ItemCard` (247), `ItemGrid` (147), `AddItemDialog` (291), `EditItemDialog` (274) — 959 lines of generic machinery consumed by exactly one page (Inventory). `layout/CategoryNav` (58): also only Inventory. Adoption: 1 of 13 pages.

**D-4 — The detail dialog, by contrast, succeeded.**

`components/cards/CardDetailDialog.tsx` (202 lines) plus its `DetailSection` export is used by BookCard, LinkCard, ItemCard, SeasonEpisodeList, Recipes, Articles, Inspiration. Its prop shape is already the right abstraction:

```
title, subtitle, imageUrl, link, badge   -- shared chrome
onDelete, onSchedule, isScheduled        -- shared actions
children                                 -- the varying body
```

This is the proof the model works. The card *face* is the part that never got the same treatment.

**D-5 — Dead code.**

Zero importers: all of `src/components/creators/` (411 lines), `layout/NavLink.tsx`, `books/BooksHeader.tsx`, `links/LinksHeader.tsx`. Roughly 450 lines.

**D-6 — Oversized files.**

| File | Lines |
|---|---|
| `pages/Finance.tsx` | 12,237 (134 `useState`, ~90 top-level declarations) |
| `pages/Watchlist.tsx` | 1,520 (21 `useState`) |
| `contexts/WatchlistContext.tsx` | 1,445 |
| `components/watchlist/WatchlistDetailDialog.tsx` | 570 |

Finance is 76% of all page code. Watchlist page + context is 2,965 lines for one feature.

### Target architecture

Four layers, dependencies only pointing downward:

```
pages/          route composition only. thin.
collections/    one config per domain. the "what".
components/     cards/, collection/, dot-matrix/, layout/, ui/
features/       things that genuinely aren't a collection: watchlist, travel, finance
lib/            pure functions. no React, no network.
integrations/   supabase, tmdb, truelayer. nothing else knows these exist.
```

Rules:

1. Pages wire; they do not compute.
2. Pure logic never imports React. If a tax calculation needs `useState`, it is in the wrong place.
3. One way to do a thing. One list system, not a generic one plus five bespoke ones.
4. Nothing over ~400 lines without a stated reason.
5. Adding a new section = one config file + one migration. No new components.

### The card system

Composition with slots, not class inheritance. React function components can't inherit `useState`, and single-parent inheritance would force absurd combinations (`PosterScheduleSeasonCard`). Slots give the same reuse with better composition.

Mapping the OOP intuition onto what actually works:

| OOP concept | Implementation |
|---|---|
| base class `Card` | `<EntityCard>` — fixed chrome |
| `BlogCard extends Card` | `<EntityCard variant="text">{<Paragraphs/>}</EntityCard>` |
| override a method | pass a different slot / render prop |
| abstract method | required field on `CollectionConfig<T>` — TS enforces it |
| polymorphism | config registry keyed by collection name |

Two primitives plus one config type:

```
EntityCard          face. variant: poster | tile | text | compact
                    slots: media, title, subtitle, meta, actions, onOpen
CardDetailDialog    already exists. body is a slot.

CollectionConfig<T> table, categories, searchFields, sortColumn,
                    cardVariant, renderCardMeta, renderDetail
```

Each domain becomes a config file rather than a component family:

```
collections/books.ts       ~40 lines
collections/links.ts       ~30 lines
collections/articles.ts    ~35 lines
collections/watchlist.ts   ~80 lines (richest, still just config)
```

Detail-body variation, expressed as config rather than subclasses:

| Collection | Card face | Detail body |
|---|---|---|
| Links | tile | none |
| Inventory | tile | spec list |
| Books | poster | blurb + progress |
| Articles | text | paragraphs |
| Recipes | text | ingredients + method |
| Photos | poster | full image |
| Watchlist | poster | seasons + episodes + schedule |

### The filter layer

Watchlist's 21 `useState` include seven that are pure filter state: `selectedCategory`, `searchQuery`, `hideCompleted`, `selectedPlatform`, `selectedGenre`, `selectedStatus`, `sortOrder`. That is the same concept as Books' `activeCategory` + `searchQuery`, just with more facets.

One hook covers the whole site:

```
useCollection<T>(config)
  -> items (filtered), all, filters, setFilter, counts,
     add, update, remove, loading
```

Books uses one facet, Watchlist uses six. Same hook. This retires D-1 *and* a third of Watchlist's local state.

### Watchlist decomposition

| Concern | Now | Target |
|---|---|---|
| Filters (7 state vars) | inline in page | `useCollection` — shared |
| TMDB search + add flow | inline in page | `features/watchlist/AddFromTMDB.tsx` |
| Sync loop | `WatchlistContext` (1,445 lines) | `features/watchlist/sync.ts` — pure functions the context calls |
| Schedule view | `ScheduleItem` + `WeeklySchedule` (417) | unchanged, already fine |

`WatchlistContext.syncWatchlist` is hand-mirrored in `supabase/functions/watchlist-cron-sync/index.ts`. The duplication is deliberate and documented (no shared module between Deno and the browser bundle). Extracting the shared logic into dependency-free pure functions — taking data in, returning intended writes out — would let both sides call the same shape even if the file is physically copied, keeping them in lockstep by structure instead of by comment.

### Finance containment

Finance is a separate rehaul. For now, contain rather than move or delete:

**Chosen approach:** move `pages/Finance.tsx` → `features/finance/FinancePage.tsx`, keep it lazy-routed, and enforce a boundary — nothing outside `features/finance/` may import from it, and it may import only from `lib/`, `ui/`, and `integrations/`.

Rejected alternatives:

- *Branch without Finance.* Cleaner headspace, but Finance imports `Header`, `Footer`, `DotMatrixText`, `useAuth`, and `use-toast`, all of which the rehaul touches. Every one becomes a merge conflict on the way back.
- *Delete from the branch.* Only sensible if Finance is to be rewritten from scratch afterwards.

Work still happens on a branch (`refactor/core-structure`); Finance simply isn't deleted on it.

---

## Part 3 — Phased plan

### Phase 0 — Ship what's already written — **DONE**

1. ~~Apply `20260904_secure_storage_object_policies.sql`~~ — applied as
   `20260904110337`. Verified: all seven storage write policies now check
   `is_admin()`; the three public-read policies are untouched; both trigger
   functions have `search_path = public, pg_temp`.
2. **Disable public signup in the dashboard (S-6)** — *still outstanding, needs
   the dashboard.*
3. ~~Commit the untracked security work~~ — commit `5229fa9d` on
   `feature/finance-page`: CSP plugin, referrer meta, frame guard,
   `SECURITY.md`, storage migration.

Note: this landed on `feature/finance-page`, which is 21 commits ahead of
`main`. If that branch isn't merging soon, cherry-pick `5229fa9d` onto `main`
so the hardening ships independently of the finance work.

### Phase 1 — Supabase quick wins — **DONE**

1. ~~Split `FOR ALL` admin policies~~ — `20260904111745`, 16 tables (not 17;
   the finance tables have no public-read policy so they never overlapped).
   Verified exactly one policy per (table, command).
2. ~~Add the four missing FK indexes~~ — `20260904111849`.
3. ~~Drop the duplicate `tv_show_episodes` index~~ — `20260904111849`, as a
   constraint drop.
4. ~~Restrict `sync_log` SELECT to `is_admin()`~~ — `20260904111858`. Checked
   first that every consumer sits behind an `isAdmin` gate
   (`Watchlist.tsx:549`, `:643`).
5. ~~Size limit and MIME allowlist on `site-assets`~~ — `20260904111920`,
   allowlist derived from what the bucket actually holds.
6. ~~Move migrations into `supabase/migrations/`~~ — partial; see H-1. Full
   reconciliation moves to Phase 1.5.
7. **Enable leaked-password protection and TOTP MFA (S-5)** — *outstanding,
   dashboard.*
8. **Schedule the Postgres upgrade (S-7)** — *outstanding, dashboard.*

**Advisor state after Phase 1:** `multiple_permissive_policies`,
`unindexed_foreign_keys`, `duplicate_index` and `function_search_path_mutable`
all cleared. Remaining: the two accepted `is_admin` RPC lints (S-4), the three
dashboard items above, and four `unused_index` INFO lints for the FK indexes
just created — expected, they clear once queries hit them.

### Phase 1.5 — Declarative schemas — **DONE**

1. ~~Start Docker~~ — done; CLI linked to the project.
2. ~~Dump and split into per-collection files~~ — 17 files in
   `supabase/schemas/`. Verified lossless: 491 statements in the production
   dump, 491 in the files, identical as sets.
3. ~~Baseline migration~~ — `20260904130000_baseline.sql`. Contains the public
   schema dump, plus storage buckets/policies and the pg_cron job (neither is
   covered by a `public` dump), plus an explicit REVOKE section.
4. ~~Reconcile history~~ — baseline marked applied, the 20 superseded versions
   marked reverted. `migration list` now shows one entry, local and remote.
   `db push --dry-run` reports up to date.
5. ~~Delete legacy flat files~~ — removed; they remain in git history.
6. ~~Verify~~ — `db diff --linked` reports **no schema changes**. The repo can
   now rebuild the database from empty.

**Two things the process surfaced that the audit had wrong:**

- `20260725_schedule_watchlist_sync.sql` *was* applied — the cron job
  `watchlist-daily-sync` runs at 06:00 daily. It was applied without being
  recorded in migration history, not skipped. H-1's list of "never applied"
  files overstated the case for this one.
- `pg_dump` emits `GRANT` but never `REVOKE`, so the first baseline attempt
  diffed against production with 30 stray revokes. Section 4 of the baseline
  restores them explicitly. Worth remembering: any future privilege revocation
  will not round-trip through the differ either.

Workflow from here: edit the schema file, `db diff -f <name>`, **read** the
generated migration, `db push`. The differ does not handle RLS policy renames
or DML, and this schema is mostly RLS — treat generated migrations as drafts.

### Phase 2 — Delete dead code

Branch `refactor/core-structure`. Remove `src/components/creators/`, `layout/NavLink.tsx`, `books/BooksHeader.tsx`, `links/LinksHeader.tsx`. Drop the `creators` table (H-3). Verify `finance_data` / `finance_defaults` are unread and drop them (H-2).

Zero behaviour change. ~450 frontend lines, 2 tables.

### Phase 3 — Build the system, convert one page

1. Write `CollectionConfig<T>` type.
2. Write `useCollection<T>(config)`.
3. Write `EntityCard` with the four face variants.
4. Write `CollectionPage` (header + filter bar + grid + add button).
5. Convert **Links only** — smallest page, 60 lines, two components.

This is the decision point. If the slot API feels awkward on Links, it is far cheaper to find out at 200 lines than at 1,200. Do not proceed to Phase 4 until Links is converted and looks identical to today.

### Phase 4 — Convert the rest — **DONE**

All eight collections are one file in `src/collections/`, and all eight pages
are six lines. Card variants settled at five — `tile`, `poster`, `square`,
`feature`, `text` — shared rather than one per page.

Config grew five options along the way, each earned by a real page and each
reusable: `externalSearch` (Books/Google Books, and the watchlist's TMDB flow
later), `file` fields with `uploadFile` (Photos), `groupBy` (Inventory's
wardrobe sections), `sortOptions` with `hiddenWhen`, `summary`, plus
`facets[].includeAll` / `defaultValue` and `adminOnly`.

Three broken category navs found and fixed on the way — Books (H-7), Recipes
(H-8) and Links' dead search box — all the same root cause: the category list
living in three or four places at once.

### Phase 5 — Watchlist — **DONE**

1. ~~Adopt `useCollection` for the filter layer~~ — **not done, deliberately.**
   `useCollection` reads through `useSupabaseTable`; the watchlist's data comes
   from its own context with sync, episode tracking and favourites attached.
   Forcing it through would have bent the collection model to fit one page.
   The filters stay in the page.
2. ~~Extract the TMDB add flow~~ — one `TmdbSearchDialog` now serves both the
   watchlist and favourites add flows, which were ~340 lines of duplicated
   markup differing only in the click handler and the row's status badges.
3. ~~Extract sync into pure functions~~ — `sync-logic.ts` holds the decisions
   (`getPlatform`, `buildCommonUpdates` / `buildMovieUpdates` /
   `buildShowUpdates`). `getPlatform` had been duplicated verbatim in the Deno
   cron function; both sides now point at each other.
4. ~~Make the episode tree lazy~~ — the mount query drops from all ~7,600
   episode rows in full (474 kB) to three columns (67 kB), with
   `loadShowEpisodes(showId)` fetching the rest when a dialog opens.
5. ~~Split `WatchlistDetailDialog`~~ — `WatchlistDetailParts` holds the
   fragments its mobile and desktop layouts had been copy-pasting.

Plus the `features/` co-location covering watchlist, travel and finance.

**H-9 — the series-status pill ignored TMDB's spelling of "Canceled".** Both
layouts matched `'Cancelled'` only, so the 21 shows TMDB marks `Canceled`
rendered the pill with no background colour. Fixed in `WatchlistDetailParts`.

Watchlist page + context: 3,047 → 2,799 lines, with the dialogs, sync
decisions and shared fragments now in named modules rather than inline.

### Phase 6 — Finance containment — **DONE**

Moved to `features/finance/` as part of the Phase 5 co-location. Boundary
only; no internal changes. Phase 7 remains untouched.

### Phase 7 — Finance rehaul

Separate project, planned separately. First step when it starts: extract the pure logic — tax bands, student-loan plans, `projectDebtBalance`, payday and bank-holiday arithmetic, holiday allowance, credit-score bands, `polarToCartesian` / `describeArc` — into `lib/finance/` with tests. None of it needs React, and it is the highest-value extraction in the repo.

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
