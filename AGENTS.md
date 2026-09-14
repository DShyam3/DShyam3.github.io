# Project rules

## Always fix linting issues (errors and warnings)

After modifying any code file, run `npm run lint`. The lint step must end with
0 errors and 0 warnings before the turn ends. Fix the offending code, or adjust
`eslint.config.js` where the rule itself is wrong.

## Always close out `STATE.md` when work lands

When a task closes -- the work is in the tree and the checks below are green --
rewrite `STATE.md` before the turn ends. Do it without being asked and without
offering first: a handoff written only when someone remembers to ask for it is
the one that is missing when the next session opens cold.

Spawn `scribe` to do it, per *Where a finished item goes* -- the same trigger
already in the delegation table. That section governs what moves where;
this rule only fixes *when*, which is: now, not at some later tidy-up.

The bar is a task closing, not a turn ending. Answering a question, running a
check, or abandoning an attempt closes nothing and needs no rewrite. What
counts is a line that was true in `STATE.md` and is not true any more.

Three things make the rewrite honest, and they matter more than doing it:

- **Say what is still open in the same breath as what closed.** A `STATE.md`
  listing only wins reads as finished work when it is not.
- **Never promote local to done.** A migration applied to the local stack is
  not applied; an uncommitted fix is not shipped. Name which.
- **Carry unverified findings forward as unverified.** Something automation
  could not check is not something that passed.

## graphify

This project has a graphify knowledge graph at `graphify-out/`.

- Before answering architecture or codebase questions, read `graphify-out/GRAPH_REPORT.md` for god nodes and community structure
- If `graphify-out/wiki/index.md` exists, navigate it instead of reading raw files
- For cross-module "how does X relate to Y" questions, prefer `graphify query "<question>"`, `graphify path "<A>" "<B>"` or `graphify explain "<concept>"` over grep -- these traverse the graph's EXTRACTED + INFERRED edges instead of scanning files
- After modifying code files, run `graphify update .` to keep the graph current (AST-only, no API cost)

## Checks before shipping

- `npm run lint` -- 0 errors, 0 warnings
- `npm run typecheck` -- covers `src` only
- `npm run typecheck:functions` -- `deno check` over `supabase/functions`, which no
  npm script reaches; Deno is the runtime they actually run on
- `npm run build`
- `npm run ship-check` -- should-i-ship launch-readiness scan, writes to `.should-i-ship/` (gitignored)
- `security/AI-CHECKLIST.md` -- the vibe-check audit, run on request: "Run the security audit defined in security/AI-CHECKLIST.md against this project"

## Which file to read, and which to write

Six documents, one job each. Reading the wrong one wastes a context window;
writing to the wrong one is how a plan rots into a diary.

| File | Holds | Lifetime |
|---|---|---|
| `AGENTS.md` | rules that bind every change | permanent |
| `REHAUL_PLAN.md` | what is left, and the decisions behind it | until the decision changes |
| `REHAUL_HISTORY.md` | the audit and finished phases | append-only |
| `FEATURES.md` | what the site does, present tense | matches the tree |
| `DESIGN_SYSTEM.md` | how the UI is built | permanent |
| `STATE.md` | branch, last green checks, next task, blockers | one session |

`STATE.md` is the handoff. Read it first; it is short by construction. It is a
pointer rather than a record -- where it disagrees with `REHAUL_PLAN.md`, the
plan wins, and the fix is to correct `STATE.md`.

Three rules keep it from becoming a fourth plan document:

- **Rewrite it, never append.** Every line is stale after the work it describes
  lands.
- **Cap it at ~60 lines.** Over that, a task has finished without being closed:
  move it into `REHAUL_HISTORY.md` and delete the lines.
- **Two writers only** -- the end of a session, and the moment a task closes.
  Both are obligations rather than opportunities; see *Always close out
  `STATE.md` when work lands*. No decision is recorded here; decisions go to
  the plan with their reasoning.

## Where a finished item goes

A plan that keeps its finished items becomes a diary, and a diary is not read.
So the plan holds only what is left -- but deleting a line loses the reasoning,
which is the expensive half. Finishing something is therefore a move, not a
deletion:

```
REHAUL_PLAN.md          the line is deleted when the work lands
      |
      +--> FEATURES.md        always. present tense, what it now does
      |
      +--> REHAUL_HISTORY.md  only if the work closed a decision
```

