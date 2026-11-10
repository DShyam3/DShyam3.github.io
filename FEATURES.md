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

## Workspace shell

Every page sits in one frame: the header, the page in a middle card, and the
footer. The frame gains parts as the window grows.

On a phone, below 768px, the header and footer are each one row. The header
keeps the avatar, which returns to Home, the page title, a search button, the
theme toggle and the menu. The social links sit in the menu panel below 700px.

From 768px wide, a left rail lists the numbered sections, with a Display toggle
(Standard or Larger) and a Search button. A search bar sits above the footer.

From 1280px wide and 600px tall, a selected record opens in an inspector column
to the right of the page. Below that size it opens as a sheet over the page.

**Search** opens with ⌘K (Ctrl+K elsewhere) or any search button. It lists the
sections. From two characters it also lists records, matched on the fields that
each collection's own search box uses, and only in collections the visitor can
open. Photos and Beliefs have no search box, so they are not searched. Picking a
record opens its collection with the search and filters set so the record is on
screen. Search reads stored rows only and answers no questions.

In the palette, Tab stays within it and typing stays in the search field. Up
and Down move a highlight
through the sections and then the records, wrapping at either end. Enter opens
the highlighted result and Escape closes the palette. Closing the palette or the
inspector sheet returns focus to whatever opened it.

**Inspector.** A collection card's detail opens in the inspector rather than a
dialog. An admin sees the card's Edit and Delete actions there. Escape, or the
close button, clears the selection.

**Install.** The site has a home-screen icon on iOS. Its web manifest gives
installable icons at 192px and 512px, and a maskable 512px icon.

## Home

The name is set in dot-matrix text: Doto as a variable font, where the dots are
circles that fuse as weight increases, so the look is reached for with weight
rather than font-size. Beside it sit a Download CV button and an Experience &
Education button, which opens the timeline.

Experience and education appear as one timeline, newest first, roles and degrees
interleaved by start date. Entries fill two compact, content-sized columns from left to right when the
card is wide enough, and one column in narrower cards. Both are editable in place when signed in as admin,
skeleton-loaded otherwise. The CV is a PDF in public storage, served from one
fixed address that a new upload replaces; a file that is not a PDF is refused.
Admins also get Add experience, Add education and Upload CV buttons.

The Overview shows a 3D constellation of the sections, which can be dragged to
rotate and paused, and four tiles of counts: countries, items, collections and
milestones. Selecting a section shows its summary and counts in the inspector.
The tiles open their section, and a list gives each section one row with
Inspect and Open. Finance is in the constellation for an admin only.

Three tabs switch the Home views: Overview, Experience & CV, and Biography &
Projects. The last holds the biography with its portrait and the projects panel.

## Collections

Nine lists — links, books, articles, inspirations, recipes, photos, inventory,
beliefs, thoughts — that share one card system, one filter model and one data
hook. A collection is defined end to end in a single file under
`src/collections/`, and `registry.ts` is the one place that answers "what does
this site list?" without opening the router.

Each collection has a title pill, item count and admin actions in the same
compact toolbar as the Watchlist Library. Categories use a dropdown with counts;
search fills the available space and has a clear button. Additional filters
open from Filters, and collections with multiple sort orders have a sort
dropdown. Search and filters appear where the collection supports them. Admins
can add, edit and remove items; Inventory’s EDC view keeps its Edit EDC action.

Media cards show the category badge on the artwork, truncating rather than overlaying text. Admin edit and delete buttons sit in a row beneath the card text, shown on hover or focus with a mouse and always on touch.

Search and filter controls wrap into available space. Cards keep readable widths
as the number of columns changes.

A collection card's detail, and an EDC card's, opens in the workspace inspector
(see Workspace shell). The image sits above the details, no taller than 14rem,
and the details scroll within the inspector. Admins edit and delete a collection
record from its detail as well as from the card.

Links are organised into categories: All, Dev Setup, Websites, iPhone, iPad, Mac.
Link icons show whole on a white plate, with no outline.

A link field in an admin form takes only an `http`, `https` or `mailto` address, and the form refuses any other value. A saved address of another kind shows without a link. Images uploaded to a collection must be JPEG, PNG, GIF, WebP or HEIC files, judged by their contents rather than their name.

A stored image that stops loading shows the collection's placeholder tile, the
same as a record that never had one. An admin also sees "Image no longer loads.
Edit to replace it." on the card and in the detail. Watchlist posters and EDC
cards do not show this notice.

Beliefs is private: only the signed-in administrator can open the page or read
its entries. The database enforces this as well as the page. A visitor who opens
it is sent to Home. An admin who reloads on Beliefs stays there, because the page
waits for the session to load before it decides.

## Thoughts

Thoughts holds written pieces, filtered by category, and one piece that is
something to use rather than read. **A year in hours** has its own page, opened
from a card marked Interactive that sits first on Thoughts while nothing is
being searched or filtered. Sliders set sleep, getting ready, commuting, the
gym, learning and time with friends, and the working year: weekend days, bank
holidays, leave and hours a day. From those it shows where the year's 8,760
hours go: a ring of the shares; free time, sleep, work and everything else as four figures; an average day as a
24-hour strip, and a table by day, week and year. Free time is whatever is left.
Entering more than a year holds brings a warning with the excess. Reset returns
every slider to its starting value. The page uses only what the visitor enters:
it starts from a five-day week with eight bank holidays and twenty days' leave,
reads nothing stored, and keeps nothing.

## Books

Books have separate subject and reading-status filters. Reading status offers
Completed, Currently Reading, To Read and Wishlist; admins can set it when
adding a book or change it in the editor.

Subjects cover Philosophy & Spirituality, Psychology, Personal Growth &
Productivity, Business & Leadership, Money & Investing, Politics & Strategy,
Science & Technology, History & Biography, Fiction, Poetry & Folklore,
Art & Design, and Food & Cooking. Uncategorized includes books without a
recognised subject.

Add Books searches Google Books by title or author, with Open Library as a
fallback when Google returns no results or is unavailable. Results show covers,
authors, publication years and available descriptions. Admins choose a subject and
reading status, then add a result with its available cover, description and
Amazon UK search link. Matching title-and-author entries are marked Added, and an
in-progress save cannot be submitted twice. Search failures show an error;
Manual entry remains available.

