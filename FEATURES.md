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
to the right of the page. The column widens on large screens, so its details have
more room. Below that size it opens as a sheet over the page.

**Search** opens with ⌘K (Ctrl+K elsewhere) or any search button. It lists the
sections. From two characters it also lists records, matched on the fields that
each collection's own search box uses, and only in collections the visitor can
open. Photos and Beliefs have no search box, so they are not searched. Picking a
record opens its collection with the search and filters set so the record is on
screen. A filter that offers no option for the record's category goes to All, so
the record still shows. Search reads stored rows only and answers no questions.

On the opening splash, ⌘K (Ctrl+K elsewhere) closes the splash at once and opens
the palette. Holding the keys does not toggle the palette on each key repeat.

In the palette, Tab stays within it and typing stays in the search field. Up
and Down move a highlight
through the sections and then the records, wrapping at either end. Enter opens
the highlighted result and Escape closes the palette. Closing the palette or the
inspector sheet returns focus to whatever opened it.

**Inspector.** A collection card's detail opens in the inspector rather than a
dialog. An admin sees the card's Edit and Delete actions there. Opening another
card, or another Watchlist title, replaces what the inspector shows. Escape, or
the close button, clears the selection. Below 1280px wide or 600px tall the
inspector is a sheet over the page; resizing the window across either limit with
something selected moves it between the sheet and the side column.

**Install.** The site has a home-screen icon on iOS. Its web manifest gives
installable icons at 192px and 512px, and a maskable 512px icon.

## Home

The name is set in dot-matrix text: Doto as a variable font, where the dots are
circles that fuse as weight increases, so the look is reached for with weight
rather than font-size. The bar above the Overview holds the Download CV button
and the Experience & CV tab; on a phone, where that bar has no room for the
button, Download CV sits under the introduction instead.

Experience and education appear as one timeline, newest first, roles and degrees
interleaved by start date. Entries fill two compact, content-sized columns from left to right when the
card is wide enough, and one column in narrower cards. Both are editable in place when signed in as admin,
skeleton-loaded otherwise. The CV is a PDF in public storage, served from one
fixed address that a new upload replaces; a file that is not a PDF is refused.
Admins also get Add experience, Add education and Upload CV buttons.

The Overview shows a 3D constellation of the sections, which can be dragged to
rotate and paused, with a button per section beneath it. Both name the sections
only; the counts are on the fact cards. Selecting a section shows its summary and
counts in the inspector. Finance is in the constellation for an admin only. It stops animating while it is scrolled out of view.

Fact cards each give one specific fact and open the section it comes from. They
show every country and territory visited, out of 250 (the ISO list plus Kosovo),
with the UN states visited out of 195 beneath it, then cities and the
continents with a UN state visited (opens the Travel map); a favourite film and
a favourite series (opens Watchlist Favourites); the
book being read now, or the last one finished; the current role (opens Experience
& CV); the latest project, when there are projects; and the inventory count. When
signed in as admin, the admin picks the film and the series from their favourites,
and can return either to the daily pick. Otherwise the favourite changes each day,
labelled as today's pick. A card with nothing to show is left out. On a phone the
cards are one swipeable row; from 640px they form a grid.

Three tabs switch the Home views: Overview, Experience & CV, and Biography &
Projects. The last holds the biography with its portrait and a panel that opens
Projects.

## Collections

Ten lists — projects, links, books, articles, inspirations, recipes, photos,
inventory, beliefs, thoughts — that share one card system, one filter model and one data
hook. A collection is defined end to end in a single file under
`src/collections/`, and `registry.ts` is the one place that answers "what does
this site list?" without opening the router.

Each collection has a title pill, item count and admin actions in the same
compact toolbar as the Watchlist Library. Categories use a dropdown with counts;
search fills the available space and has a clear button. Additional filters
open from Filters, and collections with multiple sort orders have a sort
dropdown. Search and filters appear where the collection supports them. Admins
can add, edit and remove items; Inventory’s EDC view keeps its Edit EDC action. Emptying
an optional field in the edit form removes its value.

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

## Projects

Projects lists what has been built, what is being built and what is planned.
Each project has a status of Done, In progress or Planned, shown as a badge on
its card and used as the filter. A project can carry a summary, a link, an
image and a line of skills, which sit under its title. Search covers the title,
summary and skills. Opening a card shows the summary, and the title links out
when the project has a link.

## Thoughts