- **`FEATURES.md` always.** If the change is not visible to someone using the
  site, it was not a feature and belongs in neither file -- just delete the
  plan line.
- **`REHAUL_HISTORY.md` only when a decision was closed.** Why balances are
  anchored rather than floating; why extraction runs in the browser. A finished
  task that settled nothing adds length without adding reasoning, and history
  earns its length by being worth re-reading.
- **Write `FEATURES.md` for a reader, not for an agent.** Present tense, no
  dates, no rationale, no phase numbers. It is the only document that answers
  "what does this actually do" without reading the plan, which makes it the
  one worth keeping honest.
- **Never claim in `FEATURES.md` what is not in the tree.** It describes the
  built thing. Anything aspirational stays in the plan until it ships.

## Delegating work

**Spawn subagents in this project without asking first.** This section is the
standing authorisation. The roster lives in `.claude/agents/`; each definition
carries its own model, so the tiering below happens by picking the right agent
rather than by remembering to set a flag.

| Agent | Model | For |
|---|---|---|
| `locator` | Haiku | where is X, what calls Y, which files touch Z. Consults graphify before grepping |
| `builder` | Sonnet | bounded implementation against a pattern that already exists |
| `finance-calc` | Sonnet | a pure module under `src/lib/finance/` plus its paired test |
| `migration` | Sonnet | a schema file and its migration, with the RLS and grant checklist |
| `reviewer` | Opus | a diff judged against this project's rules, not generic ones |
| `scribe` | Haiku | moving a finished item through the document flow above |

Reach for the smallest model that can do the job. Cost is the obvious reason;
the better one is that a locator returning a `file:line` table pollutes far
less context than one that reasons about the code on the way past.

### When to spawn, rather than decide case by case

The roster above is not a menu to consider. These triggers are the default
behaviour; doing the work inline instead is the exception, and needs a reason.

| Trigger | Spawn |
|---|---|
| The answer is a list of locations spanning more than one directory or naming convention | `locator` |
| Two or more independent questions | one `locator` each, in a single block, in parallel |
| An edit across three or more files against a pattern that already exists | `builder` |
| A figure the app shows is new or changing | `finance-calc` |
| Any schema, policy, grant or index change | `migration` |
| Before a commit touching finance, the database, or three or more files | `reviewer` |
| Work landed, checks green | `scribe` |

**Judge the trigger by the question, not by how easy the search turns out to
be.** "It was only one grep" is knowable only after running it, and by then the
work is done inline -- which is how the rule gets bypassed every time. The one
exception is narrow enough to check beforehand: you already know the file and
need only a line number in it.

**A message with two or more independent questions fans out completely.** Every
question gets its own `locator`, in one block, including the ones that look
trivial. Answering one inline and delegating the other costs a round trip and
throws away the parallelism that made delegating worth it.

**Say which agent ran.** The interface shows a subagent block but never the
model, so the reply has to carry it: name the agent and its tier -- "`locator`
(Haiku) found three call sites" -- before the answer. Without that line there
is no way to tell delegation from an inline grep, and no way to tell whether
the cheap model is being used at all.

### The same roster, three times

The roster exists once per tool, because no two of them read the same format:

| Tool | Location | Format | Model lever |
|---|---|---|---|
| Claude Code | `.claude/agents/*.md` | YAML frontmatter + markdown body | `model: haiku \| sonnet \| opus` |
| Gemini CLI | `.gemini/agents/*.md` | YAML frontmatter + markdown body | `model:` — a model id, verify it against the installed CLI |
| Codex CLI | `.codex/agents/*.toml` | TOML, body in `developer_instructions` | `model_reasoning_effort = "low" \| "medium" \| "high"` |

**Change one, change all three.** This is the same standing hazard as the two
watchlist sync implementations in `README.md`, and it is accepted for the same
reason: there is no format the three tools share, so the choice is duplication
or only one of them working.

Duplication is survivable here only because the bodies are thin. The substance
lives in this file; an agent definition says which rules apply to it and what
to run before reporting, not what the rules are. Keep it that way -- the moment
a definition starts restating a rule, three copies of that rule start drifting.

### What stays on the main thread

Delegation is not free -- a spawn starts cold and re-derives whatever it is not
told. These are the exceptions to the trigger table above, not a competing
default. Do the work inline when:

