# Braidly — Collaborative AI Vibe-Coding Workplace

> **Living document.** Read this file at the start of every session to pick up where we left off.
> Last updated: Session 38 (2026-09-16)

---

## 1. The Vision

A web app where a **team and an AI brainstorm an app idea together in a chat**. When the
discussion reaches a conclusion, the AI:

1. Generates a **PRD (Product Requirements Document) per team member** — splitting the app
   into modules (frontend, backend, database, etc.) with clear owners.
2. Also generates **shared API contracts** — the interfaces every module must follow so
   they can snap together later (this is the secret to making integration work).
3. Each member **vibe-codes their module** and submits the files to the cloud.
4. An **AI Tech Lead (orchestrator)** takes all submitted modules, checks them against the
   contracts, assembles them, fixes integration errors, and delivers a **working app**.

**The novel gap:** multiplayer vibe-coding exists (Replit, Lovable, Bolt) and multi-agent
orchestration exists (LangGraph, CrewAI, Devin), but nobody has stitched the *full loop*:
human team discussion → AI-distributed PRDs → humans each build → AI integration into one
working app. That end-to-end loop is our product.

## 2. The 5-Stage Pipeline

| Stage | Name | What happens | Feasibility |
|-------|------|--------------|-------------|
| 1 | **The Debate Room** | Team + AI discuss the idea in real-time chat | Easy — chat app + LLM participant |
| 2 | **The PRD Factory** | AI converts discussion into per-person PRDs + API contracts (structured JSON output) | Easy — LLM structured output |
| 3 | **Vibe Coding** | Each person builds their module in their own workspace | Easy — in-browser editor or git repo per person |
| 4 | **File Submission** | Modules uploaded to cloud (git / object storage) | Easy |
| 5 | **The AI Tech Lead** | Orchestrator assembles modules, verifies contracts, runs build, fixes errors in a loop, delivers working app | **Hard — the real risk** |

## 3. Honest Constraints & Reality Check

- **Builders:** 1 person (the founder), no money to invest. $0 budget.
- **Hardware:** Ryzen 7, 16GB RAM, 512GB SSD, RTX 3050 **4GB VRAM** (Windows).
  - 16GB RAM + Ryzen 7: plenty for the whole dev stack.
  - 4GB VRAM: cannot run big models locally on GPU. Best local model = `qwen2.5-coder:3b`
    (fits fully in VRAM, 25–40 tok/s). 7B models partially offload to RAM (8–15 tok/s —
    usable for background jobs).
- **Known hard problems:**
  1. **Integration is the bottleneck, not the chat.** Fix: contract-first development —
     PRDs generate API schemas + mocks, and the orchestrator's job is making contracts true.
  2. **Code quality variance.** Vibe-coded modules are uneven → automated lint/test/fix loop.
  3. **Context & memory.** Multi-session projects outgrow chat context → this document is
     the persistent project memory, plus a living spec.

## 4. The $0 Strategy (no API costs)

Never pay for AI until the product earns it. Architecture rule: **ALL AI calls go through a
single LLM gateway** (one file). Today it points at free endpoints; tomorrow it can switch to
paid APIs without touching the rest of the code.

Free options (as of mid-2026):
- **Groq** (free): `llama-3.3-70b-versatile` at ~276–320 tok/s — the main "smart brain".
  Limits: ~30 req/min, ~14,400 req/day (2026 — re-verify at build).
- **Google AI Studio** (free): Gemini Flash models, up to 1M-token context — great for
  feeding the whole discussion + code into one reasoning step. Note: free-tier prompts may
  be used for training → don't feed proprietary code.
- **OpenRouter free models** (free, 20 RPM / 50 RPD, 1,000/day after one-time $10 top-up):
  automatic fallback when Groq rate-limits.
- **Cerebras** (free): ~1M tokens/day — batch/heavy processing.
- **Mistral experiment tier** (free): ~1B tokens/month.
- **Ollama + local models** (free, runs on our laptop): `qwen2.5-coder:3b` for repetitive
  local work (file edits, JSON, syntax fixes).

