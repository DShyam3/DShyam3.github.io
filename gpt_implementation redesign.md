# GPT implementation plan — personal workspace redesign

Prepared: 8 November 2026.

Status: proposal for review. Creating this document does not authorise implementation, deployment, new integrations, or changes to the existing architectural rules. No redesign code has been implemented as part of this plan.

## 1. Purpose

Evolve the existing personal website into a connected personal workspace for iPhone, iPad and MacBook. A prominent conversational interface helps find, explain and navigate information across life domains; dedicated pages remain complete tools for browsing, editing and recurring tasks.

The underlying objective is a trustworthy personal information system: structured records, explicit relationships, source evidence and useful retrieval. The interface makes those records accessible through conversation, pages, maps and timelines.

Preserve the current calculations, integrations and data wherever practical. Deliver incrementally instead of replacing the whole application at once.

### Relationship to existing project documents

- `AGENTS.md` continues to govern all implementation and delegation.
- `REHAUL_PLAN.md` remains the authoritative existing backlog. This proposal does not silently supersede its decisions.
- `DESIGN_SYSTEM.md` remains the current design contract until a new direction is accepted and recorded there.
- `FEATURES.md` describes implemented behaviour only; nothing proposed here belongs there yet.
- `REHAUL_HISTORY.md` receives decisions when they are actually closed.
- `STATE.md` remains the short operational handoff, not a copy of this plan.
- Before implementation, reconcile this proposal with the existing plan and assistant branch. Avoid maintaining two competing implementation backlogs.

## 2. Proposed delivery strategy

Build one adaptive web application, with an installable progressive web app (PWA) experience. Keep ordinary URL access available. Preserve a deliberate public website alongside the authenticated private workspace.

This is the recommended direction from the exploratory discussion, not an irrevocable platform decision.

### Why start with the web

- Reuse the existing React, TypeScript and Vite application.
- Support iPhone, iPad and MacBook with one product and shared components.
- Keep links, browser access and deployment straightforward.
- Offer Home Screen and Dock launch experiences on supported Apple systems.
- Keep the data and application services independent of the presentation layer so a native companion can be added later.

### When to revisit native apps

Reconsider a native companion when an agreed workflow needs capabilities such as Apple Health integration, system widgets, share extensions or substantial device-level capture. Validate each required platform capability before choosing a wrapper or native implementation.

A native wrapper is not a substitute for adaptive layouts, accessible controls or offline architecture. Native background execution also has platform constraints.

### Initial scope exclusions

- Separate native iOS, iPadOS and macOS applications.
- App Store distribution.
- Email, calendar, health and other new external-source integrations.
- Autonomous financial actions or payments.
- Arbitrary SQL, arbitrary tool execution or model-selected external endpoints.
- Always-listening voice, continuous location tracking or background surveillance.
- Custom 3D scenes on every page.
- Full offline editing across all domains.

Each can be scoped separately if it becomes necessary.

## 3. Reference direction

Borrow composition and interaction principles, while designing original assets and a coherent identity for this site.

| Reference | Useful qualities | Application |
|---|---|---|
| RivianOS 2 attachment | Legible metrics, tactile cards, friendly controls and restrained personality | Daily overview and quick actions |
| Tesla tablet/foldable UI | Controls beside a dominant visual; layouts adapted to available space | iPad and Mac workspace composition |
| VVD World | Entries, maps, relationships and wiki-like exploration | Connected personal records |
| Anduril EagleEye / Lattice | Contextual information and a shared operational picture | Status, selection and supporting details |
| Helsing Altra | Multiple sources presented in a coordinated workspace | Cross-domain overview and contextual panels |
| Shield AI Hivemind | Operator-oriented coordination of capabilities | Interaction inspiration, not an autonomy implementation |
| Treasury software | Precise values, reconciliation, overview-to-detail navigation | Finance and evidence inspection |
| ChatGPT-style interaction | Familiar conversation and continuity | Ask, explain, find and open a working view |