- The answer is already in context. Re-deriving it costs more than using it
- The task is one edit to one file you have already read
- You know the file already and need only a line number from it
- The decision is architectural, or touches the deterministic/model boundary in
  Part 0.5. Those are judgement, and judgement does not delegate well
- You would have to explain more than the work is worth. If the brief is longer
  than the diff, write the diff

### Running them in parallel

Independent calls issued in one block run at the same time. Two rules decide
whether that is safe:

- **Reads always parallelise.** Four `locator` spawns answering four unrelated
  questions is the cheapest thing in this document -- one round trip, four
  Haiku contexts, and the main thread eats only the four tables
- **Writes parallelise only across disjoint file sets.** Two agents editing the
  same file will clobber each other. Either split the work so no file appears
  in two briefs, or give one of them `isolation: "worktree"` and merge after

A useful shape: fan out `locator` arms to map the ground, decide on the main
thread, then fan out `builder` arms over file sets that do not overlap, then one
`reviewer` over the whole diff. Reads wide, decision narrow, writes wide,
review narrow.

### The brief

A subagent cannot see this conversation. The brief carries the task or the
spawn is worse than doing it inline:

- **The files, by path.** Not "the finance components"
- **The pattern to copy**, named by an existing file
- **The acceptance command** -- `npm run lint && npm run typecheck`, plus
  `npm run typecheck:functions` for anything under `supabase/functions/`
- **What not to touch**, where it is not obvious
- **The edge cases**, for anything computing a figure

Do not point a subagent at `REHAUL_PLAN.md` and expect it to find its own task.
That is 1,300 lines spent re-deriving context the main thread already has.

Report what came back honestly. A subagent can be wrong, and a confident table
of `file:line` rows is exactly as convincing when the file does not exist.

# How AI is used in this project

Architectural rules, not preferences. Summarised as rules in `REHAUL_PLAN.md`
Part 1; the argument that produced them is in `REHAUL_HISTORY.md` Part 4,
sections 7.P, 7.Q and 7.F.

- **No feature may hard-depend on a model.** With no API key set, everything
  works except the chat box. Every figure the app shows is computed locally
  from rows, deterministically, and covered by tests.
- **A model may choose, phrase and explain. It may not compute.** Anything
  that must be reproducible -- a balance, a projection, the standing summary --
  is rules over rows, never generated prose. A wrong number reads exactly like
  a right one, so the arithmetic never leaves the codebase.
- **Documents are stored, never sent.** PDFs are archived for download; their
  figures are captured into columns and rendered natively. Extraction runs in
  the browser (`pdf.js` for a digital PDF's text layer, templates for layouts
  that recur, Tesseract WASM only for photographed images), so a document is
  parsed before it is uploaded anywhere.
- **What reaches a model is a projection, built as an allowlist.** List what to
  include; never take a row and strip fields, because a denylist leaks whatever
  is added to the table next. Never sent: National Insurance number, account
  and sort numbers, card numbers, addresses, employer references, payroll
  numbers, dates of birth, any third party's name.
- **Providers are registry rows, not integrations.** There are two wire
  protocols -- OpenAI-compatible and Anthropic -- and `src/lib/finance/llm.ts`
  translates both. Adding a vendor is a row: id, protocol, base URL, model,
  which secret holds the key. The registry stays server-side; a client that
  could name a URL rather than an id would be an SSRF hole.

# Security rules

Copied verbatim from benavlabs/vibe-check so this stays diffable against
upstream. They are non-negotiable for code generated in this project, read with
the shape of this project in mind:

- **This is a static React SPA on GitHub Pages.** There is no server and no
  middleware, so "set these headers via a single global middleware" cannot be
  followed literally. `SECURITY.md` records what is set instead (CSP via a
  build-time `<meta>`, Referrer-Policy via `<meta>`, a JS frame guard standing
  in for `X-Frame-Options`) and what is out of our control. Read it before
  acting on the Security Headers section.
- **The backend is Supabase**, so the Database and Authorization rules are the
  load-bearing ones here: RLS on every table, `is_admin()` on every write, and
  no policy left as `USING (true)` for anything but public reads.
- **`VITE_SUPABASE_URL` and the publishable key belong in the client.** The
  anon key is public by design and is safe only because RLS is correct --
  which is why the Database rules matter more here than the Secrets ones. No
  other secret may carry the `VITE_` prefix.
