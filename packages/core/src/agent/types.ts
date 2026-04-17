export type TemplateType =
  | 'saas'
  | 'agency'
  | 'ecommerce'
  | 'consulting'
  | 'freelancer'
  | 'general'

export interface AgentContext {
  workspaceId: string
  workspaceName: string
  templateType: TemplateType
  userId?: string
  threadId: string
  activeSkills: ActiveSkill[]
  recentMemories: string[]
  openTasksSummary: string
}

export interface ActiveSkill {
  id: string
  name: string
  prompt: string
  triggerPhrase?: string | null
  tools: string[]
}

export interface ToolCall {
  id: string
  name: string
  args: Record<string, unknown>
  result?: unknown
}

export interface AgentMessage {
  role: 'user' | 'assistant' | 'tool'
  content: string
  toolCalls?: ToolCall[]
}

export interface AgentRunResult {
  output: string
  toolCalls: ToolCall[]
  tokensUsed: number
  durationMs: number
}