**Model routing strategy:** Groq for smart reasoning → OpenRouter fallback on 429 →
local Ollama for cheap repetitive work.

## 5. Tech Stack (MVP)

> **Full detail in `TECH-SPEC.md`** — runtime, providers, API keys, storage, deployment.
> Summary here:

- **Backend:** Node.js + Express (or plain Node http) — single server.
- **Frontend:** Single-page vanilla HTML/CSS/JS served by the server (no build step for v1 —
  simplest possible on this hardware).
- **AI:** LLM gateway module → Ollama (local, default) with optional Groq/OpenRouter.
- **Storage:** JSON files on disk for MVP (no database). Upgrade to SQLite later.
- **Orchestrator:** Node script that reads submitted module folders, runs build/verification,
  reports integration status.
- **Proof app:** a tiny **to-do app** (frontend + backend) built *through the platform* to
  prove the whole loop. Example API contract: `GET /api/tasks`, `POST /api/tasks`.
- **Delivery surfaces (decided 2026-08-14):** the whole pipeline lives in a UI-independent
  **core**; surfaces are thin shells — (1) **Electron desktop app** embedding Monaco
  (primary), (2) **VS Code extension** (upgrade surface, BYOK), (3) **IDE fork** (only
  post-funding, re-hosts the same core). See Decision Log.

## 6. The Per-Person Brief (PRD + Instructions Doc)

> **Core design decision (2026-08-08):** when the PRD Factory assigns work, every "team
> member" gets BOTH a PRD **and** a strict Build Instructions doc. This is the single most
> important architecture decision — it's what makes Stage 5 (AI Tech Lead integration)
> *tractable*. Integration flips from "make sense of unknown code" to "mechanically
> verify + snap together".

### Why this works

The orchestrator AI is only as smart as its constraints are tight. If each person codes
against a tight spec, the seams are already defined before a line of code is written.

### The anatomy of each person's brief

| Part | Content | Purpose |
|------|---------|---------|
| **0. Shared Contract** (identical for every member) | API endpoints + request/response schemas, shared data models, exact stack & versions, repo layout, DO-NOT-TOUCH file list | Single source of truth everyone codes against |
| **1. PRD — this person's scope** | Module name, owner, user stories, acceptance criteria, UI/behavior description | What to build |
| **2. Build Instructions — how it must fit** | Exact file names + entry points, required exported signatures, mocks of other modules to code against, dependency whitelist, lint rules, self-test steps | How to build it so it snaps in |
| **3. Machine Contract (`contract.json`)** | The same spec as machine-readable JSON (endpoints, schemas, file layout, exports) | Lets the orchestrator + test harness verify mechanically |
| **4. Definition of Done checklist** | e.g. "contract tests pass locally", "no files outside my folder", "no `node_modules` submitted" | Submit only when every tick passes |

### The killer feature: auto-generated contract tests

The PRD Factory also generates a **test file per person** that mocks the *other* modules
and tests *their* module against the contract. Each member runs it locally before
submitting → their module already passes by submission time. The AI Tech Lead just
re-runs the same tests and fixes only the genuine seams (CORS, env vars, ports, wiring).

### The sweet spot

Instructions must be strict enough to constrain (file names, signatures, schemas, versions)
but not so rigid that vibe coding becomes unpleasant. **Hard rules live in the machine
contract; judgment stays in the PRD.**

## 7. MVP Build Plan (stage by stage)

| Session | Stage | Deliverable |
|---------|-------|-------------|
| 1 | Planning | This document ✅ |
| 1-2 | Chat room + AI facilitator | Working chat UI where team + AI discuss an idea |
| 3 | PRD factory | "Finalize Discussion" button → per-person PRDs + API contracts (JSON) |
| 3.5 | Landing Page | Entry page + new chat + past sessions list |
| 4 | Module upload | Each "member" submits files/folders into the project |
| 5 | AI Tech Lead | Script assembles modules, checks contracts, runs the app |
| 6 | Proof run | Team builds the to-do app through the platform; it runs end-to-end |
| Later | Polish | In-browser editors, live preview, real-time collab, pricing model |

