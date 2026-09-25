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

Experience and education appear as one timeline, newest first, roles and degrees
interleaved by start date. Both are editable in place when signed in as admin,
skeleton-loaded otherwise. The CV uploads to private storage and downloads
through a short-lived signed URL. Admins get a second add button for education.

On a tablet held upright, the timeline spans the full width. The projects card
sits below it, filling the row entirely.

## Collections

Nine lists — links, books, articles, inspirations, recipes, photos, inventory,
beliefs, thoughts — that share one card system, one filter model and one data
hook. A collection is defined end to end in a single file under
`src/collections/`, and `registry.ts` is the one place that answers "what does
this site list?" without opening the router.

Each gets faceted filtering, search, and admin-only add/edit/remove. Adding a
tenth collection is a file, a registry line, a route and a schema file — not a
new implementation of the same idea.

Media cards show the category badge on the artwork, truncating rather than overlaying text. Admin edit and delete buttons sit in a row beneath the card text, shown on hover or focus with a mouse and always on touch.

Search and filter controls wrap into available space. Cards keep readable widths
as the number of columns changes.

Links are organised into categories: All, Dev Setup, Websites, iPhone, iPad, Mac.

## Watchlist

TV and film tracking backed by TMDB, searchable by title through a server-side
proxy so the API key never reaches the browser.

**News and Library navigation:**

- **News** — the default view. A segmented pill at the top switches between
  this week and this month, with the selected option filled. Out Now shows a
  grid of portrait poster cards for season premieres and film releases from the
  past week or month. The poster grid adds columns as space allows while keeping cards readable. Each card shows the 2:3 poster,
  the title, the release date (with "Season N ·" before it for a later season)
  and the platform mark. Out Now spans the full desktop content width. Watch Next follows: the next episode of any season
  already under way, plus anything aired in the last 14 days. Its horizontal rail has scroll arrows and a visible scrollbar, with separate
  title-detail buttons and provider links. Upcoming shows the same poster cards for season premieres and film
  releases in the coming week or month, nearest first, each with a small dated
  pill showing the days left ("3d", or "Today"). Upcoming and Updates sit in
  two columns beneath Watch Next. The pinned Countdown card uses an overlay
  layout. An Updates list closes the page, covering the past week or
  month: new episodes ("S1E23 · Emotion and Reason"), platform moves
  ("Netflix → Disney+") and status changes (Ended, Cancelled, In production,
  Returning), each with a poster, the title with the change beneath it, then
  the platform and the relative date. A title appears in only one place — Watch
  Next first, then Out Now, then Updates — and shows you are caught up on are
  left out of Out Now and Updates. Clicking any card or row opens that title's
  details. TMDB's specials season is left out, and a card whose artwork is
  missing shows its title instead. News poster cards, including Upcoming
  cards, always show an explicit Add to schedule or Scheduled · remove action.
  Admins can schedule a film or show from News, Library and detail cards using the shared Smart scheduling dialog. TV shows default to a weekly schedule on their
  release weekday, while films default to a one-off calendar date; either mode
  can be selected in the schedule dialog. Known episode release dates suggest the weekday; when no date is available, a day must be chosen. Episode rows keep names visible, mark
  the next unwatched released episode as "Next up", and disable episodes whose
  release date has not arrived. Updates scrolls on its own only from 1280px, where it is a column beside Upcoming; narrower, it scrolls with the page content.
- **Library** — a searchable grid of every title, with season and episode
  lists and progress. Cards size to available width at every screen height.
  Platform, genre and status filters live in
  a compact Filters popover. Episode
  names appear for watched and unwatched episodes, with a fallback when unavailable. The header shows TV time watched across the library using known runtimes of episodes marked watched, loaded independently of opening details.
- **Your Week** — part of News, showing today's plans and days with plans or
  suggested releases. Expand calendar offers week and month views with previous,
  next and current-period controls. Weekly TV plans place one unwatched episode
  on each saved weekday, never before its known release; unfinished episodes
  carry into the current week. Plans end when the known episodes run out.
  Caught-up shows keep their saved weekday dormant for later announced seasons.
  Unknown episode dates are marked TBC without inventing an endless repeat.
  One-off plans appear on their saved date. Dated season premieres and films
  already in the library appear as suggestions until an admin adds them through
  Smart scheduling. Cards open title details; admins can manage saved plans.
  Month view uses a seven-column grid on wider screens and an agenda on narrow
  screens. The calendar header and controls stay visible while its body scrolls.
  The former Schedule view opens News.

