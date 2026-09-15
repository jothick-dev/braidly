# Braidly — AI Builders Hackathon Checklist

> **Goal:** submit Braidly (the collaborative AI vibe-coding workplace) to the AI Builders
> Hackathon, satisfying every mandatory requirement in the challenge terms. This file maps the
> challenge's requirements to our project, lists what MUST be submitted, and tracks status.
>
> Cross-ref: `PROJECT.md` (vision/status), `TECH-SPEC.md` (stack), `GOVERNANCE.md`
> (our differentiation), `instructions.md` (safety rules for AI tools).

---

## 0. The challenge in one line

> *"Build an AI product that solves a real problem — not a pitch deck, concept video, or thin
> AI wrapper — and submit: a **working product**, **public source code**, a **≤5-min demo
> video**, and a **≤10-slide deck**, plus the **submission form**."*

### Challenge requirement → our project fit

| Challenge asks for | Our answer | Status |
|---|---|---|
| AI product solving a real problem | Braidly: team + AI discuss an idea → AI generates per-person PRDs + contracts → members vibe-code → AI Tech Lead integrates into a working app. Kills vibe-coding chaos & integration failure | ✅ Idea validated |
| NOT an "AI wrapper with minimal differentiation" | The full 5-stage loop nobody else has + contract-first verification + governance rules | ✅ Novel |
| Something people would use beyond the hackathon | Indie devs / small teams / startups that vibe-code — "I would use this tomorrow" | ✅ Target defined |
| Fits a listed category | Developer tool / multi-agent system / workflow automation platform | ✅ |
| Solo participation allowed | You participate individually | ✅ |

### The real gap (this is the work)

Everything below is **not built yet** — the submission is only as good as the working product.

---

## 1. Logistics (do these first)

- [ ] **Find the submission deadline** — check the hackathon page; put it on a calendar with a 2-day buffer
- [ ] **Register** as an individual participant
- [ ] Review challenge themes / resources / **sponsor technologies** — adopt only what is free and useful (keep the $0 rule)
- [ ] Confirm the exact submission form URL + required fields
- [ ] Confirm video requirements: upload method, format, hosting (e.g., YouTube unlisted vs. direct upload)

---

## 2. MANDATORY SUBMISSION #1 — Project Submission Form

- [ ] Project name: **Braidly**
- [ ] Team info (solo)
- [ ] One-paragraph project description (problem + solution + role of AI)
- [ ] All required links ready: GitHub repo, demo video, deck (if linkable)
- [ ] AI-technologies section completed truthfully (models used, gateway routing)

---

## 3. MANDATORY SUBMISSION #2 — Working Product

> Judges must be able to "understand and evaluate how your product works." The MVP web app
> (Stages 1–5) must actually run end-to-end.

- [ ] **Stage 1 — Debate Room:** real-time chat, multiple team-member identities + AI facilitator, messages persisted
- [ ] **Stage 2 — PRD Factory:** "Finalize Discussion" → per-person PRD + Build Instructions + `contract.json` + contract tests
- [ ] **Stage 3–4 — Modules:** the demo "team" submits modules per their briefs (folder-per-module storage)
- [ ] **Stage 5 — AI Tech Lead:** verifies contracts, runs tests, assembles modules, delivers a working app + integration report
- [ ] **Proof app** (to-do app) built end-to-end *through the platform* and running
- [ ] **LLM gateway** wired: Groq → OpenRouter fallback → local Ollama
- [ ] **Demo strategy decision (blocker):** the orchestrator executes code → cannot deploy as-is. Choose one:
      - [ ] (A) **Live local demo** on your machine during presentation + recorded video — safest, simplest
      - [ ] (B) **Hosted "tour mode"** — limited hosted build with a sandboxed/simulated orchestrator — more work, stronger for remote-only judging
- [ ] Product runs from a clean setup in ≤10 minutes (`npm install && npm start`)

---

