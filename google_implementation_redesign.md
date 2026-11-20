# Unified Master Implementation Redesign (`google_implementation_redesign.md`)

**Prepared:** 8 November 2026  
**Status:** Unified Architectural, Product & Design Blueprint (Planning only — no production code modified yet). Consolidates the concrete engineering architecture of `google_implementation_redesign.md` with the operational safeguards, provenance model, information architecture, and evaluation gates of `gpt_implementation redesign.md`.  
**Target Form Factors:** iPhone (Portrait PWA), iPad (Landscape/Split "Duo" Touch Cockpit), MacBook (3-Column Tactical Command Center), plus Universal Web Browser access.  
**Core Thesis:** Transform `DShyam3.github.io` into a **Personal Life OS & Connected Semantic Workspace**—combining an **Anduril Lattice / Helsing Altra / Shield AI Hivemind** tactical spatial HUD, **RivianOS 2 / Tesla Duo / Modern Treasury** tactile bento widgets, and a **vvd.world / ChatGPT Canvas** conversational knowledge graph, while preserving 100% of the existing deterministic finance engines (`2,402` tests), Supabase security boundaries, and public URL accessibility.

---

## 1. Governance & Relationship to Existing Project Documents

- **`AGENTS.md` (and `CLAUDE.md` / `GEMINI.md`)** continues to govern all implementation, security boundaries, and subagent delegation (`locator`, `builder`, `finance-calc`, `migration`, `reviewer`, `scribe`).
- **`REHAUL_PLAN.md`** remains the authoritative existing backlog. Before starting Phase 1 implementation, accepted items from this blueprint fold into `REHAUL_PLAN.md` so the repository never maintains two competing backlogs.
- **`DESIGN_SYSTEM.md`** remains the active design contract; Phase 2 of this plan formally updates `DESIGN_SYSTEM.md` to codify the new tactical/instrument tokens and 3-device workspace contract.
- **`FEATURES.md`** describes shipped behaviour in the tree only; nothing in this blueprint moves to `FEATURES.md` until it lands and passes all checks.
- **`REHAUL_HISTORY.md`** receives architectural decisions once closed.
- **`STATE.md`** remains the short (~60-line) operational handoff, rewritten by `scribe` only when a task lands with green checks.
- **Pre-implementation branch audit (Completed in Phase 0):** Inspected `codex/assistant-integration-2026-11-02` (`eef507c1`). That branch already implements a working v1 foundation:
  - `supabase/functions/assistant/index.ts` & `providers.ts` (server-side provider registry, fail-closed `check_rate_limit`, admin JWT check, upstream timeout, zero key leakage).
  - `src/lib/assistant/protocol.ts` & `conversation.ts` (protocol translation and multi-turn tool loop).
  - `src/features/assistant/` (`AssistantLauncher.tsx`, `AssistantPanel.tsx`, `site-tools.ts`, `inventory-tool.ts`, `releases-tool.ts`, `chat-store.ts`, plus `inventory-specs.ts` for typed inventory attributes).
  - **Key architectural gap identified on that branch:** `site-tools.ts` defines `FINANCE_NOT_LOADED = 'Finance data is only loaded on the Finance page. Ask the owner to open Finance and ask again.'` because `FinanceDataContext` only mounted inside `/finance`. On `main` (`033a6583`), `FinanceSession` now wraps the app in `src/App.tsx`, meaning our redesign can wire `FinanceSession` + the new `semantic_nodes` index directly into the global command bus without requiring the user to navigate to `/finance` first.

---

## 2. Visual & Interaction Synthesis

The redesign unifies three reference families into a single coherent system:

