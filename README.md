# ⬡ Braidly

[![CI](https://github.com/jothick-dev/braidly/actions/workflows/ci.yml/badge.svg)](https://github.com/jothick-dev/braidly/actions/workflows/ci.yml)

**From idea to integrated code — a team argues, AI plans, humans code, AI verifies.**

Braidly is a collaborative AI workspace for small teams. Everyone discusses the
app idea in a shared chat, an AI facilitator keeps the debate productive, and
when the idea converges, Braidly turns the conversation into a real build
pipeline: per-person briefs, contract-first coding, and an automated AI tech
lead that integrates everyone's modules and reports what breaks.

No setup ceremonies. No project manager. Open the Debate Room, start arguing
about your idea — that's the product.

---

## The 5-stage pipeline

```
┌─────────┐   ┌─────────┐   ┌─────────┐   ┌──────────┐   ┌───────────┐
│ 1 debate│ → │ 2  PRD  │ → │ 3 code  │ → │ 4 submit │ → │ 5 verify  │
└─────────┘   └─────────┘   └─────────┘   └──────────┘   └───────────┘
```

| Stage | What happens |
|---|---|
| **1 · Debate Room** | Real-time team chat (WebSocket, presence, typing indicators). Type `/ai` to bring in Braidly, the AI facilitator: it asks clarifying questions, surfaces risks, and summarizes the agreed scope. |
| **2 · PRD Factory** | One click turns the discussion into an analysis, a shared contract, and a **personal PRD per module** — each member gets their brief, API contracts, and a runnable contract test. |
| **3 · Vibe Coding** | Members build their modules against their briefs, with PRD context, contracts, and file submission built into the workspace. |
| **4 · Submit** | Files are submitted per module, tracked in the dashboard, and visible to the whole team. |
| **5 · AI Tech Lead** | The AI integration pass verifies each module against its contract and produces an integration report — what works, what breaks, and exactly why. |

---

## Highlights

- **Contract-first by construction** — every module brief ships with JSON
  contracts and a generated contract test, so modules either fit together or
  fail loudly at Stage 5 instead of silently breaking in production.
- **Shareable sessions** — copy a link, send it to a teammate; they auto-join
  the live session in one click and see the full conversation history.
- **Guest mode** — judges and teammates can hit *Try Demo* and use the entire
  product without creating an account.
- **Zero-cost AI stack** — Groq (primary) → OpenRouter (fallback) → Ollama
  (local, free). One gateway module routes and normalizes streaming across all
  three; a free-tier rate limit just falls through.
- **Single-process architecture** — one Express server serves the React UI,
  the REST API, and WebSockets. Deploy it anywhere Node runs.
- **Governance-aware AI** — security headers, per-connection flood control,
  rate limiting, input validation, and a strict "only the gateway talks to
  models" rule baked into the codebase (see `docs/GOVERNANCE.md`).

---

## Tech stack

| Layer | Tech |
|---|---|
| Frontend | React 19 + Vite + Tailwind 4, Three.js animated hero |
| Real-time | Native WebSockets (session-scoped broadcast, presence, streaming AI replies) |
| Backend | Node.js + Express, single process |
| AI | Groq → OpenRouter → Ollama gateway with normalized streaming |
| Storage | Supabase (auth + session/message persistence) with local JSON fallback |
| Deploy | Vercel (static UI + API proxy) + Railway (backend + volume) — see `docs/PROJECT.md §14` |

---

## Run it locally

**Requirements:** Node.js 22+, a free Supabase project (or none — storage falls
back to local JSON), and optionally a free Groq/OpenRouter API key for the AI
facilitator.

```bash
git clone https://github.com/jothick-dev/braidly.git
cd braidly

# 1. Backend deps
npm install

# 2. Environment (no keys needed for guest mode; add AI keys to unlock /ai)
cp .env.example .env

# 3. Build the frontend
npm run build:ui

# 4. Start
npm start
# → http://localhost:3000
```

Open **http://localhost:3000**, click **Try Demo**, create a session, and send
your first message. Click the link icon in the sidebar header to grab a
shareable session URL — open it in a second browser window and chat in
real time.

### Development mode (hot reload)

```bash
npm start                  # terminal 1: API + WS on :3000
cd ui && npm run dev       # terminal 2: Vite dev server on :5173 (proxies to :3000)
```

---

## Try the full pipeline in 5 minutes

1. **Try Demo** → create a chat → discuss an app idea (type `/ai what should we build first?`)
2. Hit **Finalize** in the PRD view → each team member gets a personal brief + contract
3. Switch to **Modules** → submit a couple of files against your brief
4. Run the **integration** → the AI tech lead checks every module against its contract and reports the verdict

---

## Repository map

```
server.js            Express + WebSocket server (API, auth, sessions, uploads)
llm/gateway.js       THE only module that calls AI providers (Groq/OpenRouter/Ollama)
lib/                 auth, storage, PRD factory, orchestrator, security middleware
ui/                  React 19 + Vite + Tailwind frontend
supabase/            schema + migrations
docs/                design docs: TECH-SPEC, GOVERNANCE, PROJECT history, checklist
test/smoke.js        smoke test suite
```

## Documentation

- [`docs/TECH-SPEC.md`](docs/TECH-SPEC.md) — architecture and data model
- [`docs/GOVERNANCE.md`](docs/GOVERNANCE.md) — security and AI safety rules
- [`docs/PROJECT.md`](docs/PROJECT.md) — decision log + deployment runbook
- [`docs/history.md`](docs/history.md) — session-by-session build history

---

**Built for the AI Builders Hackathon** · Stage 1: the Debate Room and the full
5-stage pipeline, live.
