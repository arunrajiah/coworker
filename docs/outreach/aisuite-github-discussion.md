# GitHub Discussion Post — andrewyng/aisuite

**Title:** Built a full-stack TypeScript AI coworker using the same `provider:model` pattern — would love your thoughts

---

Hey everyone — big fan of aisuite. The `provider:model` string syntax is one of the cleanest API decisions I've seen in an LLM library. We borrowed it directly.

We've been building **[Coworker](https://github.com/arunrajiah/coworker)** — an open-source AI coworker for founders. It's the TypeScript answer to the same problem aisuite solves, but taken several layers higher into a full application.

**What we built on top of the provider:model pattern:**

- Multi-provider routing with automatic fallback chains (if your Anthropic key fails, fall back to OpenAI — no code change)
- Persistent memory via pgvector — the agent remembers context across every conversation using cosine similarity retrieval
- Task management with a Kanban board — the agent can create, search, and update tasks while chatting
- Autopilot — scheduled agents that run on cron or event triggers (e.g. "every Monday, summarize last week's tasks")
- Slack, WhatsApp, Telegram — same agent, every channel
- Multi-user workspaces with Postgres RLS
- One-command self-hosting via Docker Compose

The stack: Next.js 15 + Hono + BullMQ + PostgreSQL 16 + pgvector + Drizzle ORM + Vercel AI SDK (TypeScript's equivalent of aisuite).

We support 11 providers: Anthropic, OpenAI, Google, Groq, Mistral, xAI (Grok), Cohere, DeepSeek, Together AI, OpenRouter, and Ollama — all switchable per-workspace without a redeploy. OpenRouter alone unlocks 200+ models through one key.

**The comparison we put in our README:**

| Capability | aisuite | Coworker |
|---|:---:|:---:|
| Multi-provider LLM routing | ✅ | ✅ |
| `provider:model` string syntax | ✅ | ✅ |
| Automatic model fallback chains | ❌ | ✅ |
| Persistent memory (pgvector RAG) | ❌ | ✅ |
| Task management + Kanban board | ❌ | ✅ |
| Autopilot (cron + event triggers) | ❌ | ✅ |
| Slack / WhatsApp / Telegram | ❌ | ✅ |
| Self-hostable (Docker Compose) | ❌ | ✅ |
| Language | Python | TypeScript |

**We're not competing — we're complementary.** aisuite solves routing beautifully. We solve the full "working" layer on top.

Would love to hear from people building agentic Python apps with aisuite — are you combining it with a task queue? Building persistent memory on top? Those are exactly the problems Coworker is designed to solve, just in TypeScript.

If you're on the Python side and want to embed a similar agent runtime, the architecture decisions here (RLS per tenant, pgvector for semantic recall, BullMQ for durability) should translate cleanly.

Repo: https://github.com/arunrajiah/coworker
Star it if it's useful — and happy to answer any questions about the architecture.
