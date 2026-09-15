# Braidly — Complete Tech Specification

> **Living document.** Every technical decision for this project lives here so any AI
> tool (Codebuff, Cline, Antigravity, Cursor, …) builds consistently.
> Read `PROJECT.md` (vision/status) and `instructions.md` (safety rules) alongside this.

---

## 0. The two facts everything serves

1. **The machine:** Windows laptop — Ryzen 7, 16GB RAM, 512GB SSD, RTX 3050 **4GB VRAM**.
2. **The budget:** **$0.** No paid service until the product earns money.

Every choice below exists to fit those two facts. If a decision ever conflicts with them,
it needs explicit user approval.

---

## 1. Runtime & toolchain

| Item | Choice | Notes |
|------|--------|-------|
| Language | JavaScript (Node.js) | One language end-to-end, easiest for AI tools |
| Node.js | **22 LTS** (verify latest LTS at install time) | LTS only — stability over novelty |
| Package manager | npm | Ships with Node, nothing extra to install |
| Version control | Git + GitHub (free private repo) | Also the "cloud" for module submissions later |
| Shell | Git Bash / PowerShell | Fine on Windows |

## 2. Frontend (MVP)

| Item | Choice | Why |
|------|--------|-----|
| Framework | **React + Vite + Tailwind** (`ui/`) — the served frontend since Session 27 | Legacy `public/` vanilla UI kept as fallback when `ui/dist` is missing |
| Real-time chat | Native browser **WebSocket** API | Built into every browser, no library needed |
| Served by | Express `static` middleware serving `ui/dist/` + SPA fallback | One server serves UI + API; rebuild with `npm run build:ui` |
| Files | `ui/src/*.jsx` built to `ui/dist/` | Bundled SPA; `/` and `/app` both serve `ui/dist/index.html` |
| Delivery surface | **Electron desktop app** embedding Monaco (primary); **VS Code extension** (upgrade); IDE fork only post-funding | Core + thin shells — pipeline lives in UI-independent modules |

## 3. Backend

| Item | Choice | Notes |
|------|--------|-------|
| Server | **Express** (v4 or v5 — pin one) | Single Node process |
| WebSocket | **`ws`** library | Lightweight, no Socket.IO ceremony for v1 |
| File uploads | **`multer`** | Standard, battle-tested |
| Env vars | **`dotenv`** + `.env` file | Keys never hardcoded, never committed |
| Dev port | `3000` (main app) | Mock server for the proof app uses `4000` |
| JSON parsing | Express built-in `express.json()` | — |

## 4. Storage (MVP)

| Item | Choice | Notes |
|------|--------|-------|
| Storage | **JSON files on disk** under `data/` | No DB to install, trivially debuggable |
| Files | `data/messages.json`, `data/projects.json`, `data/submissions/<module>/…` | One file per concern |
| Later upgrade | **SQLite** (`better-sqlite3`) | Only when JSON gets painful |
| Concurrency | Simple read-modify-write with a small write queue | Single-user MVP, keep it honest |

## 5. The LLM Gateway — the architectural heart

**Rule: every AI call in the entire app goes through ONE module: `llm/gateway.js`.**
No other file may call a model directly. This is what keeps the project $0-forever-safe
and lets providers swap without touching app code.

### Providers (all free tiers, as of mid-2026 — re-verify before wiring)

| Provider | Model to use | Limits (free) | Best for |
|----------|-------------|---------------|----------|
| **Groq** | `openai/gpt-oss-20b` | ~1,000 tok/s, 250K TPM, 1K RPM, 131K context | Primary smart brain (PRD Factory, AI Tech Lead). Supports json_schema structured outputs. |
| **Google AI Studio** | `gemini-2.5-flash` class | ~250 RPD, ~1M TPM (slashed Dec 2025 — re-verify) | Feeding whole discussions + code into one call. ⚠️ Free tier may train on prompts — never send proprietary code |
| **OpenRouter** | any free model | ~20 RPM / 50 RPD (1,000/day after optional one-time $10 top-up) | Automatic fallback on Groq 429s |
| **Cerebras** | fast Llama-class models | ~1M tokens/day | Bulk/batch processing |
| **Mistral** | experiment tier | ~1B tokens/month | Overflow capacity |
| **Ollama (local)** | `qwen2.5-coder:3b` | Free forever, fits 4GB VRAM, 25–40 tok/s | Cheap repetitive work: JSON fixing, file edits, syntax |

### Routing strategy (in `gateway.js`)

```
Smart reasoning (PRD, integration)  → Groq
  ├─ 429 / error                    → OpenRouter free
  └─ both down                      → Ollama local (degraded but alive)
Cheap repetitive work               → Ollama local qwen2.5-coder:3b
Big-context single call             → Gemini Flash (AI Studio)
```