Thoughts holds written pieces, filtered by category, and one piece that is
something to use rather than read. **A year in hours** has its own page, opened
from a card marked Interactive that sits first on Thoughts while nothing is
being searched or filtered. It splits the year into needs and free time.
Needs are sleep / time in bed, personal care, eating, housework and errands,
caring for others, work and the commute. The working year sets working days a
week (weekends included), bank holidays, leave and time at work a day, which
counts lunch and breaks whether paid or not. The model uses a fixed 365-day year
of 52 whole weeks, so days off follow from the working week, whichever days they
fall on: 104 for five days, 156 for four. The card gives the working days a year
and the hours in a working week. Free time is what the needs leave; the visitor
chooses what goes in it (exercise as days a week then time each day in 15-minute
steps, learning and socialising) and the rest is still free. The page shows a
ring of the year in five slices (sleep, other needs, work, fitted in, still
free); needs, free time, fitted in and still free as four figures; an average
day as a 24-hour strip; a Your free time list giving each chosen activity and
what is still free as a share of the free time; and a table of every activity
by average day, average week and year, with needs and free time subtotals. A
line under the table explains that the averages spread the whole year, so work
reads below the working week: 34.8 hours against 40 when 34 days go to bank
holidays and leave. A Show in switch gives the ring, the figures, the free-time
list and the table in seconds, minutes, hours, days or weeks, so the year reads
as 31,536,000 seconds or 52.1 weeks. Entering more than a year holds brings a
warning with the excess. The page opens on Dhyan's own year: a 40-hour week on
site five days with a two-hour round trip, eight bank holidays, 26 days' leave,
7.5 hours in bed and an hour and a half of housework. A Start from switch
sets every slider to Dhyan's year or a UK starting point and marks whichever the
sliders match. The UK starting point uses eight hours at work a day (37.5
scheduled hours a week and a 30-minute unpaid lunch), eight bank holidays, 25
days' leave, 7.5 hours in bed, an hour each of personal care and eating, two and
a half hours of housework, five commuting days with a one-hour return journey,
and four hours of socialising a week. Caring, exercise and learning start at
zero. The exercise slider shows the NHS minimum of 150 minutes a week beside the
visitor's own total. Example controls offer on-site, hybrid and remote commuting
patterns, the NHS minimum as five 30-minute sessions, and three one-hour gym
sessions. Commuting excludes leave and bank holidays, pro-rated over the working
week, and can be no more days than are worked; the on-site example is every
working day. A disclaimer and expandable Sources and assumptions distinguish
published statistics from rounded planning assumptions, with source links and
dates. The page uses only what the visitor enters, reads nothing stored, and
keeps nothing.

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

News, Library, Favourites, Diary and Franchises sit in one nav bar on every Watchlist page.

