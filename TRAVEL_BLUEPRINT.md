# Travel — a personal atlas

Status: implementation blueprint, written 9 November 2026. Slices 1–6 have code on `main` (journal tables, import, photos, backup); what remains is tracked in `REHAUL_PLAN.md` §8.F. *Current baseline* below describes the site before that code, kept as the starting point the rules were written against.
Base: written against `feat/redesign-phase0` at `512873d2`, since merged. Preserve its look, shell, fonts, globe, surfaces and responsive inspector.
Planning authority: this is the detailed specification linked from `REHAUL_PLAN.md` §8.F; amend both if the direction changes.

## Product direction

Travel should answer: Where have I been? When was I there? What did I love? What do I want to remember next time?

The globe is the overview; the third column becomes the personal journal for whatever is selected. Trips connect places over time. Cities collect memories across trips. Flight imports supply evidence and save typing, without deciding which places count as visits.

Keep the visual character of phase 0. Use one strong map, quiet readable panels, existing tokens, Doto and Space Mono. Photographs bring warmth and personal character. Do not add more decorative telemetry or crowd the page with statistics.

## Current baseline

- `src/features/travel/TravelPage.tsx`: globe, visited countries and cities, continent grouping, counts, country drilldown and admin add/remove controls.
- Country selection feeds real country metadata into the third-column workspace inspector. It is not yet a city journal or trip editor.
- The add-country search explicitly excludes visited codes. This explains why previously visited matches disappear.
- `src/contexts/WorkspaceInspectorContext.tsx` and `src/components/layout/WorkspaceInspector.tsx` already provide selected-record and richer docked-detail interfaces; extend these instead of introducing another panel system.
- Existing visited-place records do not establish dated repeat visits. A saved city must not be presented as a verified number of stays.

## Page composition

| Area | Default | After selection |
|---|---|---|
| Left shell | Existing navigation | Remains stable |
| Main workspace | Globe/map, compact coverage summary, Places / Trips switch, searchable place list | Selected country/city or trip highlighted; route shown only for a selected trip |
| Third column | Invitation to select a place; latest published memory when available | Country overview, city journal, or trip itinerary |

Within the main workspace, avoid duplicating a full country/city list in the inspector. The list is for finding; the inspector is for understanding and editing.

Country inspector: country name and visited state, visited cities, recorded trips, cover photograph and published highlights. Keep classification details secondary.

City inspector, in reading order:
1. Name, country, chosen cover photograph, personal one-line description.
2. Confirmed visit count and first/last recorded visit, with unknown dates clearly stated.
3. Overview / Visits / Favourites / Photos. Overview combines a short note, three favourites, a small photo strip and the latest visit.
4. Related notes, books, recipes or other existing records with confirmed links.
5. Admin actions: Add visit, Add favourite, Add photos, Edit city note.

Trip inspector: title, status, date range, ordered stops and a dated itinerary. Flights, train journeys, hotel stays and activities appear in day order. Expand to a full-width trip view for longer itineraries; do not force editing into a narrow rail.

On phones, reuse the existing selection sheet and offer a full-page trip/album view. Retain search, scroll and selection when returning. Keyboard users can explore through the list without operating the globe. Honour reduced motion and provide a static map/list fallback.

## Country search: requested behaviour

- Search all country names and ISO codes, trimming whitespace and matching case-insensitively. Keep matching visited countries in the results.
- Visited match: muted background, readable text, checkmark and explicit **Visited** label. Selecting it opens its details; it never re-adds the country.
- Unvisited match: normal result with **Not visited** label; selection opens details. A separate admin action marks it visited.
- Keep the full visited map layer visible while searching. Highlight the selected/matching country without erasing the rest of the travel history. Nonmatching visited places can be subdued, but remain distinguishable from never-visited places.
- Clearing search restores the list without changing any records or counts. A no-match state still leaves the visited map intact.
- Search is navigation for visitors as well as admins; mutation controls remain admin-only.
- Stable alphabetical results, exact matches first; show more results if capped. Labels and keyboard focus must communicate status without depending on colour.

## Records and counting rules

These are conceptual records, not an approved database migration.