The wide book editor groups title, author, reading status and subject together.
Find details offers catalogue matches with cover previews; choosing a match
fills only missing artwork, description and purchase link. Existing details,
reading status and subject stay as entered. Changes remain in the form for
review until Save Changes. Optional metadata fields remain editable by hand.
Book details offer Amazon UK and Waterstones searches by title and author;
these are search links, rather than verified edition or stock listings.

## Watchlist

TV and film tracking backed by TMDB, searchable by title through a server-side
proxy so the API key never reaches the browser.

**News and Library navigation:**

- **News** — the default view. A segmented pill at the top switches between
  this week and this month, with the selected option filled. Out Now shows a
  list of compact poster-and-text rows for season premieres and film releases
  from the past week or month. Each row shows a small poster,
  the title, the release date (with "Season N ·" before it for a later season)
  and the platform mark. Watch Next shows: the next episode of any season
  already under way, plus anything aired in the last 14 days. Watch Next skips
  specials (season 0); a show whose only unwatched episodes are specials does
  not appear. Its vertical rows have separate title-detail buttons and provider links. Upcoming shows the same compact rows for season premieres and film
  releases in the coming week or month, nearest first, each with a small dated
  pill showing the days left ("3d", or "Today"). The pinned Countdown card sits inside Upcoming and uses an overlay
  layout, showing the title's landscape backdrop where one is stored, else the poster. The Updates column covers the past week or
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
 release date has not arrived. News keeps its page frame and middle workspace fixed. On large, tall screens, Watch Next, Your Week, Out Now, Upcoming and Updates form five independently scrolling columns. Smaller or shorter screens use a selector to show one column. Headings stay visible except in short windows. Calendar days place their date above their content, with an expandable explanation. Empty Watch Next and Out Now sections remain visible. When a News section fails to load, it says "Could not load …" instead of
  showing an empty "Nothing this week"; Watch Next keeps showing the rows it
  last loaded. Announcements are ordered by recency, capped at 1,000 and marked
  partial when capped. Events for titles that have been removed from the
  library are not shown. "Today" and the schedule month follow the viewer's
  local date.
- **Library** — a searchable grid of every title, with season and episode
  lists and progress. Cards size to available width at every screen height.
  Platform, genre and status filters live in
  a compact Filters popover. Episode
  names appear for watched and unwatched episodes, with a fallback when unavailable. The header shows TV time watched across the library using known runtimes of episodes marked watched, loaded independently of opening details. The library and news pages load every title however large the library grows; a read that cannot be completed shows as failed rather than as a shorter list.
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
  Suggested releases have a Decline action in the agenda and expanded calendar.
  Declined releases stay hidden in this browser across reloads, including when
  their release date changes; another season remains a separate suggestion.
  Restore declined suggestions brings them all back. These choices do not sync
  across devices, and a failed save displays an error.
  Month view uses a seven-column grid on wider screens and an agenda on narrow
  screens. The calendar header and controls stay visible while its body scrolls.
  The former Schedule view opens News.

Library has a compact category picker, search field, Filters popover and text-only
sort choices. Sync opens a popover whose history list scrolls independently.
Library uses compact poster cards with aligned title, subtitle, platform and
status rows. News release rows place text beside small posters. Both keep
scheduling actions separate from title details. Titles show up to two lines;
the full title is available in the tooltip, accessible label and details.
News details support scheduling and episode watched-state controls for admins.

Marking an episode or season watched or unwatched refreshes Watch Next to match
the saved progress. Watched marks change only after the save succeeds. If a save
fails, an error toast appears and the existing watched marks stay unchanged.

Details place episodes below the poster and information on tablets, with a
third column on wider screens. On tablets, information stays fixed above the
episode area; the season picker and season details scroll with the episodes.
On wider screens, the episode list scrolls independently below the
season controls, and the close control shares the episode heading row without
an empty strip above the content. TV details show a short synopsis preview;
Read synopsis opens the full text separately. Tablet and desktop details place
Delete in the header and ask for confirmation. The close control stays reachable.
The first unwatched regular season opens by default.

**Both views:**

- Provider search links (via platform) — a search URL, not a deep link
- Streaming platform recognition with logos
- Status, episode, season and platform refreshed from TMDB on a daily
  server-side schedule, so the data is current whether or not anyone has the
  page open — and on demand from the page itself

**Sync:**

Watchlist sync runs server-side every night in three parts, ten minutes apart
from 06:00 UTC, each covering a third of the library; the sync-history panel
labels each part and flags a part that logged nothing as missed. Manual
full-library syncs are limited to one per 10 minutes; syncing a single title is
limited to 20 per minute. Bank transaction syncs are limited to one per 15
minutes. Sync buttons on the Watchlist,
Dashboard and Bank Accounts pages show "Next sync HH:MM" during the cooldown
window and are disabled until the next sync is allowed.

## Travel

Countries and cities visited, rendered as maps by continent and by city, with
membership and region groupings.

At 1024px wide and 600px tall, the map sits beside the country list, which scrolls on its own. Narrower or shorter, the map sits above the list in one scroll. Stacked, the city list's header scrolls with the list. Each country row keeps its UN marker and city count in fixed columns, so they line up down the list whether or not a row has either.

## Inventory and EDC

Inventory opens on EDC: selected everyday-carry items from the inventory,
grouped by category, including Tech, Jewellery and Toiletries. The showcase is
read-only and shows all selected items without an Owned, Wishlist or All filter.
Wishlist items never appear in the EDC view or its category filter, even when
flagged for EDC. Other inventory categories retain their ownership filters.

Admins use Edit EDC to search owned inventory items and filter by category,
then add or remove items from EDC. A wishlist item still flagged for EDC is
listed as "Wishlist · not shown in EDC" with Remove only, and leaves the list
once removed. Each selection saves automatically. The editor wraps long item
names and brands on narrow screens and keeps focused controls fully visible.
The item edit form refuses Include in Everyday Carry (EDC) set to Yes on a
wishlist item, with the message "Wishlist items cannot be in your EDC".

---

## Admin sign-in

