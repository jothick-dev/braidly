# Braidly — Master Project Checklist

> **Living checklist.** Every thing we plan to include in this project, in one place.
> Tick items as they're done. Cross-reference: `PROJECT.md` (vision/status),
> `TECH-SPEC.md` (tech decisions), `instructions.md` (safety rules for AI tools).

---

## 1. Foundation & Docs

- [x] `PROJECT.md` — vision, 5-stage pipeline, decisions, session status
- [x] `TECH-SPEC.md` — complete tech spec (stack, providers, keys, deployment)
- [x] `instructions.md` — handoff brief so any AI tool continues safely
- [x] `checklist.md` — this file
- [ ] `docs/brief-template.md` — filled-in example brief (PRD + Build Instructions +
      `contract.json`) for the to-do proof app, so Cline/Antigravity have a concrete artifact

## 2. The 5-Stage Pipeline (core product)

### Stage 1 — Debate Room
- [x] Chat UI — single-page vanilla HTML/CSS/JS (no build step)
- [x] Real-time chat via WebSocket (`ws`)
- [x] AI facilitator as a chat participant (streaming replies through the gateway)
- [x] AI reply deltas broadcast to ALL members (`chat.stream`) + stop button
- [x] Heartbeat (30 s ping/pong) + presence updates; client reconnect with backoff
- [x] Multiple team-member identities (names/colors)
- [x] Messages persisted to `data/messages.json`
- [x] Security hardening (GOVERNANCE A-rules): CSP/headers, `textContent` rendering,
      input validation, REST + WS rate limits, no error leakage — `test/smoke.js` passes

### Stage 2 — PRD Factory
- [x] "Finalize Discussion" action/button (UI + endpoint)
- [x] LLM structured output: discussion → modules + owners — `groq/compound-mini` with
      `extractJSON` for robust parsing (OpenRouter fallback on 429; Ollama last resort)
- [x] Per person: PRD (what to build) + Build Instructions (how it must fit)
- [x] Shared contract part (endpoints, schemas, stack & versions, repo layout, DO-NOT-TOUCH)
- [x] Machine-readable `contract.json` per person
- [x] Auto-generated contract tests per person (mock the other modules)
- [x] Definition-of-Done checklist per person
- [x] Template machine: same packaging for any team size / assignment
- [x] End-to-end test: discussion → finalize → verify briefs generated correctly (2026-08-23)
- [x] Robust JSON extraction — `extractJSON()` handles markdown fences, explanation text, JS code mixed with JSON
- [x] Truncation fix — increased `max_tokens` from 4K to 8K for structured output
- [x] Schema normalization — handles model returning `product_requirements_document` instead of `prd`
- [x] Rate limit mitigation — exponential backoff (5s/10s) + 3s inter-module delay
- [x] allam-2-7b fallback — secondary Groq model for structured output

### Stage 3 — Vibe Coding
- [x] (MVP) Module assignment view — after finalize, each person sees their assigned module
- [x] (MVP) Brief display — user stories, files to create, required exports, definition of done
- [x] (MVP) Simple code editor — monospace textarea for writing/pasting code
- [x] (MVP) File submission — saves code to `data/submissions/<module>/` with metadata
- [x] (MVP) Submission broadcast — all members notified when someone submits
- [ ] (Later) Monaco embedded editor (in-browser and/or Electron desktop app)
- [ ] (Later) Electron desktop shell — local workspace folder + run-output pane
- [ ] (Later) Live preview pane

### Stage 4 — File Submission
- [x] Upload UI (`multer` — multipart form, drag-drop + file picker)
- [x] Folder-per-module storage (`data/submissions/<module>/`)
- [x] Reject `node_modules` / `.env` / hidden files / files > 500KB
- [x] File list with sizes and delete buttons
- [x] WebSocket broadcast (`files.update`) for real-time file sync
- [x] `GET /api/files/:module` — list files in a module
- [x] `DELETE /api/files/:module/*` — delete a specific file
- [ ] (Later) Git repo per person / object storage