The first supplied image is RivianOS 2, not Tesla. The exact treasury product is unresolved. EagleEye is the likely helmet reference; confirm if a different Anduril interface was intended. Public product materials do not establish the full behaviour of operational defence software.

### Proposed visual language

- Retain the site's dot-matrix identity.
- Use graphite and light neutral surfaces with restrained domain accents.
- Use clear sans-serif text for reading and tabular numerals for figures; reserve monospaced labels for appropriate instrumentation.
- Give each view a clear focal point and attach supporting controls to it.
- Use subtle borders, grid marks and depth selectively.
- Keep light and dark themes equally usable.
- Show colour-coded status with accompanying text or symbols.
- Use meaningful transitions and respect reduced-motion preferences.
- Avoid decorative telemetry, unreadable labels and empty panels added merely to resemble a cockpit.
- Use maps and spatial graphics where location or relationships matter; retain conventional reading and table layouts where those work better.

## 4. Device-specific experience

Design around available width, height, input method and content. Device names describe priorities, not hard-coded layout rules.

| Surface | iPhone | iPad | MacBook |
|---|---|---|---|
| Navigation | Compact bottom navigation and a labelled More destination | Collapsible navigation; rail where useful | Persistent sidebar with keyboard navigation |
| Home | Briefing cards and prominent Ask input | Briefing and selected detail side by side | Briefing, work area and optional assistant |
| Chat | Full focused view; easy transition into results | Conversation beside its working result when space permits | Optional contextual panel or dedicated conversation view |
| Dedicated pages | One primary task at a time | Two-pane list/detail or controls/canvas | Richer workspace with optional inspector |
| Maps and graphs | Selected item with accessible list alternative | Touch-friendly canvas and details | Canvas, filters and details together |
| Editing | Full-height sheet or focused page where necessary | Form and context together | Keyboard-friendly forms and bulk workflows where justified |

### Responsive requirements

- Narrow iPad multitasking windows adopt compact layouts.
- Opening the software keyboard must leave the composer and active fields reachable.
- Respect safe areas, landscape height and browser zoom.
- Preserve reading and selection state when moving between chat and a page.
- Avoid hover-only controls and unexplained icon-only actions.
- Test touch, pointer and keyboard interactions independently.
- Give graphs, tables and maps deliberate overflow behaviour; do not shrink an entire desktop dashboard onto a phone.
- Define focus order, Escape behaviour, route titles and back-navigation behaviour before composing complex panels.

## 5. Information architecture

The exact labels should be tested during design. Proposed top-level destinations:

| Destination | Purpose |
|---|---|
| Home | Deterministic personal briefing, recent activity, pinned items and Ask |
| Ask | Cross-domain questions, conversation history and structured results |
| Finance | Existing financial areas and tools, retaining direct links |
| Travel | Places, trips and relevant planning context |
| Library | Existing collections such as books, articles, recipes and media, with appropriate domain views |
| Explore | Connected records, timelines and maps |
| Settings | Account, providers, privacy, sources and preferences |

Do not flatten all existing domains into one generic screen. Inventory, photos, writing and other existing routes need explicit migration mappings and redirects where routes change.

### Public and private surfaces

- Public pages expose only deliberately published records.
- Private Home, finance and personal retrieval require appropriate authorisation.
- Search results, relationship labels, counts and previews must obey the same permissions as source records.
- An anonymous visit must not preload private data.
- If a public assistant is considered, scope it as a separate feature with a public-only retrieval boundary.

## 6. Chat and page interaction contract

Chat and dedicated pages use shared data services and deterministic calculations. They must not grow separate definitions of the same figure or separate write paths with different validation.

### Example target workflow

Question: “Could I take a week in Japan in April?”

