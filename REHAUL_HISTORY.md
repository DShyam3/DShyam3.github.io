# Rehaul — history

The finished half of `REHAUL_PLAN.md`, split out on 2026-09-07 so the plan
could be about what is left rather than about what was found.

Nothing here is a live instruction. It is the audit as it stood on 2026-09-04,
the record of phases 0-6, and — added on 2026-09-12 as Part 4 — every Phase 7
decision that has since closed. All of it is kept because the reasoning behind
a closed finding is still worth reading, and because deleting it would make the
plan look as though it had always been that short. Decisions that still bind
stayed in the plan; this is what does not.

| Part | What |
|---|---|
| 1 | Supabase audit — security, performance, schema hygiene |
| 2 | Frontend audit — the duplication that started this |
| 3 | The phased plan, phases 0-6 |
| 4 | Phase 7, closed — the decisions that landed and no longer need a plan line |

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
| 7.2d | Profile switcher and profile-filtered reads — **DONE** | 7.2c |
| 7.2e | Per-surface queries | **measured, not built** — see below |
| 7.3a | Targeted mutations: upsert-then-prune instead of delete-then-insert — **DONE** | 7.2d |
| 7.3b | Retire the remaining `localStorage` seeds — **DONE** | 7.3a |
| 7.4 | Snapshots — balance, net worth, per profile — **DONE** | none |
| 7.5 | Scenario engine — "what happens if I do X?" — **DONE** | 7.0 |
| 7.6 | AI tool layer: typed tools over 7.0 + 7.5 — **tools and context done; assistant needs the key** | Edge Function + API key |
| 7.7 | **Private bucket — DONE** + document *storage*, field capture and a native payslip view. Extraction is manual, then templates, then self-hosted OCR (7.P) | none — no key needed |
| 7.8 | Reconciliation engine — evidence, provenance, match scoring | 7.7 capture (not extraction) |
| 7.9 | pgvector + hybrid retrieval | corpus from 7.7 |
| 7.10 | Credit: full model + PDF ingestion now; API adapter when contracted | see below |
| 7.11 | Monthly review / "what changed" / anomalies | 7.4 |
| 7.12 | Alerts and notifications — **in-app alerts done; delivery deferred, see below** | none |
| 7.13 | Cross-profile transfers — **DONE**; contacts and settlements deferred | 7.1 |
| 7.14 | Investments deepening, property, retirement projection — **retirement done** | none |

Two notes on the ordering. **7.4 gates more than it looks** — without snapshots
there is no history, and "what changed this month", anomaly detection and
trajectory are not merely unbuilt but unbuildable. **7.7 is the cliff**:
everything above it is a bounded refactor of code that already exists, while
document extraction and reconciliation is where scope becomes genuinely
open-ended.

7.0 first is not arbitrary. Pure functions know nothing about profiles, so the
extraction is unaffected by everything below it — and doing 7.1 before 7.2
means the queries get rewritten once rather than twice.


#### 7.E-pre00 What the ship-check says, and the one finding that is wrong

`npm run ship-check` after the phase: **99/100, security 100/100, zero
blockers.**

Its one HIGH is a false positive worth writing down so it is not re-diagnosed
every time. It reports "potential N+1 queries" in `FinanceDataContext.tsx`,
matching on a `.map(` near an `await supabase`. Every one of those is the
opposite of an N+1 — a single batched upsert whose *argument* is built by
mapping the list:

```ts
await supabase.from('finance_transactions').upsert(txList.map(t => ({ ... })));
```

One query for the whole list, not one per row. Checked directly: no awaited
query sits inside a loop body in `FinanceDataContext.tsx`, `useTrueLayer.ts` or
`truelayer-sync`.

Its MEDIUM about oversized files still names `FinancePage.tsx`, now 2,400 lines
rather than 12,335. The remaining bulk is dialogs, which move to their surfaces
if that number ever needs to come down further.


#### 7.E-pre0 Perceived speed is not the same as speed

Measured on a clean mount, the eighteen queries all start within 16 ms of each
other and the whole batch is done in 261 ms. (A dev measurement of 1,321 ms was
two StrictMode mounts and the gap between them.) The floor is one round trip to
eu-west-2, median 133 ms, so the theoretical best is around 150 ms: collapsing
eighteen queries into one RPC would save roughly 110 ms.

That is not what the page felt like, and 110 ms is not why. Removing the
localStorage cache in 7.3b meant state starts at its defaults, and nothing gated
rendering on the fetch — so every figure painted **£0.00** for the length of the
mount and then snapped to the real value. A hero reading £0.00 and jumping to
£38,502.05 reads as the page being *wrong* before it is slow, which costs far
more than the 110 ms an RPC would buy back.

So the fix is a first-load flag rather than a faster query. `loadingDb` cannot
serve: it is false before the fetch starts as well as after it ends. `hasLoaded`
is false until the first fetch returns, and the heroes render skeletons sized to
the figures they replace, so nothing shifts when the numbers arrive.

The RPC is still available if the round trip ever matters. It does not yet.


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


---

## Part 4 — Phase 7, closed

Moved out of `REHAUL_PLAN.md` on 12 September 2026, when the plan was cut back
to what is actually left. Everything below is settled: the decision was taken,
the work landed, and nothing in it is waiting on anyone. It is kept because the
*reasoning* is the expensive half — deleting a finished plan line loses why the
thing is shaped the way it is, and that question outlives the task.

The rules these produced live in `AGENTS.md`. What the built thing does lives
in `FEATURES.md`. This is the record of how both got that way.

### The executive summary, as it read

The site works and the design system is genuinely good. The problems are structural, not functional:

- **Frontend**: three competing implementations of the same "list of cards" idea. ~1,200 lines of near-duplicate component code, 7 near-identical hooks, 450 lines of dead code, and a 12,237-line Finance page. *(That page is 2,442 lines as of 2026-09-07 — see 7.J for what remains.)*
- **Backend**: RLS is correctly conceived but has one live gap (storage), a hardcoded admin email, no query discipline (`select('*')` everywhere, no pagination), and a migration history that has drifted from the files in the repo.

Nothing here is on fire except item S-1 below. Everything else is accumulated drift.