| Record | Responsibility |
|---|---|
| Place | Stable city/country identity, coordinates, personal description, cover and visibility. City identity includes country/region; names alone are not unique. |
| Trip | Named journey with planned/completed/cancelled status and optional date range. Can contain multiple city visits and transport legs. |
| Visit | One confirmed stay or excursion in one city, optionally linked to a trip, with arrival/departure dates and date precision. Supports day visits and unknown historical dates. |
| Transport leg | Flight/train/other journey, origin/destination, local times, time zones, status, source identity and optional trip association. |
| Itinerary item | Activity or accommodation, date/time or all-day range, place, notes and source. |
| Favourite | Named place or experience, category, personal reason, optional location/link and visit association. |
| Photo / album membership | Existing media record linked to city and optionally visit/trip; cover selection, ordering, caption, alt text and publication state. Reuse the media rather than copying it per album. |
| Source / import batch | Import format/version, source identifier, review outcomes and links to accepted records. Supports duplicate detection and a clear audit trail. |
| Relationship | Explicit typed link between existing records: visited during, photographed in, favourite in, mentioned in. |

Rules:
- Count confirmed visits, not flights, photos or itinerary entries. Connecting through an airport does not count as visiting its city or country.
- A weekend with multiple activities is one city visit. Leaving a city and returning for a separate confirmed stay can be another visit, even within the same trip.
- Planned and cancelled trips do not increase historical totals. Passing a scheduled date does not prove the journey occurred.
- Imported flights propose visits; the owner confirms city mapping, transit vs stay and grouping. Airports may serve several cities, and a destination airport does not prove the actual destination city.
- Preserve legacy visited flags as undated history. Show “Visited · dates not recorded” until visits are entered; never fabricate a first visit, date or exact total. Where history is incomplete, label the figure “2 recorded visits”, not “visited twice”.
- Keep local calendar dates separate from instants. Flight times retain their airport time zones; never infer arrival date from departure date or calculate durations from timezone-free strings.
- All counts and dates are deterministic derivations covered by tests. Public counts derive only from public records; private trip/album totals must not leak through badges.
- Removing a historical flag must not silently cascade-delete flights, photos or confirmed visits. Decide and preview the affected records in the later migration/editor design.

## Flighty and itinerary imports

First release: **Import → Flighty CSV → Review → Save**. File import is feasible; a live Flighty account/API integration is not verified and is not a dependency.

