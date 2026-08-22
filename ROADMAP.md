# Coworker Roadmap

The plan for Coworker, the open-source AI coworker for founders. Phases ship in order; items inside a phase are ranked by impact. Dates are targets, not promises.

## Legend
- ✅ Done
- 🚧 In progress
- 📋 Planned
- 💡 Idea (needs validation before it gets scheduled)

---

## Phase 1 — Foundation ✅

The core product: a self-hostable AI coworker with tasks, chat, memory, and integrations.

- ✅ Full monorepo structure (pnpm + Turborepo)
- ✅ PostgreSQL + pgvector schema with RLS + multi-tenant
- ✅ Hono API: auth (magic link), workspaces, tasks, chat, skills, WebSocket gateway
- ✅ BullMQ worker: agent executor with tool use + pgvector memory
- ✅ Next.js 15 web app: login, workspace picker, chat, tasks, settings/skills
- ✅ Docker Compose OSS + Dockerfiles + .env.example
- ✅ Founder templates: SaaS / Agency / Ecommerce / Consulting / Freelancer / Creator / Real Estate
- ✅ Integrations: Slack, WhatsApp (Twilio), Telegram, GitHub/GitLab/Bitbucket, Vercel
- ✅ Multi-user teams + workspaces
- ✅ Dark mode, ⌘K new chat, date separators, file attachments
- ✅ Model indicator in chat (shows provider:model)
- ✅ Specs module: requirements, blueprints, and feedback docs linked to tasks

---

## Phase 2 — Provider Supremacy 🚧

**Goal**: the most provider-flexible AI agent runtime available, in any language. Switching models should be as easy as switching Slack channels.

### Multi-provider engine ✅
- ✅ Anthropic, OpenAI, Google, Groq, Mistral, Ollama
- ✅ xAI (Grok), Cohere, DeepSeek, Together AI
- ✅ OpenRouter (routes to 200+ models via one key)
- ✅ `provider:model` string syntax (`anthropic:claude-sonnet-4-5`)
- ✅ Automatic fallback chains (if primary key missing, try next)

### Provider UI ✅
- ✅ Model switcher in chat: per-thread override that beats the workspace default, without touching other threads
- ✅ Provider key status in Settings → AI Model
- ✅ Token usage + exact cost per message, shown under assistant replies
- ✅ Monthly budget with in-app alerts at a configurable threshold
- ✅ Shared model catalog + pricing table in `@coworker/core` (one source of truth for web and worker)
- ✅ Live provider health probe: Test providers in Settings calls each provider's API to verify the key works, with latency and failure reason
- ✅ Per-thread model override (`tenant.thread_settings`; resolution: thread > workspace > server default)

### Model benchmarking 💡
- 💡 Side-by-side comparison: same prompt to two models, both outputs shown
- 💡 Response latency per provider tracked in DB, surfaced in Settings

**Exit criteria**: a user can pick any of the 11 providers from the UI, see what each message cost, and never wonder whether their key works.

---

## Phase 3 — Runs Anywhere 🚧

**Goal**: `git clone` → running locally in under 5 minutes, on macOS, Linux, or Windows, with zero cloud dependencies (Ollama works fully offline).

- ✅ One-command local boot: `docker compose up` brings up Postgres+pgvector, Redis, API, worker, and web, and runs migrations automatically
- ✅ Migration pipeline verified from zero: a fresh empty database migrates to the full schema (journal, enum, and pgvector fixes)
- ✅ Setup doctor (`node scripts/doctor.mjs`): checks Node/pnpm/Docker, ports, and env vars and says exactly what is missing
- ✅ Windows path documented in README (Docker Desktop + WSL2)
- ✅ Dev mode reads the root `.env` (same file the Docker stack uses)
- 📋 Graceful degradation: boot with no API keys and point to Settings instead of exiting
- 📋 Seed script with demo workspace + sample tasks so the first run is not an empty screen

---

## Phase 4 — Autopilot & Memory 📋

**Goal**: Coworker works while you sleep and remembers why.

- 📋 Autopilot rules UI (cron + event trigger builder)
- 📋 Memory management UI: view, edit, delete stored memories
- 📋 Memory strength indicator (how often a fact has been reinforced)
- 📋 File upload UI (drag-and-drop to chat + file manager in sidebar)
- 📋 Drizzle migrations generation (`pnpm db:generate`)

---

## Phase 5 — More Integrations 📋

**Goal**: meet founders where their business data already lives.

- 📋 Linear: issues sync + create from chat
- 📋 Notion: read pages as context, write summaries
- 📋 Google Calendar: schedule awareness, meeting prep briefs
- 📋 Stripe: MRR/churn context for the SaaS template
- 📋 HubSpot / Pipedrive: CRM pipeline for Consulting/Real Estate templates
- 📋 Email (IMAP read): summarize inbox, draft replies

---

## Phase 6 — Community & Ecosystem 📋

**Goal**: become the go-to TypeScript alternative to Python-only AI tooling.

### Launch
- 📋 Open a Discussion on [andrewyng/aisuite](https://github.com/andrewyng/aisuite): "Built a full-stack TypeScript AI coworker using the same provider:model pattern"
- 📋 Write dev.to / Hashnode post: "How we built an open-source AI coworker for founders using pgvector + BullMQ"
- ✅ Add aisuite to README "Inspired by" section (see comparison table)
- 📋 Tag @AndrewYNg on X with repo launch
- 📋 Submit to Hacker News Show HN on launch day

### OSS growth
- 📋 GitHub Discussions for Q&A
- ✅ `CONTRIBUTING.md`
- 📋 good-first-issue labels
- 📋 Plugin/adapter system so the community can publish custom integrations
- 📋 `npx create-coworker` CLI scaffolder

---

## Phase 7 — SaaS / Cloud 💡

Only after the self-hosted product is excellent.

- 💡 Managed cloud version (no Docker needed)
- 💡 Per-seat billing via Stripe
- 💡 Shared team workspaces with invite links
- 💡 SSO (SAML/OIDC) for enterprise
- 💡 Usage analytics dashboard (tokens, cost, tasks completed)

---

## Non-goals (for now)

- Mobile apps: the web app is responsive; native apps wait until the core is stable
- Fine-tuning or hosting models: Coworker orchestrates models, it does not train them
- A no-code workflow builder: autopilot rules stay simple triggers, not a Zapier clone
