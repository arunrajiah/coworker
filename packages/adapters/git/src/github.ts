import { createHmac, timingSafeEqual } from 'crypto'
import type {
  GitAdapter, GitIssue, GitPullRequest, GitRepo,
  CreateIssueInput, UpdateIssueInput, WebhookEvent,
} from './types.js'

const BASE = 'https://api.github.com'

export class GitHubAdapter implements GitAdapter {
  readonly provider = 'github' as const

  constructor(private token: string) {}

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string>),
      },
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { message?: string }
      throw new Error(`GitHub API ${res.status}: ${err.message ?? res.statusText}`)
    }
    return res.json() as Promise<T>
  }

  async getRepo(owner: string, name: string): Promise<GitRepo> {
    const r = await this.request<any>(`/repos/${owner}/${name}`)
    return {
      owner, name,
      fullName: r.full_name,
      description: r.description,
      url: r.html_url,
      defaultBranch: r.default_branch,
      isPrivate: r.private,
      openIssuesCount: r.open_issues_count,
    }
  }

  async listIssues(owner: string, name: string, state: 'open' | 'closed' | 'all' = 'open'): Promise<GitIssue[]> {
    const items = await this.request<any[]>(`/repos/${owner}/${name}/issues?state=${state}&per_page=50&pulls=false`)
    return items
      .filter((i) => !i.pull_request) // issues endpoint also returns PRs
      .map(mapGitHubIssue)
  }

  async getIssue(owner: string, name: string, number: number): Promise<GitIssue> {
    const i = await this.request<any>(`/repos/${owner}/${name}/issues/${number}`)
    return mapGitHubIssue(i)
  }

  async createIssue(owner: string, name: string, input: CreateIssueInput): Promise<GitIssue> {
    const i = await this.request<any>(`/repos/${owner}/${name}/issues`, {
      method: 'POST',
      body: JSON.stringify({
        title: input.title,
        body: input.body ?? '',
        labels: input.labels ?? [],
        assignees: input.assignees ?? [],
      }),
    })
    return mapGitHubIssue(i)
  }

  async updateIssue(owner: string, name: string, number: number, input: UpdateIssueInput): Promise<GitIssue> {
    const body: Record<string, unknown> = {}
    if (input.title !== undefined) body.title = input.title
    if (input.body !== undefined) body.body = input.body
    if (input.state !== undefined) body.state = input.state
    if (input.labels !== undefined) body.labels = input.labels
    if (input.assignees !== undefined) body.assignees = input.assignees
    const i = await this.request<any>(`/repos/${owner}/${name}/issues/${number}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    })
    return mapGitHubIssue(i)
  }

  async listPullRequests(owner: string, name: string, state: 'open' | 'closed' | 'all' = 'open'): Promise<GitPullRequest[]> {
    const items = await this.request<any[]>(`/repos/${owner}/${name}/pulls?state=${state}&per_page=50`)
    return items.map(mapGitHubPR)
  }

  verifyWebhook(body: string, signature: string, secret: string): boolean {
    const sig = signature.startsWith('sha256=') ? signature.slice(7) : signature
    const expected = createHmac('sha256', secret).update(body).digest('hex')
    try {
      return timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'))
    } catch {
      return false
    }
  }

  parseWebhookEvent(headers: Record<string, string>, body: string): WebhookEvent {
    const event = headers['x-github-event'] ?? 'unknown'
    const payload = JSON.parse(body) as Record<string, unknown>
    const repo = (payload.repository as any)
    return {
      type: event as WebhookEvent['type'],
      action: payload.action as string | undefined,
      repoOwner: repo?.owner?.login ?? '',
      repoName: repo?.name ?? '',
      payload,
    }
  }
}

function mapGitHubIssue(i: any): GitIssue {
  return {
    id: i.id,
    number: i.number,
    title: i.title,
    body: i.body,
    state: i.state,
    url: i.html_url,
    labels: (i.labels ?? []).map((l: any) => l.name as string),
    assignees: (i.assignees ?? []).map((a: any) => a.login as string),
    createdAt: i.created_at,
    updatedAt: i.updated_at,
    author: i.user?.login ?? '',
  }
}

function mapGitHubPR(p: any): GitPullRequest {
  return {
    id: p.id,
    number: p.number,
    title: p.title,
    body: p.body,
    state: p.merged_at ? 'merged' : p.state,
    url: p.html_url,
    sourceBranch: p.head?.ref ?? '',
    targetBranch: p.base?.ref ?? '',
    draft: p.draft ?? false,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
    author: p.user?.login ?? '',
  }
}