Library has a compact category picker, search field, Filters popover and text-only
sort choices. Sync opens a popover whose history list scrolls independently.
News and Library share compact poster cards with aligned title, subtitle, platform
and status rows, plus a separate scheduling action. Titles show up to two lines;
the full title is available in the tooltip, accessible label and details.
News details support scheduling and episode watched-state controls for admins.

Marking an episode or season watched or unwatched refreshes Watch Next to match
the saved progress. Watched marks change only after the save succeeds. If a save
fails, an error toast appears and the existing watched marks stay unchanged.

Details place episodes below the poster and information on tablets, with a
third column on wider screens. The episode list scrolls independently while
the season picker, season details and poster/show information stay fixed above.
Unusually long information has its own scroll area. The close control stays
reachable. The first unwatched regular season opens by default.

**Both views:**

- Provider search links (via platform) — a search URL, not a deep link
- Streaming platform recognition with logos
- Status, episode, season and platform refreshed from TMDB on a daily
  server-side schedule, so the data is current whether or not anyone has the
  page open — and on demand from the page itself

**Sync:**

Watchlist sync runs server-side, covering the entire library in about a
minute. Manual full-library syncs are limited to one per 10 minutes; syncing a
single title is limited to 20 per minute. Bank transaction syncs are limited to
one per 15 minutes. Sync buttons on the Watchlist, Dashboard and Bank Accounts
pages show "Next sync HH:MM" during the cooldown window and are disabled until
the next sync is allowed.

## Travel

Countries and cities visited, rendered as maps by continent and by city, with
membership and region groupings.

At 1024px wide and 600px tall, the map sits beside the country list, which scrolls on its own. Narrower or shorter, the map sits above the list in one scroll. Stacked, the city list's header scrolls with the list.

## Inventory and EDC

The inventory collection covers technology, wardrobe and kitchen. On top of it,
an EDC showcase presents curated everyday-carry sets as built loadouts rather
than a flat list.

---

## Finance

Admin-only. Five routed surfaces, fifteen sections — each one linkable, each
one a real URL with a working back button.

### Home

A standing summary that compares like-for-like calendar month-to-date windows:
actual received, spent, net, and the biggest category movement. Every figure is
computed from ledger rows. In-app alerts surface what needs attention: debt
charging 10% APR or more while cash sits above the emergency fund target (with
an estimate of annual interest on spare cash that could cover it), and credit
card utilisation above 30% of known limits (naming the most-used card).

The surface and section navigation wraps as space narrows. Wide budget and
membership tables scroll horizontally within their panels.

### Spending

Transactions, budget, recurrings and transfers. At 1024px or wider and 720px or taller, the list scrolls with the page and the details panel stays in view beside it, with its own scroll. Smaller, the list keeps its own pane above the details, capped to the measured card height. Budgets build from preset groups
rather than a blank form. Merchants resolve to logos through a server-side
cache. Confirmed transfers are left out of spending and income everywhere figures are shown: Home, Budget history and Cash Flow. Transaction lists still show them.

Likely transfers between the owner's own accounts — including round trips — are
proposed in Transactions. Each pair can be confirmed, dismissed as "Not a transfer",
or restored from the dismissed list. The bank's own "transfer" label appears as evidence
on bank-synced rows. Possible transfers also lists one-sided transfers — a row the bank or its name calls a transfer with no matching movement in another tracked account. Mark it "My own account" (not counted) or "Real spending"/"Real income"; either can be undone. Possible transfers shows five of each list first, with "Show all". Each shows a red line when confirmed transfer links or one-sided transfers fail to load.

Bank-synced transfers are labelled "Transfers" rather than a spending category, and a category you change on a synced transaction stays changed after the next sync.

The transaction list shows 100 at a time with "Show 100 more"; search, filters and bulk selection cover every matching transaction, and a transaction opened from Home is always shown.

Home's transaction list links to the Transactions tab: clicking a row's name opens
that transaction with the row selected and scrolled into view. The list's
"Transactions" heading opens the tab, carrying Home's current view: pending-only
unless "View All" is on, plus the chosen account. Both views share the same data
and filter logic; the navigation is read once and cleared.

### Plan

**Cash flow** — income, spending and net come only from recorded transactions, with confirmed transfers left out; recurring bills are not added on top. The detail drawers list each year in the chosen period with that year's total and monthly average. "Where it went" shows the period's income flowing into spending categories (top five payers and top eight categories, the rest grouped as "Other"), with what was kept or drawn from balances; below tablet width it shows as a table, and on wider screens the table is one click away.