`/auth` signs in the site's one administrator with a password. Once that account
has a verified authenticator app, the password is followed by a code step: the
six digits from the app. The code field takes digits only, so a pasted code with a
space is read as its six digits. Verify Code stays off until six are entered. A
wrong code is refused and the field clears. Cancel signs the password session out,
and a reload keeps the code step. Until an authenticator is set up, the password
alone signs in.

When signed in as the administrator, `/auth` shows a two-factor panel. It says
whether an authenticator is on. When it is off, Set up two-factor shows a QR code
and a manual key; a six-digit code from the app confirms it, and Cancel backs out.
When it is on, the panel says so and points to the Supabase dashboard for removal.

With a verified authenticator, the database gives admin rights only to a session
that has passed the code step. Finance and every admin write depend on those
rights, so a password alone reaches neither.

---

## Finance

Admin-only. Five routed surfaces, seventeen sections — each one linkable, each
one a real URL with a working back button.

Finance opens with its money hidden. The Show figures / Hide figures button in its
toolbar paints over every £ amount in text, charts, dialogs and toasts. Labels,
dates, percentages, rates and hours stay readable as text; every number field blurs
until you click into it. Showing lasts for the browser tab, through reloads, and a
freshly opened tab starts hidden again. Values stay in the page for screen readers and hover
tooltips, so this is a screen-privacy aid, not a lock. Browsers without support show
figures and no button.

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
rather than a blank form. Budget items and recurring bills can have an optional provider name (up to 60 characters), shown after the item name — for example, "Phone · O2". Logos come from a fixed list of public
brands and chains found in the ledger, looked up once through a server-side cache; people,
transfers and independent shops get a coloured monogram instead, and their names are never
sent to the logo service. Confirmed transfers are left out of spending and income everywhere figures are shown: Home, Budget history and Cash Flow. Transaction lists still show them.

Recurring payments are suggested from repeated spending at the same merchant and account in imported bank records, without an AI key. Weekly, monthly and quarterly patterns need at least three payment dates; annual patterns need two. Suggestions show their payment history and latest amount, and flag older patterns as possibly stopped. Review each suggestion to confirm whether it is active and when you last paid, or dismiss it as not recurring. The confirmed payment date stays separate from the latest payment seen in bank records. You can add bills manually, edit them, and restore inactive or dismissed entries. A payment dismissed as not recurring stays out of suggestions until you choose to show it as a suggestion again. Only active bills contribute to recurring totals. Adding, editing, deleting or marking a recurring bill paid leaves bank balances unchanged.

Paid is decided per period: a month, quarter or year, labelled by the bill's due date. A bill shows Paid only when a recorded payment covers the current period, so a bill ticked before any payment date was recorded shows Unpaid until it is ticked again. Marking a monthly, quarterly or annual bill paid records the period the payment covers, so a late payment for last month does not mark this month paid. A tick never covers the next period. Marking the bill unpaid returns that period to unpaid. Weekly bills count as paid for a payment made in the last seven days, today included.

From seven days before a bill's next due date, a bill that is paid for the current period shows a "Paid 1 Nov early" button in its row, in both Due this month and Future / Scheduled. It records today's payment against that next period. Marking the bill unpaid then hands back only that early payment, so the current period stays Paid.

Editing a bill keeps the period its payment covers. Changing the due day or month keeps that period, including an early payment, and keeps the bill's tick. Correcting the last-paid date works out the covered period again from the corrected date, and Paid is decided again from it. Changing the frequency never stretches a payment over a longer period, and never brings back a payment that was marked unpaid.

The Recurrings section has a calendar of bills: a month grid from the current month to eleven months ahead. Days with bills are marked, and selecting one filters the list below to that day. Each bill shows one of four statuses, written out as well as marked: Paid, when that period is confirmed paid; Seen in bank, when a matching bank payment settles it, counted from up to a week before its due date (three days for a weekly bill); Not confirmed, for a past date with neither; or Due. The summary reads the scheduled total and the amount still to pay, labelled as a forecast. Bills that cannot be placed on a date are named beneath the calendar.

A quick failure loading finance profiles is retried automatically twice; if it still fails, or the database does not answer within 15 seconds, a persistent error offers “Try again”. A finance section that fails to display, or takes more than 15 seconds to load, offers “Reload page”.

When a data collection fails to load, saves are refused with a "Not saved" message instead of overwriting stored data. A profile's reset to defaults clears settings and holidays for the current profile, plus the shared reference tables (tax configurations, recurring templates, credit bureaus, holiday defaults, and budget presets); accounts, transactions, budget, bills and goals are not affected. Reset asks for confirmation before proceeding.

Marking, categorising or editing a transaction or bank account saves only the rows you changed and only the columns you edited, scoped by profile. Deleting a transaction or account removes just that one by id, not a collection. This ensures that rows added by a bank sync — which writes in parallel — are never removed by a save from a tab loaded before the sync ran. Goals, goal contributions, memberships, debts, credit scores and leave save only the rows and columns you changed. When another device loads an older page and edits it, your rows are not deleted or reverted. A bank sync keeps review marks and any category you set on an existing transaction.

Likely transfers between the owner's own accounts — including round trips — are
proposed in Transactions. Each pair can be confirmed, dismissed as "Not a transfer",
or restored from the dismissed list. The bank's own "transfer" label appears as evidence
on bank-synced rows. Possible transfers also lists one-sided transfers — a row the bank or its name calls a transfer with no matching movement in another tracked account. Mark it "My own account" (not counted) or "Real spending"/"Real income"; either can be undone. Possible transfers shows five of each list first, with "Show all". Each shows a red line when confirmed transfer links or one-sided transfers fail to load.

Bank-synced transfers are labelled "Transfers" rather than a spending category, and a category you change on a synced transaction stays changed after the next sync.

The page loads the complete transaction ledger, however large, and displays 100 at a time with "Show 100 more"; search, filters and bulk selection cover every matching transaction, and a transaction opened from Home is always shown. Transfer links, transfer dismissals, one-sided transfers, transfers between profiles, payslips and their bank matches, net-worth history, goal contributions, investment activity and debt balance records also load in full, however many there are.

Home's transaction list shows the same merchant mark as the Transactions tab: a logo
where one is known, otherwise a coloured monogram. The list links to the Transactions
tab: clicking a row's name opens that transaction with the row selected and scrolled
into view. The list's
"Transactions" heading opens the tab, carrying Home's current view: pending-only
unless "View All" is on, plus the chosen account. Both views share the same data
and filter logic; the navigation is read once and cleared.

