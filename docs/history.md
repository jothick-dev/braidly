# Braidly — Development History

> **Purpose:** Step-by-step record of everything built, decided, and learned across sessions.
> This file supplements `PROJECT.md` (decision log) and `checklist.md` (completion status)
> with detailed session-by-session narrative.

---

## Existing Progress-Tracking Files

| File | What It Tracks | Limitation |
|------|----------------|------------|
| `PROJECT.md` §11 Decision Log | High-level decisions with dates | Not step-by-step; summarizes outcomes |
| `checklist.md` | Task completion (✅/❌) | Binary status, no narrative |
| `TECH-SPEC.md` | Technical specifications | Static, not a history |
| **`history.md` (this file)** | **Detailed session-by-session work** | **New — the canonical history** |

---

## Previous Sessions (Reconstructed from Decision Log)

### Session 1 — 2026-08-08: Planning & Foundation
**Focus:** Idea validation, architecture design, documentation

**What was done:**
- Validated the market gap: no existing product does the full loop (team discussion → AI PRDs → humans code → AI integration)
- Confirmed feasibility on founder's hardware (Ryzen 7, 16GB RAM, RTX 3050 4GB VRAM)
- Locked the $0 budget constraint: free tiers only, all AI calls through one gateway
- Designed the 5-Stage Pipeline (Debate Room → PRD Factory → Vibe Coding → File Submission → AI Tech Lead)
- Created `PROJECT.md` — the living product document
- Created `instructions.md` — handoff brief for any AI tool
- Created `TECH-SPEC.md` — complete technical specification
- Created `checklist.md` — master task checklist
- Designed the per-person brief system: PRD + Build Instructions + `contract.json` + auto-generated contract tests
- Key insight: "Contract-first makes integration mechanical verification, not guesswork"

**Files created:** `PROJECT.md`, `instructions.md`, `TECH-SPEC.md`, `checklist.md`

---

### Session 2 — 2026-08-08 (continued): Governance & Research
**Focus:** Security hardening, failure-mode analysis

**What was done:**
- Received two research docs on vibe-coding failure modes from founder
- Analyzed failure patterns: IDOR/BOLA (Lovable incident), supply-chain slopsquatting, silent error masking
- Created `GOVERNANCE.md` — enforceable rules for the platform:
  - Security Constitution (A1–A10): parameterized queries, password hashing, ownership checks, input validation, no secret leaks, generic errors, upload validation, CORS, security headers, rate limiting
  - Supply-Chain Rules (B1–B4): dependency whitelist, verified registry existence, exact version pinning
  - Anti-Dark-Logic Rules (C1–C5): no error masking, logging/rethrowing, duplication scan, module structure
  - Test Rules (D1–D4): negative tests, security assertions, full re-runs after fixes
  - Orchestrator Policy (E1–E5): minimal-diff fixing, bounded loops (≤3 attempts), audit trails
  - Human-Process Rules (F1–F4): review gates for sensitive modules, shared conventions, no mid-build ad-hoc prompts
- Updated `contract.json` schema to include: `securityConstitution`, `allowedDependencies`, `structure`

**Files created:** `GOVERNANCE.md`

---

### Session 3 — 2026-08-14: Delivery Model Decision
**Focus:** How the product will be delivered to users

**What was done:**
- Debated delivery options: Electron desktop vs VS Code extension vs IDE fork
- Decided on **core + thin shells** architecture:
  - **Core:** UI-independent Node modules (LLM gateway, PRD Factory, orchestrator, contracts, storage)
  - **Shell 1 (Primary):** Electron desktop app embedding Monaco
  - **Shell 2 (Upgrade):** VS Code extension with BYOK (members bring their own keys)
  - **Shell 3 (Post-funding only):** IDE fork using Theia over Code OSS
- Key principle: "Pipeline logic lives in core; surfaces never own it"
- Sequencing: prove loop in browser first → wrap in Electron → build extension after validation
- "No upload" preserved: code stays local, orchestrator reads directly

**Files updated:** `PROJECT.md` (Decision Log), `checklist.md`, `instructions.md`

---

### Session 4 — 2026-08-16: Hackathon Prep & UI/API Research
**Focus:** AI Builders Hackathon submission, pre-Stage-1 technical research

**What was done:**
- Renamed project from **TeamVibe** to **Braidly** ("braiding each team member's module into one integrated product")
- Created `hackathon.md` mapping all mandatory deliverables:
  - Submission form fields
  - Working product requirement (Stages 1–5)
  - Public GitHub repo setup
  - ≤5-min demo video plan
  - ≤10-slide deck outline
- Differentiation strategy: contracts, verification, integration, governance = technical execution (challenge rejects wrappers)
- Created `UI-API-RESEARCH.md` — comprehensive pre-Stage-1 research:
  - **UI Patterns:** streaming token display, message states, stop button, typing indicator, starter prompts, rich rendering, member presence, no dead-end empty states
  - **WebSocket Protocol:** confirmed `ws` over Socket.IO (single room, JSON envelopes, 30s heartbeat, backoff reconnect)
  - **LLM API Findings:**
    - Groq `json_schema` NOT supported on `llama-3.3-70b-versatile` (only GPT-OSS models)
    - Stage 2 must use `json_object` + code-side validation + retry
    - Free-tier limits corrected: Groq ~14,400 RPD (was ~1,000), Gemini ~250 RPD (slashed Dec 2025)
  - **Locked Decisions:** gateway API = `chat()` (streaming) + `structured()` (provider-aware JSON); AI replies broadcast to all members

**Files created:** `hackathon.md`, `UI-API-RESEARCH.md`

---

### Session 5 — 2026-08-18: Stage 1 — Debate Room Built & Tested
**Focus:** Implementing the complete Stage 1 (real-time team + AI chat)

**What was done:**
- Installed Node 22.17.0 (official zip, SHA-256 verified, no admin, no global install)
- Built backend (`server.js`):
  - Express server with WebSocket (`ws`) for real-time chat
  - Presence tracking (join/leave/typing)
  - Message persistence to `data/messages.json` with serialized write queue
  - Rate limiting: REST (300/min/IP), WS (10 msgs/10s, 3 strikes → kick)
  - Heartbeat (30s ping/pong) for dead connection detection
  - Client reconnect with exponential backoff (1s → 2s → 5s cap)
- Built LLM gateway (`llm/gateway.js`):
  - Single module for all AI calls (golden rule)
  - Provider chain: Groq → OpenRouter → Ollama (fallback on 429/error)
  - Streaming via SSE (Groq/OpenRouter) and NDJSON (Ollama)
  - AbortSignal support for stop button
  - Facilitator system prompt for guiding team discussions
- Built security layer (`lib/security.js`):
  - CSP headers, XSS prevention (textContent only)
  - Input validation (sender, text, clientId)
  - Rate limiter middleware
  - Generic error handling (no leakage)
- Built persistence (`lib/store.js`):
  - JSON file storage with serialized write queue
  - Auto-backup on corruption
- Built frontend (`public/`):
  - Vanilla HTML/CSS/JS (no build step)
  - Dark mode, chat + sidebar layout
  - Join overlay with name input
  - Streaming token display with blinking caret
  - Stop button for AI replies
  - Typing indicator
  - Starter prompts in empty state
  - Optimistic message rendering with retry on failure
  - Presence sidebar with colored dots