### Landing Page (decided 2026-08-23)
- [ ] Entry page — name input, "Enter the Debate Room" button
- [ ] "New Chat" button — clears messages, starts fresh discussion
- [ ] Past sessions list — shows previous discussions with timestamps
- [ ] Click a past session to revisit that conversation
- [ ] Name persistence via localStorage (no auth needed)
- [ ] Session storage — each chat saved as separate JSON in `data/sessions/`
- [ ] Responsive design — works on mobile for hackathon demo

### Stage 5 — AI Tech Lead (orchestrator)
- [x] Reads all submitted modules (`data/submissions/`)
- [x] Verifies each module against `contract.json` (file existence, entry points)
- [x] Static security scans: A5 (secrets), C1 (error masking), C4 (god-objects), B1/B4 (deps whitelist), B2 (version pinning)
- [x] Runs the auto-generated contract tests per module
- [ ] Runs build steps per module (`npm install` / `npm test` / `npm run build` via `child_process`)
- [x] Bounded fix loop: send error + contract to LLM gateway → patch → retry (≤ 3 attempts) — minimal-diff per E1/E2
- [ ] Assembles modules into one running app
- [x] Integration report (pass/fail/fixed/missing per module, overall status, saved to disk)
- [x] API endpoints: `POST /api/integrate`, `GET /api/reports`
- [x] UI: Integrate button + report display with severity coloring

### Full PRD View (Session 18)
- [x] Add `GET /api/contract/:module` endpoint — loads full contract from disk
- [x] Display acceptance criteria, functional/non-functional requirements in PRD view
- [x] Show file structure, exported entities, integration steps from contract
- [x] Show shared contract: tech stack, data models, security constitution, do-not-touch list
- [x] Async loading — contract fetches after brief info renders (non-blocking)

### Chat UX Improvements (Session 15-16)
- [x] Clear Chat button — wipes messages, briefs, submissions, reports from disk
- [x] On-demand AI — Braidly only responds when someone types `/ai` (or `/ai <question>`)
- [x] `/ai` prefix detection in server — strips ALL `/ai` prefixes (handles `/ai /ai ...`)
- [x] Updated placeholder and empty state to explain `/ai` command
- [x] Confirmation dialog before clearing chat
- [x] Truncated JSON recovery in `extractJSON()` — partial PRDs extracted even when models hit token limits

### Landing Page (Session 21)
- [x] Landing page entry screen (`public/landing.html`) with project branding and 5-stage pipeline display
- [x] Name input + "New Chat" button (creates session ID, navigates to `/app`)
- [x] Past sessions list — loaded from server, sorted newest first, click to resume
- [x] Feature cards (Debate Room, PRD Factory, Vibe Coding, AI Tech Lead)
- [x] Session management API (`GET /api/sessions`, `GET /api/sessions/:id`)
- [x] Session archival — Clear Chat saves current session (messages + briefs + metadata) to `data/sessions/` before clearing
- [x] Session ID flow — landing page generates ID, debate room reads from URL query param
- [x] Direct navigation to `/app` auto-creates session if none in URL
- [x] Landing page responsive CSS (dark mode, mobile-friendly)
- [ ] Past sessions show thumbnails or summary of discussion topics

### Supabase Integration (Session 22)
- [x] Created Supabase project (braidly-prod) on supabase.com
- [x] Created database schema with 7 tables (profiles, sessions, messages, briefs, shared_contracts, submissions, reports)
- [x] Created `lib/supabase.js` — server-side client with service role + anon key
- [x] Created `lib/auth.js` — auth middleware (requireAuth, optionalAuth)
- [x] Rewrote `lib/store.js` — dual-mode storage (Supabase + JSON fallback)
- [x] Added `/api/config` endpoint (safe: anon key only)
- [x] Added `/api/auth/me` endpoint
- [x] Updated landing page with Sign In / Sign Up forms
- [x] Updated debate room with auth token on API calls
- [x] Fixed CSP to allow Supabase CDN (`https://cdn.jsdelivr.net`)
- [x] Fixed login null error (added null check + clear error message)
- [x] Fixed Security Advisor warnings (SET search_path, restrict function execution)
- [x] Fixed `/api/sessions` 401 error (requireAuth → optionalAuth)
- [ ] Demo mode for hackathon judges (no-login access)
- [ ] Test full flow with Supabase storage