## 8. Safe Execution Rules (for every AI session)

- All code + terminal commands stay **inside the project folder**.
- No global package installs, no touching files outside the project.
- No `git push` / `git commit` / anything irreversible without explicit user permission.
- Any genuinely risky command → ask first.
- Everything is local; nothing leaves the machine unless the user asks.
- The user can see and revert every change in the transcript.
- **MANDATORY: After every session or significant change, update `docs/history.md`, `docs/checklist.md`, and `docs/PROJECT.md` with what was done, decisions made, and current status. This is non-negotiable.**

## 9. Session Workflow (how we continue across sessions)

**Why this matters:** chat sessions expire (~1 hour window); the files on disk are
permanent. `PROJECT.md` is the ONLY durable memory — a future AI session knows the
project only through what's written here + the files in the folder.

1. New session starts → read this `PROJECT.md` + `instructions.md` + inspect files.
2. Check "Current Status" below; continue from the next open item.
3. Update "Current Status" + this doc at the end of each session.

## 10. Current Status

- [x] Idea validated (market gap: full-loop team vibe-coding doesn't exist yet)
- [x] Feasibility confirmed on the founder's hardware, $0 budget plan defined
- [x] This project handoff document created
- [x] `instructions.md` created — brief that lets ANY other vibe coding tool continue this project safely
- [x] `TECH-SPEC.md` created — complete tech spec (frontend, backend, providers, keys, storage, deployment, tooling)
- [x] `checklist.md` created — master checklist of everything included in the project
- [x] `GOVERNANCE.md` created — failure-mode rules distilled from the two vibe-coding research docs (security constitution, supply-chain, anti-dark-logic, test, orchestrator, human-process rules)
- [x] Delivery model decided: **core + thin shells** — Electron desktop (Monaco) primary,
      VS Code extension upgrade, IDE fork only post-funding (Decision Log 2026-08-14)
- [x] `hackathon.md` created — AI Builders Hackathon submission checklist (all mandatory
      deliverables mapped to the challenge terms)
- [ ] **Hackathon target:** build the working product (Stages 1–5) + public repo + demo
      video + deck — see `hackathon.md`
- [x] `UI-API-RESEARCH.md` created — pre-Stage-1 research: chat UI patterns, WebSocket
      protocol, LLM streaming + structured-output strategy (locked decisions inside)
- [x] **Stage 1 — Debate Room built & tested** (`npm start` → http://localhost:3000):
      chat UI (vanilla HTML/CSS/JS, dark), WebSocket (`ws`), AI facilitator via the LLM
      gateway (Groq → OpenRouter → Ollama streaming), presence + typing, 30-s heartbeat,
      reconnect with backoff, JSON persistence, security hardening (CSP/headers, input
      validation, REST + WS rate limits, no error leakage). Smoke test: `node test/smoke.js`
- [x] **Get live AI replies:** `GROQ_API_KEY` added to `.env`. Discovered model split needed:
      `groq/compound-mini` for chat streaming (correct content field), `openai/gpt-oss-20b`
      for structured output (json_object mode). Live AI replies confirmed working.
- [x] **Stage 2 — PRD Factory (partially built):** POST `/api/finalize` endpoint added,
      "Finalize Discussion" button in sidebar, briefs display in UI, `prd-factory.js` with
      schemas and core functions. Needs end-to-end testing.
- [x] **Stage 3 — Vibe Coding (MVP built):** module assignment view, brief display,
      simple code editor (textarea), file submission to `data/submissions/<module>/`,
      WebSocket broadcast for workspace updates, OpenRouter fallback added to
      structured output chain
- [x] **Stage 4 — File Submission (built):** multer upload, drag-drop, file list/delete,
      folder-per-module storage, WebSocket broadcast for file sync
- [x] **Landing Page:** entry page + new chat + past sessions list (built 2026-08-26, Session 21). Landing page at `/`, debate room at `/app?session=<id>`. Past sessions saved to `data/sessions/`
- [x] **Stage 5 — AI Tech Lead (built):** orchestrator module verifies modules against
      contracts, runs security scans (A-rules, C-rules, B-rules), runs contract tests,
      AI fix loop (≤3 attempts, minimal-diff), integration report with pass/fail/fixed
- [x] **Hackathon PPT** — `docs/ppt.md` created with 10-slide deck + 2-min demo script for AI Builders Hackathon
- [ ] Proof run: to-do app built through the platform

## 11. Decision Log

- **2026-08-08:** Idea + constraints discussed. Decided: MVP first, $0 budget, contract-first
  architecture, single LLM gateway, local Ollama for cheap work, free cloud tiers for smart work.
- **2026-08-08:** Per-person brief design locked in: PRD + Build Instructions + `contract.json`
  + auto-generated contract tests per member. Integration becomes mechanical verification.
- **2026-08-08:** User confirmed "vibe code this project" with safe execution — AI builds it
  with the user in this workspace, stage by stage.
- **2026-08-08:** Two-doc delivery model confirmed. Every team member gets exactly **two docs**
  — the PRD (what to build) + Build Instructions (how it must fit) — and "strictly followed"
  is guaranteed by the machine (`contract.json` + auto-generated contract tests per person),
  not by trust or discipline. The PRD Factory is a template machine: same packaging for every
  assignment, every size of team.
- **2026-08-08:** Cost reality settled: the real investment is **time, not money** (2–4 weeks of
  focused evenings → working demo at $0). All AI calls route through one LLM gateway so the app
  never gets trapped into paying before it earns.
- **2026-08-08:** Created `instructions.md` — a handoff brief that lets the founder move the
  project to ANY other vibe coding tool (Cursor, Windsurf, Claude Code, Replit AI, …) without
  that tool breaking the project. It is **distinct from** the per-user PRD/instructions the
  platform generates — those are product output; this is the meta-doc for building the product.
- **2026-08-08:** Created `TECH-SPEC.md` — the complete technical specification (runtime,
  frontend, backend, LLM gateway + providers, API keys, storage, deployment plan, tool
  ownership map). Free-tier limits noted as "re-verify at build time" since they change.
- **2026-08-08:** Created `checklist.md` — the master project checklist (foundation docs,
  5-stage pipeline tasks, architecture rules, $0 AI stack, setup, proof app, tool map,
  deployment/post-MVP, safety guardrails).
- **2026-08-08:** Founder supplied two research docs on vibe-coding failure modes. Distilled
  them into `GOVERNANCE.md` — the platform's enforceable rules: Security Constitution
  (A1–A10, incl. IDOR/BOLA from the Lovable incident), supply-chain whitelist vs
  slopsquatting (B1–B4), anti-Dark-Logic (C1–C5), negative+security testing (D1–D4),
  orchestrator minimal-diff/bounded-loop policy (E1–E5), human review gate (F1–F4).
  Confirms our contract-first architecture = Specification-Driven Development; this doc
  hardens it.  `contract.json` gains `securityConstitution`, `allowedDependencies`, `structure`.
- **2026-08-14:** Delivery model decided after the IDE-fork debate: **core + thin shells**.
  The whole pipeline (LLM gateway, PRD Factory, orchestrator, contracts, storage) is built
  as UI-independent Node modules — the **core**. Surfaces on top: (1) **Electron desktop
  app** embedding Monaco — primary surface; terminal/git/debugger come from the Node host,
  not the editor; MVP uses a run-output pane (full terminal via `node-pty` needs
  `electron-rebuild`); debugging deferred (vibe coding = AI reads errors, not breakpoints).
  (2) **VS Code extension** — upgrade surface; inherits terminal/git/debugger/npm/OS access
  from the host and enables BYOK (members bring their own keys; the founder never pays
  their AI bill). (3) **IDE fork** — ONLY after funding/team/profits; Theia over Code OSS;
  just re-hosts the same core. Sequencing: prove the loop in the browser first (Stages
  1–5), wrap in Electron when the pipeline works, build the extension after validation.
  "No upload" is preserved: code lives in the app's local workspace; the orchestrator
  reads it directly.
- **2026-08-16:** Entering the **AI Builders Hackathon** (solo). Submission strategy: demo
  the web surface of the core (desktop shell stays a milestone), pre-built modules for the
  live integration moment, fallback video for free-tier rate limits. Created `hackathon.md`
  mapping every mandatory requirement (submission form, working product, public GitHub
  repo, ≤5-min demo video, ≤10-slide deck) to concrete checklist items. Differentiation
  guard: contracts, verification, integration, and governance are the technical execution
  — the challenge rejects wrappers.
- **2026-08-16:** Project renamed from **TeamVibe** to **Braidly** — the product name
  everywhere (docs, hackathon submission, repo suggestion). The name evokes braiding
  each team member's module into one integrated product.
- **2026-08-16:** Pre-Stage-1 UI/API research completed → `UI-API-RESEARCH.md`. Key
  findings: (1) `ws` over Socket.IO confirmed (single room, JSON envelope protocol,
  30-s heartbeat, backoff reconnect); (2) **Groq structured outputs (`json_schema`) are NOT
  available on `llama-3.3-70b-versatile`** — Stage 2 uses `json_object` + code-side schema
  validation + retry, with Ollama (native JSON-schema) as fallback; (3) free-tier limits
  corrected: Groq ~14,400 req/day (was ~1,000), Gemini ~250 RPD after the Dec-2025 cut —
  re-verify at build and before the hackathon demo. Locked: gateway API is `chat()`
  (streaming) + `structured()` (provider-aware JSON); AI replies broadcast to all members.
- **2026-08-18:** **Stage 1 (Debate Room) built and tested.** Node 22.17.0 installed in
  `C:\Users\meher\nodejs` (official zip, SHA-256 verified against nodejs.org, no admin,
  no global install). Stack: Express + `ws` + dotenv; `llm/gateway.js` is the ONLY
  AI-call module; JSON persistence with a serialized write queue; security per GOVERNANCE
  (CSP + headers, `textContent` rendering, input validation, REST + WS rate limits, no
  error leakage, bounded payloads). Found & fixed: the host environment exports `PORT=0`
  (dotenv won't override it) → the app now uses `BRAIDLY_PORT` (falls back to `PORT`,
  then 3000). `test/smoke.js` passes: join → presence → chat echo → malformed input
  rejected → AI graceful degradation when no keys are set.
- **2026-08-19:** **Live AI replies working.** Groq API key added to `.env`. Discovered
  `llama-3.3-70b-versatile` no longer exists on Groq (HTTP 404). Switched to
  `openai/gpt-oss-20b` (~1,000 tok/s, 131K context). Organized all markdown docs
  into `docs/` folder.
- **2026-08-20:** **Model fix + Stage 2 start.** Discovered `gpt-oss-20b` is a reasoning
  model — outputs everything in `reasoning` field, not `content` (streaming broken).
  Also does NOT support `json_schema` despite docs (only `json_object`). Solution:
  split models by use case: `groq/compound-mini` for chat streaming (correct content
  field), `openai/gpt-oss-20b` with `json_object` for structured output.  Updated `llm/gateway.js`. Started Stage 2: added POST `/api/finalize` endpoint, "Finalize
  Discussion" button in sidebar, briefs display in UI, updated `prd-factory.js`.
- **2026-08-21:** **Stage 3 (Vibe Coding) MVP built.** Module assignment view, brief display,
  simple code editor, file submission to disk. Added mandatory doc-update rule (F5/rule 7)
  to GOVERNANCE.md, instructions.md, PROJECT.md. Added OpenRouter to structured output
  fallback chain.
- **2026-08-21:** **Stage 4 (File Submission) built.** multer for multipart uploads, drag-drop
  file upload, file list with delete buttons, folder-per-module storage, WebSocket broadcast
  for real-time file sync. Max 500KB per file, rejects .env/node_modules/hidden files.
- **2026-08-21:** **OpenRouter fallback fix + truncation fix + rate limit fix.** Fixed finalize
  failing due to rate limits on `openai/gpt-oss-120b` (8K TPM limit). Added `extractJSON()`
  for robust JSON extraction. Added retry on 429 with exponential backoff (5s/10s). Added
  `allam-2-7b` as secondary Groq fallback for structured output. Added 3s inter-module delay
  in server.js to avoid simultaneous rate-limit hits. Fixed truncation: increased `max_tokens`
  to 8K (compound-mini max). Added schema normalization in prd-factory.js. 4-tier structured
  output fallback: compound-mini → allam-2-7b → OpenRouter → Ollama.
- **2026-08-23:** **Full flow tested end-to-end.** Chat → Finalize → Workspace → Code editor →
  File upload all working. Fixed HTML duplicate-class bug (workspace panel always visible).
  Decided to add **Landing Page** before further testing: entry page with name input,
  "New Chat" button, past sessions list. Option A (Landing Page) chosen over Dashboard
  (Option B) and Full Auth (Option C) — hackathon judges care about the AI loop, not
  login. Landing Page ~1 hour build time, high demo impact.
- **2026-08-23:** **Stage 5 (AI Tech Lead) built.** Created `lib/orchestrator.js` — reads
  submitted modules, verifies against contracts, runs static security scans (A5 secrets,
  C1 error masking, C4 god-objects, B1/B4 dependency whitelist, B2 version pinning),
  runs contract tests, AI fix loop (≤3 attempts, minimal-diff per E1/E2), generates
  integration report (pass/fail/fixed/missing per module). Added `/api/integrate` and
  `/api/reports` endpoints. UI: Integrate button + report display with severity coloring.
- **2026-08-24:** **Clear Chat + /ai command.** Added Clear Chat button (POST `/api/clear-chat`
  endpoint wipes messages, briefs, submissions, reports). Changed AI behavior: Braidly no
  longer auto-responds — only responds when someone types `/ai` (or `/ai <question>`).
  Updated placeholder, empty state, and added Clear Chat CSS.
- **2026-08-24:** **Full PRD view with contract details.** Added `GET /api/contract/:module`
  endpoint. Rewrote PRD view to show complete contract: acceptance criteria, functional/
  non-functional requirements, file structure, exported entities, integration steps, shared
  contract (tech stack, data models, security constitution, do-not-touch list).
- **2026-08-24:** **MAX_HISTORY_MESSAGES explained.** `MAX_HISTORY=20` in server.js limits
  AI context to last 20 messages when `/ai` is called. Keeps within Groq's 8K token limit.
  Configurable via `MAX_HISTORY_MESSAGES=50` in `.env` for more context.
- **2026-08-26:** **Hackathon PPT created.** `docs/ppt.md` with 10-slide deck + 2-min demo
  script. Git repo initialized, first commit `a53edb4` (24 files, 7,415 lines).
- **2026-08-26:** **Landing Page built** (Session 21). Entry screen at `/`, debate room at
  `/app?session=<id>`, past sessions list, session archival on clear.
- **2026-08-27:** **Supabase integration** (Session 22). Auth (email/password), 7 tables
  with RLS, dual-mode storage (Supabase + JSON fallback), CSP fix for CDN.
- **2026-08-29:** **Complete UI redesign** (Session 23). 3-column Team Chat, Module
  Submission table, graph-paper grid, index-card PRD showcase, ink-charcoal palette.
- **2026-08-30:** **React UI built** (Sessions 24–25). `ui/` folder with Vite + Tailwind,
  TeamChatView, ModuleSubmissionView, DashboardView, LandingView, AuthView connected
  to real WebSocket + API + Supabase.
- **2026-09-02:** **Session 26: Project review + documentation discipline.** Lost chat
  session, user requested full project review to recover context. Read all key files,
  provided comprehensive summary. User re-confirmed mandatory documentation rule:
  every session must be logged in history.md, checklist.md, PROJECT.md. No exceptions.
- **2026-09-03:** **Session 27: React UI is now the face.** Server serves the built
  React app (`ui/dist`) at `/` and `/app` with an SPA fallback for client-side views;
  legacy `public/` UI kept as graceful fallback when the build is missing (warns at
  startup). Added `npm run build:ui`; `ui/dist/` gitignored. Verified both paths.
  Frontend is now one server, one port — no separate Vite dev server needed.
- **2026-09-03:** **Session 28: Guest/demo mode for judges.** "Skip for now —
  explore as Guest" button added to the auth screen (landing already had "Try Demo");
  both enter guest mode with no credentials — all pipeline endpoints tolerate missing
  auth. Also allowlisted Google Fonts domains in the CSP (A8/A9) so the IBM Plex Mono /
  Inter branding loads. Verified live: Landing → guest → dashboard → chat (WS).
- **2026-09-03:** **Session 29: Signup fix.** User hit "Supabase not configured. Add
  keys to .env" on Sign Up. Root cause: `dotenv.config()` reads `.env` from the
  process cwd, so a server launched from any other directory ran keyless — `.env`
  itself was fine. Pinned dotenv to the script's folder
  (`path: path.join(__dirname, '.env')`) in `server.js`. Verified: `/api/config`
  returns the anon key, and a real signup created a Supabase account → Dashboard.
- **2026-09-04:** **Session 30: Full-background braid animation.** The landing
  page's right-side ring widget became a full-screen canvas animation of 12 brand-
  colored threads (accent/ai/green/amber) weaving into one thicker rope, with a
  cinematic camera intro — macro close-up on a thread, parabolic pull-back, ambient
  wide reveal with the hero text floating on top. Code-generated (canvas), not
  video: KBs vs MBs, sharp on projectors, seamless loop, exact brand colors. New
  `ui/src/BraidBackground.jsx`; `prefers-reduced-motion` skips the flight; hero
  text fades in at the reveal. Verified live in preview (frames animating, console
  clean).
- **2026-09-14:** **Session 31: PRD cards fixed — PascalCase vs snake_case.**
  After finalize, PRD Showcase cards only showed "Module brief" with no content.
  Root cause: LLM returns PascalCase keys (`PRD`, `BuildInstructions`) while
  frontend expected snake_case (`prd`, `build_instructions`); user stories are
  objects (`{ as_a, i_want, so_that }`) not strings; BuildInstructions keys
  differ from schema. Fixed by normalizing both formats and making rendering
  generic (iterates over whatever keys the LLM returns). Added support for
  `title`, `description`, `objectives`, and object-format stories/criteria/DOD.
  Verified: new bundle served, PRD cards expandable with full content.

## 12. The Handoff Doc (`instructions.md`)

`instructions.md` is the "any AI tool can safely continue this project" brief. It is
**not** the PRD/Build-Instructions the platform will generate for its users — those are
product output for the team members; `instructions.md` is the meta-brief for whoever
builds Braidly itself in any tool. Keep the two clearly separated in this repo.

## 13. Three.js Braid Hero Background (Session 37)

The landing page hero background was rewritten from a 2D canvas animation to a full
Three.js scene. The animation follows a reference clip's visual language: glowing
colored strings converge from a point, burst outward past camera, swirl into a
vortex, then braid into a thick twisted cable with traveling energy sparks.

**4-phase perpetual cycle** (14s per cycle, seamless loop):
- Source (0–15%): braided bundle twists to a knot, thin filaments fan out
- Burst (15–40%): 26 strands spawn and shoot outward past camera
- Vortex (40–65%): strands curl into slow rotating spiral
- Braid (65–90%): strings consolidate into thick cable, energy pulses travel along strands
- Fade (90–100%): crossfade back to source

**Rendering stack:**
- TubeGeometry per strand (CatmullRomCurve3), AdditiveBlending, ACES filmic tone mapping
- UnrealBloomPass (strength 1.5, radius 0.4, threshold 0.2) for neon glow
- 26 strands in 3 color groups: green (#2FE58A), blue/cyan (#2FB8FF), dark (#16232A)
- 120 InstancedMesh bokeh particles
- DOM/CSS HUD overlay (grid lines + monospace glyphs)
- Radial gradient scrim for text readability

**Performance:** DPR capped at 2, pauses on visibilitychange, prefers-reduced-motion
fallback (static gradient, no canvas), lazy-loaded via React.lazy.

**Props:** strandCount, palette, speed — trivially tweakable without touching render logic.

## 14. Deployment Architecture: Vercel + Railway (Session 38)

Vercel **cannot** host the Braidly backend: its rewrites can't proxy WebSocket
upgrades (`/ws`), its function filesystem is read-only/ephemeral (breaks every
`data/*` write), and function timeouts would kill `/api/integrate` (120s) and
`/api/finalize` (sequential LLM calls). So the app deploys as a split:

- **Vercel** (free) — static React UI built from `ui/`; `/api/*` reverse-proxied
  to Railway via a build-time rewrite so calls stay same-origin (no CORS).
  Config lives in `ui/vercel.json` (static): the `/api/:path*` rewrite points at
  the Railway domain, which is stable once generated. (A `vercel.ts`/
  `@vercel/config` variant was tried in Session 39 and dropped — it needs a TS
  toolchain the project doesn't have, for a benefit a one-line placeholder
  replace doesn't justify.)
- **Railway** (hobby) — the existing Express + WebSocket + LLM-gateway monolith,
  essentially unchanged. WebSockets work natively; a persistent volume mounted
  at `/app/data` keeps sessions/briefs/submissions/uploads across deploys.
- **WebSocket routing** — Vercel can't proxy the WS upgrade, so the client
  connects directly to `wss://<railway>/ws`. The backend publishes that URL via
  `/api/config` (`wsUrl`, from the `PUBLIC_WS_URL` env var, normalized to end in
  `/ws`); `ui/src/lib/websocket.js` prefers it over same-origin. Unset →
  same-origin, so local dev is byte-for-byte unchanged.
- **Proxies** — `app.set('trust proxy', 1)` makes `req.ip` resolve real client
  IPs behind the Vercel/Railway hops so per-IP rate limiting stays honest.

**Deploy runbook:**
1. Push to GitHub.
2. Railway → New Project → deploy from repo (root = repo root, Nixpacks;
   `npm run build` then `npm start`, binds `process.env.PORT`).
3. Railway env vars: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`,
   `GROQ_API_KEY`, `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `NODE_VERSION=22`,
   `PUBLIC_WS_URL=wss://<railway-domain>` (do NOT set `PORT`/`BRAIDLY_PORT`).
4. Railway → Volume → mount at `/app/data`; healthcheck path `/api/health`;
   Networking → Generate Domain (this domain feeds steps 3 and 5).
5. Vercel → import same repo → Root Directory `ui` → deploy → then put the
   Railway domain into `ui/vercel.json` (replace `RAILWAY-DOMAIN-HERE`), commit
   and push — Vercel redeploys automatically on push.
6. Supabase → Authentication → URL Configuration → add the Vercel (and Railway)
   domains to Site URL / Redirect URLs.
7. Smoke test: `curl https://<vercel>/api/health`; landing renders; WS connects
   to `wss://<railway>/ws` (Network tab, status 101); guest chat round-trip;
   share link auto-join from an incognito window; finalize + upload; redeploy
   Railway and confirm `data/` survives.

**Local dev stays exactly as before** — `node server.js` + `npm run build:ui`,
same-origin, no env vars needed.
