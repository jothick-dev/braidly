# Braidly — Handoff Instructions for Any AI Vibe-Coding Tool

> **Read this file first. It is the safety briefing for ANY AI tool (Cursor, Windsurf,
> Claude Code, GitHub Copilot, Codebuff, Lovable, Bolt, Replit AI, …) that is asked to
> work on this project.**
>
> If you are an AI being asked to modify or continue this project: everything you must
> know to avoid breaking it is in this file, plus `PROJECT.md` (the living product doc),
> `TECH-SPEC.md` (every technical decision, API key, provider, and tool map), and
> `GOVERNANCE.md` (the failure-mode rules every module and the orchestrator must enforce).
> **This file is NOT the PRD / Build-Instructions we generate for our platform's users** —
> those are product output. This is the meta-brief for whoever builds Braidly itself.

---

## 1. What this project is (in one paragraph)

**Braidly** is a collaborative desktop/web app where a **team and an AI brainstorm an
app idea together in a
chat**. When the discussion reaches a conclusion, the AI generates a **PRD + strict Build
Instructions doc per team member** (including machine-readable `contract.json` + contract
tests), each member **vibe-codes their module** and submits files, and an **AI Tech Lead
(orchestrator)** verifies every module against the shared contracts, assembles them, and
delivers a working app. The whole loop — human discussion → AI-distributed PRDs → humans
build → AI integration — is the novel product. Stage 5 (AI integration) is the hard part;
everything in the architecture exists to make it mechanically verifiable.

## 2. Current state of the repo

```
AI/                      ← this folder (the whole project)
├── docs/                ← ALL DOCUMENTATION (lives here)
│   ├── PROJECT.md       ← LIVING PRODUCT DOC — read it, keep it updated
│   ├── TECH-SPEC.md     ← complete tech spec: stack, providers, API keys, deployment
│   ├── GOVERNANCE.md    ← failure-mode rules: security constitution, supply chain, testing, orchestrator policy
│   ├── checklist.md     ← master checklist of everything we're building
│   ├── hackathon.md     ← AI Builders Hackathon submission checklist (mandatory deliverables)
│   ├── UI-API-RESEARCH.md ← pre-Stage-1 research: chat UI patterns, WebSocket protocol, LLM streaming + structured output strategy
│   ├── history.md       ← step-by-step development history (this session onward)
│   └── instructions.md  ← this file
├── .env                 ← API keys (gitignored, never commit)
├── .env.example         ← template for .env
├── package.json         ← Node.js dependencies
├── server.js            ← main Express + WebSocket server
├── llm/
│   └── gateway.js       ← THE ONLY module that calls AI providers
├── lib/
│   ├── security.js      ← CSP, validation, rate limiting
│   └── store.js         ← JSON persistence with write queue
├── public/              ← frontend (vanilla HTML/CSS/JS)
│   ├── index.html
│   ├── style.css
│   └── app.js
├── test/
│   └── smoke.js         ← automated smoke test
├── data/                ← runtime data (gitignored)
│   └── messages.json
└── .freebuff/           ← tool-internal state — DO NOT TOUCH, DO NOT DELETE
```

**As of now: Stage 1 (the Debate Room) is built and tested.** `npm start` runs it on
http://localhost:3000 (needs Node 22; installed at `C:\Users\meher\nodejs` — add it to
PATH). Next: add a key to `.env` for live AI replies, then Stage 2 (PRD Factory).

## 3. Golden rules (never violate these — they protect the app)

These rules exist because the whole product depends on them. An AI tool that ignores
them WILL break the project:

1. **ALL AI calls go through one LLM gateway module** (a single file, e.g.
   `llm/gateway.js`). No AI call may be made directly from anywhere else in the code.
   Today it routes: Groq (free) → OpenRouter fallback → local Ollama. Tomorrow it can
   switch to paid APIs without touching the rest of the code. **Never hardcode a model
   or API key in a component.**
2. **Contract-first is the architecture.** The PRD Factory (Stage 2) must generate per
   person: (0) shared contract, (1) their PRD, (2) Build Instructions, (3)
   `contract.json`, (4) Definition-of-Done checklist + auto-generated contract tests.
   The orchestrator re-runs those same tests on submission. Do not design around this.
   **`GOVERNANCE.md` is the enforcement spec — follow it.**
3. **MVP = no build step, no database.** Frontend is a single-page vanilla
   HTML/CSS/JS app served by a Node/Express server; storage is JSON files on disk
   (SQLite is the *later* upgrade). Do not introduce React/Vite/TypeScript/Postgres
   into the MVP without explicit user approval — it violates the "runs on a 16GB,
   4GB-VRAM laptop at $0" constraint.
4. **Local-first, $0-first.** No paid API, no cloud service, no external dependency
   that costs money or uploads user data. Free tiers only (Groq, AI Studio, OpenRouter
   free, Cerebras, Mistral, local Ollama). Never send proprietary user code to a
   free tier that may train on it (Google AI Studio) without warning.
