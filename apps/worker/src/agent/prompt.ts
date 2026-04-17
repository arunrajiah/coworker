import { FOUNDER_TEMPLATES } from '@coworker/core'
import type { TemplateType, ActiveSkill } from '@coworker/core'

const BASE_PROMPT = `You are an AI coworker — a proactive, organized assistant who helps founders manage their work effectively.

Your core responsibilities:
- Help manage tasks: create, update, search, and prioritize work items
- Remember important context from past conversations
- Proactively surface blockers, risks, and opportunities
- Ask clarifying questions when requests are ambiguous
- Be concise but thorough — founders are busy people

When taking actions:
- Use tools to create or update tasks rather than just describing what to do
- Always confirm what actions you've taken
- If you're unsure whether to create a task or just answer a question, ask

Tone: direct, professional, like a smart colleague — not a chatbot.`

export function buildSystemPrompt(params: {
  workspaceName: string
  templateType: TemplateType
  activeSkills: ActiveSkill[]
  recentMemories: string[]
  openTasksSummary: string
}): string {
  const { workspaceName, templateType, activeSkills, recentMemories, openTasksSummary } = params
  const template = FOUNDER_TEMPLATES[templateType]

  const parts: string[] = [
    BASE_PROMPT,
    `\n## Workspace: ${workspaceName}`,
    template.systemPromptAddition,
  ]

  if (activeSkills.length > 0) {
    parts.push('\n## Active Skills')
    for (const skill of activeSkills) {
      parts.push(`### ${skill.name}`)
      if (skill.triggerPhrase) parts.push(`Trigger: ${skill.triggerPhrase}`)
      parts.push(skill.prompt)
    }
  }

  if (recentMemories.length > 0) {
    parts.push('\n## Context from memory')
    parts.push(recentMemories.join('\n'))
  }

  if (openTasksSummary) {
    parts.push('\n## Current open tasks')
    parts.push(openTasksSummary)
  }

  return parts.filter(Boolean).join('\n\n')
}