In Discover, the signed-in owner can click anywhere on the full-width search
bar above the suggestions to look up a film or series they have watched. Each
result offers `Seen it`, which asks when it was watched: just now, on release
(on each episode's air date for a series), date unknown, or a picked date. A
new title is added as watched; titles with a future release date cannot be
logged yet. Titles already in the library are dimmed and labelled `Already in
library` or `Already watched`, without a `Seen it` action; their watch dates
are managed from Library. The search follows the `All` / `Films` / `Series`
switch and uses
the same TMDB title lookup as Library. Both searches show results for the
latest query without leaving earlier results on screen. Library's separate Add
search saves titles as unwatched: released titles go to `To watch`, and future
releases to `Upcoming`.

**News, Library and Favourites navigation:**

- **News** — a single scrolling page with two tabs, `Following` (the default) and `Discover`, and an `All` / `Films` / `Series` switch that is remembered in the browser. `This week` and `This month` appear on `Following` only. `Following` opens with `Worth your attention`, which shows something out now first, then the pinned countdown title, then the next release; each card layers the title's backdrop behind a gradient with its poster, time, date and platform line, season-run line (`Weekly` or `All at once`, episode progress or count, and finale date for weekly series), plot overview on wider screens, and a separate `View details` button. Below it, a collapsible `Your week` bar previews the seven-day schedule (`WeekStrip` on wider screens, showing up to two thumbnails per day and `+N` overflow) and expands to the full calendar, followed by an auto-fit `OUT NOW` poster card grid, a `UPDATES` feed (one column on narrower screens, two columns on desktop), and `UPCOMING`. The pinned countdown has no card of its own: it is the featured title, or the first `Upcoming` card. `Discover` shows `COMING SOON`, which puts upcoming franchise sequels and spin-offs with a future release date first (sorted soonest first and labelled `In your franchise` on the tile, with `In your franchise · <franchise name>` in the tooltip and details, drawing on both live-expanded franchises and a nightly server-side check of active film collections across the library, scoped to collections visible in the viewer's library), followed by films in UK cinemas and new series in the next six months that are outside your library (12 tiles, alternating films and series in the All view; the section keeps loading pages until the grid is full), `HAVE YOU ALREADY WATCHED?`, which lists started film collections, shared film universes such as the Marvel Cinematic Universe, and connected TV spin-offs built from titles in your library (excluding undated instalments not already in your library). The section walks every film collection in your library, most recently active first, a batch at a time, until six franchises with something unanswered are on screen; `Show more series & collections` adds the next six, and a line shows `N of M collections` checked while it walks. A failed batch is retried by that button. A collection TMDB no longer has gets no card. A universe is one card listing its films in release order; a collection that the universe lists in full is shown inside it, and a collection with films outside the universe keeps its own card. Cards are in a responsive multi-column grid. The most recently active come first, by the last time you added, watched, unwatched or re-dated a title in them, or changed its Library visibility; release dates don’t count. Cards with no such activity follow, newest-added first, with films and series taking turns (a film first). For visitors, a card counts only titles visible in the library, so a hidden or stopped title is not shown as in the library. Each card lists its titles in release order, with `N of M watched · K not in library`, `Next up`, clickable posters and titles to open library details or a TMDB preview for missing instalments, and per-instalment `Add to library`, `Seen it` with the date menu, or `Not interested`. `Likely seen` follows it: a grid of released titles recommended across several of your library titles, topped up with widely watched titles; once the first suggestions are in, its tiles keep the order they first appeared, with matches across several of your titles first. Then `YOU MIGHT LIKE`, which offers `None of these` to dismiss the whole visible batch at once and advance alongside `Show more suggestions`, and excludes instalments, `Likely seen` hits already surfaced above, and titles you already have, favourited or dismissed. Each source title contributes at most four suggestions. It stops looking on its own after two batches that add nothing new, and `Show more suggestions` keeps looking. Suggestions are built from five kinds of title that take turns: ones you scored 8 or higher, favourites newest first, titles you recently watched, started series with something still to watch or kept up with as it airs, and saved titles not out yet, soonest first ("Because you're waiting for X"); other saved titles follow. The strongest 24 rotate weekly, and each batch takes turns between four source titles; once those run out, suggestions continue with TMDB's most-voted titles. Suggestions use the same poster cards and grid as the Library, with aligned title, subtitle, `Like X` reason and action rows. `Not interested` is on every tile. It is remembered in the browser, and for the admin it is saved across devices. For the admin, tiles also offer `Add to watchlist` and `Seen it`. `Seen it` asks when it was watched, with the same menu as Mark as watched: `Just now`, `On release date` (for a series, on each episode's air date), `Date unknown`, or `Pick a date`. It adds a title as already watched: a film as watched, a series with every aired episode watched. A picked date cannot be earlier than the title's release (or a season's first air date) or later than today; for a series, an episode that aired after the picked day takes its own air date. A fully watched ended or cancelled series goes to `Finished`; a running series goes to `Up to date`, or to `Upcoming` when its next episode or season has a date. Both add actions preserve the fetched director, creator and cast details. Tapping a poster opens its details with the poster, season count, genres, streaming platform, series status, full suggestion reason, synopsis, director/creator and lead cast credits, film runtime, trailer and the same actions. Titles on Stopped watching or Hidden leave News; Paused titles stay. A watched film leaves Out Now and Updates. Discover's own TMDB requests are paced so that your adds, `Seen it` and searches are not starved; a rate-limited request waits and tries again rather than leaving its section empty.
- **Library** — a searchable grid of every title, sorted onto shelves by status: `Watching`, `To watch`, `Upcoming`, `Up to date`, `Finished`, then, separately, `Stopped watching` and `Hidden`. Each title sits on one shelf. `Watching` holds a series part-way through a season (a watched episode and an aired one still to watch) and a series you are keeping up with as it airs (every aired episode of a season you have started watched, and its next episode due within two weeks), even if you skipped earlier seasons. `To watch` holds released titles not started, and a started series between seasons: a season finished with the next one out, or only some seasons ticked. Its pill names where you pick up, such as `S5 next`. Films go straight from `To watch` to `Finished`. `Upcoming` holds titles not out yet, and a series you are up to date on whose return has a date (a new season, or an episode more than two weeks away), soonest first: nothing to watch until then. `Up to date` holds a running series with every aired episode watched and no next date known; once its return has a date it moves to `Upcoming`, and when a new season premieres it moves to `To watch` (`S5 next`), while a next episode due within two weeks puts it on `Watching`. `Finished` holds watched films and ended series watched to the end. An `All` / `Films` / `Series` switch, remembered in the browser, applies to every shelf and its count. Search covers the whole library from any shelf. Favouriting from a card's menu is a single tap that adds or removes the favourite.
A series can be paused from its details (Paused, out of Your Week): it keeps its shelf, and its card carries a Paused label. Films cannot be paused.
Mark as watched for a film, and Mark Season N as Complete for a season, ask when: just now, on the release date (offered only once released), date unknown, or a picked day that is not earlier than the release (or a season's first air date) and not in the future. A single episode tick is recorded as now, and an episode not yet aired gets no date.
- **Favourites** (`/watchlist/favourites`) — a dedicated tab listing the titles you have favourited, with the `All` / `Films` / `Series` switch remembered in the browser, title search (`Search favourites…`) that expands matching language groups, and the automatic category filter alongside its existing groups. Signed-in admins can add titles via an `Add to Favourites` TMDB search dialog and run `Refresh favourite details` (showing progress while syncing).
- **Personal Ratings** — tap-to-rate picker from `0.5` to `10` in `0.5` steps, with `Clear rating`, on movies, TV shows, seasons, and watched episodes. A season can be rated once at least one of its episodes is watched, and an episode only once it is watched. After watching, the app may ask `Watched — rate it?`, `Finished — rate the show?` or `Finished season N — rate it?`, each with `Skip` for that visit. Season pages show an independent episode average, `Episode average: X/10 · Y of Z rated`. Visitors see the owner's rating read-only, beside the IMDb, Rotten Tomatoes, Metacritic and TMDB scores where they are known; only the signed-in owner can set a rating.
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
  Each release is a separate block in the agenda, with its captions and actions
  under its card. A suggested release shows a poster thumbnail and says "Out
  today" or "Not out yet" rather than repeating its day's date; a planned
  episode shows its release date. In a narrow column a card's title takes its
  own line under the poster. In the compact column each day reads as one label,
  such as "Wed 11 Nov", with "Today" at its end.
  Month view uses a seven-column grid on wider screens and an agenda on narrow
  screens. The calendar header and controls stay visible while its body scrolls.
  The former Schedule view opens News.

Library has a compact shelf picker, search field, Filters popover and text-only
sort choices. While searching, the shelf dropdown displays `All shelves (N)` with live match counts per shelf; picking a shelf narrows the search to that shelf without clearing the search query. `/watchlist/library?category=favourites` redirects to `/watchlist/favourites`. Old category links still open the matching shelf: `?category=tv-shows` and `?category=movies` open To watch filtered to Series or Films, `watched` opens Finished, and `currently-watching` opens Watching. Sync opens a popover whose history list scrolls independently. On a phone, the Add and Sync buttons show only their icons, and the search field drops below the shelf picker. Library details for an admin hold a history and rating panel first: the personal rating, Mark as watched for films, a Favourite toggle, and Library visibility (In library, Hidden or Stopped watching). In the details inspector, the top badge row also includes a `Shelf: <shelf>` pill (when different from the status pill) and a `Favourite` heart pill. Schedule, Resync and Delete follow.

Library filters include automatic categories for Anime, Cartoon, K-Drama (TV), Action, Sci-Fi and Documentary. A title can match several: its card shows the first, and its details list them all. The categories follow TMDB genre IDs, original language and origin country through reusable rules; the film/series switch and watch-status shelves stay separate. Favourites has the same automatic category filter alongside its existing groups. New additions save these TMDB facts, and the nightly sync fills them for older titles. A title without enough origin data is left out of origin-based categories until those facts arrive.

Each shelf says what it holds under its count. Search looks on every shelf and groups its results under the shelf each title is on. Signed-out visitors do not see the Hidden and Stopped watching shelves, and search leaves those titles out for them. A visitor who follows a link to either shelf lands on Watching, with filters and search cleared.

The sort picker offers different choices on each shelf. Watching and To watch offer Title A–Z, Latest releases, and Quickest to finish for series or Shortest first for films. Finished opens on Recently watched — a film by when you marked it watched, a series by its latest watched episode — with titles that have no watch date after the rest in title order; it also offers Your rating and Title. Your rating is offered only to the signed-in owner. Stopped watching offers Title and Your rating. Upcoming runs by air date, soonest first, with no sort picker. Up to date offers Title A–Z and Latest releases. A sort choice that a shelf no longer offers, such as Your rating after signing out, falls back to the shelf's first order. Quickest to finish ranks shows by the runtime of every aired episode not
yet watched, across all regular seasons; watched seasons and episodes count for
nothing. A show with a season still airing, one with some episodes out and more
dated, cannot be finished yet, so it is not ranked by the episodes out so far;
it reads "S4 still airing". A season that has not started yet does not count.
Episodes TMDB has not dated yet are not known. Specials and episodes that have
not aired yet are left out. An episode with no stored runtime counts as the
show's median episode runtime, and a total that includes one is marked "~".
While a time order is picked, each card's line under the title shows what it is
ranked by, such as "8 eps · 6h 40m" or "6 eps · ~5h 10m". A show with nothing
aired left reads "Up to date", and one with nothing aired at all reads "Not
aired yet". Shows sort in this order: those with a known time, quickest first;
then those with no runtime to go on, fewest episodes first; then those still
airing; then those with nothing left to watch. Films under Shortest first sort
by runtime and show it on the card. On Watching, Latest releases
orders by each show's latest season date. While a title's detail is open the
order holds still, and it catches up when the detail closes.

Library uses compact poster cards with aligned title, subtitle, platform and
status rows. News release rows place text beside small posters, or below them in narrow columns. Both keep
scheduling actions separate from title details. Titles show up to two lines;
the full title is available in the tooltip, accessible label and details. A title on Upcoming with a known date shows a countdown in its status pill: "S1E8 in 3d" for an episode, "S3 in 2d" for a season premiere, "Out in 33d" for a film. A series you are keeping up with as it airs shows the same countdown to its next episode, such as "S4E6 in 1d". A series between seasons shows where you pick up instead, such as "S5 next", with no countdown. The card's tooltip and the details dialog give the same date in full.
News details support scheduling and episode watched-state controls for admins.

Marking an episode or season watched or unwatched moves the title to the
shelf that matches the saved progress. While its details are open the card
stays where it was, so the details stay open; the grid catches up when they
close. Watched marks change only after the save succeeds. If a save
fails, an error toast appears and the existing watched marks stay unchanged.

Details open in the side inspector, or a sheet on narrower or shorter screens:
the poster and information (including the regular season count for series in the
subtitle line, and series production status alongside the streaming platform and
personal watch status in the top badge row) sit above the season picker and its
episodes, and the panel scrolls as one. It opens on the first regular season not fully watched, or the last season once all are. Completing a season shows the "Finished season N — rate it?" prompt if unrated, then automatically advances to the next unwatched regular season once rated or skipped (or immediately if already rated). Delete asks for confirmation.

**Both views:**

- Provider search links (via platform) — a search URL, not a deep link
- Streaming platform recognition with logos (including `NOW`, `Paramount+`, `Channel 4`, and `Crunchyroll`)
- Status, episode, season and platform refreshed from TMDB on a daily
  server-side schedule, so the data is current whether or not anyone has the
  page open — and on demand from the page itself
- Trailers: a title's details have one trailer button. For a show it plays the
  selected season's trailer — at first the season you are on, then whichever
  season you pick — or the show's when that season has none of its own, and
  for specials. With neither, there is no button. The trailer plays in a
  dialog in YouTube's privacy-enhanced player, which loads only once the
  button is pressed, with a link to open it on YouTube. The sync picks each
  trailer, English or without a language, trailers before teasers, official
  first, newest first; a title added by hand has its trailer at once
- Credits: a title's details show who made it ("Directed by" for a film,
  "Created by" for a series) and "Starring" with three lead actors — a film's
  top-billed cast, a series' actors in the most episodes across all seasons.
  Over three directors or creators read "and N more". A title added by hand
  has its credits at once; the rest of the library fills from TMDB over the
  nightly sync, a few hundred titles a night, and a title's Resync refreshes
  its credits. A title TMDB lists no one for shows neither line