#### The test everything is measured against

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
| 7 | Finance rehaul | multi-profile decision engine | **every condition in 7.J met**; what is still unbuilt is in `REHAUL_PLAN.md` Part 2 |
| — | `features/` reorg | **reinstated** — measured against findability rather than line count, co-location is the point | **done** |

The last row is worth keeping visible as a record of a reversal. It was
originally Phase 6, then dropped on the grounds that it "relocates files
without reducing them" — true, but that judged it by line count. Judged by
"can I find things", co-location is the whole point, so it was reinstated and
done as part of Phase 5.

---

---


---

### Schema organisation

#### One schema file per collection (yes)

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

#### Splitting inventory into per-category tables (no)

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

`finance_tax_configs` used to hold one current row: income tax bands, NI bands,
student-loan thresholds and rates. Updating it for a new Budget would not *add*
the new bands, it would *replace* the old ones — so last year's take-home could
be recomputed with this year's numbers the moment the configuration was saved.

That is a schema gap, not a news problem.

| Option | Verdict |
|---|---|
| Edit the bands by hand each April (today) | Correct going forward, wrong for every past figure |
| Store bands per effective date, pick by the date being computed | **Do this** |
| Scrape gov.uk / HMRC for band changes | No. There is no stable API for this; the rates live in Budget documents and HTML tables that are restructured yearly. A scraper here fails silently and produces wrong money |

**Implemented:** an `effective_from date` column rather than a `tax_year`
string (migration `20260910061010_tax_config_effective_from.sql`).
Bands mostly change at the April boundary, but not always — the NI rate moved
twice inside 2022/23 — so a year label cannot express the real history.
Selection becomes: take the most recent band set whose `effective_from` is on
or before the date of the figure being computed. `calculateFinance` now takes
that date explicitly and refuses to apply a future configuration when history
is missing.

The existing default and custom rate sets are both seeded from 6 April 2026;
earlier years get added as and when a historical figure actually needs them.
No point inventing history nobody reads. The settings dialog exposes the date:
saving a different date creates a new version, while correcting an existing
date remains an explicit edit to that historical rate set.

**Tax news is a separate feature and should stay separate.** A change in the
additional-rate threshold is *data* and belongs above. "The Chancellor has
announced X and it affects you because Y" is *content*, needs a source and a
model to summarise it, and therefore lands with 7.7–7.10 behind the same API
key. Conflating them produces a scraper that pretends to be a ledger.



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

**The prior pagination finding was wrong for this integration.** The Data API
v1 account/card transaction endpoints accept inclusive `from` and `to` dates
and document no page or cursor token; they promise the settled transactions in
that range. The earlier audit conflated this product with TrueLayer merchant
accounts and the newer, separately-authorised Data API v3 connected-accounts
flow. `truelayer-sync` now sends the documented date-only range rather than ISO
timestamps, which also removes a likely cause of provider-specific historical
HTTP 400 responses.

True cursor pagination is possible only as part of an intentional move to the
v3 connected-accounts product: it uses client-credential requests and a
different connection lifecycle. That is an integration migration, not a safe
query-string addition to the current OAuth v1 connection.

The principle that follows: Open Banking gives a limited window and consent
lapses, so the local database has to be authoritative. Bank-sourced rows are
upserted and never pruned.

| Step | Work | Gated on |
|---|---|---|
| A | Scope deletes by profile, carry each row's own `profile_id`, upsert transactions instead of delete-then-insert | deploy only |
| B | Provider identity, `consent_expires_at`, `last_synced_at`, `UNIQUE(profile_id, provider_id)`; connect inserts rather than replaces; sync loops connections | **DONE** (migration `20260908180000_truelayer_multiple_connections.sql` + edge function v19) |
| C | Backfill history in date windows, resumable via `backfilled_from` because an edge function will time out before a multi-year walk finishes | **DONE** (Data API v1 has no in-window cursor; requests use its documented inclusive date range) |
| D | Daily `pg_cron` sync, as `watchlist-daily-sync` already does; surface consent expiry before it lapses | **DONE** (migration `20260908200000_truelayer_cron_sync.sql`; deployed job verified active and completing daily) |

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

`typecheck:functions` now runs in both CI and the production workflow, so an
Edge Function type error is caught before merge rather than by chance.




#### 7.O What landed in Phase 7

The status board as it read on 10 September 2026, kept as the record of what
was built and in what order.

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

**7.M step D scheduled TrueLayer sync — done.** `truelayer-daily-sync` invokes
the protected Edge Function at 05:00 UTC using a service-role secret read from
Supabase Vault at execution time. The job and its HTTP request both completed
successfully on 2026-09-10; the function refreshes balances, transaction
history and daily snapshots without requiring the browser to be open. Individual
provider failures remain visible in the normal sync result, rather than making
the other connected banks stale.

**7.K effective-dated tax configurations — done.** Rate sets are now versioned
by their first applicable date, with one version per date for each default or
override timeline. Calculations accept an explicit date and select the latest
applicable set, so they cannot accidentally turn a historical calculation into
a calculation using a future Budget. The settings UI makes that date visible
when adding the next rate set.

**Statement import, 7.8 payslip reconciliation, and the standing summary — done.**

- `statement-import.ts` parses CSV, OFX and QFX locally, preserves the
  ledger's sign convention and provides stable per-account identities, giving
  history older than an Open Banking provider returns.
- `finance_payslip_transaction_reconciliations` stores only user-confirmed,
  one-to-one payslip-to-transaction links. Composite foreign keys make a
  cross-profile link impossible; matching is pure, penny-exact and limited to
  a five-day window.
- `change-summary.ts` compares like-for-like calendar month-to-date windows
  over ledger rows. Home renders its actual received, spent, net and biggest
  category movement; there is no generated or model-derived arithmetic.

**7.10 credit-report evidence — done.** Manual score capture can now archive
its source report beside the score in the existing private finance bucket.
Every archive is file-signature checked, never exposed through a public URL,
and displayed only through a short-lived signed URL. No report contents are
sent to a model or treated as data until the user explicitly captures a score.

**Investment holdings and local import — done.** The Investments screen is no
longer populated by demo rows. Current positions are saved as profile-scoped,
RLS-protected records in `finance_investment_holdings` (migration
`20260910074712_finance_investment_holdings.sql`), with an optional link to an
existing Investment account such as a broker or exchange. A composite foreign
key makes a cross-profile account link impossible; its covering index lives in
`20260910122724_investment_holding_account_index.sql`. An investment account's
balance is deliberately described as uninvested cash, so its positions and
cash cannot be counted twice.