**Goals** and a "what if" scenario engine for testing a change before making it.

Budget and recurring defaults are generic UK: Home section covers Rent, Council Tax, Energy, Water, Internet, Phone; Transport covers Car Insurance, Fuel, Public Transport; Subscriptions starts empty. Payslip employer logos are matched from experience and education rows by whole-word slug, longest match wins.

### Wealth

- **Accounts** — bank accounts, reward memberships and credit reports, each a
  self-contained section with its own inspector. Credit cards take a credit limit
  (entered by hand, or filled from the bank for synced cards); the account view
  shows it or "Not known". On bank-synced accounts the bank fills in the name,
  emoji and colour once; changes you make to them, and any annual fee you enter,
  are kept through later syncs
- **Debts** — mortgages, car finance (PCP), cards and personal loans. Opens on
  total owed, monthly total and a debt-free year. One row per debt with balance,
  clear year and share repaid. Projections step forward from verified anchors
  rather than a floating balance; rate periods and PCP balloon payments are
  modelled. Drift against a real statement resolves to an implied annual
  interest rate through a numerical solver. Inline balance recording with a form
  showing the expected balance on that date and the gap against the actual
  statement
- **Student Loan** — SLC charges Plan 2 interest at RPI during the tax year; the
  income-linked part accrues monthly and lands in a later month (typically 6
  after the tax year ends, editable as "Income-linked interest lands"). The
  headline shows SLC's balance at end-of-month plus accrued interest and how
  much is pending. Income by tax year is derived from payslips and sets each
  year's Plan 2 rate. Two views: your loan showing balance from latest SLC
  statement, accrued interest, and payslip deductions replacing modelled ones up
  to the latest payslip; and a simulator for any loan with course details.
  Month-by-month timeline with a scrubber and play control, showing balance,
  interest rate, monthly payment and repaid-so-far. Totals: total repaid,
  written off, peak balance, interest added. Refunds and payments made outside
  payroll are recorded inline. Published rates editor stores dated rows for
  each rate change (from, RPI, cap, Plan 2 threshold, Plan 2 full-rate income,
  Bank Rate), and a notice appears when no row covers today — the yearly update
  step. Rate rows are matched at month end so threshold changes apply from their
  effective date. Interest is derived from published SLC rates, and the rate and
  write-off date each show how they were determined. The course end date is
  inferred and carries the write-off boundary. Assumptions panel: inflation, RPI,
  income-linked landing lag, Plan 2 full-rate income threshold growth
- **Investments** — profile-scoped holdings, optionally linked to a broker or
  exchange account. An investment account's balance is deliberately described
  as uninvested cash so positions and cash cannot be counted twice. The
  importer never invents a price: a missing or non-GBP cost stays explicitly
  unknown and is excluded from returns until reviewed
- **Retirement** — projection from current position

### Income

- **Tax and income** — tax rate sets are versioned by first applicable date, so
  a historical calculation cannot silently become a calculation using a future
  Budget. The summary shows the year's take-home, described as modelled from salary settings, with the next payday beside it: date, days left, schedule, and a "brought forward" note when the usual day is a weekend or bank holiday. The Total Compensation card carries the tax region and the Benefits and Settings buttons. The Breakdown Rates table shows how gross salary becomes take-home,
  organised into three groups: package (base salary, employer pension contributions,
  benefits and perks), deductions (personal pension, income tax, National Insurance,
  student loan repayments), and net pay. Totals separate the groups; only additions,
  total deductions and take-home carry colour. A toggle sets the days-counted method
  (Normal, Include Paid Leave, Exclude Paid Leave); another selects the period shown
  (Annual, Monthly, Weekly, Daily, Hourly). On narrower screens, the table shows one
  period at a time via the switch, so it never scrolls sideways. Pension contributions
  show their type: Net pay arrangement, Salary sacrifice, or Relief at source
- **Payslips** — stored with line items, viewable natively, extracted from PDF
  in the browser. Tax-year totals and a model comparison for student loan. The
  full history shows in the page, without a scroll box of its own.
- **Time spent** — income seen as hours rather than pounds. Its summary shows the
  gross package beside the year's take-home.
- **Holiday tracker** — Books full and half days of leave and sick time. When
  booking a single day, a Length toggle offers Full day, Morning, or Afternoon.
  Morning and Afternoon are disabled for weekends and bank holidays. Calendar
  cells fill only the half they take — left half for mornings, right half for
  afternoons — with a dashed border, and the legend shows "Half Day (AM left, PM
  right)". Entry lists and tooltips show "morning" or "afternoon". Month badges
  and allowance left reflect half-day deductions

