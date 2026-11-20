# Site plan

Prepared 2026-11-09. A proposal, not yet the backlog. `REHAUL_PLAN.md` stays
authoritative until the parts of this you accept are folded into it; nothing
here is in `FEATURES.md` until it ships. It replaces
`google_implementation_redesign.md` and `gpt_implementation redesign.md` as the
forward plan, and it is built from three inputs: your Finance spec and notes,
`REHAUL_PLAN.md`, and what `FEATURES.md` says is in the tree today.

Status words used below: **Built** (in the tree, per `FEATURES.md`),
**Partly**, **Not built**, **Blocked** (needs something outside the code),
**Won't** (recommended against, with the reason). Where I did not confirm a
status in code, the row says so.

---

## 1. What the site is

**A hub about you, with two audiences.**

| Audience | What they get | Where |
|---|---|---|
| A visitor | Who you are, what you have done, what you use, read, watch, cook and think | Home, Projects, Travel, Inventory, Library, Thoughts |
| You | Tools that run your life from your own data | Finance first; then Health, trip planning, the assistant |

One rule decides most arguments: **a public page explains you to a stranger in
under a minute; a private page saves you a decision or a lookup.** A feature
that does neither is decoration.

The two halves share one thing that nothing off the shelf has: all your records
in one place. That is the long-term payoff (a purchase linked to an inventory
item, a trip linked to its spending and photos), and it is why links between
records are worth building properly, but only once there are real links to
store.

## 2. Where it stands today

**Strong**

- Finance is deep and trustworthy: about 2,400 tests, every figure computed
  from rows, bank sync for several banks, payslip and credit-report capture,
  debts, student loan, tax engine, Money Hub.
- Collections run on one system: nine lists from one config each.
- Watchlist is a finished product in its own right.
- Security posture is deliberate: RLS as the boundary, admin 2FA, documents
  parsed in the browser.

**Weak**

- **Home undersells you.** It is a CV and a biography. Sports, cooking,
  interior design, robots and the homelab are nowhere.
- **Finance looks plain.** Its Home does lead with "free to spend this
  month", but the rest reads as a wall of similar cards.
- **Finance is specific to you in places**: one tax year hard-coded, two broker
  CSV formats, dated student-loan defaults.
- **Phone layout wastes space**: header 139px and footer 154px on an 812px
  screen, by your measurement.
- **A long tail of unverified work.** `STATE.md` lists signed-in production
  checks never run, save/reload races, and a schema that cannot rebuild from
  empty. New work is stacking on unverified work.
- **Three plan documents and two redesign worktrees** compete. The redesign
  branch (`feat/redesign-phase0`) holds a usable shell, uncommitted beyond its
  checkpoint and unreviewed.
- **The assistant is written but not shipped**: it sits on
  `codex/assistant-integration-2026-11-02` waiting for an Edge Function deploy
  and a model key.

## 3. Rules that keep binding

From `REHAUL_PLAN.md` Part 1 and `AGENTS.md`; restated because several items in
your notes run into them.

1. **A model may choose, phrase and explain. It never computes.** "AI
   auto-categorisation" and "ML model to understand my spending" are bound by
   this: a model may *suggest* a category, the saved category is a row, and
   every total is arithmetic over rows.
2. **Nothing hard-depends on a model.** Everything except the chat box works
   with no key.
3. **The local store is the record; Open Banking is a window.** Bank rows are
   upserted, never pruned.
4. **Derive before fetch.** Before adding an API call, check the rows do not
   already answer it.
5. **Never invent a value.** Missing is shown as missing, never as zero, a
   default city or a guessed price.
6. **Information, not advice.** Recommending specific financial products is a
   regulated activity in the UK. The site states facts about your position.

One rule to add: **verify before you build on it.** A phase does not start
while the previous phase has unverified signed-in behaviour.

---

## 4. Finance spec, line by line

### Dashboard