- Scores: a film's or series' details (and TMDB previews for titles outside
  the library) show score chips with colour-coded badges or icons for the
  owner's rating (`My score`), IMDb rating and vote count, Rotten Tomatoes
  Tomatometer (fresh or splat tomato icon), Metacritic score, and TMDB rating
  and vote count. IMDb, Rotten Tomatoes and Metacritic come from OMDb through
  the nightly sync, which refreshes a few hundred titles a night, oldest first;
  a part OMDb does not have is left out, and nothing shows until the sync has
  reached the title. Rotten Tomatoes and Metacritic are often missing for
  series and for older or foreign films. The TMDB score is stored on the title
  when added and refreshed from TMDB by the nightly sync alongside IMDb, Rotten
  Tomatoes and Metacritic (falling back to the live TMDB record when not yet
  stored). Seasons have no outside score.

**Sync:**

Watchlist sync runs server-side every night in three parts, ten minutes apart
from 06:00 UTC, each covering a third of the library, and checks every active
film collection on TMDB for newly dated upcoming sequels so Discover's Coming
soon catches them across the whole library; the sync-history panel
labels each part and flags a part that logged nothing as missed. Manual
full-library syncs are limited to one per 10 minutes; syncing a single title is
limited to 20 per minute. Bank transaction syncs are limited to one per 15
minutes. Sync buttons on the Watchlist,
Dashboard and Bank Accounts pages show "Next sync HH:MM" during the cooldown
window and are disabled until the next sync is allowed.