## 4. MANDATORY SUBMISSION #3 — Public Source Code (GitHub)

- [x] Git repository initialized (first commit `a53edb4`, 24 files, 7415 lines)
- [ ] Create a **public** GitHub repo (e.g., `braidly`)
- [ ] Push the full project to GitHub
- [ ] **README.md** with: what it is, the problem, how it works, an architecture overview, setup instructions, `.env.example`, and how to run the demo "team" flow
- [x] **`.gitignore`** excludes: `.env`, `data/`, `node_modules/`, `.freebuff/` — **no API keys ever committed**
- [ ] License file (MIT)
- [ ] Code is reviewable: folder structure matches the docs, no build artifacts

---

## 5. MANDATORY SUBMISSION #4 — Demo Video (≤5 minutes)

The challenge requires these segments — each must be in the video:

- [ ] **Problem being solved** (30–45s) — vibe-coding chaos, integration failure, security. Use GOVERNANCE research: ~45% of AI code carries OWASP Top-10 vulnerabilities; Lovable's BOLA incident
- [ ] **How the solution works** (60–90s) — the 5-stage loop, walked through
- [ ] **Key features** (60s) — Debate Room, PRD Factory output (briefs + `contract.json`), orchestrator integration report
- [ ] **Role of AI within the product** (30s) — gateway routing, PRD generation, AI Tech Lead integration loop
- [ ] **Live demonstration** (90–120s) — full loop with pre-built modules → the to-do app runs
- [ ] Total runtime ≤ 5:00 (time the final cut)
- [ ] Record a **fallback video** — live demos can hit free-tier rate limits (Groq 429s are real)
- [ ] Good audio + screen capture; captions if possible

---

## 6. MANDATORY SUBMISSION #5 — Presentation Deck (≤10 slides)

The challenge specifies these slides — one section per slide:

- [ ] **1. Problem Statement** — the numbers from GOVERNANCE research; integration is where vibe coding dies
- [ ] **2. Solution Overview** — Braidly's full loop in one diagram
- [ ] **3. Target Users** — indie devs, small teams, startups that vibe-code
- [ ] **4. Product Features** — the 5-stage pipeline + contracts + governance
- [ ] **5. Technical Architecture** — Node core + thin shells (web demo now; Electron/VS Code extension later), JSON storage, LLM gateway
- [ ] **6. AI Technologies Used** — Groq (`llama-3.3-70b`), Gemini Flash (big-context), OpenRouter fallback, local Ollama (`qwen2.5-coder:3b`), structured output, multi-agent orchestration
- [ ] **7. Impact & Value Proposition** — time saved, integration made mechanical, safety/governance; "earns before it costs"
- [ ] **8. Future Roadmap** — Electron desktop app, VS Code extension (BYOK), IDE fork, enterprise governance tier
- [ ] Total ≤ 10 slides; story flow: problem → demo → value (show the product, not just slides)

---

## 7. Pre-submission QA ("I would use this tomorrow" pass)

- [ ] A fresh person can run the product from the README in ≤10 minutes
- [ ] The demo path works on free tiers only — no paid dependency
- [ ] No secrets/keys anywhere in the repo or video
- [ ] Video plays fully, audio is clear, the demo doesn't fail
- [ ] Deck renders correctly (export to PDF)
- [ ] Every link in the submission form verified working
- [ ] **Dry-run the live presentation** — rehearse the loop 2–3 times, pre-warm Groq, test the Ollama fallback

---

## 8. Differentiation guard (the challenge explicitly rejects these)

- [ ] NOT a pitch deck without a product — the working product exists first
- [ ] NOT an "AI wrapper" — we show real technical execution: contracts, verification, integration, governance
- [ ] NOT just a collection of prompts — it's a platform with a UI and a running end-to-end loop

---

**Definition of done:** all five mandatory submissions complete, the working product runs
end-to-end, the repo is public and clean, and a rehearsed demo exists. Then submit — and present.