| Spec item | Status | What is left |
|---|---|---|
| Spending left from the budget, per month | Built | "Free to spend this month" heads Finance Home: income minus recorded spending and unpaid bills, with a per-day figure. Seen on the local stack 2026-11-10. It is measured against income, not against the budget; decide whether you want the budget version too |
| Category run-down, budget vs spent | Partly | Home shows top categories; add budget against spent per category with a bar |
| Cash flow overview | Built | Month-to-date received, spent, net, biggest movement |
| Net worth graph over time | Partly | Net worth figure is on Home and daily snapshots are stored; put the history chart on Home |
| Goals in progress | Built | Home shows two; link to all |
| Upcoming subscription payments, next week | Built | Upcoming bills on Home |
| Upcoming payday | Built | Date and days left |

### Budget

| Spec item | Status | What is left |
|---|---|---|
| Category taxonomy (Savings, Food, Shopping, Housing, Insurance, Transport, Loans, Subscriptions) | Partly | Presets exist and are generic UK. Reshape them to your eight groups. Keep the long lists as *pickable* presets, never as defaults; see "the default adds too many things" |
| Rolling budgets | Not built | Specified in `REHAUL_PLAN.md` 8.H: derived from history, a flag and a start month per item. Two decisions open (does overspend carry; does it reset each tax year) |

### Accounts

| Spec item | Status | What is left |
|---|---|---|
| Open Banking balances | Built | Nightly at 05:00 UTC plus manual sync, limited to one per 15 minutes. Not literally real-time; see webhooks in section 5 |
| Checking, savings, credit cards | Built | |
| Membership cards | Built | Reward memberships section |
| Aspirational accounts ("Amex Gold, want Platinum") | Not built | Needs the hand-seeded `finance_card_products` table already described in the plan. Show the facts side by side; do not rank or recommend |

### Investments

| Spec item | Status | What is left |
|---|---|---|
| Investment accounts, stocks and shares, crypto, pension | Partly | Holdings and Trading 212 / Kraken import built. No prices, so no live value |
| CDs, bonds, property, company ownership, collectibles | Not built | One `finance_manual_assets` table: name, class, value, valued-on date, note. Valued by hand, dated, never estimated |
| Allocation by sector, company categorisation | Not built | Needs per-holding metadata nothing supplies today. Start with allocation by account and by asset class, which you can enter |
| Historical balance trend | Not built | Needs the dated price cache (`finance_prices`) from 8.H. Crypto has a free source; equities need a provider whose terms allow personal use, not yet chosen |

### Credit

| Spec item | Status | What is left |
|---|---|---|
| Scores from Experian, Equifax, TransUnion | Built (manual) | Entered by hand with the PDF archived. **Automated sync: Won't.** No bureau sells file access to an individual |
| Factors: payment history, utilisation, age, new credit, mix | Partly | Utilisation is computed. Age of accounts and credit mix are derivable from account rows; payment history and searches are only in the report, so capture them as fields at entry |
| Electoral roll, address history | Not built | Two fields on the report record, entered when you capture a report |

### Cash flow

| Spec item | Status | What is left |
|---|---|---|
| Net income, multiple sources | Partly | Totals are built from transactions. Tagging income by source is not |
| Income updates when income arrives | Partly | Payslip-to-bank reconciliation is built. A notification is not; see alert delivery, a deliberate non-build |
| Projected income vs spending | Partly | 60-day forecast covers pay and bills. Day-to-day spending is not modelled |
| Historical, last month and 12 months | Built | |
| Tax overview per tax year | Partly | Payslip tax-year totals built. The engine holds one tax year |
| Annual and monthly summaries | Built | |

### Goals

| Spec item | Status | What is left |
|---|---|---|
| Short, medium, long term | Not confirmed | Derive from target date; no new field needed |
| Emergency fund, auto-calculated target | Partly | A target is stored and alerts use it. Auto: essential monthly spend × chosen months, from the ledger |
| Common goal templates | Not built | A preset list, same pattern as budget presets |
| Scenario planning | Built | |

