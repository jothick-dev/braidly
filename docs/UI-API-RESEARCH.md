# Braidly — UI & API Research (pre-Stage-1)

> **What this is:** research done before building Stage 1 (Debate Room + AI facilitator) and
> Stage 2 (PRD Factory), so we build on verified patterns instead of guesses. Findings are
> distilled into **locked decisions** — implement these, don't re-research them.
>
> Research date: 2026-08-16. Free-tier limits change — see the **verify-at-build** notes.

---

## 1. UI research — the Debate Room

### 1.1 Chat patterns we will implement (from 2026 AI-chat UX guidance)

| Pattern | Why | Our implementation |
|---------|-----|--------------------|
| **Streaming token display** | Users trust + read AI output as it streams; feels alive | Render `chat.stream` deltas incrementally; blinking caret on the AI bubble while streaming |
| **Message states** | Sending / sent / failed must be visible | `sending → sent`; on failure show `failed` + retry affordance |
| **Stop button** | Users must be able to halt a long AI reply | Show while AI streams; cancels the server-side generation |
| **Typing indicator** | For human members (presence) — always with a static fallback (a11y) | "Alice is typing…" with a static-text alternative |
| **Suggested prompts / quick replies** | Lowers the empty-chat barrier; guides the discussion | 3 starter prompts in the empty state ("I want to build an app for…") |
| **Rich rendering** | Briefs/contracts appear in chat as structured cards, not walls of JSON | Render PRD/contract outputs as expandable cards with copy + download |
| **Member presence** | Team chat needs to show who's in the room | Right sidebar: member list with online dots + join/leave notices |
| **No dead-end empty states** (GOVERNANCE) | Empty states are conversion surfaces | Empty chat shows a directive + example prompts, never blank |

### 1.2 Layout (Stage 1 + the future shell)

```
┌──────────────────────────────┬─────────────────┐
│  Debate Room (chat)          │  Right sidebar  │
│  ┌────────────────────────┐  │  • Members (+AI)│
│  │ message stream         │  │  • Project info│
│  │ (human/AI/system cards)│  │  • [Finalize   │
│  │                        │  │    Discussion] │
│  └────────────────────────┘  │    button      │
│  [ composer + send ]         │  • Briefs (post│
│                              │    finalize)   │
└──────────────────────────────┴─────────────────┘
```

- Chat is the primary surface for Stage 1. The right sidebar is where the **Finalize
  Discussion** action lives (Stage 2) and where generated briefs appear per member.
