import { createHmac, timingSafeEqual } from 'crypto'
import type {
  GitAdapter, GitIssue, GitPullRequest, GitRepo,
  CreateIssueInput, UpdateIssueInput, WebhookEvent,
} from './types.js'

const BASE = 'https://gitlab.com/api/v4'

export class GitLabAdapter implements GitAdapter {
  readonly provider = 'gitlab' as const

  constructor(private token: string) {}

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
      ...options,
      headers: {
        'PRIVATE-TOKEN': this.token,
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string>),
      },
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { message?: string }
      throw new Error(`GitLab API ${res.status}: ${err.message ?? res.statusText}`)
    }
    return res.json() as Promise<T>
  }

  private encode(owner: string, name: string) {
    return encodeURIComponent(`${owner}/${name}`)
  }

  async getRepo(owner: string, name: string): Promise<GitRepo> {
    const r = await this.request<any>(`/projects/${this.encode(owner, name)}`)
    return {
      owner, name,
      fullName: r.path_with_namespace,
      description: r.description,
      url: r.web_url,
      defaultBranch: r.default_branch,
      isPrivate: r.visibility !== 'public',
      openIssuesCount: r.open_issues_count ?? 0,
    }
  }

  async listIssues(owner: string, name: string, state: 'open' | 'closed' | 'all' = 'open'): Promise<GitIssue[]> {
    const glState = state === 'all' ? '' : `&state=${state === 'open' ? 'opened' : 'closed'}`
    const items = await this.request<any[]>(`/projects/${this.encode(owner, name)}/issues?per_page=50${glState}`)
    return items.map(mapGitLabIssue)
  }

  async getIssue(owner: string, name: string, number: number): Promise<GitIssue> {
    const i = await this.request<any>(`/projects/${this.encode(owner, name)}/issues/${number}`)
    return mapGitLabIssue(i)
  }

  async createIssue(owner: string, name: string, input: CreateIssueInput): Promise<GitIssue> {
    const body: Record<string, unknown> = { title: input.title }
    if (input.body) body.description = input.body
    if (input.labels?.length) body.labels = input.labels.join(',')
    if (input.assignees?.length) body.assignee_ids = input.assignees
    const i = await this.request<any>(`/projects/${this.encode(owner, name)}/issues`, {
      method: 'POST',
      body: JSON.stringify(body),
    })
    return mapGitLabIssue(i)
  }

  async updateIssue(owner: string, name: string, number: number, input: UpdateIssueInput): Promise<GitIssue> {
    const body: Record<string, unknown> = {}
    if (input.title !== undefined) body.title = input.title
    if (input.body !== undefined) body.description = input.body
    if (input.state !== undefined) body.state_event = input.state === 'closed' ? 'close' : 'reopen'
    if (input.labels !== undefined) body.labels = input.labels.join(',')
    const i = await this.request<any>(`/projects/${this.encode(owner, name)}/issues/${number}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    })
    return mapGitLabIssue(i)
  }

  async listPullRequests(owner: string, name: string, state: 'open' | 'closed' | 'all' = 'open'): Promise<GitPullRequest[]> {
    const glState = state === 'all' ? '' : `&state=${state === 'open' ? 'opened' : 'closed'}`
    const items = await this.request<any[]>(`/projects/${this.encode(owner, name)}/merge_requests?per_page=50${glState}`)
    return items.map(mapGitLabMR)
  }

  verifyWebhook(body: string, signature: string, secret: string): boolean {
    // GitLab uses X-Gitlab-Token header (plain token, not HMAC)
    return timingSafeEqual(Buffer.from(signature), Buffer.from(secret))
  }

  parseWebhookEvent(headers: Record<string, string>, body: string): WebhookEvent {
    const payload = JSON.parse(body) as Record<string, unknown>
    const eventType = headers['x-gitlab-event'] ?? 'unknown'
    const project = (payload.project as any) ?? {}
    const [owner, name] = (project.path_with_namespace ?? '/').split('/')
    return {
      type: mapGitLabEventType(eventType),
      action: payload.object_attributes ? (payload.object_attributes as any).action : undefined,
      repoOwner: owner ?? '',
      repoName: name ?? '',
      payload,
    }
  }
}

function mapGitLabEventType(event: string): WebhookEvent['type'] {
  if (event.includes('Push')) return 'push'
  if (event.includes('Merge Request')) return 'pull_request'
  if (event.includes('Issue')) return 'issues'
  if (event.includes('Note')) return 'issue_comment'
  return 'unknown'
}

function mapGitLabIssue(i: any): GitIssue {
  return {
    id: i.id,
    number: i.iid,
    title: i.title,
    body: i.description,
    state: i.state === 'opened' ? 'open' : 'closed',
    url: i.web_url,
    labels: i.labels ?? [],
    assignees: (i.assignees ?? []).map((a: any) => a.username as string),
    createdAt: i.created_at,
    updatedAt: i.updated_at,
    author: i.author?.username ?? '',
  }
}

function mapGitLabMR(p: any): GitPullRequest {
  return {
    id: p.id,
    number: p.iid,
    title: p.title,
    body: p.description,
    state: p.state === 'merged' ? 'merged' : p.state === 'opened' ? 'open' : 'closed',
    url: p.web_url,
    sourceBranch: p.source_branch,
    targetBranch: p.target_branch,
    draft: p.draft ?? false,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
    author: p.author?.username ?? '',
  }
}