### Transactions

| Spec item | Status | What is left |
|---|---|---|
| All spending across accounts | Built | |
| Auto-categorisation, manual overrides | Built (rules) | Deterministic merchant rules with a review queue. Model suggestions: Blocked on a key, and bound by rule 1 |
| Tags and custom categories | Partly | Transactions already store `tags`. I did not confirm a tag editor or a tag filter in the UI; that is the part to build |
| Joint accounts, split finances | Partly | Profiles and transfers between profiles exist. Splitting one transaction is specified in 8.H and not built |

### Recurring payments

| Spec item | Status | What is left |
|---|---|---|
| Due dates and paid status | Built | Per-period paid state, calendar, four statuses |
| Paid so far vs left | Built | Scheduled total and amount still to pay |
| Company logos | Built | Server-side cache; people's names never sent |
| "Spotify went up £2" | Not built | Subscription audit in 8.H: compare the latest amount to the previous. Arithmetic over rows already held |
| Card annual fees | Partly | Annual fee is stored on the account. Surface it as a yearly recurring |

### Net worth

| Spec item | Status | What is left |
|---|---|---|
| Cash plus investments, loans deducted | Built | |
| Metals, watches, art, vehicles, property | Not built | The same manual-assets table as Investments |

---

## 5. Your improvement notes, triaged

### Do

| Note | Plan |
|---|---|
| Payslip should take any payslip; audit what could not ship publicly | The reader already works from shared UK label wording, not one layout. Run the audit as a written list: every constant, every employer-specific branch, every dated figure. Known already: `STUDENT_LOAN_DEFAULT_ASSUMPTIONS`, single tax year, two broker formats |
| Move tax defaults to the database | Agreed, and it settles an open decision in the plan: tax rules become **dated rows**, the engine reads the rule set for a date, and `finance_tax_configs` is either that table or is deleted. Keeps multi-year working without editing code each April |
| Refunds and card payments not syncing well with current accounts | Treat as a correctness bug, ahead of features. A card payment is a transfer between two of your accounts; a refund is negative spending in its original category. Both belong in `transfer-detection.ts` with test cases from your real rows |
| Net worth should not count card balances and current-account cash | Keep net worth as it is, because the standard definition is everything owned minus everything owed. **Add a second figure beside it**: long-term wealth, meaning savings, investments, pension and assets, less loans. That is the number you are describing |
| Auto-detect card, debit, current, savings | Built at import: the bank sync maps the bank's own account type. Check it against your accounts and say which ones it got wrong |
| Closed accounts stored, marked closed | A `closed_on` date. Closed accounts leave current totals and stay in history |
| Custom account names | Built; names you set survive syncs |
| Blur money toggle | Built; Finance opens with figures hidden |
| Wants, needs, savings without them being categories | Budget categories already carry a needs/wants/savings group. Show the split on the dashboard and Cash Flow |
| Emergency fund: months covered, how much more | With the auto target above |
| Link savings to goals | A goal names one or more accounts; its progress is their balance. Removes manual contribution entry for those goals |
| Automatic contribution tagging | Follows from the account link |
| Cash flow: colour-coded bars, hover run-down | Presentation over figures already computed |
| Net income = income − spend, shown against what reached savings | A reconciliation line; a gap means an uncategorised transfer |
| Month in review | The year-in-review engine from 8.D, run on a month |
| Recurring monthly check-up, "did not realise you pay for this" | Detection is built. Add the review prompt and the price-rise flag |
| Auto-tag transfers to friends and family from the reference | A rule type in the existing category rules |
| Default budget adds too many things | Start a new budget empty except rent, council tax, energy and food. Everything else is picked |
| Help to budget based on salary | Take-home is known. Show it against the budget total and the needs/wants/savings split. State the split; do not prescribe one |
| Get as much history as possible | Already the rule: deep fetch at connect and at each re-consent. Statement import reaches further back |
| UI refresh, more visual | Section 6 |
| Public demo page for Finance | A fixed synthetic profile rendered by the same components, no sign-in, clearly labelled as example data. A Demo profile already exists behind sign-in; the work is a read-only copy of it that needs no account, which is an RLS decision as much as a page |