### UI Redesign (Session 23)
- [x] Redesigned `public/index.html` — 3-column layout (People sidebar / Thread / PRD+Doc sidebar)
- [x] Header with logo, screen switcher (Team Chat / Modules), status pill, Home link
- [x] Left sidebar: participant list with avatars, online dots, AI badge
- [x] Right sidebar: PRD Factory, PRD Showcase (index cards), Workspace, Integration panel
- [x] Module Submission view: table with Person/Role/Module/Status/Submission + Integration panel
- [x] Redesigned `public/style.css` — ink-charcoal palette, graph-paper grid, index-card rotation, IBM Plex Mono
- [x] Rewrote `public/app.js` — screen switching, PRD Showcase, Module Submission table, all existing functionality preserved
- [x] Vanilla HTML/CSS/JS per TECH-SPEC (zero build step, no React)
- [ ] Polish responsive layout for mobile
- [ ] Add inline editing for Module Submission table rows

### React UI (Session 24-25)
- [x] Created `ui/` with React + Vite + Tailwind CSS 4 + lucide-react
- [x] Supabase browser client (`ui/src/lib/supabase.js`)
- [x] API helper with auth token injection (`ui/src/lib/api.js`)
- [x] WebSocket manager with auto-reconnect (`ui/src/lib/websocket.js`)
- [x] AuthView — Sign In / Sign Up / Skip (guest mode)
- [x] TeamChatView — 3-column layout connected to real WebSocket + API
- [x] ModuleSubmissionView — table connected to real API data
- [x] Vite proxy config — `/api` and `/ws` forwarded to backend (port 3000)
- [x] End-to-end tested: Auth → Chat → AI streaming → Finalize → Modules

### Sidebar + Dashboard (Session 25)
- [x] Persistent sidebar — navigation (Home, Profile, Dashboard, Project, Team), user info, sign out, collapse
- [x] Dashboard — welcome header, stats row (projects, messages, active, last active), new project input, activity ring, previous projects grid, feature cards, footer
- [x] Marketing landing page — nav bar, hero (animated hex), features, about, CTA, footer
- [x] Full navigation flow: Landing → Auth → Dashboard → Chat/Modules
- [x] "← Home" button in TeamChatView header

## 3. Core Architecture Rules

- [ ] `llm/gateway.js` — the ONE module all AI calls go through
- [ ] Routing: Groq (smart) → OpenRouter (fallback on 429) → Ollama local (cheap work)
- [ ] Provider abstraction — swap to paid APIs later without touching app code
- [ ] `.env` + `.env.example`; `.env` and `data/` gitignored
- [ ] JSON-file storage with a small write queue
- [ ] Contract-first: integration = mechanical verification, not guesswork

## 4. $0 AI Stack (free tiers)

- [x] Groq key — `allam-2-7b` (chat streaming)
- [x] Groq key — `groq/compound-mini` (structured output, with retry on 429)
- [x] OpenRouter key — `cohere/north-mini-code:free` (structured output fallback on 429)
- [ ] Google AI Studio key — Gemini Flash (big-context calls) ⚠️ no proprietary code
- [ ] Cerebras / Mistral (optional overflow capacity)
- [ ] Ollama + `qwen2.5-coder:3b` local (fits 4GB VRAM, 25–40 tok/s)
- [ ] Re-verify free-tier limits at build time (they change)

## 5. Runtime & Tooling Setup

- [ ] Node 22 LTS installed
- [ ] `package.json` with pinned versions: Express, `ws`, `multer`, `dotenv`
- [x] Git repository initialized (`git init`, first commit `a53edb4`, 24 files, 7415 lines)
- [ ] GitHub public repo for hackathon submission (create + push)
- [ ] Ollama installed + `qwen2.5-coder:3b` pulled
- [ ] Ports: `3000` main app, `4000` mock server (proof app)
- [ ] Git Bash / PowerShell workflow on Windows

## 6. Proof App (to-do app, built through the platform)