The CSV review flow reads Trading 212 activity/holdings and Kraken
Trades/Balances exports locally. It saves only selected, normalised current
positions and buy/sell history (`20260910124547_investment_activity_history.sql`);
the original CSV is discarded when the dialog closes and no broker credential
or raw export reaches Supabase. The importer never invents a price: a missing
or non-GBP cost/valuation stays explicitly unknown (`cost_basis_known` /
`current_price_known`, migration `20260910123738_investment_holding_price_facts.sql`)
and is excluded from value/return figures until the user reviews it. Overlapping
export periods are idempotent through a per-account provider reference.


#### 7.J Done means

Checked against the tree on 2026-09-07 (evening) rather than left as an
aspiration, because a list of conditions nobody measures is not a definition
of done.

| Condition | State |
|---|---|
| `npm run lint` 0/0, `typecheck`, `build` | met — and 379 tests |
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

## Part 5 — Verification and defects, 2026-09-12

**Browser smoke test — closed.** The smoke test listed in `STATE.md` was executed
end-to-end against the local Supabase stack on the Demo profile. All four steps
ran; two defects surfaced, below.

1. Home dashboard figures hand-checked against UK tax stack: £6,226 income tax,
   £2,674.40 NI, £1,577.70 Plan 2 student loan, £2,300 pension, take-home
   £33,221.90/yr = £2,768.49/mo. Payslip add/detail dialogs and bank-payment
   confirmation exercised.
2. CSV/OFX import on credit card: 3 rows imported with sign convention correctly
   inverted. Re-import showed "3 duplicates unticked · already in ledger" and
   added nothing.
3. Investments: holding created linked to an account, reloaded, edited, removed.
   Portfolio total equalled that account's cash plus its positions exactly
   (£16,800 = £14,300 cash + £2,500 position).
4. Re-import of Trading 212 CSV: holdings stayed at 1 (25 shares) and activity
   rows stayed at 3. No duplication occurred.

This closes the item "logic that has not been seen is not fully verified" for
the four paths above, and no further. The review-queue keyboard loop was
attempted and is **inconclusive** — the rows carry no `aria-selected`, so
automation cannot read the selection. The budget add-item dialog, the goal
picker, and the sizes and radii the design pass touched were not opened at all.
Nothing here licenses the claim that the section has no layout regressions.

**Defect: composite onConflict index — FIXED, 2026-09-12.**

`src/features/finance/FinanceDataContext.tsx` line ~736 upserted payslip
bank-payment reconciliations with `onConflict: 'payslip_id'`, but migration
`20260910054857_payslip_reconciliation_fk_indexes.sql` had replaced that
single-column unique index with a profile-scoped composite
`(profile_id, payslip_id)`. Every confirm failed with Postgres `42P10` — *there
is no unique or exclusion constraint matching the ON CONFLICT specification*,
which is a reference error, not a duplicate key. Changed to
`onConflict: 'profile_id,payslip_id'`. This was a live bug, not local-only.

The lesson generalises: a migration that replaces a unique index silently breaks
any client upsert naming the old one. Nothing catches it — the conflict target
is a string, the generated types in `src/integrations/supabase/types.ts` carry
constraint names but nothing forces the upsert to agree with them, and the
failure is a runtime 400 behind a toast rather than a build error. Two things
would have caught this one earlier: grepping `onConflict` whenever a migration
touches a unique index (this file had exactly one upsert not on `id`), and
exercising the path in a browser, which is how it was in fact found.

**Seed data defect: student loan rate — FIXED, 2026-09-12.**

`supabase/seed.sql` seeded `student_loan_rates` at `9` (a percent) where
`src/features/finance/finance-calcs.ts` multiplies the rate as a fraction.
Deducting £157,770/yr rendered monthly take-home as −£10,247.53. Changed to
`0.09` and `0.06`. Local seed only — the code contract (fractions) is confirmed
by the test fixture in `src/features/finance/finance-breakdown.test.ts`.

**Favourite categories: derived from stored facts, not frozen at write time —
2026-09-12.**

The favourites grid grouped by a `category` string written once, on insert,
from a ternary over TMDB's `original_language`. Two things were wrong with it,
and only one was the visible bug.

The visible one: `ko` fell through to `Others`, so every Korean title sat in
the catch-all, and `ja` mapped straight to `Anime`, which is wrong for every
Japanese live-action drama ever added. The fix for that alone is a one-line
`case`, and it was the wrong fix.

The real one: a value derived at write time cannot improve when the rule does.
Adding a `case 'ko'` would have corrected the next Korean title added and left
every existing row where it was, because nothing recomputes a string that was
already stored. The same argument that keeps arithmetic in the codebase rather
than in a model applies to a grouping: if it is derivable, derive it, and store
what it derives from.

So `favourites` gained `original_language`, `origin_country` and `genre_ids`
(migration `20260912120000`), and `src/features/watchlist/favourite-category.ts`
derives the bucket on read. `Anime` now requires the Animation genre *and*
Japan, which is what separates an anime from a Japanese live-action drama —
a distinction the language-only mapping could not make at all.

What TMDB does not provide is the buckets themselves. It has no "K-Drama",
"Bollywood" or "Anime" genre; those are this project's editorial choice and
always were. What changed is that the choice is now a tested rule over stored
facts rather than a ternary over one field, which is why `Bollywood` can mean
Hindi-language rather than Indian-origin and say so.

The derivation returns **null** rather than `Others` when the facts are too
thin to decide, and the caller falls back to the row's stored string. This is
the load-bearing part and it took a review to get right. `original_language`
is the only fact that can produce `Hollywood` or `Bollywood`, so a row
carrying country and genre but no language must not derive a confident
`Others` — it would overrule a stored `Hollywood` that was correct. `Others`
therefore means "a known language matching no bucket", never "some facts, no
match". Absent that distinction the migration would have silently reclassified
rows it had no basis to touch.

The same distinction decides when a row is finished syncing: the backfill
writes `[]`, not null, for an array TMDB had nothing for. Null means never
fetched. Without that there is no value the sync can write to mark such a row
done, so it would be re-fetched on every run forever and, since the list keeps
query order, permanently occupy the head of the capped batch and starve every
row behind it.