- Firebase, Stripe, Python `pickle` and the Express/Next specifics do not apply
  today. They are kept so the file diffs cleanly if the stack grows.

## Secrets

- NEVER put API keys, database credentials, or tokens in frontend code (anything under src/, app/, pages/, components/, public/)
- NEVER put secret keys in environment variables prefixed with NEXT_PUBLIC_, VITE_, or REACT_APP_ (these are bundled into the client)
- NEVER hardcode credentials in source files. Use environment variables loaded server-side only
- The .env file MUST be in .gitignore before the first commit. Verify this before creating any .env file
- Use .env.example with placeholder values only, never real credentials

## Database

- Enable Row Level Security on EVERY Supabase table before deployment. Default policy: deny all. Write explicit policies scoped to auth.uid()
- NEVER set a Supabase RLS policy to `USING (true)` or `FOR ALL` without a WHERE condition
- Firebase Security Rules MUST require `request.auth != null` and scope access to `request.auth.uid`
- NEVER use `pickle.loads`, `pickle.load`, or any deserialization on user-supplied data. Use JSON for all network data exchange

## Authentication and Authorization

- EVERY API route that returns or modifies user data MUST have authentication middleware that runs BEFORE the handler, not inside it
- Unauthenticated requests to protected endpoints MUST return 401
- EVERY route that takes a resource ID MUST verify the authenticated user owns that resource: `current_user.id == resource.owner_id`. This is a SEPARATE check from authentication
- Admin endpoints MUST verify admin role and return 403 for non-admin users
- Session cookies MUST set `httpOnly: true`, `secure: true`, and `sameSite: 'lax'`

## Input and Output

- NEVER concatenate user input into SQL queries. ALWAYS use parameterized queries or ORM methods
- NEVER use `dangerouslySetInnerHTML`, `v-html`, or `innerHTML` with user-supplied content unless it is first sanitized with DOMPurify
- ALL user input MUST be validated server-side. Client-side validation is for UX only
- File uploads MUST validate file type by reading magic bytes, not by checking the filename extension. Rename all uploads to UUIDs server-side. Store on a separate domain (S3, R2, GCS), never on the app origin

## URL Fetching (SSRF Prevention)

- If the application fetches URLs provided by users (link previews, image proxies, URL validators), it MUST:
  - Block all private/internal IP ranges: 127.0.0.0/8, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.0.0/16, ::1
  - Allow only http and https schemes
  - Resolve the hostname and check the IP BEFORE making the request

## Security Headers

- Set these headers on ALL responses via a single global middleware:
  - `Content-Security-Policy: default-src 'self'` (adjust as needed for your app)
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains`
  - `X-Frame-Options: DENY`
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
- In Express, use the `helmet` package. In Next.js, set headers in next.config.js

## CORS

- NEVER set CORS origin to `*` (wildcard). Use an explicit allowlist of your actual domains
- NEVER combine `origin: '*'` with `credentials: true`

## Rate Limiting

- Login, registration, and password reset endpoints MUST have rate limiting (block after N failed attempts per IP within a time window)
- Do NOT trust X-Forwarded-For for rate limiting unless behind a trusted reverse proxy

## Payments

- Stripe webhook endpoints MUST verify the signature using `stripe.Webhook.construct_event` (or equivalent) on every request. Reject any request with an invalid or missing signature
- Webhook handlers MUST track processed event IDs and skip duplicates (idempotency)
- Handle the full event lifecycle: payment_intent.succeeded, invoice.payment_failed, customer.subscription.deleted, customer.subscription.past_due

## Error Handling

- NEVER expose stack traces, SQL errors, file paths, or library names in API responses
- Production error responses MUST return only generic messages: `{"error": "Something went wrong"}`
- Full error details go to server-side logs only
- Debug mode / development error pages MUST be disabled in production

## Password Hashing

- ALWAYS use bcrypt, Argon2, or scrypt for password hashing
- NEVER use MD5, SHA-1, or plain SHA-256 for passwords

## Dependencies

- Before installing any package, verify it exists on the official registry with a reasonable download count and history
- Pin exact versions in package.json / requirements.txt (no ^ or ~ in production)
- Commit lock files (package-lock.json, poetry.lock, yarn.lock)
