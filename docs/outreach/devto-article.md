# dev.to Article Draft

**Title:** How I built an open-source AI coworker for founders — provider-agnostic, persistent memory, full-stack TypeScript

**Tags:** ai, typescript, opensource, productivity

**Cover image suggestion:** A split screen — left side shows the Coworker chat UI with a Kanban board visible, right side shows a terminal with Docker Compose spinning up.

---

## The problem

Every founder I know has the same complaint about AI tools: they're stateless. You explain your business to ChatGPT, close the tab, and tomorrow you start over. There's no "coworker" — just a very smart amnesiac.

I wanted to fix that. Not with a wrapper around ChatGPT, but with a proper application: persistent memory, task management, multi-channel, autopilot, and — critically — zero vendor lock-in on the AI provider.

So I built **[Coworker](https://github.com/arunrajiah/coworker)** — an open-source AI coworker for founders that you can self-host in one command.

---

## The architecture decision that drove everything else

The first real decision was how to handle LLM routing. I'd been watching **[aisuite](https://github.com/andrewyng/aisuite)** by Andrew Ng — a Python library that gives you a unified `provider:model` API across OpenAI, Anthropic, Google, and 17 more providers. The ergonomics are excellent:

```python
# aisuite — Python
client.chat.completions.create(
    model="anthropic:claude-sonnet-4-5",
    messages=[...]
)
```

I wanted the same idea in TypeScript, plus two things aisuite doesn't have:

1. **Automatic fallback chains** — if the primary key is missing or the provider is down, try the next one automatically
2. **The full application layer** — persistent memory, task queue, multi-tenant DB, UI

Here's what our `provider.ts` looks like:

```typescript
// Supports "provider:model" string syntax just like aisuite
export function parseModelString(modelString: string): ProviderConfig {
  const colonIdx = modelString.indexOf(':')
  if (colonIdx === -1) return { provider: modelString as ProviderName }
  return {
    provider: modelString.slice(0, colonIdx) as ProviderName,
    model: modelString.slice(colonIdx + 1),
  }
}

// Automatic fallback: if Anthropic key missing, try OpenAI, then Groq
export function buildLLMProviderWithFallback(config: ProviderConfig): LLMProvider {
  const chain = [config, ...(config.fallback ?? [])]
  for (const c of chain) {
    try {
      return buildLLMProvider(c)
    } catch {
      continue
    }
  }
  throw new Error('All providers in fallback chain failed')
}
```

In your `.env`, you can now write:

```bash
LLM_PROVIDER=anthropic:claude-sonnet-4-5
```

And switch the entire workspace to a different model in the UI without touching code or redeploying.

We support 11 providers: Anthropic, OpenAI, Google, Groq, Mistral, xAI (Grok), Cohere, DeepSeek, Together AI, OpenRouter (200+ models via one key), and Ollama for fully local models.

---

## The stack

Three processes, one purpose:

```
web (Next.js 15)  ──┐
                     ├──▶  api (Hono)  ──▶  PostgreSQL 16 + pgvector
worker (BullMQ)  ──┘              │
    │                             └──▶  Redis (job queue + pub/sub)
    └──▶  Vercel AI SDK ──▶  11 LLM providers
```

| Layer | Technology | Why |
|---|---|---|
| Frontend | Next.js 15 App Router | Streaming, RSC, fast |
| API | Hono + Node.js | Type-safe, composable middleware |
| Agent runtime | Vercel AI SDK | Provider-agnostic, tool use, streaming |
| Job queue | BullMQ + Redis | Durable agent runs, cron autopilot |
| Database | PostgreSQL 16 + pgvector | Relational + semantic memory in one |
| ORM | Drizzle | SQL-first, type-safe, migrations |

---

## The memory problem

Stateless AI is useless as a coworker. But naive memory (dump the full conversation history) hits context limits fast and costs a lot.

We solved it with **pgvector semantic retrieval**: every message is embedded and stored. On each new turn, we retrieve the top-K most semantically similar memories by cosine distance and inject them into the system prompt.

```typescript
// Retrieve relevant memories before each agent run
const recentMemories = await retrieveRelevantMemories(db, workspaceId, userInput)

// They land in the system prompt automatically
const systemPrompt = buildSystemPrompt({
  workspaceName: workspace.name,
  templateType: workspace.templateType,
  activeSkills,
  recentMemories,   // <-- injected here
  openTasksSummary,
})
```

The result: you can tell your coworker "our SaaS targets mid-market legal firms" in January and it will remember that context in June, without you having to repeat it.

---

## Durability via BullMQ

Every agent run is a BullMQ job, not an HTTP request. This matters because:

- LLM calls can take 30+ seconds — you don't want a dropped connection to kill a job
- Autopilot cron runs need to survive process restarts
- Tool calls (create task, search tasks, trigger deploy) need exactly-once semantics

The executor loop runs up to 10 tool-call steps per turn:

```typescript
const result = await generateText({
  model: chatModel,
  system: systemPrompt,
  messages: llmMessages,
  tools: {
    create_task, search_tasks, update_task,
    list_files, read_file, plan_work,
    list_issues, create_issue, list_pull_requests,
    list_vercel_connections, trigger_deployment,
  },
  maxSteps: 10,
  onStepFinish: async ({ toolCalls }) => {
    // Broadcast tool-in-progress to UI via Redis pub/sub → WebSocket
    await redis.publish(`ws:${workspaceId}`, JSON.stringify({
      type: 'agent:tool_call',
      tools: toolCalls.map(tc => tc.toolName),
    }))
  },
})
```

The UI shows a live "Searching tasks…" indicator while the agent works.

---

## Founder templates

Different businesses have different vocabularies. A SaaS founder doesn't think in the same terms as an agency owner.

We ship 7 templates that pre-configure the system prompt with domain-specific context:

| Template | What the agent understands |
|---|---|
| SaaS | MRR, churn, activation, sprint planning |
| Agency | Client retainers, utilization, proposals |
| Ecommerce | AOV, ROAS, inventory, campaigns |
| Consulting | Engagements, deliverables, pipeline |
| Freelancer | Projects, invoices, deadlines |
| Creator | Subscribers, views, sponsorships, content calendar |
| Real Estate | Listings, GCI, pipeline, buyer/seller leads |

---

## What you get out of the box

- **Kanban board** with drag-and-drop (Backlog → Todo → In Progress → Review → Done)
- **Persistent threads** — every conversation is remembered
- **File attachments** — PDFs, images, text files read in context
- **Autopilot** — scheduled agent runs (daily briefings, weekly wrap-ups)
- **Integrations** — GitHub/GitLab/Bitbucket, Vercel, Slack, WhatsApp (Twilio), Telegram
- **Multi-user workspaces** with RLS at the database level
- **Skills** — custom instructions with trigger phrases (e.g. `/standup`)
- **Dark mode**, ⌘K new chat, real-time tool-in-progress indicator

---

## How to run it

```bash
git clone https://github.com/arunrajiah/coworker
cd coworker
cp .env.example .env

# Add at least one LLM key
echo "ANTHROPIC_API_KEY=sk-ant-..." >> .env
echo "AUTH_SECRET=$(openssl rand -hex 32)" >> .env

docker compose -f infra/docker/docker-compose.oss.yml up -d
open http://localhost:3000
```

That's it. Postgres, Redis, API, worker, and web — all wired up.

---

## vs. aisuite

I want to be clear: aisuite and Coworker are **complementary, not competing**.

aisuite is a routing library — clean, minimal, exactly what it says it is. If you're building a Python LLM application and need to swap providers without rewriting code, use aisuite.

Coworker is an application — it solves everything above the routing layer: where do responses live, how do you retrieve relevant context, how do you schedule runs, how do you give the agent tools, how do you handle multiple users.

| Capability | aisuite | Coworker |
|---|:---:|:---:|
| Multi-provider LLM routing | ✅ | ✅ |
| `provider:model` string syntax | ✅ | ✅ |
| Automatic model fallback chains | ❌ | ✅ |
| Persistent memory (pgvector RAG) | ❌ | ✅ |
| Task management + Kanban | ❌ | ✅ |
| Autopilot scheduling | ❌ | ✅ |
| Slack / WhatsApp / Telegram | ❌ | ✅ |
| Multi-user + RLS | ❌ | ✅ |
| Self-hostable | ❌ | ✅ |
| Language | Python | TypeScript |

aisuite solves routing. Coworker solves working.

---

## What's next

- **Provider health UI** — status badge per provider in settings
- **Side-by-side model comparison** — send the same prompt to two models simultaneously
- **Linear, Notion, Google Calendar** integrations
- **HN Show HN launch** — planning this soon

If you're building something similar in Python and want to compare notes on the memory architecture or the BullMQ job design, drop a comment. And if you're a founder who wants to try it, the Docker setup takes about 3 minutes.

**Repo: https://github.com/arunrajiah/coworker** — a star means a lot at this stage.