**Transfer detection: propose and confirm, never auto-apply — 2026-09-12.**

Internal transfers — money moving between the owner's own accounts — are detected
by matching amount and date across pairs of transactions. A likely transfer is
proposed in Transactions for the owner to confirm or reject. Confirmed transfers
are stored in `finance_transfer_links`; the joined pair is excluded from Cash
Flow aggregates (income and spending categories).

The decision against auto-apply: an amount and a date agreeing is not proof.
Silently reclassifying real income or expense that happens to match a transfer
pattern is worse than the double-count bug it fixes. A person must choose, and
the UI makes it one click.

The decision to exclude only at aggregates, not the ledger: the rows stay in
`finance_transactions` unchanged. The provider's classification is unchanged.
Reverting a confirmation is undo (delete the link), not a reconciliation. A
second report from a different angle — budget, dashboard — can still see the
rows if written later, which is why exclusion is this filter's job, not the
schema's.

The provider's classification has its own column, `finance_transactions.provider_category`,
which is never backfilled. It is not written yet either: `truelayer-sync` still
files TrueLayer's TRANSFER under 'Wants' and populates nothing, so the column
exists ahead of its writer. It is evidence — what the
bank told us the payment was — not a categorisation. A transaction's own category
(where the owner filed it, or the default) is separate and changeable. Keeping
evidence immutable prevents the question "did the provider or the user categorise
this?" from ever having an ambiguous answer.

**SSRF in redirect: first hop is not all hops — 2026-09-12.**

`supabase/functions/merchant-logo-cache/index.ts` fetches merchant logos from
URLs provided by the BRANDFETCH API. The function checked only the first URL
against an allowlist before following HTTP redirects; a redirect to an internal
IP would reach it anyway. Redirects are now followed with manual steps, and the
allowlist is re-checked on every hop, capped at three. An allowlist verified
once is not verified when the response points elsewhere.

### 8.A-C Watchlist News — three decisions closed

**The news page is the watchlist's front door, and the unit is the show, not the
episode — 2026-09-13.**

The first build of the watchlist home listed episodes, and a show that dropped
three in a week filled three rows with near-identical text. The insight was that
the unit of action is the show: one card per show, with a poster, a title, and a
sentence that folds the count and the latest episode into a clause. "3 new
episodes, latest S1E5 on 13 Sep" is more useful than three identical rows saying
when each one aired. More structurally, opening the watchlist should answer
"what do I watch now" before "what do I own", so the News view became the
default at `/watchlist` and the grid became a named sibling at `/watchlist/library`.

**Platform changes and status transitions are history, recorded by a trigger into
`watchlist_events` — 2026-09-13.**

The News page includes a Platform changes section (shows that moved between
streaming services). A show's `platform` column is a single value the sync
overwrites; a single column cannot carry a change, so detecting it in TypeScript
would mean duplicating the logic a second time in the sync function (per README
line 101: "The duplication is deliberate"). The solution is the same one that
puts the `watched_at` timestamp elsewhere: a trigger on `tv_shows` and `movies`
that records changes into `watchlist_events` as they happen. That table is 8.D's
change feed arriving early, with the watchlist as the first consumer.

Two facts make the trigger safe: a trigger runs once, at the exact moment the
change is committed, so `new.platform` is the value actually written. And every
row carries `occurred_at = now()` at commit time, which is fixed per transaction.
A later data migration (20260913) that needs to reconcile synced rows with the
trigger's recorded history can do so by comparing `created_at` on the trigger row
against the change in the source — because `created_at` on the watchlist tables is
also `now()` at insert time, and will not have changed since.

**When applied migrations are rewritten, reconcile with a data migration, not
by re-running the applied file — 2026-09-12.**

Schema versioning diverges when a migration file is edited after it has been
applied to production. `20260912090000_watchlist_created_at` added `created_at`
columns with a default and an explicit backfill. A later discovery showed the
backfill was wrong for what the timestamp represents: new columns added to an
existing table are backfilled by Postgres even when nullable and even when the
file says bare `ADD COLUMN` and adds the default in a second statement. The
result was that all 676 seasons and 7,896 episodes got stamped with the
migration's exact timestamp, making the news feed believe they all arrived on
the same day.

The fix was a second migration (`20260913090000_watchlist_created_at_unbackfill`)
that nulled that timestamp, instead of editing the first file after it was
applied. Editing would have looked safe — the second state is the desired one.
But `supabase migration list` would have shown no record of the change, the
applied hash on the server would not have matched the file hash on any later
deployment, and the next person opening the repo would find local schema and
remote schema disagreeing. Writing a new migration preserves the history of both
the mistake and its remedy, so the database and the repo agree on what happened.

**A season or episode is an announcement only if it appears more than an hour
after its show was first tracked — 2026-09-14.**

When a show is added to the watchlist, the TMDB sync inserts its entire back
catalogue in one batch, which the announcements feed reads as news. Two shows
added on 2026-09-13 read as 4 seasons and 54 episodes of "announcements" until
the feed's rule was changed; the sync itself was not. A show's first-seen time is
the earliest `created_at` among its seasons (`tv_shows` has no such column), and a
show with any season whose `created_at` is NULL predates tracking altogether. A
row counts only if it appears more than one hour after that first-seen time —
long enough to absorb one add or sync batch, short enough that a season TMDB
gains later is still news. Exactly one hour does not count.

**Finished means shows only, because films record no watched state.** The
`movies` table has no `watched` or `status` column, so "hide what I have
finished" is applied to TV alone: a season is finished when every episode
released so far is watched, and a show is caught up when its latest released
episode is. Films stay visible until a watched state is stored for them; no
heuristic stands in for one.

**A title appears once, in priority order Watch Next, Out Now, Updates.** The
same show was surfacing in all three at once. The exclusion sets are built from
the rows actually rendered, not re-derived. Platform and status changes are
exempt, because they are different news about the same title.

**One week/month switch, pointing both ways.** Upcoming and Updates share a
single page-level choice: this week covers today through seven days ahead for
Upcoming and today back to seven days ago for Updates, both ends inclusive, so
the same word means the same span in each direction. Out Now stays fixed at a
week, because it answers "what is new right now" rather than a range the
reader browses.

**Card walls on tablets size to width, not screen height — 2026-09-15.**

