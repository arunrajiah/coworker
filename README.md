# Coworker

**The teammate who never sleeps.**

[![CI](https://github.com/arunrajiah/coworker/actions/workflows/ci.yml/badge.svg)](https://github.com/arunrajiah/coworker/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![pnpm](https://img.shields.io/badge/maintained%20with-pnpm-cc00ff.svg)](https://pnpm.io/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue?logo=typescript)](https://www.typescriptlang.org/)

Coworker is an open-source AI coworker for founders. It manages tasks, remembers context across every conversation, and keeps working on autopilot while you focus on what matters.

---

## What makes it different

- **Founder templates** — picks up your business context from day one (SaaS, Agency, Ecommerce, Consulting, Freelancer). Your coworker talks in your language.
- **Memory that persists** — every conversation is embedded and retrieved via pgvector. Your coworker remembers what you told it last month.
- **Autopilot** — schedule automations (weekly briefings, Friday wrap-ups, Monday planning) that run whether or not you open the app.
- **One command to self-host** — Postgres + Redis + 3 services via Docker Compose.
- **Provider-agnostic** — works with Anthropic Claude or OpenAI. Switch with a single env var.

---

## Quick start

```bash
# 1. Clone + copy env
git clone https://github.com/arunrajiah/coworker
cd coworker
cp .env.example .env

# 2. Add your LLM key (Anthropic or OpenAI — at least one required)
# Edit .env: ANTHROPIC_API_KEY=sk-ant-... or OPENAI_API_KEY=sk-...

# 3. Generate an auth secret
openssl rand -hex 32   # paste as AUTH_SECRET in .env

# 4. Start everything
docker compose -f infra/docker/docker-compose.oss.yml up -d

# 5. Run migrations
docker compose -f infra/docker/docker-compose.oss.yml exec api \
  node -e "import('./src/migrate.js')"

# 6. Open
open http://localhost:3000
```

---

## Architecture

Three processes. One purpose.

```
web (Next.js 15)  ──┐
                     ├──▶  api (Hono)  ──▶  PostgreSQL + pgvector
worker (BullMQ)  ──┘              │
    │                             └──▶  Redis (job queue + pub/sub)
    └──▶  Vercel AI SDK (Anthropic / OpenAI)
```

| Layer | Technology | Why |
|---|---|---|
| Frontend | Next.js 15 App Router | Streaming, RSC, fast |
| API | Hono + Node.js | Type-safe, composable middleware |
| Agent runtime | Vercel AI SDK | Provider-agnostic, tool use, streaming |
| Job queue | BullMQ + Redis | Durable agent runs, cron autopilot |
| Database | PostgreSQL 16 + pgvector | Relational + semantic memory in one |
| ORM | Drizzle | SQL-first, type-safe, migrations |
| Auth | Magic link + JWT | No password friction |

---

## Project structure

```
coworker/
├── apps/
│   ├── web/       Next.js 15 frontend
│   ├── api/       Hono API (auth, workspaces, tasks, chat, skills, autopilot)
│   └── worker/    BullMQ agent executor + autopilot scheduler
├── packages/
│   ├── core/      Adapter interfaces + all 5 founder templates
│   ├── db/        Drizzle schema + migrations (platform + tenant with RLS)
│   ├── config/    Zod env validation
│   └── adapters/  OSS implementations (local storage, SMTP, no-op billing)
└── infra/
    └── docker/    Docker Compose OSS
```

---

## Founder templates

Pick your business type when you create a workspace. Your coworker arrives pre-configured with context-aware skills and autopilot rules.

| Type | What your coworker understands |
|---|---|
| SaaS | MRR, churn, activation, sprint planning |
| Agency | Client retainers, utilization, proposals |
| Ecommerce | AOV, ROAS, inventory, campaigns |
| Consulting | Engagements, deliverables, pipeline |
| Freelancer | Projects, invoices, deadlines |

---

## How the agent works

Every message you send runs through a durable BullMQ job:

1. Message saved to DB → job enqueued
2. Worker builds system prompt: base + template context + active skills + recent memories + open tasks
3. `generateText` with tools (`create_task`, `search_tasks`, `update_task`) — up to 10 steps
4. Response + tool calls saved to DB, broadcast via Redis pub/sub → WebSocket → browser

Memory is stored as pgvector embeddings and retrieved by cosine similarity on every turn.

---

## Autopilot

Create rules that run on a schedule or on events. A rule has:

- **Trigger**: cron schedule (e.g. every Monday 9am) or event hook
- **Action**: run the agent with a prompt, or create a task directly

Rules are synced to BullMQ repeatable jobs on startup and whenever you change them. If the worker restarts, all jobs are re-synced from the DB.

---

## Development

```bash
pnpm install

# Start Postgres + Redis
docker compose -f infra/docker/docker-compose.oss.yml up postgres redis -d

# Run migrations
cd packages/db && pnpm db:migrate && cd ../..

# Start all services
pnpm dev
```

Ports: web → 3000, api → 3001

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | Postgres connection string |
| `REDIS_URL` | Yes | Redis connection string |
| `AUTH_SECRET` | Yes | 32+ byte secret for JWT signing |
| `ANTHROPIC_API_KEY` | One of | Claude models |
| `OPENAI_API_KEY` | One of | OpenAI models |
| `APP_URL` | Yes | Frontend origin (e.g. `http://localhost:3000`) |
| `API_URL` | Yes | API origin (e.g. `http://localhost:3001`) |
| `SMTP_URL` | No | SMTP connection string — magic links print to logs if unset |
| `EMAIL_FROM` | No | From address for magic link emails |
| `STORAGE_PATH` | No | Local file storage path (default: `./uploads`) |

---

## Self-hosting checklist

- [ ] Set `AUTH_SECRET` to 32+ random bytes (`openssl rand -hex 32`)
- [ ] Set at least one LLM key (`ANTHROPIC_API_KEY` or `OPENAI_API_KEY`)
- [ ] Set `POSTGRES_PASSWORD` to something strong
- [ ] Set `APP_URL` and `API_URL` to your domain
- [ ] Set up a reverse proxy (nginx/Caddy) with HTTPS
- [ ] (Optional) Set `SMTP_URL` for real email — otherwise magic links print to logs

---

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) before submitting a PR.

**Good first issues** are labeled [`good first issue`](https://github.com/arunrajiah/coworker/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22).

---

## Roadmap

- [ ] Telegram / WhatsApp integration
- [ ] File uploads with vision support
- [ ] More founder templates (Creator, Real estate)
- [ ] Webhook triggers for autopilot
- [ ] Public skills marketplace
- [ ] Mobile app

---

## License

[MIT](LICENSE) — build on it, ship it, make it yours.