### Needs a decision first

| Note | The question |
|---|---|
| Split costs with friends and family, known contacts | Deferred as 7.13. Stores other people's names, which the model allowlist forbids ever sending. Build only if you will actually settle up here rather than in a banking app |
| Market offers vs my cards, where to use each | Needs the card product table, filled by hand, and stays on the information side of the FCA line |
| TrueLayer webhooks, Apple-Pay-style notifications | Two separate things. Webhooks need checking against TrueLayer's current product; the plan records that true incremental sync means moving to their v3 connected-accounts product. Notifications need a service worker and a sent-log, a deliberate non-build today |
| Tax and income advice, alternative income | Information is fine (the tax calculator already shows cliffs and what clears them). Advice is not |
| Upcoming birthdays linked to a "second brain" | Needs a contacts store. Same privacy question as splits |
| "Why does it auto add everywhere?" | I cannot tell which behaviour this means. Tell me the screen and I will trace it |

### Won't, with the reason

| Note | Reason |
|---|---|
| Sync to Amazon to see what was bought | No API for personal order history. The alternatives are scraping with your Amazon password, or importing Amazon's order-history export by hand. The export is the only acceptable route |
| ML model to understand spending | Rules plus the merchant directory already categorise deterministically and are testable. A trained model on one person's ledger is small-data, unauditable, and breaks rule 1 if it ever produces a figure |
| Bureau API sync | No such access for individuals |
| Receipts to auto-tag line items | Not never, but last: OCR in the browser, a line-item table and transaction splitting must all exist first |

---

## 6. The site beyond Finance

### Shell, layout and phone

- **Land the workspace shell from `feat/redesign-phase0`** after a review:
  section rail, details docked beside the content instead of popups, and ⌘K
  search over sections and real records. The invented "semantic" records are
  already stripped out.
- **Phone header and footer to one row each.** Target under 56px each. This is
  the single most visible fix.
- **Finish the middle-card model.** It has landed for most routes; the open
  list is in `REHAUL_PLAN.md` (Transactions on small screens, Library, real
  devices).
- **App icon.** A real 180px touch icon and 192/512px manifest icons, so "Add
  to Home Screen" on iPhone and iPad gives a proper icon. Half a day.

### Typography

**Two faces: Space Mono and Doto.** Decided 2026-11-09. Both are already
self-hosted, so there is nothing to build. Space Mono carries identity, labels
and body; Doto carries big figures and display text.

The one cost is long reading: monospace body text is tiring past a few
paragraphs. It does not matter today because the site has little long text.
Revisit only if Thoughts grows into real essays, and then as a single body face
for that section rather than a site-wide change.

### Design details

Each is small and independent: transparent logo backgrounds chosen at upload
(never for photos or recipes); the box around logos such as Notion; an admin
notice when an image fails to load; date fields defaulting to today; the clock's
scramble-then-lock animation. Dot-matrix logos for every section are a nice
identity project and can run alongside anything.

### Paste a link, get the record

One mechanism for Links, Books, Inventory, clothing and Recipes: paste a URL,
the form fills itself, you review and save. This replaces four separate plan
items (link auto-metadata, book lookup by URL, inventory image from the buy
link, recipe import).

- **One admin-only Edge Function** fetches the page and returns what the page
  declares about itself: Open Graph tags (title, image, description, site) and
  `schema.org` JSON-LD (`Product` gives name, brand, image, price; `Book` gives
  author and ISBN; `Recipe` gives ingredients, steps and times).
- **Each collection maps that to its own fields** in its config file, so
  Inventory takes name, brand, image and price, while Books takes the ISBN and
  completes the rest from Open Library, as it does today.
