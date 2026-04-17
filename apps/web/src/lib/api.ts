const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

function getToken() {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('token')
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
      apiRequest('/api/auth/magic-link/send', {
        method: 'POST',
        body: JSON.stringify({ email }),
      }),
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
  },

  tasks: {
    list: (slug: string, params?: { status?: string }) => {
      const qs = params ? `?${new URLSearchParams(params as any)}` : ''
      return apiRequest<Task[]>(`/api/workspaces/${slug}/tasks${qs}`)
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

  chat: {
    threads: (slug: string) => apiRequest<Message[]>(`/api/workspaces/${slug}/chat/threads`),
    messages: (slug: string, threadId: string) =>
      apiRequest<Message[]>(`/api/workspaces/${slug}/chat/threads/${threadId}/messages`),
    sendMessage: (slug: string, threadId: string, content: string) =>
      apiRequest<{ message: Message; agentRunId: string; threadId: string }>(
        `/api/workspaces/${slug}/chat/threads/${threadId}/messages`,
        { method: 'POST', body: JSON.stringify({ content }) }
      ),
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
}

// Shared types
export interface Workspace {
  id: string
  name: string
  slug: string
  templateType: string
  role: string
  createdAt: string
}

export interface Task {
  id: string
  workspaceId: string
  title: string
  description: string | null
  status: 'open' | 'in_progress' | 'done' | 'cancelled'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  labels: string[]
  dueDate: string | null
  agentOwned: boolean
  createdAt: string
  updatedAt: string
}

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