| Layer | Reference Systems | What We Borrow | Where It Lives in the Site |
|---|---|---|---|
| **1. Tactical Command & Spatial HUD** | **Anduril** (Lattice / EagleEye HUD), **Shield AI** (Hivemind), **Helsing** (Altra / Cirra), *Agripilot*, *Nexus Core*, *Medical Node*, *Turritopsis Dohrnii* | • True-black / obsidian canvas (`#060808` / `#0A0D0C`) paired with high-contrast Technical Daylight light mode<br>• `1px` hairline structural grids (`--rule`, `--grid-line`) and `aria-hidden` corner registration brackets<br>• Top system telemetry bar (`SYS.ID`, sync status, active coordinates, UTC/local clock)<br>• Central 3D point-cloud / spatial viewport flanked by docked telemetry rails<br>• Bottom time-series scrubber / activity strip | `AppShell`, Home (`Nexus Core`), Explore (`Graph / Atlas / Timeline`), Travel (`Atlas`), Inventory (`Loadout`), Watchlist (`Media Feed`) |
| **2. Tactile Hardware OS & Bento Widgets** | **RivianOS 2** (Image 1), **Tesla Mobile & iPad Duo UI**, **Modern Treasury** | • High-contrast squircle widget cards with tactile sliders, pill toggles, and radial/linear meters<br>• Oversized tabular figures with baseline-aligned units (`£3,293.30`, `267 mi`, `98.4%`)<br>• Semantic status gradients (controlled 2-stop mesh for status: phosphor green, tactical amber, crimson alert—always paired with text/symbol labels)<br>• Master-detail "Duo" continuity across iPhone, iPad, and MacBook | Finance (`Ledger`, `Money Hub`, `Tax Calculator`, `Forecast`), Dashboard summary tiles, Mobile/iPad touch controls |
| **3. Connected Lore & Conversational Canvas** | **vvd.world** (*vivid*), **ChatGPT** (Canvas / Search) | • Everything as a connected index card with `@mentions`, provenance, and automatic backlinks<br>• Persistent command/chat bar (`⌘K` / `Ask`) that drives the UI via typed tools<br>• Dynamic Canvas split-pane where the assistant pins, compares, and filters cards live | Global Command Bus, Dedicated `Ask` & `Explore` views, Right-hand Inspector Rail, Cross-domain Semantic Index (`Books` ↔ `Beliefs` ↔ `Thoughts` ↔ `Finance` ↔ `Travel`) |

### Preserving Existing Non-Negotiables (`AGENTS.md` & `DESIGN_SYSTEM.md`)
- **Preserve `Doto` and `Space Mono`:** Per `DESIGN_SYSTEM.md`, `Doto` (dot-matrix variable display face) and `Space Mono` (tabular technical body/readouts) are core to the site's identity and are never replaced with a generic sans-serif.
- **No decorative or idling telemetry:** Every number, coordinate, percentage, or sparkline rendered in a HUD rail must map to a real computed figure from Supabase rows or local deterministic math (`src/lib/`). No random ticking numbers, fake packet counters, or decorative empty cockpit boxes.
- **The Model Boundary (`7.P`, `7.Q`, `7.F`):**
  - With no API key set, 100% of the website works except free-form chat generation.
  - The LLM chooses tools, phrases answers, and navigates/pins cards to the workspace; **it never computes a financial or statistical number**.
  - Raw sensitive documents (payslips, credit reports) are parsed in-browser (`pdfjs-dist`) and never sent to an LLM or external embedding API. What reaches a model or embedding index is built via strict allowlist projection.
- **Accessibility & Legibility Floor:** Minimum `12px` for uppercase monospace readout labels (`letter-spacing: 0.08em`), `4.5:1` contrast checked against the brightest background point, `aria-hidden="true"` on all corner brackets/grid hairlines, reduced-motion respect, and `44px` (`2.75rem`) minimum touch targets on iPhone/iPad.

---

## 3. Platform Strategy, PWA Lifecycle & Scope Boundaries

To keep the site **instantly accessible via URL anywhere in the world** while feeling like a **native app on your iPhone, iPad, and MacBook**, we build **one adaptive React + TypeScript + Vite web application** with a first-class **Progressive Web App (PWA)** installation layer.

### 3.1 PWA & Offline Architecture
- **First Release (Standalone Shell & Safe Lifecycle):**
  - Add `public/manifest.webmanifest`, Apple touch icons, and iOS standalone meta tags (`apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style="black-translucent"`, `viewport-fit=cover`).
  - Use CSS `env(safe-area-inset-*)` so the obsidian HUD frame bleeds cleanly into the iPhone Dynamic Island and iPad Pro rounded corners without clipping controls when the software keyboard opens.
  - Define a safe Service Worker update flow so an older cached shell never runs silently against incompatible chunk assets, and **never cache private/authenticated Supabase API responses by default**.
  - Verify **TrueLayer banking OAuth redirects** (`useTrueLayer.ts`) and app-to-app return flows across both standard mobile Safari and installed Home Screen mode.
  - Scheduled syncs (`watchlist-cron-sync`, `truelayer-sync`) remain strictly server-side (`pg_cron` + Edge Functions) and never depend on an iPhone keeping the PWA open.
- **Optional Second Release (Selective Offline Reading):**
  - Explicitly opted-in offline reading for low-risk records (e.g., saved trip notes, reading list, EDC checklist) with clear *"Last updated"* freshness indicators and immediate cache purge on sign-out.
