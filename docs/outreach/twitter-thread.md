# X / Twitter Thread

**Post 1 (hook)**
I built an open-source AI coworker for founders — persistent memory, task management, autopilot, 11 LLM providers.

One command to self-host. MIT license.

Here's what's inside 🧵

---

**Post 2 (the problem)**
Every AI tool resets your context when you close the tab.

Your coworker shouldn't forget what you told it last month.

Coworker uses pgvector to embed every conversation. On each turn, it retrieves the most relevant memories by cosine similarity and injects them into context.

You tell it once. It remembers forever.

---

**Post 3 (provider-agnostic)**
Inspired by @AndrewYNg's aisuite — we support 11 LLM providers switchable per workspace with zero redeployment:

• Anthropic Claude
• OpenAI GPT-4o
• Google Gemini
• Groq (Llama 3.3 70B)
• Mistral
• xAI Grok
• Cohere Command R+
• DeepSeek V3 + R1
• Together AI
• OpenRouter (200+ models)
• Ollama (local)

Set LLM_PROVIDER=anthropic:claude-sonnet-4-5 in .env. Done.

---

**Post 4 (the agent)**
The agent isn't a chatbot — it actually works.

It has tools:
→ create_task / search_tasks / update_task
→ list_issues / create_issue / list_pull_requests
→ trigger_deployment / get_deployment_status
→ list_files / read_file / plan_work

Up to 10 tool-call steps per turn. You watch it work in real time.

---

**Post 5 (durability)**
LLM calls take 30+ seconds. HTTP requests drop.

Every agent run is a BullMQ job — durable, retryable, survives process restarts.

Autopilot schedules also run as jobs: weekly briefings, Monday planning, Friday wrap-ups. They run whether or not you open the app.

---

**Post 6 (multi-channel)**
Your coworker lives wherever you work:

→ Web app (Next.js 15)
→ Slack DM / @mention
→ WhatsApp (Twilio)
→ Telegram

Same agent. Same memory. All channels.

---

**Post 7 (founder templates)**
7 business templates pre-configure the agent's vocabulary:

SaaS → MRR, churn, activation
Agency → retainers, utilization, proposals
Ecommerce → AOV, ROAS, inventory
Consulting → engagements, deliverables
Freelancer → projects, invoices, deadlines
Creator → subscribers, views, sponsorships
Real Estate → listings, GCI, pipeline

Your agent talks your language from day one.

---

**Post 8 (self-host)**
One command:

```
git clone github.com/arunrajiah/coworker
cp .env.example .env
# Add your ANTHROPIC_API_KEY
docker compose up -d
open http://localhost:3000
```

Postgres + Redis + API + Worker + Web. All wired up.

---

**Post 9 (CTA)**
aisuite solves routing.
Coworker solves working.

★ github.com/arunrajiah/coworker

If you're building on top of aisuite or building an AI productivity tool — I'd love to compare notes.

What would make this 10x more useful for your workflow?