- Dark-mode first (matches the founder's machine + vibe-coding norms).
- **Future shells** (Replit-style tabs — preview / editor / chat) stay post-MVP; the
  chat + sidebar layout is forward-compatible with them.

### 1.3 "Finalize Discussion" UX (Stage 2)

1. Button is always visible but **enabled only when the discussion has enough content** (e.g., ≥ some message count + the AI has a summary).
2. On click → progress states (generating → validating → done), never a blank wait.
3. Output: **one card per member** — PRD + Build Instructions + `contract.json` + contract tests — each with copy/download.
4. Then a clear next action: "Assign modules → members start coding."

---

## 2. Real-time API research — WebSockets

### 2.1 `ws` vs Socket.IO — verdict: **`ws`** (as already specced)

- `ws` (v8.x, current 8.21) is lighter: Socket.IO connections carry more memory overhead
  (room metadata, reconnection state, fallback machinery).
- Socket.IO's wins (rooms, auto-reconnect, fallbacks) are **not needed** for our
  single-process, single-room, local-first MVP — we implement the two things we need by hand.
- Revisit Socket.IO only if we later need multiple rooms + complex reconnection UX.

### 2.2 Our protocol (JSON envelopes, one room)

```
Client → Server:
  { type: "chat.message",  sender: "Alice", text: "..." }
  { type: "presence.join", name: "Alice" }          // on connect, after handshake

Server → Client:
  { type: "chat.message",  id, role: "human"|"ai"|"system", sender, senderColor, text, ts }
  { type: "chat.stream",   id, delta }               // AI token deltas (broadcast to ALL — team sees the facilitator think)
  { type: "chat.done",     id }                      // AI reply complete
  { type: "presence.update", members: [{name, online}] }
  { type: "system.notice", text }                    // joins/leaves, errors
```

- Messages persisted to `data/messages.json` via the small write queue (TECH-SPEC §4).
- **Heartbeat:** server pings every 30 s; if a client misses 2 pongs, drop it and broadcast
  a presence update. (Protocol-level ping/pong — best practice, 30–45 s cadence.)
- **Reconnect:** client retries with backoff (1 s → 2 s → 5 s, capped); on reconnect the
  client requests history (REST `GET /api/messages`) and re-joins presence.
- **No auth in MVP** (single team room, local). Names are self-declared at join (Stage 1);
  real auth is post-MVP.

---

## 3. LLM API research — the gateway

### 3.1 ⚠️ Critical finding: Groq structured outputs

From Groq's docs (verified 2026-08-16):

- **`json_schema` (Structured Outputs) is only available on GPT-OSS models** (20B/120B) —
  **NOT on `llama-3.3-70b-versatile`**, our primary brain.
- **Streaming and tool use are not supported with Structured Outputs.**
- `llama-3.3-70b-versatile` supports **JSON Object Mode** (`response_format: {type:"json_object"}`):
  guarantees valid JSON, but **not** schema adherence — validation must happen in code.

**Consequence for Stage 2 (PRD Factory):**
- Use `json_object` mode + a strict system prompt, then **validate against our schema in
  code** with a retry loop (≤2 attempts), falling back to Ollama local (which DOES support
  native JSON-schema output). This is exactly the "best-effort + retry" pattern.
- PRD generation is a batch operation → **non-streaming is fine**; show progress states in UI.

### 3.2 Streaming (Stage 1 facilitator)

| Provider | How | Notes |
|----------|-----|-------|
| **Groq** | OpenAI-compatible, `stream: true` → SSE chunks with `delta.content` | llama-3.3-70b ≈ 276–320 tok/s — the fastest brain |
| **Ollama** | `stream: true` → NDJSON `{message:{content}}` chunks | qwen2.5-coder:3b, 25–40 tok/s |
| **Gemini** | `streamGenerateContent` (SSE) or OpenAI-compat endpoint | big-context path only |

**Gateway contract (normalized, so app code never sees provider shapes):**
```
gateway.chat({ messages, onDelta })        // streaming → onDelta(chunk) → server broadcasts chat.stream
gateway.structured({ messages, schema })   // non-streaming JSON:
   1. json_schema  if provider supports it (Gemini; Ollama; Groq GPT-OSS)
   2. else json_object + code-side schema validation
   3. retry ≤2, then fall back down the provider chain (Groq → OpenRouter → Ollama)
```

### 3.3 Free-tier rate limits (as of 2026-08-16 — VERIFY AT BUILD)

| Provider | Requests | Tokens | Source |
|----------|----------|--------|--------|
| **Groq** | ~30 RPM, **~14,400 RPD** per org | ~6k–30k TPM (model-dependent); ~500k–1M TPD | console.groq.com/docs/rate-limits + multiple 2026 sources |
| **Gemini (AI Studio)** | ~5–25 RPM (model-dependent), **~250 RPD** — *slashed Dec 2025* | ~1M TPM | ai.google.dev/gemini-api/docs/rate-limits |
| **OpenRouter** | ~20 RPM / 50 RPD (1,000/day after optional $10 top-up) | — | openrouter.ai docs |

> **Docs to update:** `PROJECT.md` §4 and `TECH-SPEC.md` §5 currently say Groq ~1,000 req/day —
> that figure is outdated; it's ~14,400/day now. Gemini's ~250 RPD is tighter than assumed.
> These numbers churn monthly → **re-verify both at build time and before the hackathon demo.**

### 3.4 Rate-limit resilience (already in our design — confirmed by research)

- Gateway falls back Groq → OpenRouter → Ollama on 429s (verified pattern; Reddit 2026
  reports confirm free-tier 429s are common on both Groq and Gemini).
- The **fallback video** in `hackathon.md` remains mandatory.

---

## 4. Locked decisions for Stage 1 & 2

1. **`ws`** (not Socket.IO); single room; JSON envelope protocol (schema in §2.2).
2. **Heartbeat** every 30 s, 2 missed pongs → disconnect + presence broadcast.
3. **Client reconnect** with backoff (1/2/5 s) + history fetch via REST.
4. **AI replies stream to ALL connected members** (shared facilitator — the team watches it think).
5. **Gateway API:** `chat()` streaming + `structured()` with provider-aware JSON strategy
   (json_schema → json_object + validation → retry ≤2 → fallback chain).
6. **Stage 2 uses `json_object` on Groq llama-3.3-70b** (not json_schema — unsupported), with
   code-side schema validation. PRD generation is non-streaming.
7. **UI:** streaming tokens + stop button + message states; presence sidebar; empty state with
   starter prompts; briefs as expandable cards; dark-mode first.
8. **"Finalize Discussion"** gated on discussion depth, with visible progress states.

---

## 5. Sources (accessed 2026-08-16)

- Groq Docs — Structured Outputs / API Reference / Model cards / Rate Limits: console.groq.com/docs
- Groq free-tier rate limits 2026 (multiple: klymentiev.com, grizzlypeaksoftware.com, getaiperks.com, layer3labs.io)
- Google Gemini API — Rate limits & pricing: ai.google.dev/gemini-api/docs
- Ollama — Structured Outputs (blog, Dec 2024) + qwen2.5-coder library page: ollama.com
- ws (npm) — v8.21.x; heartbeat best practices: websocket.org/guides/heartbeat, ws GitHub issue #767
- 2026 AI-chat UX guidance: thefrontkit.com (AI Chat UI Best Practices), setproduct.com, ethora.com, designpixil.com, aiuxplayground.com
- Vibe-coding workspace layouts: technically.dev (2026 comparison), mastra.ai, lovable.dev
