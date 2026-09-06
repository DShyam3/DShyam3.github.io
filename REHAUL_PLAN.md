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
| 7 | Finance rehaul | multi-profile decision engine, one plan below | **planned, next** |
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

**S-2 — `is_admin()` hardcodes the admin email.** — *RESOLVED as documentation. The duplication is accepted and now written down accurately in `README.md` (it previously claimed the function reads `VITE_ADMIN_EMAIL`, which it does not). Moving the email into a config table remains an option, not a plan.*

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

**S-4 — `is_admin()` is callable over RPC by `anon` and `authenticated`.** — *RESOLVED as documentation, see the accepted-lints table in `SECURITY.md`.*

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

**P-5 — `select('*')` everywhere, no column projection.** — *Watchlist resolved (Phase 5). Collections: the mechanism now exists -- `CollectionConfig.columns` passes a PostgREST select list through `useCollection` -- but measured against production no collection currently needs it. The largest, `inventory_items`, is 79 kB across 143 rows, and its two biggest columns (`image`, `link`) are both rendered on the card. Finance is Phase 7.*

120 `.from(` call sites. The worst two:

- `WatchlistContext` fetches `tv_shows` with `*, tv_show_seasons (*, tv_show_episodes (*))` — the entire 7,640-row episode tree, on every mount of the Watchlist page, to render a grid of posters.
- `Finance.tsx:2079-2095` fires 17 parallel `select('*')` calls on mount, one per finance table.

Fix: project only the columns the view needs; fetch the episode tree lazily when a show's detail dialog opens.

**P-6 — No pagination anywhere.** — *Deliberately not built. Measured: the largest collection is 143 rows / 79 kB, the watchlist's heaviest query is 894 ms cold, and a server-side limit with no "load more" would silently hide items. Revisit when a table passes ~1,000 rows.*

Watchlist has a client-side `visibleCount = 48`, but the network fetch is unbounded. Every collection loads its full table. Fine today, unbounded by design.

**P-7 — `useSupabaseTable` has a silent fallback that re-runs the query.** — *RESOLVED. The fallback is gone; sort columns are declared per collection, so a bad one now fails loudly.*

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

**H-4 — `config.toml` contains only `project_id`.** — *RESOLVED. Local stack config now mirrors production: Postgres 15, signup off, 50 MiB storage cap, `max_rows`.*

No local dev stack config, no auth settings, no seed. If local development is ever wanted, this needs filling in. Low priority.

**H-5 — `inventory_items.description` is unused.** — *RESOLVED by the Phase 4 collection work: the field is collected by the add/edit form and rendered in the detail panel, including as a spec table.*

Null in 141 of 143 rows (59/59 tech-edc, 56/56 wardrobe, 11/11 hygiene, 5/5
sports-gear, 10/12 homelab). Added by migration
`20260716182702_add_description_to_inventory_items` and effectively never
populated. Either the add-dialog never collects it or the field isn't wanted.
Decide before it gets carried into the new collection config — it is a free
deletion if unwanted.

**S-10 — `anon` holds write privileges on every table, including all 19 finance tables.** — *PARTIALLY RESOLVED, migration `20260905160000` (content, watchlist and travel tables only; the 19 finance tables are left for Phase 7)*

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

**H-6 — README advertises a `kitchen` inventory category that doesn't exist.** — *RESOLVED: the category exists in `src/collections/inventory.tsx` (empty, but real).*

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

Finance stops being a page and becomes the site's one non-collection feature:
a multi-profile financial decision engine. This section is the whole plan.

Source material: the `finance-platform-codex-starter` doc bundle (8,452 lines
of spec, no code). It was written against this repository — its §77 names the
17-parallel-query mount and its §78 names the delete-and-reinsert persistence,
both of which are real. Where that bundle and this plan disagree, this plan
wins, and the disagreements are recorded under "Deviations from the spec".

#### 7.A What this changes

The feature list barely moves. Ten tabs already exist — Dashboard,
Transactions, Goals, Cash Flow, Budget, Recurrings, Accounts, Investments,
Tax & Income, Time Spent — and they cover most of the spec's own "private MVP"
list. What changes is the shape underneath:

| | Today | After Phase 7 |
|---|---|---|
| Source of truth | 18 `localStorage` keys seeded into React state | Postgres, one query layer |
| Persistence | delete-all-then-reinsert, 37 call sites | targeted mutations |
| Load | 17 parallel `select('*')` on mount | per-view domain queries |
| Subject | implicitly one person | explicit profiles |
| History | none — current state only | snapshots |
| Calculation | inline in a 12,335-line component | pure, tested `lib/finance/` |
| Question it answers | "what did I spend?" | "what happens if I do X?" |

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