Evidence checked 9 November 2026:
- [AirTrail's import documentation](https://airtrail.johan.ohly.dk/docs/features/import) documents importing Flighty exports. This supports the file-import approach, not a guaranteed schema for the owner's current export.
- [Flighty's calendar export documentation](https://flighty.com/help/calendar-export) says it updates flight calendar events as flight details change. Events can contain reservation/seat information and friends' flights. Calendar export must therefore be treated as sensitive and must not automatically count every event as the owner's travel.

Before implementing the adapter, use one representative owner-supplied CSV with sensitive fields removed to confirm headers, identifiers, time semantics and status fields. Menu locations and exact export columns remain unverified. Unknown fields/formats produce reviewable errors rather than silently dropping flights.

Import flow:
1. Parse locally in the browser, with file/row size limits, schema validation and safe text rendering. No document is sent to a model.
2. Preview extracted dates, airports, flight numbers and status, plus warnings for missing/ambiguous fields. Preserve the source of each proposed fact.
3. Match existing legs by stable source identifier where supplied; otherwise propose matches from airline/number, origin, destination and departure date. Ambiguous matches require review.
4. Show New / Already imported / Changed / Needs review / Rejected rows. Re-import is idempotent; changes never overwrite owner corrections silently. Report every skipped row and why.
5. Propose trip groups and city stays. Let the owner split/merge trips, mark layovers and confirm city mappings. Flight dates cannot determine accommodation, activities or complete city stay dates.
6. Save only confirmed rows, validate again at the write boundary and show a result summary. Batch writes must be atomic or explicitly resumable without duplicates. Undo removes only unchanged records created by that batch and previews shared dependencies.

Follow-on formats, in order:
- `.ics` calendar file: flights and activities with timezone, all-day, UID/update and cancellation handling. This is a snapshot import, not live sync.
- Structured itinerary CSV and manual entry: trains, accommodation, activities and missing historical trips.
- PDF itinerary: browser text extraction, layout templates for recurring providers, OCR only for images; review before saving. Unsupported layouts remain downloadable attachments with manual entry. Do not promise universal PDF understanding.
- Email forwarding, mailbox access, calendar subscriptions and live flight tracking are deferred until a specific need and provider capability are established.

## Favourites and city albums

Favourites should capture personal judgement: “What I liked” and “Would I go back?” alongside category (food, coffee, walk, museum, stay, experience). Support a short list of top picks rather than building a public ratings service. Link a favourite to the visit where it was discovered when known.

Every city has an album view combining its published photos, filterable by visit/trip. Choose a cover and image order; clicking a photo opens a keyboard-accessible lightbox with caption and linked visit. Trip albums reuse the same media. Empty states invite an upload and never show stock photos as personal memories.

Generate thumbnails and load full images on demand. Validate uploads by content, use generated storage identifiers, and explicitly review public derivatives for metadata removal. Do not expose EXIF location, private originals or original filenames through public delivery. Existing photo storage and access rules must be audited before reuse.

## Personal index and backup

Model the links first: City → Visit → Trip, Photo → City/Visit, Favourite → City, Note → Trip/City. These records are the source of truth; the search index is rebuildable.

Useful queries include “my favourite coffee places in Lisbon”, “photos from my second Tokyo visit” and “cities I returned to”. Return linked source records, with missing dates/history acknowledged. Lexical search, filters, counts and navigation work without an API key. Optional semantic retrieval may improve discovery; a model may phrase results but never invent links, compute visit totals or infer a visit from a photograph.

Publish explicitly: new imports, upcoming trips, booking documents and photos start private. Public visitors see only deliberately published places, memories and approved summaries. Public source queries, search indexes, related links, counts and media delivery must enforce this separation before data reaches the browser. Booking references, traveller details, addresses and source documents never enter a model projection.

Backup means more than exporting embeddings: provide a versioned export of canonical records, stable IDs, relationships, visibility, import provenance and media manifest, with a separate option to include actual photo/document files. Restore must preserve links and visibility, detect missing media, validate formats and be tested in isolation before relying on it. An index can be rebuilt from this export; an index alone is not a backup.

## What makes it distinctive

1. **A city that remembers you:** a return visit reveals previous favourites and a “last time here” note, based on saved history.
2. **A visual travel timeline:** a year/trip filter highlights routes while keeping lifetime visited places faintly visible. Clearly distinguish filtered counts from lifetime counts.
3. **A personal postcard:** chosen photograph, a short memory and visit context; an explicit public preview controls what gets shared.
4. **Connected memories:** a recipe tried there, a book read on the trip, a note written afterwards. Confirm the links and show why each item is related.
5. **A quiet return list:** “Go back for…” tied to a city. Useful even when no next trip is planned.

Prioritise the city journal and photographs before distance leaderboards, airport badges, carbon estimates, automatic travel recommendations or more map effects. Passport/visa reminders from the earlier plan remain deferred; they are not needed for this atlas release.

## Delivery sequence and acceptance

| Slice | Deliverable | Acceptance |
|---|---|---|
| 1 | Country search and selection | Visited matches remain visible and openable; no duplicate insert; clearing/no-match preserves map history; keyboard and mobile work. |
| 2 | Trips, confirmed visits and city journal | Manual dated/undated visits persist; repeat stays count correctly; layovers/planned trips excluded; legacy history retained; public/private read boundaries verified. |
| 3 | Flighty import | Real representative export fixture parses; timezone/date edge cases, duplicate re-import, changed records, rejected rows and owner overrides tested; preview never writes. |
| 4 | Favourites and photo albums | City/trip views share media; published derivatives are safe; private images inaccessible anonymously; lightbox and lazy loading verified. |
| 5 | Itineraries | ICS and structured/manual itinerary entry work; PDF templates follow only when real documents justify them. |
| 6 | Related memories and portable backup | Source links work without models; private records do not enter public search/counts; export/restore round trip preserves relationships and media. |

For code slices: run project-required lint (0 errors/warnings), app and function typechecks, build, ship-check and graphify update; test relevant deterministic calculations and import/access boundaries. Verify desktop light/dark, phone widths and keyboard operation. Schema changes require migration delegation and review under project rules.

The Flighty adapter was built against the owner's own export (synthetic rows with the same columns in `journal-import.test.ts`). That export carries no time zones, so imported flight times stay local to each airport.
