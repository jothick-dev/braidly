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
- Discovered Node.js not in PATH — fixed by using full path `C:\Users\meher\nodejs\node.exe`
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
| 2026-08-21 | **Session 12: Stage 4 (File Submission) built** — multer, drag-drop, file management |
| 2026-08-23 | **Session 13: Full flow tested end-to-end** — chat → finalize → workspace → upload all working |
| 2026-08-23 | **Landing Page decided** — Option A chosen (entry page + new chat + past sessions) |
| 2026-08-23 | **Session 14: Stage 5 (AI Tech Lead) built** — orchestrator, security scans, AI fix loop, integration report |
| 2026-08-24 | **Session 15: Clear Chat + /ai command** — on-demand AI, clear chat button |
| 2026-08-24 | **Session 16: Truncated JSON + /ai fix + module name sanitization + PRD persistence** |
| 2026-08-24 | **Session 18: Full PRD view with contract details** — acceptance criteria, file structure, security rules, shared contract all visible |
| 2026-08-26 | **Session 20: Hackathon PPT created** — 10-slide deck + 2-min demo script for AI Builders Hackathon |
| TBD | Landing Page built |
| TBD | Proof run: to-do app built through platform |
| TBD | Hackathon submission |

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

*Last updated: Session 20 (2026-08-26)*

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