**Diary and Year in review** (`/watchlist/diary`, public):

- **Diary** lists watches by local day, newest first. A show's episodes watched on one day collapse to a range such as "S2 E1–E4". Each day totals its runtime, "at least" where a runtime is unknown. It shows 60 days at a time. Watches with no date are counted but not listed. The owner can edit a row's date or set it to unknown.
- **Year in review** shows time watched, episodes, films, series and days, a 12-month chart, top series, genres, where the titles stream now, the busiest day, the longest streak, and the top-rated films and seasons. Only dated watches count. Scores are shown to visitors read-only.

**Franchises** (`/watchlist/franchises`): the owner's viewing orders, with films and series in any order, a note on each entry, reordering up and down, and titles added from a TMDB search or added to the library (or marked `Seen it` with a watch date) when missing. Connected TV series and spin-offs discovered from the TV library (via Wikidata `P2512` spin-off relationships through `tmdb-proxy`) and TMDB film collections found in the library are listed in release order and can be saved as a viewing order. Undated instalments — film collection parts with no release date and non-library TV spin-offs with no air date — are excluded from Franchises and saved viewing orders unless already in the library. Each shows "N of M watched" and the next title up. Shared film universes, such as the Marvel Cinematic Universe (found via Wikidata `P179`, through `tmdb-proxy`), appear on Franchises alongside Film Series (as well as on Discover), folding any covered sub-collections into the universe card and allowing them to be saved as viewing orders. Separate TV spin-off chains sharing a franchise merge into one card, and a `Largest` / `A–Z` sort toggle (defaulting to `Largest`) surfaces the biggest franchises first. A title you marked `Not interested` in Discover stays in its place with a dimmed poster and a `Not interested` label instead of `Not in library`. The search box covers every film collection in the library, matching a collection's name or any film title in it, not only the collections loaded so far.

**Import history** (admin, from the Diary header) reads Letterboxd CSV exports (diary, watched and ratings; watchlist and likes are skipped, and only "Watched Date" is a watch date) and Trakt JSON. Each title is matched to the library and to TMDB, paced to the proxy's limit. A review list comes before anything is saved: library matches are ticked, new titles are not, unsure matches can be picked, a Trakt rating with no watch is unticked, and titles not found or failed lookups are listed. Saving adds the ticked titles and writes their watches and ratings. An earlier watch date already stored is kept, and an existing rating is never overwritten.

## Travel

Countries and cities visited, rendered as maps by continent and by city, with
membership and region groupings.

On screens 640px wide and up, the flat map has a projection menu on its label. The choices are Equal Earth (the default), Winkel Tripel, Robinson and Mercator, and each shows a line on what it keeps and what it gives up. The choice is remembered in the browser. Mercator is cut at 84°N and 60°S, so Antarctica and anything reaching past those latitudes is left off the flat map. Switching keeps the same place in the middle of the view. Hovering and clicking pick the hex under the pointer in every projection. The globe is the same whichever is chosen. On a phone the menu is not shown, and the flat map is drawn in the remembered choice.

At 1024px wide and 600px tall, the map sits beside the country list, which scrolls on its own. On a screen 2200px wide and 600px tall or taller, unless the wide layout is set to centred, the list keeps a fixed width and the map fills the rest of the row. Narrower or shorter, the map sits above the list in one scroll. Stacked, the city list's header scrolls with the list. Each country row keeps its UN marker and city count in fixed columns, so they line up down the list whether or not a row has either.

Stacked, on a phone or a short window, each continent folds to one row showing its flags, and opens on tap. On a phone the flat map fills the height of its box and drags sideways. While the map is not zoomed in, a vertical swipe over it scrolls the page. A legend on the map says what gold means: Visited and Not yet, or in the Cities view City and Country, where visited countries are tinted. Country borders are drawn clearly at every zoom. A selected city is shown as its dot in green, at the size it would have anyway; a place too small for a dot of its own, such as Gibraltar, lights its grid square's dot instead.