- Fixed bug: host environment exports `PORT=0` (dotenv won't override) → app now uses `BRAIDLY_PORT` fallback
- Smoke test (`test/smoke.js`) passes: join → presence → chat echo → malformed input rejected → AI graceful degradation

**Files created:** `server.js`, `llm/gateway.js`, `lib/security.js`, `lib/store.js`, `public/index.html`, `public/style.css`, `public/app.js`, `test/smoke.js`, `.env.example`, `.gitignore`, `package.json`

---

## Session 6 — 2026-08-19: Project Review & Docs Organization

**Focus:** Resuming work, reviewing project state, organizing docs, setting up history tracking

**What was done:**
- Reviewed all project documentation (PROJECT.md, TECH-SPEC.md, SYSTEM-DESIGN-MAP.md, checklist.md, instructions.md)
- Read all implementation files (server.js, gateway.js, security.js, store.js, frontend)
- Created `history.md` (this file) — canonical step-by-step development record
- Identified existing progress-tracking files and their limitations
- **Organized all markdown docs into `docs/` folder** — cleaner project structure, 9 files moved
- Updated `instructions.md` with new directory tree structure
- Current status: Stage 1 complete, ready for Stage 2 (PRD Factory)

**Next steps identified:**
1. Get live AI replies (add Groq API key or run local Ollama)
2. Stage 2: PRD Factory implementation

---

## Session 7 — 2026-08-19: Live AI Setup & Model Fix

**Focus:** Getting live AI replies working in the Debate Room

**What was done:**
- Added Groq API key to `.env` file
- Discovered Node.js not in PATH — fixed by using full path `C:\\Users\\meher\\nodejs\\node.exe`
- Tested API key — key loaded correctly
- Discovered `llama-3.3-70b-versatile` model no longer exists on Groq (HTTP 404)
- Queried Groq `/v1/models` endpoint to find available models
- Tested `openai/gpt-oss-20b` — works perfectly (~1,000 tok/s, 131K context)
- Updated `llm/gateway.js` to use `openai/gpt-oss-20b` instead of deprecated model
- **Live AI replies now working** in the Debate Room ✅

**Files modified:**
- `llm/gateway.js` — changed model from `llama-3.3-70b-versatile` to `openai/gpt-oss-20b`
- `.env` — added Groq API key

**Issues encountered:**
1. Node.js not in PATH — resolved by using full path to node.exe
2. Old model deprecated — resolved by switching to `openai/gpt-oss-20b`
3. UTF-8 BOM in .env — investigated but wasn't the issue (dotenv loaded key correctly)

**Key discovery:** `openai/gpt-oss-20b` supports `json_schema` structured outputs — Stage 2 can use native schema validation instead of `json_object` + code-side validation. Simpler and more reliable.

**Next steps:**
1. Stage 2: PRD Factory implementation
2. Update TECH-SPEC.md and PROJECT.md to reflect new model

---

## Template for Future Sessions

```markdown
### Session N — YYYY-MM-DD: [Title]
**Focus:** [One-line summary]

**What was done:**
- [Detailed step 1]
- [Detailed step 2]
- ...

**Files created/modified:**
- `path/to/file.js` — description

**Decisions made:**
- [Decision 1] — rationale

**Issues encountered:**
- [Issue 1] — how it was resolved

**Next steps:**
1. [Immediate next step]
2. [Future consideration]
```

---

## Key Milestones Timeline

| Date | Milestone |
|------|-----------|
| 2026-08-08 | Project conceived, core docs created, architecture locked |
| 2026-08-14 | Delivery model decided (core + thin shells) |
| 2026-08-16 | Renamed to Braidly, hackathon prep, UI/API research complete |
| 2026-08-18 | **Stage 1 (Debate Room) built and tested** ✅ |
| 2026-08-19 | Session 6: Review + history tracking setup |
| 2026-08-19 | **Session 7: Live AI replies working** ✅ (model: `openai/gpt-oss-20b`) |
| 2026-08-20 | **Session 8: Model fix + Stage 2 start** — split models (compound-mini for chat, gpt-oss-20b for structured) |
| 2026-08-21 | **Session 9-10: Stage 2 tested + Stage 3 MVP built** — workspace, module assignment, code editor |
| 2026-08-21 | **Session 11: OpenRouter fallback fix** — `extractJSON()`, retry on 429, 3-tier fallback working |
| 2026-08-21 | **Session 12: Stage 4 (File Submission) built** — multer, drag-drop, file management |
| 2026-08-23 | **Session 13: Full flow tested end-to-end** — chat → finalize → workspace → upload all working |
| 2026-08-23 | **Landing Page decided** — Option A chosen (entry page + new chat + past sessions) |
| 2026-08-23 | **Session 14: Stage 5 (AI Tech Lead) built** — orchestrator, security scans, AI fix loop, integration report |
| 2026-08-24 | **Session 15: Clear Chat + /ai command** — on-demand AI, clear chat button |
| 2026-08-24 | **Session 16: Truncated JSON + /ai fix + module name sanitization + PRD persistence** |
| 2026-08-24 | **Session 18: Full PRD view with contract details** — acceptance criteria, file structure, security rules, shared contract all visible |
| 2026-08-26 | **Session 20: Hackathon PPT created** — 10-slide deck + 2-min demo script for AI Builders Hackathon |
| 2026-08-26 | **Session 21: Landing Page built** — entry screen, new chat, past sessions, session archival |
| 2026-08-27 | **Session 22: Supabase integration** — auth, database (7 tables), dual-mode storage, CSP fix |
| 2026-08-29 | **Session 23: Complete UI redesign** — 3-column Team Chat, Module Submission table, graph-paper grid, index-card PRD showcase |
| 2026-08-30 | **Session 24: React UI with real backend** — TeamChatView, ModuleSubmissionView connected to WebSocket/API/Supabase |
| 2026-08-30 | **Session 25: Sidebar + Dashboard + Landing page** — persistent sidebar, auth flow, marketing landing page, full navigation |
| 2026-09-02 | **Session 26: New session — project review + documentation discipline reinforced** |
| 2026-09-03 | **Session 27: React UI is now the face** — server serves ui/dist, SPA + legacy fallbacks, build:ui script |
| 2026-09-03 | **Session 28: Guest/demo mode for hackathon judges** — "Skip for now" on auth screen, Google Fonts CSP fix |
| 2026-09-03 | **Session 29: Signup fix** — dotenv now loads `.env` from the script's own folder; "Supabase not configured" error gone |
| 2026-09-04 | **Session 30: Full-background braid animation** — canvas threads weaving into a rope, cinematic camera intro on the landing page |
| 2026-09-14 | **Session 31: PRD cards fixed** — PascalCase vs snake_case normalization, generic key iteration, object-format support |
| TBD | Proof run: to-do app built through platform |
| TBD | Hackathon submission |

---

## Session 26 — 2026-09-02: Project Review & Documentation Discipline

**Focus:** Resuming after chat session loss. Full project review, re-establishing context, and reinforcing documentation discipline.

**What was done:**
- Lost previous chat session — user requested a full project review to recover context
- Read all key files: `package.json`, `server.js`, `PROJECT.md`, `.env.example`, `public/` (landing, debate room, app.js, style.css), `lib/` (auth, security, store, supabase), `llm/gateway.js`, `lib/prd-factory.js`, `lib/orchestrator.js`, `supabase/schema.sql`, `docs/checklist.md`, `docs/history.md`, `docs/hackathon.md`, `ui/src/` (App.jsx, DashboardView, LandingView, AuthView)
- Provided comprehensive project summary: vision, 5-stage pipeline, tech stack, key files, governance, status
- **User established a must rule:** Every session MUST be documented in the markdown files (history.md, checklist.md, PROJECT.md). No exceptions. This was already a rule from Session 19 but is now re-confirmed as non-negotiable.
- This session entry is being logged per the rule.

**Files modified:**
- `docs/history.md` — this session entry added

**Decisions made:**
- Documentation discipline rule re-confirmed: every exchange, no matter how small, gets logged.
- Project status confirmed: Stages 1–5 built, React UI in `ui/` exists, hackathon deck ready, proof run and submission still pending.

**Current status:**
- All 5 stages: ✅ Built and wired
- Landing page + auth: ✅ Working
- Supabase integration: ✅ 7 tables, dual-mode storage
- React UI (`ui/`): ✅ Built with real backend connection
- Hackathon deck: ✅ Created (`docs/ppt.md`)
- Proof run: ❌ Not started
- Hackathon submission: ❌ Not started
- Demo mode for judges: ❌ Not built

**Next steps:**
1. Decide what to tackle next: proof run, hackathon submission prep, or React UI polish
2. Run the server and test the full flow live

---

## Session 8 — 2026-08-20: Model Fix & Stage 2 Implementation

**Focus:** Fixed broken AI model, began Stage 2 (PRD Factory) implementation

**What was done:**
- Discovered `openai/gpt-oss-20b` is a **reasoning model** — outputs everything in `reasoning` field, not `content`. Our `readSSE` function only reads `content`, so streaming was broken (users saw nothing).
- Also discovered `gpt-oss-20b` does NOT support `json_schema` despite Groq docs — only supports `json_object` mode.
- Tested all available Groq models for chat streaming:
  - `allam-2-7b` — works, content in correct field, but 7B (low quality)
  - `groq/compound-mini` — works, content in correct field, good quality
  - `groq/compound` — works but has reasoning tokens
  - `qwen/qwen3.6-27b` — reasoning model (broken for streaming)
  - `openai/gpt-oss-20b` — reasoning model (broken for streaming)
- **Solution:** Split models by use case:
  - **Chat (Stage 1):** `groq/compound-mini` — fast, correct streaming, good quality
  - **Structured output (Stage 2):** `openai/gpt-oss-20b` with `json_object` mode — works for JSON generation
- Updated `llm/gateway.js`:
  - Changed chat model from `openai/gpt-oss-20b` to `groq/compound-mini`
  - Changed structured output from `json_schema` to `json_object` mode
  - Added comment documenting the finding about gpt-oss-20b not supporting json_schema
- Started Stage 2 implementation:
  - Added POST `/api/finalize` endpoint to `server.js`
  - Added "Finalize Discussion" button to sidebar in `public/index.html`
  - Added finalize handler in `public/app.js` with loading state and briefs display
  - Added finalize button and briefs panel CSS to `public/style.css`
- Confirmed `lib/prd-factory.js` (created in previous session) loads correctly

**Files modified:**
- `llm/gateway.js` — model split (compound-mini for chat, gpt-oss-20b for structured)
- `server.js` — added POST /api/finalize endpoint
- `public/index.html` — added Finalize button and status area to sidebar
- `public/app.js` — added finalize click handler with API call and briefs display
- `public/style.css` — added finalize button and briefs panel styles

**Decisions made:**
- Split models by use case rather than finding one model that does everything
- Use `json_object` mode (not `json_schema`) for structured output — code-side validation needed
- PRD Factory generates briefs server-side, saves to `data/briefs/`, returns JSON to client

**Issues encountered:**
1. `gpt-oss-20b` reasoning model breaks streaming — resolved by switching chat to `compound-mini`
2. `gpt-oss-20b` doesn't support `json_schema` — resolved by using `json_object` mode
3. No Groq model supports both chat streaming AND `json_schema` — resolved by splitting models

**Next steps:**
1. Restart server and test the full Stage 2 flow end-to-end
2. Add code-side validation for `json_object` output (schema validation)
3. Update docs (checklist.md, PROJECT.md, TECH-SPEC.md)
4. Test with a real discussion → finalize → verify briefs are generated correctly

---

## Session 9 — 2026-08-21: Stage 2 Completion & OpenRouter Setup

**Focus:** Testing Stage 2 (PRD Factory), setting up multi-provider fallback, docs panel attempt

**What was done:**
- Successfully tested Stage 2 — PRD Factory generated briefs for a real discussion ("Today Date Web Page")
  - Analysis correctly identified 2 modules (Frontend → Jothick, Styling → max)
  - Generated PRDs, build instructions, definition of done, contract tests
  - Saved to `data/briefs/` on disk ✅
- Verified the finalize endpoint works end-to-end via curl test
- Confirmed Groq Free tier pricing is compliant ($0 budget rule)
- Confirmed only Groq API key needed (OpenRouter/Ollama optional for fallback)
- Clarified Ollama usage: local dev only, not practical for cloud hosting (needs GPU)
- Clarified delivery model: website first (localhost:3000), Electron later for distribution
- Organized all docs into `docs/` folder (completed from Session 6)

**Discussed (no code changes):**
- Hackathon strategy: live stream demo, multi-provider fallback for reliability
- API rate limit concerns and mitigation strategies
- Model pricing and $0 budget compliance
- Online hackathon format: video submission + live application link
- Decision: complete all 5 stages first, polish UI later

**Files modified:**
- `history.md` — added Sessions 6-8
- `PROJECT.md` — updated status, marked Stage 2 partially complete
- `TECH-SPEC.md` — updated model from llama-3.3-70b to openai/gpt-oss-20b
- `checklist.md` — marked Groq key and model updates as complete

**Issues encountered:**
1. Finalize failing with `last message role must be 'user'` — fixed by adding follow-up message if chat history ends with assistant
2. Rate limit (429) on `openai/gpt-oss-20b` for structured output — switched to `groq/compound-mini` which has higher rate limits (250 RPM)
3. `compound-mini` sometimes returns JavaScript code instead of JSON — added `extractJSON` function for aggressive extraction (later reverted per user request)

**Next steps:**
1. Add OpenRouter API key to `.env` for multi-provider fallback
2. Test finalize with OpenRouter fallback working
3. Stage 3: Vibe Coding implementation

---

## Session 10 — 2026-08-21: Stage 3 — Vibe Coding MVP

**Focus:** Built the Stage 3 workspace — module assignment, code editor, file submission

**What was done:**
- Added mandatory doc-update rule (F5 in GOVERNANCE.md, rule 7 in instructions.md)
- Built Stage 3 API endpoints:
  - `GET /api/briefs` — load latest briefs from disk for new clients
  - `POST /api/submit` — submit code files for a module (saves to `data/submissions/<module>/`)
  - `GET /api/submissions` — list all submissions
- Built workspace UI:
  - Module assignment cards in sidebar — each person sees their assigned module
  - Click a module to see brief summary (user stories, files to create, exports, DoD)
  - Simple code editor (monospace textarea) for writing/pasting code
  - Submit button saves code to disk + broadcasts to all members
- Added WebSocket broadcast (`workspace.update`) so all clients see workspace when someone finalizes
- Added `loadBriefs()` on connect — new clients see workspace if briefs exist
- Added OpenRouter to structured output fallback chain (Groq → OpenRouter → Ollama)

**Files modified:**
- `server.js` — added `/api/briefs`, `/api/submit`, `/api/submissions` endpoints; added `workspace.update` broadcast
- `public/index.html` — added workspace panel with module cards, code editor, submit button
- `public/style.css` — added workspace styles (module cards, code editor, submit button)
- `public/app.js` — added `showWorkspace()`, `openModule()`, `loadBriefs()`, submit handler, `workspace.update` handler
- `llm/gateway.js` — added OpenRouter to structured output fallback chain
- `docs/GOVERNANCE.md` — added rule F5 (mandatory doc updates)
- `docs/instructions.md` — added golden rule #7 (mandatory doc updates)
- `docs/PROJECT.md` — added mandatory doc update rule to §8
- `docs/checklist.md` — marked mandatory doc update rule as done

**Decisions made:**
- MVP workspace = textarea editor (not Monaco — save for later)
- Files saved to `data/submissions/<module>/` with metadata
- Max 20 files per submission, reject node_modules and `..` paths
- Module name validated (alphanumeric + hyphens only)

**Next steps:**
1. Restart server and test the full flow: chat → finalize → workspace → code → submit
2. Stage 4: File submission improvements (multer, folder-per-module storage)
3. Stage 5: AI Tech Lead orchestrator

---

## Session 11 — 2026-08-21: OpenRouter Fallback Fix & Robust JSON Extraction

**Focus:** Fixed finalize failing due to rate limits + broken model fallback

**What was done:**
- Discovered finalize was failing because:
  1. Server logs showed `openai/gpt-oss-120b` being used (old model, rate-limited)
  2. `openai/gpt-oss-120b` had only 8,000 TPM limit — hit 429 after ~5K tokens used
  3. Ollama fallback failed (not running locally)
  4. No OpenRouter fallback was in the structured output chain
- Fixed structured output fallback chain: **Groq → OpenRouter → Ollama** (3 providers)
- Added `extractJSON()` function for robust JSON extraction from LLM output:
  - Handles markdown fences, explanation text mixed with JSON, JavaScript code mixed with JSON
  - 5 extraction strategies: direct parse → strip fences → find braces → find brackets → progressive substring
  - Tested with the exact problematic output (`compound-mini` returning JS code)
- Added retry on 429 (3 attempts with 3s delay) for Groq structured output
- Added 1s delay between provider switches to avoid cascading rate limits
- Changed OpenRouter fallback model from dead `meta-llama/llama-3.3-70b-instruct:free` to working `cohere/north-mini-code:free`
- Verified `cohere/north-mini-code:free` returns valid JSON via direct API test
- Updated `.env` with `OPENROUTER_API_KEY` and `OPENROUTER_MODEL=cohere/north-mini-code:free`

**Files modified:**
- `llm/gateway.js` — added `extractJSON()`, `sleep()`, retry logic, OpenRouter to structured chain, changed default model
- `.env` — added OpenRouter key, updated model

**Decisions made:**
- `cohere/north-mini-code:free` over `meta-llama/llama-3.3-70b-instruct:free` — the latter is dead on OpenRouter
- `extractJSON` is preferred over prompt engineering alone — models can't always be trusted to output pure JSON
- 3-retry on 429 with 3s delay is enough to survive Groq rate limits without making the user wait too long

**Issues encountered:**
1. `openai/gpt-oss-120b` rate-limited at 8,000 TPM — resolved by switching structured output to `compound-mini`
2. `compound-mini` sometimes returns JavaScript code instead of JSON — resolved by `extractJSON` function
3. `meta-llama/llama-3.3-70b-instruct:free` no longer available on OpenRouter — resolved by switching to `cohere/north-mini-code:free`
4. OpenRouter not in structured output fallback chain — resolved by adding `openrouterStructured` function
5. Token limit too low (4,096) — PRDs got truncated — resolved by increasing to 8,192 (compound-mini max)
6. Model returns `product_requirements_document` instead of `prd` — resolved by adding normalization in `prd-factory.js`
7. All 4 modules hitting Groq 429 simultaneously — resolved by adding 3s inter-module delay in server.js + exponential backoff (5s/10s)
8. OpenRouter `cohere/north-mini-code:free` returning empty content — resolved by adding `allam-2-7b` as secondary Groq fallback

**Current status:**
- Chat (Stage 1): ✅ Working (`allam-2-7b`)
- Finalize (Stage 2): ⚠️ Rate limit issue — fixed with inter-module delays + exponential backoff + allam fallback
- Workspace (Stage 3): ✅ UI built, needs testing after finalize works

**Next steps:**
1. Restart server and test finalize with the new fallback chain
2. If finalize works, test the full flow: chat → finalize → workspace → code → submit
3. Stage 4: File submission improvements (in progress)
4. Stage 5: AI Tech Lead orchestrator

---

## Session 12 — 2026-08-21: Stage 4 — File Submission

**Focus:** Built proper file upload/download system with drag-drop, file management

**What was done:**
- Installed `multer` for multipart file uploads
- Added file upload endpoints:
  - `POST /api/upload` — multipart form upload (max 20 files, 500KB each, rejects .env/node_modules)
  - `GET /api/files/:module` — list all files in a module directory
  - `DELETE /api/files/:module/*` — delete a specific file from a module
- Added file upload UI:
  - Drag-and-drop zone in workspace editor
  - File picker button (Upload Files)
  - File list showing all submitted files with sizes and delete buttons
  - Upload status indicators (loading/success/error)
- Added WebSocket broadcast (`files.update`) when files are uploaded — all members see updates
- Added `loadModuleFiles()` — loads file list when a module is opened
- Added file management CSS (upload area, file list, file items, delete buttons)
- Fixed `fs` require order (moved to top of server.js)

**Files modified:**
- `server.js` — added multer config, `/api/upload`, `/api/files/:module`, `/api/files/:module/*` DELETE
- `public/index.html` — added upload area, file input, file list in workspace editor
- `public/app.js` — added file upload handlers (drag-drop, file input, upload, list, delete)
- `public/style.css` — added upload area, file list, file item styles

**Decisions made:**
- Max file size: 500KB per file (reasonable for code files)
- Max files per upload: 20
- Rejected files: .env, node_modules, hidden files (.
- Files saved to `data/submissions/<module>/` with metadata in `submission.json`
- File list shows path, size, and delete button

**Next steps:**
1. Restart server and test file upload flow
2. Test drag-and-drop and file picker
3. Stage 5: AI Tech Lead orchestrator

---

## Session 13 — 2026-08-23: Landing Page Decision & Successful End-to-End Test

**Focus:** Full flow tested successfully, decided to add landing page before testing

**What was done:**
- Tested the full flow end-to-end: chat → finalize → workspace → code editor → file upload
- **Stage 1 (Debate Room):** Working perfectly — multiple users joined (Jothick, max, SmokeBot), discussed calendar app, AI facilitated with clarifying questions ✅
- **Stage 2 (PRD Factory):** Finalize SUCCEEDED — generated 4 briefs for the calendar project:
  - UI Module → Jothick
  - Date Service → Max
  - Calendar Service → Max  
  - Backend API → Max
- **Stage 3 (Vibe Coding):** Workspace panel showed module cards, briefs with DoD, code editor ✅
- **Stage 4 (File Submission):** Upload area visible, "Error: Invalid module name" bug identified (pre-fix server running)
- Fixed HTML bug: `class="panel" id="workspace-panel" class="hidden"` had duplicate class attributes — HTML ignored the second one, so workspace was always visible. Fixed to `class="panel hidden" id="workspace-panel"`
- **Landing Page decision:** User wants a landing page + project dashboard before testing further. Currently no way to start new chats or switch between projects.
- Evaluated 3 options: Landing Page (simple), Dashboard (medium), Full Auth (heavy)
- **Decided: Option A — Landing Page** for the hackathon:
  - Entry page with name input, "New Chat" button, past sessions list
  - No auth — just localStorage name persistence (like now)
  - ~1 hour build time, high demo impact
  - Upgrade to full Dashboard post-hackathon

**Decisions made:**
- Landing Page (Option A) chosen over Dashboard (Option B) and Full Auth (Option C)
- Rationale: hackathon judges care about the AI loop, not login; landing page is fast to build and clean for demos
- Past sessions stored in `data/sessions/` as separate JSON files
- "New Chat" clears messages and starts fresh discussion

**Issues encountered:**
1. HTML duplicate class attribute bug — workspace panel always visible → fixed
2. "Invalid module name" error on upload area — caused by workspace being visible before module selected → fixed by hiding panel properly
3. Module assignment uneven (3 to Max, 1 to Jothick) — noted for future improvement

**Next steps:**
1. Build the Landing Page (entry page + new chat + past sessions)
2. Test the full flow with landing page
3. Stage 5: AI Tech Lead orchestrator
4. Proof run: build a to-do app through the platform

---

## Session 15 — 2026-08-24: Clear Chat + /ai Command Control

**Focus:** User requested Clear Chat button and on-demand AI (only respond when called)

**What was done:**
- Added `POST /api/clear-chat` endpoint — wipes messages, briefs, submissions, reports from disk
- Added `Clear Chat` button in sidebar (red outline, below member list)
- Added confirmation dialog before clearing (prevents accidental wipe)
- Client resets all local state on clear (messages, workspace, integrate panel)
- **Changed AI behavior:** Braidly no longer auto-responds to every message
  - AI only responds when someone types `/ai` (or `/ai <specific question>`)
  - `/ai` alone → AI responds based on full chat history
  - `/ai how should we structure the database?` → AI responds with that specific context
- Updated chat placeholder to hint about `/ai` command
- Updated empty state to explain the `/ai` command
- Added CSS for Clear Chat button (red border, hover effect)

**Files modified:**
- `server.js` — added `/api/clear-chat` endpoint, changed `chat.message` handler to only call `runFacilitator()` when message starts with `/ai`
- `public/index.html` — added Clear Chat button, updated placeholder and empty state text
- `public/app.js` — added clear chat handler, updated `showWorkspace()` to handle cleared state
- `public/style.css` — added `.clear-chat-btn` styles

**Decisions made:**
- On-demand AI (`/ai` command) over auto-respond — saves API calls, cleaner UX
- Clear Chat wipes everything (messages + briefs + submissions + reports) — clean slate for new projects
- No undo on clear — intentional design to force deliberate action

**Next steps:**
1. Restart server and test Clear Chat + /ai command
2. Build Landing Page (entry page + new chat + past sessions)
3. Test full flow end-to-end

---

## Session 16 — 2026-08-24: Truncated JSON Fix + /ai Double-Prefix Fix + Module Name Sanitization

**Focus:** Fixed bugs discovered during testing: JSON truncation, double `/ai` prefix, module name spaces breaking submissions and integration

**What was done:**
- **Fixed `extractJSON()` for truncated JSON:** Added strategy 6 — when models run out of tokens mid-output, the function now progressively removes trailing incomplete keys/values and auto-closes open braces to recover partial JSON.
- **Fixed `/ai` double-prefix:** Server now strips ALL `/ai` prefixes in a loop.
- **Fixed module name spaces:** AI generates names like "CSS Module" and "HTML Module" with spaces. Server validation `/^[a-zA-Z0-9_-]+$/` rejected them. Added `sanitizeModuleName()` that replaces spaces with hyphens (`CSS Module` → `CSS-Module`). Applied to:
  - `server.js`: submit, upload, files, delete endpoints
  - `server.js`: finalize (sanitizes names before saving briefs)
  - `orchestrator.js`: brief module names, contract file lookup, test file lookup
  - `public/app.js`: client-side sanitization when setting codeEditor.dataset.module
- **Fixed orchestrator name mismatch:** Briefs had `HTML Module` (space), submissions had `HTML-Module` (hyphen). Orchestrator compared them → no match → "NOT SUBMITTED". Fixed by sanitizing brief names in orchestrator before comparison.
- **Fixed PRD persistence:** PRD view now persists across page refreshes via localStorage (`braidly.lastModule`). Last viewed module auto-opens on reload.
- **Fixed store.clear():** Clear Chat now wipes both in-memory array AND disk file (before: only wrote `[]` to disk, in-memory kept old messages).

**Files modified:**
- `llm/gateway.js` — enhanced `extractJSON()` with truncated JSON recovery
- `server.js` — `/ai` prefix stripping, `sanitizeModuleName()`, `store.clear()`
- `lib/store.js` — added `clear()` method
- `lib/orchestrator.js` — `sanitizeModuleName()`, fixed contract/test file lookup
- `public/app.js` — client-side sanitization, PRD persistence in localStorage

**Why this matters:**
- Module name sanitization is critical — without it, submissions and integration can never work because the AI always generates names with spaces
- The orchestrator mismatch was the root cause of "INCOMPLETE" reports despite successful submissions
- PRD persistence makes the app feel like a real product instead of a stateless demo

---

## Session 14 — 2026-08-23: Stage 5 — AI Tech Lead Orchestrator

**Focus:** Built the orchestrator that verifies modules, runs security scans, and fixes issues

**What was done:**
- Created `lib/orchestrator.js` — the AI Tech Lead module:
  - **Module scanning:** reads `data/submissions/` for submitted modules
  - **Contract verification:** loads `contract.json` from `data/briefs/` per module
  - **Static security scans (GOVERNANCE A-rules):**
    - A5: Scans for hardcoded secrets (API keys, tokens, passwords)
    - C1: Scans for error masking (empty catch blocks)
    - C4: Flags god-objects (>500 line files)
    - B1/B4: Checks imports against dependency whitelist
  - **File existence checks:** verifies entry points, README (C5)
  - **Dependency checks (B2):** flags unpinned versions in package.json
  - **Contract test runner:** executes auto-generated test files per module
  - **AI fix loop (E1, E2):** if critical issues found, sends errors to LLM gateway for minimal patches, retries ≤3 attempts, logs every attempt
  - **Integration report:** pass/fail/fixed/missing per module, saved to `data/reports/`
- Added `POST /api/integrate` endpoint in server.js (2-min timeout)
- Added `GET /api/reports` endpoint to load latest integration report
- Added WebSocket broadcast (`integration.update`) for real-time report sync
- Added UI:
  - "AI Tech Lead" panel with "Integrate Modules" button
  - Integration report display (summary stats + per-module details)
  - Issue severity coloring (critical = red, warning = yellow)
  - AI fix indicators in the report
- Fixed duplicate class attribute bug on integrate panel (same as workspace panel)

**Files created:**
- `lib/orchestrator.js` — full orchestrator module (~300 lines)

**Files modified:**
- `server.js` — added `/api/integrate`, `/api/reports` endpoints, orchestrator require
- `public/index.html` — added AI Tech Lead panel + integration report display
- `public/app.js` — added integrate button handler, `renderReport()`, `loadReport()`, `integration.update` handler
- `public/style.css` — added integration report styles (stats, module cards, issues)

**Decisions made:**
- MVP orchestrator does static verification + security scans (not full build/run)
- AI fix loop appends patches as comments (safe — doesn't overwrite original code)
- 2-minute timeout on integration (avoids hanging on LLM calls)
- Report saved to disk for persistence across sessions

**Architecture (per GOVERNANCE E-rules):**
- E1: Minimal-diff fixing — AI suggests targeted patches, not whole-module rewrites
- E2: Bounded fix loop — ≤3 attempts, every attempt logged
- E3: Integration report = audit trail — per-module pass/fail, what was fixed
- E5: Full context — orchestrator receives contract + constitution + all briefs

**Next steps:**
1. Restart server and test the full flow: chat → finalize → code → submit → integrate
2. Test AI fix loop with a module that has intentional issues
3. Proof run: build a to-do app through the platform

---

## Session 20 — 2026-08-26: Hackathon Presentation PPT Created

**Focus:** Created comprehensive hackathon presentation deck for AI Builders Hackathon (online video submission, solo)

**What was done:**
- Created `docs/ppt.md` with all 10 slides plus appendices for hackathon presentation
- Researched all project files to gather complete information
- Structured slides per hackathon requirements: Problem, Solution, Features, Innovation, Architecture, AI Tech, Impact, Demo Script, Roadmap
- Added speaker notes for each slide with timing guidance
- Added 4 appendices: Project Structure, Setup Instructions, Security Features, Key Statistics for Q&A
- Added 2-minute demo script with backup plan for Groq rate limits

**Files created:** `docs/ppt.md`

**Decisions made:**
- 10-slide format (hackathon limit) with online video submission format
- Solo presentation (Jothick)
- Slide flow: Problem -> Solution -> Innovation -> Features -> Architecture -> AI Tech -> Impact -> Demo -> Roadmap
- 2-minute demo script with pre-recorded backup for rate limit issues

### Git Repository Initialized
- Initialized git repository in project folder
- Configured git identity: `jothick-dev` / `meherjothicknalla@gmail.com`
- `.gitignore` protects: `.env`, `data/`, `node_modules/`, `*.log`, `.freebuff/`
- First commit: `a53edb4` — 24 files, 7,415 lines of code
- Working tree clean, ready to push to GitHub

---

## Session 19 — 2026-08-24: Q&A & Documentation Discipline

**Focus:** User caught me not logging smaller exchanges to the md files. Established mandatory documentation discipline.

**Discussed (no code changes):**
- **MAX_HISTORY_MESSAGES** — explained the `MAX_HISTORY = 20` constant in `server.js`:
  - Controls how many messages the AI sees when `/ai` is called (last 20 messages sent to Groq)
  - Keeps context within Groq's 8K token limit
  - Can be overridden via `MAX_HISTORY_MESSAGES=50` in `.env` if more context is needed
- **Documentation rule reminder** — user confirmed the mandatory rule: every exchange, no matter how small, must be logged in the md files (history.md, checklist.md, PROJECT.md)
- **PRD-reading skill** — user asked about the concept of the AI reading contracts to understand what to build. Confirmed the full PRD view (Session 18) is exactly this: the complete contract generated by the AI during finalize is now visible to the user, so they know exactly what to implement

**Files modified:**
- `docs/history.md` — this session entry

**Rule reinforced:**
- **Every exchange must be logged.** No exceptions. Even quick Q&A about MAX_HISTORY_MSGS gets documented.

---

## Session 18 — 2026-08-24: Full PRD View with Contract Details

**Focus:** User reported that PRD view doesn't show enough detail — submitted code fails integration because the full contract (acceptance criteria, file structure, security rules, DoD checklist) wasn't visible.

**What was done:**
- Added `GET /api/contract/:module` endpoint to server.js — loads the per-module contract JSON from disk
- Rewrote `openModule()` in app.js to display the FULL contract:
  - **Acceptance Criteria** — what the orchestrator checks for
  - **Functional Requirements** — what the module must do
  - **Non-Functional Requirements** — performance, compatibility constraints
  - **File Structure** — exact files to create (e.g., `style.css`)
  - **Exported Entities** — functions/classes/CSS selectors the module exposes
  - **Integration Steps** — how to connect this module with others
  - **Security Constitution** — A1-A10 rules (from shared contract)
  - **Data Models** — entity definitions (from shared contract)
  - **Tech Stack** — frontend/backend/database (from shared contract)
  - **Do Not Touch** — protected files (from shared contract)
- Shared contract section loads asynchronously after the brief info (non-blocking)
- Updated docs (history.md, checklist.md)

**Files modified:**
- `server.js` — added `/api/contract/:module` endpoint
- `public/app.js` — rewrote `openModule()` with full contract display, added `fetchContract()` helper

**Why this matters:**
- Before: user saw only a 200px squished PRD with partial info → submitted code didn't match → integration warnings
- After: user sees the COMPLETE contract with acceptance criteria, file structure, security rules, and DoD → knows exactly what to implement → integration passes

---

## Session 21 — 2026-08-26: Landing Page Built

**Focus:** Added entry page with New Chat button, past sessions list, and project features overview

**What was done:**
- Created `public/landing.html` — landing page with:
  - Project branding (logo, tagline, 5-stage pipeline)
  - Name input + "New Chat" button
  - Past sessions list (loaded from server)
  - Feature cards (Debate Room, PRD Factory, Vibe Coding, AI Tech Lead)
- Created `public/landing.js` — client-side logic for:
  - Loading and displaying past sessions (sorted newest first)
  - Creating new sessions (generates session ID, stores in localStorage)
  - Resuming past sessions (navigates to /app?session=ID)
  - Name persistence (saves to localStorage)
  - Date formatting (relative time: "5m ago", "2h ago")
- Added landing page CSS to `public/style.css` (responsive grid, dark mode consistent with existing theme)
- Updated `server.js`:
  - Added `/` route serving `landing.html`
  - Added `/app` route serving `index.html` (debate room)
  - Added `GET /api/sessions` endpoint — lists all saved sessions
  - Added `GET /api/sessions/:id` endpoint — loads session metadata
  - Updated `/api/clear-chat` to archive current session before clearing (saves messages + briefs + metadata to `data/sessions/<id>/`)
  - Clear chat now returns `newSessionId` for client navigation
- Updated `public/app.js`:
  - Reads session ID from URL query parameter (`?session=xxx`)
  - Creates new session if none exists (direct navigation to /app)
  - Clear chat now passes sessionId to archive before clearing

**New files:**
- `public/landing.html` — landing page HTML
- `public/landing.js` — landing page client script

**Files modified:**
- `server.js` — routes, session API, clear-chat archival
- `public/app.js` — session management from URL
- `public/style.css` — landing page styles

**New API endpoints:**
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Landing page (entry screen) |
| `/app` | GET | Debate room (main app) |
| `/api/sessions` | GET | List all saved sessions |
| `/api/sessions/:id` | GET | Get session metadata |

**New data directory:** `data/sessions/` — stores archived session data (messages, briefs, metadata)

**New flow:**
1. User visits `/` → Landing page shows
2. Enter name + click "New Chat" → navigates to `/app?session=xxx`
3. Or click a past session card → navigates to `/app?session=yyy`
4. In debate room, "Clear Chat" archives current session and starts fresh

---

## Session 22 — 2026-08-27: Supabase Integration + Auth + Landing Page Upgrade

**Focus:** Integrated Supabase for database, auth, and production storage. Upgraded landing page with Sign In/Sign Up.

**What was done:**
- Created Supabase project (braidly-prod) on supabase.com (free tier)
- Created `supabase/schema.sql` — full database schema with 7 tables:
  - `profiles` (extends auth.users with display_name, avatar_color)
  - `sessions` (project sessions with user_id, title, status)
  - `messages` (chat messages per session)
  - `briefs` (PRD Factory output per session)
  - `shared_contracts` (shared contract per session)
  - `submissions` (code files per module)
  - `reports` (integration reports per session)
- Created `supabase/fix-security-warnings.sql` — migration to fix Security Advisor warnings (SET search_path, restrict function execution)
- Fixed CSP in `lib/security.js` — added `https://cdn.jsdelivr.net` to `script-src` so Supabase CDN loads
- Installed `@supabase/supabase-js` package
- Created `lib/supabase.js` — Supabase client module (server-side service role + anon key for frontend)
- Created `lib/auth.js` — auth middleware (requireAuth, optionalAuth)
- Rewrote `lib/store.js` — dual-mode storage (Supabase when configured, JSON files as fallback)
- Updated `server.js`:
  - Added `/api/config` endpoint (safe: returns only anon key)
  - Added `/api/auth/me` endpoint
  - Added session CRUD endpoints (Supabase + local fallback)
  - Added auth middleware on session endpoints
  - Added Supabase client initialization with fallback warnings
- Updated landing page:
  - `public/landing.html` — added Sign In / Sign Up forms, dashboard section, Supabase CDN script
  - `public/landing.js` — Supabase auth flow (login, signup, signout, session persistence)
  - `public/style.css` — auth form styles
- Updated debate room:
  - `public/index.html` — added Supabase CDN script
  - `public/app.js` — auth token on API calls, Supabase client initialization
- Updated `.env.example` with Supabase variables
- Added debug logging in `server.js` (SUPABASE_URL/KEY status)
- Added null checks in `landing.js` login/signup handlers (shows clear error if Supabase not configured)

**Bug fixes:**
- CSP blocking Supabase CDN script → added `https://cdn.jsdelivr.net` to script-src
- Login form crashing with "Cannot read properties of null (reading 'auth')" → added null check + clear error message
- `.env` keys not detected → user needed to add SUPABASE_URL and SUPABASE_ANON_KEY to actual .env file (not .env.example)

**Security Advisor warnings:**
- Ran SQL fix: SET search_path = public, pg_temp on handle_new_user()
- Ran SQL fix: revoked direct execution from public/authenticated roles
- Result: 5 warnings → 3 warnings (remaining 2 are Supabase's own rls_auto_enable function — can't modify)

**Files created:** `supabase/schema.sql`, `supabase/fix-security-warnings.sql`, `lib/supabase.js`, `lib/auth.js`, `public/landing.js` (rewritten)
**Files modified:** `server.js`, `lib/store.js`, `lib/security.js`, `public/landing.html`, `public/app.js`, `public/index.html`, `public/style.css`, `.env.example`

**Decisions made:**
- Supabase free tier (500MB DB, 1GB storage, 50K MAU) — sufficient for hackathon
- Dual-mode storage: Supabase when configured, JSON files as fallback — works offline and online
- Keep custom WebSocket chat (not Supabase Realtime) — our protocol is more specialized
- Auth: Supabase Auth (email/password) — replaces localStorage name
- Demo mode (no-login for judges) — planned for next session

**Current status:**
- Auth: ✅ Working (Supabase email/password login + signup)
- Database: ✅ 7 tables created with RLS policies
- Storage: ⚠️ Dual-mode (Supabase + JSON fallback)
- Demo mode: ❌ Not yet built

**Next steps:**
1. Build demo mode for hackathon judges (no-login access)
2. Test full flow with Supabase storage
3. Push to GitHub (public repo required for hackathon)
4. Record demo video

---

## Session 23 — 2026-08-29: Complete UI Redesign

**Focus:** Redesigned the entire Braidly UI per the user's design spec — ink-charcoal palette, graph-paper grid, 3-column Team Chat, Module Submission table.

**What was done:**
- **Redesigned `public/index.html`** — complete rewrite with:
  - 3-column layout (People sidebar / Message thread / PRD+Doc sidebar)
  - Header with logo, screen switcher (Team Chat / Modules), status pill, Home link
  - Left sidebar: participant list with avatars, online dots, AI badge
  - Center: scrollable message thread with AI-tagged bubbles + composer
  - Right sidebar: PRD Factory, PRD Showcase (index cards with pushpin), Workspace, Integration panel
  - Screen switcher to toggle between Team Chat and Module Submission views
  - Module Submission view: table with Person/Role/Module/Status/Submission + Integration panel
- **Redesigned `public/style.css`** — full rewrite with:
  - Design tokens: ink #14171C, surface #1C2028, accent #F2B84B, AI #6C8EF5
  - Graph-paper grid overlay on body
  - Index-card rotation (1-2°) with pushpin for PRD/Doc showcase
  - IBM Plex Mono for module names, tags, status pills
  - Color-coded tabs on Module Submission table rows
  - Status badges (submitted/in-progress/not-started) with color coding
  - Connection status pill (connected/reconnecting/disconnected) with dot + label
  - Responsive breakpoints for mobile
- **Rewrote `public/app.js`** — complete rewrite with:
  - Screen switching between Team Chat and Module Submission views
  - PRD Showcase rendering in right sidebar (index cards with pushpin)
  - Module Submission table rendering from briefs + file submission status
  - Color-per-person system for avatars, tabs, and status chips
  - All existing functionality preserved: WebSocket chat, finalize, workspace, upload, integration
  - Auth token on all API calls
  - Updated status classes (status-msg instead of submit-status/finalize-status)
- **Fixed `/api/sessions` 401 error** — changed `requireAuth` → `optionalAuth` on session endpoints so landing page works before login

**Files modified:** `public/index.html`, `public/style.css`, `public/app.js`, `server.js`

**Design decisions:**
- Built with vanilla HTML/CSS/JS per TECH-SPEC (zero build step)
- React `ui/` folder abandoned — violates project rules
- Graph-paper grid overlay for "sketching ideas" aesthetic
- Index cards with rotation for PRD/Doc showcase — "your scrappy chat, turned into something pinned down"
- Color-per-person for module ownership at a glance
- IBM Plex Mono for technical elements, Inter for body text

**Current status:**
- Team Chat (3-column): ✅ Complete
- Module Submission table: ✅ Complete
- Screen switcher: ✅ Working
- All existing functionality: ✅ Preserved

---

## Session 24 — 2026-08-30: React UI with Real Backend Connection

**Focus:** Built React frontend (in `ui/` folder) connected to the real Braidly backend — WebSocket chat, Supabase auth, API calls.

**What was done:**
- Created `ui/` directory with React + Vite + Tailwind CSS 4 + lucide-react
- Built `ui/src/lib/supabase.js` — browser-side Supabase client using `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- Built `ui/src/lib/api.js` — API helper with auth token injection (reads from Supabase session)
- Built `ui/src/lib/websocket.js` — WebSocket manager with auto-reconnect, presence, typing indicator
- Built `ui/src/App.jsx` — main app with screen routing: Landing → Auth → Dashboard → TeamChat / ModuleSubmission
- Built `ui/src/AuthView.jsx` — Sign In / Sign Up / Skip (guest mode) with Supabase auth
- Built `ui/src/TeamChatView.jsx` — 3-column layout connected to real WebSocket + API:
  - People sidebar with presence from server
  - Message thread with real messages + AI streaming via `/ai` command
  - Right sidebar: PRD Factory (finalize), PRD Showcase, Workspace, Integration
  - Screen switcher to Module Submission
- Built `ui/src/ModuleSubmissionView.jsx` — table connected to real API data (briefs + submissions)
- Built `ui/src/index.css` — ink-charcoal design system with graph-paper grid, index-card rotation, IBM Plex Mono
- Configured `ui/vite.config.js` — proxy `/api` and `/ws` to backend on port 3000
- Installed `@supabase/supabase-js` in `ui/`
- **Tested end-to-end:** Auth → Skip → Dashboard → New Chat → Debate Room → `/ai` → AI streamed real response ✅

**Files created:** `ui/package.json`, `ui/vite.config.js`, `ui/index.html`, `ui/src/main.jsx`, `ui/src/App.jsx`, `ui/src/AuthView.jsx`, `ui/src/TeamChatView.jsx`, `ui/src/ModuleSubmissionView.jsx`, `ui/src/index.css`, `ui/src/lib/supabase.js`, `ui/src/lib/api.js`, `ui/src/lib/websocket.js`

**Decisions made:**
- React UI runs on port 5173 (Vite dev server), backend on port 3000 — Vite proxies API/WS calls
- Guest mode ("Skip for now") allows testing without Supabase account
- Supabase auth is optional — app works with or without it
- All WebSocket protocol matches existing server (join, message, stream, presence, typing)

**Architecture:**
```
ui/ (React, port 5173)  ──proxy──▶  server.js (Node, port 3000)
     Vite dev server                    WebSocket + REST
     Tailwind CSS 4                     LLM Gateway
     Supabase JS                        Supabase DB
```

**Current status:**
- React UI: ✅ Both screens connected to real backend
- WebSocket chat: ✅ Real-time messages with AI streaming
- Supabase auth: ✅ Sign In / Sign Up / Guest mode
- Screen switching: ✅ Team Chat ↔ Module Submission

**Next steps:**
1. Add persistent sidebar navigation (Dashboard, Profile, Settings)
2. Add marketing landing page
3. Build full Dashboard with session history and activity stats

---

## Session 25 — 2026-08-30: Sidebar + Dashboard + Marketing Landing Page

**Focus:** Added persistent sidebar navigation, Dashboard with activity stats, and public marketing landing page.

**What was done:**
- **Created `ui/src/Sidebar.jsx`** — persistent left sidebar with:
  - User avatar (color-coded), display name, email
  - Navigation: Home, Profile, Dashboard (active indicator), Project, Team
  - Bottom section: About, Sign out, Collapse toggle
  - Braidly branding at bottom
  - Collapsible (icon-only mode)
- **Created `ui/src/DashboardView.jsx`** — dashboard with:
  - "Welcome back, {name} 👋" header
  - Stats row: Projects count, Messages count, Active members, Last active time
  - New project input + "+ New Chat" button
  - Activity ring (SVG progress ring showing project count)
  - Previous Projects grid (empty state with "Create your first project")
  - Feature cards: Debate Room, PRD Factory, Vibe Coding, AI Tech Lead
  - Footer with "Built for the AI Builders Hackathon"
- **Created `ui/src/LandingView.jsx`** — public marketing landing page with:
  - Nav bar: Braidly logo, Home, About, Privacy Policy, Search bar, Login, Sign Up (yellow)
  - Hero: `{Braidly}` title, product description, Get Started + Try Demo buttons, 5 stage pills, animated orbiting hex
  - Features section: "How it works" heading, 4 feature cards
  - About section: "Contract-first development" with 5-stage numbered pipeline
  - CTA: "Ready to build something together?" + Start Building button
  - Footer: Braidly logo, "Built for the AI Builders Hackathon", About/Privacy links
- **Updated `ui/src/App.jsx`** — full navigation flow:
  - Landing page → Auth → Dashboard (with sidebar) → Team Chat / Module Submission
  - Sidebar persists across Dashboard, Chat, and Module views
  - "← Home" button in Team Chat header navigates back to Dashboard
  - Auth accepts `onBack` prop for navigation
- **Updated `ui/src/AuthView.jsx`** — added back navigation to landing page

**Files created:** `ui/src/Sidebar.jsx`, `ui/src/DashboardView.jsx`, `ui/src/LandingView.jsx`
**Files modified:** `ui/src/App.jsx`, `ui/src/AuthView.jsx`

**Navigation flow:**
```
Landing Page → Login/Sign Up → Dashboard (with persistent sidebar)
                                    ↓
                              Sidebar: Home | Profile | Dashboard | Project | Team
                                    ↓
                              "+ New Chat" → Active Session (Team Chat / Modules)
                                    ↓
                              "← Home" → Dashboard
```

**Design decisions:**
- Sidebar persists across all authenticated screens (dashboard, chat, modules)
- Marketing landing page is public (no auth required)
- Login/Sign Up redirect back to landing page flow
- Dashboard shows activity stats from Supabase (projects, messages, active members)
- Feature cards on dashboard explain the 5-stage pipeline to new users

**Current status:**
- Landing page (marketing): ✅ Complete with nav, hero, features, about, CTA, footer
- Sidebar navigation: ✅ Persistent across all screens
- Dashboard: ✅ User info, stats, activity ring, previous projects, feature cards
- Full flow: ✅ Landing → Auth → Dashboard → Chat → Modules

---

---

## Session 27 — 2026-09-03: React UI Becomes the Face of Braidly

**Focus:** Making the React UI (`ui/`) the primary frontend served by `server.js`, replacing the vanilla `public/` UI as the default.

**What was done:**
- Diagnosed why `npm install` failed twice with exit 127: `npm` is not on the system PATH (known since Session 7), and the `npm.cmd` shim also could not run. Workaround: invoke npm directly through node — `node C:\Users\meher\nodejs\node_modules\npm\bin\npm-cli.js`. esbuild's postinstall also needs `node` on PATH, so installs run with PATH prefixed with `C:\Users\meher\nodejs`.
- Installed `ui/` dependencies (91 packages, 0 vulnerabilities).
- Built the React app: `npm run build` in `ui/` → `ui/dist/` (vite v6.4.3; 472 KB JS / 28 KB CSS).
- **`server.js` now serves the React build:**
  - `express.static` serves `ui/dist` (React) plus `public` (legacy assets) when the build exists.
  - `/` and `/app` now send `ui/dist/index.html` instead of `public/landing.html` / `public/index.html`.
  - Added SPA fallback: any non-API GET (e.g. `/dashboard`) serves `ui/dist/index.html`; `/api/*` and non-GET requests still return JSON 404.
  - Graceful degradation: if `ui/dist` is missing (e.g. fresh clone), the server logs a warning and serves the legacy vanilla UI from `public/`, so the app never 500s.
- Added `build:ui` script to root `package.json` (`cd ui && npm run build`).
- Added `ui/dist/` to `.gitignore`.
- Verified both paths with curl: React build at `/` and `/app`, SPA fallback 200, `/api/*` JSON 404 intact, assets load, and the legacy fallback serves the vanilla landing page when `ui/dist` is hidden.

**Files modified:** `server.js`, `package.json`, `.gitignore`, `docs/history.md`, `docs/checklist.md`, `docs/PROJECT.md`

**Decisions made:**
- The React UI (`ui/`) is now the face of Braidly — one server, one port (3000); no separate Vite dev server needed for normal use.
- Vanilla `public/` UI stays on disk as the fallback if the React build is absent; explicit file paths still reach it.
- The React app fetches Supabase config at runtime from `/api/config`, so no separate `VITE_` env vars are needed in `ui/`.

**Current status:**
- React UI served at `/` and `/app`: ✅ Working
- SPA fallback for unknown GETs: ✅ Working
- Legacy vanilla fallback when `ui/dist` missing: ✅ Working
- Rebuild flow after `ui/src` changes: `npm run build:ui` at the repo root

**Next steps:**
1. Run `npm start` and click through the React UI in the browser
2. Continue with proof run / hackathon submission prep

---

---

## Session 28 — 2026-09-03: Guest/Demo Mode for Hackathon Judges

**Focus:** Letting hackathon judges (and anyone) experience Braidly without creating an account or entering credentials.

**What was done:**
- The landing page already had a "Try Demo" button (hero CTA) that enters guest mode via `handleDemo` in `App.jsx` — no credentials needed. Guest sessions are fully client-side; every pipeline endpoint (`/api/sessions`, `/api/messages`, `/api/finalize`, `/api/submit`, `/api/integrate`, …) already runs on `optionalAuth` or no auth, so guest mode works end-to-end.
- **The gap:** the Sign In / Sign Up screen (`AuthView.jsx`) forced credentials — judges who clicked "Login" or "Get Started" were stuck.
- Added a **"Skip for now — explore as Guest"** button to `AuthView.jsx` (with an "or" divider below the form), wired through a new `onDemo` prop from `App.jsx`. Caption: "No sign-up needed. Great for hackathon judges and quick demos."
- Fixed a pre-existing CSP issue discovered during verification: Google Fonts (`fonts.googleapis.com` / `fonts.gstatic.com`) were blocked by `style-src`/`font-src`, so the IBM Plex Mono / Inter branding silently fell back to system fonts. Added both domains to the allowlist in `lib/security.js` (A8/A9 governance rules — still a strict allowlist, no wildcards).
- Rebuilt the UI (`npm run build:ui`) and restarted the server on port 3000.
- **Verified live in the browser:** Landing → Login → "Skip for now — explore as Guest" → dashboard as "Guest" (guest@local) → "New Chat" ("Demo: To-Do App") → Team Chat with working WebSocket presence ("Guest joined the room."). Console clean after the CSP fix; fonts now load (200).

**Files modified:** `ui/src/AuthView.jsx`, `ui/src/App.jsx`, `lib/security.js`, `docs/history.md`, `docs/checklist.md`, `docs/PROJECT.md`

**Decisions made:**
- Guest/demo entry is available on BOTH the landing hero ("Try Demo") and the auth screen ("Skip for now — explore as Guest") so judges never hit a wall.
- Guest mode needs no code on the backend — all pipeline endpoints already tolerate missing auth.
- Font domains allowlisted in CSP; remaining policy unchanged (strict allowlist, `object-src 'none'`, `frame-ancestors 'none'`, etc.).

**Current status:**
- Guest/demo entry points: ✅ Landing "Try Demo" + Auth "Skip for now — explore as Guest"
- Guest flow verified end-to-end: ✅ Landing → dashboard → chat (WS presence)
- Google Fonts under CSP: ✅ Loading (console clean)
- Server running on http://localhost:3000 (restarted to apply changes)

**Next steps:**
1. Let the user click through the demo; optionally seed a pre-populated demo session for judges
2. Continue with proof run / hackathon submission prep

---

## Session 29 — 2026-09-03: Signup Fixed — "Supabase not configured" Root Cause

**Focus:** User reported "Supabase not configured. Add keys to .env" when trying to sign up (Sign Up tab) in the browser.

**What was done:**
- Root cause found: `require('dotenv').config()` loads `.env` relative to the **current working directory**, not the script's folder. Launching the server from any other directory (full node path, different shell cwd, shortcut) silently started it with no Supabase keys → `/api/config` returned `supabase: null` → the React auth screen showed "Supabase not configured."
- The `.env` file itself was fine — all three SUPABASE keys present (verified, redacted). A fresh server started from the project root loaded the keys correctly.
- Fix in `server.js`: `require('dotenv').config({ path: path.join(__dirname, '.env') })` — pin the `.env` lookup to the server's own folder so the launch directory no longer matters. (Moved `const path = require('path')` above the dotenv call.)
- Verified: `/api/config` now returns the Supabase URL + anon key; Supabase project reachable with the anon key (auth settings → HTTP 200).
- **Browser test (preview):** Sign Up tab → filled the form → Create Account → account created on Supabase and the app navigated to the Dashboard as the new user. First attempt used `@example.com`, which Supabase rejects as an invalid email domain — expected Supabase behavior, not a Braidly bug.
- Note: one throwaway test account (`braidly.test.0903@gmail.com` / `TestPass123!`) was created in the Supabase project during verification — safe to delete via Supabase dashboard → Authentication → Users.

**Files modified:** `server.js`, `docs/history.md`, `docs/checklist.md`, `docs/PROJECT.md`

**Decisions made:**
- dotenv loads from the script directory (`__dirname`), so Braidly works regardless of how or where the server is launched.

**Current status:**
- Signup: ✅ works end-to-end (real Supabase account creation → Dashboard)
- Signin: same Supabase client path — expected to work; user to confirm with their own account
- Server running on http://localhost:3000

**Next steps:**
1. User signs up / signs in with their own email and continues the demo
2. Continue with proof run / hackathon submission prep

---

## Session 30 — 2026-09-04: Full-Background Braid Animation (Landing Page)

**Focus:** User asked for the landing page's small right-side ring animation to become a full-background animation with floating text. Video vs code was discussed — user approved **code-generated** canvas animation with a specific concept: multiple threads weaving together into one larger, stronger thread, with a cinematic camera (close-up on a thread → parabolic pull-back → reveal of the whole weave).

**What was done:**
- New `ui/src/BraidBackground.jsx`: full-screen `<canvas>` (raw 2D, zero dependencies). World scene: 3 braid groups × 4 strands (12 threads) in the brand palette (accent `#F2B84B`, ai `#6C8EF5`, green `#4ADE80`, amber `#FBBF24`). Strands are sine paths with phase offsets so they cross/weave; each is rendered two-pass (darker under-stroke + bright over-stroke) so overlaps read as threads passing over/under; a fine "fiber twist" term makes threads look like real fiber when zoomed in.
- Convergence story: threads are loose, thin and spread out on the left, weave tighter through the middle, and emerge on the right as one noticeably thicker braided rope.
- Camera choreography (once per page load): Act 1 macro ~2.4s hovering ~8× on a single thread → Act 2 parabolic pull-back ~3.4s (arcs up and over, zoom eases to wide) → Act 3 ambient wide reveal with slow drift forever. Hero text fades in at the reveal (opacity 20% → 100%).
- `LandingView.jsx`: mounts `<BraidBackground />`, removed the old spinning-ring widget, hero text is now full-width floating over the animation; dark radial-gradient overlay keeps text readable and settles at the reveal.
- Accessibility/performance: `prefers-reduced-motion` skips straight to the static wide scene; canvas paused when the tab is hidden; DPR-aware; world height adapts to the viewport aspect so the scene fills any screen proportionally.
- Verified live in preview: weave visible across the whole page, canvas frames continuously changing (animation running), text readable, console clean. Rebuilt via `npm run build:ui` (node-invoked npm with PATH prefix).

**Files modified:** `ui/src/BraidBackground.jsx` (new), `ui/src/LandingView.jsx`, `docs/history.md`, `docs/checklist.md`, `docs/PROJECT.md`

**Decisions made:**
- Code-generated canvas animation over video: KBs vs MBs, razor-sharp on projectors, seamless loop, exact brand colors, no hosting/codec concerns.
- Camera flight plays once per page load (no replay on scroll-to-top).

**Current status:**
- Landing page: full-background weave animation with cinematic intro ✅ (server running on http://localhost:3000)

**Next steps:**
1. User watches the intro on their monitor and fine-tunes (timing, brightness, speed)
2. Proof run / hackathon submission prep

---

## Session 31 — 2026-09-14: PRD Cards Fixed — PascalCase vs snake_case

**Focus:** User reported that after clicking "Finalize Discussion", the PRD Showcase cards only showed "Module brief" with no actual PRD content visible.

**Root cause:** Two-layer mismatch:
1. **PascalCase vs snake_case:** The LLM returns PRD data with PascalCase keys (`PRD`, `BuildInstructions`, `DefinitionOfDone`) but the frontend expected snake_case (`prd`, `build_instructions`, `definition_of_done`).
2. **User story format:** The LLM returns user stories as objects (`{ as_a, i_want, so_that }`) but the frontend rendered them as plain strings.
3. **BuildInstructions keys:** The LLM returned completely different keys (`repo_layout`, `directory_structure`, `file_details`, `npm_scripts`, etc.) instead of the schema's expected keys (`file_names`, `exported_signatures`, `dependencies`).

**What was done:**
- Updated `TeamChatView.jsx` to normalize both PascalCase and snake_case field names when extracting PRD data.
- Made the BuildInstructions rendering generic — iterates over whatever keys the LLM actually returned, converting them to readable labels.
- Added support for object-format user stories (renders `As a [role], I want to [action], so that [reason]`).
- Added support for `title`, `description`, and `objectives` fields from the PRD.
- Both Acceptance Criteria and Definition of Done now handle both string and object formats.
- Rebuilt the React app (`npm run build:ui`) and verified the new bundle is served (hash changed from `index-D0CBTGTl` to `index-6e2UFOoG`).

**Files modified:** `ui/src/TeamChatView.jsx`, `docs/history.md`, `docs/checklist.md`, `docs/PROJECT.md`

**Decisions made:**
- Generic key iteration for BuildInstructions instead of hardcoding field names — the LLM is unpredictable, so the frontend must handle whatever it returns.
- Both PascalCase and snake_case support kept for backward compatibility (existing sessions + future sessions).

**Current status:**
- PRD cards: expanded view shows title, description, user stories, objectives, acceptance criteria, UI behavior, build instructions, definition of done ✅
- Both PascalCase and snake_case data formats supported ✅
- Server running on http://localhost:3000 with new build ✅

**Next steps:**
1. User verifies the fix by expanding a PRD card in their browser
2. Fix "Fxontend" typo if it persists in new generations (artifact of LLM output, not code bug)
3. Continue with proof run / hackathon submission prep

---

## Session 32 — 2026-09-14: PRD Copy Button

**Focus:** Added copy-to-clipboard functionality for individual PRD cards.

**What was done:**
- Added Copy and Check icons from lucide-react to TeamChatView.jsx
- Added copiedIndex state to track which card was just copied
- Added handleCopyPrd() function that formats full PRD as plain text and copies to clipboard
- Each PRD card header now has a copy button (clipboard icon → green checkmark for 2s)
- PRD text includes: module name, owner, title, description, user stories, objectives, acceptance criteria, UI behavior, build instructions, definition of done

**Files modified:** ui/src/TeamChatView.jsx

---

## Session 33 — 2026-09-14: Integration Report Status Fix

**Focus:** Fixed integration report showing 'UNKNOWN' status after running integration.

**What was done:**
- Discovered backend returns overall_status but frontend looks for status
- Changed integrationReport.status to integrationReport.overall_status
- Changed integrationReport.passed/total to integrationReport.summary.passed/total
- Added display for fixed, failed, and warnings counts
- Status colors now work: green for SUCCESS, red for FAILURE, amber for INCOMPLETE/WARNINGS

**Files modified:** ui/src/ModuleSubmissionView.jsx

---

## Session 34 — 2026-09-14: Integration Warnings Detail Display

**Focus:** Added detailed warnings display to integration report when status shows WARNINGS.

**What was done:**
- Added warnings detail section below the summary stats
- Each warning shows module name, rule code (A1-C5), and description
- Warnings are displayed in a scrollable list with amber highlighting

**Files modified:** ui/src/ModuleSubmissionView.jsx

---

## Session 35 — 2026-09-16: Dashboard and Project Tabs Under Construction

**Focus:** Changed Dashboard and Project tabs to show 'Still under construction' placeholders instead of same content as Home.

**What was done:**
- Replaced DashboardView in case 'dashboard' with construction placeholder (settings icon)
- Replaced DashboardView in case 'projects' with construction placeholder (folder icon)
- Updated default case to show Projects construction placeholder
- Home tab still shows the real DashboardView with stats and New Chat button
- Verified: Home shows real dashboard, Dashboard shows placeholder, Projects shows placeholder

**Files modified:** ui/src/App.jsx

---

## Session 36 — 2026-09-16: Shareable Links for Multi-User Collaboration

**Focus:** Implemented shareable links so two people from different locations can join the same session.

**What was done:**
- **Server-side session-scoped WebSocket (server.js):**
  - Added sessionId field to each member object in the members Map
  - Modified broadcast(obj) to broadcast(obj, sessionId) — filters by session when sessionId provided
  - Modified presenceUpdate() to presenceUpdate(sessionId) — same scoping
  - Added session.join WebSocket message type — sets member.sessionId, loads existing messages from disk, sends session.history back to client
  - Added GET /api/sessions/:id/messages endpoint — returns messages from a specific session file
  - Scoped close handler to broadcast presence updates only to same-session members

- **Client-side WebSocket (ui/src/lib/websocket.js):**
  - Added currentSessionId tracking variable
  - Modified connect(userName, sessionId) — sends session.join instead of presence.join when sessionId provided
  - Reconnect uses stored sessionId to rejoin the same session

- **URL param auto-join (ui/src/App.jsx):**
  - Reads ?session=<id> from URL on mount
  - When Supabase not configured (guest mode): auto-joins session as Guest
  - When Supabase configured but no session: auto-joins session as Guest
  - When Supabase has session: auto-joins after auth
  - handleDemo() also checks URL param for session auto-join

- **Share button + message loading (ui/src/TeamChatView.jsx):**
  - Added sessionId prop, passed from App.jsx
  - Added session.history event listener — loads existing messages when joining a session
  - Added handleShareLink() — copies shareable URL to clipboard
  - Added Link2 icon button in sidebar header (next to 'People in Chat')
  - Button shows green Check icon for 2 seconds after copying

**How it works:**
1. User A creates a session -> URL becomes http://localhost:3000/?session=session_123
2. User A clicks Share button -> URL copied to clipboard
3. User A sends link to User B (WhatsApp, email, etc.)
4. User B opens link -> App reads ?session=session_123 -> auto-joins as Guest -> WebSocket connects scoped to that session -> existing messages load
5. Both users see each other's messages in real-time (scoped to that session only)

**Files modified:** server.js, ui/src/lib/websocket.js, ui/src/App.jsx, ui/src/TeamChatView.jsx

**Verified:**
- Auto-join via URL param works
- Session-scoped WebSocket works (messages only go to same-session members)
- Existing messages loaded from session file
- Share button copies URL to clipboard
- Real-time messaging works across sessions

---

## Session 37 — Three.js Braid Hero Background

**Date:** 2026-09-16
**Request:** Replace the 2D canvas braid animation with a full Three.js scene matching a reference clip's visual language: glowing colored strings converging, bursting outward, spiraling into a vortex, then braiding into a thick cable with energy sparks.

**What was built:**

- **`ui/src/components/noise.js`** (new) — lightweight 3D value noise with fractal Brownian motion (fBM), no external dependency. Used to drive organic strand motion.

- **`ui/src/BraidBackground.jsx`** (rewritten) — complete rewrite from 2D canvas to Three.js:
  - **4-phase perpetual cycle** (14s per cycle, seamless loop):
    - *Source* (0–15%): braided bundle twists to a knot, thin filaments fan out
    - *Burst* (15–40%): 26 strands spawn and shoot outward past camera, curved paths
    - *Vortex* (40–65%): strands curl into slow rotating spiral around center
    - *Braid* (65–90%): strings consolidate into thick horizontal cable, energy pulses travel along strands
    - *Fade* (90–100%): crossfade back to source (seamless loop)
  - **Rendering:** CatmullRomCurve3 → TubeGeometry per strand, AdditiveBlending, ACES filmic tone mapping
  - **Bloom:** UnrealBloomPass (strength 1.5, radius 0.4, threshold 0.2) for neon glow
  - **26 strands** in 3 color groups: green (#2FE58A), blue/cyan (#2FB8FF), dark (#16232A)
  - **Energy pulses:** bright white traveling bands along strands during braid phase
  - **Particles:** 120 InstancedMesh boxes for bokeh atmosphere, distance-based opacity
  - **Camera choreography:** macro → pull-back → push-in → lateral drift, smooth-lerped
  - **HUD overlay:** DOM/CSS grid lines + monospace glyphs (SYS::INIT, BRAID v0.1, etc.), very low opacity
  - **Text-contrast scrim:** radial gradient overlay ensures hero text stays readable
  - **`prefers-reduced-motion`:** falls back to static gradient (no canvas)
  - **Performance:** DPR capped at 2, pauses on visibilitychange, `pointer-events: none`
  - **Props:** `strandCount`, `palette`, `speed` — trivially tweakable

- **`ui/src/LandingView.jsx`** — BraidBackground now lazy-loaded via `React.lazy` + `Suspense`; removed `bg-ink` from root div so canvas shows through

- **`ui/src/App.jsx`** — loading and app containers use `app-bg` class instead of `bg-ink`

- **`ui/src/AuthView.jsx`** — root div uses `app-bg` instead of `bg-ink`

- **`ui/src/index.css`** — body background made transparent; `app-bg` class defined with ink color + graph-paper grid

**Dependencies added:** `three` (747KB raw, 192KB gzipped, lazy-loaded only on landing page)

**Verified:** Build succeeds, animation renders with WebGL, strands visible with bloom glow, HUD overlay visible, hero text readable, Try Demo still works, console clean (zero errors).

---

## Session 38 — Vercel + Railway Deployment Prep (2026-09-16)

**Goal:** Make the project deployable to Vercel without breaking local dev.

**Architecture decision — Vercel cannot host this backend:**
- Vercel rewrites cannot proxy WebSocket upgrades (`/ws` needs a 101 handshake)
- Function filesystem is read-only/ephemeral — breaks every `data/*` write (sessions, briefs, submissions, uploads)
- Function timeouts would kill `/api/integrate` (120s) and `/api/finalize` (sequential LLM calls)

**Split architecture:**
- **Vercel** (free): static React UI from `ui/dist`, with `/api/*` reverse-proxied to Railway via a build-time rewrite (same-origin in the browser, no CORS)
- **Railway** ($5/mo hobby): existing Express + WebSocket + LLM gateway monolith unchanged, WebSockets native, persistent volume mounted at `/app/data`

**Changes:**
- **`ui/vercel.json`** (Session 39) — static Vercel config: `/api/:path*` rewrite to the Railway domain (placeholder `RAILWAY-DOMAIN-HERE` until Railway generates it), SPA fallback, immutable caching for hashed `/assets/*`. A `vercel.ts` using `@vercel/config` was tried first and dropped: it requires a TypeScript toolchain the project doesn't have, and a static one-line domain replace is simpler
- **`package.json`** — added root `build` script (`cd ui && npm ci && npm run build`) for Railway's Nixpacks builder
- **`server.js`** — `/api/config` now returns `wsUrl` (from `PUBLIC_WS_URL` env, normalized to end in `/ws`); added `app.set('trust proxy', 1)` so `req.ip` resolves real client IPs behind the Vercel/Railway proxy hops (keeps per-user rate limiting honest)
- **`ui/src/lib/supabase.js`** — `initSupabase()` stashes `config.wsUrl` into `window.__BRAIDLY_WS__` (reuses the `/api/config` fetch it already does)
- **`ui/src/lib/websocket.js`** — `getWsUrl()` prefers `window.__BRAIDLY_WS__` over same-origin; unset = identical behavior to before (local dev unchanged)

**Verified:** build passes; `/api/config` returns `"wsUrl":null` locally and the full Railway URL with `PUBLIC_WS_URL=wss://...` set; browser end-to-end confirmed (`window.__BRAIDLY_WS__` populated from `/api/config`); app flow (landing → Try Demo → dashboard) works with clean console.

**Deployment runbook** (docs/PROJECT.md §14): push to GitHub → Railway (root dir, Nixpacks, env vars, volume at `/app/data`, healthcheck `/api/health`) → Vercel (root dir `ui`, env var `BACKEND_URL`) → Supabase auth redirect URLs.

---

*Last updated: Session 38 (2026-09-16)*