Before this, the shared `CardGrid` component sized cards on tablets (768–1279px)
the same way as desktops: fit-to-screen-height, so whole rows fill the viewport.
On an iPad mini in portrait (768×1024) this gave 115px cards with 5 columns; in
landscape (1024×768) it gave one row of ~210px cards. The width-only sizing rule
now applies to tablets as well as phones: cards are kept at 150–180px wide with
columns filling the available width. The same iPad in portrait now shows 4 columns
at 177px; in landscape, 6 columns at 156px. Laptops and desktops (1280px and wider)
keep fit-to-screen-height: 10 columns at 121px on a 1440×900 display. On a
tablet the whole-rows sum had no good answer in either orientation, so the fit
now starts at 1280px (`FIT_TO_SLICE` in CardGrid.tsx) — and only with a fine
pointer, because width cannot tell a big tablet from a laptop: an iPad Pro 13
on its side (1366px) fitted ten 115px cards across. A touch screen with no
mouse sizes on width at any width, the card growing with it up to 13rem.


**One width-driven layout contract, with explicit distance viewing — 2026-09-21.**

The tablet-only exception above is superseded: shared card grids now size by
available width on laptops and desktops too. Fitting whole rows to viewport
height made cards smaller on short windows and introduced different reading
sizes for otherwise similar devices. Stable base type, bounded content widths
and wrapping controls now carry one layout across brands and orientations.
Touch affordances follow pointer capability rather than a tablet-width guess.

TV mode is chosen in the menu and persisted, rather than inferred from pixel
resolution: a 4K desk monitor and a television viewed across a room need different
scales. The mode increases type and controls and adds spatial focus navigation.
This implementation is local; physical devices and actual TV remotes still need
validation.


**Keep show context beside episode browsing — 2026-09-21.**

Series details now give the episode rail its own scroll area, so browsing a long
season does not move the poster and show information out of view. Tablet layouts
stack the rail below that context; larger layouts place it alongside. Long show
information remains independently scrollable to avoid clipping. Episode names
are always visible, removing the extra reveal action. The earlier hidden-title
behavior is superseded.

**Weekly schedule and episode progression use the rows already in the tree — 2026-09-21.**

Scheduling continues to use the existing `weekly_schedule` day rows. When a
title is added from News, its release weekday is the sensible default while
the admin can still choose another weekly day. Episode progression is derived
deterministically from each episode's `release_date` and watched rows: the
next unwatched released episode is actionable, while future episodes remain
unreleased and unavailable until their release date.

**News scheduling supports weekly and one-off release dates — 2026-09-21.**

The schedule dialog offers an automatic weekly release-day mode and a one-off
calendar date. TV shows default to weekly on their release weekday; films
default to their specific release date. The `schedule_mode` and
`schedule_date` migration adds this distinction to the existing schedule rows.
The migration is prepared locally but has not been applied to the database.

#### 8.K Server-side watchlist sync and per-function spam protection — 2026-09-22

**The watchlist sync runs only server-side.** The browser kept its own copy of
the sync in `WatchlistContext.tsx`, deliberately duplicated with
`watchlist-cron-sync` because Deno cannot import from `src/`. The browser copy
called TMDB through `tmdb-proxy`, which allows 60 requests a minute per IP. A
full sync of the library (1,167 titles when this closed) makes one call per title
plus one per recent season, so a manual run failed most titles every time; the
nightly cron, calling TMDB directly, finished in about a minute. The Sync
buttons now call the function with the admin's session, and the browser copy
and its tests are deleted. That also retires the standing hazard of keeping two
copies of the rules in step.

**Limits are enforced by the function, not the button.** A disabled button
stops a double click, not a second tab, a reload or a script. Each function
that spends a third-party call refuses excess with 429 and `retry_after`, and
keeps its state in `rate_limits`, the service-role-only table `tmdb-proxy`
already counted in, so no schema was added. Scheduled service-role runs are
exempt.

**Sliding cooldowns for the syncs, fixed windows elsewhere.** `check_rate_limit`
counts per clock-aligned window. For a sync, "one per ten minutes" has to mean
ten minutes after the last run; a fixed window lets two runs through a second
apart across a boundary. `_shared/cooldown.ts` inserts one row per claim, then
looks for any other claim in the window: if there is one, it deletes its own
row and refuses. Two racing claims both refuse and retry shortly, so a race
costs a retry, never a second run. Per-minute caps (single-title resync, logo
cache) keep the fixed window, where boundary bursts do not matter.

### Phase 7.J — Wealth sections: Student Loan split from Debts (2026-09-23)

**7.J.1 — Student loans belong in their own section.** Income-contingent
repayment and write-off make "paid off %", "debt-free by" and DTI calculations
wrong for student loans when combined with mortgages, car finance and credit
cards. Phase 7 modelled repayment from a fixed interest and minimum payment;
student loans need a salary-linked calculation and a write-off date instead.
Finance › Wealth splits Debts from Student Loan, giving each a separate hero
number and projection, and allowing the dashboard and Plan surface to calculate
net worth and DTI correctly without student loans skewing them.

**7.J.2 — Projections draw from verified anchors only.** The earlier code
interpolated balances between statements using a geometric curve, which was
fiction wherever it was drawn. Phase 7.J stops drawing years before the first
verified balance, because there is no non-invented way to fill them. A debt's
projection runs from its latest known statement; a student loan's runs from the
latest SLC statement plus interest accrued since then, with payslip deductions
replacing modelled ones up to the latest payslip date.

**7.J.3 — Real student loans use actual payslip deductions where known.** The
projection could match the headline balance only if the interest and repayment
calculation came from one run. It does: the simulator runs the loan month by
month using actual student-loan line items from payslips where they exist, and
models the rest from salary and an assumed pay rise. Anywhere payslip data
ends, the model continues seamlessly, and the two halves cannot disagree.

**7.J.4 — Course end date is inferred, not stored.** Repayment begins the April
after the course ends, and write-off counts from that April. Storing the date
would need a migration and a new column. Instead, it is inferred from the
borrowing pattern: Aug–Dec draws ⇒ course ends 30 June next year; Jan–Jul
draws ⇒ 30 June same year. Keeps the schema stable and lets every loan's
inference stand as a testable rule in the code.