- **`localStorage` stops working.** `finance_settings` means nothing once there
  are three profiles; it would need `finance_settings:${profileId}`. Rather than
  namespace a pattern we want dead, profiles are the forcing function that
  retires all 18 seed/write pairs. Postgres becomes the only source of truth,
  and `localStorage` keeps only view preference (active tab, active profile).
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
- **Charts.** This is the one place a naive port would introduce colour. It
  does not: series are a monochrome ramp of `--foreground` at stepped opacity,
  with `--accent` reserved for the single highlighted series, and
  `--destructive` for negative values only. That is both faithful to "nothing
  new" and a close match for how Treasury actually looks.
- **Surfaces.** `ui/card.tsx`, `--shadow-card`, `--radius`. Nothing bespoke.

**Navigation — ten tabs become five surfaces.** Ten top-level tabs is the other
half of why the page feels like a different product; neither Copilot nor
Treasury runs anything like that many. Nothing is deleted — Budget stops being
a destination and becomes the frame around Spending, Time Spent becomes a lens
on Income.

| Surface | Absorbs | Hero number |
|---|---|---|
| **Home** | dashboard | safe-to-spend, with trajectory, alerts and the review count |
| **Spending** | transactions + review inbox + budget + recurrings | spent this period vs budget |
| **Plan** | cash flow + goals + scenarios (7.5) | projected balance at next payday |
| **Wealth** | accounts + investments + debts + credit + memberships | net worth |
| **Income** | tax & income + payroll + time spent | take-home this tax year |

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

Inside a surface, scrolling should stop at a card rather than run the length of
the page: a transaction list scrolls within its own card, inside the shell's
scrolling middle. This keeps a surface roughly one screen tall whatever the row
count, and makes the structure legible — a scroll bar tells you where one thing
ends and the next begins. `holiday-months-container` already works this way and
is the model. Which cards get their own scroll depends on which cards exist, so
that lands with the rest of the visual work rather than with the shell.

**Where the collection system does and does not fit.** `EntityCard`
(`CardVariant = 'media' | 'text'`) and `CollectionConfig` exist for walls of
entities. That fits Goals, Accounts, Memberships and Recurring bills, which are
genuinely lists of things and should be converted. It does **not** fit
dashboards, dense transaction tables or charts — forcing those through
`EntityCard` would bend the primitive out of shape. Finance therefore reuses
the *tokens and `ui/` primitives*, and adds a small `StatCard` built from
`ui/card.tsx` for metric tiles. That is the boundary.

**Why the current page does not look like this site.** Measured across
`features/finance/`:

| | Count |
|---|---|
| Arbitrary sub-12px sizes (`text-[10px]`, `[9px]`, `[8px]`, `[11px]`) | 468 |
| `text-xs` (12px) | 596 |
| `text-base` (16px, the site's body size) | 24 |
| Distinct hardcoded hex colours | 38 |
| `font-extrabold` (not on the site's two-weight scale) | 36 |
| Design-token references (so it is genuinely mixed, not wholly off-system) | 817 |

So 1,064 pieces of text sit at 12px or below against 24 at body size — body
copy effectively does not exist on this page — and the charts run the full
default Tailwind palette (`#10b981`, `#f59e0b`, `#ef4444`, `#3b82f6`, …) inside
a warm near-monochrome design system built on one accent.

That is the whole diagnosis. Finance is the one page that ignores the design
system, which is why it reads as a different product bolted to the side of the
site. The measured figure is higher than the 263 recorded in
`src/theme/README.md`; that note should be updated to 468 when this lands.

**What visibly changes, and what does not.** The visual *language* does not
change at all — same tokens, same two faces, same card chrome, same header and
footer. What changes is proportion and layout:

| Changes | Stays |
|---|---|
| Text gets substantially bigger; 1,064 instances rise to the scale | Every colour token in `src/index.css` |
| Charts drop 38 hex colours for the monochrome ramp + `--accent` | Space Mono body, Doto display |
| One hero number per view; cards gain air | `ui/card.tsx`, `--radius`, `--shadow-card` |
| 36 `font-extrabold` fall back to the two-weight scale | Header, Footer, shell, theme toggle |
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

#### 7.D Build order

| # | Step | Gate |
|---|---|---|
| 7.0 | Pure calc → `lib/finance/` with tests — **DONE** | none |
| 7.1 | `finance_profiles`, `profile_id` on 13 tables, transfer links — **DONE** | none |
| 7.1b | Thread `profile_id` through the existing write paths so the page keeps working before the decomposition — **DONE** | 7.1 |
| 7.2a | Routes and surfaces: ten tabs become five routed surfaces with a section nav — **DONE** | 7.1b |
| 7.2b | Lift the data state and the load/save into a provider, so surfaces can be separate components — **DONE** | 7.2a |
| 7.2c | Extract the six inline sections into `surfaces/*.tsx`; per-surface chunks — **DONE** | 7.2b |
| 7.2c-i | Move each dialog to the surface that opens it, and lift the page-computed totals — **DONE** | 7.2c |
| 7.2d | Per-surface queries, profile switcher, profile-filtered reads | 7.2c |
| 7.3 | Targeted mutations; retire 18 `localStorage` seeds | 7.1 |
| 7.4 | Snapshots — balance, net worth, per profile | none |
| 7.5 | Scenario engine — "what happens if I do X?" | 7.0 |
| 7.6 | AI tool layer: typed tools over 7.0 + 7.5 | Edge Function + API key |
| 7.7 | **Private bucket** + document pipeline (payslips, statements, receipts, credit PDFs) | bucket fix first |
| 7.8 | Reconciliation engine — evidence, provenance, match scoring | 7.7 |
| 7.9 | pgvector + hybrid retrieval | corpus from 7.7 |
| 7.10 | Credit: full model + PDF ingestion now; API adapter when contracted | see below |
| 7.11 | Monthly review / "what changed" / anomalies | 7.4 |
| 7.12 | Alerts and notifications | none |
| 7.13 | Cross-profile: contacts, shared expenses, settlements | 7.1 |
| 7.14 | Investments deepening, property, retirement projection | none |

Two notes on the ordering. **7.4 gates more than it looks** — without snapshots
there is no history, and "what changed this month", anomaly detection and
trajectory are not merely unbuilt but unbuildable. **7.7 is the cliff**:
everything above it is a bounded refactor of code that already exists, while
document extraction and reconciliation is where scope becomes genuinely
open-ended.

7.0 first is not arbitrary. Pure functions know nothing about profiles, so the
extraction is unaffected by everything below it — and doing 7.1 before 7.2
means the queries get rewritten once rather than twice.

#### 7.E Security — the `documents` bucket is public

Blocking prerequisite for 7.7. The existing bucket is world-readable:

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
  entity_type text NOT NULL,   -- transaction | document_chunk | goal | note
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

#### 7.H Deviations from the spec bundle

Recorded so the disagreements are deliberate rather than forgotten.

- **Households become profiles.** 7.B. Roughly 80% of the value at ~5% of the
  cost, with the upgrade path preserved.
- **"Thin client, calculations on the backend" is not adopted literally — but
  it is not architected against either.** There is no application server today
  (see 7.J). Determinism is achieved by isolating pure functions in
  `lib/finance/`, which is deliberately a *location-independent* boundary
  rather than a browser one: the same modules run in the browser now and in a
  Node or Deno process later, unchanged. Postgres functions and Edge Functions
  carry the work that must be server-side regardless.
- **Marketplace (§95), monetisation architecture (§97), pricing tiers
  (§31–32) and 10k-MAU cost modelling are out of scope.** They are business
  planning, not application features, and belong in Phase 8 if ever.
- **The bundle's own document defects are not inherited.** Its `ROADMAP.md` has
  two conflicting Phase 6 sections and its `PRODUCT_SPEC.md` restarts its
  numbering twice; the ordering in 7.D supersedes both.

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

#### 7.J Done means

- `npm run lint` — 0 errors, 0 warnings; `npm run typecheck`; `npm run build`
- `lib/finance/` is pure, imports no React and no Supabase, and is covered by tests
- `FinancePage.tsx` no longer exists as a single file
- Finance is five routed surfaces, not ten tabs of `localStorage` state
- No hardcoded hex colour remains in `features/finance/`
- No `localStorage` key holds financial truth
- Every non-template `finance_*` row carries a `profile_id`, enforced by CHECK
- Zero sub-12px font sizes and zero off-scale weights in `features/finance/`
- No `select('*')` on the finance mount path
- Finance renders inside `AppShell`, and no surface scrolls the document
- `anon` holds no write grant on any finance table
- No financial document is readable without `is_admin()`

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
