# Hacker News — Show HN Post

**Title:** Show HN: Coworker – open-source AI coworker for founders (Next.js, pgvector, BullMQ, 11 LLM providers)

---

**Body:**

I built Coworker because every AI tool I tried was stateless — you explain your business, close the tab, and the next day you start over.

Coworker is a self-hosted AI agent that manages tasks, remembers context across every conversation, and runs automations on autopilot. MIT license, Docker Compose setup.

**What makes it different from another ChatGPT wrapper:**

- Memory via pgvector — every conversation is embedded. On each turn, the top-K relevant memories are retrieved by cosine similarity and injected into the system prompt. You tell it once, it remembers forever.
- Durable agent runs via BullMQ — LLM calls take 30+ seconds. Jobs survive dropped connections and process restarts. Autopilot cron runs are also jobs.
- Tool use in a real agentic loop — up to 10 steps per turn: create/search/update tasks, create GitHub issues, trigger Vercel deploys, read uploaded files.
- 11 LLM providers switchable per workspace at runtime: Anthropic, OpenAI, Google, Groq, Mistral, xAI (Grok), Cohere, DeepSeek, Together AI, OpenRouter (200+ models via one key), Ollama.
- Automatic fallback chains — if the primary provider key is missing or fails, fall back to the next one without code changes.
- Multi-channel — same agent available via web, Slack, WhatsApp (Twilio), Telegram.
- Multi-user workspaces with Postgres RLS — proper tenant isolation at the DB level.

**Stack:** Next.js 15 + Hono + BullMQ + Redis + PostgreSQL 16 + pgvector + Drizzle ORM + Vercel AI SDK

**Quick start:**
```bash
git clone https://github.com/arunrajiah/coworker
cp .env.example .env  # add ANTHROPIC_API_KEY (or any other)
docker compose -f infra/docker/docker-compose.oss.yml up -d
open http://localhost:3000
```

**GitHub:** https://github.com/arunrajiah/coworker

Happy to discuss the memory architecture (why pgvector over a dedicated vector DB), the BullMQ job design for durable LLM calls, or the multi-tenant RLS approach.

---

## Notes on timing
- Post on a weekday, 9–11am Eastern (peak HN traffic)
- Have the GitHub README polished and the Docker setup confirmed working before posting
- Respond to every comment within the first 2 hours — HN rewards engagement
- If someone asks about Python — mention aisuite as the inspiration, link it