Category rules and review queue:
- The Status filter in Transactions includes an "Uncategorised / Needs Review" view to triage unreviewed or ambiguously categorised transactions.
- Transactions inspector pane provides an inline Category Rule helper ("Always for this merchant") showing live row impact before saving.
- A "Rules" dialog in the Transactions toolbar manages profile-scoped merchant category rules with pattern matching, target category, optional merchant rename, live match counts, and impact preview.
- Category rules derive deterministically at read time with strict precedence: manual/reviewed categories take precedence over matching category rules, which take precedence over bank-provided categories. Rule re-application never dirties unchanged ledger records or triggers false database writes.

### Plan

**Cash flow** — income, spending and net come only from recorded transactions, with confirmed transfers left out; recurring bills are not added on top. The detail drawers list each year in the chosen period with that year's total and monthly average. "Where it went" shows the period's income flowing into spending categories (top five payers and top eight categories, the rest grouped as "Other"), with what was kept or drawn from balances; below tablet width it shows as a table, and on wider screens the table is one click away.

**Forecast** — the projected balance of the checking accounts for each of the next 60 days. It starts from their balances today, takes off each active bill not yet paid or seen in the bank, and adds modelled take-home on each payday. It shows the lowest point, the first day below zero and the balance in 60 days, with a chart and a list of pay and bills by date. Day-to-day spending is not included. Bills paid from another account, and past bills not confirmed, are listed rather than subtracted. Pay that has already arrived a few days before payday is not counted twice. If take-home pay cannot be modelled, the forecast says pay is not included. A warning appears when transfers fail to load, because bills may then not match their bank payments.

**Goals** and a "what if" scenario engine for testing a change before making it.

Budget and recurring defaults are generic UK: Home section covers Rent, Council Tax, Energy, Water, Internet, Phone; Transport covers Car Insurance, Fuel, Public Transport; Entertainment includes 10 streaming services (Netflix, Prime Video, Disney+, Apple TV+, Sky, NOW, Paramount+, Discovery+, YouTube Premium, Crunchyroll); Subscriptions starts empty. Payslip employer logos are matched from experience and education rows by whole-word slug (with support for configured experience `aliases`, camelCase/unspaced compound names, and multi-word initialisms of 3 or more letters), longest match wins.

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
  headline builds the end-of-month figure from SLC's balance on its date, one
  item at a time: borrowing, refunds, interest charged (with its rate when one
  rate applied to every month), income-linked interest that has landed, payslip
  deductions up to the latest payslip, and an estimate from pay for months with
  no payslip. Income by tax year is derived from payslips and sets each year's
  Plan 2 rate. Two views: your loan showing balance from latest SLC
  statement, accrued interest, and payslip deductions replacing modelled ones up
  to the latest payslip, plus how much you borrowed (summed from recorded
  borrowing, or the amount entered when none is recorded) and how far the current
  balance sits above or below it; and a simulator for any loan with course details.
  The simulator and inferred course end ignore draws with invalid calendar dates
  or non-finite amounts, while retaining valid negative and zero draws.
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

  Repayments are worked out from current pay, from the current tax year onward, so a low-paid month earlier in the year does not lower the deductions after it. The year's income still sets that year's Plan 2 interest rate. Loan pay is gross less salary sacrifice when your pay settings say salary sacrifice, both in the projection and for payslip income. A note appears when the latest payslip's deduction shows a different pay basis from the pension type in Tax & Income.

  A Repaid and interest card shows, by month and by tax year, what was repaid, the interest added (including income-linked interest still to come), the net change in what is owed, and the balance. Estimated months and years carry an est. tag, and a lead sentence says what this month did.

  Checking SLC's figures compares recorded SLC balances with the model. For each pair of balances it works out the rate SLC charged and sets it against the model's rate. When SLC's rate is higher, it says whether a payslip deduction HMRC has not yet passed on, or income-linked interest the model expected to land by then, explains the gap. When borrowing is recorded, it rebuilds the balance from that borrowing and compares it with SLC's figure.

  Recording a balance shows the balance the model expects on that date, replayed from the previous reading, the gap against it, and the rate that gap implies.

- **Investments** — profile-scoped holdings, optionally linked to a broker or
  exchange account. An investment account's balance is deliberately described
  as uninvested cash so positions and cash cannot be counted twice. The
  importer never invents a price: a missing or non-GBP cost stays explicitly
  unknown and is excluded from returns until reviewed
- **Retirement** — projection from current position

### Income

