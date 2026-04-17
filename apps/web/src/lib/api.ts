const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

function getToken() {
  if (typeof window === 'undefined') return null
  try {
    const stored = localStorage.getItem('coworker-auth')
    if (stored) return (JSON.parse(stored) as { state?: { token?: string } }).state?.token ?? null
  } catch {}
  return null
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit & { workspaceSlug?: string } = {}
): Promise<T> {
  const token = getToken()
  const { workspaceSlug, ...fetchOptions } = options

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(workspaceSlug ? { 'X-Workspace-Slug': workspaceSlug } : {}),
    ...(fetchOptions.headers as Record<string, string>),
  }

  const res = await fetch(`${API_URL}${path}`, { ...fetchOptions, headers })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }))
    throw new Error(err.error ?? `HTTP ${res.status}`)
  }

  return res.json() as Promise<T>
}

export const api = {
  auth: {
    sendMagicLink: (email: string) =>
      apiRequest<{ ok: boolean; token?: string; user?: { id: string; email: string; name: string | null } }>(
        '/api/auth/magic-link/send',
        { method: 'POST', body: JSON.stringify({ email }) }
      ),
    verifyMagicLink: (token: string) =>
      apiRequest<{ token: string; user: { id: string; email: string; name: string | null } }>(
        '/api/auth/magic-link/verify',
        { method: 'POST', body: JSON.stringify({ token }) }
      ),
    me: () =>
      apiRequest<{ id: string; email: string; name: string | null; avatarUrl: string | null }>(
        '/api/auth/me'
      ),
    signOut: () => apiRequest('/api/auth/signout', { method: 'POST' }),
  },

  workspaces: {
    list: () => apiRequest<Workspace[]>('/api/workspaces'),
    create: (data: { name: string; templateType?: string }) =>
      apiRequest<Workspace>('/api/workspaces', { method: 'POST', body: JSON.stringify(data) }),
    get: (slug: string) => apiRequest<Workspace>(`/api/workspaces/${slug}`),
    update: (slug: string, data: { name?: string; llmProvider?: LLMProvider | null; llmModel?: string | null }) =>
      apiRequest<Workspace>(`/api/workspaces/${slug}`, { method: 'PATCH', body: JSON.stringify(data) }),
  },

  tasks: {
    list: (slug: string, params?: { status?: string; domain?: string }) => {
      const qs = params ? `?${new URLSearchParams(params as any)}` : ''
      return apiRequest<Task[]>(`/api/workspaces/${slug}/tasks${qs}`)
    },
    board: (slug: string, domain?: string) => {
      const qs = domain && domain !== 'all' ? `?domain=${domain}` : ''
      return apiRequest<BoardColumns>(`/api/workspaces/${slug}/tasks/board${qs}`)
    },
    create: (slug: string, data: Partial<Task>) =>
      apiRequest<Task>(`/api/workspaces/${slug}/tasks`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (slug: string, id: string, data: Partial<Task>) =>
      apiRequest<Task>(`/api/workspaces/${slug}/tasks/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    delete: (slug: string, id: string) =>
      apiRequest(`/api/workspaces/${slug}/tasks/${id}`, { method: 'DELETE' }),
  },

  skills: {
    list: (slug: string) => apiRequest<Skill[]>(`/api/workspaces/${slug}/skills`),
    create: (slug: string, data: Partial<Skill>) =>
      apiRequest<Skill>(`/api/workspaces/${slug}/skills`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (slug: string, id: string, data: Partial<Skill>) =>
      apiRequest<Skill>(`/api/workspaces/${slug}/skills/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    delete: (slug: string, id: string) =>
      apiRequest(`/api/workspaces/${slug}/skills/${id}`, { method: 'DELETE' }),
  },

  integrations: {
    telegramStatus: (slug: string) =>
      apiRequest<{ connections: TelegramConnection[] }>(
        `/api/workspaces/${slug}/integrations/telegram`,
        { workspaceSlug: slug }
      ),
    telegramConnectCode: (slug: string) =>
      apiRequest<{ code: string; botUsername: string; expiresInSeconds: number }>(
        `/api/workspaces/${slug}/integrations/telegram/connect-code`,
        { method: 'POST', workspaceSlug: slug }
      ),
    telegramDisconnect: (slug: string, connectionId: string) =>
      apiRequest(`/api/workspaces/${slug}/integrations/telegram/${connectionId}`, {
        method: 'DELETE',
        workspaceSlug: slug,
      }),
    listFiles: (slug: string) =>
      apiRequest<WorkspaceFile[]>(`/api/workspaces/${slug}/integrations/files`, {
        workspaceSlug: slug,
      }),
    uploadFile: async (slug: string, file: File): Promise<WorkspaceFile> => {
      const token = getToken()
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch(`${API_URL}/api/workspaces/${slug}/integrations/files`, {
        method: 'POST',
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
          'X-Workspace-Slug': slug,
        },
        body: formData,
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Upload failed' }))
        throw new Error((err as any).error ?? `HTTP ${res.status}`)
      }
      return res.json() as Promise<WorkspaceFile>
    },
    deleteFile: (slug: string, fileId: string) =>
      apiRequest(`/api/workspaces/${slug}/integrations/files/${fileId}`, {
        method: 'DELETE',
        workspaceSlug: slug,
      }),
    getExtractedText: (slug: string, fileId: string) =>
      apiRequest<ExtractedFileContent>(
        `/api/workspaces/${slug}/integrations/files/${fileId}/extracted-text`,
        { workspaceSlug: slug }
      ),
  },

  autopilot: {
    list: (slug: string) => apiRequest<AutopilotRule[]>(`/api/workspaces/${slug}/autopilot`),
    create: (slug: string, data: Partial<AutopilotRule>) =>
      apiRequest<AutopilotRule>(`/api/workspaces/${slug}/autopilot`, {
        method: 'POST', body: JSON.stringify(data),
      }),
    update: (slug: string, id: string, data: Partial<AutopilotRule>) =>
      apiRequest<AutopilotRule>(`/api/workspaces/${slug}/autopilot/${id}`, {
        method: 'PATCH', body: JSON.stringify(data),
      }),
    delete: (slug: string, id: string) =>
      apiRequest(`/api/workspaces/${slug}/autopilot/${id}`, { method: 'DELETE' }),
    run: (slug: string, id: string) =>
      apiRequest(`/api/workspaces/${slug}/autopilot/${id}/run`, { method: 'POST' }),
  },

  activity: {
    list: (slug: string) => apiRequest<AgentRun[]>(`/api/workspaces/${slug}/activity`),
  },

  git: {
    list: (slug: string) =>
      apiRequest<GitConnection[]>(`/api/workspaces/${slug}/git`, { workspaceSlug: slug }),
    connect: (slug: string, data: { provider: 'github' | 'gitlab' | 'bitbucket'; repoOwner: string; repoName: string; accessToken: string }) =>
      apiRequest<GitConnection & { webhookSecret: string }>(`/api/workspaces/${slug}/git`, {
        method: 'POST',
        body: JSON.stringify(data),
        workspaceSlug: slug,
      }),
    disconnect: (slug: string, connectionId: string) =>
      apiRequest(`/api/workspaces/${slug}/git/${connectionId}`, {
        method: 'DELETE',
        workspaceSlug: slug,
      }),
    test: (slug: string, connectionId: string) =>
      apiRequest<{ ok: boolean; repo?: { fullName: string; defaultBranch: string }; error?: string }>(
        `/api/workspaces/${slug}/git/${connectionId}/test`,
        { workspaceSlug: slug }
      ),
    sync: (slug: string, connectionId: string) =>
      apiRequest<{ ok: boolean; created: number; updated: number; total: number }>(
        `/api/workspaces/${slug}/git/${connectionId}/sync`,
        { method: 'POST', workspaceSlug: slug }
      ),
  },

  vercel: {
    list: (slug: string) =>
      apiRequest<VercelConnection[]>(`/api/workspaces/${slug}/vercel`, { workspaceSlug: slug }),
    lookupProjects: (slug: string, data: { accessToken: string; teamId?: string }) =>
      apiRequest<{ user: { username: string; email: string }; teams: { id: string; slug: string; name: string }[]; projects: { id: string; name: string; framework: string | null }[] }>(
        `/api/workspaces/${slug}/vercel/projects`,
        { method: 'POST', body: JSON.stringify(data), workspaceSlug: slug }
      ),
    connect: (slug: string, data: {
      accessToken: string; teamId?: string; teamSlug?: string; teamName?: string
      projectId: string; projectName: string; framework?: string; gitConnectionId?: string
    }) =>
      apiRequest<VercelConnection>(`/api/workspaces/${slug}/vercel`, {
        method: 'POST', body: JSON.stringify(data), workspaceSlug: slug,
      }),
    update: (slug: string, connectionId: string, data: { gitConnectionId?: string | null }) =>
      apiRequest<VercelConnection>(`/api/workspaces/${slug}/vercel/${connectionId}`, {
        method: 'PATCH', body: JSON.stringify(data), workspaceSlug: slug,
      }),
    disconnect: (slug: string, connectionId: string) =>
      apiRequest(`/api/workspaces/${slug}/vercel/${connectionId}`, {
        method: 'DELETE', workspaceSlug: slug,
      }),
    deployments: (slug: string, connectionId: string) =>
      apiRequest<{ deployments: VercelDeployment[] }>(
        `/api/workspaces/${slug}/vercel/${connectionId}/deployments`,
        { workspaceSlug: slug }
      ),
    deploy: (slug: string, connectionId: string) =>
      apiRequest<{ deployment: VercelDeployment }>(
        `/api/workspaces/${slug}/vercel/${connectionId}/deploy`,
        { method: 'POST', workspaceSlug: slug }
      ),
  },

  chat: {
    threads: (slug: string) => apiRequest<Message[]>(`/api/workspaces/${slug}/chat/threads`),
    messages: (slug: string, threadId: string) =>
      apiRequest<Message[]>(`/api/workspaces/${slug}/chat/threads/${threadId}/messages`),
    sendMessage: (slug: string, threadId: string, content: string, fileIds?: string[]) =>
      apiRequest<{ message: Message; agentRunId: string; threadId: string }>(
        `/api/workspaces/${slug}/chat/threads/${threadId}/messages`,
        { method: 'POST', body: JSON.stringify({ content, fileIds }) }
      ),
  },
}

// Shared types
export type LLMProvider = 'anthropic' | 'openai' | 'google' | 'groq' | 'mistral' | 'ollama'

export interface Workspace {
  id: string
  name: string
  slug: string
  templateType: string
  role: string
  createdAt: string
  llmProvider: LLMProvider | null
  llmModel: string | null
}

export type TaskStatus = 'backlog' | 'todo' | 'in_progress' | 'review' | 'done' | 'cancelled'
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'
export type TaskDomain =
  | 'general' | 'development' | 'qa' | 'marketing' | 'finance'
  | 'design' | 'operations' | 'hr' | 'legal' | 'sales'

export interface Task {
  id: string
  workspaceId: string
  title: string
  description: string | null
  status: TaskStatus
  priority: TaskPriority
  domain: TaskDomain
  labels: string[]
  dueDate: string | null
  agentOwned: boolean
  queuedForAgent: boolean
  agentNotes: string | null
  gitConnectionId: string | null
  gitIssueNumber: number | null
  metadata: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
}

export type BoardColumns = Record<'backlog' | 'todo' | 'in_progress' | 'review' | 'done', Task[]>

export interface Message {
  id: string
  workspaceId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  threadId: string
  agentRunId: string | null
  channel: string
  createdAt: string
}

export interface Skill {
  id: string
  name: string
  description: string | null
  prompt: string
  triggerPhrase: string | null
  tools: string[]
  isActive: boolean
}

export interface TelegramConnection {
  id: string
  telegramUsername: string | null
  connectedAt: string
}

export interface WorkspaceFile {
  id: string
  name: string
  mimeType: string | null
  sizeBytes: number | null
  storageKey: string
  url: string
  createdAt: string
  extractionStatus: 'pending' | 'processing' | 'extracted' | 'failed'
  extractedAt: string | null
}

export interface ExtractedFileContent {
  fileId: string
  extractionStatus: string
  extractedAt: string | null
  chunks: Array<{ content: string; metadata: Record<string, unknown> | null }>
}

export type AutopilotTrigger = 'schedule' | 'task_created' | 'task_status_changed' | 'message_received' | 'git_issue_opened' | 'git_pr_opened'
export type AutopilotAction = 'run_agent' | 'create_task' | 'send_message' | 'call_webhook'

export interface AutopilotRule {
  id: string
  workspaceId: string
  name: string
  description: string | null
  triggerType: AutopilotTrigger
  triggerConfig: Record<string, unknown>
  actionType: AutopilotAction
  actionConfig: Record<string, unknown>
  isActive: boolean
  lastRunAt: string | null
  createdAt: string
  updatedAt: string
}

export type GitProvider = 'github' | 'gitlab' | 'bitbucket'

export interface GitConnection {
  id: string
  workspaceId: string
  provider: GitProvider
  repoOwner: string
  repoName: string
  webhookSecret?: string
  connectedBy: string
  connectedAt: string
}

export interface VercelConnection {
  id: string
  workspaceId: string
  teamId: string | null
  teamSlug: string | null
  teamName: string | null
  projectId: string
  projectName: string
  framework: string | null
  gitConnectionId: string | null
  connectedBy: string
  connectedAt: string
}

export interface VercelDeployment {
  uid: string
  name: string
  url: string
  state: 'BUILDING' | 'ERROR' | 'INITIALIZING' | 'QUEUED' | 'READY' | 'CANCELED'
  createdAt: number
  target: 'production' | 'staging' | null
}

export interface AgentRun {
  id: string
  trigger: string
  status: string
  input: string
  output: string | null
  tokensUsed: number | null
  durationMs: number | null
  createdAt: string
  completedAt: string | null
}
