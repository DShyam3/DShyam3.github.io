# What this site does

A personal site that is also a set of working tools. Present tense only — if it
is written here, it is in the tree and reachable. What is *planned* lives in
`REHAUL_PLAN.md`; why a thing was built the way it was lives in
`REHAUL_HISTORY.md`.

Everything public is readable without an account. Finance is admin-gated end to
end, at the database rather than in the UI.

| Surface | What it is |
|---|---|
| Home | Identity, resume, CV |
| Collections | Nine curated lists, one system |
| Watchlist | TV and film tracking against TMDB |
| Travel | Countries and cities visited |
| Inventory | Gear, wardrobe, kitchen — plus EDC showcase |
| Finance | Private income, tax, spending and wealth dashboard |

---

## Home

Dot-matrix identity rendered in real text — Doto as a variable font, where the
dots are circles that fuse as weight increases, so the look is reached for with
weight rather than font-size. A dot-matrix globe and clock sit beside it.

Experience and education are rows, not markup: editable in place when signed in
as admin, skeleton-loaded otherwise. The CV uploads to private storage and
downloads through a short-lived signed URL.

## Collections

Nine lists — links, books, articles, inspirations, recipes, photos, inventory,
beliefs, thoughts — that share one card system, one filter model and one data
hook. A collection is defined end to end in a single file under
`src/collections/`, and `registry.ts` is the one place that answers "what does
this site list?" without opening the router.

Each gets faceted filtering, search, and admin-only add/edit/remove. Adding a
tenth collection is a file, a registry line, a route and a schema file — not a
new implementation of the same idea.

## Watchlist

TV and film tracking backed by TMDB, searchable by title through a server-side
proxy so the API key never reaches the browser.

**Two views:**

- **News** — the default view. A switch at the top chooses this week or this
  month for the page. Out Now always shows this week's season premieres and
  film releases, each with its platform in the corner. Watch Next follows (the
  next episode of any season already under way, plus anything aired in the
  last 14 days), then Upcoming: a grid of countdown cards for season premieres
  and film releases in the coming week or month, nearest first. An Updates
  list closes the page, covering the past week or month: new episodes
  ("S1E23 · Emotion and Reason"), platform moves ("Netflix → Disney+") and
  status changes (Ended, Cancelled, In production, Returning), each with a
  poster, the platform and a relative date, in aligned columns. A title
  appears in only one place — Watch Next first, then Out Now, then Updates —
  and shows you are caught up on are left out of Out Now and Updates. Clicking
  any card or row opens that title's details. TMDB's specials season is left
  out, and a card whose artwork is missing shows its title instead.
- **Library** — a searchable grid of every title, with season and episode
  lists and progress. Unwatched episode titles stay hidden until revealed. The
  header shows total time watched.

**Both views:**

- Provider search links (via platform) — a search URL, not a deep link
- Streaming platform recognition with logos
- Status, episode, season and platform refreshed from TMDB on a daily
  server-side schedule, so the data is current whether or not anyone has the
  page open — and on demand from the page itself

## Travel

Countries and cities visited, rendered as maps by continent and by city, with
membership and region groupings.

## Inventory and EDC

The inventory collection covers technology, wardrobe and kitchen. On top of it,
an EDC showcase presents curated everyday-carry sets as built loadouts rather
than a flat list.

---

## Finance

Admin-only. Five routed surfaces, thirteen sections — each one linkable, each
one a real URL with a working back button.

### Home

A standing summary that compares like-for-like calendar month-to-date windows:
actual received, spent, net, and the biggest category movement. Every figure is
computed from ledger rows. In-app alerts surface what needs attention.

### Spending

Transactions, budget, recurrings and transfers. Budgets build from preset groups
rather than a blank form. Merchants resolve to logos through a server-side
cache. Likely transfers between the owner's own accounts — including round trips — are
proposed in Transactions for confirmation. A confirmed pair no longer counts as
income or spending in Cash Flow.

### Plan

Cash flow, goals, and a "what if" scenario engine for testing a change before
making it.

### Wealth

- **Accounts** — bank accounts, debts, memberships and credit reports, each a
  self-contained section with its own inspector
- **Debts** — projections step forward from verified anchors rather than a
  floating balance. Drift against a real statement resolves to an implied
  annual interest rate through a numerical solver. Rate periods and PCP balloon
  payments are modelled. Student-loan reporting lag is bridged using deductions
  captured from payslips
- **Investments** — profile-scoped holdings, optionally linked to a broker or
  exchange account. An investment account's balance is deliberately described
  as uninvested cash so positions and cash cannot be counted twice. The
  importer never invents a price: a missing or non-GBP cost stays explicitly
  unknown and is excluded from returns until reviewed
- **Retirement** — projection from current position

### Income

- **Tax and income** — tax rate sets are versioned by first applicable date, so
  a historical calculation cannot silently become a calculation using a future
  Budget
- **Payslips** — stored with line items, viewable natively, extracted from PDF
  in the browser. Tax-year totals and a model comparison for student loan
- **Time spent** — income seen as hours rather than pounds

### Getting data in

Four routes, in decreasing order of automation:

1. **Open banking** — multiple banks connected simultaneously through
   TrueLayer, each with its own card, logo, consent countdown and individual
   disconnect. Balances, transaction history and daily snapshots refresh on a
   server-side schedule at 05:00 UTC without the browser being open; one
   provider failing does not make the others stale
2. **Statement import** — CSV, OFX and QFX parsed locally, preserving the
   ledger's sign convention. Reaches back further than an open-banking provider
   returns
3. **Broker export** — Trading 212 and Kraken CSVs read locally, reviewed before
   writing. Re-importing an overlapping export does not duplicate
4. **Payslips and credit reports** — folder import with review-before-write;
   reports archived beside the captured score, signature-checked, never exposed
   through a public URL

Reconciliation between a payslip and a bank transaction is user-confirmed,
one-to-one, penny-exact and limited to a five-day window.

---

## How it is built

Vite, TypeScript, React, Tailwind and shadcn-ui on the front. Supabase behind
it — Postgres with row-level security as the actual authorization boundary,
plus Auth, Storage, Edge Functions and pg_cron. Deployed to GitHub Pages from
`main` through GitHub Actions, which will not deploy without lint at zero,
both typechecks, tests and a clean build.

## What the product guarantees

These are architectural, not aspirational — the reasoning is in `AGENTS.md`.

- **It works with no AI key set.** Every figure shown is computed locally from
  rows, deterministically, and covered by tests. A model may choose, phrase and
  explain; it may not compute, because a wrong number reads exactly like a
  right one
- **Documents are stored, never sent.** PDFs and exports are parsed in the
  browser before anything is uploaded
- **What could ever reach a model is an allowlist**, not a row with fields
  stripped off. Never included: National Insurance number, account and sort
  numbers, card numbers, addresses, employer references, payroll numbers, dates
  of birth, or any third party's name
- **No financial document is readable without admin.** Every finance row
  carries a profile, CHECK-enforced; the anonymous role holds no write grant on
  any finance table