- **Money Hub** — a private comparison under Finance → Income covering 41 cities
  in 22 countries, grouped by country. A collapsible coverage list shows every
  tax jurisdiction with its cities, currency, tax period and whether pay is
  calculated. Choose a baseline and a destination city (initially London and
  Berlin). Salary can be the same gross salary (starting at £50,000) converted
  into local currency, the same number in local currency, or a separate offer in
  local currency for each city. Each city has eight monthly budget categories
  (housing, utilities and connectivity, groceries and household goods,
  transport, healthcare, leisure, local taxes and household charges, and other
  commitments); blank costs stay unknown and an explicit zero means no cost.
  Complete budgets show monthly surplus or deficit, the difference against the
  baseline, housing share of take-home (blank when salary is zero or missing)
  and the largest monthly cost category (blank when all costs are zero). Each
  jurisdiction names its local charges (Council Tax in Great Britain, Domestic
  rates in Northern Ireland, and Local taxes & household charges elsewhere),
  shows its healthcare note, and links its official tax-authority pages.

  Six jurisdictions calculate take-home locally: England, Scotland, Wales,
  Northern Ireland, Germany and the Netherlands. The UK uses the 2026/27 engine:
  Scottish bands apply to Scottish cities, and Wales and Northern Ireland use
  the England bands. Its settings are employee pension percentage (0%–100%),
  pension method (salary sacrifice, net pay or relief at source), pension
  earnings basis (full salary or qualifying earnings £6,240–£50,270),
  undergraduate student loan plan (None, Plan 1, Plan 2, Plan 4 or Plan 5),
  postgraduate loan toggle, and base personal allowance before the £100,000
  taper (including £0 for BR/0T codes). Germany shows a 2026 annual income-tax
  assessment estimate under §32a EStG, with the solidarity surcharge and
  employee pension, unemployment, health and care insurance up to the 2026
  ceilings, for a single adult without children; age (23 or over adds the
  childless care surcharge) and the health fund's additional rate are options.
  Children, church tax, private health insurance and payslip withholding
  (Lohnsteuer) are not modelled, and at or below €2,000 a month the calculator
  declines and asks for net pay. The German figure is an annual assessment
  estimate, not monthly withholding. The Netherlands uses 2026 Belastingdienst
  tables for income brackets and the general and labour tax credits, with the 8%
  holiday allowance included in gross; the 30% ruling and occupational pension
  are not modelled. Each calculated card lists that jurisdiction's own monthly
  deductions and offers a `Use my own net figure instead` switch. Every other
  city takes a monthly net figure you enter for the shown gross; changing the
  gross clears it, and its deductions are not estimated.

  Exchange rates are one dated snapshot of rates you enter, each quoted per one
  unit of an anchor currency (GBP by default). Any of 15 currencies can be
  compared: GBP, EUR, CHF, SEK, DKK, NOK, PLN, USD, CAD, AUD, NZD, SGD, HKD, JPY
  and AED. The page asks only for the currencies the comparison touches. A
  missing rate or date leaves conversions unknown and shows an alert. No rates
  are live or built in. In `Same salary, converted` the rates set each city's
  gross, and so the tax worked out on it; they also convert surpluses and the
  target for the gross needed. Living costs come from each city's own budget,
  not from the rates. The currency that results are shown in changes
  presentation only.

  `Gross needed to match <baseline>'s surplus` solves in any destination with
  calculated pay (UK, Germany or the Netherlands): the gross salary between 0
  and 10,000,000 a year in the destination's currency that funds the destination's monthly basket and matches
  the baseline's surplus, with the baseline surplus converted at the rate
  snapshot. It reports when the answer falls in a band the calculator does not
  model, when it is outside the bound, when no gross reproduces the surplus
  within 0.005 a month, or when the destination needs calculated pay. It also
  states when a gross of 0 already leaves a smaller deficit than the baseline.

  Each city card with a complete budget shows a collapsible housing sensitivity
  breakdown: break-even monthly housing cost (take-home minus non-housing
  costs), the destination housing cost that matches the baseline's monthly
  surplus at the current exchange-rate snapshot, and ±10% / ±20% housing cost
  cases holding non-housing costs constant, each with its resulting monthly
  surplus or deficit and housing share of take-home. Each city card also
  provides a collapsible upfront relocation cash & deposit calculator that
  separates refundable deposits tied up (tenancy deposit and other utility or
  key deposits) from one-off consumed moving expenses (visa and legal fees,
  travel and shipping, agency and admin fees, and initial setup and furnishing),
  showing total upfront cash required and how many months of positive monthly
  surplus — and on non-baseline cards, how many months of positive monthly
  surplus gain over the baseline — are needed to earn back the consumed moving
  expenses.

  Benefits, services and protections are assessed for all six calculated
  jurisdictions — England, Scotland, Wales, Northern Ireland, Germany and the
  Netherlands — across Employer package, Public benefits & services, and
  Employment protections. Each item applies only where its source covers it. UK
  cities share workplace auto-enrolment pensions, UK State Pension qualifying
  years, Universal Credit and working-age cash benefits, and statutory 5.6-week
  annual leave (noting 8 bank holidays in England and Wales, 9 in Scotland and
  10 in Northern Ireland); statutory sick and parental leave covers Great
  Britain, with Northern Ireland not assessed. Healthcare is NHS England for
  English cities and NHS Scotland (with free prescriptions) for Scottish ones;
  Wales and Northern Ireland have no healthcare item yet. Local charges are
  Council Tax in England (bands A to H, 1991 values) and Wales (A to I, 2003
  values), Scottish Council Tax with water and sewerage billed alongside it, and
  Northern Ireland domestic rates assessed on 2005 capital values. Germany covers occupational pension (*Betriebliche Altersversorgung /
  Entgeltumwandlung* with the 15% mandatory employer social-saving top-up),
  statutory health and care insurance (*GKV & Pflegeversicherung*, included in
  calculated deductions, with 2% and 1% annual co-payment caps), statutory
  pension and unemployment insurance (*DRV & Arbeitslosenversicherung*, included
  in calculated deductions), and statutory annual leave (*Bundesurlaubsgesetz*,
  20 days for a 5-day week plus state-varying public holidays) and 6-week 100%
  employer sick pay (*Entgeltfortzahlungsgesetz*). The Netherlands covers the
  statutory 8% holiday allowance (*vakantiegeld*, included in annual gross),
  second-pillar occupational pension (*CAO*, not assessed and not deducted, so
  take-home is overstated for a scheme member), mandatory private basic health
  insurance (*Zorgverzekeringswet / basisverzekering*, paid from net income and
  entered in the Healthcare budget category, plus the €385 annual *eigen
  risico*), AOW state pension and national insurance (*volksverzekeringen*,
  included in calculated first-bracket deductions), and statutory leave (4×
  weekly hours, 20 days for a 5-day week) and 104-week employer sick pay
  (*loondoorbetaling bij ziekte*, at least 70% of wages). Each item shows its
  eligibility state (`Included in estimate`, `Potentially eligible`, `Not
  eligible under these assumptions` or `Not assessed`), statutory baseline,
  employer comparison note, separate charges and limits, regional variation
  note, and official source link. Local charges and Dutch basic health insurance
  premiums are included only as you enter them in each city's budget; non-cash
  entitlements and unassessed benefits are not added to take-home or surplus.
  The remaining 25 user-supplied jurisdictions state that they are not yet
  assessed.

  A one-click `Copy my Tax & Income & Budget` button, available for a UK
  baseline only, copies the active profile's Tax & Income settings (salary or
  baseline offer, pension percentage, method and basis, student loan plan,
  postgraduate loan and tax-code personal allowance). It maps active non-savings
  Budget items into the baseline city's eight monthly cost categories, with
  provenance badges (`Copied from Budget`, `0 from Budget` for unmatched
  categories, `Manual` once edited). Each category copies the total the Budget
  screen shows for it. `Reset to defaults` returns to the £50,000 London and
  Berlin starting point. The button
  is disabled while Hide Figures is on, and hiding figures after copying clears
  the whole scenario back to its defaults. Hide Figures masks inputs and
  outputs. Costs and exchange rates have no built-in market estimates. Inputs
  clear when you leave the screen or switch profiles; they do not change your
  saved finance records.

