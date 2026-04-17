import type { TemplateType } from '../agent/types.js'

export interface SkillSeed {
  name: string
  description: string
  prompt: string
  triggerPhrase?: string
  tools: string[]
}

export interface AutopilotRuleSeed {
  name: string
  description: string
  triggerType: 'schedule' | 'task_created' | 'task_status_changed'
  triggerConfig: Record<string, unknown>
  actionType: 'run_agent' | 'create_task' | 'send_message'
  actionConfig: Record<string, unknown>
}

export interface FounderTemplate {
  type: TemplateType
  name: string
  description: string
  systemPromptAddition: string
  defaultSkills: SkillSeed[]
  defaultAutopilotRules: AutopilotRuleSeed[]
  defaultTaskLabels: string[]
  suggestedFirstActions: string[]
}

export const FOUNDER_TEMPLATES: Record<TemplateType, FounderTemplate> = {
  saas: {
    type: 'saas',
    name: 'SaaS Founder',
    description: 'For founders building software-as-a-service products',
    systemPromptAddition: `You are the AI coworker for a SaaS founder. You understand metrics like MRR, ARR,
churn rate, CAC, LTV, activation rate, and NPS. You help prioritize product decisions,
track feature development, and analyze customer feedback. You think in terms of
product-market fit, growth levers, and retention. When discussing tasks, you consider
their impact on key SaaS metrics.`,
    defaultSkills: [
      {
        name: 'Weekly MRR Report',
        description: 'Summarize MRR, churn, and growth for the week',
        prompt:
          'When asked for an MRR report, help the founder summarize their current MRR, new MRR, churned MRR, and net MRR change. Ask for the numbers if not provided.',
        triggerPhrase: '/mrr',
        tools: ['create_task'],
      },
      {
        name: 'Sprint Planning',
        description: 'Help plan a development sprint',
        prompt:
          'When asked to plan a sprint, review the open tasks, suggest prioritization based on customer impact and effort, and create a structured sprint plan with clear goals.',
        triggerPhrase: '/sprint',
        tools: ['create_task', 'search_tasks'],
      },
    ],
    defaultAutopilotRules: [
      {
        name: 'Monday Morning Briefing',
        description: 'Weekly briefing every Monday at 9am',
        triggerType: 'schedule',
        triggerConfig: { cron: '0 9 * * MON' },
        actionType: 'run_agent',
        actionConfig: {
          prompt:
            'Give me a monday morning briefing: summarize open tasks, highlight any blockers, and suggest the top 3 priorities for this week.',
        },
      },
    ],
    defaultTaskLabels: ['feature', 'bug', 'growth', 'ops', 'customer', 'infrastructure'],
    suggestedFirstActions: [
      'Tell me about your product and current MRR',
      'What are the top 3 things blocking growth right now?',
      'Create a task to review this week\'s customer feedback',
    ],
  },

  agency: {
    type: 'agency',
    name: 'Agency Owner',
    description: 'For founders running a digital agency or services business',
    systemPromptAddition: `You are the AI coworker for an agency owner. You understand client management,
project delivery, utilization rates, retainers, and proposals. You help track client
projects, manage team capacity, and ensure deliverables stay on track. You think in
terms of client satisfaction, profitability per project, and team utilization.`,
    defaultSkills: [
      {
        name: 'Client Status Report',
        description: 'Generate a status update for a client',
        prompt:
          'When asked for a client status report, help draft a professional update covering completed work, upcoming deliverables, blockers, and next steps.',
        triggerPhrase: '/status',
        tools: ['search_tasks', 'create_task'],
      },
    ],
    defaultAutopilotRules: [
      {
        name: 'Friday Client Wrap-up',
        description: 'Weekly reminder to send client updates',
        triggerType: 'schedule',
        triggerConfig: { cron: '0 16 * * FRI' },
        actionType: 'run_agent',
        actionConfig: {
          prompt:
            'It\'s Friday. Review all open client tasks and remind me which clients need a status update before the weekend.',
        },
      },
    ],
    defaultTaskLabels: ['client', 'design', 'development', 'review', 'proposal', 'invoice'],
    suggestedFirstActions: [
      'List your current active clients',
      'What projects are due this week?',
      'Help me write a proposal for a new client',
    ],
  },

  ecommerce: {
    type: 'ecommerce',
    name: 'Ecommerce Founder',
    description: 'For founders running an online store or D2C brand',
    systemPromptAddition: `You are the AI coworker for an ecommerce founder. You understand metrics like
AOV (Average Order Value), ROAS, CAC, conversion rate, and inventory turnover. You
help manage product launches, marketing campaigns, and operational tasks. You think
in terms of revenue per visitor, repeat purchase rate, and supply chain efficiency.`,
    defaultSkills: [
      {
        name: 'Daily Sales Summary',
        description: 'Summarize daily sales performance',
        prompt:
          'When asked for a sales summary, help the founder review their sales numbers, top products, and any anomalies compared to recent performance.',
        triggerPhrase: '/sales',
        tools: ['create_task'],
      },
    ],
    defaultAutopilotRules: [
      {
        name: 'Daily Sales Briefing',
        description: 'Morning sales check-in',
        triggerType: 'schedule',
        triggerConfig: { cron: '0 8 * * *' },
        actionType: 'run_agent',
        actionConfig: {
          prompt:
            'Good morning! Give me a quick briefing on what I should focus on today for the store. Check for any pending tasks related to inventory, marketing, or customer service.',
        },
      },
    ],
    defaultTaskLabels: ['product', 'marketing', 'inventory', 'customer', 'ops', 'supplier'],
    suggestedFirstActions: [
      'What products are you selling and what\'s your current monthly revenue?',
      'What\'s your biggest operational challenge right now?',
      'Help me plan a product launch',
    ],
  },

  consulting: {
    type: 'consulting',
    name: 'Consultant',
    description: 'For independent consultants and boutique consulting firms',
    systemPromptAddition: `You are the AI coworker for a consultant. You understand billable hours,
engagements, deliverables, and pipeline management. You help track active engagements,
manage proposal pipelines, and ensure deliverables are completed on time. You think
in terms of utilization rate, average engagement value, and client retention.`,
    defaultSkills: [
      {
        name: 'Engagement Tracker',
        description: 'Track status of active consulting engagements',
        prompt:
          'When asked about engagements, help review the status of active projects, upcoming deadlines, and any deliverables at risk.',
        triggerPhrase: '/engagements',
        tools: ['search_tasks', 'create_task'],
      },
    ],
    defaultAutopilotRules: [
      {
        name: 'Weekly Pipeline Review',
        description: 'Review proposals and pipeline every week',
        triggerType: 'schedule',
        triggerConfig: { cron: '0 9 * * WED' },
        actionType: 'run_agent',
        actionConfig: {
          prompt:
            'It\'s Wednesday. Let\'s review my consulting pipeline. What proposals are outstanding? What follow-ups are needed?',
        },
      },
    ],
    defaultTaskLabels: ['engagement', 'proposal', 'deliverable', 'meeting', 'invoice', 'research'],
    suggestedFirstActions: [
      'What consulting engagements are you currently running?',
      'Help me outline a proposal for a new client',
      'What deliverables are due this week?',
    ],
  },

  freelancer: {
    type: 'freelancer',
    name: 'Freelancer',
    description: 'For independent freelancers managing multiple clients',
    systemPromptAddition: `You are the AI coworker for a freelancer. You understand project-based work,
client management, invoicing, and juggling multiple projects simultaneously. You help
track deadlines, manage client communication, and stay on top of invoicing. You think
in terms of hourly rate, project profitability, and work-life balance.`,
    defaultSkills: [
      {
        name: 'Invoice Reminder',
        description: 'Check for outstanding invoices',
        prompt:
          'When asked about invoices, review any tasks related to billing, flag overdue invoices, and help draft payment reminder messages.',
        triggerPhrase: '/invoices',
        tools: ['create_task', 'search_tasks'],
      },
    ],
    defaultAutopilotRules: [
      {
        name: 'End of Week Wrap-up',
        description: 'Friday wrap-up check',
        triggerType: 'schedule',
        triggerConfig: { cron: '0 17 * * FRI' },
        actionType: 'run_agent',
        actionConfig: {
          prompt:
            'Week is done. What tasks did I complete this week? What\'s pending for next week? Any invoices I need to send?',
        },
      },
    ],
    defaultTaskLabels: ['project', 'client', 'invoice', 'deadline', 'revision', 'admin'],
    suggestedFirstActions: [
      'What projects are you currently working on?',
      'Do you have any overdue invoices?',
      'Help me set up tasks for a new project',
    ],
  },

  general: {
    type: 'general',
    name: 'General',
    description: 'A general-purpose AI coworker for any type of work',
    systemPromptAddition: `You are a general-purpose AI coworker. You help with task management,
planning, research, and day-to-day operations. You are organized, proactive, and
help keep work on track.`,
    defaultSkills: [],
    defaultAutopilotRules: [
      {
        name: 'Weekly Review',
        description: 'Weekly check-in every Monday',
        triggerType: 'schedule',
        triggerConfig: { cron: '0 9 * * MON' },
        actionType: 'run_agent',
        actionConfig: {
          prompt:
            'Good morning! Let\'s start the week. What are the open tasks? What should I focus on this week?',
        },
      },
    ],
    defaultTaskLabels: ['task', 'idea', 'research', 'meeting', 'review'],
    suggestedFirstActions: [
      'What are you working on right now?',
      'Create a task for something you need to get done',
      'Tell me about your goals for this week',
    ],
  },
}
