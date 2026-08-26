# Braidly — System-Design Concept Map

> **What this is:** a classification of a 44-item system-design checklist (from an Instagram
> reel) by relevance to the Braidly project. Created 2026-08-18. Of the 44 concepts: ~8 are
> **already built**, ~11 are **post-MVP roadmap**, ~25 are **not needed by design**.
>
> Rule applied: this project is a deliberate single-process monolith ("core + thin shells"),
> local-first, $0. Anything that only matters at multi-node scale or for unrelated
> architectures is marked "not needed."

---

## ✅ Already built into Stage 1 (done)

| Concept | How it maps to Braidly |
|---------|------------------------|
| WebSockets | The Debate Room's real-time layer (`ws`) |
| REST | The `/api/*` endpoint surface (see API inventory) |
| Rate limiting | REST (300/min/IP) + WS anti-flood (10 msgs/10 s, 3 strikes → kick) |
| Error logging | Server-side logs, generic client errors (GOVERNANCE A6) — basic; formalize later |
| Circuit breaker | Gateway failover chain Groq → OpenRouter → Ollama (done in spirit) |

## 🔜 Soon (hackathon window)

| Concept | Why |
|---------|-----|
| Git | The public `braidly` repo for the hackathon submission |
| CI/CD | GitHub Actions running the smoke test (and future contract tests) on every push |
| Deployment | The demo decision: Cloudflare Tunnel (live try-it link) vs. hosted "tour mode" |
| Encryption | Only when exposing the server (TLS via tunnel/host); `.env` hygiene otherwise |
| Cherry-picking | A git skill for keeping the repo clean — not architecture |

## 🗓 Post-MVP (roadmap)

| Concept | How it maps |
|---------|-------------|
| Database design / ACID / Indexing | Design the projects/briefs/submissions schema before Stage 2; SQLite (ACID) when JSON hurts; index messages when real DB lands |
| S3 | Cloud storage for module submissions (vs. local folders/git) |
| Authentication | Clerk/Auth0 when the platform is hosted (F1 review gate rides along) |
| API Gateway / Reverse proxy / Load balancer | Hosting-layer concerns — Render/Railway mostly handle these for us |
| Caching | LLM response caching / Upstash at scale |
| Monitoring / Observability | Sentry + health checks; the orchestrator's integration report (GOVERNANCE E3) is itself an observability artifact |
| Availability / Consistency / Eventual consistency | Concepts that only matter once we run multi-node |
| Message queues | Async orchestrator jobs at scale — the in-process `pending` flag suffices for MVP |
| Firewall / Throughput | Awareness items (Windows firewall when tunneling; gateway token budgets) |

## ❌ Not needed — deliberately skip

Kubernetes · SQS · TensorFlow · Kafka · RabbitMQ · Elasticsearch · Serverless compute ·
DynamoDB · SFTP · Forward proxy · Polling (WebSockets instead) · Sharding · Partitioning ·
Microservices (deliberate single-process monolith — "core + thin shells", not microservices) ·
Sidecar · GraphQL · CDN

---

**The pattern worth noticing:** we already implemented the small, correct subset (WebSockets,
REST, rate limiting, failover), and the rest is either *"when we scale"* or *"never, by
design"* — exactly the discipline this project's docs preach.