### Gateway API (locked in `UI-API-RESEARCH.md`)

```
gateway.chat({ messages, onDelta })        // streaming → onDelta(chunk) → broadcast chat.stream
  ├─ Groq (stream:true, OpenAI-compat SSE)
  ├─ OpenRouter (same shape on 429)
  └─ Ollama (NDJSON stream)
gateway.structured({ messages, schema })   // non-streaming JSON
  ├─ json_schema  where supported (Gemini, Ollama, Groq GPT-OSS)
  └─ json_object + code-side validation + retry ≤2 elsewhere (Groq llama-3.3-70b)
```

**Gotcha:** Groq `json_schema` structured outputs are NOT supported on
`llama-3.3-70b-versatile` (only GPT-OSS models) and streaming is not supported with
Structured Outputs at all → Stage 2 uses `json_object` + validation.

## 6. API keys & `.env` (never committed)

```
# .env  — gitignored, exists only on your machine
GROQ_API_KEY=            # get: console.groq.com (free)
GOOGLE_AI_STUDIO_KEY=    # get: aistudio.google.com/apikey (free)
OPENROUTER_API_KEY=      # get: openrouter.ai (free, optional $10 top-up)
CEREBRAS_API_KEY=        # optional
MISTRAL_API_KEY=         # optional
OLLAMA_BASE_URL=http://localhost:11434   # local, no key
PORT=3000
```

- Copy `.env.example` → `.env`; **`.env` and `data/` go in `.gitignore`.**
- Only ONE key is truly required to start: either Groq or Google AI Studio.

## 7. Orchestrator — the AI Tech Lead (Stage 5)

| Item | Choice |
|------|--------|
| Language | Node.js scripts under `orchestrator/` |
| Running modules | Node `child_process` (spawn `npm install`, `npm test`, `npm run build` per module) |
| Contract check | Reads each module's `contract.json` + runs the auto-generated contract tests |
| Fix loop | On failure: send error + contract to LLM gateway → get patch → retry (bounded, e.g. 3 attempts) |
| Sandbox note | MVP: only run whitelisted commands in whitelisted folders. Never execute arbitrary submitted code on the host. Real isolation (Docker) is a post-MVP requirement |

## 8. Deployment (post-MVP — NOT part of the initial MVP build)

The MVP is **local-only** — delivered as an **Electron desktop app** (local-first by
design). Be honest about why: this app *runs other people's code*
(the orchestrator executes submitted modules), so "just deploy it" is genuinely unsafe
without sandboxing. Deployment plan when the time comes:

| Stage | Option (free) | Caveat |
|-------|--------------|--------|
| Demo hosting | Render / Railway / Fly.io free tiers | Sleeps when idle; fine for demos |
| Static frontend (later) | Vercel / GitHub Pages | Only after a build step exists |
| Code execution sandbox | Docker container per submission, isolated VM | The real requirement before public use |
| Database later | SQLite → Postgres (Supabase free tier) | Only when JSON storage is outgrown |
| Auth (later) | Basic sessions → Auth0/Clerk free tier | Not in MVP |

**Never blocked on money:** because everything routes through the gateway, the day the
product earns its first dollar you can point the gateway at paid APIs and charge per
session — zero re-architecture.

## 9. How the founder's three tools map onto this

| Tool | Role | Owns |
|------|------|------|
| **Codebuff** | Architect + integrator. Holds docs, builds the hard core (gateway, PRD Factory, orchestrator), verifies other tools' modules | `llm/`, `orchestrator/`, docs |
| **VS Code + Cline (Gemini key)** | Workhorse. Gets ONE module brief at a time, like a team member | One module folder at a time, e.g. `modules/frontend/` |
| **Antigravity** | Frontend playground — fast UI iteration | `public/` UI work, proof-app UI |

**Never two tools editing the same folder simultaneously.** Contract tests + briefs are
the handoff mechanism between tools — exactly like the product's own workflow.

## 10. Security & safety rules

- `.env` never committed; no keys in logs or code.
- Never send proprietary user code to AI Studio free tier (training risk).
- Orchestrator runs only whitelisted commands; no `rm -rf`, no network-exfiltrating code.
- `npm install` inside module sandboxes only, never globally.
- Everything local; nothing leaves the machine unless the user asks.

## 11. Pin-at-build checklist (verify once, then freeze)

- [ ] Node 22 LTS installed (`node -v`)
- [ ] Latest free-tier limits for Groq / AI Studio / OpenRouter confirmed (they change often)
- [ ] Ollama installed + `qwen2.5-coder:3b` pulled (fits 4GB VRAM)
- [ ] `.env.example` created; `.env` + `data/` in `.gitignore`
- [ ] Express version pinned in `package.json`
- [ ] GitHub private repo created for the project