- **Tax and income** — income tax, National Insurance and student loan repayments
  use the 2026/27 rules built into the site, the same rules the Tax Calculator
  uses. A Scottish profile gets Scotland's six bands. The personal allowance is
  the one set in Settings. Typing a tax code fills it from the code's number: plain,
  S or C prefixed, and L, M, N or T codes all do, including the X, M1 and W1 emergency
  markers, which add a note that each month is taxed on its own. 0T is £0. K, BR, D0,
  D1 and NT codes leave the allowance as typed, so it can be 0 for a BR code. Under relief at
  source, 80% of the pension contribution comes out of pay and every band from
  the basic rate up is widened by the whole contribution. The income tax and National
  Insurance figures do not use the bands saved in Settings, though the National
  Insurance row's note still shows the saved NI bands. The Student Loan section's
  repayment threshold and rate come from the tax rates saved in Settings.
  Contractual package items persist on the salary profile. Each is Cash or
  Benefit in kind. A preset dropdown (Annual Bonus defaulting to 10%, Private
  Medical Insurance, Dental Cover, Travel Insurance, Equity/RSUs, Car Allowance,
  Gym & Wellness, Tech/WFH Allowance, or Custom) pre-fills the form, kind
  included, for editing before confirming. Items can be edited or removed after
  adding; an item saved before the kind existed reads as Benefit in kind. A Cash
  item is paid through payroll, so its income tax, National Insurance and student
  loan come off it. It shows its own after-tax value and stays out of salary
  take-home. A Benefit in kind is not paid: the tax on its value is the extra
  income tax that value causes, taken from take-home as a `Benefit-in-kind tax`
  deduction row. When the tax code's allowance is below £12,570, that tax is shown
  as collected through the code and is not taken from take-home again. Tax on a
  benefit is never typed in. The summary shows the year's take-home, described as modelled from salary settings, with the next payday beside it: date, days left, schedule, and a "brought forward" note when the usual day is a weekend or bank holiday. The Total Compensation card carries the tax region and the Benefits and Settings buttons. The Breakdown Rates table shows how gross salary becomes take-home,
  organised into three groups: package (base salary, employer pension contributions,
  benefits and perks), deductions (personal pension, income tax, National Insurance,
  student loan repayments, and benefit-in-kind tax when it applies), and net pay. Totals separate the groups; only additions,
  total deductions and take-home carry colour. A toggle sets the days-counted method
  (Normal, Include Paid Leave, Exclude Paid Leave); another selects the period shown
  (Annual, Monthly, Weekly, Daily, Hourly). On narrower screens, the table shows one
  period at a time via the switch, so it never scrolls sideways. Pension contributions
  show their type: Net pay arrangement, Salary sacrifice, or Relief at source.
  A Take-home by tax band card under Breakdown Rates shows the same figures
  sliced by tax band (see Tax calculator).
- **Payslips** — stored with line items, viewable natively, extracted from PDF
  in the browser. A PDF attached in the add or edit form is read and parsed before
  saving; the date, employer and any blank or zero fields are filled from the PDF
  and employer logos matched from experience rows. Payslips can be deleted from the
  detail or edit dialog. Tax-year totals, and a student loan line that sets the year's
  deductions against what each payslip's own pay owes: the plan's rate on the pay
  above a month's threshold, after salary sacrifice, rounded down to whole pounds.
  The full history shows in the page, without a scroll box of its own.