- [ ] Backend module: `GET /api/tasks`, `POST /api/tasks` per the shared contract
- [ ] Frontend module consuming that API
- [ ] Built end-to-end through the platform: briefs → code → submit → integrate
- [ ] Runs locally, end-to-end, as the deliverable

## 7. Tool Ownership Map (how we build it)

- [ ] Codebuff: architect + integrator — gateway, PRD Factory, orchestrator, docs
- [ ] VS Code + Cline (Gemini key): one module brief at a time (like a team member)
- [ ] Antigravity: UI playground (`public/`, proof-app UI)
- [ ] Rule: never two tools editing the same folder simultaneously

## 8. Deployment & Post-MVP (NOT in the initial MVP build)

### Session 38 (2026-09-16): Deployment prep done — Vercel + Railway split
- [x] `ui/vercel.ts` — build-time `BACKEND_URL` rewrite (API proxied, same-origin), SPA fallback, asset caching
- [x] Root `build` script (`cd ui && npm ci && npm run build`) for Railway Nixpacks
- [x] `PUBLIC_WS_URL` published via `/api/config`; client connects WebSocket directly to Railway
- [x] `trust proxy` so rate limiting works behind reverse proxies
- [ ] Push to GitHub → Railway service (volume at `/app/data`, env vars, healthcheck `/api/health`)
- [ ] Vercel project (root dir `ui`) with `BACKEND_URL` env var
- [ ] Supabase auth redirect URLs include Vercel + Railway domains
- [ ] End-to-end smoke test on deployed URLs (chat, share link, finalize, upload)

- [ ] MVP stays local-only (safe: orchestrator executes code)
- [ ] Docker sandbox per submission — requirement before any public deployment
- [ ] Demo hosting: Render / Railway / Fly.io free tiers
- [ ] Frontend hosting later: Vercel / GitHub Pages
- [ ] Storage upgrade: SQLite (`better-sqlite3`) when JSON hurts
- [ ] Real-time multiplayer collaboration (live cursors, presence)
- [ ] Per-module CI + deployment previews
- [ ] GitHub / local-editor integration
- [ ] Auth: sessions first → Auth0/Clerk free tier later
- [ ] Pricing model: charge per session via the gateway swap (earns before it costs)

## 8.5. Hackathon Presentation

- [x] `docs/ppt.md` — comprehensive 10-slide deck for AI Builders Hackathon (online video submission)
- [x] Slide 1: Title slide with tagline
- [x] Slide 2: Problem statement (vibe-coding chaos, 45% OWASP, Lovable BOLA incident)
- [x] Slide 3: Solution overview (5-stage pipeline diagram)
- [x] Slide 4: Key features (Debate Room, PRD Factory, Workspace, AI Tech Lead)
- [x] Slide 5: Innovation — Contract-First Development (the differentiator)
- [x] Slide 6: Technical architecture (Node.js core, LLM gateway, thin shells)
- [x] Slide 7: AI Technologies used (Groq, OpenRouter, Ollama, fallback chain)
- [x] Slide 8: Impact & value proposition (target users, before/after comparison)
- [x] Slide 9: 2-minute demo script with backup plan
- [x] Slide 10: Future roadmap (Electron, VS Code extension, enterprise)
- [x] Appendix A: Project structure
- [x] Appendix B: Setup instructions
- [x] Appendix C: Security features (GOVERNANCE A1-A10, B1-B4, C1-C5)
- [x] Appendix D: Key statistics for Q&A

## 9. Safety & Guardrails