### Getting data in

Four routes, in decreasing order of automation:

1. **Open banking** — multiple banks connected simultaneously through
   TrueLayer, each with its own card, logo, consent countdown and individual
   disconnect. Balances, transaction history and daily snapshots refresh on a
   server-side schedule at 05:00 UTC without the browser being open; one
   provider failing does not make the others stale. A sync history popover on the
   Transactions toolbar and beside "Sync All Banks" in Wealth lists each run with
   its trigger, new transactions and time ("Today 18:57"); hovering a run shows
   how many banks it read and how long it took. The popover also shows consent
   expiry within 14 days, next nightly run time, and a manual sync trigger. A red
   dot on the trigger marks when the newest run or newest nightly run is not a
   success. Bank names, colours and logos come from TrueLayer only and persist through future syncs
2. **Statement import** — CSV, OFX and QFX parsed locally, preserving the
   ledger's sign convention. Reaches back further than an open-banking provider
   returns
3. **Broker export** — Trading 212 and Kraken CSVs read locally, reviewed before
   writing. Re-importing an overlapping export does not duplicate
4. **Payslips and credit reports** — folder import with review-before-write;
   reports archived beside the captured score, signature-checked, never exposed
   through a public URL. The payslip reader works from the label wording UK
   payslips share rather than any one employer's layout: it tells the
   employee's National Insurance and pension from the employer's in prefix,
   suffix and abbreviated forms (Ees/Ers, EE/ER), skips NI-able pay, NI
   numbers and running totals, and books a salary sacrifice as pension only
   when its label names no other scheme. It never fills "other deductions"
   itself; a payslip that does not add up is shown as not adding up

Reconciliation between a payslip and a bank transaction is user-confirmed,
one-to-one, penny-exact and limited to a five-day window.

---

## Interactions

The theme toggle switches between light and dark mode. The sun and moon each
rise from the right and set to the left over 700ms. Supported browsers crossfade
the page between palettes over 350ms; other browsers switch the palette immediately.
The moon rises smoothly into place without overshooting. Reduced-motion
preferences skip the animation.

Every route's content sits in one "middle card" between the fixed header and footer. The card is the page's only vertical scroller. From 768px wide it has a fine border, 24px corners and a quiet tint. Below 768px there is no frame and the ordinary page gutter is the inset.

Section controls (filter bars, Finance's two nav rows) sit inside the card at its top. From 768px they pin as a frosted band, but only while they take at most a quarter of the card's height. Otherwise they scroll away with the content.

Toolbar controls have room for their full focus outlines. The Watchlist search
field keeps its placeholder readable on narrow screens.
Long lists show in full and scroll with the card rather than in boxes of their
own: payslip history, published student-loan rates (the table keeps its sideways
scroll), a goal's contribution ledger, and the benefits and payslip dialogs. The
holiday tracker scrolls on its own from 1024px, where it sits beside the pay
breakdown. The 404 page uses the site frame, with the navigation menu.

Footer labels and the clock use larger, matching text, with extra vertical
spacing and a responsive size for phones and wider screens.
From 768px wide, the footer shows "Designed by Dhyan Shyam" and keeps London
and the clock centred in the space between the copyright label and the credit,
with equal blank gaps on either side. The credit stacks "Designed by" above
"Dhyan Shyam" at 768–1023px and appears on one line from 1024px, using the same
larger text as the other footer labels. The credit is hidden on phones.
Shared content widths and gutters keep large monitors readable across phones,
tablets and desktops. Card actions remain visible on touch devices,
with larger touch targets. "Skip to content" lands after a section's own controls.

The footer's copyright mark opens a dialog with Privacy and Credits tabs, focus
trap and Escape to close. The Privacy tab lists Cookies, Personal Data, Analytics,
Admin Sign-in and Copyright (the current year, the owner, and that all rights
are reserved) as fact rows with no section headings. Credits
shows an "Inspired by" label and three link cards. Both tabs fit on screen
without scrolling; on phones, type and spacing tighten, and in landscape the
credit cards align in one row.

The menu offers persistent Standard and Larger display sizes. Larger increases
text and controls while retaining ordinary browser keyboard navigation.

Dialogs maintain rounded corners and a gutter at all screen widths. Tapping or
clicking the backdrop of a dialog closes it without activating anything behind
it. Dragging across the backdrop does not dismiss it. Dialog and sheet headers
keep titles and text clear of the close button; on phones, a date beside a
title moves beneath it, as in sync run details.

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
