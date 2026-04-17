# Contributing to Coworker

Thank you for your interest in contributing! This guide will get you set up and explain how we work.

---

## Development setup

```bash
# Prerequisites: Node 20+, pnpm 9+, Docker

git clone https://github.com/arunrajiah/coworker
cd coworker
cp .env.example .env

# Fill in your LLM key (Anthropic or OpenAI)
# Then start Postgres + Redis:
docker compose -f infra/docker/docker-compose.oss.yml up postgres redis -d

pnpm install
cd packages/db && pnpm db:migrate && cd ../..
pnpm dev
```

Ports: **web** → 3000, **api** → 3001

---

## Project structure

```
apps/
  web/      Next.js 15 frontend
  api/      Hono API server
  worker/   BullMQ agent executor + autopilot scheduler
packages/
  core/     Adapter interfaces + founder templates
  db/       Drizzle schema + migrations
  config/   Zod env validation
  adapters/ OSS adapter implementations
infra/
  docker/   Docker Compose OSS config
```

---

## How to contribute

### Bugs

1. Search [existing issues](https://github.com/arunrajiah/coworker/issues) first.
2. If it's new, open a bug report using the **Bug report** template.
3. Include: what you did, what you expected, what happened, and your environment.

### Features

1. Open a **Feature request** issue to discuss it before writing code.
2. Get a thumbs-up from a maintainer, then submit a PR.

### Pull requests

- Keep PRs focused — one feature or fix per PR.
- Add or update tests if you're changing behaviour.
- Run `pnpm typecheck` and `pnpm lint` before opening a PR.
- Fill in the PR template — especially the **Test plan** section.

---

## Code conventions

- **TypeScript** everywhere. `strict: true`. No `any` unless genuinely necessary.
- **No comments** for obvious code. Add one only when the *why* isn't clear from the code.
- **Adapter pattern** for pluggable providers — no `if (OSS_MODE)` flags.
- **Drizzle** for all DB access. Use `withWorkspace()` to set the RLS context.
- **BullMQ** for all background work. Don't do async work inline in HTTP handlers.

---

## Commit style

We use conventional commits:

```
feat: add Telegram integration
fix: resolve memory leak in WebSocket gateway
docs: improve self-hosting checklist
chore: update drizzle-orm to 0.37
```

---

## Questions?

Open a [Discussion](https://github.com/arunrajiah/coworker/discussions) or drop into the issue tracker.