- [x] Safe execution rules documented (`PROJECT.md` §8)
- [ ] `.env` never committed; no keys in logs or code
- [ ] No proprietary code sent to training-tier free APIs (AI Studio)
- [ ] Orchestrator runs whitelisted commands only; no arbitrary submitted code on host
- [ ] No global package installs; everything inside the project folder
- [x] **MANDATORY: Update `history.md`, `checklist.md`, and `PROJECT.md` after every session/significant change** (added as rule F5 in GOVERNANCE.md, rule 7 in instructions.md)
- [x] **Session 26 (2026-09-02):** Documentation discipline re-confirmed as non-negotiable. User lost previous chat session, requested full project review. Session logged per mandatory rule.
- [x] **Session 27 (2026-09-03):** React UI (`ui/`) is now the served frontend. `server.js` serves `ui/dist` at `/` and `/app` with SPA fallback; legacy `public/` UI remains as graceful fallback when the build is missing. Added `build:ui` script and `ui/dist/` to `.gitignore`. Both paths verified with curl.
- [x] **Session 28 (2026-09-03):** Guest/demo mode for hackathon judges — "Skip for now — explore as Guest" on the auth screen (landing already had "Try Demo"); no credentials needed anywhere (all pipeline endpoints tolerate missing auth). Fixed CSP to allow Google Fonts (fonts.googleapis.com/gstatic.com) so branding loads. Verified live in browser: Landing → guest → dashboard → chat with WS presence.
- [x] **Session 29 (2026-09-03):** Fixed "Supabase not configured" on signup — `dotenv.config()` was reading `.env` from the launch cwd instead of the script folder, so servers started from other directories ran keyless. Pinned to `__dirname` in server.js. Verified live: real signup created a Supabase account and reached the Dashboard.
- [x] **Session 30 (2026-09-04):** Landing page full-background braid animation — new canvas component (`ui/src/BraidBackground.jsx`) with 12 brand-palette threads weaving into one rope; cinematic camera intro (macro close-up → parabolic pull-back → ambient reveal); hero text floats on top and fades in at reveal; `prefers-reduced-motion` skips the flight; old ring widget removed. Code-generated (canvas), no video.
- [x] **Session 31 (2026-09-14):** PRD cards fixed — LLM returned PascalCase keys (`PRD`, `BuildInstructions`, `DefinitionOfDone`) while frontend expected snake_case; user stories are objects not strings; BuildInstructions keys differ from schema. Fixed by normalizing both formats, generic key iteration for BuildInstructions, object-format support for stories/criteria/DOD. Verified: new bundle served, PRD cards expandable with full content.

## 10. Failure-Mode Governance (from the two vibe-coding research docs → `GOVERNANCE.md`)

### A. Security Constitution (in every `contract.json` + contract tests)
- [ ] A1 Parameterized queries only (no string-concat SQL/NoSQL)
- [ ] A2 No weak password storage (no plain text / MD5 / SHA-1; Argon2id-class)
- [ ] A3 Ownership checks on every object access — server-side, never frontend-only (kills IDOR/BOLA, the Lovable incident)
- [ ] A4 Input validation on every route (malformed input → 400)
- [ ] A5 No secrets in code (scan rejects hardcoded keys, committed `.env`, keys in frontend JS)
- [ ] A6 No verbose error leakage (generic prod errors; no stack traces/SQL/paths to client)
- [ ] A7 Upload validation (MIME whitelist + size limits; never served from web root)
- [ ] A8 CORS origin allowlist (never `*` on sensitive endpoints)
- [ ] A9 Security headers + cookies (CSP; HttpOnly+Secure; CSRF tokens on state-changing forms)
- [ ] A10 Rate limiting on auth endpoints + account lockout

### B. Supply-Chain Rules (slopsquatting protection)
- [ ] B1 Dependency whitelist in `contract.json` (the ONLY importable packages)
- [ ] B2 No install unless: on whitelist + verified to exist on real registry + exact version pinned
- [ ] B3 PRD Factory verifies package existence on registry BEFORE whitelisting it
- [ ] B4 Off-whitelist installs fail verification

### C. Anti-Dark-Logic Rules
- [ ] C1 No error-masking (empty catches, bare null-swallowing rejected by static checks)
- [ ] C2 Every catch logs or rethrows — no silent failure
- [ ] C3 Duplication scan at submission; above threshold → bounce back to owner
- [ ] C4 Brief defines module structure (routes/services/storage) — no god-objects
- [ ] C5 Every module ships a mental-model README (verified by orchestrator)

### D. Test Rules
- [ ] D1 Contract tests include negative tests (unauthorized → 401/403, malformed → 400)
- [ ] D2 Security assertions in contract tests (secret scan, headers, auth, CORS)
- [ ] D3 DoD requires negative + security tests to pass (no happy-path-only)
- [ ] D4 Full test suite re-runs after ANY fix — no partial verification