**7.J.5 — Published student loan rates are versioned rows, not code constants.**
`finance_student_loan_rates` is keyed by effective date, the same shape as
`finance_tax_configs`. A year's SLC rate update is one INSERT, not a code
release. The app falls back gracefully if the row is not yet applied (reads are
unoptimistic; rates assume sensible defaults until a table query returns the
actual rows). New rows may be added retroactively — the engine re-runs interest
calculations when a loan's balance is recorded with an earlier date than the
latest rate row.

**7.J.6 — Interest rate is derived, not entered.** The student loan shows which
published rate applies to its balance. Storing one is history; the engine
derives it. Changing SLC rates changes every loan's displayed rate without
edits, and the feature survives `finance_student_loan_rates` being empty while
deploying. A student loan's stored interest rate is used for the projection when
no published row covers it; a one-click save updates the stored rate when the
derivation changes.

**7.J.7 — Interest in an anchor month is pro-rated.** When a balance is recorded
on the 15th, the interest charge for that month runs from the 15th only, not
from the 1st. The engine calculates the number of days after the recorded date,
applies the daily rate to that period, and adds it to that month's interest.
This keeps interest accrual aligned to reality: if a balance is known on a
specific date, what happened before it is not the engine's business.

**7.J.8 — SLC's billing timing is modelled exactly — 2026-09-23.** The owner
reconciles the app against SLC's own statements, so the model must reflect SLC's
timing rather than accruing the full income-linked rate as it accrues: Plan 2
interest charges at the annual RPI rate during the tax year, and the income-linked
portion accrues monthly as a pending top-up, landing at a fixed lag after the tax
year ends (default 6 months, matching typical HMRC confirmation timing, editable
as the owner sees SLC's own landing dates). The headline figure shows what SLC
should display at the end of this month, plus the pending top-up and roughly when
it lands.

**7.J.9 — A tax year's income, not current salary, sets its Plan 2 rate.** Each
year's Plan 2 threshold is compared against the *prior* tax year's actual income
to set repayment *this* year. The engine derives annual income from payslips
(stored in full for complete past years, scaled for partial past years, this
year's pay so far plus current salary projected to year end for the current year)
and surfaces it under "Income by tax year" so reconciliation is legible.

**7.J.10 — Published rate history seeded from gov.uk announcements.** Rather
than hardcoding rates in code or requiring a migration for each SLC update, the
`finance_student_loan_rates` table captures each published change — one row per
effective date, with RPI, cap, Plan 2 threshold, Plan 2 full-rate income and
Bank Rate — sourced from gov.uk/guidance/how-interest-is-calculated-plan-2 and
cross-checked against the owner's statement. Rows are matched at month end so a
6 April threshold change applies from April. Historical rows seeded 6 April 2020
through 1 September 2026 (24 rows); new rates are added as SLC publishes them.
A published rates editor appears in the Student Loan assumptions panel, with
add/delete for rows and a notice when no row covers today — the yearly update
step that happens each April.

### Public UK edition — a public version leaves no personal data in the code (2026-09-24)

**Owner decision 2026-09-24: a public version would be UK-only; everything
specific to one person was removed from code.** The codebase now holds no
credentials, no personal bank details, no employer names in hard-coded lists,
no hand-kept provider names, and no analytics configuration. All of these shift
to either environment variables (VITE_ADMIN_EMAIL required for deploy), a single
site configuration file (`src/config/site.json`), or server-side allowlists in
Supabase secrets.

The reasons bind the implementation:

- **No hard-coded personal data, so a public fork reads as generic from day one.**
  A different owner changes only config files, not code. Employer logos come from
  their own experience/education rows; bank colours from TrueLayer (the provider
  already chosen). Default budget categories are UK-wide (Energy, Council Tax,
  etc.), not this owner's subscriptions. Payslip parser recognises 60+ line types
  instead of 3, and derives neither employer pension nor employer NI as the
  employee's. Analytics only appears when an id is set; the privacy notice says
  "None." otherwise.

- **Edge functions stay portable through centralised CORS and OAuth configuration.**
  SITE_ORIGIN as a Supabase function secret means a fork can move the live site
  later without editing code. TrueLayer OAuth and function CORS read it at
  request time via `supabase/functions/_shared/site-origins.ts` (13 Deno tests).
  Without SITE_ORIGIN set, production origins get no Access-Control-Allow-Origin
  (fail closed, never null).

- **Site identity lives in one file.** `src/config/site.json` holds name, title,
  tagline, role, description, location, URL, socials, CV filename and about
  fallbacks. Header, footer, opening sequence, home page, privacy notice,
  index.html meta tags (via a Vite plugin), OG-image and logo-fetch scripts all
  read it. A fork changes one file, not twenty.

**The parser never derives "other deductions" — 2026-09-24.** Payslip parsing
tried and reverted in the same session: gross − net − named deductions "confirmed"
by a stated Total Deductions. The reviewer showed the check reduces to gross −
net == total, which is true on almost any payslip, so an unlabelled student loan
("SLC Repayment") or pension ("LGPS") became "other" and the payslip then
reconciled, removing the only warning. An unreconciled payslip that asks a person
is the better failure. The parser now reads bare "NI", "Ees/EE NI", "Stud Loan",
"SL Plan N", "Total Pay", "Net Payable", and correctly distinguishes employer
NI in all its forms; it does not invent deductions (92 parser tests).


**Watching plans belong in News; display size is a reading preference — 2026-09-23.**

Your Week now places today's and planned days beside watchlist news, with a full
calendar available on expansion. This replaces the separate Schedule view and
keeps planning near the titles that prompt it. News and Library share poster
anatomy and scheduling controls instead of maintaining parallel card layouts.

Standard/Larger replaces TV mode. Resolution cannot establish viewing distance,
and the preference now changes reading size while keeping native keyboard
behavior; the custom spatial-navigation layer is removed. The fixed slim frame
and compact Library controls supersede the earlier scrolling-toolbar decision.

### 8.L Transfer detection — pairing, dismissal, and evidence (2026-09-24)

**Binding multiple profiles by amount, not by date window.** The initial plan
grouped likely transfers in a date window (same day or day before/after) and
paired the largest unmatched amounts. This could hide unconfirmed transfers that
sat unsquared for months. Instead, transfer detection now builds an index of
inflows keyed by amount in pence, so any two transactions matching that amount —
regardless of date — are proposed as a pair. The cost is roughly linear (one hash
lookup per outflow) while keeping the whole history in scope. Confirmed pairs are
removed from the pool before one-to-one assignment, so dismissing a link does not
prevent a transaction from pairing with another match.

**Dismissed transfers are stored, not filtered after the fact.** Initial design
proposed storing only confirmed links and deriving dismissals by exclusion: rows
that matched but were not linked. This forced every consumer to remember the
exclusion rule and apply it independently, a fragile pattern. Instead, dismissed
pairs live in their own `finance_transfer_dismissals` table alongside links,
scoped to `(profile_id, outflow, inflow)` — the pair itself, not the individual
transaction — with a `reason` column for notes. The table itself enforces the
uniqueness that matters: a dismissed pair cannot be re-proposed without undoing
the dismissal. RLS grants SELECT/INSERT/UPDATE/DELETE to `is_admin()` only;
dismissals are profile-scoped via foreign keys.

**A failed transfer-links read clears stale data and flags the figures.** When a
profile is switched, the cached links for the previous profile may belong to a
different set of accounts entirely. Stale links silently exclude amounts from
Cash Flow and spending, invisible to the reader until they notice the figures
changed. Now: a failed fetch clears the cache (no stale data), sets a flag
`transferLinksFailed`, and the Cash Flow header and Possible Transfers card
render a red alert line saying totals include money moved between own accounts
until links load. Stale exclusions are impossible; missing exclusions are visible.

### 8.M Bank sync history — logging proof and run visibility (2026-09-24)

**Sync proof is a row, not pg_cron's job_run_details.** The nightly bank sync
runs on a pg_cron schedule at 05:00 UTC, calling an HTTP endpoint that queues
the sync work. PostgreSQL's `pg_cron.job_run_details` records when the call was
queued, not when the work completed — a "succeeded" status means the HTTP
request succeeded, not that transactions arrived or balances synced. Without a
row written by the function itself, there is no way to detect a timeout, a crash,
or a queued-but-never-completed run. The new `finance_sync_log` table records
one row per sync run (triggered or manual), with status (success/partial/error),
banks synced, transaction counts, duration, and per-bank outcome. A night with
no row means the scheduled run was missed.

**Sync history is visible on the client.** A popover on the Transactions tab
toolbar and beside "Sync All Banks" in Wealth → Accounts shows run history
(Nightly / Manual / Missed), each bank's last sync and consent expiry within 14
days, the next nightly run time, and a manual sync trigger. A red dot on the
trigger marks the newest run or newest nightly run when it is not a success. The
frontend reads the history once on mount and clears the params; it does not poll.
The `formatRelativeTime` function, shared with Watchlist, renders relative times.

### 7.L Guidance alerts and credit limits (2026-09-24)

**Guidance reuses the alerts engine, not a separate module.** Statements like
"you are carrying £2,400 at 24.9% while £3,000 sits in a current account" are
arithmetic over rows already read (`lib/finance/credit.ts`, `lib/finance/debt.ts`).
The alerts engine (`src/lib/finance/alerts.ts`, phrased in `components/AlertList.tsx`,
shown in Home's alert list) is where decisions live as data: `costly_debt_beside_cash`
and `credit_utilisation_high` are typed alerts keyed by the data they need. One
derived, never-stored list. Same pure/deterministic stance as the ledger.

**10% APR is a named constant, not a Bank Rate comparison.** No account interest
rates (AER) are stored, and `finance_student_loan_rates.bank_rate_percent` is NULL
in every seeded row. The threshold sits well above Bank Rate's 2023 peak of 5.25%
and stands in for what cash earns. Storing AER would let the rule compare debt
against actual cash rates — left open for a future migration.

**Spare cash measured against the emergency-fund goal target, not all cash.**
With no target the rule is silent rather than treating all account balances as spare.
Credit unions and home-saver accounts (typical savings buckets) are left out because
they have no balance row; the current+savings account sum is the reachable spare cash.

**Student loans and mortgages excluded.** Income-contingent forgiveness carries
writeoff dates and caps that early repayment would foreclose — different question
than "this debt is costing interest I can afford to stop". APR-based guidance is
for debt where paying early is always right.

**Utilisation compares the rounded displayed percent.** The percent shown and the
reason it fired never disagree. Unknown limits are left out entirely (not treated as
zero), so a card's utilisation cannot be calculated when the limit is not known.

**Credit limit storage.** New nullable column `finance_bank_accounts.credit_limit`
(CHECK ≥ 0; migration `20260924130000`); field on add/edit account forms for credit cards.
Blank means unknown, not £0. Account view shows "Credit limit" or "Not known". TrueLayer
sync upserts rows in homogeneous batches (all with limit, all without limit) so the union
operation does not NULL a hand-entered limit on a row without one in the same batch.
Sync now writes the card's limit from TrueLayer's `credit_limit` when returned.

**Wording is figures only, never instruction.** FCA framing: alert list provides
information, not advice. "Debt at 10% APR / Spare cash £3,000 / Coverable £2,400 /
About one year's interest £240/yr" names facts. No recommendation, no redirect toward
a product.

### Footer optical spacing (2026-09-24)

The owner requested spacing that accounts for unequal side-label widths.
London and the clock therefore sit in the remaining flex space between the
copyright label and credit, giving equal blank gaps on either side rather
than centring on the page midpoint in an equal-column grid. The credit uses
two separate text spans, stacked at 768–1023px and in one row from 1024px;
the phone credit remains hidden.

### 8.H Finance transfer detection — extend and complete (2026-09-24)

**One hook owns "which rows count as spending/income":** `useSpendingLedger()`
filters confirmed transfers and supplies Home's month summary, Budget's spending
history and Cash Flow. Before, only Cash Flow excluded transfers, so the same
month showed two spending totals depending on the page — Home showed one figure,
Budget showed another. Transaction lists keep every row; the filter applies to
figures only.

**One-sided transfers use a separate verdict table, not nullable legs or a column
on transactions.** A one-sided transfer is a bank or name-identified row with no
matching payment in another tracked account. They are stored in `finance_transfer_single_legs`
as a separate decision table `(profile_id, transaction_id, verdict)`, where verdict
is `internal` (the owner's own account), `external` (real spending/income), or NULL
(undecided). This keeps `finance_transfer_links` strictly pairs, and confirmations
stay beside the ledger rather than splitting into separate storage. The same stance
as payslip reconciliations and dismissals: decisions live in a separate table, keyed
by the transaction itself.

**Only direct evidence proposes a one-sided transfer.** The bank's own `transfer`
label (written to `provider_category` by TrueLayer) or a transfer-like pattern in
the transaction name are the only signals. The "Savings" budget category does not
count — it says how the owner labelled spending, not where the money went. No silent
categorisation happens; every one-sided transfer waits for an owner verdict before
it affects figures.

**Bank transfers are filed as "Transfers", not the Wants fallback.** TrueLayer
returns `provider_category = "TRANSFER"` for rows the bank itself calls a transfer.
Instead of mapping this to `Wants` as before, the sync now files it as a row with
`category = "Transfers"` (a user-facing label, not a verdict). Transfer detection
still runs and proposes confirmation; the label is a signal from the bank, not a
final answer.

**The sync keeps an existing row's category.** Previous syncs re-mapped every row's
category from the bank's `provider_category` on every run. This meant a re-categorisation
made inside the 7-day overlap window that the next sync re-reads would be silently
overwritten. Now: on insert, `provider_category` maps to `category`; on update, the
category stays unchanged. Re-mapping happens only if the owner re-categorises by hand.

### 8.H Finance — Cash Flow rebuilt on tested ledger engine (2026-09-24)

**Cash Flow reports the ledger only.** It previously added every recurring bill due in a
month on top of spending, which double-counted any bill paid from a synced account.
To forecast spending including unpaid bills, Recurrings is the right surface. Cash Flow
shows what actually moved.

**No payroll invention.** A month without income rows showed an estimated salary from
tax settings. Removed: placeholder figures from the original template (`net2025 ||
8754.61` and raw literals) read as the owner's numbers, fake account digits ('3860'
and '8901'), and fixed hard-coded rows for 2025 and 2026. Year rows are now derived
from the chosen period.

**The Sankey reads the same months as the headline.** `summariseCashFlow` and
`cashFlowSankey` share `monthlyCashFlow`, so the two cannot disagree on income,
spending or period totals. recharts' Sankey with `iterations={0}` and `sort={false}`
is deterministic, already a dependency, and cheaper to deploy than `d3-sankey`.

**"Other" nodes always last; the hub names the larger side.** Recharts sizes nodes
per their flow, so a smaller source or sink always occupies less space. Naming the
hub for the major direction — "Spending" when outflows exceed inflows — ensures
it never labels a figure bigger than income as income. "From balances" uses hatching
(plus red) because the project's positive/destructive tokens fall below colour-blind
separation in dark mode (deutan ΔE 5.3), a problem per-chart tokens do not fix.

**Drawers list each year with its monthly average.** When a period spans 2024 and
2025, users see both years' totals and monthly figures separately, not a blended
average.

---

### Phase 8 — Transactions performance and sync

**Transactions list pages at 100 rows.** The owner's page with 1,000 transactions rendered 18,656 DOM nodes, and clicking the sync button triggered a 963ms long task before the popover opened. The restyle/relayout cost of adding the sync popover on top exceeded 1,000ms total. The popover itself opens in ~20ms, so the bottleneck is DOM size. Paging draws 100 rows at a time with "Show 100 more". The data set — rows matched by filters and search — stays unified so filters, select-all and the review queue see every transaction; only the rendered list is paged. The selected row is always drawn so keyboard navigation and deep links from Home remain unaffected.

**Sync bug: `annual_fee: 0` was written every run.** The original sync sent all columns including `annual_fee`, so a row synced from the bank arrived with `annual_fee: 0`. That overwrote the owner's manually entered value. The fix omits `annual_fee` from every synced row — Postgres defaults it to 0 on insert, and the upsert preserves the owner's value on update, the same reasoning as `credit_limit`. The owner then chose that the sync sets `name`, `emoji` and `color` only when it first creates an account. The first attempt omitted them for existing accounts, and the nightly run of 2026-09-25 failed on every account: an upsert is an INSERT first, and Postgres checks NOT NULL on the proposed row before it finds the conflict, so a row without `name` fails even when it exists. The fix sends each existing account's stored values back. Omitting a column is safe only where it is nullable or has a default (`annual_fee`, `credit_limit`); a NOT NULL column with no default must be on every row. `_shared/upsert-batches.ts` records the rule.


### Watchlist calendar — retain the weekday while caught up

**Finite episode plans keep the saved preference dormant — 2026-09-24.**
A weekly schedule is a preferred watching day, not permission to repeat a title
forever. The calendar projects remaining known episodes one per saved weekday,
respecting release dates, and hides the plan when there are none left. It keeps
the schedule row so a later announced season can resume on the chosen weekday;
catching up does not delete the owner's preference. Unknown dates remain TBC
instead of implying an indefinite release schedule. This is a local projection
over existing rows and needs no new migration.

### Layout containment — the middle card (2026-09-25)

**One vertical scroller per route, the middle card.** Nested vertical scroll is
allowed only for deliberate sibling panes (Travel's list, the Transactions
details, Updates at 1280px+, the holiday tracker at 1024px+) and temporary
overlays. Why: capped lists inside a scrolling page gave two scroll positions,
and heights guessed from `100vh - 22rem` broke whenever the chrome changed.

**Frame from 768px, frameless below.** Why: a frame on a phone doubles the
gutter.

**Toolbars live inside the card.** They pin only from 768px and at ≤25% of the
card's height; AppShell measures this with ResizeObserver and publishes
`data-toolbar-pin`, `--toolbar-h` and `--frame-h`. Why: CSS cannot read how
controls wrap. Inspiration's filters wrap to 291px (34% of the card) at 768×1024,
and a self-scrolling toolbar hides filters.

**Travel is a "workspace" only at ≥1024px wide and ≥600px tall.** Why: the shell
switched off scrolling from 768px while Travel stacked through 1023px, so content
was unreachable. Measured at 900×1000: main was 858px, content 1985px, overflow
hidden. The height floor stops a short laptop window pinning a map with no room
left for the list.

**Payday folded into the Tax & Income summary; the gross package stays in the
compensation card.** The figure is described as modelled, not as money received.

**LAYOUT_CONTAINMENT_PLAN.md folded into REHAUL_PLAN.md and deleted.** Why: the
project keeps six documents with one job each.
