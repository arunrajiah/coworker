# Coworker Roadmap

## Legend
- ✅ Done
- 🚧 In progress
- 📋 Planned
- 💡 Idea

---

## Phase 1 — Foundation ✅

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

---

## Phase 2 — Provider Supremacy 🚧

**Goal**: become the most provider-flexible AI agent runtime available — in any language.

### Multi-provider expansion ✅
- ✅ Anthropic, OpenAI, Google, Groq, Mistral, Ollama
- ✅ xAI (Grok), Cohere, DeepSeek, Together AI
- ✅ OpenRouter (routes to 200+ models via one key)
- ✅ `provider:model` string syntax (`anthropic:claude-sonnet-4-5`)
- ✅ Automatic fallback chains (if primary key missing, try next)

### Provider UI (📋 next)
- 📋 Model switcher in chat sidebar — change model mid-conversation
- 📋 Provider health status badge in Settings → AI Model
- 📋 Token usage + estimated cost per message (shown below assistant bubble)
- 📋 Cost budget alerts (email/Slack when monthly spend exceeds threshold)

### Model benchmarking (💡)
- 💡 Side-by-side model comparison: send the same prompt to two models, see both outputs
- 💡 Response latency per provider tracked in DB, shown in Settings

---

## Phase 3 — Autopilot & Memory 📋

- 📋 Autopilot rules UI (cron + event trigger builder)
- 📋 Drizzle migrations generation (`pnpm db:generate`)
- 📋 Memory management UI — view/delete stored memories
- 📋 Memory strength indicator (how many times a fact has been reinforced)
- 📋 File upload UI (drag-and-drop to chat + file manager in sidebar)

---

## Phase 4 — More Integrations 📋

- 📋 Linear — issues sync + create from chat
- 📋 Notion — read pages as context, write summaries
- 📋 Google Calendar — schedule awareness, meeting prep briefs
- 📋 Stripe — MRR/churn context for SaaS template
- 📋 HubSpot / Pipedrive — CRM pipeline for Consulting/Real Estate templates
- 📋 Email (IMAP read) — summarize inbox, draft replies

---

## Phase 5 — Community & Ecosystem 📋

**Goal**: become the go-to TypeScript alternative to Python-only AI tooling.

### aisuite collaboration strategy
- 📋 Open a Discussion on [andrewyng/aisuite](https://github.com/andrewyng/aisuite): "Built a full-stack TypeScript AI coworker using the same provider:model pattern"
- 📋 Write dev.to / Hashnode post: "How we built an open-source AI coworker for founders using pgvector + BullMQ"
- 📋 Add aisuite to README "Inspired by" section (already done — see comparison table)
- 📋 Tag @AndrewYNg on X with repo launch
- 📋 Submit to Hacker News Show HN on launch day

### OSS growth
- 📋 GitHub Discussions for Q&A
- 📋 `CONTRIBUTING.md` + good-first-issue labels
- 📋 Plugin/adapter system — community can publish custom integrations
- 📋 `npx create-coworker` CLI scaffolder

---

## Phase 6 — SaaS / Cloud 💡

- 💡 Managed cloud version (no Docker needed)
- 💡 Per-seat billing via Stripe
- 💡 Shared team workspaces with invite links
- 💡 SSO (SAML/OIDC) for enterprise
- 💡 Usage analytics dashboard (tokens, cost, tasks completed)