- **Tax calculator** — a what-if calculator for 2026/27 UK rules. Type any salary
  or self-employed profit in the box, or drag the slider up to £250,000, and it
  shows take-home, effective rate, marginal rate and how many pence of the next
  pound you keep as cash, with the pence that go into a pension shown beneath it.
  A **Start from** switch opens on **Standard**: an ordinary
  employee with no salary filled in, on the standard tax code (1257L), the
  auto-enrolment minimum pension, no student loan, and no benefits in kind,
  children or marriage allowance. Standard shows only the salary, where you live,
  how the pension is paid (relief at source to begin with, or salary sacrifice or
  net pay) and the student loan fields. **Yours** fills every field from your Tax & Income
  settings (salary, region, pension type and percentage, student loan plan,
  benefits and the tax-code allowance), and every field stays editable.
  Changing them here never changes those settings. Each view keeps its own edits;
  **Reset** (Standard) or **My settings** (Yours) returns that view to its starting
  point. While finance figures are hidden, Yours starts with no salary, pension or
  benefits, since the chart marker and slider would otherwise show your salary;
  showing figures fills them in. The **You** marker and the step badge appear only
  once a salary is entered.

  The inputs are employed or self-employed; England, Wales & NI or Scotland, with
  Scotland's six rate bands; a pension contribution, entered as a gross percentage
  of pay and worked out afresh at each income, paid by salary sacrifice, net
  pay or relief at source (a self-employed profit has relief at source only); an
  undergraduate loan on Plan 1, 2, 4 or 5, and a postgraduate loan; benefits in
  kind for employees; the number of children claiming child benefit; childcare
  support a year, up to £20,000, which is lost once adjusted net income passes
  £100,000; and whether you receive a marriage allowance from a partner.

  The breakdown has a year and a month column for income tax with its personal
  allowance, National Insurance (Class 1 for employees, Class 4 for the
  self-employed), student and postgraduate loans, child benefit and any High
  Income Child Benefit Charge, the pension, take-home, and take-home with
  childcare support. Pointers appear only when they apply: how far adjusted net
  income is into the £100,000 personal allowance taper, and the pension
  contribution that would restore the allowance; the headroom before the taper,
  when within £10,000 of it; with children entered, where child benefit stands
  against its £60,000–£80,000 clawback (how far before it starts, how much the
  charge takes and the fall in adjusted net income that would clear it, or that
  it has all gone); and the two cliffs, childcare support at £100,000 and
  marriage allowance eligibility, each with what one more pound costs. A note
  under the children field states the clawback and the childcare cliff.

  A **Take-home by income slice** card, also on Tax & Income, shows how each slice
  of gross pay is split between income tax, National Insurance, student loans,
  pension and, where children are entered and the charge applies, the child
  benefit charge; and how much of it you keep. Slices break wherever a rate
  changes: the personal allowance, each tax band (Scotland's six included), the
  £100,000–£125,140 allowance taper, the NI thresholds, each student loan
  threshold and, with children entered, £60,000 and £80,000 of adjusted net
  income, where the child benefit charge starts and ends. A pension contribution
  or benefit in kind that spans a threshold is split there too, so no row shows
  an averaged rate for income tax, National Insurance, student loans or pension.
  The child benefit charge rises in £200 steps of adjusted net income, so a
  slice's charge rate is the average across it. The charge is paid through Self
  Assessment rather than from the payslip. Child benefit itself and childcare
  support are not pay and are left out; when there are children, the card names
  the child benefit amount beneath the table. A toggle switches
  between **After pension & benefits** and **Salary only**. The headline gives
  take-home as a share of cash pay, with a coloured bar and legend for each
  deduction's share. Pension and benefit-in-kind rows show the change they make
  to cash take-home, which is negative when they cost cash; benefit-in-kind
  rows are labelled as tax from cash pay. When the tax code already collects
  benefit-in-kind tax, the card says so.

  One chart, **What each salary keeps**, plots two lines across incomes from £0 to
  £200,000 (wider for higher incomes) on one percentage axis, with your income
  marked: the share of salary kept as cash after the pension, tax, National
  Insurance and loans (green), and the **marginal rate**, what the next pound loses
  to tax, National Insurance, loans and the child benefit charge (stepped, in ink). Each line is
  named at its right-hand end. Hovering any income shows take-home in pounds a
  year and a month, the share kept with what takes the rest (pension, income tax,
  National Insurance, student loan and child benefit charge), and the marginal
  rate; with childcare support entered it also shows take-home with that
  support. A legend gives both lines' figures at the salary entered, and a note
  under it splits the rest at that salary.

  **Compare with** adds one dashed line of the share kept: No student loan, No
  pension, a pension five points higher at every income (named by the share it
  comes to, such as Pension at 10%) or Pension by salary sacrifice. Each option
  appears only when it changes something, and its share at your income is in the
  legend. With children entered, the chart shades the child benefit clawback, and
  cliffs are drawn as dashed lines; the legend names the shading and each cliff
  line ("Child benefit clawback", "Childcare lost", "Marriage allowance lost"). A
  note says the child benefit charge is paid through Self Assessment, not the
  payslip.

  Under the chart, a list gives each stretch of income where the marginal rate
  holds still: its income range, the total rate, the rate each deduction takes
  there (income tax, National Insurance, student loan, postgraduate loan and child
  benefit charge), a sentence on what changed to make that step, and a "You" tag on
  the step your income falls in. Hovering or focusing a step shades its range on the
  chart. Notes under the list say how a pension (net pay, salary sacrifice or relief
  at source) or benefits in kind move the steps away from the headline thresholds.

  It does not model savings, dividends, rent or gains, the pension annual
  allowance, employer National Insurance, Universal Credit or other benefits, or a
  partner's income, and it does not check childcare eligibility. In Yours, the
  personal allowance field starts from the tax-code allowance in Settings (left empty, it
  is the standard £12,570), so with the same inputs it agrees with Tax & Income.
  Standard pays the auto-enrolment minimum (5% of pay between £6,240 and £50,270,
  by relief at source) at every income, including below the £10,000 earnings
  trigger, as if you had opted in; employer contributions are on top and not
  shown. Child benefit
  counts the 53 benefit weeks in 2026/27. Its rules follow the Tax Policy
  Associates UK tax calculator. Its £ figures sit under the Show figures toggle
  like the rest of Finance.
- **Holiday tracker** — Books full and half days of annual leave, sick leave, and a paid Birthday Day Off (+1 day that does not deduct from standard annual leave). When booking a single day, a Length toggle offers Full day, Morning, or Afternoon. Morning and Afternoon are disabled for weekends and bank holidays. Calendar cells fill only the half they take — left half for mornings, right half for afternoons — with a dashed border, and the legend shows "Half Day (AM left, PM right)". Entry lists and tooltips show "morning" or "afternoon". Month badges and allowance left reflect half-day deductions.

  Booking and editing open a dialog. Its calendar takes the first click as the first day and the second as the last; a click before the first day starts again. The First day and Last day fields sit under it, and a last day before the first is refused with a message. Bank holidays are marked and underlined, weekends are muted, and screen readers hear ", bank holiday" or ", weekend". A range that crosses New Year skips the bank holidays of every year it touches, so 21 Dec 2026 – 1 Jan 2027 counts 7 working days. A line under Days counted explains the count, for example "7 working days, skipping 2 weekend days and 3 bank holidays (25 Dec, 28 Dec, 1 Jan)". When the count differs from what the dates give, that line says "Saved as 8; these dates count 7." or "These dates count 7." and offers a Use 7 button. Changing a date recounts the Days counted field, so a typed count stays only while the dates do.

  Multi-day holiday bookings offer a one-click toggle to cover one eligible working day of the trip with the Birthday Day Off, saving one day of annual leave. A Birthday Day Off booked on a day inside an existing holiday is attached to it, taking that day (or half day) off the holiday's count; a holiday booked over an existing Birthday Day Off keeps the birthday and charges one less day; moving the birthday out of a holiday gives the day back. Attaching or detaching birthday leave preserves a custom holiday count, adjusting it by the birthday’s full or half day, and an invalid or insufficient count is refused. Deleting an attached birthday restores that amount to the first regular holiday covering its date. A holiday of a single working day cannot share its day with the birthday and is refused with a message. Sickness and birthday leave cannot cover the same half day, preventing double-counted leave. Changing a holiday's dates keeps its attached Birthday Day Off while the new range still allows one.

  The header's Book leave button starts on today in the current year, or on 1 January in other years. On an expanded month, a click on a day edits the entry there, with a birthday or sick entry taking precedence over the holiday around it, or starts a new booking from that day. Collapsed months still expand on click, and an open month still has its Book Leave and Record Sick Day buttons. The header and the four leave tiles (Allowance, Left, Bank, Sick) follow the card's width: four tiles across when they fit, otherwise two by two. On touch screens calendar days fill their column, so they do not overlap.

  Configurable birthday leave usage rules: on the day (or nearest working day if it falls on a weekend or bank holiday), within ±1 week, within the birthday calendar month, within ±30 days, or floating anytime in the year, using day and month only (in UK `DD / MM` order, never storing a full date of birth) and highlighting the birthday and eligible booking window on the calendar.

  A year switcher allows viewing and planning any current or future leave year with UK bank holidays (including deterministic future-year calculation and weekend substitute bank holidays) and UK (`en-GB`, day-first, Monday–Sunday) date formatting throughout. The year chevrons and the Plan Full Year shortcut change only the year on screen. The tax year saved in Settings, which also sets the weekend and bank holiday counts behind the pay rates, changes only in Settings. Bank holidays for the year on screen follow the profile's region: the saved year uses the gov.uk list once it has loaded, and any other year is calculated for that region.

  The Optimal Leave Maximiser opens in January to plan the full year and defaults later in the year to optimising remaining upcoming leave with long-weekend and 9-day week stretches alongside remaining bank holidays. It includes a shortcut to plan the next leave year, combining remaining annual leave allowance, UK bank holidays, and the Birthday Day Off (when enabled) to recommend the highest-leverage leave bridges. Selectable biases include Balanced, Long Christmas, Long Easter, and Summer Focus. Christmas bridges offer three tiers: Tier 1 · Efficient Bridge (Twixmas), Tier 2 · Balanced Stretch (pre-Christmas working days + Twixmas), and Tier 3 · Ultimate Shutdown (full Christmas week + Twixmas); Easter offers Tier 1 · Pre-Easter 4-Day Bridge, Tier 1 · Post-Easter 4-Day Bridge, and Tier 3 · 16-Day Easter Shutdown. Each bridge shows exact dates to book, leave spent, consecutive days off, and return-to-work date, with one-click booking for individual bridges or the full recommended plan. When no chosen bridge captures the Birthday Day Off, a standalone 1-day Birthday Day Off Break is recommended. Recorded sick days are excluded from suggestions and do not consume annual allowance. The Maximiser lists up to five bridges inline; with more, it lists the recommended ones and a button reveals the rest.

### Getting data in

Four routes, in decreasing order of automation:

1. **Open banking** — multiple banks connected simultaneously through
   TrueLayer, each with its own card, logo, consent countdown and individual
   disconnect. Connecting a further bank opens its consent in a new browser
   tab on computers, phones and tablets alike, and leaves the current page
   where it is; when the link finishes, open pages refresh their bank
   connections. If the browser blocks the new tab, the link runs in the same
   tab instead. Connecting the first bank stays in the same tab. Each
   connection's detail line also says how far its history
   import has got: "Importing history · checked to <month>" while older
   transactions are still being fetched, further back with each sync, then
   "History imported" once the bank has no older history to give. Balances,
   transaction history and daily snapshots refresh on a server-side schedule
   at 05:00 UTC without the browser being open; one
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
one-to-one, and penny-exact. Bank payment candidates come from the pay month
and within five days either side of it, to account for early or late payment
around calendar boundaries. When a payslip has exactly one matching bank payment
for its take-home on the pay date itself, a button confirms all such matches at once.

---

## Interactions

The theme toggle switches between light and dark mode. The sun and moon each
rise from the right and set to the left over 700ms. Supported browsers crossfade
the page between palettes over 350ms; other browsers switch the palette immediately.
The moon rises smoothly into place without overshooting. Reduced-motion
preferences skip the animation.

From 700px the header's "+" button opens the social links to its right; between 700 and 1023px the page title fades out to make room. Below 700px there is no social button, and the links sit at the foot of the menu panel. On phones the header stays one row: the page title wraps between words beside the avatar and the controls.

Every route's content sits in one "middle card" between the fixed header and footer. The card is the page's only vertical scroller. From 768px wide it has a fine border, 24px corners and a quiet tint. Below 768px there is no frame and the ordinary page gutter is the inset.

Section controls (filter bars, Finance's two nav rows) sit inside the card at its top. From 768px they pin as a frosted band, but only while they take at most a quarter of the card's height. Otherwise they scroll away with the content.

Shared form controls keep keyboard focus outlines inside their edges. Long
select and button labels wrap, and dialogs reserve a top strip for the close
button. Finance form fields stack on narrow screens; payslip lists and details
wrap long labels and values. The Watchlist search field keeps its placeholder
readable on narrow screens.
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

Dialogs maintain rounded corners and a gutter at all screen widths. A dialog
body that scrolls shows a thin scrollbar, which on dialogs with the default
padding sits in the right padding, clear of the content. Tapping or clicking
the backdrop of a dialog closes it without activating anything behind it.
Dragging across the backdrop does not dismiss it. Dialog and sheet headers keep
titles and text clear of the close button; on phones, a date beside a title
moves beneath it, as in sync run details.

---

## How it is built

Vite, TypeScript, React, Tailwind and shadcn-ui on the front. Supabase behind
it — Postgres with row-level security as the actual authorization boundary,
plus Auth, Storage, Edge Functions and pg_cron. Deployed to GitHub Pages from
`main` through GitHub Actions, which will not deploy without lint at zero,
both typechecks, tests and a clean build.

Other pages are fetched in the background. Once the first page has loaded and the browser is idle, the site downloads the code for Travel and Watchlist, and the data for Home, Travel, every collection page, and Watchlist's Library and News. Once that has finished, opening Home, Travel, a collection page, Library or News shows its content from data already in memory, and refreshes it behind the scenes. News still makes one read for season premiere episodes when it opens. Signed in as admin, the site also downloads the code for Finance and each of its sections, so switching sections does not wait for a download, and finance data loads in the background from any page and stays loaded while signed in. Returning to Finance shows that data at once and refreshes it behind the scenes if it is over a minute old. Signing out clears it. A browser that asks to save data skips the warm-up entirely.

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
- **Impossible birthday and benefit rows are refused by the database.** A
  Birthday Day Off is one day, a full day or a half; a birthday day must exist in
  its month, 29 February included; package benefits are stored as a list