### E. AI Tech Lead / Orchestrator Policy
- [ ] E1 Minimal-diff fixing; whole-module rewrites forbidden unless contract requires
- [ ] E2 Bounded fix loop (≤3 attempts), every attempt logged
- [ ] E3 Integration report = audit trail (per-module pass/fail, what was fixed)
- [ ] E4 Contract freeze during build; changes re-issue all briefs via PRD Factory
- [ ] E5 Full context to orchestrator (shared contract + constitution + all briefs)

### F. Human-Process Rules
- [ ] F1 Human review gate: auth / payments / data-access / user-input modules flagged for founder review
- [ ] F2 Shared conventions in the shared contract (naming, layout, error format)
- [ ] F3 No ad-hoc prompts mid-build; new features → new discussion → new briefs
- [ ] F4 Never feed proprietary code to training-tier free APIs

### Schema & product impact
- [ ] `contract.json` gains: `securityConstitution`, `allowedDependencies`, `structure`
- [ ] Contract-test generator produces negative + security assertion tests
- [ ] Proof app UI: no dead-end empty states ("No data yet" → directive, brand-aligned copy)

## 11. Delivery Surfaces (core + thin shells — decided 2026-08-14)

- [ ] Pipeline built as a UI-independent **core** (gateway, PRD Factory, orchestrator,
      storage, contracts — no view-layer imports in core modules)
- [ ] **Electron desktop app** (primary surface): Monaco embedded, local workspace folder,
      run-output pane; packaging (signing/installers/updates) deferred until distribution matters
- [ ] **VS Code extension** (upgrade surface): Debate Room panel, brief generation,
      submit/merge command, BYOK settings (members bring their own keys)
- [ ] **Fork** (only after funding/team/profits): Theia over Code OSS, re-hosts the same core
- [ ] Sequencing rule: prove the loop in the browser first; wrap in Electron only when the
      pipeline works; build the extension after validation



### Shareable Links (Session 36)
- [x] Session-scoped WebSocket — broadcast only to same-session members
- [x] session.join handler — loads existing messages, sends session.history
- [x] GET /api/sessions/:id/messages endpoint
- [x] URL param auto-join — ?session=<id> bypasses landing page
- [x] Share button — copies session URL to clipboard with visual feedback
- [x] Reconnect preserves sessionId

### Dashboard/Project Tabs (Session 35)
- [x] Dashboard tab shows 'under construction' placeholder
- [x] Project tab shows 'under construction' placeholder
- [x] Home tab still shows real DashboardView

### PRD Copy Button (Session 32)
- [x] Copy button on each PRD card header
- [x] Formats full PRD as plain text
- [x] Visual feedback (clipboard → green checkmark for 2s)

### Integration Report Fixes (Sessions 33-34)
- [x] Fixed status field mapping (overall_status vs status)
- [x] Fixed summary field mapping (summary.passed vs passed)
- [x] Added warnings detail display with rule codes


### Three.js Braid Hero Background (Session 37)
- [x] Replaced 2D canvas with full Three.js scene (TubeGeometry + bloom)
- [x] 4-phase perpetual cycle: Source → Burst → Vortex → Braid → Fade (seamless loop)
- [x] 26 strands in 3 color groups with noise-driven organic motion
- [x] UnrealBloomPass for neon glow effect
- [x] Energy pulses traveling along strands during braid phase
- [x] InstancedMesh bokeh particles for atmosphere
- [x] Camera choreography: macro → pull-back → push-in → lateral drift
- [x] HUD overlay: grid lines + monospace glyphs (DOM/CSS, not 3D)
- [x] Text-contrast scrim for hero text readability
- [x] prefers-reduced-motion fallback (static gradient, no canvas)
- [x] Lazy-loaded via React.lazy + Suspense (Three.js doesn't block first paint)
- [x] Props: strandCount, palette, speed
- [x] body transparent + app-bg class for non-landing pages

---

**North star:** a team discusses an idea → AI distributes tight per-person briefs →
members vibe-code their modules → the AI Tech Lead snaps them together into a working app.
Everything above exists to make that loop cheap, $0, and mechanically verifiable.