- **Review before write, always.** The fetched values land in the form, not the
  table. A field the page did not declare stays empty; nothing is guessed.
- **The image is copied into your storage** on save, so a product page going
  away does not break the card. That also removes the "image suddenly not
  available" problem at its source.
- **Security is the main work.** A function that fetches a URL you give it is
  the classic SSRF hole: http and https only, resolve the host and refuse
  private and local addresses before fetching, cap size and time, refuse
  redirects to a refused address. Admin session required; rate limited.
- **Expect gaps.** Amazon and some large retailers block automated fetches or
  declare little. Those fall back to the fields you type. Clothing sites are
  usually good; Amazon usually is not.

### Public and private

Today everything is public except Finance and Beliefs. Add a per-collection and
per-record `visibility` so you choose what a stranger sees. It is a schema and
RLS change, so it goes through the `migration` agent and a review.

### Sections

| Section | Plan |
|---|---|
| Home / About | Rebuild around what a stranger wants in a minute: who you are, what you do now, and tiles for work, sports (padel, cricket, F1, running), cooking (links to Recipes), interior design, robots, investing. Avatar or Memoji as the portrait. Skip typing sounds: audio on load is blocked by browsers and unwelcome when it is not |
| Projects | Done, in progress, planned. Skills as logos. Currently folded into Home |
| Tools / Homelab | Inventory already has a homelab category. Add a short written page on the setup that links to those items |
| Travel | Trips first (cities grouped by date), as in 8.F. Then a Flighty CSV import for flight lines, and photo EXIF to draft an itinerary you edit before publishing |
| Inventory | Fetch the image from the product link on add; flag images that stop loading; purchase date, price and warranty; sports gear as categories. Outfit picker is a separate feature, later |
| Links, Recipes | Sub-categories as a second facet. "Upvotes" on a one-person site means your own rating; public voting needs anonymous writes and abuse handling, so not that. Recipe import from a URL, after the ingredient shape is decided (the one decision that expires) |
| Books | Magazines as a reading-status-free category |
| Thoughts | One writing section: essays, short thoughts and quotes, with Beliefs as a private category inside it. **Time Spent moves here as an interactive thought**: "what does this cost in hours of your life". The public version takes a salary the visitor types and runs the same tax engine in their browser; your own figures never appear in it. Signed in, it can start from your settings, hidden like the rest of Finance |
| Health | New and private: goals, plans, achievements. Manual entry first. Apple Health needs a native app, so not now |

### Assistant and search

1. **Search first.** ⌘K over real rows exists on the redesign branch for the
   nine collections. Extend it to Watchlist, Travel and Inventory.
2. **Then the assistant.** Port the existing branch, deploy the Edge Function,
   set one provider key. Finance tools already exist and are tested.
3. **Links between records** when there is something to link: an inventory
   item to its transaction, a trip to its spending. One hand-confirmed links
   table.
4. **Embeddings last**, and only if plain search measurably fails.

### Direction

| Idea | Recommendation |
|---|---|
| Offline, always-open version | Yes, as a read-only cache of the last data seen, with a "last updated" stamp, cleared on sign-out. Finance only if you accept your figures stored on the device |
| SQLite kept in sync with Supabase | Won't. Two-way sync means conflict resolution for every table, to solve a problem the cache above already solves. A one-way export to a SQLite file as a backup is cheap and worth having |
| Hosting | Move off GitHub Pages to a managed static host; see "Hosting, domain and closing the code" below. Running your own server is not needed |

---

### Hosting, domain and closing the code

You have a domain and want the code closed, hosted somewhere, not self-run.

**Recommendation: a managed static host that builds from a private repository**
(Cloudflare Pages, Netlify or Vercel; all three do this on a free tier, to be
confirmed when choosing). GitHub Pages can serve from a private repository only
on a paid plan, and it cannot set response headers on any plan.

What the move buys:

- **Closed source.** The repository goes private. Be clear what that hides:
  history, plans, migrations and the Edge Function source. It does not hide the
  client code or the Supabase publishable key, which every visitor's browser
  receives by design. RLS stays the boundary either way.
- **Real security headers.** CSP with `frame-ancestors`, HSTS,
  `X-Content-Type-Options` and `Permissions-Policy` become settable. Three of
  the four unmet items in `SECURITY.md` close.
- **Your domain** as the site's address.

What has to change with the address, in one go, because a missed one breaks
sign-in or bank linking:

| Thing | Where |
|---|---|
| Site URL | `src/config/site.json` (`url`), plus Open Graph image paths |
| Supabase Auth | Site URL and the redirect allowlist |
| `SITE_ORIGIN` secret and the function CORS allowlist | `supabase/functions/_shared/site-origins.ts` |
| TrueLayer redirect URI | Their console and the function's accepted origins. Bank linking fails until both match |
| CSP | Moves from the build-time `<meta>` to a header file |
| SPA fallback | A rewrite rule replaces the `404.html` copy |
| Old address | Keep `dshyam3.github.io` redirecting to the domain |

Before the repository goes private, note that it is **public today** and its
history already contains your admin email in two migrations and the project
reference in the docs. Going private stops new readers; it does not recall what
was already cloned or indexed. Nothing in there is a secret, so this is tidiness
rather than an incident.

### Sign-in

There is one user, so the question is how *you* sign in, not how users do.

| Idea | Recommendation |
|---|---|
| Passkeys, Face ID, Touch ID | Same thing on the web: a passkey is unlocked by the device's biometric. **The best fit**, since it is phishing-resistant and faster than password plus code. Depends on what Supabase Auth supports at the time; check before planning it |
| Google or Apple sign-in | Works, but makes that account the key to your finances, and needs admin rights tied to your user id, never to "whoever signs in". Apple also needs a paid developer account. Only worth it if passkeys are unavailable |
| Autofill strong passwords | Already works: the password field is marked for password managers and the code field for one-time codes |
| Remove auth, or put everything behind auth | Neither. Removing it removes Finance. Putting everything behind it removes the public hub. Per-record visibility (above) is the answer to "hide more" |

### Housekeeping, checked 2026-11-09

Your notes carry several leftover lists from other sessions. Checked against
the live project and this checkout:

| Item | State |
|---|---|
| Postgres upgrade | **Done.** Running 17.11; the security advisor raises no version warning |
| Public signup off | **Done.** The project reports signups disabled; email is the only provider |
| TOTP MFA | Enabled on the project. Whether *your* authenticator is enrolled I cannot see; check `/auth` when signed in |
| Leaked-password protection | **Still off.** Authentication → Passwords in the dashboard. It may need a paid plan |
| Self-hosted fonts | **Shipped** (`eaf8aecd`). The "other session has uncommitted fonts" note is out of date |
| `codex/student-loan-draw-guard` | Already deleted; no such branch |
| `is_admin()` callable by anyone | Still flagged by the advisor; accepted on purpose and recorded in the plan |
| Worktrees | Three besides `main`: `feat/redesign-phase0` (live work), `codex/redesign-phase-0` (wireframes only, superseded) and `claude/affectionate-lamarr-f2d2cb`. Two of them are in `/tmp` |
| Uncommitted in `main` | Nine finance component files, `STATE.md` and `REHAUL_HISTORY.md` from another session, still unreviewed |