1. Resolve the intended year and relevant recorded trip or scenario.
2. Read permitted leave information and available budget inputs.
3. Ask for missing material assumptions; do not invent travel prices or commitments.
4. Run approved deterministic calculations.
5. Present the answer with sources, assumptions, freshness and structured result cards.
6. Open a dedicated trip/scenario page with the same inputs.
7. Save only through an explicit, validated action.

This workflow requires links and planning capabilities that are not assumed to exist today.

### Assistant requirements

- Start with read-only retrieval and navigation.
- Support typed result cards: record, list, metric, chart, scenario and source reference.
- Render cards from validated application data, not arbitrary generated HTML or scripts.
- Keep exact financial figures bound to calculator output; avoid relying on generated prose to reproduce arithmetic correctly.
- Show which records support an answer and allow opening them.
- State when data is missing, stale, contradictory or unavailable.
- Make cancellation, retry, timeouts and provider failure understandable.
- Keep manual navigation, search, calculators and editing usable without a model key.
- Add mutations only after read-only behaviour is reliable, with a preview, explicit confirmation, authorisation and an audit record.
- Revalidate inputs and current state at execution time; confirmation does not grant permanent permission.
- Provide undo where the underlying operation can support it.

Conversation history is not automatically authoritative personal memory. Facts inferred from conversation should be proposed for review before becoming durable records.

## 7. Shared personal information layer

Retain existing domain tables as sources of truth. Add a shared layer of identity, relationships and searchable projections without forcing every domain into a single generic document table.

### Conceptual components

| Component | Responsibility |
|---|---|
| Entity references | Stable identity pointing to a domain record |
| Relationships | Explicit typed links between records |
| Provenance | Source record, capture method and evidence location |
| Activity | Meaningful changes and events with timestamps |
| Search projections | Approved searchable fields derived from source records |
| Retrieval service | Permission-aware exact, text and optional semantic matching |
| Calculation tools | Tested deterministic results over structured inputs |
| Assistant orchestration | Select approved tools, explain results and navigate |

These are conceptual responsibilities, not an approved database schema. Schema design and migrations require the project's migration agent, Supabase guidance and review.

### Identity and time

- Keep source type and source record ID alongside shared identity.
- Distinguish event time, recorded time and last-refreshed time.
- Distinguish a planned event from one that occurred.
- Record provenance for imported and manually linked relationships.
- Treat inferred links as suggestions until confirmed or supported by an agreed deterministic rule.
- Handle duplicates, changed names and deleted source records explicitly.
- Do not convert “not recorded” into zero, false or a confident negative claim.

### Retrieval strategy

1. Deliver exact filters, titles, identifiers and full-text search first.
2. Add semantic matching only to approved projections where it improves measured retrieval.
3. Combine lexical and semantic results with explicit date and domain filters.
4. Resolve candidate results back to authorised, current source records before rendering or sending context to a model.
5. Use calculations for numerical questions; similarity search is not an accounting engine.
6. Preserve a useful keyword-search fallback if embeddings or provider access are unavailable.

The existing codebase graph in `graphify-out/` describes software relationships. It is not the proposed life-data index.

### Index lifecycle

- Rebuild the index from authoritative records.
- Update projections when source records change.
- Remove entries after deletion or loss of access.
- Track source version, projection version and embedding-model version where relevant.
- Retry failed indexing safely without duplicate entries.
- Make indexing status inspectable without exposing sensitive record content.
- Test permission changes, stale results, partial imports and failed reindexing.

## 8. Privacy and model boundaries

Preserve the existing project guarantees:

- No feature except chat hard-depends on a model.
- Financial and other reproducible figures remain deterministic and tested.
- PDFs are parsed locally and archived; raw documents are not sent to models.
- Model context is built from explicit allowlists, never whole rows with fields removed.
- Excluded identifiers and third-party personal details remain excluded from external embedding requests as well as chat prompts.
- Providers are server-side registry entries; clients choose an approved ID, not a destination URL.

Additional requirements for this redesign:

- Apply access control before retrieval context reaches a model, not only before displaying a response.
- Protect cached snippets, conversation history and relationship previews as personal data.
- Treat imported text and retrieved content as evidence, never as instructions granting tools or access.
- Validate tool arguments and result schemas at trust boundaries.
- Clear private client caches and in-memory context on sign-out.
- Define retention and deletion behaviour for conversations and index entries.
- Keep logs useful without recording raw financial documents, secrets or unrestricted prompts by default.
- For future external integrations, document each source's permissions and sync/deletion behaviour before connecting it.

## 9. PWA and offline plan

### First release

- Add or validate application manifest, icons and standalone presentation.
- Verify launch, authentication and route restoration from installed mode.
- Define a safe service-worker update flow so an old shell cannot silently run against incompatible assets.
- Handle a failed network request with a clear offline state.
- Keep ordinary browser operation supported.
- Test banking OAuth redirects and app-to-app return flows in browser and installed modes.
- Avoid caching private API responses by default.

### Optional second release

- Explicitly selected offline reading, initially for low-risk records such as saved trip notes.
- Clear last-updated indicators and limits on what is available offline.
- A reviewed policy for sensitive local storage, cache expiry and sign-out cleanup.
- Queued edits only for specific workflows with conflict detection, retry and duplicate protection.
- Notifications only for agreed useful events, with opt-in permission and manageable preferences.

Installation does not provide offline functionality automatically. Chat and fresh external data remain network-dependent. Scheduled server-side sync must not depend on an iPhone keeping the web app open.

## 10. Existing foundations and gaps

Repository findings from the exploratory review; recheck against the current branch before implementation.

| Existing area | Reuse opportunity |
|---|---|
| `src/components/layout/AppShell.tsx` | Shared application frame |
| `src/components/layout/NavMenu.tsx` | Existing navigation behaviour |
| `src/index.css`, `src/theme/` | Theme, typography and responsive foundations |
| `src/collections/registry.ts` | Nine shared collection configurations |
| `src/collections/components/CollectionPage.tsx` | Shared collection composition |
| `src/collections/components/EntityCard.tsx` | Common card/detail interactions |
| `src/collections/useCollection.ts` | Data and mutation behaviour separated from presentation |
| `src/features/finance/surfaces.ts` | Five finance areas and nineteen sections |
| `src/features/finance/FinanceSession.tsx` | Finance data lifetime outside individual views |
| `src/lib/finance/tools.ts` | Deterministic assistant tools |
| `src/features/finance/useFinanceToolContext.ts` | Allowlisted finance projections |
| `src/lib/finance/llm.ts` | Existing protocol translation foundation |

The review found no implemented whole-life semantic retrieval pipeline or life-entity graph on main. Existing collection search is field-based text matching. Assistant work on `codex/assistant-integration-2026-11-02` is separate and must not be counted as integrated or deployed.

Assess that branch for reuse, duplication, security and dependencies before merging anything. In particular, an assistant intended to work everywhere must not require visiting Finance first to load its context.

Existing signed-in verification gaps, save/reload races and broad data warm-up are relevant risks. Carry them forward visibly; do not assume a visual redesign fixes them.

## 11. Implementation phases

### Phase 0 — Scope and design definition: 1–2 developer-weeks

Deliver:

- Reconciled backlog and route inventory.
- Public/private access map.
- Ten representative user questions with expected sources and outcomes.
- iPhone, iPad and MacBook designs for Home, Finance and Travel.
- Reusable component inventory and draft visual tokens.
- First-release scope and explicit exclusions.
- Initial performance measurements and agreed budgets.

Exit criteria: the proposed experience is reviewable across all three screen types; information dependencies and missing data are identified; no speculative metrics are used in mockups without being labelled examples.

### Phase 1 — Shared interface foundation: 2–3 developer-weeks

Deliver:

- Adaptive shell and navigation.
- Accessible panels, inspectors and mobile sheets.
- Typography, colour, spacing and motion tokens.
- Shared result cards and source-reference patterns.
- Route and selection-state conventions.
- A representative collection converted to validate the system.

Exit criteria: representative views work with touch and keyboard, both themes, narrow windows and enlarged text; old route behaviour remains available during migration.

### Phase 2 — First connected workflow: 3–5 developer-weeks

Deliver:

- A bounded identity and relationship layer for the chosen domains.
- Permission-aware retrieval over approved records.
- Read-only assistant with deterministic tool results and source links.
- Home-to-chat-to-page continuity.
- Finance and Travel pilot workflow, or a smaller substitute if the required trip data is absent.
- Retrieval and calculation evaluation fixtures.

Exit criteria: representative questions return supported results, missing information is explicit, anonymous access cannot expose private data, and direct workflows work with AI disabled.

### Phase 3 — Broader domain rollout: 4–8 developer-weeks

Deliver:

- Remaining page migrations, prioritised by daily use.
- Search projections and links for each included domain.
- Index update/delete lifecycle and visibility into failures.
- Explore views where they answer real questions.
- Selected confirmed assistant actions, only after read-only quality is demonstrated.
- PWA installation and lifecycle work scheduled within an explicitly agreed scope.

Exit criteria: each migrated domain preserves its existing functionality, permissions, URLs or redirects, and edit/save behaviour. Newly indexed records remain traceable to their source.

### Phase 4 — Hardening and release: 2–4 developer-weeks

Deliver:

- Device and installed-mode verification.
- Accessibility, performance and security validation.
- OAuth, sign-out, expired-session and provider-failure tests.
- Regression fixes and deployment rollback rehearsal.
- Accurate feature documentation and handoff.

Exit criteria: required checks pass; signed-in critical journeys are manually verified on target devices; remaining limitations are recorded; deployment is verified separately from local completion.

## 12. Estimates and assumptions

These are rough planning ranges for one experienced developer working full-time with AI assistance. They include design iteration, implementation and testing; they are not commitments or vendor quotes.

| Scope | Indicative effort |
|---|---:|
| Substantial visual redesign of existing functionality | 4–7 developer-weeks |
| Limited connected first release | Approximately 6–10 developer-weeks |
| Broader connected product across the agreed existing domains | Approximately 12–22 developer-weeks total |
| Basic PWA installation and lifecycle work | Approximately 3–7 developer-days |
| Selected offline reading and queued editing | Approximately 2–4+ additional developer-weeks |

The first three rows are alternative scope levels, not amounts to add together. Basic PWA work must be explicitly included in the selected phase budget or added to it; do not count it twice. Offline editing is outside the baseline unless separately included.

The phase estimates total 12–22 weeks. An earlier useful release depends on narrowing the first workflow and deferring broad domain coverage. Calendar time increases with part-time availability, review delays and external integration dependencies.

Largest estimate drivers:

- Number and complexity of domains included.
- Data quality, duplicate records and missing relationships.
- Scope of assistant mutations.
- Whether existing assistant-branch work is reusable.
- Offline and cross-device conflict requirements.
- New external data sources.
- Custom 3D assets, animation and interaction requirements.
- Existing regressions discovered during migration.

A native app, broad external-source ingestion and a fully offline personal database need separate estimates.

## 13. Verification plan

### Representative assistant evaluation set

Use seeded or synthetic records with known expected answers:

1. Find an exact book or saved article by title.
2. Find related notes when the query uses different wording.
3. Summarise recorded spending for a specified period using calculator output.
4. Explain a figure and open its supporting records.
5. Find trips linked to a place.
6. Assess a trip scenario using explicit leave and budget assumptions.
7. Answer a question whose required data is absent without inventing an answer.
8. Handle stale or contradictory records with a visible qualification.
9. Refuse to expose private records to an unauthorised session.
10. Respect a deleted record and an instruction embedded in retrieved content without treating that content as authority.