The page has two tabs. Places shows the visited map and the country list. Search matches every country and territory by name or code, marks each result "✓ Visited" or "Not visited", and opens that country's details when chosen. A search with no match says the visited map is unchanged.

Choosing a country turns the 3D globe to it and zooms in, or pans and zooms the flat map, and the view holds there while the country stays selected. Opening a city's journal turns closer to that city and shows its dot in green. Countries and cities too small for a dot on the map are still turned to and marked the same way, and going back zooms out. After about twelve seconds untouched with nothing selected, the globe slowly starts turning again, where WebGL2 is available.

The globe and flat map draw their cells and borders with WebGL2, so drag, zoom, spin and the morph between the two are run on the graphics card. Where WebGL2 is missing, or the browser drops the graphics context, they draw with canvas 2D instead, and that fallback does not idle-spin. The map redraws only while something is moving (a drag or its momentum, a zoom or focus ease, the morph, the idle spin), and it stops while it is scrolled off screen. Hovering or clicking picks the exact hex under the pointer; over the sea, a small island within about 8 px is picked too.

On the WebGL2 path the sea has its own colour, a soft blue (navy in the dark theme), and every land hex sits on a solid ground colour (cream, or warm grey in the dark theme), so land and water read apart and the sea never shows through the land. On the globe the sea is a disc, lighter towards the middle; on the flat map it fills the projection's own outline. The two cross-fade as the map turns between globe and flat.

On the WebGL2 path, zooming in on the globe or the flat map swaps the hexes for finer ones, unless a size is held (see below): about 120 km across at the start, then about 45 km, then about 17 km. Which size shows follows how large a hex is on screen, not the zoom number. The map is cut into large patches and each one changes size on its own, so only the part you are looking at gets the finer hexes. A finer patch is prepared in the background and fades in when it is ready, and until then the coarser hexes stay. Zoom goes up to 32×. Dragging the globe turns it less the further in you are, and the idle spin slows the same way, so the land stays under the pointer. Hovering, selection and visited-city hexes follow whichever size is showing. Each hex belongs to the country that covers most of it, so a narrow country stays joined up, and every country keeps at least one hex at every size. Siachen Glacier, which has no country code, is left off. Where WebGL2 is missing, the canvas 2D fallback keeps the 120 km hexes.

On screens 640px wide and up, the bar under the map has − and + buttons that zoom out and in about the middle, and a readout of the hex size on screen, such as "45 km", or "45 km · held" when a size is held. Its menu offers Auto (the zoom chooses, as above), and 120 km, 45 km and 17 km, each held at any zoom. The 17 km hexes only show once they are large enough, so choosing it zooms in to where they show; until then the readout says "17 km · zoom in" while 45 km stands in. A held size never loads a finer level than itself. The choice is remembered in the browser. The size menu and its readout need WebGL2; the buttons do not.

Over the globe, a padlock button in the same bar holds the globe still for two minutes: it stops the slow idle spin and the drift back to level, then lets go by itself, or sooner on a second press. Dragging and zooming still work while it is held. Once hexes are about 6 px across or more, the hex under the pointer is outlined, so a name on hover plainly belongs to that hex.

In the city view, hovering lights only the hex under the pointer, with an outline; the country around it stays unlit (on the country view, hovering lights the whole country). Hovering a hex names it: its largest town with that town's own state, such as "Kano, Kano State"; with no town of its own, the nearest town of the same country a hex or two away, such as "near Parakou, Borgou" (about 35 km for the 17 km hexes, 45 km for the 45 km ones, none for the 120 km ones); or else the state or province and the country, such as "Borno State, Nigeria". Towns are every place of 1,000 people or more in GeoNames, credited with a "Places: GeoNames" link beside the legend in the city view. A town that is its own state, or a state with its country's name, gives the country instead. Only towns of the hex's own country are used, so a hex on a border never names a town across it. Overseas territories split from their sovereign, such as French Guiana, have no state names and fall back to the plain label. The city view does not add VISITED to these names: the tint shows a visited country, and a hex holding a visited city still lists those cities. The state and town names load the first time the city view needs them, for the hex size showing.

For the owner, a country's details also show the flights flown and planned through its airports, its three most used airports with their counts (and how many others), and the first and latest flight dates. Cancelled flights are not counted. Airports are matched to countries from a built-in list that includes closed airports, such as Berlin Tegel. Only a flight's airport codes are matched; a place typed by hand is never read as an airport.

Trips & memories lists published trips for visitors, each with its dates, status, notes, city stays, linked memories and unassigned itinerary items. Search covers trips, cities and memories. The unassigned list folds to one line giving its flight count and first and last year; opening it shows rows grouped by year, oldest first, and typing a search opens it. A trip's itinerary uses the same one-line rows. Choosing an item opens its details in the side panel, or a sheet on a phone: departure and arrival with date, time and zone (or "local time" where the zone is unknown), from and to with the airport's country where it is known, the trip, status and notes. The owner also sees visibility and source, and assigns, edits or deletes the item there.

The owner adds, edits and deletes trips (title, dates, planned, completed or cancelled, notes, published or private), city visits, memories, favourites and photos. Choosing a city opens its city journal in the side panel, with Overview, Visits, Favourites and Photos tabs. Its visit count includes only confirmed visits: transit and planned visits are left out, and so are visits on planned or cancelled trips. A city marked visited before any dates were recorded, with no counted visit, reads "Visited · dates not recorded".