Still genuinely open, and already in `REHAUL_PLAN.md` or `STATE.md`:
save/reload races, the schema rebuild from empty, the Node 24 CI move, the
signed-in and physical-device checks, a real HEIC upload, and four decisions
(merchant-logo key guessability, the cross-profile key on
`finance_debt_observations`, local stack reset, and whether flags, TMDB posters
and Google Books covers should keep loading from third-party hosts, which shows
each visitor's IP to them).

---

## 7. Questions in your notes

- **Does the cron sync need localhost?** No. The schedule runs inside the
  hosted database and calls the hosted function, at 05:00 UTC for banks and
  from 06:00 UTC for the watchlist, with no browser or laptop involved.
  Caveat from the plan: runs since the Postgres 17 upgrade were checked in the
  schedule only, so look at the sync history popover to confirm real runs.
- **Can agents log in?** Yes, against the local stack: `npm run dev:test` with
  its seeded test admin. Never against production, and never with your real
  password.
- **Do you read graphify, or only write to it?** In this session I only
  updated it; I read the plan and feature documents directly. The `locator`
  agent is the one set up to query it.
- **A full feature list of the site and of Finance** already exists:
  `FEATURES.md`, 820 lines, Finance from line 251.

---

## 8. Order of work

**Decided 2026-11-09: everything except Finance first, starting with the
redesign.** Finance keeps working as it is and gets bug fixes only until
phase 5. Each phase ends with its checks green and its behaviour verified in a
browser.

| # | Phase | Contents | Done when |
|---|---|---|---|
| 1 | **Redesign shell** | On `feat/redesign-phase0`: review and commit the cleanup; check every route at phone, tablet and desktop in both themes, signed out and signed in; one-row phone header and footer; app icons; logo and image fixes; merge to `main` | The shell is on `main` and every existing route still does what `FEATURES.md` says |
| 2 | **Address and host** | Managed host on your domain with real headers; the seven address changes in one go; repository private; leaked-password protection on | Sign-in and bank linking work on the new address; old address redirects |
| 3 | **The public hub** | New Home and Projects; Tools; Thoughts merge with Time Spent as an interactive thought; visibility controls | A stranger can say what you do and what you like after one minute on Home |
| 4 | **Collections that fill themselves** | Paste-a-link autofill for every collection; trips and Flighty import; search across all sections; the rest of 8.E to 8.G as wanted | Adding a book, a link or a jacket is one paste and one click |
| 5 | **Finance correctness** | The `STATE.md` backlog (signed-in checks, save races, schema rebuild); card payments and refunds; closed accounts; tax rules as dated rows; the hard-coding audit | Your real ledger shows no card payment counted as spending; a new tax year is a row, not a code change |
| 6 | **Finance dashboard and budget** | Budget vs spent; net worth chart and long-term wealth figure; lean budget default and your eight groups; rollover; needs/wants/savings; emergency fund; goals linked to accounts; price-rise flags; month in review; visual refresh | Finance Home answers "how much can I spend" without scrolling |
| 7 | **Wealth** | Manual assets; price cache; allocation; per-account charts; credit factors; card product table | Net worth includes everything you own, each value dated |
| 8 | **Assistant** | Deployed with a key; links table; public Finance demo | The ten-question evaluation in `PHASE0_WIREFRAMES.md` passes |
| 9 | **Later** | Offline cache; passkey sign-in; transaction splitting and contacts; Health; receipts; webhooks | Each decided on its own |

One caution about putting Finance last: the shell wraps Finance too, so phase 1
still has to check Finance renders and saves correctly inside it. That is
verification, not Finance work, and it cannot be skipped.

## 9. Decisions only you can make

1. ~~Order~~ Decided: redesign and public hub first, Finance after.
2. **Rollover**: does overspend carry forward, and does it reset each tax year.
3. **Tax rules**: dated rows in the database, as recommended, yes or no.
4. **Recipe ingredients**: structured `{amount, unit, item}` or prose. Decide
   before more recipes are added.
5. **Visibility**: which collections a stranger should see.
6. **Assistant**: which provider key, and whether visitors get any of it.
7. **Contacts**: whether other people's names are ever stored here.
8. **Look**: dark instrument-panel as the default, or the current light-first
   design with instrument details inside it.
9. **Offline**: whether Finance figures may be cached on a device.
10. **Host**: which managed host, and when the repository goes private.
11. **Third-party images**: keep loading flags, posters and covers from
    their hosts, or copy them into your storage.