- **When to Revisit a Native Companion (Capacitor / Swift):**
  - Revisit only if a future workflow requires Apple HealthKit, iOS Home Screen WidgetKit, or system Share Sheet extensions. Because `src/lib/` has zero DOM/server coupling, a native companion can wrap or consume the same services later without rewriting the app.

### 3.2 Explicit Initial Scope Exclusions
To keep delivery focused and prevent scope creep, the baseline redesign excludes:
- Separate native iOS, iPadOS, and macOS codebases or App Store distribution.
- New external-source ingestion (email, calendar, Apple Health) in the initial release.
- Autonomous financial actions, payments, or unconfirmed model-driven database writes.
- Arbitrary SQL generation, arbitrary tool execution, or client-specified external URLs (SSRF prevention).
- Always-listening voice, continuous background location tracking, or custom 3D scenes on every collection page (3D/spatial visuals are reserved for Home/Nexus, Explore, and Travel where spatial relationships explain the data).

### 3.3 Adaptive 3-Screen Contract (iPhone · iPad · MacBook)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ MACBOOK (≥ 1280px · Fine Pointer + Keyboard)                                 │
│ 3-Column Command Center (`react-resizable-panels`)                           │
│ ┌──────────────┬──────────────────────────────────────────┬────────────────┐ │
│ │ LEFT RAIL    │ CENTER SPATIAL / BENTO VIEWPORT          │ RIGHT RAIL     │ │
│ │ • Unit Tree  │ • 3D Point-Cloud / Globe / Active Route  │ • Entity Card  │ │
│ │ • Saved Views│ • Pinned Comparison Canvas               │ • Backlinks    │ │
│ │ • Quick Stat │ • Docked Bottom Command/Chat Bar (`⌘K`)  │ • Live AI Chat │ │
│ └──────────────┴──────────────────────────────────────────┴────────────────┘ │
├──────────────────────────────────────────────────────────────────────────────┤
│ iPAD (768px – 1279px · Coarse Touch + Trackpad / Split View)                 │
│ Tesla "Duo" / Rivian Cockpit (2-Column Adaptive Split + Collapsible Dock)    │
│ ┌─────────────────────────────────────────────────┬────────────────────────┐ │
│ │ PRIMARY WORKSPACE (65% width)                   │ DUO INSPECTOR (35%)    │ │
│ │ • Touch-first Bento Widgets & Spatial Canvas    │ • Swaps between Chat,  │ │
│ │ • Pinned Bottom Mode Switcher & Prompt Bar      │   Card Detail & Links  │ │
│ │   (Collapses to 1-pane in narrow iPad Split View│                        │ │
│ └─────────────────────────────────────────────────┴────────────────────────┘ │
├──────────────────────────────────────────────────────────────────────────────┤
│ iPHONE (< 768px · One-Handed Portrait Touch)                                 │
│ Tesla / Rivian Mobile App + Physics Bottom Sheets (`vaul`)                   │
│ ┌──────────────────────────────────────────────────────────────────────────┐ │
│ │ • Top Status Pill (`SYS.ONLINE` · Route · Quick Metric)                  │ │
│ │ • One Primary Task / Focal Card at a time (never a shrunk desktop view)  │ │
│ │ • Scannable 2-Column Compact Bento Stack                                 │ │
│ │ • Thumb-Zone Dock: [ Home ] [ Ask ] [ Finance ] [ Explore ] [ More ]     │ │
│ │   (Tapping any card or Ask pulls up a keyboard-safe `vaul` sheet)        │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Information Architecture & Public/Private Boundaries

We organize navigation into **7 clear top-level operational destinations** while preserving every existing URL (`src/App.tsx`) and adding clean route mappings so no saved link breaks:

| Top-Level Destination | Route(s) | Purpose | Access Boundary |
|---|---|---|---|
| **1. Home (`Nexus`)** | `/` | Deterministic personal briefing, interactive 3D life-index point cloud / Bento toggle, Experience & Education timeline, CV download, and prominent `Ask` bar | Public bio/CV/counts; Private briefing widgets when signed in as Admin |
| **2. Ask (`Copilot`)** | `/ask` + Global `⌘K` Dock | Cross-domain natural language & lexical queries, structured result cards, multi-card comparison Canvas (`vvd.world` style), and source citations | Public mode queries public records only; Admin mode unlocks Finance & private records |
| **3. Finance (`Ledger`)** | `/finance/*` | All 5 existing surfaces & 19 sections (Home, Spending, Plan, Wealth, Income / Money Hub / Tax Calculator) framed in tactile Rivian/Treasury HUD widgets | **Strictly Admin-only (`is_admin()`)**; opens with `Hide Figures` active by default |
| **4. Travel (`Atlas`)** | `/travel` | 3D/2D `DotMatrixGlobe`, visited countries & cities, trip groupings, and route/planning context | Public map & visited list; Admin trip planning/notes |
| **5. Library (`Archive`)** | `/books`, `/watchlist/*`, `/articles`, `/recipes`, `/photos`, `/inventory`, `/links`, `/beliefs`, `/thoughts`, `/inspiration` | Unified hub and individual routes for all 9 curated collections + Watchlist (News & Library) + Inventory/EDC loadout | Public read; Admin add/edit/delete/schedule |
| **6. Explore (`Graph`)** | `/explore` | Full-screen connected records explorer: 3D/2D `vvd.world` relationship graph, cross-domain chronological timeline scrubber, and tag/topic clusters | Public graph shows public nodes/links; Admin graph overlays private nodes |
| **7. Settings (`System`)** | `/auth` (and Settings panel) | Admin authentication, 2FA/TOTP setup, display density (`Standard` / `Larger`), theme mode, semantic index status, and AI provider selection | Public display prefs; Admin auth & system controls |

---

## 5. Pillar 1: The Shared Personal Information Layer & Semantic Index

Existing domain tables (`books`, `beliefs`, `tv_shows`, `finance_transactions`, etc.) remain the **authoritative sources of truth**. We add a shared projection and relationship layer (`semantic_nodes` and `semantic_links`) with explicit **provenance, temporal distinction, and lifecycle management**.

```mermaid
flowchart TD
    subgraph Sources["1. Authoritative Domain Tables (Supabase Postgres)"]
        PUB["Public Tables\nResume · 9 Collections · Watchlist · Travel"]
        PRIV["Private Admin Tables (`is_admin()`)\n23 Finance Tables · Leave · Scenarios"]
    end

    subgraph Index["2. Shared Personal Information Layer (`src/lib/semantic/`)"]
        SER["Allowlist Card Serializers\n(Versioned, Deterministic, Zero Raw PDFs)"]
        NODES["`semantic_nodes`\n• Identity (`entity_type`, `entity_id`)\n• Time (`event_date`, `recorded_at`, `time_kind`)\n• Search (`search_tsv` + `pgvector`)\n• Provenance (`source_table`, `projection_version`)"]
        LINKS["`semantic_links`\n• Typed Edges (`mentions`, `inspired_by`, `located_in`, `purchased_in`)\n• Confidence (`confirmed` vs `inferred` suggestion)"]
    end

    subgraph Bus["3. Retrieval, Deterministic Tools & UI"]
        RET["Permission-Aware Retrieval\n1. Exact/Lexical (`tsvector`) → 2. Semantic (`pgvector`) → 3. Re-verify Source Row"]
        CALC["Deterministic Calculators (`src/lib/finance/*`)\nTax, Money Hub, Forecast, Debt, Student Loan, Leave/Trip Math"]
        UI["Tactical HUD Shell, Inspector Rail & Comparison Canvas"]
    end

    PUB --> SER
    PRIV -->|Allowlisted Projections Only| SER
    PRIV --> CALC
    SER --> NODES
    SER --> LINKS
    NODES --> RET
    LINKS --> RET
    RET --> UI
    CALC --> UI
```

### 5.1 Database Schema (`supabase/schemas/50_semantic_index.sql`)

```sql
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

CREATE TABLE public.semantic_nodes (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type         text NOT NULL, -- 'book' | 'belief' | 'thought' | 'article' | 'link' | 'recipe' | 'photo' | 'inventory' | 'experience' | 'education' | 'show' | 'movie' | 'travel_city' | 'finance_goal' | 'finance_alert'
  entity_id           text NOT NULL, -- Primary key in the authoritative source table
  source_table        text NOT NULL, -- e.g. 'books', 'beliefs', 'visited_cities', 'finance_goals'
  visibility          text NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'admin')),
  title               text NOT NULL,
  subtitle            text,
  summary_text        text NOT NULL, -- Canonical allowlisted text for FTS and optional embedding
  route_path          text NOT NULL, -- Deep link back to the dedicated page/inspector
  -- Temporal distinction: event time vs recorded time, and actual vs planned
  event_date          date,          -- When it happened or is scheduled to happen
  time_kind           text NOT NULL DEFAULT 'recorded' CHECK (time_kind IN ('occurred', 'planned', 'ongoing', 'recorded')),
  recorded_at         timestamptz NOT NULL DEFAULT now(),
  refreshed_at        timestamptz NOT NULL DEFAULT now(),
  -- Provenance & versioning for safe re-indexing
  projection_version  integer NOT NULL DEFAULT 1,
  embedding_model     text,          -- NULL when keyword-only; e.g. 'gte-small-v1' when embedded
  attributes          jsonb NOT NULL DEFAULT '{}'::jsonb,
  search_tsv          tsvector GENERATED ALWAYS AS (
                        setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
                        setweight(to_tsvector('english', coalesce(subtitle, '')), 'B') ||
                        setweight(to_tsvector('english', coalesce(summary_text, '')), 'C')
                      ) STORED,
  embedding           extensions.vector(384),
  UNIQUE (entity_type, entity_id)
);

CREATE TABLE public.semantic_links (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id     uuid NOT NULL REFERENCES public.semantic_nodes(id) ON DELETE CASCADE,
  target_id     uuid NOT NULL REFERENCES public.semantic_nodes(id) ON DELETE CASCADE,
  relation      text NOT NULL, -- 'mentions' | 'inspired_by' | 'purchased_in' | 'located_in' | 'same_topic'
  link_status   text NOT NULL DEFAULT 'confirmed' CHECK (link_status IN ('confirmed', 'inferred')),
  provenance    text NOT NULL DEFAULT 'manual',   -- 'manual' | 'mention_parser' | 'exif_gps' | 'tag_rule'
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_id, target_id, relation)
);
```

### 5.2 Identity, Time, Provenance & Index Lifecycle Rules
1. **Distinguish Time & Certainty:** Every node separates `event_date` (when a role started, trip occurred, or episode airs) from `recorded_at`, and labels `time_kind` (`occurred` vs `planned` vs `ongoing`). Missing data is never coerced to `0`, `false`, or a fabricated timestamp (per `REHAUL_PLAN.md 8.B`).
2. **Confirmed vs. Inferred Links:** Explicit `@mentions` in markdown and deterministic foreign-key/EXIF rules are stored as `link_status = 'confirmed'`. Heuristic or AI-suggested links are stored as `link_status = 'inferred'` and surfaced in the Inspector as suggestions until confirmed with one click.
3. **Retrieval Precedence (Lexical First, Semantic Second, Calculator Always for Numbers):**
   - Exact ID/title matches and full-text `search_tsv` run first (100% functional with zero external model or embedding key).
   - Semantic vector similarity (`embedding`) supplements recall for conceptual queries (*"notes about resilience"* matching a Stoicism book and a belief entry).
   - Candidate hits are **always resolved back to the current, permission-checked source record** before rendering or passing to a model.
   - Numerical questions (*"how much did I spend"*, *"what is my net take-home in Berlin"*) **never** use similarity search—they call deterministic calculators.
4. **Idempotent Rebuild & Deletion Hygiene:**
   - Because `semantic_nodes` is a projection with `UNIQUE (entity_type, entity_id)` and `projection_version`, the entire index can be rebuilt deterministically from source tables at any time.
   - Deleting a source record or revoking public visibility immediately removes or updates its projection node and cascades to `semantic_links`.

---

## 6. Pillar 2: The Conversational Command Bus & Page Interaction Contract

Chat and dedicated pages share the exact same data hooks and deterministic calculators—they never grow separate definitions of a figure.

### 6.1 End-to-End Multi-Domain Target Workflow
> **Example Query:** *"Could I take a week in Japan in April, and what have I saved about Tokyo?"*
1. **Resolve Context:** Identifies the target window (`April 2027`), queries `semantic_nodes` for Japan/Tokyo records (visited cities, saved links, articles, wishlist items), and checks if the session is Admin (`(SELECT public.is_admin())`).
2. **Read Permitted Inputs:** In Admin mode, reads remaining annual leave days (`user_holidays`), monthly `freeToSpend` / surplus (`useFinanceTotals`), and savings goals (`get_goals`).
3. **Never Invent Missing Assumptions:** Because flight/hotel budgets for an unbooked trip are not in the ledger, the assistant states what is known (e.g., *"You have 14 leave days remaining and £X free to spend this month"*) and asks for or lets you slide a hypothetical trip cost (`run_spend_scenario(amount)`).
4. **Render Validated Cards & Open Working View:** Displays structured result cards (Leave balance, Spend Scenario impact, and saved Japan notes) with a 1-click action to open the **Comparison Canvas** or `/travel` + `/finance/plan` side by side.
5. **Explicit Mutation Gate:** Read-only retrieval and scenario simulation are the default. Any future write action (e.g., logging a planned trip or bookmarking a link) requires a preview card, explicit user confirmation, re-validation at execution time, and undo support. Conversation history is never automatically promoted to durable personal records without review.

### 6.2 Security, Prompt-Injection & Privacy Safeguards
- **Pre-Model Access Control:** RLS and permission checks run *before* any snippet enters the LLM prompt context, not merely before rendering the UI.
- **Prompt-Injection Isolation:** Retrieved text from saved articles, links, or book blurbs is wrapped as untrusted data evidence and never treated as system instructions capable of invoking tools or escalating privileges.
- **Sign-Out Cache Purge:** Signing out (`AuthContext`) immediately clears React Query caches (`queryClient.clear()`), in-memory assistant history, and any private session state.

### 6.3 UI-Driving Tool Registry (`src/lib/semantic/tools.ts` + `src/lib/finance/tools.ts`)

| Tool Name | Scope | Deterministic Execution | Structured UI Card Returned |
|---|---|---|---|
| `search_life_index` | Public / Admin | Hybrid `search_tsv` + `pgvector` query with domain, tag, and date filters | `RecordListCard` with clickable provenance pills |
| `get_entity_graph` | Public / Admin | Fetches 1-hop `confirmed` and `inferred` links from `semantic_links` | Updates Right Inspector "Connected Nodes" & highlights 3D Graph cluster |
| `pin_to_canvas` | Public / Admin | Selects 2–8 entities across domains by ID | Opens the `vvd.world`-style multi-card Comparison Canvas |
| `navigate_surface` | Public / Admin | Validates route path and filter query params | Navigates main viewport or opens split-pane workspace |
| `get_position` / `run_spend_scenario` / `get_alerts` / `get_goals` | **Admin Only** | Existing tested functions in [`src/lib/finance/tools.ts`](file:///Users/dhyanshyam/Projects/DShyam3.github.io/src/lib/finance/tools.ts) | `FinanceMetricCard` / `ScenarioImpactCard` with exact tabular figures |
| `compare_cities` | **Admin Only** | Existing tested engine in [`src/lib/finance/money-hub.ts`](file:///Users/dhyanshyam/Projects/DShyam3.github.io/src/lib/finance/money-hub.ts) | `MoneyHubComparisonCard` (baseline vs destination surplus & tax) |

---

## 7. Pillar 3: Tactical & Bento Surface Design (`DESIGN_SYSTEM.md` Evolution)

### 7.1 New CSS Tokens (`src/index.css` & `src/theme/surfaces.css`)
We implement the instrument-panel tokens proposed in `DESIGN_SYSTEM.md`, giving dark mode an **Obsidian Tactical HUD** feel (Anduril / Helsing / Nexus Core) while keeping light mode a crisp **Technical Daylight** sheet (4.5:1+ contrast in both):

| Token | Dark Mode (Obsidian HUD) | Light Mode (Technical Daylight) | Purpose |
|---|---|---|---|
| `--background` | `160 15% 4%` (`#090C0B`) | `48 25% 95%` (`#F5F4EF`) | Base viewport ground |
| `--card` | `160 12% 7%` (`#101413`) | `0 0% 100%` (`#FFFFFF`) | Primary module surface |
| `--rule` | `160 10% 18%` (`rgba(255,255,255,0.12)`) | `160 12% 82%` (`rgba(0,0,0,0.12)`) | `1px` structural panel dividers and tick rails |
| `--grid-line` | `160 15% 12%` (`rgba(207,230,142,0.04)`) | `160 10% 88%` (`rgba(50,93,75,0.05)`) | Subtle coordinate lattice behind spatial canvases |
| `--readout-label` | `150 8% 68%` (≥ 4.5:1 contrast) | `160 12% 34%` (≥ 4.5:1 contrast) | 12px uppercase monospace telemetry labels |
| `--hud-phosphor` | `145 85% 52%` (`#1EEB73`) | `148 72% 28%` (`#147A42`) | `ONLINE` / `ACTIVE` / positive telemetry mark |
| `--hud-amber` | `24 95% 56%` (`#F97324`) | `22 88% 40%` (`#C04D0C`) | `ACTION` / attention / tactical highlight (Image 2 & 4) |

### 7.2 Shared Tactical & Bento Primitives (`src/components/hud/`)
1. **`<HudFrame>`:** Draws the `1px` hairline border, `aria-hidden="true"` corner registration brackets (`┌ ┐ └ ┘`), header strip, and status pill (`ACTIVE` / `SYNCED`, always text + symbol, never colour alone).
2. **`<TelemetryRail>`:** A vertical or horizontal strip of aligned tabular figures (`label`, `value`, `unit`, `delta`, optional threshold bar) built on `font-variant-numeric: tabular-nums`.
3. **`<BentoControlTile>` (RivianOS 2 / Tesla style):** Tactile squircle card for interactive controls (Money Hub salary slider, Tax Calculator pension % toggle, Watchlist week/month switch, Hide Figures privacy toggle).
4. **`<SpatialPointCloud>`:** Extends the 2D/3D canvas particle projection engine already in [`DotMatrixGlobe.tsx`](file:///Users/dhyanshyam/Projects/DShyam3.github.io/src/components/dot-matrix/DotMatrixGlobe.tsx) to render your `semantic_nodes` as an interactive 3D constellation on Home (`Nexus Core`) and `/explore` (Image 3 & 5 style), with an instant fallback to accessible 2D list/Bento view under `prefers-reduced-motion` or narrow screens.
5. **`<TimelineScrubber>`:** A thin bottom dock (`40px` tall) showing real record density across years (`2018 — 2026`). Scrubbing filters the active view or graph by `event_date` / `recorded_at`.

---

## 8. Phased Implementation Plan & Realistic Effort Ranges

Every phase ships incrementally behind passing CI gates (`npm run lint`, `npm run typecheck`, `npm run typecheck:functions`, `npm test`, `npm run build`, `npm run ship-check`) without breaking existing URLs or workflows.

| Phase | Scope & Deliverables | Fast-Track Estimate (AI-Paired, Reusing Existing Stack) | Conservative Full-Hardening Estimate |
|---|---|---:|---:|
| **Phase 0: Scope, Branch Audit & Evaluation Fixtures** | • Audit `codex/assistant-integration-2026-11-02` for reusable code.<br>• Reconcile backlog with `REHAUL_PLAN.md` and carry forward open risks from `STATE.md` (warm-up payload, save/reload races).<br>• Author the **10-Question Deterministic Evaluation Suite** (§9.1) as Vitest fixtures.<br>• Lock token contrast and 3-screen wireframe layouts for Home, Finance, and Travel. | **2–3 days** | **1–2 weeks** |
| **Phase 1: Standalone PWA & Adaptive 3-Screen Shell** | • Add `manifest.webmanifest`, iOS standalone meta tags, safe-area CSS variables, and safe Service Worker update flow.<br>• Build `<AdaptiveWorkspace>` using installed `react-resizable-panels` (MacBook 3-pane / iPad Duo 2-pane) and `vaul` (iPhone bottom sheets).<br>• Build `<HudFrame>`, `<TelemetryRail>`, and `<BentoControlTile>` in `src/components/hud/`.<br>• Upgrade `AppShell.tsx` and convert one pilot collection (`Books`) to validate keyboard focus, Escape order, and touch targets. | **4–6 days** | **2–3 weeks** |
| **Phase 2: Shared Semantic Layer & First Connected Pilot** | • Create `50_semantic_index.sql` (`semantic_nodes`, `semantic_links`, RLS, `search_tsv`, `pgvector`) via `migration` subagent.<br>• Build versioned allowlist serializers (`src/lib/semantic/serializers.ts`) and `@mention`/relationship extractors with unit tests.<br>• Ship the global Command/Ask Bar (`NexusCommandBar` using `cmdk`) + `supabase/functions/assistant/index.ts` (read-only tools, source citations, zero-key lexical fallback).<br>• Connect pilot workflow across **Home ↔ Ask ↔ Finance ↔ Travel**. | **6–8 days** | **3–5 weeks** |
| **Phase 3: Broader Domain Rollout & `Explore` Surface** | • Roll out serializers, docked Right Inspector + Backlinks rail, and Comparison Canvas across all 9 collections, Watchlist, and Inventory/EDC.<br>• Build `/explore` (full-screen 3D/2D `<SemanticPointCloud>`, relationship graph, and `<TimelineScrubber>`).<br>• Apply Rivian/Treasury `<BentoControlTile>` polish to Finance surfaces (`DashboardSurface`, `MoneyHubSurface`, `TaxCalculatorSurface`). | **7–10 days** | **4–8 weeks** |
| **Phase 4: Device Verification, Security Audit & Release** | • Run the 10-Question Evaluation Suite against retrieval and tool execution.<br>• Verify iPhone (portrait/landscape + keyboard open), iPad (full + split multitasking), and MacBook (pointer/keyboard + 200% zoom) in both browser and installed PWA modes.<br>• Test TrueLayer OAuth return flow, sign-out cache purge, expired session handling, and `security/AI-CHECKLIST.md`.<br>• Spawn `scribe` to update `FEATURES.md`, `REHAUL_HISTORY.md`, and `STATE.md`. | **3–4 days** | **2–4 weeks** |
| **Total Range** | **End-to-End Connected Personal OS** | **~4.5 – 6 weeks** | **12 – 22 weeks** |

*(Note: Why the two columns? The 4.5–6 week column reflects direct AI-assisted implementation reusing your already-installed `cmdk`, `vaul`, `react-resizable-panels`, `DotMatrixGlobe` engine, and `src/lib/finance/` modules; the 12–22 week column from the GPT plan accounts for solo human pacing, extended design rounds, and optional scope expansion.)*

---

## 9. Verification & Evaluation Plan

### 9.1 The 10-Question Assistant & Retrieval Evaluation Suite (`src/lib/semantic/eval.test.ts`)
Before the assistant or semantic search is declared ready, it must pass automated tests against seeded records covering these 10 cases:
1. **Exact Match:** Find an exact book, show, or saved article by title via `search_tsv`.
2. **Conceptual / Synonym Match:** Find related beliefs, thoughts, and books when the query uses different phrasing.
3. **Deterministic Finance Summary:** Summarise recorded spending or position for a specified period using `get_position` / calculator output—never estimating arithmetic in prose.
4. **Provenance & Drilldown:** Explain a calculated figure (e.g., Money Hub Berlin surplus or Student Loan balance) and return deep links to the supporting surface/records.
5. **Cross-Domain Graph Traversal:** Find all records (`photos`, `notes`, `cities`) linked to a specific place or topic via `semantic_links`.
6. **Multi-Domain Scenario Planning:** Assess a hypothetical spend or trip scenario (`run_spend_scenario`) while explicitly asking for missing assumptions rather than inventing prices.
7. **Honest Absence:** Answer a question whose required data is not recorded by stating it is unrecorded—never fabricating a zero or false claim.
8. **Stale / Contradictory Qualification:** Surface `refreshed_at` and qualify answers when underlying sync data or rates are stale or unverified.
9. **Strict Authorization Boundary:** Refuse to retrieve or leak `visibility = 'admin'` nodes or finance tool outputs to an anonymous or non-admin session.
10. **Prompt-Injection Immunity:** Ignore adversarial instructions embedded inside a retrieved article, link description, or note body (treating retrieved text strictly as passive data).

### 9.2 Device, Accessibility & Security Gate Checklist
- [ ] **Checks Green:** `npm run lint` (0 errors, 0 warnings), `npm run typecheck`, `npm run typecheck:functions`, `npm test`, `npm run build`, `npm run ship-check`, and `graphify update .`.
- [ ] **Supabase Advisors:** `get_advisors(type: "security")` and `get_advisors(type: "performance")` clean after `50_semantic_index.sql` migration, with all write policies using `(SELECT public.is_admin())`.
- [ ] **Three-Screen Physical / Viewport Matrix:** iPhone (`375px` portrait, landscape, software keyboard open, Dynamic Island safe areas), iPad (`768px–1024px` split view and full Duo mode), MacBook (`1440px+` 3-column workspace, keyboard-only navigation, `200%` zoom, `Larger` display mode).
- [ ] **No-Model & Offline Resilience:** All non-chat navigation, lexical search, calculators, and CRUD forms work with no LLM key configured; offline transition shows a clear status indicator without crashing.

---

## 10. Decisions Required to Kick Off Phase 0 / Phase 1

1. **Theme Default:** Should the dark **Obsidian Tactical HUD** be the default experience (with **Technical Daylight** light mode available via toggle), or keep sunrise/sunset auto-switching (`useTimeBasedTheme`)?
2. **Public vs. Admin Assistant Scope:** Should anonymous visitors have access to **deterministic semantic search + read-only public Q&A** (rate-limited per IP, strictly scoped to `visibility = 'public'`), or should LLM chat generation be Admin-only while public visitors get instant semantic search and graph exploration?
3. **First Pilot Workflow:** Confirm starting with **Phase 0 + Phase 1** (auditing `codex/assistant-integration-2026-11-02`, adding PWA standalone support, and building the `<AdaptiveWorkspace>` + `<HudFrame>` shell on Home, Books, Travel, and Finance).