Photos are JPEG, PNG or WebP, up to 20 MB. Each is resized to at most 2,400 px on its longest side, saved as a JPEG, and uploaded with its metadata stripped. A city has one cover photo. Photos stay private until their memory is published.

The owner imports itinerary from a Flighty CSV, a structured itinerary CSV or an .ics calendar file (up to 5 MB and 2,000 rows). The review lists rows in date order, and the owner chooses which to save and sets each one's status, or marks every selected row completed at once. Everything is saved private, and flight records create no city visits. On a re-import, rows already saved and unchanged are hidden: the summary counts them, a button shows them, and a file with nothing new says so. The status chosen at review is kept and is not read as a change; a journey newly cancelled at its source is, and is labelled as cancelled at source.

Backup & restore is owner-only. A complete archive holds the resized photos (up to 60 MB); a metadata-only export lists photo paths without image files. Both cover up to 10,000 records. Restore adds the records with their publication settings and refuses any record whose ID already exists.

Visitors receive only published trips, visits, memories and itinerary items. Flight records stay private, and the source identifiers of imported bookings are never sent to visitors.

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

## Private API status

The private `/dev` page shows what each external API is doing now: OK, slow, near
its limit, some errors, rate limited, timing out, failing, or no calls yet. Status
is judged from each API's latest burst of calls, not from a fixed time window, so
an API that is called once a week still reads by its last calls. Each API shows its
last call and its last problem (when, the result and the endpoint), its request
timeout, and its limit. TMDB's limit shows the calls used this minute and when the
window resets.

A History button, on the page or on one API, opens calls over the last 1h, 24h, 7d
or 30d, bucketed into 5 minutes for 1h, hours for 24h and days for 7d and 30d, and
split into OK, rate limited and error. Overview also lists the busiest endpoints,
and Call log lists recorded calls. The API and range filters apply to Overview and
Call log. The This tab view lists the latest 30 calls this browser tab made, with no
filter.

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

Recurring payments are suggested from repeated spending at the same merchant and account in imported bank records, without an AI key. Weekly, quarterly and quarterly patterns need at least three payment dates; annual patterns need two. Suggestions show their payment history and latest amount, and flag older patterns as possibly stopped. Review each suggestion to confirm whether it is active and when you last paid, or dismiss it as not recurring. The confirmed payment date stays separate from the latest payment seen in bank records. You can add bills manually, edit them, and restore inactive or dismissed entries. A payment dismissed as not recurring stays out of suggestions until you choose to show it as a suggestion again. Only active bills contribute to recurring totals. Adding, editing, deleting or marking a recurring bill paid leaves bank balances unchanged.

Paid is decided per period: a month, quarter or year, labelled by the bill's due date. A bill shows Paid only when a recorded payment covers the current period, so a bill ticked before any payment date was recorded shows Unpaid until it is ticked again. Marking a quarterly, quarterly or annual bill paid records the period the payment covers, so a late payment for last month does not mark this month paid. A tick never covers the next period. Marking the bill unpaid returns that period to unpaid. Weekly bills count as paid for a payment made in the last seven days, today included.

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

A transaction added by hand is dated the day chosen in its date picker, read in the browser's local time, and "today" is the current local day.

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

**Cash flow** — income, spending and net come only from recorded transactions, with confirmed transfers left out; recurring bills are not added on top. The detail drawers list each year in the chosen period with that year's total and quarterly average. "Where it went" shows the period's income flowing into spending categories (top five payers and top eight categories, the rest grouped as "Other"), with what was kept or drawn from balances; below tablet width it shows as a table, and on wider screens the table is one click away.

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
  total owed, quarterly total and a debt-free year. One row per debt with balance,
  clear year and share repaid. Projections step forward from verified anchors
  rather than a floating balance; rate periods and PCP balloon payments are
  modelled. Drift against a real statement resolves to an implied annual
  interest rate through a numerical solver. Inline balance recording with a form
  showing the expected balance on that date and the gap against the actual
  statement