5. **The proof app is a to-do app.** Every pipeline feature is validated against a tiny
   frontend + backend to-do app built *through the platform itself*. Don't invent a
   fancier proof target.
6. **Core + thin shells.** All pipeline logic (LLM gateway, PRD Factory, orchestrator,
   storage, contracts) lives in UI-independent Node modules — the **core**. Every surface
   (Electron desktop app, VS Code extension, future IDE fork) is a thin shell that hosts
   the core. Never duplicate or fork pipeline logic into a UI surface, and never build a
   surface before the core works.
7. **MANDATORY: Update project docs after every session.** After every session or
   significant change, update `docs/history.md` (detailed session log), `docs/checklist.md`
   (task completion status), and `docs/PROJECT.md` (current status + decision log) with
   what was done, decisions made, and current state. This is non-negotiable — every AI
   tool continuing this project MUST follow this rule.

## 4. Absolute DO-NOT list (things that break the project)

- ❌ Do NOT modify or delete `PROJECT.md`'s Decision Log retroactively — append new
  entries only.
- ❌ Do NOT touch `.freebuff/` (internal state of the AI tool).
- ❌ Do NOT `git push`, `git commit`, `git rebase`, or `git reset` without explicit
  user permission.
- ❌ Do NOT install anything globally (`npm install -g`, `pip install` outside a
  venv/project), and do NOT touch anything outside this `AI/` folder.
- ❌ Do NOT run Ollama/GPU/model downloads without asking — a 4GB-VRAM GPU is
  constrained; big models must be chosen deliberately (max practical: `qwen2.5-coder:3b`
  in VRAM, 7B partially offloaded).
- ❌ Do NOT add an LLM dependency that bypasses the gateway (see rule 1).
- ❌ Do NOT remove `contract.json`/contract-test generation from the PRD Factory design
  — it is the single most important design decision in this project.
- ❌ Do NOT assume paid tools are available. Never add a feature that requires payment
  (this is a $0-budget project).
- ❌ Do NOT run scripts that modify production-like systems or have irreversible
  effects without explicit permission.

## 5. Tech stack (decided, MVP)

| Layer | Choice | Why |
|-------|--------|-----|
| Backend | Node.js + Express (or plain Node http) | Simplest possible, runs on the laptop |
| Frontend | Single-page vanilla HTML/CSS/JS, served by the server | No build step for v1 |
| AI | One LLM gateway module → Groq free → OpenRouter free → local Ollama | $0, swappable later |
| Storage | JSON files on disk (SQLite upgrade later) | MVP simplicity |
| Orchestrator | Node script: reads submitted modules, verifies contracts, runs build, reports status | The AI Tech Lead |
| Proof target | Tiny to-do app (frontend + backend) | Prove the loop cheaply |
| Delivery | Electron desktop app (Monaco) primary; VS Code extension later; fork only post-funding | Core + thin shells — surfaces never own pipeline logic |

## 6. How to pick up work (workflow for any AI tool)

1. Read **`PROJECT.md`** in full — it contains the vision, the 5-stage pipeline,
   constraints, $0 strategy, the per-person brief design, and the Decision Log.
2. Read this file for the safety rules (done, since you're reading it).
3. Check `PROJECT.md` → "Current Status" → continue from the next un-checked item.
4. Work stage by stage; after each session, update `PROJECT.md`:
   - check off completed items in "Current Status",
   - append a dated entry to the Decision Log,
   - bump the "Last updated" line.
5. If a task spans sessions: leave the code in a working state and write the next
   step into `PROJECT.md` so the next session (possibly a different AI tool) can
   continue seamlessly.

## 7. Key vocabulary (so you talk about the product correctly)

| Term | Meaning |
|------|---------|
| Debate Room | Stage 1 — team + AI chat about the idea |
| PRD Factory | Stage 2 — turns the discussion into per-person PRDs + API contracts (structured output) |
| Per-person brief | The PRD + Build Instructions + `contract.json` + contract tests delivered to each member |
| contract.json | Machine-readable contract (endpoints, schemas, file layout, exports) the orchestrator verifies against |
| Contract tests | Auto-generated tests per member that mock other modules and check *their* module against the contract |
| AI Tech Lead | Stage 5 — the orchestrator agent that assembles modules and delivers the working app |
| LLM gateway | The single file through which ALL AI calls route |
| Proof app | The to-do app used to validate the whole pipeline |

## 8. End-of-session checklist (leave no breadcrumbs behind)

- [ ] `PROJECT.md` "Current Status" reflects reality
- [ ] Decision Log has a dated entry for what was decided/done this session
- [ ] Code runs (`npm start` or the documented command) — or it's explicit that it's mid-build
- [ ] No stray credentials/API keys committed or logged
- [ ] Next session can start by reading `PROJECT.md` + this file and just continue

---
*Generated 2026-08-08. This file is deliberately tool-agnostic: any AI coding tool can
follow it without knowing anything else about how this project was built.*