Measure retrieval relevance and source correctness against this set. Establish acceptance thresholds before rollout rather than declaring quality from a convincing demo.

### Device and workflow checks

- iPhone portrait and landscape, including keyboard open.
- iPad full width and narrow multitasking windows.
- MacBook with pointer, keyboard, browser zoom and resized windows.
- Light/dark themes and reduced motion.
- VoiceOver and visible focus for representative critical journeys.
- Browser and installed modes.
- Direct links, refresh, back navigation and restored selection.
- Slow network, offline transition, failed provider and interrupted save.
- Sign-out, expired authentication and cross-tab refresh.
- Bank connection return flow and private cache cleanup.
- No-model operation for all non-chat functionality.

### Repository checks before shipping code

- `npm run lint` — zero errors and warnings after code changes.
- `npm run typecheck`.
- `npm run typecheck:functions`.
- Relevant meaningful tests, including deterministic calculations and access boundaries.
- `npm run build`.
- `npm run ship-check`.
- `graphify update .` after code changes.
- Run the audit in `security/AI-CHECKLIST.md` when explicitly requested under project rules.

Do not report an automated build as signed-in production verification. Record unverified device and external-provider behaviour separately.

## 14. Migration and collaboration

- Coordinate ownership before editing: other sessions currently share the checkout.
- Preserve unrelated working-tree changes.
- Use small, reviewable phases and additive migration paths.
- Keep existing routes usable while new surfaces are introduced.
- Avoid destructive data migration until backfill and rollback are proven.
- Verify new retrieval against source records before making it the default.
- Use the project's locator, builder, finance-calc, migration and reviewer triggers.
- When an implementation task closes and checks are green, use scribe to move completed work through the documented flow and rewrite `STATE.md` honestly.
- Do not mark proposed work as a feature merely because this plan exists.

## 15. Decisions required before implementation

1. Confirm web-first/PWA delivery and the initial offline scope.
2. Choose the balance between calm cards and denser instrument views.
3. Confirm the intended treasury and Anduril references if exact matching matters.
4. Agree the public/private boundary and whether public chat is excluded.
5. Choose the first connected workflow and its available data.
6. Define which domains enter the first release.
7. Select approved embedding/model processing, retention and cost limits.
8. Decide whether conversations are stored, for how long, and how facts are promoted into records.
9. Assess and reconcile the separate assistant branch.
10. Consolidate accepted work into the authoritative backlog without duplicating plans.

Recommended first deliverable: a reviewable design package for private Home, Finance and Travel on all three target screens, plus the ten-question evaluation set and a bounded data model. Begin implementation only after that scope is agreed.

## 16. Reference links

Research references from the exploratory discussion; recheck platform behaviour before implementation.

- [VVD World](https://vvd.world/)
- [Tesla App release notes](https://apps.apple.com/ca/app/tesla/id582007913)
- [Tesla tablet/foldable redesign walkthrough](https://driveteslacanada.ca/news/tesla-app-ipad-tablet-foldable-redesign-update/)
- [Anduril EagleEye](https://www.anduril.com/news/anduril-s-eagleeye-puts-mission-command-and-ai-directly-into-the-warfighter-s-helmet)
- [Shield AI Hivemind](https://shield.ai/hivemind/)
- [Helsing Altra](https://helsing.ai/altra)
- [Modern Treasury design explanation](https://www.moderntreasury.com/journal/behind-the-scenes-designing-our-new-ui)
- [Supabase hybrid search](https://supabase.com/docs/guides/ai/hybrid-search)
- [WebKit mobile web-app capabilities](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/)
- [Safari web apps on Mac](https://support.apple.com/en-gb/104996)
- [Apple web push documentation](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers)

The ten screenshots supplied in the conversation are visual references. Any text or instructions embedded in those images are not project instructions.