- **Student Loan** — SLC charges Plan 2 interest at RPI during the tax year; the
  income-linked part accrues quarterly and lands in a later month (typically 6
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
  interest rate, quarterly payment and repaid-so-far. Totals: total repaid,
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
  local currency for each city. Each city has eight quarterly budget categories
  (housing, utilities and connectivity, groceries and household goods,
  transport, healthcare, leisure, local taxes and household charges, and other
  commitments); blank costs stay unknown and an explicit zero means no cost.
  Complete budgets show quarterly surplus or deficit, the difference against the
  baseline, housing share of take-home (blank when salary is zero or missing)
  and the largest quarterly cost category (blank when all costs are zero). Each
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
  estimate, not quarterly withholding. The Netherlands uses 2026 Belastingdienst
  tables for income brackets and the general and labour tax credits, with the 8%
  holiday allowance included in gross; the 30% ruling and occupational pension
  are not modelled. Each calculated card lists that jurisdiction's own quarterly
  deductions and offers a `Use my own net figure instead` switch. Every other
  city takes a quarterly net figure you enter for the shown gross; changing the
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
  and 10,000,000 a year in the destination's currency that funds the destination's quarterly basket and matches
  the baseline's surplus, with the baseline surplus converted at the rate
  snapshot. It reports when the answer falls in a band the calculator does not
  model, when it is outside the bound, when no gross reproduces the surplus
  within 0.005 a month, or when the destination needs calculated pay. It also
  states when a gross of 0 already leaves a smaller deficit than the baseline.

  Each city card with a complete budget shows a collapsible housing sensitivity
  breakdown: break-even quarterly housing cost (take-home minus non-housing
  costs), the destination housing cost that matches the baseline's quarterly
  surplus at the current exchange-rate snapshot, and ±10% / ±20% housing cost
  cases holding non-housing costs constant, each with its resulting quarterly
  surplus or deficit and housing share of take-home. Each city card also
  provides a collapsible upfront relocation cash & deposit calculator that
  separates refundable deposits tied up (tenancy deposit and other utility or
  key deposits) from one-off consumed moving expenses (visa and legal fees,
  travel and shipping, agency and admin fees, and initial setup and furnishing),
  showing total upfront cash required and how many months of positive quarterly
  surplus — and on non-baseline cards, how many months of positive quarterly
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
  Budget items into the baseline city's eight quarterly cost categories, with
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
- **Payslips** — stored with optional line items and viewable natively, with summary
  figures extracted from PDF in the browser. A PDF attached in the add or edit form is read and parsed before
  saving; the date, employer and any blank or zero fields are filled from the PDF
  and employer logos matched from experience rows. Payslips can be deleted from the
  detail or edit dialog. Totals group by tax year (the default), calendar year or employer, each group with
  its own sums. The four headline figures cover the newest tax year, the newest
  calendar year, or all time when grouped by employer, and are labelled with that
  scope. A student loan line, always for the newest tax year, sets the year's
  deductions against what each payslip's own pay owes: the plan's rate on the pay
  above a month's threshold, after salary sacrifice, rounded down to whole pounds.
  The full history shows in the page, without a scroll box of its own. The list
  gives take-home prominence in the headline cards. Each group has a heading
  with its earned and take-home totals, followed by full-width payslip rows
  showing the date, employer, gross and take-home without clipping the gross.
  In tax-year and calendar-year groups, a matched employer logo appears beside
  the employer name; employer groups show it in their heading. Rows label bank
  matches and archived PDFs beside the figures.
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

  A year switcher allows viewing and planning any current or future leave year with UK bank holidays (including deterministic future-year calculation and weekend substitute bank holidays) and UK (`en-GB`, day-first, Monday–Sunday) date formatting throughout. The tracker always opens on the current calendar year. The year chevrons and the Plan Full Year shortcut change only the year on screen. The tax year saved in Settings, which also sets the weekend and bank holiday counts behind the pay rates, changes only in Settings. Bank holidays for the year on screen follow the profile's region: UK bank holidays are stored in Supabase and refreshed quarterly from gov.uk, so the saved year reads from that table (falling back to deterministic calculation), and any other year is calculated for that region. Future years carry a note that these dates follow the usual rules and may change for one-off holidays or new rules.

  The Optimal Leave Maximiser opens in January to plan the full year and defaults later in the year to optimising remaining upcoming leave with long-weekend and 9-day week stretches alongside remaining bank holidays. It includes a shortcut to plan the next leave year, combining remaining annual leave allowance, UK bank holidays, and the Birthday Day Off (when enabled) to recommend the highest-leverage leave bridges. Selectable biases include Balanced, Long Christmas, Long Easter, and Summer Focus. Christmas bridges offer three tiers: Tier 1 · Efficient Bridge (Twixmas), Tier 2 · Balanced Stretch (pre-Christmas working days + Twixmas), and Tier 3 · Ultimate Shutdown (full Christmas week + Twixmas); Easter offers Tier 1 · Pre-Easter 4-Day Bridge, Tier 1 · Post-Easter 4-Day Bridge, and Tier 3 · 16-Day Easter Shutdown. Each bridge shows exact dates to book, leave spent, consecutive days off, and return-to-work date, with one-click booking for individual bridges or the full recommended plan. When no chosen bridge captures the Birthday Day Off, a standalone 1-day Birthday Day Off Break is recommended. Recorded sick days are excluded from suggestions and do not consume annual allowance. The Maximiser lists up to five bridges inline; with more, it lists the recommended ones and a button reveals the rest. Allowance no bridge can use is spent on the working days that lengthen a break already in the diary — booked leave, a recommended bridge, or a bank holiday — choosing the day that leaves the longest break (for example, the day before a booked Christmas break), and is bookable with the rest of the plan. Allowance that still fits nowhere is flagged as having no better bridge, to use anytime; when no bridge is left at all, the collapsed Maximiser says so instead of showing a 0d plan.

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
Expense reimbursement lines can be entered against an existing payslip when
its PDF did not capture that detail. For each clearly labelled payment line,
the page suggests penny-exact spending from the preceding 120 days; a person
confirms the link. One expense can be linked to one reimbursement line, and a
confirmed expense is marked in the transaction ledger. Changed line or expense
details cause the confirmation to show as needing review. These controls appear
when the reimbursement link table is available.

---

## Interactions

The theme toggle switches between light and dark mode. The sun and moon each
rise from the right and set to the left over 700ms. Supported browsers crossfade
the page between palettes over 350ms; other browsers switch the palette immediately.
The moon rises smoothly into place without overshooting. Reduced-motion
preferences skip the animation.

Finance charts draw their grid lines, axes and reference lines in the current theme's colours.

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
